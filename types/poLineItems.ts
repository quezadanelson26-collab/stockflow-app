export interface POLineItem {
  id: string;
  tenant_id: string;
  po_id: string;
  product_id: string;
  variant_id: string | null;

  ordered_qty: number;
  received_qty: number;

  cost: number;
  total_cost: number;

  created_at: string;
  updated_at: string;
}
