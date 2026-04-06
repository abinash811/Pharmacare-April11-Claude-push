import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/input';

/**
 * SearchInput - Search input with icon
 * Matches the Customers page design reference
 * 
 * @param {Object} props
 * @param {string} props.value - Input value
 * @param {Function} props.onChange - Change handler (receives value string)
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.className - Optional additional classes for the container
 */
export function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }) {
  return (
    <div className={`relative ${className}`} data-testid="search-input-wrapper">
      <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 w-full"
        data-testid="search-input"
      />
    </div>
  );
}
