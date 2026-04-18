import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: productCount },
    { count: variantCount },
    { count: activeCount },
    { count: draftCount },
    { count: archivedCount },
  ] = await Promise.all([
    supabase.from('products').select('*',
