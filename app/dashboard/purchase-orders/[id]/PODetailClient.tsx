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
  cancel_date: string | null;
  location: string | null;
  notes: string | null;
  close_notes: string | null;
  closed_at: string | null;
  closed_by: string | null;
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
  added_during_receiving?: boolean;
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
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Receiving state
  const [isReceiving, setIsReceiving] = useState(false);
  const [receivingMode, setReceivingMode] = useState<ReceivingMode>('manual');
  const [receivingQtys, setReceivingQtys] = useState<Record<string, number>>(
    {}
  );
  const [receivingLoading, setReceivingLoading] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  // Close PO state
  const [isClosing, setIsClosing] = useState(false);
  const [closeNote, setCloseNote] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);
  const [droppedItems, setDroppedItems] = useState<Set<string>>(new Set());

  // Add-during-receiving state
  const [addItemPrompt, setAddItemPrompt] = useState<{
    product_name: string;
    variant_name: string;
    sku: string;
    barcode: string;
    cost_price: number;
    product_id: string;
    variant_id: string;
  } | null>(null);

  // History state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [historyData, setHistoryData] = useState<
    Record<string, ReceivingHistoryEntry[]>
  >({});

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
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
      setToast({
        message: `Failed to load purchase order: ${poErr?.message || 'Not found'}`,
        type: 'error',
      });
      setLoading(false);
      return;
    }

    const { data: items, error: itemsErr } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('po_id', id)
      .order('created_at', { ascending: true });

    if (itemsErr) {
      console.error('Failed to load line items:', itemsErr);
    }

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
      .select(
        'id, quantity_received, received_at, receiving_sessions(received_by)'
      )
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

  // ─── Computed Status ──────────────────────────────────────

  const getComputedStatus = (): string => {
    if (!po) return 'draft';
    if (po.status === 'cancelled') return 'cancelled';
    if (po.status === 'closed') return 'closed';
    if (po.status === 'draft') return 'draft';

    const totalOrdered = lineItems.reduce((s, i) => s + i.quantity, 0);
    const totalReceived = lineItems.reduce(
      (s, i) => s + (i.quantity_received || 0),
      0
    );

    if (totalOrdered === 0) return 'submitted';
    if (totalReceived === 0) return 'submitted';
    if (totalReceived >= totalOrdered) return 'received';
    return 'partial';
  };

  const getLineStatus = (item: POLineItem): string => {
    const r = item.quantity_received || 0;
    if (item.line_status === 'dropped') return 'dropped';
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
    closed: { label: 'Closed', cls: 'bg-purple-100 text-purple-700' },
    cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-700' },
  };

  const lineStyleMap: Record<string, { label: string; cls: string }> = {
    not_received: { label: 'Not received', cls: 'bg-gray-100 text-gray-600' },
    partial: { label: 'Partial', cls: 'bg-yellow-100 text-yellow-700' },
    received: { label: 'Received', cls: 'bg-green-100 text-green-700' },
    backorder: { label: 'Backorder', cls: 'bg-orange-100 text-orange-700' },
    dropped: { label: 'Dropped', cls: 'bg-red-100 text-red-600' },
  };

  // ─── PO Actions ───────────────────────────────────────────

  const handleSubmitPO = async () => {
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'submitted', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setToast({
        message: `Failed to submit PO: ${error.message}`,
        type: 'error',
      });
      return;
    }
    setToast({ message: 'Purchase order submitted!', type: 'success' });
    fetchPO();
  };

  const handleCancelPO = async () => {
    if (!confirm('Are you sure you want to cancel this purchase order?'))
      return;
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setToast({
        message: `Failed to cancel PO: ${error.message}`,
        type: 'error',
      });
      return;
    }
    setToast({ message: 'Purchase order cancelled', type: 'success' });
    fetchPO();
  };

  const handleEditPO = async () => {
    // If PO is submitted, revert to draft before editing
    if (computedStatus === 'submitted') {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        setToast({ message: 'Failed to revert PO to draft', type: 'error' });
        return;
      }
    }
    router.push(`/dashboard/purchase-orders/create?edit=${id}`);
  };

  // ─── Receiving Logic ──────────────────────────────────────

  const handleStartReceiving = () => {
    const initial: Record<string, number> = {};
    lineItems.forEach((item) => {
      const remaining = item.quantity - (item.quantity_received || 0);
      if (remaining > 0 && item.line_status !== 'dropped')
        initial[item.id] = 0;
    });
    setReceivingQtys(initial);
    setIsReceiving(true);
    setReceivingMode('manual');
  };

  const handleScanInput = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    // 1. Check if barcode/SKU matches an existing line item on this PO
    const match = lineItems.find(
      (i) =>
        i.sku?.toLowerCase() === trimmed.toLowerCase() ||
        i.barcode?.toLowerCase() === trimmed.toLowerCase()
    );

    if (match) {
      const remaining = match.quantity - (match.quantity_received || 0);
      const current = receivingQtys[match.id] || 0;

      // For items added during receiving, allow unlimited re-scanning
      if (match.added_during_receiving && current >= remaining) {
        setLineItems((prev) =>
          prev.map((i) =>
            i.id === match.id ? { ...i, quantity: i.quantity + 1 } : i
          )
        );
        setReceivingQtys((prev) => ({ ...prev, [match.id]: current + 1 }));
        setToast({
          message: `+1  ${match.product_name} — ${match.variant_name}`,
          type: 'success',
        });
        return;
      }

      if (remaining > 0 && current >= remaining) {
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
      return;
    }

    // 2. Not on PO — look up in product_variants table
    const { data: variantData } = await supabase
      .from('product_variants')
      .select(`
        id,
        product_id,
        sku,
        barcode,
        title,
        option1,
        option2,
        option3,
        cost_price,
        products!inner (
          id,
          title,
          vendor
        )
      `)
      .or(`barcode.eq.${trimmed},sku.eq.${trimmed}`)
      .limit(1);

    if (!variantData || variantData.length === 0) {
      setToast({ message: `Barcode "${trimmed}" not found`, type: 'error' });
      return;
    }

    const found = variantData[0] as any;
    const foundVendor = found.products?.vendor || '';

    // 3. Wrong vendor?
    if (foundVendor.toLowerCase() !== po?.vendor?.toLowerCase()) {
      setToast({
        message: `This item belongs to ${foundVendor}, not ${po?.vendor}`,
        type: 'error',
      });
      return;
    }

    // 4. Same vendor — prompt to add
    const variantName =
      found.title ||
      [found.option1, found.option2, found.option3].filter(Boolean).join(' / ') ||
      'Default';

    setAddItemPrompt({
      product_name: found.products?.title || '',
      variant_name: variantName,
      sku: found.sku || '',
      barcode: found.barcode || '',
      cost_price: found.cost_price || 0,
      product_id: found.product_id,
      variant_id: found.id,
    });
  };

  const handleConfirmAddItem = async () => {
    if (!addItemPrompt) return;

    // Insert new line item into purchase_order_items
    const { data: newItem, error: insertErr } = await supabase
      .from('purchase_order_items')
      .insert({
        po_id: id,
        product_id: addItemPrompt.product_id,
        variant_id: addItemPrompt.variant_id,
        product_name: addItemPrompt.product_name,
        variant_name: addItemPrompt.variant_name,
        sku: addItemPrompt.sku,
        barcode: addItemPrompt.barcode,
        quantity: 1,
        unit_cost: addItemPrompt.cost_price,
        quantity_received: 0,
        backorder_qty: 0,
        line_status: 'not_received',
        added_during_receiving: true,
      })
      .select()
      .single();

    if (insertErr || !newItem) {
      setToast({
        message: `Failed to add item: ${insertErr?.message || 'Unknown error'}`,
        type: 'error',
      });
      setAddItemPrompt(null);
      return;
    }

    // Update PO totals
    await supabase
      .from('purchase_orders')
      .update({
        total_items: (po?.total_items || 0) + 1,
        total_cost: (po?.total_cost || 0) + addItemPrompt.cost_price,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Add the new item to local state and set receiving qty to 1
    setLineItems((prev) => [...prev, newItem as POLineItem]);
    setReceivingQtys((prev) => ({ ...prev, [newItem.id]: 1 }));

    setToast({
      message: `Added ${addItemPrompt.product_name} — ${addItemPrompt.variant_name} to PO`,
      type: 'success',
    });
    setAddItemPrompt(null);
  };

  const handleReceiveAll = () => {
    const all: Record<string, number> = {};
    lineItems.forEach((item) => {
      const remaining = item.quantity - (item.quantity_received || 0);
      if (remaining > 0 && item.line_status !== 'dropped')
        all[item.id] = remaining;
    });
    setReceivingQtys(all);
    setReceivingMode('receive_all');
    setToast({ message: 'All remaining quantities filled', type: 'success' });
  };

  const handleConfirmReceiving = async () => {
    const entries = Object.entries(receivingQtys).filter(([, qty]) => qty > 0);
    if (entries.length === 0) {
      setToast({
        message: 'Enter at least one quantity to receive',
        type: 'error',
      });
      return;
    }

    setReceivingLoading(true);
    const now = new Date().toISOString();

        // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const receivedBy = user?.email || 'Unknown';
    const tenantId = user?.user_metadata?.tenant_id;

    // Look up store_id from PO location
    let storeId: string | null = null;
    if (po?.location) {
      const { data: loc } = await supabase
        .from('locations')
        .select('id')
        .eq('name', po.location)
        .eq('tenant_id', tenantId)
        .single();
      storeId = loc?.id || null;
    }


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
      setToast({
        message: `Failed to create receiving session: ${sessErr?.message || 'Unknown error'}`,
        type: 'error',
      });
      console.error('Receiving session error:', sessErr);
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
      setToast({
        message: `Failed to save receiving records: ${rlErr.message}`,
        type: 'error',
      });
      console.error('Receiving line items error:', rlErr);
      setReceivingLoading(false);
      return;
    }

    // 3 — Update each purchase_order_item with new totals
    let updateErrors: string[] = [];

    for (const [lineItemId, qty] of entries) {
      const item = lineItems.find((li) => li.id === lineItemId);
      if (!item) continue;

      const newReceived = (item.quantity_received || 0) + qty;

      // For items added during receiving, sync the ordered quantity
      // to match what was actually received (since we started at qty=1)
      const effectiveQty = item.added_during_receiving
        ? Math.max(item.quantity, newReceived)
        : item.quantity;
      const newBackorder = Math.max(0, effectiveQty - newReceived);
      const newLineStatus =
        newReceived >= effectiveQty ? 'received' : 'partial';

      const updatePayload: any = {
        quantity_received: newReceived,
        backorder_qty: newBackorder,
        line_status: newLineStatus,
        received_at: now,
        received_by: receivedBy,
      };

      // Persist the updated quantity for added-during-receiving items
      if (item.added_during_receiving) {
        updatePayload.quantity = effectiveQty;
      }

            const { error: updateErr } = await supabase
        .from('purchase_order_items')
        .update(updatePayload)
        .eq('id', lineItemId);

      if (updateErr) {
        console.error(
          `Failed to update line item ${lineItemId}:`,
          updateErr
        );
        updateErrors.push(`${item.product_name}: ${updateErr.message}`);
      }

      // ── Update inventory_levels ──
      if (item.variant_id) {
        const { data: existingLevel } = await supabase
          .from('inventory_levels')
          .select('id, quantity_on_hand, quantity_committed')
          .eq('product_variant_id', item.variant_id)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        const prevQty = existingLevel?.quantity_on_hand || 0;
        const committed = existingLevel?.quantity_committed || 0;
        const newQty = prevQty + qty;

        if (existingLevel) {
          await supabase.from('inventory_levels').update({
            quantity_on_hand: newQty,
            quantity_available: newQty - committed,
            updated_at: now,
          }).eq('id', existingLevel.id);
        } else {
          await supabase.from('inventory_levels').insert({
            tenant_id: tenantId,
            store_id: storeId,
            product_variant_id: item.variant_id,
            quantity_on_hand: qty,
            quantity_committed: 0,
            quantity_available: qty,
          });
        }

        // ── Log inventory movement ──
        await supabase.from('inventory_movements').insert({
          tenant_id: tenantId,
          store_id: storeId,
          product_variant_id: item.variant_id,
          movement_type: 'receiving',
          quantity: qty,
          reference_type: 'purchase_order',
          reference_id: id,
          performed_by: user?.id || null,
          balance_after: existingLevel ? (prevQty + qty) : qty,
          notes: `Received on PO ${po?.po_number}`,
        });
      }

    }

    if (updateErrors.length > 0) {
      setToast({
        message: `Some items failed to update: ${updateErrors.join(', ')}`,
        type: 'error',
      });
      setReceivingLoading(false);
      return;
    }

    // 4 — Recompute & sync PO status
    const { data: updatedItems } = await supabase
      .from('purchase_order_items')
      .select('quantity, quantity_received, line_status')
      .eq('po_id', id);

    if (updatedItems) {
      const activItems = updatedItems.filter(
        (i: any) => i.line_status !== 'dropped'
      );
      const totOrd = activItems.reduce(
        (s: number, i: any) => s + i.quantity,
        0
      );
      const totRec = activItems.reduce(
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
      message: `Received ${totalQty} item${totalQty > 1 ? 's' : ''} successfully`,
      type: 'success',
    });
    fetchPO();
  };

  // ─── Close PO Logic ───────────────────────────────────────

  const handleOpenClose = () => {
    // Pre-select all backorder items
    const backorderIds = new Set<string>();
    lineItems.forEach((item) => {
      const remaining = item.quantity - (item.quantity_received || 0);
      if (remaining > 0 && item.line_status !== 'dropped') {
        backorderIds.add(item.id);
      }
    });
    setDroppedItems(backorderIds);
    setCloseNote('');
    setIsClosing(true);
  };

  const toggleDroppedItem = (itemId: string) => {
    const next = new Set(droppedItems);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    setDroppedItems(next);
  };

  const handleConfirmClose = async () => {
    if (!closeNote.trim()) {
      setToast({
        message: 'Please add a note explaining why the PO is being closed',
        type: 'error',
      });
      return;
    }

    setClosingLoading(true);
    const now = new Date().toISOString();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const closedBy = user?.email || 'Unknown';

    // Mark dropped items
    for (const itemId of Array.from(droppedItems)) {
      const { error } = await supabase
        .from('purchase_order_items')
        .update({
          line_status: 'dropped',
          backorder_qty: 0,
        })
        .eq('id', itemId);

      if (error) {
        console.error(`Failed to drop item ${itemId}:`, error);
      }
    }

    // Update PO status to closed
    const { error: closeErr } = await supabase
      .from('purchase_orders')
      .update({
        status: 'closed',
        close_notes: closeNote.trim(),
        closed_at: now,
        closed_by: closedBy,
        updated_at: now,
      })
      .eq('id', id);

    if (closeErr) {
      setToast({
        message: `Failed to close PO: ${closeErr.message}`,
        type: 'error',
      });
      setClosingLoading(false);
      return;
    }

    setIsClosing(false);
    setClosingLoading(false);
    setToast({ message: 'Purchase order closed', type: 'success' });
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

  // Build summary cards dynamically
  const summaryCards: { label: string; value: string | number }[] = [
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
  ];

  // Add Location card if set
  if (po.location) {
    summaryCards.push({ label: 'Location', value: po.location });
  }

  // Add Cancel Date card if set
  if (po.cancel_date) {
    const cancelDateObj = new Date(po.cancel_date);
    const isPastCancel = cancelDateObj < new Date();
    summaryCards.push({
      label: 'Cancel Date',
      value: isPastCancel
        ? `⚠ ${cancelDateObj.toLocaleDateString()}`
        : cancelDateObj.toLocaleDateString(),
    });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white max-w-md ${
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

      {/* Cancel Date Warning */}
      {po.cancel_date && new Date(po.cancel_date) < new Date() && computedStatus !== 'received' && computedStatus !== 'closed' && computedStatus !== 'cancelled' && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          ⚠ <strong>Past cancel date</strong> — This PO was due by{' '}
          {new Date(po.cancel_date).toLocaleDateString()}. You may reject the shipment if it arrives now.
        </div>
      )}

      {/* Closed PO Info */}
      {computedStatus === 'closed' && po.close_notes && (
        <div className="bg-purple-50 border border-purple-200 text-purple-700 px-4 py-3 rounded-lg mb-6">
          <strong>PO Closed</strong>
          {po.closed_at && (
            <span className="text-sm ml-2">
              on {new Date(po.closed_at).toLocaleDateString()} by {po.closed_by}
            </span>
          )}
          <p className="mt-1 text-sm">{po.close_notes}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        {summaryCards.map((c) => (
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
        {computedStatus === 'submitted' && (
          <>
            <button
              onClick={handleEditPO}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Edit PO
            </button>
            <button
              onClick={handleStartReceiving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Receive Items
            </button>
            <button
              onClick={handleCancelPO}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              Cancel PO
            </button>
          </>
        )}
        {computedStatus === 'partial' && (
          <>
            <button
              onClick={handleStartReceiving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Receive Items
            </button>
            <button
              onClick={handleOpenClose}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
            >
              Close PO
            </button>
          </>
        )}
        {computedStatus === 'received' && (
          <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium">
            ✓ Fully Received
          </span>
        )}
        {computedStatus === 'closed' && (
          <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium">
            Closed
          </span>
        )}
        {computedStatus === 'cancelled' && (
          <span className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium">
            Cancelled
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
                    handleScanInput(
                      (e.target as HTMLInputElement).value
                    );
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
                {lineItems
                  .filter((item) => item.line_status !== 'dropped')
                  .map((item) => {
                    const recv = item.quantity_received || 0;
                    const rem = item.quantity - recv;
                    const done = rem <= 0;
                    return (
                      <tr
                        key={item.id}
                        className={`border-b ${done ? 'opacity-50' : ''}`}
                      >
                        <td className="py-3 pr-4">
                          <div className="font-medium">
                            {item.product_name}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {item.variant_name}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">
                          {item.sku}
                        </td>
                        <td className="py-3 text-center">{item.quantity}</td>
                        <td className="py-3 text-center">{recv}</td>
                        <td className="py-3 text-center">
                          {Math.max(0, rem)}
                        </td>
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
                                    Math.max(
                                      0,
                                      parseInt(e.target.value) || 0
                                    ),
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
      {/* ADD ITEM DURING RECEIVING PROMPT                  */}
      {/* ══════════════════════════════════════════════════ */}
      {addItemPrompt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold mb-1">Item Not on This PO</h2>
            <p className="text-sm text-gray-500 mb-4">
              This item was found but is not listed on this purchase order. Add it?
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="font-medium text-gray-900">{addItemPrompt.product_name}</p>
              <p className="text-sm text-gray-600">{addItemPrompt.variant_name}</p>
              {addItemPrompt.sku && (
                <p className="text-xs text-gray-400 mt-1">SKU: {addItemPrompt.sku}</p>
              )}
              <p className="text-sm font-medium mt-2">
                Cost: ${addItemPrompt.cost_price.toFixed(2)}
              </p>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              This item will be added to the PO and marked as received. It will show an
              &quot;Added during receiving&quot; badge for audit purposes.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setAddItemPrompt(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAddItem}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
              >
                Yes, Add to PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* CLOSE PO MODAL                                    */}
      {/* ══════════════════════════════════════════════════ */}
      {isClosing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-lg font-semibold mb-1">Close Purchase Order</h2>
            <p className="text-sm text-gray-500 mb-4">
              Select which backorder items to drop and add a note explaining why.
            </p>

            {/* Backorder items list */}
            <div className="border rounded-lg divide-y mb-4 max-h-60 overflow-y-auto">
              {lineItems
                .filter((item) => {
                  const remaining =
                    item.quantity - (item.quantity_received || 0);
                  return remaining > 0 && item.line_status !== 'dropped';
                })
                .map((item) => {
                  const remaining =
                    item.quantity - (item.quantity_received || 0);
                  return (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={droppedItems.has(item.id)}
                        onChange={() => toggleDroppedItem(item.id)}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-sm">
                          {item.product_name}
                        </span>
                        <span className="text-gray-500 text-sm ml-1">
                          — {item.variant_name}
                        </span>
                      </div>
                      <span className="text-orange-600 text-sm font-medium">
                        {remaining} remaining
                      </span>
                    </label>
                  );
                })}
            </div>

            {/* Close note */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for closing *
              </label>
              <textarea
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                rows={3}
                placeholder="e.g., Supplier notified they cannot fulfill remaining items..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsClosing(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClose}
                disabled={closingLoading || !closeNote.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {closingLoading ? 'Closing...' : 'Confirm Close PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* LINE ITEMS TABLE                                  */}
      {/* ══════════════════════════════════════════════════ */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Line Items</h2>
          <p className="text-xs text-gray-400 mt-1">
            Click a row to see receiving history
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-center">Ordered</th>
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
                  received > 0
                    ? Math.max(0, item.quantity - received)
                    : 0;
                const actualStatus = getLineStatus(item);

                // Use 'backorder' style when partially received and still has remaining
                const displayStatus =
                  actualStatus === 'partial' && backorder > 0
                    ? 'backorder'
                    : actualStatus;
                const lineStyle =
                  lineStyleMap[displayStatus] || lineStyleMap.not_received;
                const isExpanded = expandedRows.has(item.id);

                return (
                  <Fragment key={item.id}>
                    <tr
                      className={`border-b hover:bg-gray-50 cursor-pointer ${
                        actualStatus === 'dropped' ? 'opacity-50' : ''
                      }`}
                      onClick={() => toggleHistory(item.id)}
                    >
                      <td className="px-4 py-3 font-medium">
                        {item.product_name}
                        {item.added_during_receiving && (
                          <span className="ml-2 text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-medium">
                            Added during receiving
                          </span>
                        )}
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
                        {actualStatus === 'dropped' ? (
                          <span className="text-red-500 text-xs">Dropped</span>
                        ) : backorder > 0 ? (
                          <span className="text-orange-600 font-medium">
                            {backorder}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${lineStyle.cls}`}
                        >
                          {displayStatus === 'backorder'
                            ? `Backorder (${backorder})`
                            : actualStatus === 'partial'
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
