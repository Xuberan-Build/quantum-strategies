'use client';

import { useState, useEffect } from 'react';

interface SliderAllocationProps {
  categories: Array<{
    key: string;
    label: string;
    description: string;
    color: string;
  }>;
  onChange: (values: Record<string, number>) => void;
  disabled?: boolean;
}

export function SliderAllocation({ categories, onChange, disabled = false }: SliderAllocationProps) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    const equalShare = Math.floor(100 / categories.length);
    categories.forEach((cat) => {
      initial[cat.key] = equalShare;
    });
    return initial;
  });

  const total = Object.values(values).reduce((sum, val) => sum + val, 0);
  const remaining = 100 - total;

  useEffect(() => {
    onChange(values);
  }, [values, onChange]);

  const handleSliderChange = (key: string, newValue: number) => {
    if (disabled) return;

    const currentValue = values[key];
    const delta = newValue - currentValue;

    if (delta === 0) return;

    // If increasing this value, we need to decrease others
    if (delta > 0) {
      const actualIncrease = Math.min(delta, 100 - total);

      setValues((prev) => ({
        ...prev,
        [key]: currentValue + actualIncrease,
      }));
    } else {
      // Decreasing is always allowed
      setValues((prev) => ({
        ...prev,
        [key]: Math.max(0, newValue),
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-400">
          Total allocated: <span className={`font-semibold ${total === 100 ? 'text-teal-400' : total > 100 ? 'text-red-400' : 'text-yellow-400'}`}>{total}%</span>
        </div>
        {total !== 100 && (
          <div className="text-sm text-gray-500">
            {remaining > 0 ? `${remaining}% unallocated` : `${Math.abs(remaining)}% over limit`}
          </div>
        )}
      </div>

      {categories.map((category) => (
        <div key={category.key} className="space-y-2">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                <span className="font-semibold text-white">{category.label}</span>
                <span className="text-sm text-gray-400">({values[category.key]}%)</span>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-5">{category.description}</p>
            </div>
          </div>

          <div className="relative">
            <div className="w-full h-2 bg-gray-700 rounded-lg overflow-hidden">
              <div
                className={`h-full ${category.color} transition-all duration-200`}
                style={{ width: `${values[category.key]}%` }}
              />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={values[category.key]}
              onChange={(e) => handleSliderChange(category.key, parseInt(e.target.value))}
              disabled={disabled}
              className="absolute top-0 left-0 w-full h-2 opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
