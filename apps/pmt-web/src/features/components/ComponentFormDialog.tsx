import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  useCreateComponentMutation,
  useUpdateComponentMutation,
  Component,
} from './componentsApi';
import { toast } from '@/hooks/useToast';

const componentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
  isActive: z.boolean(),
});

type ComponentFormValues = z.infer<typeof componentSchema>;

interface ComponentFormDialogProps {
  projectId: string;
  component?: Component | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const colorPresets = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

export function ComponentFormDialog({
  projectId,
  component,
  open,
  onOpenChange,
}: ComponentFormDialogProps) {
  const isEditing = !!component;

  const form = useForm<ComponentFormValues>({
    resolver: zodResolver(componentSchema),
    defaultValues: {
      name: '',
      description: '',
      color: '#6366f1',
      isActive: true,
    },
  });

  const [createComponent, { isLoading: isCreating }] = useCreateComponentMutation();
  const [updateComponent, { isLoading: isUpdating }] = useUpdateComponentMutation();

  const isLoading = isCreating || isUpdating;

  useEffect(() => {
    if (component) {
      form.reset({
        name: component.name,
        description: component.description || '',
        color: component.color,
        isActive: component.isActive,
      });
    } else {
      form.reset({
        name: '',
        description: '',
        color: '#6366f1',
        isActive: true,
      });
    }
  }, [component, form]);

  const onSubmit = async (values: ComponentFormValues) => {
    try {
      if (isEditing && component) {
        await updateComponent({
          componentId: component.id,
          data: values,
        }).unwrap();
        toast.success('Component updated successfully');
      } else {
        await createComponent({
          projectId,
          data: values as import('./componentsApi').CreateComponentInput,
        }).unwrap();
        toast.success('Component created successfully');
      }
      onOpenChange(false);
    } catch {
      toast.error(isEditing ? 'Failed to update component' : 'Failed to create component');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Component' : 'Create Component'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Frontend, Backend, API" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of this component..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Optional description for this component.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {colorPresets.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                              field.value === color
                                ? 'border-primary scale-110'
                                : 'border-transparent hover:border-muted-foreground'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => field.onChange(color)}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          className="w-12 h-8 p-0 border-0"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                        <Input
                          {...field}
                          placeholder="#6366f1"
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEditing && (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Inactive components won't appear in issue forms.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Component'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
