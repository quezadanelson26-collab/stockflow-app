'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type LineItem = {
  product_name: string;
  sku: string;
  quantity: number;
  unit_cost: number;
};

export default function CreatePOClient() {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { product_name: '', sku: '', quantity: 1, unit_cost: 0 },
  ]);

  function addItem() {
    setItems([...items, { product_name: '', sku: '', quantity: 1, unit_cost: 0 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  const totalCost = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  async function handleSubmit(status: 'draft' | 'submitted') {
    if (!vendor.trim()) {
      setError('Vendor name is required');
      return;
    }
    if (items.some((item) => !item.product_name.trim())) {
      setError('All items must have a product name');
      return;
    }

    setSaving(true);
    setError('');

    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;

    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        vendor: vendor.trim(),
        status,
        notes: notes.trim() || null,
        expected_date: expectedDate || null,
        total_cost: totalCost,
        total_items: totalItems,
      })
      .select()
      .single();

    if (poError || !po) {
      setError(poError?.message || 'Failed to create purchase order');
      setSaving(false);
      return;
    }

    const lineItems = items.map((item) => ({
      po_id: po.id,
      product_name: item.product_name.trim(),
      sku: item.sku.trim() || null,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
    }));

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(lineItems);

    if (itemsError) {
      setError(itemsError.message);
      setSaving(false);
      return;
    }

    router.push('/dashboard/purchase-orders');
  }

  return (
    <div className="ml-64 p-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/purchase-orders" className="text-gray-400 hover:text-gray-600 transition-colors">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">New Purchase Order</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>
      )}

      <div className="bg-white rounded-xl border p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
            <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. Rag & Bone" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Date</label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">Line Items</h2>
            <button onClick={addItem} className="text-blue-600 hover:text-blue-700 text-sm font-medium">+ Add Item</button>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  {index === 0 && <label className="block text-xs text-gray-500 mb-1">Product Name *</label>}
                  <input type="text" value={item.product_name} onChange={(e) => updateItem(index, 'product_name', e.target.value)} placeholder="Product name" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  {index === 0 && <label className="block text-xs text-gray-500 mb-1">SKU</label>}
                  <input type="text" value={item.sku} onChange={(e) => updateItem(index, 'sku', e.target.value)} placeholder="SKU" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  {index === 0 && <label className="block text-xs text-gray-500 mb-1">Qty</label>}
                  <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  {index === 0 && <label className="block text-xs text-gray-500 mb-1">Unit Cost</label>}
                  <input type="number" min="0" step="0.01" value={item.unit_cost} onChange={(e) => updateItem(index, 'unit_cost', parseFloat(e.target.value) || 0)} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-1 text-right text-sm font-medium text-gray-600 py-2">${(item.quantity * item.unit_cost).toFixed(2)}</div>
                <div className="col-span-1">
                  {items.length > 1 && (
                    <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 text-sm py-2 px-2">✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{totalItems}</span> items · <span className="font-semibold text-lg text-gray-900">${totalCost.toFixed(2)}</span> total
          </div>
          <div className="flex gap-3">
            <button onClick={() => handleSubmit('draft')} disabled={saving} className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">Save as Draft</button>
            <button onClick={() => handleSubmit('submitted')} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">{saving ? 'Creating...' : 'Submit PO'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
