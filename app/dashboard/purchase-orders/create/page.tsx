import { Suspense } from 'react';
import CreatePOClient from './CreatePOClient';

export default function CreatePOPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading...</div>}>
      <CreatePOClient />
    </Suspense>
  );
}
