import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: productCount },
    { count: variantCount },
    { count: activeCount },
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('product_variants').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ]);

  const stats = [
    { label: 'Total Products', value: productCount ?? 0, icon: '👗' },
    { label: 'Total Variants', value: variantCount ?? 0, icon: '📏' },
    { label: 'Active Products', value: activeCount ?? 0, icon: '✅' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{stat.icon}</span>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Welcome to StockFlow v2</h2>
        <p className="text-gray-600">
          Your forensic inventory management system for BOCNYC. Use the sidebar to navigate
          between modules. Products module is live — more modules coming soon.
        </p>
      </div>
    </div>
  );
}
