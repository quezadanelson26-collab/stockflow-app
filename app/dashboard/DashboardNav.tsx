'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Products', href: '/dashboard/products', icon: '👗' },
  { name: 'Purchase Orders', href: '/dashboard/purchase-orders', icon: '📋' },
  { name: 'Receiving', href: '#', icon: '📦', soon: true },
  { name: 'Cycle Counts', href: '#', icon: '🔍', soon: true },
  { name: 'Movement Ledger', href: '#', icon: '📒', soon: true },
];

export default function DashboardNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white flex flex-col z-50">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">📦 StockFlow</h1>
        <p className="text-xs text-gray-400 mt-1">BOCNYC Inventory</p>
      </div>
      <div className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href) && item.href !== '#';
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : item.soon
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
              onClick={item.soon ? (e) => e.preventDefault() : undefined}
            >
              <span>{item.icon}</span>
              <span>{item.name}</span>
              {item.soon && (
                <span className="ml-auto text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <div className="p-4 border-t border-gray-700">
        <p className="text-xs text-gray-400 truncate mb-2">{userEmail}</p>
        <button
          onClick={handleSignOut}
          className="w-full text-left text-sm text-gray-400 hover:text-red-400 transition-colors"
        >
          Sign Out →
        </button>
      </div>
    </nav>
  );
}
