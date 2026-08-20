export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export interface Device {
  id: string;
  user_id: string;
  device_fingerprint: string;
  first_seen_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  device_id: string;
  amount: number;
  transaction_type: string;
  created_at: string;
}

export type Decision = "approve" | "review" | "block";

export interface RiskAssessment {
  id: string;
  transaction_id: string;
  risk_score: number;
  decision: Decision;
  reason: string;
  llm_reason?: string | null;
  created_at: string;
  transactions?: Transaction;
}

export type AlertStatus = "open" | "reviewed" | "dismissed";

export interface FraudAlert {
  id: string;
  risk_assessment_id: string;
  status: AlertStatus;
  analyst_note: string;
  updated_at: string;
  risk_assessments?: RiskAssessment & { transactions?: Transaction };
}

export interface AssessResponse {
  transaction: Transaction;
  assessment: RiskAssessment;
  alert: FraudAlert | null;
}

export interface AssessmentsResponse {
  assessments: (RiskAssessment & { transactions?: Transaction })[];
}

export interface AlertsResponse {
  alerts: FraudAlert[];
}
