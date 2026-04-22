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
  created_at: string;
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  partial: 'bg-yellow-100 text-yellow-700',
  received: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function PurchaseOrdersClient() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const supabase = createClient();

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  async function fetchOrders() {
    setLoading(true);
    let query = supabase
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  }

  return (
    <div className="ml-64 p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-gray-500 text-sm mt-1">Manage vendor orders and track deliveries</p>
        </div>
        <Link
          href="/dashboard/purchase-orders/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Purchase Order
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        {['all', 'draft', 'submitted', 'partial', 'received', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <p className="text-gray-400 text-lg">No purchase orders yet</p>
          <p className="text-gray-400 text-sm mt-1">Create your first PO to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">PO #</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Vendor</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Expected</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/dashboard/purchase-orders/${po.id}`}>
                  <td className="px-6 py-4 font-medium text-blue-600">{po.po_number}</td>
                  <td className="px-6 py-4">{po.vendor}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[po.status] || ''}`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{po.total_items}</td>
                  <td className="px-6 py-4">${Number(po.total_cost).toFixed(2)}</td>
                  <td className="px-6 py-4 text-gray-500">{po.expected_date || '—'}</td>
                  <td className="px-6 py-4 text-gray-500">{new Date(po.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
