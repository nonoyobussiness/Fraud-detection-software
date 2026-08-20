import { supabase, createUser, createDevice } from "./api";
import type { User, Device } from "./types";

interface SeedUser {
  name: string;
  email: string;
  phone: string;
  fingerprint: string;
  history: { amount: number; type: string; daysAgo: number; hour: number }[];
}

const SEED: SeedUser[] = [
  {
    name: "Amara Okafor",
    email: "amara.okafor@example.com",
    phone: "+234 803 555 0101",
    fingerprint: "fp_amara_macbook_pro_a1b2",
    history: [
      { amount: 1200, type: "loan_disbursement", daysAgo: 20, hour: 10 },
      { amount: 1350, type: "loan_disbursement", daysAgo: 18, hour: 11 },
      { amount: 1100, type: "loan_disbursement", daysAgo: 15, hour: 9 },
      { amount: 1500, type: "loan_disbursement", daysAgo: 12, hour: 10 },
      { amount: 1300, type: "loan_disbursement", daysAgo: 8, hour: 11 },
      { amount: 1250, type: "repayment", daysAgo: 5, hour: 14 },
      { amount: 1400, type: "loan_disbursement", daysAgo: 3, hour: 10 },
    ],
  },
  {
    name: "Bilal Haddad",
    email: "bilal.haddad@example.com",
    phone: "+971 50 555 0202",
    fingerprint: "fp_bilal_iphone_15_pro_x9",
    history: [
      { amount: 800, type: "repayment", daysAgo: 14, hour: 8 },
      { amount: 900, type: "repayment", daysAgo: 10, hour: 9 },
      { amount: 850, type: "repayment", daysAgo: 6, hour: 8 },
      { amount: 820, type: "repayment", daysAgo: 2, hour: 9 },
    ],
  },
  {
    name: "Chen Wei",
    email: "chen.wei@example.com",
    phone: "+86 138 5555 0303",
    fingerprint: "fp_chen_pixel_8_pro_m4n",
    history: [
      { amount: 500, type: "cash_out", daysAgo: 9, hour: 19 },
      { amount: 600, type: "cash_out", daysAgo: 7, hour: 20 },
      { amount: 550, type: "cash_out", daysAgo: 4, hour: 18 },
      { amount: 580, type: "cash_out", daysAgo: 1, hour: 19 },
    ],
  },
];

export async function seedSampleData(): Promise<{ users: User[]; devices: Record<string, Device[]> }> {
  const users: User[] = [];
  const devices: Record<string, Device[]> = {};

  for (const s of SEED) {
    let user: User;
    const existing = await supabase.from("users").select("id, name, email, phone, created_at").eq("email", s.email).maybeSingle();
    if (existing.data) {
      user = existing.data as User;
    } else {
      user = await createUser({ name: s.name, email: s.email, phone: s.phone });
    }
    users.push(user);

    // Create device
    let device: Device;
    const devExisting = await supabase
      .from("devices")
      .select("id, user_id, device_fingerprint, first_seen_at")
      .eq("user_id", user.id)
      .eq("device_fingerprint", s.fingerprint)
      .maybeSingle();
    if (devExisting.data) {
      device = devExisting.data as Device;
    } else {
      device = await createDevice({ user_id: user.id, device_fingerprint: s.fingerprint });
    }
    devices[user.id] = [device];

    // Insert past transactions
    const now = new Date();
    for (const h of s.history) {
      const ts = new Date(now);
      ts.setDate(ts.getDate() - h.daysAgo);
      ts.setHours(h.hour, Math.floor(Math.random() * 30), 0, 0);
      await supabase.from("transactions").insert({
        user_id: user.id,
        device_id: device.id,
        amount: h.amount,
        transaction_type: h.type,
        created_at: ts.toISOString(),
      });
    }
  }

  return { users, devices };
}

export async function ensureSeedData() {
  const { count } = await supabase.from("users").select("id", { count: "exact", head: true });
  if ((count ?? 0) === 0) {
    await seedSampleData();
  }
}
