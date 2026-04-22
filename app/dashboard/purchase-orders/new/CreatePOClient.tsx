'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createPurchaseOrder } from '../actions';

interface Store { id: string; name: string; }
interface Variant { id: string; sku: string; option1: string; option2: string; cost_price: number; }
interface Product { id: string; title: string; vendor: string; product_variants: Variant[]; }

interface LineItem {
  product_variant_id: string;
  productTitle: string;
  sku: string;
  size: string;
  color: string;
  cost_price: number;
  quantity_ordered: number;
}

export default function CreatePOClient({
  stores, products, vendors, defaultStoreId,
}: { stores: Store[]; products: Product[]; vendors: string[]; defaultStoreId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [vendor, setVendor] = useState('');
  const [destinationStoreId, setDestinationStoreId] = useState(defaultStoreId);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [error, setError] = useState('');

  const vendorProducts = products.filter((p) => p.vendor === vendor);

  const addProduct = (productId: string) => {
    const product = vendorProducts.find((p) => p.id === productId);
    if (!product) return;
    const newItems = product.product_variants
      .filter((v) => !lineItems.some((li) => li.product_variant_id === v.id))
      .map((v) => ({
        product_variant_id: v.id,
        productTitle: product.title,
        sku: v.sku,
        size: v.option1 || '—',
        color: v.option2 || '—',
        cost_price: v.cost_price || 0,
        quantity_ordered: 0,
      }));
    setLineItems([...lineItems, ...newItems]);
  };

  const updateQty = (variantId: string, qty: number) => {
    setLineItems(lineItems.map((li) =>
      li.product_variant_id === variantId ? { ...li, quantity_ordered: Math.max(0, qty) } : li
    ));
  };

  const updateCost = (variantId: string, cost: number) => {
    setLineItems(lineItems.map((li) =>
      li.product_variant_id === variantId ? { ...li, cost_price: cost } : li
    ));
  };

  const removeLine = (variantId: string) => {
    setLineItems(lineItems.filter((li) => li.product_variant_id !== variantId));
  };

  const setAllQty = (qty: number) => {
    setLineItems(lineItems.map((li) => ({ ...li, quantity_ordered: qty })));
  };

  const totalUnits = lineItems.reduce((s, li) => s + li.quantity_ordered, 0);
  const totalCost = lineItems.reduce((s, li) => s + (li.quantity_ordered * li.cost_price), 0);

  const handleSubmit = () => {
    if (!vendor) return setError('Select a designer');
    if (lineItems.filter((li) => li.quantity_ordered > 0).length === 0) return setError('Add at least one item with quantity > 0');
    setError('');

    startTransition(async () => {
      const result = await createPurchaseOrder({
        vendor,
        destination_store_id: destinationStoreId,
        order_date: orderDate,
        expected_date: expectedDate,
        notes,
        items: lineItems.map((li) => ({
          product_variant_id: li.product_variant_id,
          quantity_ordered: li.quantity_ordered,
          cost_price: li.cost_price,
        })),
      });
      if (result.error) {
        setError(result.error);
      } else {
        router.push(`/dashboard/purchase-orders/${result.id}`);
      }
    });
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/purchase-orders" className="text-sm text-blue-600 hover:underline mb-2 inline-block">← Back to Purchase Orders</Link>
        <h1 className="text-2xl font-bold text-gray-900">New Purchase Order</h1>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Designer *</label>
            <select value={vendor} onChange={(e) => { setVendor(e.target.value); setLineItems([]); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select designer...</option>
              {vendors.map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Destination</label>
            <select value={destinationStoreId} onChange={(e) => setDestinationStoreId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {stores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Order Date</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Expected Arrival</label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Internal notes..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {vendor && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Add Products</h2>
            <div className="flex gap-2">
              <button onClick={() => setAllQty(1)} className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors">Set all to 1</button>
              <button onClick={() => setAllQty(0)} className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors">Clear all</button>
            </div>
          </div>
          <select onChange={(e) => { addProduct(e.target.value); e.target.value = ''; }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4">
            <option value="">Select a product to add variants...</option>
            {vendorProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.title} ({p.product_variants?.length || 0} variants)</option>
            ))}
          </select>

          {lineItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Product</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Size</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Color</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">SKU</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Cost</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-600">Qty</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Line Total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li) => (
                    <tr key={li.product_variant_id} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-900 font-medium">{li.productTitle}</td>
                      <td className="px-3 py-2 text-gray-600">{li.size}</td>
                      <td className="px-3 py-2 text-gray-600">{li.color}</td>
                      <td className="px-3 py-2 font-mono text-gray-500 text-xs">{li.sku}</td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" step="0.01" min="0" value={li.cost_price}
                          onChange={(e) => updateCost(li.product_variant_id, parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" min="0" value={li.quantity_ordered}
                          onChange={(e) => updateQty(li.product_variant_id, parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-900">${(li.quantity_ordered * li.cost_price).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeLine(li.product_variant_id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={5} className="px-3 py-3 text-right text-gray-700">Totals:</td>
                    <td className="px-3 py-3 text-center font-mono text-gray-900">{totalUnits}</td>
                    <td className="px-3 py-3 text-right font-mono text-gray-900">${totalCost.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Link href="/dashboard/purchase-orders" className="px-6 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
          Cancel
        </Link>
        <button onClick={handleSubmit} disabled={isPending}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {isPending ? 'Creating...' : 'Create Purchase Order'}
        </button>
      </div>
    </div>
  );
}
