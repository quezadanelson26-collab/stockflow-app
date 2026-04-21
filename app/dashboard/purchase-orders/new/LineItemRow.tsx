'use client';

interface LineItemRowProps {
  item: any;
  index: number;
  onChange: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
}

export default function LineItemRow({
  item,
  index,
  onChange,
  onRemove,
}: LineItemRowProps) {
  return (
    <div className="border rounded p-4 mb-3 bg-white shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium">{item.product_name}</p>
          {item.variant_name && (
            <p className="text-sm text-gray-600">{item.variant_name}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-red-600 text-sm"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">

        {/* Ordered Qty */}
        <div>
          <label className="block text-sm font-medium mb-1">Qty</label>
          <input
            type="number"
            value={item.ordered_qty}
            onChange={(e) =>
              onChange(index, 'ordered_qty', Number(e.target.value))
            }
            className="border rounded px-3 py-2 w-full"
          />
        </div>

        {/* Cost */}
        <div>
          <label className="block text-sm font-medium mb-1">Cost</label>
          <input
            type="number"
            step="0.01"
            value={item.cost}
            onChange={(e) =>
              onChange(index, 'cost', Number(e.target.value))
            }
            className="border rounded px-3 py-2 w-full"
          />
        </div>
      </div>
    </div>
  );
}
