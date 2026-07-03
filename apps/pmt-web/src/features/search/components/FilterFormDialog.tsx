import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Code2, Sliders } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useCreateFilterMutation, useUpdateFilterMutation } from '../searchApi';
import { SavedFilter, FilterVisibility } from '../types';
import { JQLEditor } from './JQLEditor';
import { QueryBuilder } from './QueryBuilder';

const filterFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  jql: z.string().min(1, 'JQL query is required'),
  visibility: z.enum(['private', 'project', 'global']),
  isFavorite: z.boolean(),
  projectId: z.string().optional(),
});

type FilterFormData = z.infer<typeof filterFormSchema>;

interface FilterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter?: SavedFilter | null;
  projectId?: string;
}

export function FilterFormDialog({ open, onOpenChange, filter, projectId }: FilterFormDialogProps) {
  const { toast } = useToast();
  const [editorMode, setEditorMode] = useState<'jql' | 'visual'>('jql');

  const [createFilter, { isLoading: isCreating }] = useCreateFilterMutation();
  const [updateFilter, { isLoading: isUpdating }] = useUpdateFilterMutation();

  const isEditing = !!filter;
  const isLoading = isCreating || isUpdating;

  const form = useForm<FilterFormData>({
    resolver: zodResolver(filterFormSchema),
    defaultValues: {
      name: '',
      description: '',
      jql: '',
      visibility: 'private',
      isFavorite: false,
      projectId: projectId,
    },
  });

  // Reset form when filter changes
  useEffect(() => {
    if (filter) {
      form.reset({
        name: filter.name,
        description: filter.description || '',
        jql: filter.jql,
        visibility: filter.visibility,
        isFavorite: filter.isFavorite,
        projectId: filter.projectId,
      });
    } else {
      form.reset({
        name: '',
        description: '',
        jql: '',
        visibility: 'private',
        isFavorite: false,
        projectId: projectId,
      });
    }
  }, [filter, projectId, form]);

  const onSubmit = async (data: FilterFormData) => {
    try {
      if (isEditing) {
        await updateFilter({
          filterId: filter.id,
          data: {
            name: data.name,
            description: data.description,
            jql: data.jql,
            visibility: data.visibility,
            isFavorite: data.isFavorite,
          },
        }).unwrap();
        toast({ title: 'Filter updated successfully' });
      } else {
        await createFilter({
          name: data.name,
          description: data.description,
          jql: data.jql,
          visibility: data.visibility,
          isFavorite: data.isFavorite,
          projectId: data.projectId,
        }).unwrap();
        toast({ title: 'Filter created successfully' });
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.data?.error?.message || 'Failed to save filter',
        variant: 'destructive',
      });
    }
  };

  const handleJQLChange = (jql: string) => {
    form.setValue('jql', jql, { shouldValidate: true });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Filter' : 'Create Filter'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your saved filter settings and JQL query.'
              : 'Create a new saved filter to quickly search for issues.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Filter" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibility</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select visibility" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="private">Private - Only you</SelectItem>
                        <SelectItem value="project">Project - Project members</SelectItem>
                        <SelectItem value="global">Global - Everyone</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this filter finds..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Query</Label>
                <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as 'jql' | 'visual')}>
                  <TabsList className="h-8">
                    <TabsTrigger value="jql" className="text-xs px-2 gap-1">
                      <Code2 className="h-3 w-3" />
                      JQL
                    </TabsTrigger>
                    <TabsTrigger value="visual" className="text-xs px-2 gap-1">
                      <Sliders className="h-3 w-3" />
                      Visual
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <FormField
                control={form.control}
                name="jql"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      {editorMode === 'jql' ? (
                        <JQLEditor
                          value={field.value}
                          onChange={handleJQLChange}
                          showExecuteButton={false}
                        />
                      ) : (
                        <QueryBuilder
                          value={field.value}
                          onChange={handleJQLChange}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isFavorite"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Add to Favorites</FormLabel>
                    <FormDescription>
                      Mark this filter as a favorite for quick access
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isEditing ? 'Update Filter' : 'Create Filter'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default FilterFormDialog;
