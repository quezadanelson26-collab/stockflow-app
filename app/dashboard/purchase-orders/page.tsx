import Link from 'next/link';
import { getAllPurchaseOrders } from '@/lib/db/purchaseOrders';

export default async function PurchaseOrdersPage() {
  const purchaseOrders = await getAllPurchaseOrders();

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Purchase Orders</h1>

        <Link
          href="/dashboard/purchase-orders/new"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          New Purchase Order
        </Link>
      </div>

      <div className="bg-white rounded shadow p-4">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2">PO #</th>
              <th className="py-2">Vendor</th>
              <th className="py-2">Store</th>
              <th className="py-2">Status</th>
              <th className="py-2">Expected</th>
            </tr>
          </thead>

          <tbody>
            {purchaseOrders.map((po: any) => (
              <tr key={po.id} className="border-b hover:bg-gray-50">
                <td className="py-2">
                  <Link
                    href={`/dashboard/purchase-orders/${po.id}`}
                    className="text-blue-600 underline"
                  >
                    {po.id}
                  </Link>
                </td>
                <td className="py-2">{po.vendor_name}</td>
                <td className="py-2">{po.store_name}</td>
                <td className="py-2">{po.status}</td>
                <td className="py-2">{po.expected_date || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
