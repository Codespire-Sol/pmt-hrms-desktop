import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  useCreateVersionMutation,
  useUpdateVersionMutation,
  Version,
} from './versionsApi';
import { toast } from '@/hooks/useToast';

const versionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  startDate: z.string().optional(),
  releaseDate: z.string().optional(),
});

type VersionFormValues = z.infer<typeof versionSchema>;

interface VersionFormDialogProps {
  projectId: string;
  version?: Version | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionFormDialog({
  projectId,
  version,
  open,
  onOpenChange,
}: VersionFormDialogProps) {
  const isEditing = !!version;

  const [createVersion, { isLoading: isCreating }] = useCreateVersionMutation();
  const [updateVersion, { isLoading: isUpdating }] = useUpdateVersionMutation();

  const isSubmitting = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VersionFormValues>({
    resolver: zodResolver(versionSchema),
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      releaseDate: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (version) {
        reset({
          name: version.name,
          description: version.description || '',
          startDate: version.startDate ? version.startDate.split('T')[0] : '',
          releaseDate: version.releaseDate ? version.releaseDate.split('T')[0] : '',
        });
      } else {
        reset({
          name: '',
          description: '',
          startDate: '',
          releaseDate: '',
        });
      }
    }
  }, [open, version, reset]);

  const onSubmit = async (data: VersionFormValues) => {
    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        startDate: data.startDate || undefined,
        releaseDate: data.releaseDate || undefined,
      };

      if (isEditing && version) {
        await updateVersion({
          versionId: version.id,
          data: {
            ...payload,
            description: data.description || null,
            startDate: data.startDate || null,
            releaseDate: data.releaseDate || null,
          },
        }).unwrap();
        toast.success('Version updated successfully');
      } else {
        await createVersion({
          projectId,
          data: payload,
        }).unwrap();
        toast.success('Version created successfully');
      }

      onOpenChange(false);
    } catch {
      toast.error(isEditing ? 'Failed to update version' : 'Failed to create version');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Release' : 'Create Release'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the release details below.'
                : 'Create a new release to track software versions.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., v1.0.0, Sprint 1 Release"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what's included in this release..."
                rows={3}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  {...register('startDate')}
                />
                {errors.startDate && (
                  <p className="text-sm text-destructive">{errors.startDate.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="releaseDate">Target Release Date</Label>
                <Input
                  id="releaseDate"
                  type="date"
                  {...register('releaseDate')}
                />
                {errors.releaseDate && (
                  <p className="text-sm text-destructive">{errors.releaseDate.message}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? 'Updating...'
                  : 'Creating...'
                : isEditing
                  ? 'Update Release'
                  : 'Create Release'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default VersionFormDialog;
