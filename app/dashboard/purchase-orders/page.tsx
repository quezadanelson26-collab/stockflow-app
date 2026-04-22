import { createClient } from '@/lib/supabase/server';
import PurchaseOrdersClient from './PurchaseOrdersClient';

export default async function PurchaseOrdersPage() {
  const supabase = await createClient();

  const { data: pos } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      purchase_order_items ( id, quantity_ordered, quantity_received, cost_price )
    `)
    .order('created_at', { ascending: false });

  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .order('name');

  return <PurchaseOrdersClient initialPOs={pos || []} initialStores={stores || []} />;
}
