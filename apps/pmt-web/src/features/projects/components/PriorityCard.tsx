import { MoreHorizontal, Edit, Trash2, Flag, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ICON_MAP } from './shared/IconPicker';

interface Priority {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  color?: string;
  level: number;
  createdAt: string;
}

interface PriorityCardProps {
  priority: Priority;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function PriorityCard({ priority, onEdit, onDelete }: PriorityCardProps) {
  const getLevelIcon = (level: number) => {
    if (level >= 80) return ArrowUp;
    if (level >= 60) return ArrowUp;
    if (level >= 40) return ArrowDown;
    return ArrowDown;
  };

  const getLevelColor = (level: number) => {
    if (level >= 80) return 'text-red-600';
    if (level >= 60) return 'text-orange-500';
    if (level >= 40) return 'text-yellow-500';
    return 'text-blue-500';
  };

  const LevelIcon = getLevelIcon(priority.level);
  const levelColor = getLevelColor(priority.level);
  const PriorityIcon = (priority.icon && ICON_MAP[priority.icon]) ? ICON_MAP[priority.icon] : Flag;

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Priority Icon with Color */}
          <div
            className="flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0"
            style={{
              backgroundColor: priority.color ? `${priority.color}20` : '#f3f4f6',
              color: priority.color || '#6b7280'
            }}
          >
            <PriorityIcon className="h-4 w-4" />
          </div>

          {/* Priority Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium truncate">{priority.displayName}</h4>
              <div className="flex items-center gap-1">
                <LevelIcon className={`h-3 w-3 ${levelColor}`} />
                <Badge variant="outline" className="text-xs">
                  Level {priority.level}
                </Badge>
              </div>
            </div>
            {priority.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {priority.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Internal name: <code className="bg-muted px-1 py-0.5 rounded text-xs">{priority.name}</code>
            </p>
          </div>

          {/* Actions */}
          {(onEdit || onDelete) && (
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
  );
}
