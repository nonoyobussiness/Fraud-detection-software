/*
 * Seed script: 8 users with 12-15 historical transactions each,
 * then 10 test transactions run through POST /fraud/assess.
 *
 * Run with: npx tsx scripts/seed-fraud-data.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load .env manually (no dotenv dependency)
const envFile = readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
for (const line of envFile.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const apiUrl = `${SUPABASE_URL}/functions/v1/fraud-api`;

function headers() {
  return {
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
  };
}

function daysAgoISO(days: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// --- User profiles: each has a consistent pattern ---

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  devices: string[]; // fingerprints
  baseAmount: number;
  amountVariance: number;
  typicalHours: [number, number]; // [minHour, maxHour]
  txType: string;
  historyCount: number;
}

const PROFILES: UserProfile[] = [
  {
    name: "Amara Okafor", email: "amara.okafor@example.com", phone: "+234 803 555 0101",
    devices: ["fp_amara_macbook_a1b2", "fp_amara_iphone_x7y8"],
    baseAmount: 1200, amountVariance: 200, typicalHours: [9, 12], txType: "loan_disbursement", historyCount: 14,
  },
  {
    name: "Bilal Haddad", email: "bilal.haddad@example.com", phone: "+971 50 555 0202",
    devices: ["fp_bilal_iphone_x9"],
    baseAmount: 850, amountVariance: 100, typicalHours: [8, 11], txType: "repayment", historyCount: 13,
  },
  {
    name: "Chen Wei", email: "chen.wei@example.com", phone: "+86 138 5555 0303",
    devices: ["fp_chen_pixel_m4n", "fp_chen_ipad_p3q"],
    baseAmount: 550, amountVariance: 80, typicalHours: [18, 21], txType: "cash_out", historyCount: 15,
  },
  {
    name: "Diego Martinez", email: "diego.martinez@example.com", phone: "+52 55 5555 0404",
    devices: ["fp_diego_galaxy_k2l"],
    baseAmount: 2200, amountVariance: 350, typicalHours: [10, 14], txType: "loan_disbursement", historyCount: 12,
  },
  {
    name: "Esi Asante", email: "esi.asante@example.com", phone: "+233 24 555 0505",
    devices: ["fp_esi_tecno_r6s", "fp_esi_laptop_t1u"],
    baseAmount: 700, amountVariance: 120, typicalHours: [7, 10], txType: "repayment", historyCount: 14,
  },
  {
    name: "Farah Nazari", email: "farah.nazari@example.com", phone: "+98 912 555 0606",
    devices: ["fp_farah_iphone_w5x"],
    baseAmount: 1500, amountVariance: 250, typicalHours: [13, 16], txType: "loan_disbursement", historyCount: 13,
  },
  {
    name: "Grace Mwangi", email: "grace.mwangi@example.com", phone: "+254 712 555 0707",
    devices: ["fp_grace_huawei_z3a"],
    baseAmount: 950, amountVariance: 150, typicalHours: [11, 15], txType: "cash_out", historyCount: 15,
  },
  {
    name: "Hiroshi Tanaka", email: "hiroshi.tanaka@example.com", phone: "+81 90 5555 0808",
    devices: ["fp_hiroshi_macbook_b9c", "fp_hiroshi_iphone_d0e"],
    baseAmount: 3100, amountVariance: 400, typicalHours: [9, 12], txType: "loan_disbursement", historyCount: 14,
  },
];

// --- Test transactions (10 total) ---
// 4 normal, 3 moderate, 3 clearly fraudulent

interface TestCase {
  userIndex: number;
  deviceIndex: number; // index into user's devices; -1 means new device
  amount: number;
  type: string;
  hour: number;
  minute?: number;
  // For velocity tests: send a setup transaction N minutes before the main one
  setupBefore?: { amount: number; minutesBefore: number; useKnownDevice?: boolean };
  label: string;
  expected: string;
}

const TEST_CASES: TestCase[] = [
  // 4 normal — expect approve
  { userIndex: 0, deviceIndex: 0, amount: 1250, type: "loan_disbursement", hour: 10, label: "Normal: Amara, typical amount & hour", expected: "approve" },
  { userIndex: 3, deviceIndex: 0, amount: 2100, type: "loan_disbursement", hour: 12, label: "Normal: Diego, typical amount & hour", expected: "approve" },
  { userIndex: 5, deviceIndex: 0, amount: 1450, type: "loan_disbursement", hour: 14, label: "Normal: Farah, typical amount & hour", expected: "approve" },
  { userIndex: 7, deviceIndex: 0, amount: 3000, type: "loan_disbursement", hour: 11, label: "Normal: Hiroshi, typical amount & hour", expected: "approve" },

  // 3 moderately anomalous — expect review
  { userIndex: 1, deviceIndex: 0, amount: 2200, type: "repayment", hour: 8, label: "Moderate: Bilal, 2.6x usual amount", expected: "review" },
  { userIndex: 2, deviceIndex: 0, amount: 1100, type: "cash_out", hour: 3, label: "Moderate: Chen, 2x amount + unusual hour (3am)", expected: "review" },
  { userIndex: 4, deviceIndex: 0, amount: 1800, type: "repayment", hour: 7, label: "Moderate: Esi, 2.5x usual amount", expected: "review" },

  // 3 clearly fraudulent — expect block
  { userIndex: 0, deviceIndex: -1, amount: 9800, type: "loan_disbursement", hour: 3, label: "Fraud: Amara, new device + 8x amount + 3am", expected: "block" },
  { userIndex: 6, deviceIndex: -1, amount: 6200, type: "cash_out", hour: 4, label: "Fraud: Grace, new device + 6.5x amount + 4am", expected: "block" },
  { userIndex: 3, deviceIndex: -1, amount: 14000, type: "loan_disbursement", hour: 10, setupBefore: { amount: 2100, minutesBefore: 3, useKnownDevice: true }, label: "Fraud: Diego, new device + 6.4x amount + velocity (3 min after a normal txn)", expected: "block" },
];

async function createDeviceIfNotExists(userId: string, fingerprint: string): Promise<string> {
  const { data: existing } = await supabase
    .from("devices")
    .select("id")
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("devices")
    .insert({ user_id: userId, device_fingerprint: fingerprint })
    .select()
    .single();
  if (error) throw new Error(`Failed to create device: ${error.message}`);
  return data.id;
}

async function createUserIfNotExists(profile: UserProfile): Promise<string> {
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", profile.email)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("users")
    .insert({ name: profile.name, email: profile.email, phone: profile.phone })
    .select()
    .single();
  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data.id;
}

async function seedHistory() {
  console.log("=== Seeding 8 users with historical transactions ===\n");

  for (const profile of PROFILES) {
    const userId = await createUserIfNotExists(profile);

    // Create devices
    const deviceIds: string[] = [];
    for (const fp of profile.devices) {
      const did = await createDeviceIfNotExists(userId, fp);
      deviceIds.push(did);
    }

    // Check if this user already has transactions
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if ((count ?? 0) > 0) {
      console.log(`  ${profile.name}: already has ${count} transactions, skipping history`);
      continue;
    }

    // Generate historical transactions spread over 30 days
    const [minH, maxH] = profile.typicalHours;
    for (let i = 0; i < profile.historyCount; i++) {
      const daysBack = Math.floor((30 / profile.historyCount) * (i + 1));
      const hour = minH + Math.floor(Math.random() * (maxH - minH + 1));
      const minute = Math.floor(Math.random() * 50);
      const amount = profile.baseAmount + Math.round((Math.random() - 0.5) * 2 * profile.amountVariance);
      const deviceIdx = Math.floor(Math.random() * deviceIds.length);

      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        device_id: deviceIds[deviceIdx],
        amount,
        transaction_type: profile.txType,
        created_at: daysAgoISO(daysBack, hour, minute),
      });
      if (error) console.log(`    Error inserting history tx: ${error.message}`);
    }

    console.log(`  ${profile.name}: ${profile.historyCount} transactions, ${profile.devices.length} device(s), $${profile.baseAmount}±$${profile.amountVariance}, hours ${minH}-${maxH}`);
  }
}

async function runTestTransactions() {
  console.log("\n=== Running 10 test transactions through /fraud/assess ===\n");

  const results: { label: string; expected: string; decision: string; score: number; reason: string; match: boolean }[] = [];

  for (const tc of TEST_CASES) {
    const profile = PROFILES[tc.userIndex];
    const userId = await createUserIfNotExists(profile);

    let deviceId: string;
    if (tc.deviceIndex === -1) {
      // Create a brand new device for this user
      const newFp = `fp_new_device_${Date.now()}_${tc.userIndex}`;
      deviceId = await createDeviceIfNotExists(userId, newFp);
    } else {
      // Use existing device
      const fps = profile.devices;
      const fp = fps[tc.deviceIndex] ?? fps[0];
      deviceId = await createDeviceIfNotExists(userId, fp);
    }

    // Compute timestamp: today at the specified hour
    const ts = new Date();
    ts.setHours(tc.hour, tc.minute ?? 0, 0, 0);
    const timestamp = ts.toISOString();

    // If velocity setup, send a prior transaction first
    if (tc.setupBefore) {
      const setupTs = new Date(ts);
      setupTs.setMinutes(setupTs.getMinutes() - tc.setupBefore.minutesBefore);
      // Use a known device for the setup so the main txn's new device stays "new"
      let setupDeviceId = deviceId;
      if (tc.setupBefore.useKnownDevice) {
        const knownFp = profile.devices[0];
        setupDeviceId = await createDeviceIfNotExists(userId, knownFp);
      }
      const setupBody = {
        user_id: userId,
        device_id: setupDeviceId,
        amount: tc.setupBefore.amount,
        transaction_type: tc.type,
        created_at: setupTs.toISOString(),
      };
      await fetch(`${apiUrl}/fraud/assess`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(setupBody),
      });
    }

    const body = {
      user_id: userId,
      device_id: deviceId,
      amount: tc.amount,
      transaction_type: tc.type,
      created_at: timestamp,
    };

    const res = await fetch(`${apiUrl}/fraud/assess`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.log(`  FAIL: ${tc.label} — HTTP ${res.status}: ${text}`);
      results.push({ label: tc.label, expected: tc.expected, decision: "error", score: 0, reason: text, match: false });
      continue;
    }

    const data = await res.json();
    const a = data.assessment;
    const match = a.decision === tc.expected;
    const symbol = match ? "PASS" : "MISMATCH";

    console.log(`  [${symbol}] ${tc.label}`);
    console.log(`        Decision: ${a.decision} (score ${(a.risk_score * 100).toFixed(1)}%) — expected ${tc.expected}`);
    console.log(`        Reason: ${a.reason}`);
    if (data.alert) console.log(`        Alert created: ${data.alert.id.slice(0, 8)}`);
    console.log("");

    results.push({ label: tc.label, expected: tc.expected, decision: a.decision, score: a.risk_score, reason: a.reason, match });
  }

  // Summary
  const passed = results.filter((r) => r.match).length;
  console.log(`\n=== Summary: ${passed}/${results.length} matched expectations ===`);
  for (const r of results) {
    const sym = r.match ? "OK" : "!!";
    console.log(`  [${sym}] ${r.expected.padEnd(8)} -> ${r.decision.padEnd(8)} | ${r.label}`);
  }
}

async function main() {
  await seedHistory();
  await runTestTransactions();
  console.log("\nDone. Open the dashboard to see the data.");
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
