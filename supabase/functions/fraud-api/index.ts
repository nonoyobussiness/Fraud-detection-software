import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WEIGHTS = { amount: 0.35, device: 0.25, velocity: 0.25, time: 0.15 };

interface TransactionRow {
  id: string;
  user_id: string;
  device_id: string;
  amount: number;
  transaction_type: string;
  created_at: string;
}

interface AssessmentRow {
  id: string;
  transaction_id: string;
  risk_score: number;
  decision: string;
  reason: string;
  created_at: string;
}

interface AlertRow {
  id: string;
  risk_assessment_id: string;
  status: string;
  analyst_note: string;
  updated_at: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return json({ error: message }, status);
}

// --- Risk scoring -------------------------------------------------------

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdDev(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function computeRiskScore(
  amount: number,
  past: TransactionRow[],
  deviceId: string,
  now: Date
): { score: number; decision: string; reason: string; components: Record<string, number> } {
  const amounts = past.map((t) => Number(t.amount));
  const avg = amounts.length > 0 ? mean(amounts) : 0;
  const sd = stdDev(amounts, avg);

  // 1. Amount deviation (z-score based, with cold-start handling)
  let amountScore = 0;
  let amountReason = "";
  const coldStart = amounts.length < 3;
  if (coldStart) {
    // Not enough history to establish a trust baseline — treat as high risk
    amountScore = 0.8;
    amountReason = "insufficient transaction history";
  } else if (sd > 0) {
    const z = (amount - avg) / sd;
    amountScore = clamp01(z / 3);
    if (z > 1) {
      amountReason = `amount ${(amount / Math.max(avg, 0.01)).toFixed(1)}x above user average`;
    }
  } else if (avg > 0 && amount > avg) {
    const ratio = amount / avg;
    amountScore = clamp01((ratio - 1) / 3);
    amountReason = `amount ${ratio.toFixed(1)}x above user average`;
  }

  // 2. Time-of-day anomaly
  const hours = past.map((t) => new Date(t.created_at).getHours());
  let timeScore = 0;
  let timeReason = "";
  if (hours.length >= 3) {
    const minH = Math.min(...hours);
    const maxH = Math.max(...hours);
    const curH = now.getHours();
    const inRange = curH >= minH && curH <= maxH;
    if (!inRange) {
      const distance = Math.min(
        Math.abs(curH - minH),
        Math.abs(curH - maxH),
        Math.abs(curH + 24 - maxH),
        Math.abs(curH - 24 - minH)
      );
      timeScore = clamp01(distance / 6);
      timeReason = `unusual hour ${curH}:00 (user typically ${minH}:00-${maxH}:00)`;
    }
  }

  // 3. New-device flag
  const seenDevice = past.some((t) => t.device_id === deviceId);
  const deviceScore = seenDevice ? 0 : 1;
  const deviceReason = seenDevice ? "" : "new device";

  // 4. Velocity (multiple transactions within 10 minutes)
  const tenMinMs = 10 * 60 * 1000;
  const recentCount = past.filter(
    (t) => {
      const diff = now.getTime() - new Date(t.created_at).getTime();
      return diff >= 0 && diff <= tenMinMs;
    }
  ).length;
  // 1 recent txn = mild, 2 = high, 3+ = max
  const velocityScore = clamp01(recentCount / 2);
  const velocityReason =
    recentCount > 0 ? `${recentCount} transaction(s) in last 10 min` : "";

  const components = {
    amount: amountScore,
    device: deviceScore,
    velocity: velocityScore,
    time: timeScore,
  };

  const score =
    amountScore * WEIGHTS.amount +
    deviceScore * WEIGHTS.device +
    velocityScore * WEIGHTS.velocity +
    timeScore * WEIGHTS.time;

  let decision = "approve";
  if (score >= 0.7) decision = "block";
  else if (score >= 0.3) decision = "review";

  // Build reason string from highest-scoring components
  const reasons: string[] = [];
  const sorted = Object.entries(components).sort((a, b) => b[1] - a[1]);
  for (const [key, val] of sorted) {
    if (val <= 0) continue;
    if (key === "amount" && amountReason) reasons.push(amountReason);
    else if (key === "device" && deviceReason) reasons.push(deviceReason);
    else if (key === "velocity" && velocityReason) reasons.push(velocityReason);
    else if (key === "time" && timeReason) reasons.push(timeReason);
    if (reasons.length >= 2) break;
  }

  const prefix = decision === "approve" ? "Approve" : decision === "review" ? "Review" : "Block";
  const reason = reasons.length > 0 ? `${prefix}: ${reasons.join("; ")}` : `${prefix}: within normal behavior`;

  return { score, decision, reason, components };
}

// --- LLM narration (optional enhancement layer, free via Groq) ----------
//
// The deterministic `reason` string above is always computed and always
// saved — it is the source of truth and the decision never depends on this
// step. This function only asks a free-tier LLM (Groq) to rephrase that
// signal breakdown into a more natural analyst-facing sentence. If the key
// is missing, the call fails, or it takes longer than 5s, this returns null
// and the API response/DB row simply omits llm_reason — nothing else breaks.

async function narrateWithLLM(
  components: Record<string, number>,
  decision: string,
  score: number
): Promise<string | null> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 80,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You are a fraud analyst assistant. Given the risk signal breakdown for a " +
              "transaction, write one concise sentence (under 30 words) explaining why it " +
              "was flagged, in plain language an analyst can act on quickly. Do not invent " +
              "details not present in the signals.",
          },
          {
            role: "user",
            content: `Signals: amount_deviation=${components.amount.toFixed(2)}, time_anomaly=${components.time.toFixed(2)}, new_device=${components.device === 1}, velocity=${components.velocity.toFixed(2)}, final_score=${score.toFixed(2)}, decision=${decision}`,
          },
        ],
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

// --- Router -------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/fraud-api/, "").replace(/^\/+/, "").replace(/\/+$/, "");
  const segments = path.split("/");
  const method = req.method;

  try {
    // POST /fraud/assess
    if (path === "fraud/assess" && method === "POST") {
      const body = await req.json();
      const { user_id, device_id, amount, transaction_type, created_at } = body;
      if (!user_id || !device_id || amount == null || !transaction_type) {
        return err("Missing required fields: user_id, device_id, amount, transaction_type", 422);
      }
      const amt = Number(amount);
      if (Number.isNaN(amt) || amt < 0) {
        return err("amount must be a non-negative number", 422);
      }

      // Verify user + device exist
      const { data: userRow } = await supabase.from("users").select("id").eq("id", user_id).maybeSingle();
      if (!userRow) return err("user not found", 404);

      const { data: deviceRow } = await supabase
        .from("devices")
        .select("id, user_id, device_fingerprint, first_seen_at")
        .eq("id", device_id)
        .maybeSingle();
      if (!deviceRow) return err("device not found", 404);
      if (deviceRow.user_id !== user_id) return err("device does not belong to user", 422);

      // Use provided timestamp or now
      const now = created_at ? new Date(created_at) : new Date();
      if (Number.isNaN(now.getTime())) {
        return err("invalid created_at timestamp", 422);
      }
      const { data: txn, error: txnErr } = await supabase
        .from("transactions")
        .insert({
          user_id,
          device_id,
          amount: amt,
          transaction_type,
          created_at: now.toISOString(),
        })
        .select()
        .single();
      if (txnErr) return err(`failed to create transaction: ${txnErr.message}`, 500);

      // Fetch user's past transactions (excluding the one we just created)
      const { data: past } = await supabase
        .from("transactions")
        .select("id, user_id, device_id, amount, transaction_type, created_at")
        .eq("user_id", user_id)
        .neq("id", txn.id)
        .order("created_at", { ascending: false })
        .limit(200);

      const pastTxns: TransactionRow[] = (past ?? []) as TransactionRow[];

      const { score, decision, reason, components } = computeRiskScore(amt, pastTxns, device_id, now);
      const llmReason = await narrateWithLLM(components, decision, score);

      const { data: assessment, error: assErr } = await supabase
        .from("risk_assessments")
        .insert({
          transaction_id: txn.id,
          risk_score: Number(score.toFixed(4)),
          decision,
          reason,
          llm_reason: llmReason,
          created_at: now.toISOString(),
        })
        .select()
        .single();
      if (assErr) return err(`failed to save assessment: ${assErr.message}`, 500);

      // Create fraud_alert if review or block
      let alert: AlertRow | null = null;
      if (decision === "review" || decision === "block") {
        const { data: a } = await supabase
          .from("fraud_alerts")
          .insert({ risk_assessment_id: assessment.id, status: "open", analyst_note: "" })
          .select()
          .single();
        alert = a as AlertRow;
      }

      return json({ transaction: txn, assessment, alert });
    }

    // GET /fraud/assessments
    if (path === "fraud/assessments" && method === "GET") {
      const { data, error } = await supabase
        .from("risk_assessments")
        .select(
          "id, transaction_id, risk_score, decision, reason, llm_reason, created_at, transactions(id, user_id, device_id, amount, transaction_type, created_at)"
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return err(error.message, 500);
      return json({ assessments: data });
    }

    // GET /fraud/assessments/:id
    if (segments.length === 2 && segments[0] === "fraud" && segments[1] === "assessments" && false) {
      // handled below
    }
    if (segments[0] === "fraud" && segments[1] === "assessments" && segments.length === 3 && method === "GET") {
      const id = segments[2];
      const { data, error } = await supabase
        .from("risk_assessments")
        .select(
          "id, transaction_id, risk_score, decision, reason, llm_reason, created_at, transactions(id, user_id, device_id, amount, transaction_type, created_at)"
        )
        .eq("id", id)
        .maybeSingle();
      if (error) return err(error.message, 500);
      if (!data) return err("assessment not found", 404);
      return json({ assessment: data });
    }

    // GET /alerts (open only)
    if (path === "alerts" && method === "GET") {
      const { data, error } = await supabase
        .from("fraud_alerts")
        .select(
          "id, risk_assessment_id, status, analyst_note, updated_at, risk_assessments(id, transaction_id, risk_score, decision, reason, llm_reason, created_at, transactions(id, user_id, device_id, amount, transaction_type, created_at))"
        )
        .eq("status", "open")
        .order("updated_at", { ascending: false });
      if (error) return err(error.message, 500);
      return json({ alerts: data });
    }

    // GET /alerts/:id
    if (segments[0] === "alerts" && segments.length === 2 && method === "GET") {
      const id = segments[1];
      const { data, error } = await supabase
        .from("fraud_alerts")
        .select(
          "id, risk_assessment_id, status, analyst_note, updated_at, risk_assessments(id, transaction_id, risk_score, decision, reason, llm_reason, created_at, transactions(id, user_id, device_id, amount, transaction_type, created_at))"
        )
        .eq("id", id)
        .maybeSingle();
      if (error) return err(error.message, 500);
      if (!data) return err("alert not found", 404);
      return json({ alert: data });
    }

    // PATCH /alerts/:id
    if (segments[0] === "alerts" && segments.length === 2 && method === "PATCH") {
      const id = segments[1];
      const body = await req.json().catch(() => ({}));
      const { status, analyst_note } = body;
      if (!status || !["open", "reviewed", "dismissed"].includes(status)) {
        return err("status must be one of: open, reviewed, dismissed", 422);
      }
      const update: Record<string, unknown> = { status };
      if (typeof analyst_note === "string") update.analyst_note = analyst_note;

      const { data, error } = await supabase
        .from("fraud_alerts")
        .update(update)
        .eq("id", id)
        .select(
          "id, risk_assessment_id, status, analyst_note, updated_at, risk_assessments(id, transaction_id, risk_score, decision, reason, llm_reason, created_at, transactions(id, user_id, device_id, amount, transaction_type, created_at))"
        )
        .maybeSingle();
      if (error) return err(error.message, 500);
      if (!data) return err("alert not found", 404);
      return json({ alert: data });
    }

    // GET /users/:id/risk-history
    if (segments[0] === "users" && segments.length === 3 && segments[2] === "risk-history" && method === "GET") {
      const userId = segments[1];
      const { data: user } = await supabase.from("users").select("id").eq("id", userId).maybeSingle();
      if (!user) return err("user not found", 404);

      const { data, error } = await supabase
        .from("risk_assessments")
        .select(
          "id, transaction_id, risk_score, decision, reason, llm_reason, created_at, transactions(id, user_id, device_id, amount, transaction_type, created_at)"
        )
        .eq("transactions.user_id", userId)
        .order("created_at", { ascending: false });
      if (error) return err(error.message, 500);
      return json({ assessments: data ?? [] });
    }

    return err(`No route for ${method} ${path}`, 404);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Internal error", 500);
  }
});
