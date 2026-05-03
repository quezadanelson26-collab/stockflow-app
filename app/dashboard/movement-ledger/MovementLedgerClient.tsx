'use client';

import { useState, useMemo } from 'react';

type Movement = {
  id: string;
  movement_type: string;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  performed_by: string | null;
  balance_after: number | null;
  created_at: string;
  store_id: string;
  product_variant_id: string;
  product_variants: {
    id: string;
    title: string;
    sku: string;
    products: {
      id: string;
      title: string;
      vendor: string;
    };
  };
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
};

type TypeFilter = 'all' | 'receiving' | 'adjustment' | 'sale' | 'return' | 'transfer';

export default function MovementLedgerClient({
  movements,
  profiles,
}: {
  movements: Movement[];
  profiles: Profile[];
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p) => {
      map[p.id] = p.full_name || p.email;
    });
    return map;
  }, [profiles]);

  const stats = useMemo(() => {
    const total = movements.length;
    const received = movements.filter((m) => m.movement_type === 'receiving').length;
    const adjustments = movements.filter((m) => m.movement_type === 'adjustment').length;
    const netChange = movements.reduce((sum, m) => sum + m.quantity, 0);
    return { total, received, adjustments, netChange };
  }, [movements]);

  const filtered = useMemo(() => {
    let items = [...movements];
    if (typeFilter !== 'all') {
      items = items.filter((m) => m.movement_type === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (m) =>
          m.product_variants.products.title.toLowerCase().includes(q) ||
          m.product_variants.title.toLowerCase().includes(q) ||
          m.product_variants.sku?.toLowerCase().includes(q) ||
          m.reason?.toLowerCase().includes(q) ||
          m.reference_type?.toLowerCase().includes(q) ||
          (m.performed_by && profileMap[m.performed_by]?.toLowerCase().includes(q))
      );
    }
    return items;
  }, [movements, typeFilter, search, profileMap]);

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      receiving: 'bg-green-100 text-green-700',
      adjustment: 'bg-blue-100 text-blue-700',
      sale: 'bg-purple-100 text-purple-700',
      return: 'bg-yellow-100 text-yellow-700',
      transfer: 'bg-orange-100 text-orange-700',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[type] || 'bg-gray-100 text-gray-700'}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const getQtyDisplay = (qty: number) => {
    if (qty > 0) return <span className="text-green-600 font-semibold">+{qty}</span>;
    if (qty < 0) return <span className="text-red-600 font-semibold">{qty}</span>;
    return <span className="text-gray-400 font-semibold">0</span>;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Movement Ledger</h1>
        <p className="text-sm text-gray-500 mt-1">Complete audit trail of every stock change</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Movements</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Received</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.received}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Adjustments</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.adjustments}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Net Change</p>
          <p className={`text-2xl font-bold mt-1 ${stats.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.netChange >= 0 ? '+' : ''}{stats.netChange}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by product, SKU, reason, or user..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
          {([['all', 'All'], ['receiving', 'Receiving'], ['adjustment', 'Adjustments'], ['sale', 'Sales'], ['return', 'Returns'], ['transfer', 'Transfers']] as [TypeFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                typeFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Variant</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Type</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Qty</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden sm:table-cell">Balance</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Reason</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    {search || typeFilter !== 'all' ? 'No movements match your filters' : 'No movements recorded yet'}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{formatDate(m.created_at)}</div>
                      <div className="text-xs text-gray-400">{formatTime(m.created_at)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{m.product_variants.products.title}</div>
                      <div className="text-xs text-gray-400 md:hidden">{m.product_variants.title}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 hidden md:table-cell">{m.product_variants.title}</td>
                    <td className="px-4 py-3 text-center">{getTypeBadge(m.movement_type)}</td>
                    <td className="px-4 py-3 text-center">{getQtyDisplay(m.quantity)}</td>
                    <td className="px-4 py-3 text-center text-gray-700 hidden sm:table-cell">{m.balance_after ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {m.reason || m.reference_type?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {m.performed_by ? profileMap[m.performed_by] || 'Unknown' : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          Showing {filtered.length} of {movements.length} movements
        </div>
      </div>
    </div>
  );
}
