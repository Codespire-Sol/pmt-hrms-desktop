import { LayoutGrid, List, CalendarDays, Calendar } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '../../../components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip';

export type BoardViewType = 'kanban' | 'list' | 'timeline' | 'calendar';

interface BoardViewSwitcherProps {
  currentView: BoardViewType;
  onViewChange: (view: BoardViewType) => void;
}

export function BoardViewSwitcher({ currentView, onViewChange }: BoardViewSwitcherProps) {
  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={currentView}
        onValueChange={(value) => value && onViewChange(value as BoardViewType)}
        className="bg-muted rounded-md p-1"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="kanban" aria-label="Kanban view" className="h-8 w-8 p-0">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Kanban View</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="list" aria-label="List view" className="h-8 w-8 p-0">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>List View</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="timeline" aria-label="Timeline view" className="h-8 w-8 p-0">
              <CalendarDays className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Timeline View</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="calendar" aria-label="Calendar view" className="h-8 w-8 p-0">
              <Calendar className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Calendar View</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  );
}
