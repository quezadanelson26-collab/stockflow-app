import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import PODetailClient from './PODetailClient';

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: stores } = await supabase.from('stores').select('id, name').order('name');

  const { data: po } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      purchase_order_items (
        id, product_variant_id, quantity_ordered, quantity_received, cost_price,
        product_variants ( id, sku, option1, option2, cost_price, price,
          products ( id, title, vendor )
        )
      )
    `)
    .eq('id', id)
    .single();

  if (!po) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Purchase Order Not Found</h1>
        <Link href="/dashboard/purchase-orders" className="text-blue-600 hover:underline">Back to Purchase Orders</Link>
      </div>
    );
  }

  const storeName = (sid: string) => (stores || []).find((s) => s.id === sid)?.name || '—';

  return <PODetailClient po={po} storeName={storeName(po.destination_store_id)} />;
}
