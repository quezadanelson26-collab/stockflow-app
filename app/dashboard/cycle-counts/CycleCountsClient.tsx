'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type CycleCountItem = {
  id: string;
  product_variant_id: string;
  expected_quantity: number;
  counted_quantity: number | null;
  variance: number | null;
  counted_by: string | null;
  counted_at: string | null;
  notes: string | null;
  product_variants: {
    id: string;
    title: string;
    sku: string;
    barcode: string | null;
    products: {
      id: string;
      title: string;
      vendor: string;
    };
  };
};

type CycleCount = {
  id: string;
  title: string | null;
  status: string;
  notes: string | null;
  store_id: string;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  cycle_count_items: CycleCountItem[];
};

type InventoryLevel = {
  id: string;
  quantity_on_hand: number;
  store_id: string;
  product_variant_id: string;
  product_variants: {
    id: string;
    title: string;
    sku: string;
    barcode: string | null;
    products: {
      id: string;
      title: string;
      vendor: string;
      status: string;
    };
  };
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string;
};

type StatusFilter = 'all' | 'draft' | 'in_progress' | 'completed' | 'cancelled';
type View = 'list' | 'detail' | 'counting';

export default function CycleCountsClient({
  cycleCounts,
  inventoryLevels,
  profiles,
  userId,
  tenantId,
}: {
  cycleCounts: CycleCount[];
  inventoryLevels: InventoryLevel[];
  profiles: Profile[];
  userId: string;
  tenantId: string;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [view, setView] = useState<View>('list');
  const [selectedCount, setSelectedCount] = useState<CycleCount | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [countedValues, setCountedValues] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const router = useRouter();

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p) => {
      map[p.id] = p.full_name || p.email;
    });
    return map;
  }, [profiles]);

  const stats = useMemo(() => {
    const total = cycleCounts.length;
    const draft = cycleCounts.filter((c) => c.status === 'draft').length;
    const inProgress = cycleCounts.filter((c) => c.status === 'in_progress').length;
    const completed = cycleCounts.filter((c) => c.status === 'completed').length;
    return { total, draft, inProgress, completed };
  }, [cycleCounts]);

  const filtered = useMemo(() => {
    let items = [...cycleCounts];
    if (statusFilter !== 'all') {
      items = items.filter((c) => c.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.notes?.toLowerCase().includes(q) ||
          c.status.toLowerCase().includes(q)
      );
    }
    return items;
  }, [cycleCounts, statusFilter, search]);

  const handleCreateCount = async () => {
    if (!newTitle.trim()) {
      setToast('❌ Please enter a title');
      return;
    }
    setSaving(true);
    const supabase = createClient();

    const storeId = inventoryLevels.length > 0 ? inventoryLevels[0].store_id : null;

    if (!storeId) {
      setToast('❌ No store found — add inventory first');
      setSaving(false);
      return;
    }

    const { data: newCount, error: countErr } = await supabase
      .from('cycle_counts')
      .insert({
        tenant_id: tenantId,
        store_id: storeId,
        title: newTitle.trim(),
        notes: newNotes.trim() || null,
        status: 'in_progress',
        created_by: userId,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (countErr || !newCount) {
      setToast('❌ Failed to create cycle count');
      setSaving(false);
      return;
    }

    const storeInventory = inventoryLevels.filter((il) => il.store_id === storeId);
    const items = storeInventory.map((il) => ({
      cycle_count_id: newCount.id,
      product_variant_id: il.product_variant_id,
      expected_quantity: il.quantity_on_hand,
      counted_quantity: null,
      variance: null,
    }));

    if (items.length > 0) {
      const { error: itemsErr } = await supabase.from('cycle_count_items').insert(items);
      if (itemsErr) {
        setToast('⚠️ Count created but items failed to add');
        setSaving(false);
        router.refresh();
        return;
      }
    }

    setToast(`✅ Cycle count "${newTitle}" started with ${items.length} items`);
    setShowCreate(false);
    setNewTitle('');
    setNewNotes('');
    setSaving(false);
    router.refresh();
  };

  const handleOpenCount = (count: CycleCount) => {
    setSelectedCount(count);
    const values: Record<string, string> = {};
    const notes: Record<string, string> = {};
    count.cycle_count_items.forEach((item) => {
      if (item.counted_quantity !== null) {
        values[item.id] = String(item.counted_quantity);
      }
      if (item.notes) {
        notes[item.id] = item.notes;
      }
    });
    setCountedValues(values);
    setItemNotes(notes);
    setView(count.status === 'in_progress' ? 'counting' : 'detail');
  };

  const handleSaveCounts = async () => {
    if (!selectedCount) return;
    setSaving(true);
    const supabase = createClient();

    for (const item of selectedCount.cycle_count_items) {
      const countedStr = countedValues[item.id];
      if (countedStr === undefined || countedStr === '') continue;
      const counted = parseInt(countedStr, 10);
      if (isNaN(counted) || counted < 0) continue;

      const variance = counted - item.expected_quantity;

      await supabase
        .from('cycle_count_items')
        .update({
          counted_quantity: counted,
          variance: variance,
          counted_by: userId,
          counted_at: new Date().toISOString(),
          notes: itemNotes[item.id] || null,
        })
        .eq('id', item.id);
    }

    setToast('✅ Counts saved');
    setSaving(false);
    router.refresh();
  };

  const handleCompleteCount = async () => {
    if (!selectedCount) return;
    setSaving(true);
    const supabase = createClient();

    await handleSaveCounts();

    await supabase
      .from('cycle_counts')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedCount.id);

    for (const item of selectedCount.cycle_count_items) {
      const countedStr = countedValues[item.id];
      if (countedStr === undefined || countedStr === '') continue;
      const counted = parseInt(countedStr, 10);
      if (isNaN(counted)) continue;
      const variance = counted - item.expected_quantity;

      if (variance !== 0) {
        const severity = Math.abs(variance) >= 10 ? 'critical' : Math.abs(variance) >= 5 ? 'high' : Math.abs(variance) >= 2 ? 'medium' : 'low';

        await supabase.from('discrepancy_flags').insert({
          tenant_id: tenantId,
          store_id: selectedCount.store_id,
          product_variant_id: item.product_variant_id,
          flag_type: 'cycle_count_variance',
          severity: severity,
          reference_type: 'cycle_count',
          reference_id: selectedCount.id,
          description: `Cycle count variance: expected ${item.expected_quantity}, counted ${counted} (${variance > 0 ? '+' : ''}${variance})`,
          status: 'open',
          created_by: userId,
        });

        await supabase.from('inventory_movements').insert({
          tenant_id: tenantId,
          store_id: selectedCount.store_id,
          product_variant_id: item.product_variant_id,
          movement_type: 'adjustment',
          quantity: variance,
          reference_type: 'cycle_count',
          reference_id: selectedCount.id,
          reason: `Cycle count adjustment: ${item.product_variants.products.title} — ${item.product_variants.title}`,
          performed_by: userId,
          balance_after: counted,
        });

        await supabase
          .from('inventory_levels')
          .update({
            quantity_on_hand: counted,
            updated_at: new Date().toISOString(),
            last_counted_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId)
          .eq('store_id', selectedCount.store_id)
          .eq('product_variant_id', item.product_variant_id);
      }
    }

    setToast('✅ Cycle count completed — discrepancies flagged and inventory updated');
    setView('list');
    setSelectedCount(null);
    setSaving(false);
    router.refresh();
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-600',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-600',
    };
    const labels: Record<string, string> = {
      draft: 'Draft',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // ============ COUNTING VIEW ============
  if (view === 'counting' && selectedCount) {
    const items = selectedCount.cycle_count_items;
    const totalItems = items.length;
    const countedItems = items.filter((i) => countedValues[i.id] !== undefined && countedValues[i.id] !== '').length;
    const totalVariance = items.reduce((sum, i) => {
      const cv = countedValues[i.id];
      if (cv === undefined || cv === '') return sum;
      return sum + (parseInt(cv, 10) - i.expected_quantity);
    }, 0);

    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => { setView('list'); setSelectedCount(null); }}
              className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">← Back to Cycle Counts</button>
            <h1 className="text-2xl font-bold text-gray-900">{selectedCount.title || 'Untitled Count'}</h1>
            <p className="text-sm text-gray-500 mt-1">Started {formatDate(selectedCount.created_at)} · {totalItems} items to count</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveCounts} disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Progress'}
            </button>
            <button onClick={handleCompleteCount} disabled={saving || countedItems === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
              Complete Count
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Progress: {countedItems} / {totalItems} items counted</span>
            <span className={`font-semibold ${totalVariance === 0 ? 'text-green-600' : totalVariance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
              Net Variance: {totalVariance > 0 ? '+' : ''}{totalVariance}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${totalItems > 0 ? (countedItems / totalItems) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">SKU</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Expected</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide w-28">Counted</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Variance</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const cv = countedValues[item.id];
                  const counted = cv !== undefined && cv !== '' ? parseInt(cv, 10) : null;
                  const variance = counted !== null ? counted - item.expected_quantity : null;
                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${variance !== null && variance !== 0 ? (variance < 0 ? 'bg-red-50/50' : 'bg-blue-50/50') : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.product_variants.products.title}</div>
                        <div className="text-xs text-gray-400">{item.product_variants.title}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden md:table-cell">{item.product_variants.sku || '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-700 font-semibold">{item.expected_quantity}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={cv || ''}
                          onChange={(e) => setCountedValues({ ...countedValues, [item.id]: e.target.value })}
                          placeholder="—"
                          className="w-20 px-2 py-1 text-center border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mx-auto"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {variance !== null ? (
                          <span className={`font-semibold ${variance === 0 ? 'text-green-600' : variance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {variance === 0 ? '✓' : `${variance > 0 ? '+' : ''}${variance}`}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <input
                          type="text"
                          value={itemNotes[item.id] || ''}
                          onChange={(e) => setItemNotes({ ...itemNotes, [item.id]: e.target.value })}
                          placeholder="Add note..."
                          className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm z-50">
            {toast}
            <button onClick={() => setToast(null)} className="ml-3 text-gray-400 hover:text-white">✕</button>
          </div>
        )}
      </div>
    );
  }

  // ============ DETAIL VIEW ============
  if (view === 'detail' && selectedCount) {
    const items = selectedCount.cycle_count_items;
    const withVariance = items.filter((i) => i.variance !== null && i.variance !== 0);

    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <button onClick={() => { setView('list'); setSelectedCount(null); }}
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block">← Back to Cycle Counts</button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{selectedCount.title || 'Untitled Count'}</h1>
            {getStatusBadge(selectedCount.status)}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {formatDate(selectedCount.created_at)} · {items.length} items · {withVariance.length} discrepancies
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">SKU</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Expected</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Counted</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Variance</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${item.variance !== null && item.variance !== 0 ? (item.variance < 0 ? 'bg-red-50/50' : 'bg-blue-50/50') : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.product_variants.products.title}</div>
                      <div className="text-xs text-gray-400">{item.product_variants.title}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden md:table-cell">{item.product_variants.sku || '—'}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{item.expected_quantity}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-900">{item.counted_quantity ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {item.variance !== null ? (
                        <span className={`font-semibold ${item.variance === 0 ? 'text-green-600' : item.variance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {item.variance === 0 ? '✓' : `${item.variance > 0 ? '+' : ''}${item.variance}`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{item.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ============ LIST VIEW ============
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cycle Counts</h1>
          <p className="text-sm text-gray-500 mt-1">Physical inventory counts — compare expected vs actual stock</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Count
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Counts</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Draft</p>
          <p className="text-2xl font-bold text-gray-500 mt-1">{stats.draft}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">In Progress</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.inProgress}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Completed</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.completed}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by title or notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
          {([['all', 'All'], ['draft', 'Draft'], ['in_progress', 'In Progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled']] as [StatusFilter, string][]).map(([key, label]) => (
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
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Title</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Items</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Created By</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    {search || statusFilter !== 'all'
                      ? 'No counts match your filters'
                      : 'No cycle counts yet — start your first one!'}
                  </td>
                </tr>
              ) : (
                filtered.map((count) => {
                  const discrepancies = count.cycle_count_items.filter((i) => i.variance !== null && i.variance !== 0).length;
                  return (
                    <tr key={count.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{formatDate(count.created_at)}</div>
                        <div className="text-xs text-gray-400">{formatTime(count.created_at)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{count.title || 'Untitled'}</div>
                        {count.notes && <div className="text-xs text-gray-400 truncate max-w-xs">{count.notes}</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-gray-900 font-medium">{count.cycle_count_items.length}</span>
                        {discrepancies > 0 && (
                          <span className="text-xs text-red-500 ml-1">({discrepancies} off)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">{getStatusBadge(count.status)}</td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {count.created_by ? profileMap[count.created_by] || 'Unknown' : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleOpenCount(count)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline"
                        >
                          {count.status === 'in_progress' ? 'Continue' : 'View'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          Showing {filtered.length} of {cycleCounts.length} cycle counts
        </div>
      </div>

      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowCreate(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">New Cycle Count</h2>
              <p className="text-sm text-gray-500 mb-4">
                All {inventoryLevels.length} items in your inventory will be included.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. May 2026 Full Count"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
                  <textarea
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g. Monthly inventory check before restock"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowCreate(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                  <button onClick={handleCreateCount} disabled={saving || !newTitle.trim()}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {saving ? 'Creating...' : 'Start Count'}
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
