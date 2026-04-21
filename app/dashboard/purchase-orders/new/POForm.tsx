'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPurchaseOrderSchema } from '@/schemas/purchaseOrders';
import { z } from 'zod';

type FormValues = z.infer<typeof createPurchaseOrderSchema>;

export default function POForm() {
  const [lineItems, setLineItems] = useState<any[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: {
      store_id: '',
      vendor_name: '',
      expected_date: null,
      notes: '',
      line_items: [],
    },
  });

  const onSubmit = async (values: FormValues) => {
    console.log('Submitting PO:', values);
    // We will wire this to the server action in Step 3.5
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

      {/* Vendor Name */}
      <div>
        <label className="block text-sm font-medium mb-1">Vendor Name</label>
        <input
          type="text"
          {...form.register('vendor_name')}
          className="border rounded px-3 py-2 w-full"
        />
      </div>

      {/* Expected Date */}
      <div>
        <label className="block text-sm font-medium mb-1">Expected Date</label>
        <input
          type="date"
          {...form.register('expected_date')}
          className="border rounded px-3 py-2 w-full"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea
          {...form.register('notes')}
          className="border rounded px-3 py-2 w-full"
        />
      </div>

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Line Items</h2>
          <button
            type="button"
            onClick={() => console.log('Open product picker')}
            className="bg-blue-600 text-white px-3 py-1 rounded"
          >
            Add Line Item
          </button>
        </div>

        {lineItems.length === 0 && (
          <p className="text-sm text-gray-500">No line items added yet.</p>
        )}

        {/* We will render LineItemRow components here in Step 3.3 */}
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        Create Purchase Order
      </button>
    </form>
  );
}
