// StockFlow v2 — Database type definitions

export interface Product {
  id: string;
  tenant_id: string;
  shopify_product_id: string | null;
  title: string;
  vendor: string | null;
  product_type: string | null;
  status: 'active' | 'draft' | 'archived';
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  tenant_id: string;
  product_id: string;
  shopify_variant_id: string | null;
  title: string;
  sku: string | null;
  barcode: string | null;
  wholesale_price: number | null;
  retail_price: number | null;
  size: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryLevel {
  id: string;
  tenant_id: string;
  variant_id: string;
  store_id: string;
  quantity_on_hand: number;
  quantity_committed: number;
  quantity_available: number;
  reorder_point: number | null;
  updated_at: string;
}

export interface ProductWithVariants extends Product {
  product_variants: (ProductVariant & {
    inventory_levels: InventoryLevel[];
  })[];
}
