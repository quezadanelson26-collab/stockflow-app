'use client';

import { useEffect, useState } from 'react';

interface ProductPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: any) => void;
}

export default function ProductPicker({ open, onClose, onSelect }: ProductPickerProps) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch products + variants
  useEffect(() => {
    if (!open) return;

    const fetchProducts = async () => {
      setLoading(true);

      const res = await fetch('/api/products'); // You will create this API route later
      const data = await res.json();

      setProducts(data);
      setLoading(false);
    };

    fetchProducts();
  }, [open]);

  // Barcode scanning support
  useEffect(() => {
    const handleScan = (e: KeyboardEvent) => {
      if (!open) return;

      // Barcode scanners send fast key events ending with Enter
      if (e.key === 'Enter' && search.length > 3) {
        const match = products.flatMap(p => p.variants).find(v =>
          v.barcode?.toLowerCase() === search.toLowerCase()
        );

        if (match) {
          onSelect({
            product_id: match.product_id,
            variant_id: match.id,
            product_name: match.product_name,
            variant_name: match.variant_name,
            cost: match.cost,
            ordered_qty: 1,
          });

          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleScan);
    return () => window.removeEventListener('keydown', handleScan);
  }, [search, products, open, onSelect, onClose]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.variants.some(v =>
      v.sku?.toLowerCase().includes(search.toLowerCase()) ||
      v.barcode?.toLowerCase().includes(search.toLowerCase())
    )
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto shadow-xl">

        <h2 className="text-xl font-semibold mb-4">Select Product</h2>

        {/* Search */}
        <input
          type="text"
          placeholder="Search or scan barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 w-full mb-4"
        />

        {loading && <p>Loading products...</p>}

        {!loading && filtered.length === 0 && (
          <p className="text-gray-500">No products found.</p>
        )}

        {/* Product List */}
        <div className="space-y-4">
          {filtered.map((product) => (
            <div key={product.id} className="border rounded p-4">
              <p className="font-medium">{product.name}</p>

              {/* Variants */}
              <div className="mt-2 space-y-2">
                {product.variants.map((variant: any) => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => {
                      onSelect({
                        product_id: product.id,
                        variant_id: variant.id,
                        product_name: product.name,
                        variant_name: variant.name,
                        cost: variant.cost,
                        ordered_qty: 1,
                      });
                      onClose();
                    }}
                    className="w-full text-left border rounded px-3 py-2 hover:bg-gray-100"
                  >
                    <div className="flex justify-between">
                      <span>{variant.name}</span>
                      <span className="text-sm text-gray-600">${variant.cost}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 bg-gray-200 px-4 py-2 rounded"
        >
          Close
        </button>
      </div>
    </div>
  );
}
