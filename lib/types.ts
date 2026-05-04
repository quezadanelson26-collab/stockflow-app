// ─── Shared TypeScript Types ────────────────────────────

export type ProductVariant = {
  id: string;
  title: string;
  sku: string;
  barcode: string | null;
  products: {
    id: string;
    title: string;
    vendor: string;
    status: string;
  };
};

export type InventoryItem = {
  id: string;
  quantity_on_hand: number;
  quantity_committed: number;
  quantity_available: number;
  last_counted_at: string | null;
  updated_at: string;
  store_id: string;
  product_variant_id: string;
  product_variants: ProductVariant;
};

export type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

export type POStatus = 'draft' | 'submitted' | 'partial' | 'received' | 'closed' | 'cancelled';
