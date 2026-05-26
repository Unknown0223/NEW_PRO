import React from 'react';
import { Check, Minus } from 'lucide-react';

interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onChange: (checked: boolean) => void;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ checked, onChange, className = '' }) => {
  const isChecked = checked === true;
  const isIndeterminate = checked === 'indeterminate';

  return (
    <button
      type="button"
      onClick={() => onChange(!isChecked)}
      className={`flex items-center justify-center w-4 h-4 rounded border transition-colors ${
        isChecked || isIndeterminate
          ? 'bg-teal-600 border-teal-600'
          : 'bg-white border-gray-300 hover:border-gray-400'
      } ${className}`}
    >
      {isChecked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      {isIndeterminate && <Minus className="w-3 h-3 text-white" strokeWidth={3} />}
    </button>
  );
};
