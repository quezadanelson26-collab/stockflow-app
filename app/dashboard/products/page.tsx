import { createClient } from '@/lib/supabase/server';
import ProductsClient from './ProductsClient';
import type { ProductWithVariants } from '@/lib/types/database';

export default async function ProductsPage() {
  const supabase = await createClient();

  const { data: products, error } = await supabase
    .from('products')
    .select(`
      *,
      product_variants (
        *,
        inventory_levels (*)
      )
    `)
    .order('title');

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h2 className="text-red-800 font-semibold">Error loading products</h2>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  return <ProductsClient products={(products as ProductWithVariants[]) || []} />;
}
