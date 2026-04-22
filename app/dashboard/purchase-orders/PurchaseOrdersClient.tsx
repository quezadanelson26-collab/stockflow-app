'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Store { id: string; name: string; }
interface POItem { id: string; quantity_ordered: number; quantity_received: number; cost_price: number; }
interface PO {
  id: string; po_number: string; vendor: string; destination_store_id: string;
  status: string; order_date: string; expected_date: string; notes: string;
  created_at: string; purchase_order_items: POItem[];
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'draft': return 'bg-gray-100 text-gray-700';
    case 'submitted': return 'bg-blue-100 text-blue-700';
    case 'partially_received': return 'bg-yellow-100 text-yellow-700';
    case 'received': return 'bg-green-100 text-green-700';
    case 'closed': return 'bg-purple-100 text-purple-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const statusLabel = (status: string) => status.replace(/_/g, ' ');

export default function PurchaseOrdersClient({ initialPOs, initialStores }: { initialPOs: PO[]; initialStores: Store[] }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');

  const vendors = Array.from(new Set(initialPOs.map((p) => p.vendor).filter(Boolean))).sort() as string[];
  const storeName = (id: string) => initialStores.find((s) => s.id === id)?.name || '—';

  const filtered = initialPOs.filter((po) => {
    return (!statusFilter || po.status === statusFilter) &&
      (!vendorFilter || po.vendor === vendorFilter) &&
      (!storeFilter || po.destination_store_id === storeFilter);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
        <Link href="/dashboard/purchase-orders/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          + New Purchase Order
        </Link>
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="partially_received">Partially Received</option>
          <option value="received">Received</option>
          <option value="closed">Closed</option>
        </select>
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Designers</option>
          {vendors.map((v) => (<option key={v} value={v}>{v}</option>))}
        </select>
        <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Destinations</option>
          {initialStores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </select>
        <span className="self-center text-sm text-gray-500">{filtered.length} of {initialPOs.length} POs</span>
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">PO #</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Designer</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Destination</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Items</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Received</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Cost</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Order Date</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Expected</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((po) => {
              const totalQty = po.purchase_order_items?.reduce((s, i) => s + i.quantity_ordered, 0) || 0;
              const totalReceived = po.purchase_order_items?.reduce((s, i) => s + i.quantity_received, 0) || 0;
              const totalCost = po.purchase_order_items?.reduce((s, i) => s + (i.quantity_ordered * (i.cost_price || 0)), 0) || 0;
              return (
                <tr key={po.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/purchase-orders/${po.id}`} className="text-blue-600 hover:underline font-medium">{po.po_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{po.vendor}</td>
                  <td className="px-4 py-3 text-gray-600">{storeName(po.destination_store_id)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium capitalize ${statusBadge(po.status)}`}>{statusLabel(po.status)}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-gray-700">{totalQty}</td>
                  <td className="px-4 py-3 text-center font-mono text-gray-700">
                    <span className={totalReceived >= totalQty && totalQty > 0 ? 'text-green-600 font-bold' : ''}>{totalReceived}/{totalQty}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">${totalCost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-600">{po.order_date || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{po.expected_date || '—'}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No purchase orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
