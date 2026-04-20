export type PurchaseOrderStatus =
  | 'draft'
  | 'submitted'
  | 'receiving'
  | 'closed';

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  store_id: string;
  vendor_name: string;
  status: PurchaseOrderStatus;
  expected_date: string | null;
  notes: string | null;

  submitted_at: string | null;
  submitted_by: string | null;
  closed_at: string | null;
  closed_by: string | null;

  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}
