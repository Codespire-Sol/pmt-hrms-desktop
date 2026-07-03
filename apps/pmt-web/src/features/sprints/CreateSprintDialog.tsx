import { useState } from 'react';
import { useCreateSprintMutation } from './sprintsApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Alert, AlertDescription } from '../../components/ui/alert';

interface CreateSprintDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateSprintDialog({ projectId, open, onOpenChange }: CreateSprintDialogProps) {
  const [createSprint, { isLoading }] = useCreateSprintMutation();
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
    capacityHours: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name) {
      setError('Sprint name is required');
      return;
    }

    try {
      await createSprint({
        projectId,
        data: {
          name: formData.name,
          goal: formData.goal || undefined,
          startDate: formData.startDate || undefined,
          endDate: formData.endDate || undefined,
          capacityHours: formData.capacityHours ? parseFloat(formData.capacityHours) : undefined,
        },
      }).unwrap();

      setFormData({
        name: '',
        goal: '',
        startDate: '',
        endDate: '',
        capacityHours: '',
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.data?.error?.message || 'Failed to create sprint');
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      goal: '',
      startDate: '',
      endDate: '',
      capacityHours: '',
    });
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Sprint</DialogTitle>
          <DialogDescription>
            Set up a new sprint with a name, goal, and dates.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Sprint Name *</Label>
            <Input
              id="name"
              placeholder="Sprint 1"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal">Sprint Goal</Label>
            <Input
              id="goal"
              placeholder="Complete user authentication module"
              value={formData.goal}
              onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacityHours">Capacity (Hours)</Label>
            <Input
              id="capacityHours"
              type="number"
              min="0"
              step="0.5"
              placeholder="160"
              value={formData.capacityHours}
              onChange={(e) => setFormData({ ...formData, capacityHours: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Sprint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
