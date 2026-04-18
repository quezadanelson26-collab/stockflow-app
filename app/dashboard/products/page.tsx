import { createClient } from '@/lib/supabase/server';
import ProductsClient from './ProductsClient';

export default async function ProductsPage() {
  const supabase = await createClient();

  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .order('name');

  const { data: products } = await supabase
    .from('products')
    .select(`
      id, title, vendor, product_type, is_active,
      product_variants (
        id, sku,
        inventory_levels (
          quantity_on_hand, store_id
        )
      )
    `)
    .order('title');

  return <ProductsClient initialProducts={products || []} initialStores={stores || []} />;
}
