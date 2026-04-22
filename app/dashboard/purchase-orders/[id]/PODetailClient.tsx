'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type PurchaseOrder = {
  id: string;
  po_number: string;
  vendor: string;
  status: string;
  total_cost: number;
  total_items: number;
  expected_date: string | null;
  notes: string | null;
  created_at: string;
};

type LineItem = {
  id: string;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_cost: number;
  received_qty: number;
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  partial: 'bg-yellow-100 text-yellow-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusFlow = ['draft', 'submitted', 'partial', 'received'];

export default function PODetailClient({ id }: { id: string }) {
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchPO();
  }, [id]);

  async function fetchPO() {
    setLoading(true);
    const { data: poData } = await supabase.from('purchase_orders').select('*').eq('id', id).single();
    if (poData) setPo(poData);

    const { data: itemsData } = await supabase.from('purchase_order_items').select('*').eq('po_id', id).order('created_at', { ascending: true });
    if (itemsData) setItems(itemsData);
    setLoading(false);
  }

  async function updateStatus(newStatus: string) {
    if (!po) return;
    setUpdating(true);
    const { error } = await supabase.from('purchase_orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', po.id);
    if (!error) setPo({ ...po, status: newStatus });
    setUpdating(false);
  }

  async function cancelPO() {
    if (!po) return;
    if (!confirm('Are you sure you want to cancel this PO?')) return;
    await updateStatus('cancelled');
  }

  if (loading) {
    return <div className="ml-64 p-8"><div className="text-center py-12 text-gray-400">Loading...</div></div>;
  }

  if (!po) {
    return (
      <div className="ml-64 p-8">
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">Purchase order not found</p>
          <Link href="/dashboard/purchase-orders" className="text-blue-600 hover:underline mt-2 inline-block">← Back to Purchase Orders</Link>
        </div>
      </div>
    );
  }

  const nextStatus = statusFlow[statusFlow.indexOf(po.status) + 1];

  return (
    <div className="ml-64 p-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/purchase-orders" className="text-gray-400 hover:text-gray-600 transition-colors">← Back</Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{po.po_number}</h1>
          <p className="text-gray-500 text-sm">{po.vendor}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[po.status] || ''}`}>{po.status}</span>
      </div>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase">Total Items</p>
            <p className="text-lg font-semibold">{po.total_items}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Total Cost</p>
            <p className="text-lg font-semibold">${Number(po.total_cost).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Expected Date</p>
            <p className="text-lg font-semibold">{po.expected_date || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Created</p>
            <p className="text-lg font-semibold">{new Date(po.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {po.notes && (
          <div className="mb-6">
            <p className="text-xs text-gray-500 uppercase mb-1">Notes</p>
            <p className="text-sm text-gray-700">{po.notes}</p>
          </div>
        )}

        {po.status !== 'cancelled' && po.status !== 'received' && (
          <div className="flex gap-3 border-t pt-4">
            {nextStatus && (
              <button onClick={() => updateStatus(nextStatus)} disabled={updating} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {updating ? 'Updating...' : `Mark as ${nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}`}
              </button>
            )}
            <button onClick={cancelPO} disabled={updating} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">Cancel PO</button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b"><h2 className="text-lg font-semibold">Line Items</h2></div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Line Total</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-6 py-4 font-medium">{item.product_name}</td>
                <td className="px-6 py-4 text-gray-500">{item.sku || '—'}</td>
                <td className="px-6 py-4">{item.quantity}</td>
                <td className="px-6 py-4">${Number(item.unit_cost).toFixed(2)}</td>
                <td className="px-6 py-4 font-medium">${(item.quantity * Number(item.unit_cost)).toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className={item.received_qty >= item.quantity ? 'text-green-600' : 'text-gray-500'}>{item.received_qty} / {item.quantity}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
