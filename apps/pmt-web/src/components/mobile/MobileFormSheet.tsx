import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface MobileFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
}

export function MobileFormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  submitDisabled = false,
}: MobileFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90vh] rounded-t-xl flex flex-col"
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-2">
          <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full" />
        </div>

        <SheetHeader className="text-left px-4">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {/* Footer Actions */}
        <SheetFooter className="px-4 py-4 border-t gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onCancel?.();
              onOpenChange(false);
            }}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitDisabled || isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Mobile-optimized form field components
interface MobileFormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function MobileFormField({
  label,
  error,
  required,
  children,
  className,
}: MobileFormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// Mobile-optimized text input
interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function MobileInput({
  label,
  error,
  required,
  className,
  ...props
}: MobileInputProps) {
  return (
    <MobileFormField label={label} error={error} required={required}>
      <Input
        className={cn('h-12 text-base', className)}
        {...props}
      />
    </MobileFormField>
  );
}

// Mobile-optimized textarea
interface MobileTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export function MobileTextarea({
  label,
  error,
  required,
  className,
  ...props
}: MobileTextareaProps) {
  return (
    <MobileFormField label={label} error={error} required={required}>
      <Textarea
        className={cn('min-h-[120px] text-base', className)}
        {...props}
      />
    </MobileFormField>
  );
}

// Mobile-optimized select
interface MobileSelectProps {
  label: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  options: { value: string; label: string }[];
  error?: string;
  required?: boolean;
}

export function MobileSelect({
  label,
  value,
  onValueChange,
  placeholder = 'Select...',
  options,
  error,
  required,
}: MobileSelectProps) {
  return (
    <MobileFormField label={label} error={error} required={required}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-12 text-base">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="h-12 text-base"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </MobileFormField>
  );
}

// Quick Create Issue Sheet
interface QuickCreateIssueSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; type: string; priority: string }) => void;
  isSubmitting?: boolean;
}

export function QuickCreateIssueSheet({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: QuickCreateIssueSheetProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('medium');

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({ title, type, priority });
    setTitle('');
    setType('task');
    setPriority('medium');
  };

  const issueTypes = [
    { value: 'task', label: 'Task' },
    { value: 'bug', label: 'Bug' },
    { value: 'story', label: 'Story' },
    { value: 'epic', label: 'Epic' },
  ];

  const priorities = [
    { value: 'highest', label: 'Highest' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: 'lowest', label: 'Lowest' },
  ];

  return (
    <MobileFormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Create Issue"
      description="Quickly create a new issue"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Create"
      submitDisabled={!title.trim()}
    >
      <div className="space-y-4">
        <MobileInput
          label="Title"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />

        <div className="grid grid-cols-2 gap-4">
          <MobileSelect
            label="Type"
            value={type}
            onValueChange={setType}
            options={issueTypes}
          />

          <MobileSelect
            label="Priority"
            value={priority}
            onValueChange={setPriority}
            options={priorities}
          />
        </div>
      </div>
    </MobileFormSheet>
  );
}

export default MobileFormSheet;
