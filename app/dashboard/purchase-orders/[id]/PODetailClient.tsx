'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import type { PurchaseOrder, POLineItem } from '@/lib/types/database';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  partial: 'bg-yellow-100 text-yellow-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const lineStatusConfig: Record<string, { label: string; color: string }> = {
  not_received: { label: 'Not received', color: 'bg-gray-100 text-gray-600' },
  partial: { label: 'Partial', color: 'bg-yellow-100 text-yellow-700' },
  received: { label: 'Received', color: 'bg-green-100 text-green-700' },
  backorder: { label: 'Backorder', color: 'bg-orange-100 text-orange-700' },
};

interface ReceivingHistoryEntry {
  quantity_received: number;
  received_at: string;
  received_by: string;
}

export default function PODetailClient({ id }: { id: string }) {
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<POLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [receivingHistory, setReceivingHistory] = useState<
    Record<string, ReceivingHistoryEntry[]>
  >({});
  const supabase = createClient();

  useEffect(() => {
    fetchPO();
  }, [id]);

  async function fetchPO() {
    setLoading(true);

    const { data: poData } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (poData) setPo(poData as PurchaseOrder);

    const { data: itemsData } = await supabase
      .from('purchase_order_items')
      .select('*')
      .eq('po_id', id)
      .order('created_at', { ascending: true });

    if (itemsData) setItems(itemsData as POLineItem[]);

    setLoading(false);
  }

  async function fetchReceivingHistory(lineItemId: string) {
    if (receivingHistory[lineItemId]) {
      setExpandedHistory((prev) => ({
        ...prev,
        [lineItemId]: !prev[lineItemId],
      }));
      return;
    }

    const { data } = await supabase
      .from('receiving_line_items')
      .select(`
        quantity_received,
        received_at,
        receiving_sessions!inner (
          received_by
        )
      `)
      .eq('po_line_item_id', lineItemId)
      .order('received_at', { ascending: true });

    if (data) {
      const history: ReceivingHistoryEntry[] = data.map((r: any) => ({
        quantity_received: r.quantity_received,
        received_at: r.received_at,
        received_by: (r.receiving_sessions as any)?.received_by || 'Unknown',
      }));
      setReceivingHistory((prev) => ({ ...prev, [lineItemId]: history }));
    }

    setExpandedHistory((prev) => ({
      ...prev,
      [lineItemId]: true,
    }));
  }

  async function updateStatus(newStatus: string) {
    if (!po) return;
    setUpdating(true);

    const { error } = await supabase
      .from('purchase_orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', po.id);

    if (!error) {
      setPo({ ...po, status: newStatus as PurchaseOrder['status'] });
    }
    setUpdating(false);
  }

  async function cancelPO() {
    if (!po) return;
    if (!confirm('Are you sure you want to cancel this PO? This cannot be undone.'))
      return;
    await updateStatus('cancelled');
  }

  function formatReceivedDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${date} at ${time}`;
  }

  function getActionButtons() {
    if (!po || po.status === 'cancelled' || po.status === 'received') return null;

    const buttons = [];

    if (po.status === 'draft') {
      buttons.push(
        <button
          key="submit"
          onClick={() => updateStatus('submitted')}
          disabled={updating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {updating ? 'Updating...' : 'Submit PO'}
        </button>
      );
    }

    if (po.status === 'submitted') {
      buttons.push(
        <button
          key="receive"
          onClick={() => updateStatus('partial')}
          disabled={updating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {updating ? 'Updating...' : 'Start Receiving'}
        </button>
      );
    }

    if (po.status === 'partial') {
      buttons.push(
        <button
          key="complete"
          onClick={() => updateStatus('received')}
          disabled={updating}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {updating ? 'Updating...' : 'Mark as Received'}
        </button>
      );
    }

    buttons.push(
      <button
        key="cancel"
        onClick={cancelPO}
        disabled={updating}
        className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        Cancel PO
      </button>
    );

    return buttons;
  }

  if (loading) {
    return (
      <div className="max-w-5xl">
        <div className="text-center py-12 text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="max-w-5xl">
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">Purchase order not found</p>
          <Link
            href="/dashboard/purchase-orders"
            className="text-blue-600 hover:underline mt-2 inline-block"
          >
            &larr; Back to Purchase Orders
          </Link>
        </div>
      </div>
    );
  }

  const totalReceived = items.reduce((sum, item) => sum + (item.quantity_received || 0), 0);
  const totalOrdered = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/purchase-orders"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          &larr; Back
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{po.po_number}</h1>
          <p className="text-gray-500 text-sm">{po.vendor}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${
            statusColors[po.status] || ''
          }`}
        >
          {po.status}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Total Items</p>
            <p className="text-lg font-semibold">{po.total_items}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Total Cost</p>
            <p className="text-lg font-semibold">
              ${Number(po.total_cost).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Expected Date</p>
            <p className="text-lg font-semibold">
              {po.expected_date
                ? new Date(po.expected_date).toLocaleDateString()
                : '\u2014'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Received</p>
            <p className="text-lg font-semibold">
              <span
                className={
                  totalReceived >= totalOrdered
                    ? 'text-green-600'
                    : totalReceived > 0
                    ? 'text-yellow-600'
                    : 'text-gray-400'
                }
              >
                {totalReceived} / {totalOrdered}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Created</p>
            <p className="text-lg font-semibold">
              {new Date(po.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {po.vendor_order_number && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 uppercase mb-1">
              Vendor Order #
            </p>
            <p className="text-sm text-gray-700">{po.vendor_order_number}</p>
          </div>
        )}

        {po.notes && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
            <p className="text-sm text-gray-700">{po.notes}</p>
          </div>
        )}

        {getActionButtons() && (
          <div className="flex gap-3 border-t pt-4">{getActionButtons()}</div>
        )}
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Line Items</h2>
        </div>

        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Product
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Variant
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                SKU
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Qty Ordered
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Received
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Backorder
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Cost
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => {
              const lineTotal = item.quantity * Number(item.unit_cost);
              const status = lineStatusConfig[item.line_status || 'not_received'];
              const hasHistory =
                item.quantity_received > 0 || item.line_status !== 'not_received';
              const isExpanded = expandedHistory[item.id] || false;

              return (
                <tr key={item.id} className="group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-sm">{item.product_name}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {item.variant_name || '\u2014'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {item.sku || '\u2014'}
                  </td>
                  <td className="px-6 py-4 text-sm">{item.quantity}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          item.quantity_received >= item.quantity
                            ? 'text-green-600 font-medium'
                            : item.quantity_received > 0
                            ? 'text-yellow-600 font-medium'
                            : 'text-gray-400'
                        }
                      >
                        {item.quantity_received || 0}
                      </span>
                      {item.received_at && (
                        <span className="text-xs text-gray-400">
                          &mdash; {formatReceivedDate(item.received_at)}
                        </span>
                      )}
                    </div>
                    {hasHistory && (
                      <button
                        onClick={() => fetchReceivingHistory(item.id)}
                        className="text-xs text-blue-500 hover:text-blue-700 mt-1"
                      >
                        {isExpanded ? 'Hide History' : 'View History'}
                      </button>
                    )}
                    {isExpanded && receivingHistory[item.id] && (
                      <div className="mt-2 space-y-1">
                        {receivingHistory[item.id].map((entry, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1"
                          >
                            +{entry.quantity_received} &mdash;{' '}
                            {formatReceivedDate(entry.received_at)} by{' '}
                            {entry.received_by}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {item.quantity_backordered > 0 ? (
                      <span className="text-orange-600 font-medium">
                        {item.quantity_backordered}
                      </span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        status?.color || ''
                      }`}
                    >
                      {status?.label || 'Not received'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    ${Number(item.unit_cost).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    ${lineTotal.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
