'use client';

import type { POLineItemForm } from '@/lib/types/database';

interface SubmitConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  vendor: string;
  items: POLineItemForm[];
  notes: string;
  expectedDate: string;
  submitting: boolean;
}

export default function SubmitConfirmModal({
  open,
  onClose,
  onConfirm,
  vendor,
  items,
  notes,
  expectedDate,
  submitting,
}: SubmitConfirmModalProps) {
  if (!open) return null;

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalCost = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  const zeroCostItems = items.filter((item) => item.unit_cost === 0);
  const modifiedCostItems = items.filter((item) => item.cost_modified);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[500px] max-h-[80vh] overflow-y-auto">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Confirm Purchase Order</h2>
          <p className="text-sm text-gray-500">Review before submitting</p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Vendor</p>
              <p className="font-medium text-gray-900">{vendor}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Expected Date</p>
              <p className="font-medium text-gray-900">{expectedDate || 'Not set'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Total Items</p>
              <p className="font-medium text-gray-900">
                {items.length} line items ({totalItems} units)
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Total Cost</p>
              <p className="font-medium text-gray-900 text-lg">${totalCost.toFixed(2)}</p>
            </div>
          </div>

          {zeroCostItems.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-yellow-800">
                ⚠️ {zeroCostItems.length} item{zeroCostItems.length !== 1 ? 's' : ''} with $0.00 cost
              </p>
              <ul className="mt-1 text-xs text-yellow-700">
                {zeroCostItems.map((item) => (
                  <li key={item.variant_id}>• {item.product_name} — {item.variant_name}</li>
                ))}
              </ul>
            </div>
          )}

          {modifiedCostItems.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-blue-800">
                ✏️ {modifiedCostItems.length} item{modifiedCostItems.length !== 1 ? 's' : ''} with modified costs
              </p>
              <ul className="mt-1 text-xs text-blue-700">
                {modifiedCostItems.map((item) => (
                  <li key={item.variant_id}>
                    • {item.product_name}: ${item.shopify_cost.toFixed(2)} → ${item.unit_cost.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {notes && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Notes</p>
              <p className="text-sm text-gray-700 mt-1">{notes}</p>
            </div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Product</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Qty</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Cost</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.variant_id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900 text-xs">{item.product_name}</p>
                      <p className="text-xs text-gray-400">{item.variant_name}</p>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-700">{item.quantity}</td>
                    <td className="px-3 py-2 text-right text-gray-700">${item.unit_cost.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      ${(item.quantity * item.unit_cost).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit PO'}
          </button>
        </div>
      </div>
    </div>
  );
}
