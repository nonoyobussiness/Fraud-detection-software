import type { Decision } from "@/lib/types";

interface BadgeProps {
  decision: Decision;
  score?: number;
}

const STYLES: Record<Decision, string> = {
  approve: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  review: "bg-amber-50 text-amber-700 ring-amber-600/20",
  block: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const DOT: Record<Decision, string> = {
  approve: "bg-emerald-500",
  review: "bg-amber-500",
  block: "bg-rose-500",
};

const LABEL: Record<Decision, string> = {
  approve: "Approve",
  review: "Review",
  block: "Block",
};

export default function RiskBadge({ decision, score }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STYLES[decision]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[decision]}`} />
      {LABEL[decision]}
      {score != null && (
        <span className="opacity-70 tabular-nums">{(score * 100).toFixed(0)}%</span>
      )}
    </span>
  );
}
