import { useState, useEffect } from 'react';
import {
  Filter,
  X,
  Calendar,
  Tag,
  Save,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/useToast';

export interface IssueFilters {
  status?: string[];
  priority?: string[];
  assigneeId?: string;
  labels?: string[];
  type?: string[];
  createdAfter?: string;
  createdBefore?: string;
  dueDateAfter?: string;
  dueDateBefore?: string;
  hasStoryPoints?: boolean;
  search?: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: IssueFilters;
  createdAt: string;
}

interface AdvancedFiltersProps {
  filters: IssueFilters;
  onFiltersChange: (filters: IssueFilters) => void;
  projectId: string;
}

const SAVED_FILTERS_KEY = 'projectflow_saved_filters';

const statusOptions = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'in-review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

const priorityOptions = [
  { value: 'highest', label: 'Highest' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'lowest', label: 'Lowest' },
];

const typeOptions = [
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'story', label: 'Story' },
  { value: 'epic', label: 'Epic' },
];

export function AdvancedFilters({ filters, onFiltersChange, projectId }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<string[]>(['status', 'priority']);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState('');

  // Load saved filters from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`${SAVED_FILTERS_KEY}_${projectId}`);
    if (stored) {
      try {
        setSavedFilters(JSON.parse(stored));
      } catch {
        // Ignore parse errors
      }
    }
  }, [projectId]);

  // Save filters to localStorage
  const saveSavedFilters = (filters: SavedFilter[]) => {
    localStorage.setItem(`${SAVED_FILTERS_KEY}_${projectId}`, JSON.stringify(filters));
    setSavedFilters(filters);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const handleMultiSelect = (key: keyof IssueFilters, value: string) => {
    const currentValues = (filters[key] as string[]) || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];
    onFiltersChange({ ...filters, [key]: newValues.length > 0 ? newValues : undefined });
  };

  const handleDateChange = (key: keyof IssueFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value || undefined });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const handleSaveFilter = () => {
    if (!filterName.trim()) {
      toast.error('Please enter a filter name');
      return;
    }

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterName.trim(),
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };

    saveSavedFilters([...savedFilters, newFilter]);
    setFilterName('');
    setSaveDialogOpen(false);
    toast.success('Filter saved');
  };

  const handleDeleteSavedFilter = (filterId: string) => {
    saveSavedFilters(savedFilters.filter((f) => f.id !== filterId));
    toast.success('Filter deleted');
  };

  const handleApplySavedFilter = (savedFilter: SavedFilter) => {
    onFiltersChange(savedFilter.filters);
    setIsOpen(false);
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Filters</h4>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear all
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {/* Saved Filters */}
            {savedFilters.length > 0 && (
              <div className="p-4 border-b">
                <Label className="text-xs text-muted-foreground uppercase">Saved Filters</Label>
                <div className="mt-2 space-y-1">
                  {savedFilters.map((sf) => (
                    <div
                      key={sf.id}
                      className="flex items-center justify-between group py-1 px-2 rounded hover:bg-muted/50"
                    >
                      <button
                        className="text-sm text-left flex-1"
                        onClick={() => handleApplySavedFilter(sf)}
                      >
                        {sf.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => handleDeleteSavedFilter(sf.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Filter */}
            <FilterSection
              title="Status"
              icon={<div className="h-3 w-3 rounded-full bg-blue-500" />}
              isExpanded={expandedSections.includes('status')}
              onToggle={() => toggleSection('status')}
            >
              <div className="space-y-2">
                {statusOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.status?.includes(option.value) || false}
                      onCheckedChange={() => handleMultiSelect('status', option.value)}
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </FilterSection>

            {/* Priority Filter */}
            <FilterSection
              title="Priority"
              icon={<div className="h-3 w-3 rounded-full bg-orange-500" />}
              isExpanded={expandedSections.includes('priority')}
              onToggle={() => toggleSection('priority')}
            >
              <div className="space-y-2">
                {priorityOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.priority?.includes(option.value) || false}
                      onCheckedChange={() => handleMultiSelect('priority', option.value)}
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </FilterSection>

            {/* Type Filter */}
            <FilterSection
              title="Type"
              icon={<Tag className="h-3 w-3" />}
              isExpanded={expandedSections.includes('type')}
              onToggle={() => toggleSection('type')}
            >
              <div className="space-y-2">
                {typeOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={filters.type?.includes(option.value) || false}
                      onCheckedChange={() => handleMultiSelect('type', option.value)}
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </FilterSection>

            {/* Date Filters */}
            <FilterSection
              title="Created Date"
              icon={<Calendar className="h-3 w-3" />}
              isExpanded={expandedSections.includes('created')}
              onToggle={() => toggleSection('created')}
            >
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">After</Label>
                  <Input
                    type="date"
                    value={filters.createdAfter || ''}
                    onChange={(e) => handleDateChange('createdAfter', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Before</Label>
                  <Input
                    type="date"
                    value={filters.createdBefore || ''}
                    onChange={(e) => handleDateChange('createdBefore', e.target.value)}
                  />
                </div>
              </div>
            </FilterSection>

            {/* Due Date Filters */}
            <FilterSection
              title="Due Date"
              icon={<Calendar className="h-3 w-3" />}
              isExpanded={expandedSections.includes('dueDate')}
              onToggle={() => toggleSection('dueDate')}
            >
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">After</Label>
                  <Input
                    type="date"
                    value={filters.dueDateAfter || ''}
                    onChange={(e) => handleDateChange('dueDateAfter', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Before</Label>
                  <Input
                    type="date"
                    value={filters.dueDateBefore || ''}
                    onChange={(e) => handleDateChange('dueDateBefore', e.target.value)}
                  />
                </div>
              </div>
            </FilterSection>
          </div>

          {/* Save Filter Button */}
          <div className="p-4 border-t">
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={activeFilterCount === 0}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Filter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Filter</DialogTitle>
                  <DialogDescription>
                    Save your current filters for quick access later.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label>Filter Name</Label>
                  <Input
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    placeholder="e.g., My high priority bugs"
                    className="mt-2"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveFilter}>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filter Tags */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {filters.status?.map((s) => (
            <Badge key={s} variant="secondary" className="gap-1">
              {statusOptions.find((o) => o.value === s)?.label || s}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleMultiSelect('status', s)}
              />
            </Badge>
          ))}
          {filters.priority?.map((p) => (
            <Badge key={p} variant="secondary" className="gap-1">
              {priorityOptions.find((o) => o.value === p)?.label || p}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleMultiSelect('priority', p)}
              />
            </Badge>
          ))}
          {filters.type?.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1">
              {typeOptions.find((o) => o.value === t)?.label || t}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleMultiSelect('type', t)}
              />
            </Badge>
          ))}
          {filters.createdAfter && (
            <Badge variant="secondary" className="gap-1">
              Created after {filters.createdAfter}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleDateChange('createdAfter', '')}
              />
            </Badge>
          )}
          {filters.dueDateBefore && (
            <Badge variant="secondary" className="gap-1">
              Due before {filters.dueDateBefore}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleDateChange('dueDateBefore', '')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

interface FilterSectionProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function FilterSection({ title, icon, isExpanded, onToggle, children }: FilterSectionProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export default AdvancedFilters;
