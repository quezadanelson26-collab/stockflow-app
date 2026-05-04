'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { formatNumber } from '@/lib/format';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';

interface Store { id: string; name: string; }
interface InventoryLevel { quantity_on_hand: number; store_id: string; }
interface Variant { id: string; sku: string; inventory_levels: InventoryLevel[]; }
interface Product {
  id: string; title: string; vendor: string; product_type: string;
  shopify_status: string; product_variants: Variant[];
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700';
    case 'draft': return 'bg-yellow-100 text-yellow-700';
    case 'archived': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

export default function ProductsClient({
  initialProducts, initialStores,
}: { initialProducts: Product[]; initialStores: Store[] }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const [vendorFilter, setVendorFilter] = useState('');
  const [shopifyStatusFilter, setShopifyStatusFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');

  const vendors = Array.from(
    new Set(initialProducts.map((p) => p.vendor).filter(Boolean))
  ) as string[];

  const getStoreStock = (product: Product, storeId: string): number => {
    return product.product_variants?.reduce((sum, v) => {
      const level = v.inventory_levels?.find((il) => il.store_id === storeId);
      return sum + (level?.quantity_on_hand || 0);
    }, 0) || 0;
  };

  const getTotalStock = (product: Product): number => {
    return product.product_variants?.reduce((sum, v) => {
      return sum + (v.inventory_levels?.reduce((s, il) => s + (il.quantity_on_hand || 0), 0) || 0);
    }, 0) || 0;
  };

  const filtered = useMemo(() => {
    return initialProducts.filter((p) => {
      const q = debouncedSearch.toLowerCase();
      const matchesSearch = !debouncedSearch ||
        p.title.toLowerCase().includes(q) ||
        p.vendor?.toLowerCase().includes(q) ||
        p.product_type?.toLowerCase().includes(q) ||
        p.product_variants?.some((v) => v.sku?.toLowerCase().includes(q));
      const matchesVendor = !vendorFilter || p.vendor === vendorFilter;
      const matchesShopifyStatus = !shopifyStatusFilter || p.shopify_status === shopifyStatusFilter;
      const total = getTotalStock(p);
      const matchesStock = !stockFilter ||
        (stockFilter === 'in_stock' && total > 0) ||
        (stockFilter === 'out_of_stock' && total === 0);
      const matchesStore = !storeFilter || getStoreStock(p, storeFilter) > 0;
      return matchesSearch && matchesVendor && matchesShopifyStatus && matchesStock && matchesStore;
    });
  }, [initialProducts, debouncedSearch, vendorFilter, shopifyStatusFilter, stockFilter, storeFilter]);

  const visibleStores = storeFilter
    ? initialStores.filter((s) => s.id === storeFilter)
    : initialStores;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <span className="text-sm text-gray-500">{formatNumber(filtered.length)} of {formatNumber(initialProducts.length)} products</span>
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        <input type="text" placeholder="Search by name, designer, or SKU..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Designers</option>
          {vendors.sort().map((v) => (<option key={v} value={v}>{v}</option>))}
        </select>
        <select value={shopifyStatusFilter} onChange={(e) => setShopifyStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Shopify Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Stock</option>
          <option value="in_stock">Has Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
        <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Locations</option>
          {initialStores.map((store) => (
            <option key={store.id} value={store.id}>{store.name}</option>
          ))}
        </select>
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Product</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Designer</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Shopify</th>
              {visibleStores.map((store) => (
                <th key={store.id} className={`text-center px-4 py-3 font-semibold ${storeFilter === store.id ? 'text-blue-700 bg-blue-50' : 'text-gray-600'}`}>{store.name}</th>
              ))}
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Total Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => {
              const total = getTotalStock(product);
              const isAttention = product.shopify_status === 'archived' && total > 0;
              return (
                <tr key={product.id} className={`border-b border-gray-100 hover:bg-gray-50 ${isAttention ? 'bg-amber-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/products/${product.id}`} className="text-blue-600 hover:underline font-medium">{product.title}</Link>
                      {isAttention && <span title="Archived but has stock — needs reactivation">⚠️</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{product.vendor}</td>
                  <td className="px-4 py-3 text-gray-600">{product.product_type}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium capitalize ${statusBadge(product.shopify_status)}`}>
                      {product.shopify_status}
                    </span>
                  </td>
                  {visibleStores.map((store) => (
                    <td key={store.id} className={`px-4 py-3 text-center font-mono ${storeFilter === store.id ? 'text-blue-700 font-bold bg-blue-50' : 'text-gray-700'}`}>{formatNumber(getStoreStock(product, store.id))}</td>
                  ))}
                  <td className="px-4 py-3 text-center font-bold font-mono text-gray-900">{formatNumber(total)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5 + visibleStores.length} className="px-4 py-8 text-center text-gray-400">No products found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
