import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardNav from './DashboardNav';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardNav userEmail={user.email || ''} />
      <main className="flex-1 md:ml-64 mt-14 md:mt-0 mb-16 md:mb-0 p-4 md:p-8">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}
