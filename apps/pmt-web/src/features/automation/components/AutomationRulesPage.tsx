import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  MoreHorizontal,
  Play,
  Pause,
  Copy,
  Trash2,
  History,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { Badge } from '../../../components/ui/badge';
import { Switch } from '../../../components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog';
import { useToast } from '../../../components/ui/use-toast';
import {
  useGetRulesQuery,
  useToggleRuleMutation,
  useDeleteRuleMutation,
  useDuplicateRuleMutation,
  useTriggerRuleMutation,
} from '../automationApi';
import { TRIGGER_LABELS, type AutomationRuleWithCreator, type TriggerType } from '../types';
import { ExecutionHistoryDialog } from './ExecutionHistoryDialog';
import { formatDistanceToNow } from 'date-fns';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

export function AutomationRulesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission: canManageAutomation } = usePermissionGuard('automation.manage');

  const [search, setSearch] = useState('');
  const [triggerFilter, setTriggerFilter] = useState<TriggerType | 'all'>('all');
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [page, setPage] = useState(1);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);
  const [historyRuleId, setHistoryRuleId] = useState<string | null>(null);

  const { data, isLoading } = useGetRulesQuery({
    projectId: projectId!,
    search: search || undefined,
    triggerType: triggerFilter !== 'all' ? triggerFilter : undefined,
    isEnabled: enabledFilter === 'all' ? undefined : enabledFilter === 'enabled',
    page,
    limit: 20,
  });

  const [toggleRule] = useToggleRuleMutation();
  const [deleteRule] = useDeleteRuleMutation();
  const [duplicateRule] = useDuplicateRuleMutation();
  const [triggerRule] = useTriggerRuleMutation();

  const handleToggle = async (rule: AutomationRuleWithCreator) => {
    try {
      await toggleRule({ ruleId: rule.id, isEnabled: !rule.isEnabled }).unwrap();
      toast({
        title: rule.isEnabled ? 'Rule disabled' : 'Rule enabled',
        description: `"${rule.name}" has been ${rule.isEnabled ? 'disabled' : 'enabled'}.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle rule status.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteRuleId) return;
    try {
      await deleteRule(deleteRuleId).unwrap();
      toast({
        title: 'Rule deleted',
        description: 'The automation rule has been deleted.',
      });
      setDeleteRuleId(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete rule.',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (ruleId: string) => {
    try {
      await duplicateRule(ruleId).unwrap();
      toast({
        title: 'Rule duplicated',
        description: 'A copy of the rule has been created.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to duplicate rule.',
        variant: 'destructive',
      });
    }
  };

  const handleTriggerManually = async (rule: AutomationRuleWithCreator) => {
    if (rule.triggerType !== 'manual') {
      toast({
        title: 'Cannot trigger',
        description: 'Only manual rules can be triggered directly.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await triggerRule({ ruleId: rule.id }).unwrap();
      toast({
        title: 'Rule triggered',
        description: 'The rule has been triggered successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to trigger rule.',
        variant: 'destructive',
      });
    }
  };

  const getSuccessRate = (rule: AutomationRuleWithCreator) => {
    if (rule.executionCount === 0) return null;
    return Math.round((rule.successCount / rule.executionCount) * 100);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automation Rules</h1>
          <p className="text-muted-foreground">
            Automate repetitive tasks with custom rules
          </p>
        </div>
        {canManageAutomation && (
          <Button onClick={() => navigate(`/projects/${projectId}/automation/new`)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search rules..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={triggerFilter}
              onValueChange={(v) => setTriggerFilter(v as TriggerType | 'all')}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by trigger" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All triggers</SelectItem>
                {Object.entries(TRIGGER_LABELS).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={enabledFilter}
              onValueChange={(v) => setEnabledFilter(v as 'all' | 'enabled' | 'disabled')}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : data?.rules.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No automation rules</h3>
              <p className="text-muted-foreground mb-4">
                Create your first rule to automate tasks in this project.
              </p>
              {canManageAutomation && (
                <Button onClick={() => navigate(`/projects/${projectId}/automation/new`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Rule
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {data?.rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  canManage={canManageAutomation}
                  onToggle={() => handleToggle(rule)}
                  onEdit={() => navigate(`/projects/${projectId}/automation/${rule.id}`)}
                  onDelete={() => setDeleteRuleId(rule.id)}
                  onDuplicate={() => handleDuplicate(rule.id)}
                  onTrigger={() => handleTriggerManually(rule)}
                  onViewHistory={() => setHistoryRuleId(rule.id)}
                  successRate={getSuccessRate(rule)}
                />
              ))}
            </div>
          )}

          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteRuleId} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete automation rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The rule and its execution history will be permanently
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {historyRuleId && (
        <ExecutionHistoryDialog
          ruleId={historyRuleId}
          open={!!historyRuleId}
          onOpenChange={() => setHistoryRuleId(null)}
        />
      )}
    </div>
  );
}

interface RuleCardProps {
  rule: AutomationRuleWithCreator;
  canManage: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTrigger: () => void;
  onViewHistory: () => void;
  successRate: number | null;
}

function RuleCard({
  rule,
  canManage,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
  onTrigger,
  onViewHistory,
  successRate,
}: RuleCardProps) {
  return (
    <div
      className={`border rounded-lg p-4 transition-colors ${
        rule.isEnabled ? 'bg-background' : 'bg-muted/50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3
              className="font-medium truncate cursor-pointer hover:text-primary"
              onClick={onEdit}
            >
              {rule.name}
            </h3>
            <Badge variant={rule.isEnabled ? 'default' : 'secondary'}>
              {rule.isEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          {rule.description && (
            <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
              {rule.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5" />
              {TRIGGER_LABELS[rule.triggerType]}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}
            </span>
            {rule.executionCount > 0 && (
              <>
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  {rule.successCount}
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  {rule.failureCount}
                </span>
                {successRate !== null && (
                  <span
                    className={`flex items-center gap-1 ${
                      successRate >= 90
                        ? 'text-green-600'
                        : successRate >= 70
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {successRate}% success
                  </span>
                )}
              </>
            )}
            {rule.lastExecutedAt && (
              <span className="text-xs">
                Last run {formatDistanceToNow(new Date(rule.lastExecutedAt), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {canManage && <Switch checked={rule.isEnabled} onCheckedChange={onToggle} />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManage && <DropdownMenuItem onClick={onEdit}>Edit rule</DropdownMenuItem>}
              <DropdownMenuItem onClick={onViewHistory}>
                <History className="h-4 w-4 mr-2" />
                View history
              </DropdownMenuItem>
              {rule.triggerType === 'manual' && canManage && (
                <DropdownMenuItem onClick={onTrigger}>
                  <Play className="h-4 w-4 mr-2" />
                  Trigger now
                </DropdownMenuItem>
              )}
              {canManage && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
