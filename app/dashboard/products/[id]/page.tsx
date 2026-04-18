import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ProductWithVariants } from '@/lib/types/database';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      product_variants (
        *,
        inventory_levels (*)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !product) {
    notFound();
  }

  const p = product as ProductWithVariants;

  const totalStock = p.product_variants.reduce((sum, v) => {
    return sum + v.inventory_levels.reduce((s, il) => s + il.quantity_on_hand, 0);
  }, 0);

  const getStockColor = (qty: number) => {
    if (qty === 0) return 'text-red-600 bg-red-50';
    if (qty <= 2) return 'text-amber-600 bg-amber-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div>
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/dashboard/products" className="hover:text-blue-600">Products</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">{p.title}</span>
      </nav>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{p.title}</h1>
            <div className="flex items-center gap-4 mt-2">
              {p.vendor && <span className="text-sm text-gray-600">Designer: <strong>{p.vendor}</strong></span>}
              {p.product_type && <span className="text-sm text-gray-600">Type: <strong>{p.product_type}</strong></span>}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {p.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Stock</p>
            <p className={`text-2xl font-bold ${totalStock === 0 ? 'text-red-600' : totalStock <= 5 ? 'text-amber-600' : 'text-green-600'}`}>
              {totalStock}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Variants ({p.product_variants.length})
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Variant</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Barcode</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Option 1</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Option 2</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {p.product_variants.map((v) => {
              const qty = v.inventory_levels.reduce((s, il) => s + il.quantity_on_hand, 0);
              return (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{v.title}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 font-mono">{v.sku || '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 font-mono">{v.barcode || '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{v.option1 || '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{v.option2 || '—'}</td>
                  <td className="px-6 py-3 text-sm text-right text-gray-600">
                    {v.cost_price ? `$${v.cost_price}` : '—'}
                  </td>
                  <td className="px-6 py-3 text-sm text-right font-medium text-gray-900">
                    {v.price ? `$${v.price}` : '—'}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStockColor(qty)}`}>
                      {qty}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

