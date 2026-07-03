import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ColorPicker } from './shared/ColorPicker';
import { IconPicker } from './shared/IconPicker';

const issueTypeSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-z0-9_-]+$/, 'Name must only contain lowercase letters, numbers, hyphens, and underscores'),
  displayName: z.string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be less than 100 characters'),
  description: z.string()
    .max(255, 'Description must be less than 255 characters')
    .optional(),
  icon: z.string().optional(),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (#RRGGBB)')
    .optional(),
  isSubtask: z.boolean().default(false),
});

type IssueTypeFormData = z.infer<typeof issueTypeSchema>;

interface CreateIssueTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSubmit: (data: IssueTypeFormData) => void | Promise<void>;
  initialData?: Partial<IssueTypeFormData>;
  isSubmitting?: boolean;
}

const PRESET_COLORS = [
  '#0052CC', '#00875A', '#6554C0', '#403294',
  '#DE350B', '#FF5630', '#FF991F', '#FFAB00',
  '#6554C0', '#8777D9', '#C5B5FD', '#E9D8FD',
  '#172B4D', '#42526E', '#6B778C', '#8993A4',
];

const PRESET_ICONS = [
  'Tag', 'CheckSquare', 'Circle', 'Square',
  'Triangle', 'Hexagon', 'Star', 'Heart',
  'Bug', 'Lightbulb', 'Zap', 'Target',
  'Package', 'Folder', 'FileText', 'Clipboard',
];

export function CreateIssueTypeModal({
  open,
  onOpenChange,
  projectId,
  onSubmit,
  initialData,
  isSubmitting = false,
}: CreateIssueTypeModalProps) {
  const [selectedColor, setSelectedColor] = useState(initialData?.color || PRESET_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(initialData?.icon || PRESET_ICONS[0]);

  const form = useForm<IssueTypeFormData>({
    resolver: zodResolver(issueTypeSchema),
    defaultValues: {
      name: '',
      displayName: '',
      description: '',
      icon: selectedIcon,
      color: selectedColor,
      isSubtask: false,
      ...initialData,
    },
  });

  // Update form when initialData changes
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: '',
        displayName: '',
        description: '',
        icon: selectedIcon,
        color: selectedColor,
        isSubtask: false,
        ...initialData,
      });
      if (initialData.color) setSelectedColor(initialData.color);
      if (initialData.icon) setSelectedIcon(initialData.icon);
    }
  }, [initialData, form, selectedIcon, selectedColor]);

  const handleSubmit = async (data: IssueTypeFormData) => {
    try {
      await onSubmit({
        ...data,
        icon: selectedIcon,
        color: selectedColor,
      });
      // Close modal after successful submission
      onOpenChange(false);
    } catch (error) {
      // Don't close modal on error - let parent handle error display
      console.error('Failed to submit issue type:', error);
    }
  };

  const handleReset = () => {
    form.reset();
    setSelectedColor(PRESET_COLORS[0]);
    setSelectedIcon(PRESET_ICONS[0]);
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      handleReset();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl">
            {initialData ? 'Edit Issue Type' : 'Create New Issue Type'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {initialData
              ? 'Update the issue type configuration.'
              : 'Create a new issue type for your project workflow.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="px-6 pb-8 space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="task"
                          className="bg-muted/30 focus-visible:ring-offset-0"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value.toLowerCase().replace(/\s+/g, '_');
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                {/* Display Name */}
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Display Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Task" className="bg-muted/30 focus-visible:ring-offset-0" {...field} />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe this issue type..."
                        rows={2}
                        className="resize-none bg-muted/30 focus-visible:ring-offset-0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>

            {/* Visual Design Section */}
            <div className="space-y-4 p-4 rounded-xl bg-muted/20 border border-border/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Visual Design</h4>
              <div className="grid grid-cols-2 gap-8">
                {/* Icon Picker */}
                <div className="space-y-3">
                  <Label className="text-[11px] font-medium text-muted-foreground">Pick an Icon</Label>
                  <IconPicker
                    selectedIcon={selectedIcon}
                    onIconChange={setSelectedIcon}
                    icons={PRESET_ICONS}
                  />
                </div>

                {/* Color Picker */}
                <div className="space-y-3">
                  <Label className="text-[11px] font-medium text-muted-foreground">Brand Color</Label>
                  <ColorPicker
                    selectedColor={selectedColor}
                    onColorChange={setSelectedColor}
                    colors={PRESET_COLORS}
                  />
                </div>
              </div>
            </div>

            {/* Preview & Subtask Section */}
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/10">
                <div className="space-y-1">
                  <FormLabel className="text-xs font-bold uppercase tracking-wider text-primary/70">Preview</FormLabel>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-lg shadow-sm"
                      style={{
                        backgroundColor: `${selectedColor}20`,
                        color: selectedColor
                      }}
                    >
                      <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: selectedColor }} />
                    </div>
                    <span className="font-semibold text-sm">{form.watch('displayName') || 'Task Name'}</span>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="isSubtask"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-4 space-y-0">
                      <div className="text-right">
                        <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">Subtask</FormLabel>
                        <p className="text-[10px] text-muted-foreground">Mark as subtask</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-primary"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="hover:bg-muted"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="px-8 shadow-lg shadow-primary/20">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {initialData ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  initialData ? 'Update Issue Type' : 'Create Issue Type'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
