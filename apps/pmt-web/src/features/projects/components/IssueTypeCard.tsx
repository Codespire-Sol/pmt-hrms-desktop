import { GripVertical, MoreHorizontal, Edit, Trash2, Tag, Bug, CheckCircle2, HelpCircle, AlertCircle, MessageSquare, Zap, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface IssueType {
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

interface IssueTypeCardProps {
  issueType: IssueType;
  onEdit?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
}

const DEFAULT_ISSUE_TYPE_NAMES = new Set(['task', 'bug', 'story', 'improvement', 'subtask']);

const ICON_MAP: Record<string, any> = {
  Tag,
  Bug,
  CheckCircle2,
  HelpCircle,
  AlertCircle,
  MessageSquare,
  Zap,
  Play,
};

export function IssueTypeCard({ issueType, onEdit, onDelete, disabled }: IssueTypeCardProps) {
  const isDefault = DEFAULT_ISSUE_TYPE_NAMES.has(issueType.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: issueType.id,
    disabled: disabled
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative' as const,
  };

  const getIconComponent = (iconName?: string) => {
    return (iconName && ICON_MAP[iconName]) || Tag;
  };

  const Icon = getIconComponent(issueType.icon);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: isDragging ? 1 : 1.01, transition: { duration: 0.2 } }}
      className={`group ${isDragging ? 'opacity-50 grayscale scale-[1.02] rotate-1' : ''}`}
    >
      <Card className={`overflow-hidden border-border/50 group-hover:border-primary/20 hover:shadow-md transition-all duration-300 ${isDragging ? 'shadow-2xl border-primary ring-2 ring-primary/20' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <div
              className={cn(
                "opacity-20 transition-opacity p-1 -ml-1 rounded",
                !disabled ? "cursor-grab active:cursor-grabbing group-hover:opacity-100 hover:bg-muted" : "cursor-not-allowed opacity-10"
              )}
              style={{ touchAction: 'none' }}
              {...(!disabled ? attributes : {})}
              {...(!disabled ? listeners : {})}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Icon with Color */}
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 shadow-sm border border-border/10"
              style={{
                backgroundColor: issueType.color ? `${issueType.color}15` : '#f3f4f6',
                color: issueType.color || '#6b7280'
              }}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>

            {/* Issue Type Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium truncate">{issueType.displayName}</h4>
                <Badge
                  variant={issueType.isSubtask ? "secondary" : "default"}
                  className="text-xs"
                >
                  {issueType.isSubtask ? "Subtask" : "Issue"}
                </Badge>
              </div>
              {issueType.description && (
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {issueType.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Internal name: <code className="bg-muted px-1 py-0.5 rounded text-xs">{issueType.name}</code>
              </p>
            </div>

            {/* Actions — hidden for default system types */}
            {!isDefault && (onEdit || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
