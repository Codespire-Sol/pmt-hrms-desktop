import { useState } from 'react';
import { Settings2, Plus, Check, X, ExternalLink, Mail, User, Calendar } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Checkbox } from '../../../components/ui/checkbox';
import { Badge } from '../../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  useGetIssueCustomFieldsQuery,
  useSetIssueCustomFieldValueMutation,
} from '../customFieldsApi';
import type { CustomFieldWithValue, CustomFieldType } from '../types';

interface CustomFieldsSectionProps {
  issueId: string;
  projectId: string;
  editable?: boolean;
}

export function CustomFieldsSection({
  issueId,
  editable = true,
}: CustomFieldsSectionProps) {
  const { data, isLoading } = useGetIssueCustomFieldsQuery(issueId);
  const [setFieldValue] = useSetIssueCustomFieldValueMutation();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-muted rounded" />
        ))}
      </div>
    );
  }

  const fields = data?.data || [];

  if (fields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No custom fields configured for this project</p>
      </div>
    );
  }

  const handleEdit = (field: CustomFieldWithValue) => {
    setEditingField(field.id);
    setEditValue(field.value);
  };

  const handleSave = async (fieldId: string) => {
    try {
      await setFieldValue({
        issueId,
        fieldId,
        body: { value: editValue },
      }).unwrap();
      setEditingField(null);
    } catch (error) {
      console.error('Failed to save custom field:', error);
    }
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue(null);
  };

  const renderFieldValue = (field: CustomFieldWithValue) => {
    if (field.value === null || field.value === undefined) {
      return <span className="text-muted-foreground italic">Not set</span>;
    }

    switch (field.fieldType) {
      case 'checkbox':
        return field.value ? (
          <Badge variant="secondary" className="bg-green-100 text-green-700">
            Yes
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-gray-100 text-gray-700">
            No
          </Badge>
        );

      case 'url':
        return (
          <a
            href={field.value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1"
          >
            {field.value.slice(0, 30)}...
            <ExternalLink className="h-3 w-3" />
          </a>
        );

      case 'email':
        return (
          <a
            href={`mailto:${field.value}`}
            className="text-primary hover:underline flex items-center gap-1"
          >
            <Mail className="h-3 w-3" />
            {field.value}
          </a>
        );

      case 'date':
      case 'datetime':
        return (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {new Date(field.value).toLocaleDateString()}
          </span>
        );

      case 'select': {
        const option = field.options?.options?.find((o) => o.value === field.value);
        return (
          <Badge
            variant="secondary"
            style={{
              backgroundColor: option?.color ? `${option.color}20` : undefined,
              color: option?.color,
              borderColor: option?.color,
            }}
          >
            {option?.label || field.value}
          </Badge>
        );
      }

      case 'multiselect':
        return (
          <div className="flex flex-wrap gap-1">
            {(field.value as string[]).map((v) => {
              const opt = field.options?.options?.find((o) => o.value === v);
              return (
                <Badge
                  key={v}
                  variant="secondary"
                  className="text-xs"
                  style={{
                    backgroundColor: opt?.color ? `${opt.color}20` : undefined,
                    color: opt?.color,
                    borderColor: opt?.color,
                  }}
                >
                  {opt?.label || v}
                </Badge>
              );
            })}
          </div>
        );

      case 'user':
        return (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground" />
            {field.value}
          </span>
        );

      default:
        return <span>{String(field.value)}</span>;
    }
  };

  const renderFieldEditor = (field: CustomFieldWithValue) => {
    switch (field.fieldType) {
      case 'text':
        return (
          <Input
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 text-sm"
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={editValue || ''}
            onChange={(e) => setEditValue(parseFloat(e.target.value) || null)}
            min={field.validation?.min}
            max={field.validation?.max}
            className="h-8 text-sm"
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 text-sm"
          />
        );

      case 'datetime':
        return (
          <Input
            type="datetime-local"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 text-sm"
          />
        );

      case 'checkbox':
        return (
          <Checkbox
            checked={editValue || false}
            onCheckedChange={(checked) => setEditValue(checked)}
          />
        );

      case 'url':
        return (
          <Input
            type="url"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="https://"
            className="h-8 text-sm"
          />
        );

      case 'email':
        return (
          <Input
            type="email"
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="email@example.com"
            className="h-8 text-sm"
          />
        );

      case 'select':
        return (
          <Select value={editValue || ''} onValueChange={setEditValue}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex items-center gap-2">
                    {opt.color && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        return (
          <div className="flex flex-wrap gap-1">
            {field.options?.options?.map((opt) => {
              const isSelected = (editValue || []).includes(opt.value);
              return (
                <Badge
                  key={opt.value}
                  variant={isSelected ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    const current = editValue || [];
                    if (isSelected) {
                      setEditValue(current.filter((v: string) => v !== opt.value));
                    } else {
                      setEditValue([...current, opt.value]);
                    }
                  }}
                  style={{
                    backgroundColor: isSelected && opt.color ? opt.color : undefined,
                  }}
                >
                  {opt.label}
                </Badge>
              );
            })}
          </div>
        );

      default:
        return (
          <Input
            value={editValue || ''}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 text-sm"
          />
        );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Custom Fields
        </h4>
      </div>

      <div className="space-y-2">
        {fields.map((field) => (
          <div
            key={field.id}
            className="flex items-start gap-2 py-1.5 border-b last:border-0"
          >
            <Label className="text-xs text-muted-foreground w-28 pt-1.5 flex-shrink-0">
              {field.name}
              {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
            </Label>

            {editingField === field.id ? (
              <div className="flex-1 flex items-center gap-1">
                <div className="flex-1">{renderFieldEditor(field)}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleSave(field.id)}
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleCancel}
                >
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            ) : (
              <div
                className={`flex-1 text-sm ${editable ? 'cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1' : ''}`}
                onClick={() => editable && handleEdit(field)}
              >
                {renderFieldValue(field)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
