import { useEffect, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useCreateSecurityLevelMutation,
  useUpdateSecurityLevelMutation,
  SecurityLevel,
} from './securityLevelsApi';
import { useGetRolesQuery } from '@/features/rbac/rbacApi';
import { toast } from '@/hooks/useToast';

const securityLevelSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  level: z.number().int().min(0).max(100).default(0),
  isDefault: z.boolean().default(false),
});

type SecurityLevelFormValues = z.infer<typeof securityLevelSchema>;

interface SecurityLevelFormDialogProps {
  projectId: string;
  securityLevel?: SecurityLevel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SecurityLevelFormDialog({
  projectId,
  securityLevel,
  open,
  onOpenChange,
}: SecurityLevelFormDialogProps) {
  const isEditing = !!securityLevel;
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const { data: rolesResponse } = useGetRolesQuery();
  const roles = rolesResponse?.data;

  const [createSecurityLevel, { isLoading: isCreating }] = useCreateSecurityLevelMutation();
  const [updateSecurityLevel, { isLoading: isUpdating }] = useUpdateSecurityLevelMutation();

  const isSubmitting = isCreating || isUpdating;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SecurityLevelFormValues>({
    resolver: zodResolver(securityLevelSchema),
    defaultValues: {
      name: '',
      description: '',
      level: 0,
      isDefault: false,
    },
  });

  const isDefault = watch('isDefault');

  useEffect(() => {
    if (open) {
      if (securityLevel) {
        reset({
          name: securityLevel.name,
          description: securityLevel.description || '',
          level: securityLevel.level,
          isDefault: securityLevel.isDefault,
        });
        setSelectedRoleIds(securityLevel.roles.map((r) => r.id));
      } else {
        reset({
          name: '',
          description: '',
          level: 0,
          isDefault: false,
        });
        setSelectedRoleIds([]);
      }
    }
  }, [open, securityLevel, reset]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  const onSubmit = async (data: SecurityLevelFormValues) => {
    try {
      const payload = {
        name: data.name,
        description: data.description || undefined,
        level: data.level,
        isDefault: data.isDefault,
        roleIds: selectedRoleIds.length > 0 ? selectedRoleIds : undefined,
      };

      if (isEditing && securityLevel) {
        await updateSecurityLevel({
          levelId: securityLevel.id,
          data: {
            ...payload,
            description: data.description || null,
            roleIds: selectedRoleIds,
          },
        }).unwrap();
        toast.success('Security level updated successfully');
      } else {
        await createSecurityLevel({
          projectId,
          data: payload,
        }).unwrap();
        toast.success('Security level created successfully');
      }

      onOpenChange(false);
    } catch {
      toast.error(isEditing ? 'Failed to update security level' : 'Failed to create security level');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Security Level' : 'Create Security Level'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the security level settings.'
                : 'Create a new security level to control issue visibility.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Confidential, Internal, Restricted"
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
                placeholder="Describe who should have access to issues with this security level..."
                rows={2}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="level">Restriction Level (0-100)</Label>
              <Input
                id="level"
                type="number"
                min={0}
                max={100}
                {...register('level', { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                Higher numbers indicate more restricted access.
              </p>
              {errors.level && (
                <p className="text-sm text-destructive">{errors.level.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isDefault">Default Security Level</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically apply to new issues
                </p>
              </div>
              <Switch
                id="isDefault"
                checked={isDefault}
                onCheckedChange={(checked) => setValue('isDefault', checked)}
              />
            </div>

            {roles && roles.length > 0 && (
              <div className="grid gap-2">
                <Label>Visible to Roles</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select which roles can view issues with this security level.
                  If none are selected, all project members can view.
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={selectedRoleIds.includes(role.id)}
                        onCheckedChange={() => toggleRole(role.id)}
                      />
                      <label
                        htmlFor={`role-${role.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {role.displayName}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                  ? 'Update Security Level'
                  : 'Create Security Level'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default SecurityLevelFormDialog;
