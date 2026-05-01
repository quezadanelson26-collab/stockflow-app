'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Products', href: '/dashboard/products', icon: '👗' },
  { name: 'Purchase Orders', href: '/dashboard/purchase-orders', icon: '📋' },
  { name: 'Receiving', href: '/dashboard/receiving', icon: '📦', soon: false },
  { name: 'Cycle Counts', href: '#', icon: '🔍', soon: true },
  { name: 'Movement Ledger', href: '#', icon: '📒', soon: true },
];

// Bottom nav on mobile: only active pages (no "soon" items), abbreviated labels
const mobileNavItems = navItems.filter((i) => !i.soon);

export default function DashboardNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href) && href !== '#';

  return (
    <>
      {/* ═══════════ Desktop Sidebar (hidden on mobile) ═══════════ */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-gray-900 text-white flex-col z-50">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold">📦 StockFlow</h1>
          <p className="text-xs text-gray-400 mt-1">BOCNYC Inventory</p>
        </div>
        <div className="flex-1 py-4">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                isActive(item.href)
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
          ))}
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

      {/* ═══════════ Mobile Top Header ═══════════ */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-gray-900 text-white flex items-center justify-between px-4 z-50">
        <h1 className="text-lg font-bold">📦 StockFlow</h1>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-2xl text-gray-300 hover:text-white p-1"
          aria-label="Menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* ═══════════ Mobile Slide-Down Menu ═══════════ */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed top-14 left-0 right-0 bg-gray-900 text-white z-50 border-t border-gray-700 shadow-2xl rounded-b-xl overflow-hidden">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-6 py-4 text-base ${
                  isActive(item.href)
                    ? 'bg-blue-600 text-white font-medium'
                    : item.soon
                    ? 'text-gray-500'
                    : 'text-gray-300 active:bg-gray-800'
                }`}
                onClick={(e) => {
                  if (item.soon) {
                    e.preventDefault();
                    return;
                  }
                  setMobileMenuOpen(false);
                }}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.name}</span>
                {item.soon && (
                  <span className="ml-auto text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                )}
              </Link>
            ))}
            <div className="px-6 py-4 border-t border-gray-700">
              <p className="text-xs text-gray-400 truncate mb-3">{userEmail}</p>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignOut();
                }}
                className="text-sm text-gray-400 hover:text-red-400"
              >
                Sign Out →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══════════ Mobile Bottom Navigation Bar ═══════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-stretch z-50"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {mobileNavItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`flex flex-col items-center justify-center flex-1 py-2.5 gap-0.5 transition-colors ${
              isActive(item.href)
                ? 'text-blue-600'
                : 'text-gray-400 active:text-gray-600'
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[10px] font-medium leading-tight">
              {item.name === 'Purchase Orders' ? 'POs' : item.name}
            </span>
          </Link>
        ))}
        {/* More button — opens the full menu */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`flex flex-col items-center justify-center flex-1 py-2.5 gap-0.5 transition-colors ${
            mobileMenuOpen ? 'text-blue-600' : 'text-gray-400 active:text-gray-600'
          }`}
        >
          <span className="text-xl leading-none">⋯</span>
          <span className="text-[10px] font-medium leading-tight">More</span>
        </button>
      </nav>
    </>
  );
}
