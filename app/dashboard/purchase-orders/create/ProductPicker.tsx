'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { POLineItemForm } from '@/lib/types/database';

interface ProductPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: POLineItemForm) => void;
  vendor: string;
  existingItems: POLineItemForm[];
}

interface VariantRow {
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_name: string;
  sku: string | null;
  barcode: string | null;
  cost_price: number | null;
  vendor: string | null;
  available_qty: number;
}

export default function ProductPicker({
  open,
  onClose,
  onSelect,
  vendor,
  existingItems,
}: ProductPickerProps) {
  const [search, setSearch] = useState('');
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
    if (open) {
      setSearch('');
      setError('');
    }
  }, [open]);

  useEffect(() => {
    if (!open || !vendor) return;

    async function fetchProducts() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('product_variants')
        .select(`
          id,
          product_id,
          sku,
          barcode,
          title,
          option1,
          option2,
          option3,
          cost_price,
          products!inner (
            id,
            title,
            vendor
          ),
          inventory_levels (
            quantity_available
          )
        `)
        .eq('products.vendor', vendor)
        .eq('is_active', true)
        .order('title', { ascending: true });

      if (fetchError) {
        setError('Failed to load products');
        setLoading(false);
        return;
      }

      if (data) {
        const rows: VariantRow[] = data.map((v: any) => ({
          variant_id: v.id,
          product_id: v.product_id,
          product_name: (v.products as any)?.title || '',
          variant_name: v.title || [v.option1, v.option2, v.option3].filter(Boolean).join(' / ') || 'Default',
          sku: v.sku,
          barcode: v.barcode,
          cost_price: v.cost_price,
          vendor: (v.products as any)?.vendor || null,
          available_qty: v.inventory_levels?.[0]?.quantity_available ?? 0,
        }));
        setVariants(rows);
      }
      setLoading(false);
    }
    fetchProducts();
  }, [open, vendor]);

  const filtered = variants.filter((v) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      v.product_name.toLowerCase().includes(q) ||
      v.variant_name.toLowerCase().includes(q) ||
      (v.sku && v.sku.toLowerCase().includes(q)) ||
      (v.barcode && v.barcode.toLowerCase().includes(q))
    );
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && search.trim().length > 2) {
        e.preventDefault();

        const barcodeMatch = variants.find(
          (v) => v.barcode?.toLowerCase() === search.toLowerCase()
        );

        if (barcodeMatch) {
          if (barcodeMatch.vendor?.toLowerCase() !== vendor.toLowerCase()) {
            setError(
              `This item belongs to ${barcodeMatch.vendor}, not ${vendor}. Cannot add to this PO.`
            );
            setSearch('');
            return;
          }

          handleSelectVariant(barcodeMatch);
          setSearch('');
          return;
        }

        const skuMatch = variants.find(
          (v) => v.sku?.toLowerCase() === search.toLowerCase()
        );

        if (skuMatch) {
          handleSelectVariant(skuMatch);
          setSearch('');
          return;
        }

        setError('Barcode not found. This product may not be synced from Shopify yet.');
        setSearch('');
      }
    },
    [search, variants, vendor]
  );

  function handleSelectVariant(v: VariantRow) {
    setError('');
    const cost = v.cost_price ?? 0;
    onSelect({
      product_id: v.product_id,
      variant_id: v.variant_id,
      product_name: v.product_name,
      variant_name: v.variant_name,
      sku: v.sku || '',
      barcode: v.barcode || '',
      quantity: 1,
      unit_cost: cost,
      cost_modified: false,
      shopify_cost: cost,
    });
    setSearch('');
    searchRef.current?.focus();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[700px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Select Product</h2>
            <p className="text-sm text-gray-500">
              Showing products from <span className="font-medium text-gray-700">{vendor}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-3 border-b">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setError('');
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search by name, SKU, barcode — or scan a barcode..."
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading products...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No products found</p>
              <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((v) => {
                const isAlreadyAdded = existingItems.some(
                  (item) => item.variant_id === v.variant_id
                );
                const cost = v.cost_price ?? 0;
                const isZeroCost = cost === 0;

                return (
                  <button
                    key={v.variant_id}
                    onClick={() => handleSelectVariant(v)}
                    className={`w-full text-left rounded-lg px-4 py-3 transition-colors ${
                      isAlreadyAdded
                        ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {v.product_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {v.variant_name}
                          {v.sku && <span className="ml-2 text-gray-400">SKU: {v.sku}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <div className="text-right">
                          <p className={`text-sm font-medium ${isZeroCost ? 'text-yellow-600' : 'text-gray-900'}`}>
                            {isZeroCost ? '$0.00' : `$${cost.toFixed(2)}`}
                          </p>
                          <p className="text-xs text-gray-400">
                            {v.available_qty} in stock
                          </p>
                        </div>
                        {isAlreadyAdded && (
                          <span className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded">
                            +1
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t bg-gray-50 rounded-b-xl flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {filtered.length} product{filtered.length !== 1 ? 's' : ''} from {vendor}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
