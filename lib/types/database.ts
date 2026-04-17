export interface Product {
  id: string;
  tenant_id: string;
  shopify_product_id: string | null;
  title: string;
  vendor: string | null;
  product_type: string | null;
  status: string;
  image_url: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  product_variants?: ProductVariant[];
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
  position: number;
  created_at: string;
  updated_at: string;
  inventory_levels?: InventoryLevel[];
}

export interface InventoryLevel {
  id: string;
  tenant_id: string;
  variant_id: string;
  store_id: string;
  on_hand: number;
  committed: number;
  available: number;
  updated_at: string;
}
