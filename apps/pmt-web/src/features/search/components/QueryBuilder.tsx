import { useState, useCallback } from 'react';
import { Plus, Trash2, GripVertical, ArrowDownUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { JQL_FIELDS, JQL_OPERATORS } from '../types';

interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface ConditionGroup {
  id: string;
  logicalOperator: 'AND' | 'OR';
  conditions: (Condition | ConditionGroup)[];
}

interface OrderByItem {
  field: string;
  direction: 'ASC' | 'DESC';
}

interface QueryBuilderProps {
  value: string;
  onChange: (jql: string) => void;
  className?: string;
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function QueryBuilder({ value, onChange, className }: QueryBuilderProps) {
  const [rootGroup, setRootGroup] = useState<ConditionGroup>(() => parseJQLToGroup(value));
  const [orderBy, setOrderBy] = useState<OrderByItem[]>([]);

  // Convert query builder state to JQL
  const buildJQL = useCallback((group: ConditionGroup): string => {
    const parts: string[] = [];

    for (const item of group.conditions) {
      if ('conditions' in item) {
        // Nested group
        const nestedJQL = buildJQL(item);
        if (nestedJQL) {
          parts.push(`(${nestedJQL})`);
        }
      } else {
        // Single condition
        if (item.field && item.operator && item.value) {
          const value = item.value.includes(' ') ? `"${item.value}"` : item.value;
          parts.push(`${item.field} ${item.operator} ${value}`);
        }
      }
    }

    return parts.join(` ${group.logicalOperator} `);
  }, []);

  // Update parent with JQL whenever state changes
  const updateJQL = useCallback((newGroup: ConditionGroup, newOrderBy: OrderByItem[] = orderBy) => {
    let jql = buildJQL(newGroup);

    if (newOrderBy.length > 0) {
      const orderPart = newOrderBy
        .map(o => `${o.field} ${o.direction}`)
        .join(', ');
      jql += ` ORDER BY ${orderPart}`;
    }

    onChange(jql.trim());
  }, [buildJQL, onChange, orderBy]);

  const addCondition = (groupId: string) => {
    const newCondition: Condition = {
      id: generateId(),
      field: '',
      operator: '=',
      value: '',
    };

    const updateGroup = (group: ConditionGroup): ConditionGroup => {
      if (group.id === groupId) {
        return { ...group, conditions: [...group.conditions, newCondition] };
      }
      return {
        ...group,
        conditions: group.conditions.map(item =>
          'conditions' in item ? updateGroup(item) : item
        ),
      };
    };

    const newRootGroup = updateGroup(rootGroup);
    setRootGroup(newRootGroup);
    updateJQL(newRootGroup);
  };

  const addGroup = (parentGroupId: string) => {
    const newGroup: ConditionGroup = {
      id: generateId(),
      logicalOperator: 'AND',
      conditions: [],
    };

    const updateGroup = (group: ConditionGroup): ConditionGroup => {
      if (group.id === parentGroupId) {
        return { ...group, conditions: [...group.conditions, newGroup] };
      }
      return {
        ...group,
        conditions: group.conditions.map(item =>
          'conditions' in item ? updateGroup(item) : item
        ),
      };
    };

    const newRootGroup = updateGroup(rootGroup);
    setRootGroup(newRootGroup);
    updateJQL(newRootGroup);
  };

  const updateCondition = (conditionId: string, updates: Partial<Condition>) => {
    const updateInGroup = (group: ConditionGroup): ConditionGroup => ({
      ...group,
      conditions: group.conditions.map(item => {
        if ('conditions' in item) {
          return updateInGroup(item);
        }
        if (item.id === conditionId) {
          return { ...item, ...updates };
        }
        return item;
      }),
    });

    const newRootGroup = updateInGroup(rootGroup);
    setRootGroup(newRootGroup);
    updateJQL(newRootGroup);
  };

  const removeCondition = (conditionId: string) => {
    const removeFromGroup = (group: ConditionGroup): ConditionGroup => ({
      ...group,
      conditions: group.conditions
        .filter(item => !('id' in item && !('conditions' in item) && item.id === conditionId))
        .map(item => ('conditions' in item ? removeFromGroup(item) : item)),
    });

    const newRootGroup = removeFromGroup(rootGroup);
    setRootGroup(newRootGroup);
    updateJQL(newRootGroup);
  };

  const removeGroup = (groupId: string) => {
    if (groupId === rootGroup.id) return; // Can't remove root group

    const removeFromGroup = (group: ConditionGroup): ConditionGroup => ({
      ...group,
      conditions: group.conditions
        .filter(item => !('conditions' in item && item.id === groupId))
        .map(item => ('conditions' in item ? removeFromGroup(item) : item)),
    });

    const newRootGroup = removeFromGroup(rootGroup);
    setRootGroup(newRootGroup);
    updateJQL(newRootGroup);
  };

  const toggleLogicalOperator = (groupId: string) => {
    const updateGroup = (group: ConditionGroup): ConditionGroup => {
      if (group.id === groupId) {
        return {
          ...group,
          logicalOperator: group.logicalOperator === 'AND' ? 'OR' : 'AND',
        };
      }
      return {
        ...group,
        conditions: group.conditions.map(item =>
          'conditions' in item ? updateGroup(item) : item
        ),
      };
    };

    const newRootGroup = updateGroup(rootGroup);
    setRootGroup(newRootGroup);
    updateJQL(newRootGroup);
  };

  const addOrderBy = () => {
    const newOrderBy = [...orderBy, { field: 'created', direction: 'DESC' as const }];
    setOrderBy(newOrderBy);
    updateJQL(rootGroup, newOrderBy);
  };

  const updateOrderBy = (index: number, updates: Partial<OrderByItem>) => {
    const newOrderBy = orderBy.map((item, i) => (i === index ? { ...item, ...updates } : item));
    setOrderBy(newOrderBy);
    updateJQL(rootGroup, newOrderBy);
  };

  const removeOrderBy = (index: number) => {
    const newOrderBy = orderBy.filter((_, i) => i !== index);
    setOrderBy(newOrderBy);
    updateJQL(rootGroup, newOrderBy);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Filter Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <ConditionGroupComponent
            group={rootGroup}
            isRoot={true}
            onAddCondition={addCondition}
            onAddGroup={addGroup}
            onUpdateCondition={updateCondition}
            onRemoveCondition={removeCondition}
            onRemoveGroup={removeGroup}
            onToggleOperator={toggleLogicalOperator}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Order By</CardTitle>
          <Button variant="outline" size="sm" onClick={addOrderBy}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </CardHeader>
        {orderBy.length > 0 && (
          <CardContent className="space-y-2">
            {orderBy.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={item.field}
                  onValueChange={(value) => updateOrderBy(index, { field: value })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {JQL_FIELDS.map((field) => (
                      <SelectItem key={field.name} value={field.name}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={item.direction}
                  onValueChange={(value) => updateOrderBy(index, { direction: value as 'ASC' | 'DESC' })}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASC">Ascending</SelectItem>
                    <SelectItem value="DESC">Descending</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeOrderBy(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

interface ConditionGroupComponentProps {
  group: ConditionGroup;
  isRoot: boolean;
  onAddCondition: (groupId: string) => void;
  onAddGroup: (parentGroupId: string) => void;
  onUpdateCondition: (conditionId: string, updates: Partial<Condition>) => void;
  onRemoveCondition: (conditionId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onToggleOperator: (groupId: string) => void;
}

function ConditionGroupComponent({
  group,
  isRoot,
  onAddCondition,
  onAddGroup,
  onUpdateCondition,
  onRemoveCondition,
  onRemoveGroup,
  onToggleOperator,
}: ConditionGroupComponentProps) {
  return (
    <div className={cn('space-y-2', !isRoot && 'ml-6 pl-4 border-l-2 border-muted')}>
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="cursor-pointer hover:bg-accent"
          onClick={() => onToggleOperator(group.id)}
        >
          {group.logicalOperator}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Click to toggle AND/OR
        </span>
        {!isRoot && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => onRemoveGroup(group.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {group.conditions.map((item) => (
        <div key={item.id}>
          {'conditions' in item ? (
            <ConditionGroupComponent
              group={item}
              isRoot={false}
              onAddCondition={onAddCondition}
              onAddGroup={onAddGroup}
              onUpdateCondition={onUpdateCondition}
              onRemoveCondition={onRemoveCondition}
              onRemoveGroup={onRemoveGroup}
              onToggleOperator={onToggleOperator}
            />
          ) : (
            <ConditionRow
              condition={item}
              onUpdate={(updates) => onUpdateCondition(item.id, updates)}
              onRemove={() => onRemoveCondition(item.id)}
            />
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddCondition(group.id)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Condition
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddGroup(group.id)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Group
        </Button>
      </div>
    </div>
  );
}

interface ConditionRowProps {
  condition: Condition;
  onUpdate: (updates: Partial<Condition>) => void;
  onRemove: () => void;
}

function ConditionRow({ condition, onUpdate, onRemove }: ConditionRowProps) {
  const selectedField = JQL_FIELDS.find(f => f.name === condition.field);

  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

      <Select
        value={condition.field}
        onValueChange={(value) => onUpdate({ field: value })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Select field" />
        </SelectTrigger>
        <SelectContent>
          {JQL_FIELDS.map((field) => (
            <SelectItem key={field.name} value={field.name}>
              <div className="flex items-center justify-between w-full">
                <span>{field.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{field.type}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={condition.operator}
        onValueChange={(value) => onUpdate({ operator: value })}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {JQL_OPERATORS.map((op) => (
            <SelectItem key={op.name} value={op.name}>
              {op.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder={getPlaceholder(selectedField?.type)}
        value={condition.value}
        onChange={(e) => onUpdate({ value: e.target.value })}
        className="flex-1"
      />

      <Button variant="ghost" size="icon" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function getPlaceholder(type?: string): string {
  switch (type) {
    case 'uuid':
      return 'Enter value or use function';
    case 'date':
      return 'e.g., 2024-01-01 or now()';
    case 'number':
      return 'Enter number';
    default:
      return 'Enter value';
  }
}

// Simple JQL parser for initialization
function parseJQLToGroup(jql: string): ConditionGroup {
  // For now, return an empty root group
  // A full parser would be complex; this is a basic implementation
  return {
    id: generateId(),
    logicalOperator: 'AND',
    conditions: [],
  };
}

export default QueryBuilder;
