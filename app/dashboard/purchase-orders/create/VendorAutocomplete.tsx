'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface VendorAutocompleteProps {
  value: string;
  onChange: (vendor: string) => void;
  disabled?: boolean;
  locked?: boolean;
}

export default function VendorAutocomplete({
  value,
  onChange,
  disabled = false,
  locked = false,
}: VendorAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [vendors, setVendors] = useState<string[]>([]);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchVendors() {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('vendor')
        .not('vendor', 'is', null)
        .order('vendor', { ascending: true });

      if (!error && data) {
        const unique = Array.from(new Set(data.map((p: any) => p.vendor).filter(Boolean))) as string[];
        setVendors(unique);
      }
      setLoading(false);
    }
    fetchVendors();
  }, []);

  useEffect(() => {
    if (query.trim().length === 0) {
      setFiltered(vendors);
    } else {
      setFiltered(
        vendors.filter((v) =>
          v.toLowerCase().includes(query.toLowerCase())
        )
      );
    }
  }, [query, vendors]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  function handleSelect(vendor: string) {
    setQuery(vendor);
    onChange(vendor);
    setIsOpen(false);
  }

  if (locked) {
    return (
      <div className="flex items-center gap-2 w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700">
        <span className="text-gray-400">&#128274;</span>
        <span className="font-medium">{value}</span>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          if (e.target.value !== value) {
            onChange('');
          }
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Type vendor name..."
        disabled={disabled}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-400">Loading vendors...</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">No vendors found</div>
          ) : (
            filtered.map((vendor) => (
              <button
                key={vendor}
                onClick={() => handleSelect(vendor)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                  vendor === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
              >
                {vendor}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
