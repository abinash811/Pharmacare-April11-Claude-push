import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  'data-testid'?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  inputRef,
  'data-testid': testId = 'search-input',
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`} data-testid="search-input-wrapper">
      <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 w-full"
        data-testid={testId}
      />
    </div>
  );
}
