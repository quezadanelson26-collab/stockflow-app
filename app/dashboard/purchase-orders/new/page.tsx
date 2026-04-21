import POForm from './POForm';

export default function NewPurchaseOrderPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Create Purchase Order</h1>
      <POForm />
    </div>
  );
}
