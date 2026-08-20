import { createClient } from "@supabase/supabase-js";
import type {
  AssessResponse,
  AssessmentsResponse,
  AlertsResponse,
  FraudAlert,
  AlertStatus,
  RiskAssessment,
} from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const functionUrl = `${supabaseUrl}/functions/v1/fraud-api`;

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${supabaseAnonKey}`,
    "Content-Type": "application/json",
    apikey: supabaseAnonKey,
  };
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function assessTransaction(input: {
  user_id: string;
  device_id: string;
  amount: number;
  transaction_type: string;
}): Promise<AssessResponse> {
  const res = await fetch(`${functionUrl}/fraud/assess`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  if (!data?.assessment) throw new Error("Unexpected response from server");
  return data as AssessResponse;
}

export async function fetchAssessments(): Promise<
  (RiskAssessment & { transactions?: import("./types").Transaction })[]
> {
  const res = await fetch(`${functionUrl}/fraud/assessments`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as AssessmentsResponse;
  if (!data?.assessments) throw new Error("Unexpected response from server");
  return data.assessments;
}

export async function fetchAssessment(
  id: string
): Promise<RiskAssessment & { transactions?: import("./types").Transaction }> {
  const res = await fetch(`${functionUrl}/fraud/assessments/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  if (!data?.assessment) throw new Error("Unexpected response from server");
  return data.assessment;
}

export async function fetchAlerts(): Promise<FraudAlert[]> {
  const res = await fetch(`${functionUrl}/alerts`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as AlertsResponse;
  if (!data?.alerts) throw new Error("Unexpected response from server");
  return data.alerts;
}

export async function fetchAlert(id: string): Promise<FraudAlert> {
  const res = await fetch(`${functionUrl}/alerts/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  if (!data?.alert) throw new Error("Unexpected response from server");
  return data.alert;
}

export async function updateAlert(
  id: string,
  update: { status: AlertStatus; analyst_note?: string }
): Promise<FraudAlert> {
  const res = await fetch(`${functionUrl}/alerts/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  if (!data?.alert) throw new Error("Unexpected response from server");
  return data.alert;
}

export async function fetchUserRiskHistory(
  userId: string
): Promise<(RiskAssessment & { transactions?: import("./types").Transaction })[]> {
  const res = await fetch(`${functionUrl}/users/${userId}/risk-history`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = await res.json();
  if (!data?.assessments) throw new Error("Unexpected response from server");
  return data.assessments;
}

// ---- Seed helpers (direct table access for demo data) ----

export async function fetchUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, phone, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchDevices(userId?: string) {
  let q = supabase
    .from("devices")
    .select("id, user_id, device_fingerprint, first_seen_at")
    .order("first_seen_at", { ascending: true });
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

export async function createUser(input: {
  name: string;
  email: string;
  phone?: string;
}) {
  const { data, error } = await supabase
    .from("users")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createDevice(input: {
  user_id: string;
  device_fingerprint: string;
}) {
  const { data, error } = await supabase
    .from("devices")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
