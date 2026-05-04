'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import type { PurchaseOrder } from '@/lib/types/database';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';
import { Loading } from '@/components/Loading';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-700',
  partial: 'bg-yellow-100 text-yellow-700',
  received: 'bg-green-100 text-green-700',
  closed: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-red-100 text-red-700',
};

const filterTabs = [
  { key: 'draft', label: 'Draft', statuses: ['draft'] },
  { key: 'active', label: 'Active', statuses: ['submitted', 'partial'] },
  { key: 'completed', label: 'Completed', statuses: ['received', 'closed'] },
  { key: 'all', label: 'All', statuses: [] },
];

export default function PurchaseOrdersClient() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);
  const supabase = createClient();

  useEffect(() => {
    fetchOrders();
  }, [activeTab]);

  async function fetchOrders() {
    setLoading(true);

    const tab = filterTabs.find((t) => t.key === activeTab);
    let query = supabase
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (tab && tab.statuses.length > 0) {
      query = query.in('status', tab.statuses);
    }

    const { data, error } = await query;

    if (!error && data) {
      setOrders(data as PurchaseOrder[]);
    }
    setLoading(false);
  }

  // Filter by vendor search (now debounced)
  const filteredOrders = orders.filter((po) => {
    if (!debouncedSearch.trim()) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      po.vendor.toLowerCase().includes(q) ||
      po.po_number.toLowerCase().includes(q)
    );
  });

  // Count badges per tab
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchCounts() {
      const { data } = await supabase
        .from('purchase_orders')
        .select('status');
      if (data) {
        const counts: Record<string, number> = {};
        for (const tab of filterTabs) {
          if (tab.statuses.length === 0) {
            counts[tab.key] = data.length;
          } else {
            counts[tab.key] = data.filter((po: any) =>
              tab.statuses.includes(po.status)
            ).length;
          }
        }
        setTabCounts(counts);
      }
    }
    fetchCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage vendor orders and track deliveries
          </p>
        </div>
        <Link
          href="/dashboard/purchase-orders/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          + New Purchase Order
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tabCounts[tab.key] !== undefined && tabCounts[tab.key] > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {tabCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by vendor name or PO number..."
          className="w-full max-w-md border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <Loading message="Loading purchase orders..." />
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <p className="text-gray-400 text-lg">
            {searchQuery ? 'No matching purchase orders' : 'No purchase orders yet'}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {searchQuery
              ? 'Try a different search term'
              : 'Create your first PO to get started'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  PO #
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Vendor
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Items
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Expected
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Location
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrders.map((po) => (
                <tr
                  key={po.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() =>
                    (window.location.href = `/dashboard/purchase-orders/${po.id}`)
                  }
                >
                  <td className="px-6 py-4 font-medium text-blue-600">
                    {po.po_number}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {po.vendor}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                        statusColors[po.status] || ''
                      }`}
                    >
                      {po.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{formatNumber(po.total_items)}</td>
                  <td className="px-6 py-4 font-medium">
                    {formatCurrency(Number(po.total_cost))}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatDate(po.expected_date)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {(po as any).location || '—'}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {formatDate(po.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
