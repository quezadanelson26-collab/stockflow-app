'use client';

import { useState, useMemo, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { InventoryItem, StockFilter } from '@/lib/types';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { isValidQuantity, sanitizeText } from '@/lib/validation';
import { formatNumber } from '@/lib/format';
import { LOW_STOCK_THRESHOLD, SEARCH_DEBOUNCE_MS, TOAST_DURATION } from '@/lib/constants';
import { Loading } from '@/components/Loading';

export default function InventoryClient({
  inventory,
  tenantId,
  userId,
}: {
  inventory: InventoryItem[];
  tenantId: string;
  userId: string;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [filter, setFilter] = useState<StockFilter>('all');
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('count_correction');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => {
    const totalSKUs = inventory.length;
    const totalUnits = inventory.reduce((s, i) => s + i.quantity_on_hand, 0);
    const lowStock = inventory.filter(
      (i) => i.quantity_on_hand > 0 && i.quantity_on_hand <= LOW_STOCK_THRESHOLD
    ).length;
    const outOfStock = inventory.filter((i) => i.quantity_on_hand <= 0).length;
    return { totalSKUs, totalUnits, lowStock, outOfStock };
  }, [inventory]);

  const filtered = useMemo(() => {
    let items = [...inventory];
    if (filter === 'in_stock') items = items.filter((i) => i.quantity_on_hand > LOW_STOCK_THRESHOLD);
    if (filter === 'low_stock')
      items = items.filter((i) => i.quantity_on_hand > 0 && i.quantity_on_hand <= LOW_STOCK_THRESHOLD);
    if (filter === 'out_of_stock') items = items.filter((i) => i.quantity_on_hand <= 0);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(
        (i) =>
          i.product_variants.products.title.toLowerCase().includes(q) ||
          i.product_variants.title.toLowerCase().includes(q) ||
          i.product_variants.sku?.toLowerCase().includes(q) ||
          i.product_variants.barcode?.toLowerCase().includes(q) ||
          i.product_variants.products.vendor?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [inventory, filter, debouncedSearch]);

  const handleAdjust = async () => {
    if (!adjusting || !adjustQty) return;
    const newQty = parseInt(adjustQty, 10);

    if (!isValidQuantity(newQty)) {
      setToast('❌ Enter a valid quantity (0 or greater)');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const diff = newQty - adjusting.quantity_on_hand;
    const sanitizedNotes = sanitizeText(adjustNotes);

    const { error: updateErr } = await supabase
      .from('inventory_levels')
      .update({
        quantity_on_hand: newQty,
        quantity_available: newQty - adjusting.quantity_committed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adjusting.id);

    if (updateErr) {
      setToast('❌ Failed to update stock');
      setSaving(false);
      return;
    }

    await supabase.from('inventory_movements').insert({
      tenant_id: tenantId,
      store_id: adjusting.store_id,
      product_variant_id: adjusting.product_variant_id,
      movement_type: 'adjustment',
      quantity: diff,
      reference_type: adjustReason,
      reason: sanitizedNotes || adjustReason.replace(/_/g, ' '),
      performed_by: userId,
      balance_after: newQty,
    });

    setToast(`✅ ${adjusting.product_variants.products.title} — ${adjusting.product_variants.title} updated to ${formatNumber(newQty)}`);
    setAdjusting(null);
    setAdjustQty('');
    setAdjustNotes('');
    setSaving(false);
    router.refresh();
  };

  const getStockBadge = (qty: number) => {
    if (qty <= 0)
      return <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">Out of Stock</span>;
    if (qty <= LOW_STOCK_THRESHOLD)
      return <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Low Stock</span>;
    return <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">In Stock</span>;
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">Stock levels across all product variants</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total SKUs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(stats.totalSKUs)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Units</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(stats.totalUnits)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">Low Stock</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{formatNumber(stats.lowStock)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatNumber(stats.outOfStock)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by product, variant, SKU, or vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([['all', 'All'], ['in_stock', 'In Stock'], ['low_stock', 'Low Stock'], ['out_of_stock', 'Out of Stock']] as [StockFilter, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Variant</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">SKU</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">On Hand</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden sm:table-cell">Committed</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden sm:table-cell">Available</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    {search || filter !== 'all' ? 'No items match your filters' : 'No inventory data yet'}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.product_variants.products.title}</div>
                      <div className="text-xs text-gray-400">{item.product_variants.products.vendor}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{item.product_variants.title}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden md:table-cell">{item.product_variants.sku || '—'}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-900">{formatNumber(item.quantity_on_hand)}</td>
                    <td className="px-4 py-3 text-center text-gray-500 hidden sm:table-cell">{formatNumber(item.quantity_committed)}</td>
                    <td className="px-4 py-3 text-center text-gray-700 hidden sm:table-cell">{formatNumber(item.quantity_available)}</td>
                    <td className="px-4 py-3 text-center">{getStockBadge(item.quantity_on_hand)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => { setAdjusting(item); setAdjustQty(String(item.quantity_on_hand)); }}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline"
                      >
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
          Showing {formatNumber(filtered.length)} of {formatNumber(inventory.length)} items
        </div>
      </div>

      {adjusting && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setAdjusting(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Adjust Stock</h2>
              <p className="text-sm text-gray-500 mb-4">
                {adjusting.product_variants.products.title} — {adjusting.product_variants.title}
              </p>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-3 flex justify-between text-sm">
                  <span className="text-gray-500">Current On Hand</span>
                  <span className="font-bold text-gray-900">{formatNumber(adjusting.quantity_on_hand)}</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Quantity</label>
                  <input type="number" min="0" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" autoFocus />
                  {adjustQty && parseInt(adjustQty, 10) !== adjusting.quantity_on_hand && (
                    <p className="text-xs mt-1 text-gray-500">
                      Change: <span className={parseInt(adjustQty, 10) > adjusting.quantity_on_hand ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {parseInt(adjustQty, 10) - adjusting.quantity_on_hand > 0 ? '+' : ''}{parseInt(adjustQty, 10) - adjusting.quantity_on_hand}
                      </span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
                    <option value="count_correction">Count Correction</option>
                    <option value="damage">Damage / Loss</option>
                    <option value="return">Customer Return</option>
                    <option value="restock">Restock</option>
                    <option value="transfer">Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400">(optional)</span></label>
                  <input type="text" value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="e.g. Found 3 extra in back room"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setAdjusting(null)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                  <button onClick={handleAdjust} disabled={saving || !adjustQty}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save Adjustment'}
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
