import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, GripVertical, Zap, Filter, Play } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { useToast } from '../../../components/ui/use-toast';
import {
  useGetRuleQuery,
  useCreateRuleMutation,
  useUpdateRuleMutation,
  useGetAvailableFieldsQuery,
  useGetTriggerTypesQuery,
  useGetActionTypesQuery,
  useGetConditionOperatorsQuery,
} from '../automationApi';
import {
  TRIGGER_LABELS,
  ACTION_LABELS,
  type TriggerType,
  type TriggerConfig,
  type Condition,
  type Action,
  type ActionType,
  type CreateAutomationRuleInput,
} from '../types';
import { TriggerConfigPanel } from './TriggerConfigPanel';
import { ConditionBuilder } from './ConditionBuilder';
import { ActionConfigPanel } from './ActionConfigPanel';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';
const createId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as Crypto).randomUUID()
    : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);

export function RuleBuilder() {
  const { projectId, ruleId } = useParams<{ projectId: string; ruleId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = !!ruleId && ruleId !== 'new';
  const { hasPermission: canManageAutomation } = usePermissionGuard('automation.manage');

  const { data: existingRule, isLoading: isLoadingRule } = useGetRuleQuery(ruleId!, {
    skip: !isEditing,
  });
  const { data: fields } = useGetAvailableFieldsQuery();
  const { data: triggerTypes } = useGetTriggerTypesQuery();
  const { data: actionTypes } = useGetActionTypesQuery();
  const { data: operators } = useGetConditionOperatorsQuery();

  const [createRule, { isLoading: isCreating }] = useCreateRuleMutation();
  const [updateRule, { isLoading: isUpdating }] = useUpdateRuleMutation();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('issue_created');
  const [triggerConfig, setTriggerConfig] = useState<TriggerConfig>({});
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [stopOnError, setStopOnError] = useState(true);

  // Load existing rule data
  useEffect(() => {
    if (existingRule) {
      setName(existingRule.name);
      setDescription(existingRule.description || '');
      setTriggerType(existingRule.triggerType);
      setTriggerConfig(existingRule.triggerConfig || {});
      setConditions(existingRule.conditions || []);
      setActions(existingRule.actions || []);
      setStopOnError(existingRule.stopOnError);
    }
  }, [existingRule]);

  if (!canManageAutomation) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Automation</CardTitle>
            <CardDescription>You don’t have permission to manage automation rules.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate(-1)}>
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      {
        id: createId(),
        field: 'status',
        operator: 'equals',
        value: '',
      },
    ]);
  };

  const handleUpdateCondition = (index: number, condition: Condition) => {
    const updated = [...conditions];
    updated[index] = condition;
    setConditions(updated);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleAddAction = () => {
    setActions([
      ...actions,
      {
        id: createId(),
        type: 'add_comment',
        config: {},
      },
    ]);
  };

  const handleUpdateAction = (index: number, action: Action) => {
    const updated = [...actions];
    updated[index] = action;
    setActions(updated);
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleActionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = actions.findIndex((a) => a.id === active.id);
      const newIndex = actions.findIndex((a) => a.id === over.id);
      setActions(arrayMove(actions, oldIndex, newIndex));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Validation error',
        description: 'Rule name is required.',
        variant: 'destructive',
      });
      return;
    }

    if (actions.length === 0) {
      toast({
        title: 'Validation error',
        description: 'At least one action is required.',
        variant: 'destructive',
      });
      return;
    }

    const input: CreateAutomationRuleInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      triggerType,
      triggerConfig,
      conditions: conditions.length > 0 ? conditions : undefined,
      actions,
      stopOnError,
    };

    try {
      if (isEditing) {
        await updateRule({ ruleId: ruleId!, input }).unwrap();
        toast({
          title: 'Rule updated',
          description: 'Your automation rule has been updated.',
        });
      } else {
        await createRule({ projectId: projectId!, input }).unwrap();
        toast({
          title: 'Rule created',
          description: 'Your automation rule has been created.',
        });
      }
      navigate(`/projects/${projectId}/automation`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.data?.error?.message || 'Failed to save rule.',
        variant: 'destructive',
      });
    }
  };

  if (isEditing && isLoadingRule) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{isEditing ? 'Edit Rule' : 'Create Automation Rule'}</h1>
          <p className="text-muted-foreground">
            Configure triggers, conditions, and actions for your automation
          </p>
        </div>
        <Button onClick={handleSave} disabled={isCreating || isUpdating}>
          <Save className="h-4 w-4 mr-2" />
          {isCreating || isUpdating ? 'Saving...' : 'Save Rule'}
        </Button>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Rule Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Auto-assign bugs to QA team"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this rule does..."
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={stopOnError} onCheckedChange={setStopOnError} id="stopOnError" />
            <Label htmlFor="stopOnError">Stop execution on first error</Label>
          </div>
        </CardContent>
      </Card>

      {/* Trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Trigger
          </CardTitle>
          <CardDescription>What event starts this automation?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Trigger Type</Label>
            <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRIGGER_LABELS).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TriggerConfigPanel
            triggerType={triggerType}
            config={triggerConfig}
            onChange={setTriggerConfig}
          />
        </CardContent>
      </Card>

      {/* Conditions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5 text-blue-500" />
                Conditions
              </CardTitle>
              <CardDescription>When should the rule run? (optional)</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddCondition}>
              <Plus className="h-4 w-4 mr-2" />
              Add Condition
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {conditions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No conditions - rule will run for all matching triggers
            </p>
          ) : (
            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <ConditionBuilder
                  key={condition.id}
                  condition={condition}
                  fields={fields || []}
                  operators={operators || []}
                  onChange={(c) => handleUpdateCondition(index, c)}
                  onRemove={() => handleRemoveCondition(index)}
                  showLogicalOperator={index > 0}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Play className="h-5 w-5 text-green-500" />
                Actions
              </CardTitle>
              <CardDescription>What should happen when conditions are met?</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleAddAction}>
              <Plus className="h-4 w-4 mr-2" />
              Add Action
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Add at least one action for this rule
            </p>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleActionDragEnd}>
              <SortableContext items={actions.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {actions.map((action, index) => (
                    <SortableActionItem
                      key={action.id}
                      action={action}
                      index={index}
                      actionTypes={actionTypes || []}
                      onChange={(a) => handleUpdateAction(index, a)}
                      onRemove={() => handleRemoveAction(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SortableActionItemProps {
  action: Action;
  index: number;
  actionTypes: { type: ActionType; description: string }[];
  onChange: (action: Action) => void;
  onRemove: () => void;
}

function SortableActionItem({ action, index, actionTypes, onChange, onRemove }: SortableActionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: action.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-4 bg-background">
      <div className="flex items-start gap-3">
        <div {...attributes} {...listeners} className="cursor-grab mt-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Action {index + 1}</span>
            <Button variant="ghost" size="icon" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Action Type</Label>
            <Select
              value={action.type}
              onValueChange={(v) => onChange({ ...action, type: v as ActionType, config: {} })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTION_LABELS).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ActionConfigPanel action={action} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}
