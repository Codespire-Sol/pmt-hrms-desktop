import * as React from 'react';

interface MultiSelectProps {
  options?: { label: string; value: string }[];
  selected?: string[];
  onChange?: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({ options = [], selected = [], onChange, placeholder, className }: MultiSelectProps) {
  return (
    <select
      multiple
      className={className}
      value={selected}
      onChange={(e) => {
        const values = Array.from(e.target.selectedOptions, (opt) => opt.value);
        onChange?.(values);
      }}
    >
      {placeholder && <option disabled value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
