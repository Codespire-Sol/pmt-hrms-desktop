import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Sparkles, Keyboard, Wand2 } from 'lucide-react';

import { useCreateIssueMutation } from '../issuesApi';
import { NaturalLanguageInput } from '@/features/ai/components/NaturalLanguageInput';
import type { ParsedIssue } from '@/features/ai/types';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

const quickIssueSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().optional(),
  typeId: z.string().min(1, 'Please select an issue type'),
  priorityId: z.string().optional(),
});

type QuickIssueFormData = z.infer<typeof quickIssueSchema>;

interface QuickCreateIssueProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  issueTypes: { id: string; name: string }[];
  priorities: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function QuickCreateIssue({
  open,
  onOpenChange,
  projectId,
  issueTypes,
  priorities,
  onSuccess,
}: QuickCreateIssueProps) {
  const { hasPermission: canCreateIssue } = usePermissionGuard('issues.create');
  const [createIssue, { isLoading: isCreating }] = useCreateIssueMutation();
  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');
  const filteredIssueTypes = useMemo(
    () => issueTypes.filter((type) => type.name?.toLowerCase() !== 'epic'),
    [issueTypes]
  );

  const form = useForm<QuickIssueFormData>({
    resolver: zodResolver(quickIssueSchema),
    defaultValues: {
      title: '',
      description: '',
      typeId: '',
      priorityId: '',
    },
  });

  const handleParsedIssue = (parsed: ParsedIssue) => {
    // Map parsed issue to form fields
    form.setValue('title', parsed.title);
    form.setValue('description', parsed.description);

    // Find matching type ID
    const typeMatch = filteredIssueTypes.find(
      (t) => t.name.toLowerCase() === parsed.issueType.toLowerCase()
    );
    if (typeMatch) {
      form.setValue('typeId', typeMatch.id);
    }

    // Find matching priority ID
    if (parsed.priority) {
      const priorityMatch = priorities.find(
        (p) => p.name.toLowerCase() === parsed.priority?.toLowerCase()
      );
      if (priorityMatch) {
        form.setValue('priorityId', priorityMatch.id);
      }
    }

    // Switch to manual tab to review
    setActiveTab('manual');
  };

  const onSubmit = async (formData: QuickIssueFormData) => {
    try {
      await createIssue({
        projectId,
        data: formData as import('../issuesApi').CreateIssueInput,
      }).unwrap();

      form.reset();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create issue:', error);
    }
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setActiveTab('ai');
    }
  }, [open, form]);

  if (!canCreateIssue) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Quick Create Issue
          </DialogTitle>
          <DialogDescription>
            Create an issue using AI or fill in the form manually.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ai' | 'manual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai" className="gap-2">
              <Wand2 className="h-4 w-4" />
              AI Assistant
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Keyboard className="h-4 w-4" />
              Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="mt-4">
            <NaturalLanguageInput
              projectId={projectId}
              onParsed={handleParsedIssue}
              placeholder={`Describe your issue in natural language...

Examples:
- "Create a bug for login failing on Safari"
- "Add high priority task to fix payment timeout"
- "User can't upload images larger than 5MB"`}
            />
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="Issue title" {...field} />
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
                          placeholder="Describe the issue..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="typeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredIssueTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priorityId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {priorities.map((priority) => (
                              <SelectItem key={priority.id} value={priority.id}>
                                {priority.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Issue
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
