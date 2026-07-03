import { useState } from 'react';
import { Pencil, User2, Flag, Hash, Calendar } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../components/ui/popover';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { useUpdateIssueMutation } from '../../issues/issuesApi';
import { useGetProjectMembersQuery } from '../../projects/projectsApi';
import type { Issue } from '../../issues/issuesApi';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

interface QuickEditPopoverProps {
  issue: Issue;
  projectId: string;
  onUpdate?: () => void;
}

const PRIORITIES = [
  { value: 'highest', label: 'Highest', color: '#ef4444' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'medium', label: 'Medium', color: '#eab308' },
  { value: 'low', label: 'Low', color: '#3b82f6' },
  { value: 'lowest', label: 'Lowest', color: '#6b7280' },
];

const STORY_POINTS = [0.5, 1, 2, 3, 5, 8, 13, 21];

export function QuickEditPopover({ issue, projectId, onUpdate }: QuickEditPopoverProps) {
  const { hasPermission: canUpdateIssue } = usePermissionGuard(
    ['issues.update', 'issues.update_own'],
    'any'
  );
  const { hasPermission: canAssignIssue } = usePermissionGuard('issues.assign');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(issue.title);
  const [priority, setPriority] = useState(issue.priority?.name || 'medium');
  const [storyPoints, setStoryPoints] = useState<string>(
    issue.storyPoints?.toString() || ''
  );
  const [assigneeId, setAssigneeId] = useState<string>(issue.assignee?.id || '');
  const [dueDate, setDueDate] = useState<string>(
    issue.dueDate ? issue.dueDate.split('T')[0] : ''
  );

  const [updateIssue, { isLoading }] = useUpdateIssueMutation();
  const { data: membersData } = useGetProjectMembersQuery(projectId, {
    skip: !open,
  });

  const handleSave = async () => {
    try {
      const updateData: Record<string, any> = {
        title: title !== issue.title ? title : undefined,
        priorityId: priority !== issue.priority?.name ? priority : undefined,
        storyPoints: storyPoints !== issue.storyPoints?.toString()
          ? (storyPoints ? parseFloat(storyPoints) : undefined)
          : undefined,
        dueDate: dueDate !== issue.dueDate?.split('T')[0]
          ? (dueDate || undefined)
          : undefined,
      };

      if (canAssignIssue) {
        updateData.assigneeId = assigneeId !== issue.assignee?.id
          ? (assigneeId || undefined)
          : undefined;
      }

      await updateIssue({
        issueId: issue.id,
        data: updateData,
      }).unwrap();

      setOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to update issue:', error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Reset form values when opening
      setTitle(issue.title);
      setPriority(issue.priority?.name || 'medium');
      setStoryPoints(issue.storyPoints?.toString() || '');
      setAssigneeId(issue.assignee?.id || '');
      setDueDate(issue.dueDate ? issue.dueDate.split('T')[0] : '');
    }
    setOpen(newOpen);
  };

  if (!canUpdateIssue) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Quick Edit</h4>
            <span className="text-xs text-muted-foreground">{issue.issueKey}</span>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <User2 className="h-3 w-3" /> Assignee
            </Label>
            <Select value={assigneeId} onValueChange={setAssigneeId} disabled={!canAssignIssue}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {membersData?.map((member: any) => (
                  <SelectItem key={member.user.id} value={member.user.id}>
                    {member.user.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Flag className="h-3 w-3" /> Priority
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Story Points */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Hash className="h-3 w-3" /> Points
              </Label>
              <Select value={storyPoints} onValueChange={setStoryPoints}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {STORY_POINTS.map((sp) => (
                    <SelectItem key={sp} value={sp.toString()}>
                      {sp} SP
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Due Date
            </Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
