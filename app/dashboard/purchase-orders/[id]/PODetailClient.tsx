'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// ─── Local Types ────────────────────────────────────────────

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor: string;
  status: string;
  total_items: number;
  total_cost: number;
  expected_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface POLineItem {
  id: string;
  po_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string;
  sku: string;
  barcode: string | null;
  quantity: number;
  unit_cost: number;
  quantity_received: number;
  received_at: string | null;
  received_by: string | null;
  backorder_qty: number;
  line_status: string;
}

interface ReceivingHistoryEntry {
  id: string;
  quantity_received: number;
  received_at: string;
  received_by: string;
}

type ReceivingMode = 'scan' | 'manual' | 'receive_all';

// ─── Component ──────────────────────────────────────────────

export default function PODetailClient({ id }: { id: string }) {
  const supabase = createClient();
  const router = useRouter();

  // Core state
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Receiving state
  const [isReceiving, setIsReceiving] = useState(false);
  const [receivingMode, setReceivingMode] = useState<ReceivingMode>('manual');
  const [receivingQtys, setReceivingQtys] = useState<Record<string, number>>({});
  const [receivingLoading, setReceivingLoading] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  // History state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [historyData, setHistoryData] = useState<Record<string, ReceivingHistoryEntry[]>>({});

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ─── Data Fetching ────────────────────────────────────────

  const fetchPO = async () => {
    setLoading(true);

    const { data: poData, error: poErr } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (poErr || !poData) {
      setToast({ message: 'Failed to load purchase order', type: 'error' });
      setLoading(false);
      return;
    }

    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('po_id', id)
      .order('created_at', { ascending: true });

    setPO(poData);
    setLineItems(items || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPO();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchHistory = async (lineItemId: string) => {
    const { data } = await supabase
      .from('receiving_line_items')
      .select('id, quantity_received, received_at, receiving_sessions(received_by)')
      .eq('po_line_item_id', lineItemId)
      .order('received_at', { ascending: false });

    if (data) {
      const mapped: ReceivingHistoryEntry[] = data.map((r: any) => ({
        id: r.id,
        quantity_received: r.quantity_received,
        received_at: r.received_at,
        received_by: r.receiving_sessions?.received_by || '—',
      }));
      setHistoryData((prev) => ({ ...prev, [lineItemId]: mapped }));
    }
  };

  // ─── Computed Status (fixes Bug #1 and #2) ────────────────

  const getComputedStatus = (): string => {
    if (!po) return 'draft';
    if (po.status === 'cancelled') return 'cancelled';
    if (po.status === 'draft') return 'draft';

    const totalOrdered = lineItems.reduce((s, i) => s + i.quantity, 0);
    const totalReceived = lineItems.reduce((s, i) => s + (i.quantity_received || 0), 0);

    if (totalOrdered === 0) return 'submitted';
    if (totalReceived === 0) return 'submitted';
    if (totalReceived >= totalOrdered) return 'received';
    return 'partial';
  };

  const getLineStatus = (item: POLineItem): string => {
    const r = item.quantity_received || 0;
    if (r === 0) return 'not_received';
    if (r >= item.quantity) return 'received';
    return 'partial';
  };

  const computedStatus = getComputedStatus();

  // ─── Style Maps ───────────────────────────────────────────

  const statusStyles: Record<string, { label: string; cls: string }> = {
    draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-700' },
    submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700' },
    partial: { label: 'Partial', cls: 'bg-yellow-100 text-yellow-700' },
    received: { label: 'Received', cls: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-700' },
  };

  const lineStyleMap: Record<string, { label: string; cls: string }> = {
    not_received: { label: 'Not received', cls: 'bg-gray-100 text-gray-600' },
    partial: { label: 'Partial', cls: 'bg-yellow-100 text-yellow-700' },
    received: { label: 'Received', cls: 'bg-green-100 text-green-700' },
  };

  // ─── PO Actions ───────────────────────────────────────────

  const handleSubmitPO = async () => {
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'submitted', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setToast({ message: 'Failed to submit PO', type: 'error' });
      return;
    }
    setToast({ message: 'Purchase order submitted!', type: 'success' });
    fetchPO();
  };

  const handleCancelPO = async () => {
    if (!confirm('Are you sure you want to cancel this purchase order?')) return;
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setToast({ message: 'Failed to cancel PO', type: 'error' });
      return;
    }
    setToast({ message: 'Purchase order cancelled', type: 'success' });
    fetchPO();
  };

  const handleEditPO = () => {
    router.push(`/dashboard/purchase-orders/create?edit=${id}`);
  };

  // ─── Receiving Logic ──────────────────────────────────────

  const handleStartReceiving = () => {
    const initial: Record<string, number> = {};
    lineItems.forEach((item) => {
      const remaining = item.quantity - (item.quantity_received || 0);
      if (remaining > 0) initial[item.id] = 0;
    });
    setReceivingQtys(initial);
    setIsReceiving(true);
    setReceivingMode('manual');
  };

  const handleScanInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    // Match against SKU or barcode
    const match = lineItems.find(
      (i) =>
        i.sku?.toLowerCase() === trimmed.toLowerCase() ||
        i.barcode?.toLowerCase() === trimmed.toLowerCase()
    );

    if (!match) {
      setToast({
        message: `"${trimmed}" doesn't match any item in this PO`,
        type: 'error',
      });
      return;
    }

    const remaining = match.quantity - (match.quantity_received || 0);
    const current = receivingQtys[match.id] || 0;

    if (current >= remaining) {
      setToast({
        message: `${match.product_name} (${match.variant_name}) already fully accounted for`,
        type: 'error',
      });
      return;
    }

    setReceivingQtys((prev) => ({ ...prev, [match.id]: current + 1 }));
    setToast({
      message: `+1  ${match.product_name} — ${match.variant_name}`,
      type: 'success',
    });
  };

  const handleReceiveAll = () => {
    const all: Record<string, number> = {};
    lineItems.forEach((item) => {
      const remaining = item.quantity - (item.quantity_received || 0);
      if (remaining > 0) all[item.id] = remaining;
    });
    setReceivingQtys(all);
    setReceivingMode('receive_all');
    setToast({ message: 'All remaining quantities filled', type: 'success' });
  };

  const handleConfirmReceiving = async () => {
    const entries = Object.entries(receivingQtys).filter(([, qty]) => qty > 0);
    if (entries.length === 0) {
      setToast({ message: 'Enter at least one quantity to receive', type: 'error' });
      return;
    }

    setReceivingLoading(true);
    const now = new Date().toISOString();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const receivedBy = user?.email || 'Unknown';

    // 1 — Create receiving session
    const { data: session, error: sessErr } = await supabase
      .from('receiving_sessions')
      .insert({
        po_id: id,
        received_by: receivedBy,
        started_at: now,
        completed_at: now,
      })
      .select()
      .single();

    if (sessErr || !session) {
      setToast({ message: 'Failed to create receiving session', type: 'error' });
      setReceivingLoading(false);
      return;
    }

    // 2 — Insert receiving line items
    const rows = entries.map(([lineItemId, qty]) => ({
      session_id: session.id,
      po_line_item_id: lineItemId,
      quantity_received: qty,
      received_at: now,
    }));

    const { error: rlErr } = await supabase
      .from('receiving_line_items')
      .insert(rows);

    if (rlErr) {
      setToast({ message: 'Failed to save receiving records', type: 'error' });
      setReceivingLoading(false);
      return;
    }

    // 3 — Update each purchase_order_item with new totals
    for (const [lineItemId, qty] of entries) {
      const item = lineItems.find((li) => li.id === lineItemId);
      if (!item) continue;

      const newReceived = (item.quantity_received || 0) + qty;
      const newBackorder = Math.max(0, item.quantity - newReceived);
      const newLineStatus =
        newReceived >= item.quantity ? 'received' : 'partial';

      await supabase
        .from('purchase_order_items')
        .update({
          quantity_received: newReceived,
          backorder_qty: newBackorder,
          line_status: newLineStatus,
          received_at: now,
          received_by: receivedBy,
        })
        .eq('id', lineItemId);
    }

    // 4 — Recompute & sync PO status
    const { data: updatedItems } = await supabase
      .from('purchase_order_items')
      .select('quantity, quantity_received')
      .eq('po_id', id);

    if (updatedItems) {
      const totOrd = updatedItems.reduce(
        (s: number, i: any) => s + i.quantity,
        0
      );
      const totRec = updatedItems.reduce(
        (s: number, i: any) => s + (i.quantity_received || 0),
        0
      );
      const newStatus =
        totRec >= totOrd ? 'received' : totRec > 0 ? 'partial' : 'submitted';

      await supabase
        .from('purchase_orders')
        .update({ status: newStatus, updated_at: now })
        .eq('id', id);
    }

    const totalQty = entries.reduce((s, [, q]) => s + q, 0);
    setIsReceiving(false);
    setReceivingLoading(false);
    setToast({
      message: `Received ${totalQty} item${totalQty > 1 ? 's' : ''}`,
      type: 'success',
    });
    fetchPO();
  };

  // ─── History Toggle ───────────────────────────────────────

  const toggleHistory = (itemId: string) => {
    const next = new Set(expandedRows);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
      if (!historyData[itemId]) fetchHistory(itemId);
    }
    setExpandedRows(next);
  };

  // ─── Render ───────────────────────────────────────────────

  if (loading)
    return (
      <div className="p-8 text-center text-gray-500">Loading…</div>
    );
  if (!po)
    return (
      <div className="p-8 text-center text-red-500">
        Purchase order not found
      </div>
    );

  const totalOrdered = lineItems.reduce((s, i) => s + i.quantity, 0);
  const totalReceived = lineItems.reduce(
    (s, i) => s + (i.quantity_received || 0),
    0
  );
  const sBadge = statusStyles[computedStatus] || statusStyles.draft;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push('/dashboard/purchase-orders')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1"
          >
            ← Back to Purchase Orders
          </button>
          <h1 className="text-2xl font-bold">{po.po_number}</h1>
          <p className="text-gray-500">{po.vendor}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${sBadge.cls}`}
        >
          {sBadge.label}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Items', value: totalOrdered },
          { label: 'Total Cost', value: `$${po.total_cost?.toFixed(2)}` },
          {
            label: 'Expected Date',
            value: po.expected_date
              ? new Date(po.expected_date).toLocaleDateString()
              : '—',
          },
          { label: 'Received', value: `${totalReceived} / ${totalOrdered}` },
          {
            label: 'Created',
            value: new Date(po.created_at).toLocaleDateString(),
          },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className="text-xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Action Buttons ───────────────────────────────── */}
      <div className="flex gap-3 mb-6">
        {computedStatus === 'draft' && (
          <>
            <button
              onClick={handleEditPO}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Edit PO
            </button>
            <button
              onClick={handleSubmitPO}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Submit PO
            </button>
            <button
              onClick={handleCancelPO}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              Cancel PO
            </button>
          </>
        )}
        {(computedStatus === 'submitted' || computedStatus === 'partial') && (
          <>
            <button
              onClick={handleStartReceiving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Receive Items
            </button>
            {computedStatus === 'submitted' && (
              <button
                onClick={handleCancelPO}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              >
                Cancel PO
              </button>
            )}
          </>
        )}
        {computedStatus === 'received' && (
          <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium">
            ✓ Fully Received
          </span>
        )}
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* RECEIVING PANEL                                   */}
      {/* ══════════════════════════════════════════════════ */}
      {isReceiving && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Receive Items</h2>
            <button
              onClick={() => setIsReceiving(false)}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2 mb-4">
            {(
              [
                { key: 'scan' as ReceivingMode, label: 'Scan / SKU' },
                { key: 'manual' as ReceivingMode, label: 'Manual' },
                { key: 'receive_all' as ReceivingMode, label: 'Receive All' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setReceivingMode(tab.key);
                  if (tab.key === 'receive_all') handleReceiveAll();
                  if (tab.key === 'scan')
                    setTimeout(() => scanRef.current?.focus(), 100);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  receivingMode === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scan Input */}
          {receivingMode === 'scan' && (
            <div className="mb-4">
              <input
                ref={scanRef}
                type="text"
                placeholder="Scan barcode or type SKU then press Enter..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleScanInput((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
            </div>
          )}

          {/* Receiving Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Product</th>
                  <th className="pb-2 pr-4">SKU</th>
                  <th className="pb-2 text-center">Ordered</th>
                  <th className="pb-2 text-center">Already Recv</th>
                  <th className="pb-2 text-center">Remaining</th>
                  <th className="pb-2 text-center">Receiving Now</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => {
                  const recv = item.quantity_received || 0;
                  const rem = item.quantity - recv;
                  const done = rem <= 0;
                  return (
                    <tr
                      key={item.id}
                      className={`border-b ${done ? 'opacity-50' : ''}`}
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium">{item.product_name}</div>
                        <div className="text-gray-500 text-xs">
                          {item.variant_name}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{item.sku}</td>
                      <td className="py-3 text-center">{item.quantity}</td>
                      <td className="py-3 text-center">{recv}</td>
                      <td className="py-3 text-center">{Math.max(0, rem)}</td>
                      <td className="py-3 text-center">
                        {done ? (
                          <span className="text-green-600 text-xs font-medium">
                            Done
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() =>
                                setReceivingQtys((prev) => ({
                                  ...prev,
                                  [item.id]: Math.max(
                                    0,
                                    (prev[item.id] || 0) - 1
                                  ),
                                }))
                              }
                              className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 text-lg leading-none"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max={rem}
                              value={receivingQtys[item.id] || 0}
                              onChange={(e) => {
                                const val = Math.min(
                                  Math.max(0, parseInt(e.target.value) || 0),
                                  rem
                                );
                                setReceivingQtys((prev) => ({
                                  ...prev,
                                  [item.id]: val,
                                }));
                              }}
                              className="w-14 text-center border rounded py-1"
                            />
                            <button
                              onClick={() =>
                                setReceivingQtys((prev) => ({
                                  ...prev,
                                  [item.id]: Math.min(
                                    rem,
                                    (prev[item.id] || 0) + 1
                                  ),
                                }))
                              }
                              className="w-7 h-7 rounded bg-gray-200 hover:bg-gray-300 text-lg leading-none"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Confirm / Cancel */}
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => setIsReceiving(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmReceiving}
              disabled={
                receivingLoading ||
                Object.values(receivingQtys).every((q) => q === 0)
              }
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {receivingLoading ? 'Saving...' : 'Confirm Receiving'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* LINE ITEMS TABLE                                  */}
      {/* ══════════════════════════════════════════════════ */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-center">Qty Ordered</th>
                <th className="px-4 py-3 text-center">Received</th>
                <th className="px-4 py-3 text-center">Backorder</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => {
                const received = item.quantity_received || 0;
                const backorder =
                  received > 0 ? Math.max(0, item.quantity - received) : 0;
                const actualStatus = getLineStatus(item);
                const lineStyle =
                  lineStyleMap[actualStatus] || lineStyleMap.not_received;
                const isExpanded = expandedRows.has(item.id);

                return (
                  <Fragment key={item.id}>
                    <tr
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleHistory(item.id)}
                    >
                      <td className="px-4 py-3 font-medium">
                        {item.product_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {item.variant_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.sku}</td>
                      <td className="px-4 py-3 text-center">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-center">{received}</td>
                      <td className="px-4 py-3 text-center">
                        {backorder > 0 ? backorder : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${lineStyle.cls}`}
                        >
                          {actualStatus === 'partial'
                            ? `${received}/${item.quantity}`
                            : lineStyle.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        ${item.unit_cost?.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        ${(item.quantity * item.unit_cost).toFixed(2)}
                      </td>
                    </tr>

                    {/* Expanded Receiving History */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className="px-8 py-3 bg-gray-50">
                          <div className="text-xs font-medium text-gray-500 mb-2">
                            Receiving History
                          </div>
                          {historyData[item.id]?.length ? (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-400">
                                  <th className="text-left pb-1">
                                    Date &amp; Time
                                  </th>
                                  <th className="text-center pb-1">Qty</th>
                                  <th className="text-left pb-1">
                                    Received By
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {historyData[item.id].map((h) => (
                                  <tr key={h.id}>
                                    <td className="py-1">
                                      {new Date(
                                        h.received_at
                                      ).toLocaleString()}
                                    </td>
                                    <td className="py-1 text-center">
                                      {h.quantity_received}
                                    </td>
                                    <td className="py-1">{h.received_by}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-gray-400 italic">
                              No receiving history yet
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      {po.notes && (
        <div className="mt-6 bg-white rounded-lg border p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
          <p className="text-gray-700">{po.notes}</p>
        </div>
      )}
    </div>
  );
}
