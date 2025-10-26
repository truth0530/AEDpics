'use client';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { EXPIRY_FILTER_LABELS, type ExpiryFilter } from '@/lib/constants/aed-filters';

interface ExpiryFilterProps {
  value?: ExpiryFilter;
  onChange: (value: ExpiryFilter | undefined) => void;
}

const EXPIRY_OPTIONS: Array<{ value: ExpiryFilter; label: string }> = Object.entries(EXPIRY_FILTER_LABELS).map(
  ([value, label]) => ({ value: value as ExpiryFilter, label })
);

export function ExpiryFilter({ value, onChange }: ExpiryFilterProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">유효기간</Label>
      <RadioGroup
        value={value ?? ''}
        onValueChange={(next) => onChange(next ? (next as ExpiryFilter) : undefined)}
        className="grid gap-2"
      >
        <RadioGroupItemWithLabel value="" label="전체" checked={value === undefined} />
        {EXPIRY_OPTIONS.map((option) => (
          <RadioGroupItemWithLabel
            key={option.value}
            value={option.value}
            label={option.label}
            checked={value === option.value}
          />
        ))}
      </RadioGroup>
    </div>
  );
}

interface RadioGroupItemWithLabelProps {
  value: string;
  label: string;
  checked: boolean;
}

function RadioGroupItemWithLabel({ value, label, checked }: RadioGroupItemWithLabelProps) {
  return (
    <Label
      htmlFor={`expiry-${value || 'all'}`}
      className={`flex items-center gap-2 rounded-md border p-2 text-sm transition ${
        checked
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border hover:bg-muted'
      }`}
    >
      <RadioGroupItem id={`expiry-${value || 'all'}`} value={value} className="sr-only" />
      <span>{label}</span>
    </Label>
  );
}
