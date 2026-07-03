import { useState } from 'react';
import { useGetAuditLogsQuery, useGetAuditLogFiltersQuery } from '../rbacApi';
import { AuditLog, AuditLogFilters } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { History, Eye, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow, format } from 'date-fns';

function AuditLogDetailDialog({
  log,
  open,
  onOpenChange,
}: {
  log: AuditLog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Audit Log Details
          </DialogTitle>
          <DialogDescription>
            {format(new Date(log.createdAt), 'PPpp')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info */}
          {log.user && (
            <div>
              <h4 className="font-medium mb-2">User</h4>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {log.user.displayName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{log.user.displayName}</p>
                  <p className="text-sm text-muted-foreground">{log.user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Action</h4>
              <Badge variant="outline">{log.action}</Badge>
            </div>
            <div>
              <h4 className="font-medium mb-2">Entity Type</h4>
              <Badge variant="secondary">{log.entityType}</Badge>
            </div>
          </div>

          {/* Entity ID */}
          {log.entityId && (
            <div>
              <h4 className="font-medium mb-2">Entity ID</h4>
              <code className="text-sm bg-muted px-2 py-1 rounded">{log.entityId}</code>
            </div>
          )}

          {/* Old Values */}
          {log.oldValues && Object.keys(log.oldValues).length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Previous Values</h4>
              <pre className="text-sm bg-muted p-3 rounded overflow-x-auto">
                {JSON.stringify(log.oldValues, null, 2)}
              </pre>
            </div>
          )}

          {/* New Values */}
          {log.newValues && Object.keys(log.newValues).length > 0 && (
            <div>
              <h4 className="font-medium mb-2">New Values</h4>
              <pre className="text-sm bg-muted p-3 rounded overflow-x-auto">
                {JSON.stringify(log.newValues, null, 2)}
              </pre>
            </div>
          )}

          {/* Metadata */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Metadata</h4>
              <pre className="text-sm bg-muted p-3 rounded overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* IP Address */}
          {log.ipAddress && (
            <div>
              <h4 className="font-medium mb-2">IP Address</h4>
              <code className="text-sm bg-muted px-2 py-1 rounded">{log.ipAddress}</code>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const getActionColor = (action: string): string => {
  if (action.includes('create') || action.includes('add')) return 'bg-green-500';
  if (action.includes('delete') || action.includes('remove')) return 'bg-red-500';
  if (action.includes('update') || action.includes('edit')) return 'bg-blue-500';
  if (action.includes('login') || action.includes('auth')) return 'bg-purple-500';
  return 'bg-gray-500';
};

export function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 20,
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: logsData, isLoading: isLoadingLogs } = useGetAuditLogsQuery(filters);
  const { data: filtersData } = useGetAuditLogFiltersQuery();

  const logs = logsData?.data.logs || [];
  const pagination = logsData?.data.pagination;
  const availableFilters = filtersData?.data;

  const updateFilter = (key: keyof AuditLogFilters, value: string | number | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key !== 'page' ? 1 : (value as number),
    }));
  };

  const clearFilters = () => {
    setFilters({ page: 1, limit: 20 });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">
          View system activity and track changes across the platform.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity History
          </CardTitle>
          <CardDescription>
            Filter and browse audit logs to track user activity and system changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <Select
              value={filters.action || 'all'}
              onValueChange={(v) => updateFilter('action', v !== 'all' ? v : undefined)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {availableFilters?.actions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.entityType || 'all'}
              onValueChange={(v) => updateFilter('entityType', v !== 'all' ? v : undefined)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {availableFilters?.entityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="Start date"
              value={filters.startDate || ''}
              onChange={(e) => updateFilter('startDate', e.target.value || undefined)}
              className="w-[180px]"
            />

            <Input
              type="date"
              placeholder="End date"
              value={filters.endDate || ''}
              onChange={(e) => updateFilter('endDate', e.target.value || undefined)}
              className="w-[180px]"
            />

            {(filters.action || filters.entityType || filters.startDate || filters.endDate) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <Filter className="h-4 w-4 mr-1" />
                Clear filters
              </Button>
            )}
          </div>

          {/* Logs Table */}
          {isLoadingLogs ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No audit logs found matching your criteria.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {log.user ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {log.user.displayName
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{log.user.displayName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">System</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionColor(log.action)}>{log.action}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.entityType}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {log.ipAddress || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => updateFilter('page', pagination.page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === pagination.totalPages}
                      onClick={() => updateFilter('page', pagination.page + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Log Detail Dialog */}
      {selectedLog && (
        <AuditLogDetailDialog
          log={selectedLog}
          open={!!selectedLog}
          onOpenChange={(open) => !open && setSelectedLog(null)}
        />
      )}
    </div>
  );
}
