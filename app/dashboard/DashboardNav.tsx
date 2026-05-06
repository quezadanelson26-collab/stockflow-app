"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Inventory", href: "/dashboard/inventory" },
  { label: "Products", href: "/dashboard/products" },
  { label: "Purchase Orders", href: "/dashboard/purchase-orders" },
  { label: "Movement Ledger", href: "/dashboard/movement-ledger" },
  { label: "Discrepancies", href: "/dashboard/discrepancies" },
];

const settingsItems = [
  { label: "Users", href: "/dashboard/settings/users" },
];

interface DashboardNavProps {
  userEmail: string;
}

export default function DashboardNav({ userEmail }: DashboardNavProps) {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    "block px-4 py-2 rounded-lg text-sm font-medium transition " +
    (pathname === href
      ? "bg-blue-50 text-blue-700"
      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900");

  return (
    <nav className="w-56 border-r bg-white h-screen p-4 flex flex-col gap-1">
      <div className="text-lg font-bold px-4 py-3 mb-2">StockFlow</div>

      {navItems.map((item) => (
        <Link key={item.href} href={item.href} className={linkClass(item.href)}>
          {item.label}
        </Link>
      ))}

      <div className="mt-6 mb-1 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Settings
      </div>

      {settingsItems.map((item) => (
        <Link key={item.href} href={item.href} className={linkClass(item.href)}>
          {item.label}
        </Link>
      ))}

      <div className="mt-auto px-4 py-3 text-xs text-gray-400 truncate">
        {userEmail}
      </div>
    </nav>
  );
}
