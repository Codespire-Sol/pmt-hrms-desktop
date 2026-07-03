import { useState } from 'react';
import { Plus, Search, MoreHorizontal, Edit, Trash2, Flag, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreatePriorityModal } from './CreatePriorityModal';
import { PriorityCard } from './PriorityCard';

export interface Priority {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  color?: string;
  level: number;
  createdAt: string;
}

interface PrioritiesSettingsProps {
  projectId: string;
  priorities: Priority[] | undefined;
  isLoading: boolean;
  error?: any;
  onCreate: (priority: CreatePriorityData) => void;
  onUpdate?: (id: string, priority: UpdatePriorityData) => void;
  onDelete?: (id: string) => void;
  disabled?: boolean;
}

export interface CreatePriorityData {
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  color?: string;
  level: number;
}

export interface UpdatePriorityData {
  name?: string;
  displayName?: string;
  description?: string;
  icon?: string;
  color?: string;
  level?: number;
}

export function PrioritiesSettings({
  projectId,
  priorities,
  isLoading,
  error,
  onCreate,
  onUpdate,
  onDelete,
  disabled,
}: PrioritiesSettingsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingPriority, setEditingPriority] = useState<Priority | null>(null);

  const sortedPriorities = priorities
    ?.filter(priority =>
      priority.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      priority.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => b.level - a.level) || [];

  const handleEdit = (priority: Priority) => {
    if (!onUpdate) return;
    setEditingPriority(priority);
  };

  const handleCreate = () => {
    setCreateModalOpen(true);
  };

  const handleDelete = (priority: Priority) => {
    if (!onDelete) return;
    if (window.confirm(`Are you sure you want to delete "${priority.displayName}"? This action cannot be undone.`)) {
      onDelete(priority.id);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load priorities. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Priorities</h3>
          <p className="text-sm text-muted-foreground">
            Manage priority levels for your project issues
          </p>
        </div>
        {!disabled && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Priority
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search priorities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          disabled={disabled}
        />
      </div>

      {/* Priorities List */}
      <div className="space-y-3">
        {isLoading ? (
          // Skeleton loaders
          [...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : sortedPriorities.length === 0 ? (
          // Empty state
          <Card>
            <CardContent className="p-12 text-center">
              <Flag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? 'No priorities found' : 'No priorities yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Create your first priority level to get started'
                }
              </p>
              {!searchQuery && !disabled && (
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Priority
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          // Priorities list
          sortedPriorities.map((priority) => (
            <PriorityCard
              key={priority.id}
              priority={priority}
              onEdit={!disabled && onUpdate ? () => handleEdit(priority) : undefined}
              onDelete={!disabled && onDelete ? () => handleDelete(priority) : undefined}
            />
          ))
        )}
      </div>

      {/* Create Modal */}
      <CreatePriorityModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        projectId={projectId}
        onSubmit={onCreate}
      />

      {/* Edit Modal */}
      {onUpdate && (
        <CreatePriorityModal
          open={!!editingPriority}
          onOpenChange={(open) => !open && setEditingPriority(null)}
          projectId={projectId}
          onSubmit={(data) => {
            if (editingPriority) {
              onUpdate(editingPriority.id, data);
              setEditingPriority(null);
            }
          }}
          initialData={editingPriority ? {
            name: editingPriority.name,
            displayName: editingPriority.displayName,
            description: editingPriority.description,
            icon: editingPriority.icon,
            color: editingPriority.color,
            level: editingPriority.level,
          } : undefined}
        />
      )}
    </div>
  );
}
