import { createClient } from "@/lib/supabase/server";
export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-slate-900">StockFlow</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">{user?.email}</span>
              <form action="/auth/signout" method="post">
                <button type="submit" className="text-sm text-slate-500 hover:text-slate-700 font-medium">Sign out</button>
              </form>
            </div>
          </div>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-500 mt-1">Welcome back! Here is your inventory overview.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: "Open POs", value: "0", sub: "Purchase orders", color: "blue" },
            { label: "Products", value: "0", sub: "Synced from Shopify", color: "emerald" },
            { label: "Discrepancies", value: "0", sub: "Open flags", color: "amber" },
            { label: "Movements", value: "0", sub: "Ledger entries today", color: "purple" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <span className="text-sm font-medium text-slate-500">{stat.label}</span>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stat.value}</p>
              <p className="text-sm text-slate-400 mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: "New PO", desc: "Create purchase order", bg: "bg-indigo-50", text: "text-indigo-900" },
              { name: "Scan Receive", desc: "Start receiving session", bg: "bg-emerald-50", text: "text-emerald-900" },
              { name: "Cycle Count", desc: "Start inventory count", bg: "bg-amber-50", text: "text-amber-900" },
            ].map((action) => (
              <button key={action.name} className={`${action.bg} rounded-xl px-4 py-3 text-left hover:opacity-80 transition-opacity`}>
                <p className={`text-sm font-semibold ${action.text}`}>{action.name}</p>
                <p className="text-xs text-slate-500">{action.desc}</p>
              </button>
            ))}
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-8">StockFlow v2.0.0 — Logged in as {user?.email}</p>
      </div>
    </div>
  );
}
