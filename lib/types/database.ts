// StockFlow v2 — Database type definitions
// Matches actual Supabase schema as of April 2026

export interface Product {
  id: string;
  tenant_id: string;
  shopify_product_id: number | null;
  title: string;
  vendor: string | null;
  product_type: string | null;
  description: string | null;
  image_url: string | null;
  tags: string[] | null;
  is_active: boolean;
  shopify_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  tenant_id: string;
  shopify_variant_id: number | null;
  sku: string | null;
  barcode: string | null;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  price: number | null;
  compare_at_price: number | null;
  cost_price: number | null;
  weight: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryLevel {
  id: string;
  tenant_id: string;
  store_id: string;
  product_variant_id: string;
  quantity_on_hand: number;
  quantity_committed: number;
  quantity_available: number;
  last_counted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductWithVariants extends Product {
  product_variants: (ProductVariant & {
    inventory_levels: InventoryLevel[];
  })[];
}

// =============================================
// Purchase Order Types
// =============================================

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor: string;
  status: 'draft' | 'submitted' | 'partial' | 'received' | 'cancelled';
  total_cost: number;
  total_items: number;
  expected_date: string | null;
  vendor_order_number: string | null;
  notes: string | null;
  paid: boolean;
  paid_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface POLineItem {
  id: string;
  po_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
  quantity_received: number;
  received_at: string | null;
  received_by: string | null;
  backorder_qty: number;
  line_status: 'not_received' | 'partial' | 'received' | 'backorder';
  created_at: string;
}

export interface ReceivingSession {
  id: string;
  po_id: string;
  received_by: string;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ReceivingLineItem {
  id: string;
  session_id: string;
  po_line_item_id: string;
  quantity_received: number;
  received_at: string;
}

// =============================================
// Form / UI Types
// =============================================

export interface POLineItemForm {
  id?: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  barcode: string;
  quantity: number;
  unit_cost: number;
  cost_modified: boolean;
  shopify_cost: number;
}
