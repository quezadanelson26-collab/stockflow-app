import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

interface Store { id: string; name: string; }
interface InventoryLevel { quantity_on_hand: number; quantity_committed: number; store_id: string; }
interface Variant {
  id: string; title: string; sku: string; barcode: string;
  cost_price: number; price: number; option1: string; option2: string;
  inventory_levels: InventoryLevel[];
}
interface Product {
  id: string; title: string; vendor: string; product_type: string;
  is_active: boolean; product_variants: Variant[];
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: stores } = await supabase.from('stores').select('id, name').order('name');

  const { data: product } = await supabase
    .from('products')
    .select(`
      id, title, vendor, product_type, is_active,
      product_variants (
        id, title, sku, barcode, cost_price, price, option1, option2,
        inventory_levels ( quantity_on_hand, quantity_committed, store_id )
      )
    `)
    .eq('id', id)
    .single();

  if (!product) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Product Not Found</h1>
        <Link href="/dashboard/products" className="text-blue-600 hover:underline">Back to Products</Link>
      </div>
    );
  }

  const storeList: Store[] = stores || [];

  const getVarStore = (v: Variant, sid: string): number => {
    const l = v.inventory_levels?.find((il) => il.store_id === sid);
    return l?.quantity_on_hand || 0;
  };

  const getVarTotal = (v: Variant): number => {
    return v.inventory_levels?.reduce((s, il) => s + (il.quantity_on_hand || 0), 0) || 0;
  };

  const totalStock = product.product_variants?.reduce(
    (sum: number, v: Variant) => sum + getVarTotal(v), 0) || 0;

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard/products" className="text-sm text-blue-600 hover:underline mb-2 inline-block">Back to Products</Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.title}</h1>
            <p className="text-gray-500">{product.vendor} &middot; {product.product_type}</p>
          </div>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {product.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Variants</p>
          <p className="text-2xl font-bold text-gray-900">{product.product_variants?.length || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Stock</p>
          <p className="text-2xl font-bold text-gray-900">{totalStock}</p>
        </div>
        {storeList.map((store) => {
          const st = product.product_variants?.reduce((s: number, v: Variant) => s + getVarStore(v, store.id), 0) || 0;
          return (
            <div key={store.id} className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{store.name}</p>
              <p className="text-2xl font-bold text-gray-900">{st}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Size</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Color</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">SKU</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Barcode</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Cost</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Price</th>
              {storeList.map((store) => (
                <th key={store.id} className="text-center px-4 py-3 font-semibold text-gray-600">{store.name}</th>
              ))}
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {product.product_variants?.map((variant: Variant) => (
              <tr key={variant.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{variant.option1 || '\u2014'}</td>
                <td className="px-4 py-3 text-gray-600">{variant.option2 || '\u2014'}</td>
                <td className="px-4 py-3 font-mono text-gray-600">{variant.sku}</td>
                <td className="px-4 py-3 font-mono text-gray-500 text-xs">{variant.barcode}</td>
                <td className="px-4 py-3 text-right text-gray-600">${variant.cost_price?.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-gray-900 font-medium">${variant.price?.toFixed(2)}</td>
                {storeList.map((store) => (
                  <td key={store.id} className="px-4 py-3 text-center font-mono text-gray-700">{getVarStore(variant, store.id)}</td>
                ))}
                <td className="px-4 py-3 text-center font-bold font-mono text-gray-900">{getVarTotal(variant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
