'use client';

import { useParams } from 'next/navigation';
import PODetailClient from './PODetailClient';

export default function PODetailPage() {
  const params = useParams();
  return <PODetailClient id={params.id as string} />;
}
