import { useEffect, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { assessTransaction, fetchUsers, fetchDevices } from "@/lib/api";
import type { User, Device, AssessResponse } from "@/lib/types";
import RiskBadge from "./RiskBadge";

export default function NewTransactionPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [userId, setUserId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("loan_disbursement");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const u = await fetchUsers();
        setUsers(u as User[]);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!userId) {
      setDevices([]);
      setDeviceId("");
      return;
    }
    (async () => {
      try {
        const d = await fetchDevices(userId);
        setDevices(d as Device[]);
        setDeviceId((d as Device[])[0]?.id ?? "");
      } catch {
        /* ignore */
      }
    })();
  }, [userId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await assessTransaction({
        user_id: userId,
        device_id: deviceId,
        amount: Number(amount),
        transaction_type: type,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assessment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">Assess a Transaction</h3>
      <p className="mt-1 text-xs text-slate-400">
        Submit a transaction to compute a risk score in real time.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">User</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="">Select user...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Device</label>
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              required
              disabled={!userId}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Select device...</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.device_fingerprint.slice(0, 16)}…
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Transaction Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="loan_disbursement">loan_disbursement</option>
              <option value="repayment">repayment</option>
              <option value="cash_out">cash_out</option>
              <option value="transfer">transfer</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {loading ? "Assessing..." : "Assess"}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <RiskBadge decision={result.assessment.decision} score={result.assessment.risk_score} />
            {result.alert && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Alert created
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-600">{result.assessment.reason}</p>
          <p className="mt-1 text-xs text-slate-400">
            Transaction {result.transaction.id.slice(0, 8)} · ${Number(result.transaction.amount).toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}
