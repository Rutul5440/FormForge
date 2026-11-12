import { FieldDefinition, FieldType } from '../models/form.models';

export interface FieldTypeVisualMeta {
  type: FieldType;
  label: string;
  shortTag: string;
  description: string;
  accentColor: string;
  defaultPlaceholder: string;
}

export const FIELD_TYPE_META: Record<FieldType, FieldTypeVisualMeta> = {
  text: {
    type: 'text',
    label: 'Text Input',
    shortTag: 'TEXT',
    description: 'Single or multi-line text with length & regex validation',
    accentColor: '#0d6e6e',
    defaultPlaceholder: 'Enter response'
  },
  date: {
    type: 'date',
    label: 'Date Picker',
    shortTag: 'DATE',
    description: 'ISO calendar date with min/max bounds',
    accentColor: '#b45309',
    defaultPlaceholder: 'YYYY-MM-DD'
  },
  dropdown: {
    type: 'dropdown',
    label: 'Dropdown Select',
    shortTag: 'LIST',
    description: 'Controlled choice list validated on server',
    accentColor: '#2563eb',
    defaultPlaceholder: 'Select an option'
  },
  signature: {
    type: 'signature',
    label: 'Signature Pad',
    shortTag: 'SIGN',
    description: 'Pointer & touch PNG ink attestation',
    accentColor: '#7c3aed',
    defaultPlaceholder: 'Sign in the box below'
  }
};

export const REUSABLE_FIELD_TYPES: FieldTypeVisualMeta[] = [
  FIELD_TYPE_META.text,
  FIELD_TYPE_META.date,
  FIELD_TYPE_META.dropdown,
  FIELD_TYPE_META.signature
];

export function getFieldAccent(type: FieldType): string {
  return FIELD_TYPE_META[type]?.accentColor ?? '#0d6e6e';
}

export function slugifyFieldKey(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'field';
}

export function createFieldFromType(type: FieldType, existingFields: FieldDefinition[]): FieldDefinition {
  const nextIdx = existingFields.length + 1;
  const meta = FIELD_TYPE_META[type];
  const baseLabel = `${meta.label} ${nextIdx}`;
  let key = slugifyFieldKey(baseLabel);
  const usedKeys = new Set(existingFields.map((f) => f.key));
  let n = 2;
  while (usedKeys.has(key)) {
    key = `${slugifyFieldKey(baseLabel)}_${n++}`;
  }

  return {
    id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    key,
    type,
    label: baseLabel,
    placeholder: meta.defaultPlaceholder,
    required: true,
    options: type === 'dropdown' ? ['Option A', 'Option B', 'Option C'] : undefined,
    validation: type === 'text' ? { maxLength: 250 } : undefined
  };
}
