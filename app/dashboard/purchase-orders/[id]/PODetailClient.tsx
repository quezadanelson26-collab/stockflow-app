'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { updatePOStatus, receiveItems } from '../actions';

interface POItemVariant {
  id: string; sku: string; option1: string; option2: string;
  cost_price: number; price: number;
  products: { id: string; title: string; vendor: string };
}

interface POItem {
  id: string; product_variant_id: string;
  quantity_ordered: number; quantity_received: number; cost_price: number;
  product_variants: POItemVariant;
}

interface PO {
  id: string; po_number: string; vendor: string; destination_store_id: string;
  status: string; order_date: string; expected_date: string; notes: string;
  created_at: string; updated_at: string;
  purchase_order_items: POItem[];
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

export default function PODetailClient({ po, storeName }: { po: PO; storeName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [receivingMode, setReceivingMode] = useState(false);
  const [receivingQtys, setReceivingQtys] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  const totalOrdered = po.purchase_order_items?.reduce((s, i) => s + i.quantity_ordered, 0) || 0;
  const totalReceived = po.purchase_order_items?.reduce((s, i) => s + i.quantity_received, 0) || 0;
  const totalCost = po.purchase_order_items?.reduce((s, i) => s + (i.quantity_ordered * (i.cost_price || 0)), 0) || 0;

  const handleSubmitPO = () => {
    startTransition(async () => {
      const result = await updatePOStatus(po.id, 'submitted');
      if (result.error) setError(result.error);
      else router.refresh();
    });
  };

  const handleReceive = () => {
    const items = po.purchase_order_items
      .filter((i) => (receivingQtys[i.id] || 0) > 0)
      .map((i) => ({
        id: i.id,
        product_variant_id: i.product_variant_id,
        receiving_now: receivingQtys[i.id] || 0,
      }));

    if (items.length === 0) return setError('Enter quantities for at least one item');
    setError('');

    startTransition(async () => {
      const result = await receiveItems(po.id, po.destination_store_id, items);
      if (result.error) setError(result.error);
      else {
        setReceivingMode(false);
        setReceivingQtys({});
        router.refresh();
      }
    });
  };

  const fillRemaining = () => {
    const qtys: Record<string, number> = {};
    po.purchase_order_items.forEach((i) => {
      const remaining = i.quantity_ordered - i.quantity_received;
      if (remaining > 0) qtys[i.id] = remaining;
    });
    setReceivingQtys(qtys);
  };

  const canSubmit = po.status === 'draft';
  const canReceive = po.status === 'submitted' || po.status === 'partially_received';
  const canClose = po.status === 'received' || po.status === 'partially_received';

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/purchase-orders" className="text-sm text-blue-600 hover:underline mb-2 inline-block">← Back to Purchase Orders</Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{po.po_number}</h1>
            <p className="text-gray-500">{po.vendor} → {storeName}</p>
          </div>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium capitalize ${statusBadge(po.status)}`}>
            {statusLabel(po.status)}
          </span>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Ordered</p>
          <p className="text-2xl font-bold text-gray-900">{totalOrdered}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Received</p>
          <p className={`text-2xl font-bold ${totalReceived >= totalOrdered && totalOrdered > 0 ? 'text-green-600' : 'text-gray-900'}`}>{totalReceived}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Remaining</p>
          <p className={`text-2xl font-bold ${totalOrdered - totalReceived > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>{totalOrdered - totalReceived}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Cost</p>
          <p className="text-2xl font-bold text-gray-900">${totalCost.toFixed(2)}</p>
        </div>
      </div>

      {(po.order_date || po.expected_date || po.notes) && (
        <div className="bg-white rounded-lg shadow p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {po.order_date && <div><span className="text-gray-500">Order Date:</span> <span className="font-medium">{po.order_date}</span></div>}
          {po.expected_date && <div><span className="text-gray-500">Expected:</span> <span className="font-medium">{po.expected_date}</span></div>}
          {po.notes && <div className="sm:col-span-3"><span className="text-gray-500">Notes:</span> <span className="font-medium">{po.notes}</span></div>}
        </div>
      )}

      <div className="flex gap-3 mb-4">
        {canSubmit && (
          <button onClick={handleSubmitPO} disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {isPending ? 'Submitting...' : 'Submit PO'}
          </button>
        )}
        {canReceive && !receivingMode && (
          <button onClick={() => setReceivingMode(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            📦 Receive Items
          </button>
        )}
        {canClose && !receivingMode && (
          <button onClick={() => { startTransition(async () => { await updatePOStatus(po.id, 'closed'); router.refresh(); }); }} disabled={isPending}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors">
            Close PO
          </button>
        )}
      </div>

      {receivingMode && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">📦</span>
            <p className="text-sm text-green-800 font-medium">Receiving mode — enter quantities below, then click Confirm.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fillRemaining} className="text-xs px-3 py-1 bg-green-200 hover:bg-green-300 rounded text-green-800 transition-colors">Fill remaining</button>
            <button onClick={() => { setReceivingMode(false); setReceivingQtys({}); }} className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 transition-colors">Cancel</button>
            <button onClick={handleReceive} disabled={isPending}
              className="text-xs px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded font-medium disabled:opacity-50 transition-colors">
              {isPending ? 'Saving...' : 'Confirm Receipt'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Product</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Size</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Color</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">SKU</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Cost</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Ordered</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Received</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Remaining</th>
              {receivingMode && <th className="text-center px-4 py-3 font-semibold text-green-700 bg-green-50">Receiving</th>}
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {po.purchase_order_items?.map((item) => {
              const v = item.product_variants;
              const remaining = item.quantity_ordered - item.quantity_received;
              const isDone = remaining <= 0;
              return (
                <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50 ${isDone ? 'bg-green-50/50' : ''}`}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/products/${v?.products?.id}`} className="text-blue-600 hover:underline font-medium">
                      {v?.products?.title || '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{v?.option1 || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{v?.option2 || '—'}</td>
                  <td className="px-4 py-3 font-mono text-gray-500 text-xs">{v?.sku || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">${(item.cost_price || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center font-mono text-gray-900">{item.quantity_ordered}</td>
                  <td className="px-4 py-3 text-center font-mono">
                    <span className={isDone ? 'text-green-600 font-bold' : 'text-gray-700'}>{item.quantity_received}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">
                    <span className={remaining > 0 ? 'text-yellow-600 font-bold' : 'text-gray-400'}>{remaining}</span>
                  </td>
                  {receivingMode && (
                    <td className="px-4 py-3 text-center bg-green-50">
                      <input type="number" min="0" max={remaining}
                        value={receivingQtys[item.id] || ''}
                        onChange={(e) => setReceivingQtys({ ...receivingQtys, [item.id]: Math.min(parseInt(e.target.value) || 0, remaining) })}
                        placeholder="0" disabled={remaining <= 0}
                        className="w-16 px-2 py-1 border border-green-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400" />
                    </td>
                  )}
                  <td className="px-4 py-3 text-right font-mono text-gray-900">${(item.quantity_ordered * (item.cost_price || 0)).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
