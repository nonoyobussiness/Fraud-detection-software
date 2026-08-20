import { useState } from "react";
import { ShieldCheck, LayoutList, BellRing, Activity } from "lucide-react";
import TransactionsView from "@/components/TransactionsView";
import AlertsView from "@/components/AlertsView";
import NewTransactionPanel from "@/components/NewTransactionPanel";

type View = "transactions" | "alerts";

export default function App() {
  const [view, setView] = useState<View>("transactions");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight text-slate-800">Fraud Sentinel</h1>
              <p className="text-xs leading-tight text-slate-400">Digital Lending Risk Console</p>
            </div>
          </div>

          <nav className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            <NavButton
              active={view === "transactions"}
              onClick={() => setView("transactions")}
              icon={<LayoutList className="h-4 w-4" />}
              label="Transactions"
            />
            <NavButton
              active={view === "alerts"}
              onClick={() => setView("alerts")}
              icon={<BellRing className="h-4 w-4" />}
              label="Alerts"
            />
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Activity className="h-4 w-4 text-slate-400" />
          <span>
            {view === "transactions"
              ? "All risk assessments across the platform, color-coded by decision."
              : "Open fraud alerts requiring analyst review."}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            {view === "transactions" ? <TransactionsView /> : <AlertsView />}
          </div>
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <NewTransactionPanel />
          </aside>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-4">
        <p className="text-center text-xs text-slate-400">
          Fraud Sentinel · Adaptive risk scoring for digital lending
        </p>
      </footer>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
