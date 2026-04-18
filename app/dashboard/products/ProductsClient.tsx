'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Store { id: string; name: string; }
interface InventoryLevel { quantity_on_hand: number; store_id: string; }
interface Variant { id: string; sku: string; inventory_levels: InventoryLevel[]; }
interface Product {
  id: string; title: string; vendor: string; product_type: string;
  is_active: boolean; product_variants: Variant[];
}

export default function ProductsClient({
  initialProducts, initialStores,
}: { initialProducts: Product[]; initialStores: Store[] }) {
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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

  const filtered = initialProducts.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch = !search ||
      p.title.toLowerCase().includes(q) ||
      p.vendor?.toLowerCase().includes(q) ||
      p.product_type?.toLowerCase().includes(q) ||
      p.product_variants?.some((v) => v.sku?.toLowerCase().includes(q));
    const matchesVendor = !vendorFilter || p.vendor === vendorFilter;
    const matchesStatus = !statusFilter ||
      (statusFilter === 'active' && p.is_active) ||
      (statusFilter === 'inactive' && !p.is_active);
    const matchesStore = !storeFilter || getStoreStock(p, storeFilter) > 0;
    return matchesSearch && matchesVendor && matchesStatus && matchesStore;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <span className="text-sm text-gray-500">{filtered.length} of {initialProducts.length} products</span>
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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
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
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
              {initialStores.map((store) => (
                <th key={store.id} className={`text-center px-4 py-3 font-semibold ${storeFilter === store.id ? 'text-blue-700 bg-blue-50' : 'text-gray-600'}`}>{store.name}</th>
              ))}
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Total Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((product) => (
              <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/products/${product.id}`} className="text-blue-600 hover:underline font-medium">{product.title}</Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{product.vendor}</td>
                <td className="px-4 py-3 text-gray-600">{product.product_type}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${product.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {product.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {initialStores.map((store) => (
                  <td key={store.id} className={`px-4 py-3 text-center font-mono ${storeFilter === store.id ? 'text-blue-700 font-bold bg-blue-50' : 'text-gray-700'}`}>{getStoreStock(product, store.id)}</td>
                ))}
                <td className="px-4 py-3 text-center font-bold font-mono text-gray-900">{getTotalStock(product)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5 + initialStores.length} className="px-4 py-8 text-center text-gray-400">No products found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
