import { useState } from 'react';
import { useCompleteSprintMutation, Sprint } from './sprintsApi';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';

interface CompleteSprintDialogProps {
  sprint: Sprint;
  sprints: Sprint[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompleteSprintDialog({
  sprint,
  sprints,
  open,
  onOpenChange,
}: CompleteSprintDialogProps) {
  const [completeSprint, { isLoading }] = useCompleteSprintMutation();
  const [error, setError] = useState('');

  const [incompleteAction, setIncompleteAction] = useState<'move_to_backlog' | 'move_to_next_sprint'>(
    'move_to_backlog'
  );
  const [nextSprintId, setNextSprintId] = useState('');
  const [retrospectiveNotes, setRetrospectiveNotes] = useState('');

  const incompleteCount =
    sprint.progress ? sprint.progress.totalIssues - sprint.progress.completedIssues : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (incompleteAction === 'move_to_next_sprint' && !nextSprintId) {
      setError('Please select a sprint to move incomplete issues to');
      return;
    }

    try {
      await completeSprint({
        sprintId: sprint.id,
        data: {
          incompleteIssueAction: incompleteAction,
          nextSprintId: incompleteAction === 'move_to_next_sprint' ? nextSprintId : undefined,
          retrospectiveNotes: retrospectiveNotes || undefined,
        },
      }).unwrap();

      onOpenChange(false);
    } catch (err: any) {
      setError(err?.data?.error?.message || 'Failed to complete sprint');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Complete Sprint: {sprint.name}</DialogTitle>
          <DialogDescription>
            Review the sprint completion and decide what to do with incomplete issues.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sprint Summary */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <h4 className="font-medium mb-2">Sprint Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Completed Issues:</div>
              <div className="font-medium">{sprint.progress?.completedIssues || 0}</div>
              <div>Incomplete Issues:</div>
              <div className="font-medium">{incompleteCount}</div>
              <div>Story Points Completed:</div>
              <div className="font-medium">{sprint.progress?.completedStoryPoints || 0}</div>
            </div>
          </div>

          {/* Incomplete Issues Action */}
          {incompleteCount > 0 && (
            <div className="space-y-3">
              <Label>What should happen to {incompleteCount} incomplete issue(s)?</Label>
              <RadioGroup
                value={incompleteAction}
                onValueChange={(v) => setIncompleteAction(v as any)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="move_to_backlog" id="backlog" />
                  <Label htmlFor="backlog" className="font-normal">
                    Move to backlog
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="move_to_next_sprint" id="next" />
                  <Label htmlFor="next" className="font-normal">
                    Move to another sprint
                  </Label>
                </div>
              </RadioGroup>

              {incompleteAction === 'move_to_next_sprint' && (
                <Select value={nextSprintId} onValueChange={setNextSprintId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sprint" />
                  </SelectTrigger>
                  <SelectContent>
                    {sprints.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Retrospective Notes */}
          <div className="space-y-2">
            <Label htmlFor="retrospective">Retrospective Notes (Optional)</Label>
            <textarea
              id="retrospective"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="What went well? What could be improved?"
              value={retrospectiveNotes}
              onChange={(e) => setRetrospectiveNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Completing...' : 'Complete Sprint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
