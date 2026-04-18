'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { ProductWithVariants } from '@/lib/types/database';

export default function ProductsClient({ products }: { products: ProductWithVariants[] }) {
  const [search, setSearch] = useState('');
  const [designerFilter, setDesignerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const designers = useMemo(() => {
    const unique = [...new Set(products.map(p => p.vendor).filter(Boolean))] as string[];
    return unique.sort();
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      const q = search.toLowerCase();
      const matchesSearch = !search ||
        p.title.toLowerCase().includes(q) ||
        (p.vendor?.toLowerCase().includes(q)) ||
        p.product_variants.some(v =>
          v.sku?.toLowerCase().includes(q) ||
          v.barcode?.toLowerCase().includes(q)
        );
      const matchesDesigner = designerFilter === 'all' || p.vendor === designerFilter;
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && p.is_active) ||
        (statusFilter === 'inactive' && !p.is_active);
      return matchesSearch && matchesDesigner && matchesStatus;
    });
  }, [products, search, designerFilter, statusFilter]);

  const getStockLevel = (product: ProductWithVariants) => {
    return product.product_variants.reduce((sum, v) => {
      return sum + v.inventory_levels.reduce((s, il) => s + il.quantity_on_hand, 0);
    }, 0);
  };

  const getPriceRange = (product: ProductWithVariants) => {
    const prices = product.product_variants
      .map(v => v.price)
      .filter((p): p is number => p !== null);
    if (prices.length === 0) return '—';
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `$${min}` : `$${min}–$${max}`;
  };

  const getStockColor = (stock: number) => {
    if (stock === 0) return 'text-red-600 bg-red-50';
    if (stock <= 3) return 'text-amber-600 bg-amber-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} of {products.length} products
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Search by title, designer, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[250px] px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <select
            value={designerFilter}
            onChange={(e) => setDesignerFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Designers</option>
            {designers.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Designer</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Variants</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Price Range</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((product) => {
              const stock = getStockLevel(product);
              return (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {product.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{product.vendor || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{product.product_type || '—'}</td>
                  <td className="px-6 py-4 text-center text-sm text-gray-600">{product.product_variants.length}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">{getPriceRange(product)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStockColor(stock)}`}>
                      {stock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  No products found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

