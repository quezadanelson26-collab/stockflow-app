import { createClient } from '@/lib/supabase/server';
import { PurchaseOrder } from '@/types/purchaseOrders';
import { POLineItem } from '@/types/poLineItems';

export async function insertPurchaseOrder(data: Partial<PurchaseOrder>) {
  const supabase = createClient();

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return po as PurchaseOrder;
}

export async function insertPOLineItems(items: Partial<POLineItem>[]) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('po_line_items')
    .insert(items)
    .select();

  if (error) throw error;
  return data as POLineItem[];
}
