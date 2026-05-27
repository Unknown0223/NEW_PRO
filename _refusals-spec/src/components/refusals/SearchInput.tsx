import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Поиск',
}: SearchInputProps) {
  return (
    <div className="relative flex items-center">
      <Search size={14} className="absolute left-3 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400 transition-colors w-[180px]"
      />
    </div>
  );
}
