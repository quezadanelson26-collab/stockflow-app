import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: productCount },
    { count: variantCount },
    { count: activeCount },
    { count: draftCount },
    { count: archivedCount },
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('product_variants').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('shopify_status', 'active'),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('shopify_status', 'draft'),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('shopify_status', 'archived'),
  ]);

  const { data: archivedWithStock } = await supabase
    .from('products')
    .select(`
      id, title, vendor,
      product_variants (
        id,
        inventory_levels ( quantity_on_hand )
      )
    `)
    .eq('shopify_status', 'archived');

  const needsAttention = (archivedWithStock || []).filter((p) => {
    const totalStock = p.product_variants?.reduce((sum: number, v: any) => {
      return sum + (v.inventory_levels?.reduce((s: number, il: any) => s + (il.quantity_on_hand || 0), 0) || 0);
    }, 0) || 0;
    return totalStock > 0;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {needsAttention.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-amber-800 mb-1">
                {needsAttention.length} Product{needsAttention.length > 1 ? 's' : ''} Need{needsAttention.length === 1 ? 's' : ''} Reactivation
              </h2>
              <p className="text-sm text-amber-700 mb-3">
                Archived on Shopify but still have stock. Likely returns — reactivate on Shopify so they can sell.
              </p>
              <div className="space-y-2">
                {needsAttention.map((p) => {
                  const stock = p.product_variants?.reduce((sum: number, v: any) => {
                    return sum + (v.inventory_levels?.reduce((s: number, il: any) => s + (il.quantity_on_hand || 0), 0) || 0);
                  }, 0) || 0;
                  return (
                    <div key={p.id} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-amber-200">
                      <Link href={`/dashboard/products/${p.id}`} className="text-blue-600 hover:underline font-medium text-sm">
                        {p.title}
                      </Link>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{p.vendor}</span>
                        <span className="text-xs font-mono font-bold text-amber-700">{stock} units</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Products</p>
          <p className="text-3xl font-bold text-gray-900">{productCount ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Variants</p>
          <p className="text-3xl font-bold text-gray-900">{variantCount ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-green-600 uppercase tracking-wide mb-1">Active</p>
          <p className="text-3xl font-bold text-green-700">{activeCount ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-yellow-600 uppercase tracking-wide mb-1">Draft</p>
          <p className="text-3xl font-bold text-yellow-700">{draftCount ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-red-600 uppercase tracking-wide mb-1">Archived</p>
          <p className="text-3xl font-bold text-red-700">{archivedCount ?? 0}</p>
        </div>
      </div>
    </div>
  );
}
