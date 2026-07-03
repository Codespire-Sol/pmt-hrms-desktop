import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../components/ui/collapsible';
import { useGetExecutionsQuery } from '../automationApi';
import type { AutomationRuleExecution, ExecutionStatus } from '../types';
import { formatDistanceToNow, format } from 'date-fns';

interface ExecutionHistoryDialogProps {
  ruleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExecutionHistoryDialog({ ruleId, open, onOpenChange }: ExecutionHistoryDialogProps) {
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useGetExecutionsQuery({
    ruleId,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    page,
    limit: 10,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Execution History</DialogTitle>
          <DialogDescription>View the execution history for this automation rule</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as ExecutionStatus | 'all');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failure">Failure</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-auto space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : data?.executions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No executions found
            </div>
          ) : (
            data?.executions.map((execution) => (
              <ExecutionCard key={execution.id} execution={execution} />
            ))
          )}
        </div>

        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4 border-t">
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
      </DialogContent>
    </Dialog>
  );
}

function ExecutionCard({ execution }: { execution: AutomationRuleExecution }) {
  const [isOpen, setIsOpen] = useState(false);

  const statusConfig: Record<ExecutionStatus, { icon: React.ReactNode; color: string; label: string }> = {
    success: { icon: <CheckCircle className="h-4 w-4" />, color: 'text-green-600', label: 'Success' },
    failure: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-600', label: 'Failed' },
    running: { icon: <Clock className="h-4 w-4 animate-spin" />, color: 'text-blue-600', label: 'Running' },
    pending: { icon: <Clock className="h-4 w-4" />, color: 'text-yellow-600', label: 'Pending' },
    skipped: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-gray-500', label: 'Skipped' },
  };

  const config = statusConfig[execution.status];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50">
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={config.color}>{config.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{config.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {format(new Date(execution.createdAt), 'MMM d, HH:mm:ss')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(execution.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {execution.durationMs && <span>{execution.durationMs}ms</span>}
              {execution.actionResults && (
                <span>
                  {execution.actionResults.filter((a) => a.success).length}/
                  {execution.actionResults.length} actions
                </span>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t p-3 space-y-4 bg-muted/30">
            {execution.errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800 font-medium">Error</p>
                <p className="text-sm text-red-700">{execution.errorMessage}</p>
              </div>
            )}

            {execution.conditionResults && execution.conditionResults.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Condition Results</h4>
                <div className="space-y-1">
                  {execution.conditionResults.map((condition, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 text-sm p-2 rounded ${
                        condition.passed ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      {condition.passed ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-600" />
                      )}
                      <span className="font-medium">{condition.field}</span>
                      <span className="text-muted-foreground">{condition.operator}</span>
                      <span className="font-mono text-xs bg-background px-1 rounded">
                        {JSON.stringify(condition.expectedValue)}
                      </span>
                      <span className="text-muted-foreground">actual:</span>
                      <span className="font-mono text-xs bg-background px-1 rounded">
                        {JSON.stringify(condition.actualValue)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {execution.actionResults && execution.actionResults.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Action Results</h4>
                <div className="space-y-1">
                  {execution.actionResults.map((action, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 text-sm p-2 rounded ${
                        action.success ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      {action.success ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-600" />
                      )}
                      <span className="font-medium">{action.type}</span>
                      {action.error && (
                        <span className="text-red-600 text-xs">{action.error}</span>
                      )}
                      {action.details && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {JSON.stringify(action.details)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
