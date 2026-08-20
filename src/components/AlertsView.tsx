import { useEffect, useState, useCallback } from "react";
import { RefreshCw, ShieldAlert, Check, X } from "lucide-react";
import { fetchAlerts, updateAlert } from "@/lib/api";
import type { FraudAlert, User } from "@/lib/types";
import { fetchUsers } from "@/lib/api";
import RiskBadge from "./RiskBadge";

export default function AlertsView() {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, u] = await Promise.all([fetchAlerts(), fetchUsers()]);
      setAlerts(a);
      const map: Record<string, User> = {};
      for (const user of u) map[user.id] = user as User;
      setUsers(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpdate(id: string, status: "reviewed" | "dismissed") {
    setUpdatingId(id);
    try {
      await updateAlert(id, { status, analyst_note: noteFor === id ? noteText : "" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      setNoteFor(null);
      setNoteText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update alert");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-700">
            Open Alerts
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              {alerts.length}
            </span>
          </h2>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && <p className="py-10 text-center text-slate-400">Loading alerts...</p>}

      {!loading && alerts.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <Check className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="mt-3 text-sm font-medium text-slate-600">No open alerts</p>
          <p className="text-xs text-slate-400">All flagged transactions have been resolved.</p>
        </div>
      )}

      <div className="grid gap-4">
        {alerts.map((alert) => {
          const ra = alert.risk_assessments;
          const txn = ra?.transactions;
          const user = txn ? users[txn.user_id] : null;
          return (
            <div
              key={alert.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <RiskBadge decision={ra?.decision ?? "review"} score={ra?.risk_score} />
                    <span className="text-xs text-slate-400">
                      {new Date(alert.updated_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                    <Field label="User" value={user?.name ?? "Unknown"} sub={user?.email} />
                    <Field
                      label="Amount"
                      value={`$${Number(txn?.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    />
                    <Field label="Type" value={txn?.transaction_type ?? "-"} />
                    <Field label="Assessment" value={ra?.id.slice(0, 8) ?? "-"} />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</span>
                      {ra?.llm_reason && (
                        <span className="inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                          AI-generated
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-base font-medium leading-6 text-slate-800">
                      {ra?.llm_reason ?? ra?.reason ?? "No reason provided"}
                    </p>
                  </div>

                  {noteFor === alert.id && (
                    <div>
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add an analyst note (optional)..."
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 gap-2 lg:flex-col">
                  <button
                    onClick={() => {
                      if (noteFor !== alert.id) {
                        setNoteFor(alert.id);
                        setNoteText("");
                      } else {
                        handleUpdate(alert.id, "reviewed");
                      }
                    }}
                    disabled={updatingId === alert.id}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    {noteFor === alert.id ? "Confirm Approve" : "Approve"}
                  </button>
                  <button
                    onClick={() => {
                      if (noteFor !== alert.id) {
                        setNoteFor(alert.id);
                        setNoteText("");
                      } else {
                        handleUpdate(alert.id, "dismissed");
                      }
                    }}
                    disabled={updatingId === alert.id}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    {noteFor === alert.id ? "Confirm Dismiss" : "Dismiss"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-700">{value}</dd>
      {sub && <dd className="text-xs text-slate-400">{sub}</dd>}
    </div>
  );
}
