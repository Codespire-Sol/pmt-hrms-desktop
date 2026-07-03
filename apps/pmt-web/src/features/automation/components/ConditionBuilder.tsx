import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import type { Condition, ConditionOperator, AutomationField, ConditionOperatorInfo } from '../types';

interface ConditionBuilderProps {
  condition: Condition;
  fields: AutomationField[];
  operators: ConditionOperatorInfo[];
  onChange: (condition: Condition) => void;
  onRemove: () => void;
  showLogicalOperator?: boolean;
}

export function ConditionBuilder({
  condition,
  fields,
  operators,
  onChange,
  onRemove,
  showLogicalOperator,
}: ConditionBuilderProps) {
  const selectedField = fields.find((f) => f.id === condition.field);
  const fieldType = selectedField?.type || 'text';

  // Filter operators based on field type
  const availableOperators = operators.filter(
    (op) => op.types.includes('all') || op.types.includes(fieldType)
  );

  // Check if operator needs a value
  const needsValue = !['is_empty', 'is_not_empty', 'changed'].includes(condition.operator);

  return (
    <div className="border rounded-lg p-4 bg-muted/30">
      {showLogicalOperator && (
        <div className="mb-3">
          <Select
            value={condition.logicalOperator || 'AND'}
            onValueChange={(v) => onChange({ ...condition, logicalOperator: v as 'AND' | 'OR' })}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">AND</SelectItem>
              <SelectItem value="OR">OR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-2">
          <Label>Field</Label>
          <Select
            value={condition.field}
            onValueChange={(v) => onChange({ ...condition, field: v, value: '' })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select field" />
            </SelectTrigger>
            <SelectContent>
              {fields.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 space-y-2">
          <Label>Operator</Label>
          <Select
            value={condition.operator}
            onValueChange={(v) => onChange({ ...condition, operator: v as ConditionOperator })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              {availableOperators.map((op) => (
                <SelectItem key={op.operator} value={op.operator}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {needsValue && (
          <div className="flex-1 space-y-2">
            <Label>Value</Label>
            <ConditionValueInput
              fieldType={fieldType}
              operator={condition.operator}
              value={condition.value}
              onChange={(v) => onChange({ ...condition, value: v })}
            />
          </div>
        )}

        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

interface ConditionValueInputProps {
  fieldType: string;
  operator: ConditionOperator;
  value: any;
  onChange: (value: any) => void;
}

function ConditionValueInput({ fieldType, operator, value, onChange }: ConditionValueInputProps) {
  // For "in" and "not_in" operators, expect comma-separated values
  if (operator === 'in' || operator === 'not_in') {
    return (
      <Input
        placeholder="value1, value2, value3"
        value={Array.isArray(value) ? value.join(', ') : value || ''}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val ? val.split(',').map((s) => s.trim()) : []);
        }}
      />
    );
  }

  // For number fields
  if (fieldType === 'number') {
    return (
      <Input
        type="number"
        placeholder="Enter number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
      />
    );
  }

  // For date fields
  if (fieldType === 'date') {
    // For relative date operators, show special input
    if (['greater_than', 'less_than', 'greater_or_equal', 'less_or_equal'].includes(operator)) {
      return (
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="Days"
            className="w-20"
            value={typeof value === 'object' ? value?.days ?? '' : ''}
            onChange={(e) =>
              onChange({
                ...(typeof value === 'object' ? value : {}),
                days: e.target.value ? parseInt(e.target.value) : undefined,
              })
            }
          />
          <Select
            value={typeof value === 'object' ? value?.direction || 'ago' : 'ago'}
            onValueChange={(v) =>
              onChange({
                ...(typeof value === 'object' ? value : {}),
                direction: v,
              })
            }
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ago">days ago</SelectItem>
              <SelectItem value="from_now">days from now</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }
    return (
      <Input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    );
  }

  // For user fields
  if (fieldType === 'user') {
    return (
      <Select value={value || ''} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select user type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="currentUser">Current User</SelectItem>
          <SelectItem value="reporter">Reporter</SelectItem>
          <SelectItem value="assignee">Assignee</SelectItem>
          <SelectItem value="projectLead">Project Lead</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // Default text input
  return (
    <Input
      placeholder="Enter value"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
    />
  );
}
