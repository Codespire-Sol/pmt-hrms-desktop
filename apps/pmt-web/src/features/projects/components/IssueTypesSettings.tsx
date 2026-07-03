import { useState } from 'react';
import { Plus, Search, MoreHorizontal, GripVertical, Edit, Trash2, Tag } from 'lucide-react';
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
import { CreateIssueTypeModal } from './CreateIssueTypeModal';
import { IssueTypeCard } from './IssueTypeCard';
import { AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export interface IssueType {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  color?: string;
  isSubtask: boolean;
  position: number;
  createdAt: string;
}

interface IssueTypesSettingsProps {
  projectId: string;
  issueTypes: IssueType[] | undefined;
  isLoading: boolean;
  error?: any;
  onCreate: (type: CreateIssueTypeData) => void;
  onUpdate?: (id: string, type: UpdateIssueTypeData) => void;
  onDelete?: (id: string) => void;
  onReorder?: (types: IssueType[]) => void;
  disabled?: boolean;
}

export interface CreateIssueTypeData {
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  color?: string;
  isSubtask: boolean;
}

export interface UpdateIssueTypeData {
  name?: string;
  displayName?: string;
  description?: string;
  icon?: string;
  color?: string;
  isSubtask?: boolean;
}

export function IssueTypesSettings({
  projectId,
  issueTypes,
  isLoading,
  error,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
  disabled,
}: IssueTypesSettingsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<IssueType | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredTypes = issueTypes?.filter(type =>
    type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    type.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder || searchQuery) return;

    const oldIndex = filteredTypes.findIndex((t) => t.id === active.id);
    const newIndex = filteredTypes.findIndex((t) => t.id === over.id);

    const newOrder = arrayMove(filteredTypes, oldIndex, newIndex);
    onReorder(newOrder);
  };

  const handleEdit = (type: IssueType) => {
    if (!onUpdate) return;
    setEditingType(type);
  };

  const handleCreate = () => {
    setCreateModalOpen(true);
  };

  const handleDelete = (type: IssueType) => {
    if (!onDelete) return;
    if (window.confirm(`Are you sure you want to delete "${type.displayName}"? This action cannot be undone.`)) {
      onDelete(type.id);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load issue types. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Issue Types</h3>
          <p className="text-sm text-muted-foreground">
            Manage issue types for your project workflow
          </p>
        </div>
        {!disabled && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Issue Type
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search issue types..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          disabled={disabled}
        />
      </div>

      {/* Issue Types List */}
      <div className="space-y-3">
        {isLoading ? (
          // Skeleton loaders
          [...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredTypes.length === 0 ? (
          // Empty state
          <Card>
            <CardContent className="p-12 text-center">
              <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? 'No issue types found' : 'No issue types yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Create your first issue type to get started'
                }
              </p>
              {!searchQuery && !disabled && (
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Issue Type
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          // Issue types list
          <div className="space-y-3">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredTypes.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <AnimatePresence mode="popLayout">
                  {filteredTypes.map((type) => (
                    <IssueTypeCard
                      key={type.id}
                      issueType={type}
                      onEdit={!disabled && onUpdate ? () => handleEdit(type) : undefined}
                      onDelete={!disabled && onDelete ? () => handleDelete(type) : undefined}
                      disabled={disabled || !!searchQuery}
                    />
                  ))}
                </AnimatePresence>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateIssueTypeModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        projectId={projectId}
        onSubmit={onCreate}
      />

      {/* Edit Modal */}
      {onUpdate && (
        <CreateIssueTypeModal
          open={!!editingType}
          onOpenChange={(open) => !open && setEditingType(null)}
          projectId={projectId}
          onSubmit={(data) => {
            if (editingType) {
              onUpdate(editingType.id, data);
              setEditingType(null);
            }
          }}
          initialData={editingType ? {
            name: editingType.name,
            displayName: editingType.displayName,
            description: editingType.description,
            icon: editingType.icon,
            color: editingType.color,
            isSubtask: editingType.isSubtask,
          } : undefined}
        />
      )}
    </div>
  );
}
