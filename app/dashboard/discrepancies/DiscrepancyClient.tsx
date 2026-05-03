'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Flag = {
  id: string;
  flag_type: string;
  severity: string;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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

type StatusFilter = 'all' | 'open' | 'investigating' | 'resolved' | 'dismissed';

export default function DiscrepancyClient({
  flags,
  profiles,
  userId,
  tenantId,
}: {
  flags: Flag[];
  profiles: Profile[];
  userId: string;
  tenantId: string;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [resolving, setResolving] = useState<Flag | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionAction, setResolutionAction] = useState<'resolved' | 'dismissed'>('resolved');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p) => {
      map[p.id] = p.full_name || p.email;
    });
    return map;
  }, [profiles]);

  const stats = useMemo(() => {
    const total = flags.length;
    const open = flags.filter((f) => f.status === 'open').length;
    const investigating = flags.filter((f) => f.status === 'investigating').length;
    const critical = flags.filter((f) => f.severity === 'critical' && f.status !== 'resolved' && f.status !== 'dismissed').length;
    return { total, open, investigating, critical };
  }, [flags]);

  const filtered = useMemo(() => {
    let items = [...flags];
    if (statusFilter !== 'all') {
      items = items.filter((f) => f.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (f) =>
          f.product_variants.products.title.toLowerCase().includes(q) ||
          f.product_variants.title.toLowerCase().includes(q) ||
          f.product_variants.sku?.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q) ||
          f.flag_type?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [flags, statusFilter, search]);

  const handleResolve = async () => {
    if (!resolving) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('discrepancy_flags')
      .update({
        status: resolutionAction,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', resolving.id);

    if (error) {
      setToast('❌ Failed to update flag');
      setSaving(false);
      return;
    }

    setToast(`✅ Flag ${resolutionAction} — ${resolving.product_variants.products.title}`);
    setResolving(null);
    setResolutionNotes('');
    setSaving(false);
    router.refresh();
  };

  const getSeverityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-blue-100 text-blue-700',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[severity] || 'bg-gray-100 text-gray-700'}`}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-red-100 text-red-700',
      investigating: 'bg-yellow-100 text-yellow-700',
      resolved: 'bg-green-100 text-green-700',
      dismissed: 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Discrepancy Flags</h1>
        <p className="text-sm text-gray-500 mt-1">Forensic audit trail — investigate and resolve inventory discrepancies</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Flags</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Open</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.open}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">Investigating</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.investigating}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">🚨 Critical</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{stats.critical}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by product, SKU, description, or flag type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
          {([['all', 'All'], ['open', 'Open'], ['investigating', 'Investigating'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']] as [StatusFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                statusFilter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Type</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Severity</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Description</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    {search || statusFilter !== 'all' ? 'No flags match your filters' : 'No discrepancy flags — looking clean! ✨'}
                  </td>
                </tr>
              ) : (
                filtered.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700">{formatDate(f.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{f.product_variants.products.title}</div>
                      <div className="text-xs text-gray-400">{f.product_variants.title} · {f.product_variants.sku || 'No SKU'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{f.flag_type?.replace(/_/g, ' ') || '—'}</td>
                    <td className="px-4 py-3 text-center">{getSeverityBadge(f.severity)}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(f.status)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell max-w-xs truncate">{f.description || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {f.status === 'open' || f.status === 'investigating' ? (
                        <button
                          onClick={() => setResolving(f)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline"
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {f.resolved_by ? profileMap[f.resolved_by] || 'Unknown' : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          Showing {filtered.length} of {flags.length} flags
        </div>
      </div>

      {resolving && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setResolving(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Resolve Flag</h2>
              <p className="text-sm text-gray-500 mb-4">
                {resolving.product_variants.products.title} — {resolving.product_variants.title}
              </p>
              {resolving.description && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-700">{resolving.description}</div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResolutionAction('resolved')}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        resolutionAction === 'resolved' ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      ✅ Resolve
                    </button>
                    <button
                      onClick={() => setResolutionAction('dismissed')}
                      className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                        resolutionAction === 'dismissed' ? 'bg-gray-100 border-gray-400 text-gray-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      🚫 Dismiss
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes</label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="e.g. Counted and confirmed — was a data entry error"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setResolving(null)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                  <button onClick={handleResolve} disabled={saving}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {saving ? 'Saving...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm z-50">
          {toast}
          <button onClick={() => setToast(null)} className="ml-3 text-gray-400 hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
}
