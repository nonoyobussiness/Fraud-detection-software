/*
# Fraud Detection Schema

Creates the core tables for a digital lending fraud-detection platform.

1. New Tables
- `users` — platform users (borrowers). Columns: id, name, email, phone, created_at.
- `devices` — devices a user has transacted from, identified by fingerprint. Columns: id, user_id, device_fingerprint, first_seen_at.
- `transactions` — individual lending transactions. Columns: id, user_id, device_id, amount, transaction_type, created_at.
- `risk_assessments` — risk score + decision for a transaction. Columns: id, transaction_id, risk_score, decision, reason, created_at.
- `fraud_alerts` — analyst-facing alert when a decision is review/block. Columns: id, risk_assessment_id, status, analyst_note, updated_at.

2. Relationships
- devices.user_id -> users.id
- transactions.user_id -> users.id
- transactions.device_id -> devices.id
- risk_assessments.transaction_id -> transactions.id
- fraud_alerts.risk_assessment_id -> risk_assessments.id

3. Security
- RLS enabled on all tables.
- This is a no-auth internal dashboard (analyst tool), so policies allow anon+authenticated full CRUD on all tables. The data is intentionally shared across the analyst dashboard.
- Indexes on common query paths (user_id, device_id, transaction_id, status).

4. Notes
- `transaction_type` is a free-text label (e.g. "loan_disbursement", "repayment").
- `decision` constrained to approve/review/block.
- `fraud_alerts.status` constrained to open/reviewed/dismissed.
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_fingerprint)
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  transaction_type text NOT NULL DEFAULT 'loan_disbursement',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  risk_score numeric(5,4) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
  decision text NOT NULL CHECK (decision IN ('approve','review','block')),
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fraud_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_assessment_id uuid NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  analyst_note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_device_id ON transactions(device_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_transaction_id ON risk_assessments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_risk_assessment_id ON fraud_alerts(risk_assessment_id);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;

-- users policies (no-auth dashboard: anon+authenticated full CRUD)
DROP POLICY IF EXISTS "anon_select_users" ON users;
CREATE POLICY "anon_select_users" ON users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_users" ON users;
CREATE POLICY "anon_insert_users" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_users" ON users;
CREATE POLICY "anon_update_users" ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_users" ON users;
CREATE POLICY "anon_delete_users" ON users FOR DELETE TO anon, authenticated USING (true);

-- devices policies
DROP POLICY IF EXISTS "anon_select_devices" ON devices;
CREATE POLICY "anon_select_devices" ON devices FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_devices" ON devices;
CREATE POLICY "anon_insert_devices" ON devices FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_devices" ON devices;
CREATE POLICY "anon_update_devices" ON devices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_devices" ON devices;
CREATE POLICY "anon_delete_devices" ON devices FOR DELETE TO anon, authenticated USING (true);

-- transactions policies
DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
CREATE POLICY "anon_select_transactions" ON transactions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
CREATE POLICY "anon_insert_transactions" ON transactions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
CREATE POLICY "anon_update_transactions" ON transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "anon_delete_transactions" ON transactions FOR DELETE TO anon, authenticated USING (true);

-- risk_assessments policies
DROP POLICY IF EXISTS "anon_select_risk_assessments" ON risk_assessments;
CREATE POLICY "anon_select_risk_assessments" ON risk_assessments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_risk_assessments" ON risk_assessments;
CREATE POLICY "anon_insert_risk_assessments" ON risk_assessments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_risk_assessments" ON risk_assessments;
CREATE POLICY "anon_update_risk_assessments" ON risk_assessments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_risk_assessments" ON risk_assessments;
CREATE POLICY "anon_delete_risk_assessments" ON risk_assessments FOR DELETE TO anon, authenticated USING (true);

-- fraud_alerts policies
DROP POLICY IF EXISTS "anon_select_fraud_alerts" ON fraud_alerts;
CREATE POLICY "anon_select_fraud_alerts" ON fraud_alerts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_fraud_alerts" ON fraud_alerts;
CREATE POLICY "anon_insert_fraud_alerts" ON fraud_alerts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_fraud_alerts" ON fraud_alerts;
CREATE POLICY "anon_update_fraud_alerts" ON fraud_alerts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_fraud_alerts" ON fraud_alerts;
CREATE POLICY "anon_delete_fraud_alerts" ON fraud_alerts FOR DELETE TO anon, authenticated USING (true);

-- auto-update fraud_alerts.updated_at on row update
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_fraud_alerts_updated_at ON fraud_alerts;
CREATE TRIGGER set_fraud_alerts_updated_at
BEFORE UPDATE ON fraud_alerts
FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
