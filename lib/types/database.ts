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
