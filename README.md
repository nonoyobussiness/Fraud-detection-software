# Fraud Detection Dashboard

## Overview

This project is a real-time fraud detection dashboard for a digital lending platform. It scores each transaction against the user’s own behavioral baseline rather than fixed thresholds, then returns an Approve/Review/Block decision with a human-readable reason for analysts to act on quickly.

## Architecture

The application uses a React frontend with Vite and Tailwind for the analyst console, while the backend is powered by Supabase using PostgreSQL and Edge Functions instead of a separate Express server. This is a deliberate substitution for the original Spring Boot design, chosen because vibe-coding tools reliably deploy Node/Postgres-based stacks faster and more predictably in a time-boxed build. The API contract and schema remain unchanged by this substitution, so the frontend and scoring logic can be swapped onto another runtime without changing consumer behavior.

## Database schema

The actual schema in the codebase defines five tables:

- users
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - name: text NOT NULL
  - email: text UNIQUE NOT NULL
  - phone: text
  - created_at: timestamptz NOT NULL DEFAULT now()
- devices
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - user_id: uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  - device_fingerprint: text NOT NULL
  - first_seen_at: timestamptz NOT NULL DEFAULT now()
  - UNIQUE (user_id, device_fingerprint)
- transactions
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - user_id: uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  - device_id: uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE
  - amount: numeric(14,2) NOT NULL CHECK (amount >= 0)
  - transaction_type: text NOT NULL DEFAULT 'loan_disbursement'
  - created_at: timestamptz NOT NULL DEFAULT now()
- risk_assessments
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - transaction_id: uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE
  - risk_score: numeric(5,4) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1)
  - decision: text NOT NULL CHECK (decision IN ('approve','review','block'))
  - reason: text NOT NULL DEFAULT ''
  - created_at: timestamptz NOT NULL DEFAULT now()
- fraud_alerts
  - id: uuid PRIMARY KEY DEFAULT gen_random_uuid()
  - risk_assessment_id: uuid NOT NULL REFERENCES risk_assessments(id) ON DELETE CASCADE
  - status: text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed'))
  - analyst_note: text NOT NULL DEFAULT ''
  - updated_at: timestamptz NOT NULL DEFAULT now()

## API endpoints

| Endpoint | Description |
| --- | --- |
| POST /fraud/assess | Creates a transaction, scores it against the user’s history, stores the risk assessment, and creates an open fraud alert for review/block decisions. |
| GET /fraud/assessments | Lists recent risk assessments with nested transaction records. |
| GET /fraud/assessments/:id | Fetches a single assessment by id, including its transaction data. |
| GET /alerts | Lists open fraud alerts with their linked assessment and transaction data. |
| GET /alerts/:id | Fetches a single alert by id. |
| PATCH /alerts/:id | Updates an alert status and optional analyst_note. |
| GET /users/:id/risk-history | Returns the assessment history for one user. |

## Scoring algorithm

The scoring function in the Edge Function combines four weighted components into a final score from 0 to 1:

- Amount deviation via z-score: 0.35
- New-device flag: 0.25
- Velocity: 0.25
- Time-of-day anomaly: 0.15

The weights are encoded as `WEIGHTS = { amount: 0.35, device: 0.25, velocity: 0.25, time: 0.15 }`, and the decision thresholds are:

- score < 0.3 => approve
- score 0.3 to 0.7 => review
- score >= 0.7 => block

The amount-deviation path includes cold-start handling: users with fewer than 3 historical transactions get a default high amount score instead of zero, because there is no baseline to trust a large first transaction against. The score is computed from the user’s own historical amounts and timing patterns, not from a static global threshold.

## Why statistical anomaly detection, not a trained ML model

No labeled fraud dataset exists in this time-boxed build to train a supervised classifier, so the system uses per-user statistical baselines instead. The implementation calculates z-scores for transaction amount deviation, checks time-of-day anomalies, flags new devices, and measures short-term velocity; this is a standard bootstrap-style production pattern before enough labeled data exists. The API contract and schema are designed so the scoring function can later be swapped for a trained model such as an isolation forest or autoencoder without changing the dashboard, API, or database shape.

## Explicitly out of scope

Target architecture, not built:

- AWS Bedrock/LLM-generated reasoning (replaced with template-based reason strings, with an optional Groq-based narration layer added as an enhancement)
- vector DB/semantic search
- trained ML model
- real authentication (mocked analyst user)
- high-throughput/full test coverage/encryption (production requirements, not implemented in this build)

## How to run locally

1. Install Node.js (current LTS recommended).
2. In the project root, run `npm install`.
3. Create a `.env` file with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Start the app with `npm run dev`.

The frontend reads the Supabase client configuration from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and the Edge Function API is served through the Supabase project’s functions endpoint.
