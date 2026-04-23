'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import VendorAutocomplete from './VendorAutocomplete';
import ProductPicker from './ProductPicker';
import SubmitConfirmModal from './SubmitConfirmModal';
import type { POLineItemForm } from '@/lib/types/database';

export default function CreatePOClient() {
  const router = useRouter();
  const supabase = createClient();

  // Form state
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [vendorOrderNumber, setVendorOrderNumber] = useState('');
  const [items, setItems] = useState<POLineItemForm[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [duplicatePOWarning, setDuplicatePOWarning] = useState('');

  // Vendor is locked once items are added
  const vendorLocked = items.length > 0;

  // Totals
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalCost = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  const hasZeroCost = items.some((item) => item.unit_cost === 0);

  // Check for duplicate open POs when vendor changes
  useEffect(() => {
    if (!vendor) {
      setDuplicatePOWarning('');
      return;
    }
    async function checkDuplicatePO() {
      const { data } = await supabase
        .from('purchase_orders')
        .select('po_number')
        .eq('vendor', vendor)
        .in('status', ['draft', 'submitted'])
        .limit(1);

      if (data && data.length > 0) {
        setDuplicatePOWarning(
          `You already have ${data[0].po_number} open for ${vendor}. Continue anyway?`
        );
      } else {
        setDuplicatePOWarning('');
      }
    }
    checkDuplicatePO();
  }, [vendor]);

  // Handle product selection from picker
  function handleProductSelect(newItem: POLineItemForm) {
    setError('');

    // DUPLICATE SCAN = INCREMENT QUANTITY (not a new row)
    const existingIndex = items.findIndex(
      (item) => item.variant_id === newItem.variant_id
    );

    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + 1,
      };
      setItems(updated);
    } else {
      setItems([...items, newItem]);
    }
  }

  // Update line item field
  function updateItem(
    index: number,
    field: keyof POLineItemForm,
    value: string | number | boolean
  ) {
    const updated = [...items];
    if (field === 'unit_cost') {
      const numVal = typeof value === 'string' ? parseFloat(value) || 0 : value;
      updated[index] = {
        ...updated[index],
        unit_cost: numVal as number,
        cost_modified: numVal !== updated[index].shopify_cost,
      };
    } else if (field === 'quantity') {
      const numVal = typeof value === 'string' ? parseInt(value) || 1 : value;
      updated[index] = {
        ...updated[index],
        quantity: Math.max(1, numVal as number),
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setItems(updated);
  }

  // Remove line item
  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  // Quantity quick controls
  function incrementQty(index: number) {
    updateItem(index, 'quantity', items[index].quantity + 1);
  }

  function decrementQty(index: number) {
    if (items[index].quantity > 1) {
      updateItem(index, 'quantity', items[index].quantity - 1);
    }
  }

  // Submit PO
  async function handleSubmit(status: 'draft' | 'submitted') {
    if (!vendor.trim()) {
      setError('Please select a vendor first');
      return;
    }

    // Empty PO prevention
    if (items.length === 0) {
      setError('Please add at least one product to the PO');
      return;
    }

    // If submitting (not draft), show confirmation modal
    if (status === 'submitted' && !confirmOpen) {
      setConfirmOpen(true);
      return;
    }

    setSaving(true);
    setError('');
    setConfirmOpen(false);

    try {
      // Generate PO number via database function
      const { data: poNumData, error: poNumError } = await supabase.rpc(
        'generate_po_number'
      );

      const poNumber = poNumError ? `PO-${Date.now().toString(36).toUpperCase()}` : poNumData;

      // Insert PO
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          vendor: vendor.trim(),
          status,
          notes: notes.trim() || null,
          expected_date: expectedDate || null,
          vendor_order_number: vendorOrderNumber.trim() || null,
          total_cost: totalCost,
          total_items: totalUnits,
        })
        .select()
        .single();

      if (poError || !po) {
        setError(poError?.message || 'Failed to create purchase order');
        setSaving(false);
        return;
      }

      // Insert line items
      const lineItems = items.map((item) => ({
        po_id: po.id,
        product_id: item.product_id || null,
        variant_id: item.variant_id || null,
        product_name: item.product_name.trim(),
        variant_name: item.variant_name || null,
        sku: item.sku || null,
        barcode: item.barcode || null,
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
    } catch (err) {
      setError('An unexpected error occurred');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/purchase-orders"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">New Purchase Order</h1>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
          <span>⚠</span>
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Duplicate PO Warning */}
      {duplicatePOWarning && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg mb-6">
          ⚠ {duplicatePOWarning}
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white rounded-xl border p-6 space-y-6">
        {/* Vendor + Expected Date + Vendor Order # */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor *
            </label>
            <VendorAutocomplete
              value={vendor}
              onChange={setVendor}
              locked={vendorLocked}
            />
            {vendorLocked && (
              <p className="text-xs text-gray-400 mt-1">
                Remove all items to change vendor
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expected Date
            </label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor Order #
            </label>
            <input
              type="text"
              value={vendorOrderNumber}
              onChange={(e) => setVendorOrderNumber(e.target.value)}
              placeholder="Optional reference..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional notes..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Line Items Section */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">Line Items</h2>
            <button
              onClick={() => {
                if (!vendor) {
                  setError('Please select a vendor first');
                  return;
                }
                setPickerOpen(true);
              }}
              disabled={!vendor}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              + Add Item
            </button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <p className="text-gray-400">No items added yet</p>
              <p className="text-gray-400 text-sm mt-1">
                {vendor
                  ? 'Click "Add Item" or scan a barcode to add products'
                  : 'Select a vendor first, then add products'}
              </p>
            </div>
          ) : (
            <>
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-2 pb-2 text-xs font-medium text-gray-500 uppercase">
                <div className="col-span-3">Product</div>
                <div className="col-span-2">Variant</div>
                <div className="col-span-1">SKU</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2">Unit Cost</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1"></div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={`${item.variant_id}-${index}`}
                    className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg px-2 py-2"
                  >
                    {/* Product Name */}
                    <div className="col-span-3 text-sm font-medium text-gray-900 truncate">
                      {item.product_name}
                    </div>

                    {/* Variant */}
                    <div className="col-span-2 text-sm text-gray-600 truncate">
                      {item.variant_name}
                    </div>

                    {/* SKU */}
                    <div className="col-span-1 text-xs text-gray-400 truncate">
                      {item.sku || '—'}
                    </div>

                    {/* Qty with +/- buttons */}
                    <div className="col-span-2 flex items-center justify-center gap-1">
                      <button
                        onClick={() => decrementQty(index)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-white border text-gray-500 hover:bg-gray-100 text-sm"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, 'quantity', e.target.value)
                        }
                        className="w-14 text-center border rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => incrementQty(index)}
                        className="w-7 h-7 flex items-center justify-center rounded bg-white border text-gray-500 hover:bg-gray-100 text-sm"
                      >
                        +
                      </button>
                    </div>

                    {/* Unit Cost */}
                    <div className="col-span-2 relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_cost}
                        onChange={(e) =>
                          updateItem(index, 'unit_cost', e.target.value)
                        }
                        className={`w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          item.unit_cost === 0
                            ? 'border-yellow-400 bg-yellow-50'
                            : ''
                        }`}
                      />
                      {item.cost_modified && (
                        <span
                          className="absolute -top-1 -right-1 text-xs"
                          title="Cost modified from Shopify value"
                        >
                          ✏️
                        </span>
                      )}
                      {item.unit_cost === 0 && (
                        <p className="text-xs text-yellow-600 mt-0.5">
                          Cost missing
                        </p>
                      )}
                    </div>

                    {/* Line Total */}
                    <div className="col-span-1 text-right text-sm font-medium text-gray-700">
                      ${(item.quantity * item.unit_cost).toFixed(2)}
                    </div>

                    {/* Remove */}
                    <div className="col-span-1 text-right">
                      <button
                        onClick={() => removeItem(index)}
                        className="text-red-400 hover:text-red-600 text-sm px-1"
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer: Totals + Actions */}
        <div className="border-t pt-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            <span className="font-medium">{items.length}</span> product
            {items.length !== 1 ? 's' : ''} ·{' '}
            <span className="font-medium">{totalUnits}</span> unit
            {totalUnits !== 1 ? 's' : ''} ·{' '}
            <span className="font-semibold text-lg text-gray-900">
              ${totalCost.toFixed(2)}
            </span>{' '}
            total
            {hasZeroCost && (
              <span className="text-yellow-600 ml-2 text-xs">
                ⚠ Some items have $0 cost
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleSubmit('draft')}
              disabled={saving || items.length === 0}
              className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save as Draft
            </button>
            <button
              onClick={() => handleSubmit('submitted')}
              disabled={saving || items.length === 0}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Creating...' : 'Submit PO'}
            </button>
          </div>
        </div>
      </div>

      {/* Product Picker Modal */}
      <ProductPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleProductSelect}
        vendor={vendor}
        existingItems={items}
      />

      {/* Submit Confirmation Modal */}
      <SubmitConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleSubmit('submitted')}
        vendor={vendor}
        items={items}
        notes={notes}
        expectedDate={expectedDate}
        submitting={saving}
      />
    </div>
  );
}
