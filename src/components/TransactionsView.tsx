import { useEffect, useState, useCallback } from "react";
import { Search, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, Ban } from "lucide-react";
import { fetchAssessments, fetchUsers } from "@/lib/api";
import type { RiskAssessment, Transaction, User } from "@/lib/types";
import RiskBadge from "./RiskBadge";

interface Stats {
  total: number;
  approve: number;
  review: number;
  block: number;
}

export default function TransactionsView() {
  const [assessments, setAssessments] = useState<(RiskAssessment & { transactions?: Transaction })[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "approve" | "review" | "block">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, u] = await Promise.all([fetchAssessments(), fetchUsers()]);
      setAssessments(a);
      const map: Record<string, User> = {};
      for (const user of u) map[user.id] = user as User;
      setUsers(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assessments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats: Stats = assessments.reduce(
    (acc, a) => {
      acc.total += 1;
      acc[a.decision] += 1;
      return acc;
    },
    { total: 0, approve: 0, review: 0, block: 0 }
  );

  const todayStats = assessments.reduce(
    (acc, a) => {
      const created = new Date(a.created_at);
      const now = new Date();
      const sameDay =
        created.getFullYear() === now.getFullYear() &&
        created.getMonth() === now.getMonth() &&
        created.getDate() === now.getDate();

      if (sameDay) {
        acc[a.decision] += 1;
      }

      return acc;
    },
    { approve: 0, review: 0, block: 0 }
  );

  const filtered = assessments.filter((a) => {
    if (filter !== "all" && a.decision !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const user = a.transactions ? users[a.transactions.user_id] : null;
    return (
      a.id.toLowerCase().includes(q) ||
      a.reason.toLowerCase().includes(q) ||
      (user?.name?.toLowerCase().includes(q) ?? false) ||
      (user?.email?.toLowerCase().includes(q) ?? false) ||
      (a.transactions?.transaction_type?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Approved today"
          value={todayStats.approve}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Review today"
          value={todayStats.review}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Blocked today"
          value={todayStats.block}
          icon={<Ban className="h-5 w-5" />}
          tone="rose"
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Assessments" value={stats.total} icon={<TrendingUp className="h-5 w-5" />} tone="slate" />
        <StatCard label="Approved" value={stats.approve} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <StatCard label="In Review" value={stats.review} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
        <StatCard label="Blocked" value={stats.block} icon={<Ban className="h-5 w-5" />} tone="rose" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, reason, type..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder-slate-400 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            {(["all", "approve", "review", "block"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                  filter === f ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {f}
              </button>
            ))}
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
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Loading assessments...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No assessments found.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((a) => {
                  const txn = a.transactions;
                  const user = txn ? users[txn.user_id] : null;
                  return (
                    <tr key={a.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {user?.name ?? "Unknown user"}
                        </div>
                        <div className="text-xs text-slate-400">{user?.email ?? txn?.user_id.slice(0, 8)}</div>
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums text-slate-700">
                        ${Number(txn?.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {txn?.transaction_type ?? "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RiskBadge decision={a.decision} score={a.risk_score} />
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="text-xs leading-relaxed text-slate-500">
                          {a.llm_reason ?? a.reason}
                        </span>
                        {a.llm_reason && (
                          <span className="ml-1.5 inline-block rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-500">
                            AI-generated
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "slate" | "emerald" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-50 text-slate-600 ring-slate-200",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-200",
    amber: "bg-amber-50 text-amber-600 ring-amber-200",
    rose: "bg-rose-50 text-rose-600 ring-rose-200",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset ${tones[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-800">{value}</p>
    </div>
  );
}
