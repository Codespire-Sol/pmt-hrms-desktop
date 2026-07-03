import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Plus,
  Search,
  MoreHorizontal,
  Webhook,
  Trash2,
  History,
  Send,
  CheckCircle,
  XCircle,
  Globe,
  Settings2,
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
  useGetWebhooksQuery,
  useToggleWebhookMutation,
  useDeleteWebhookMutation,
  useTestWebhookMutation,
} from '../webhooksApi';
import { WebhookFormDialog } from './WebhookFormDialog';
import { DeliveryHistoryDialog } from './DeliveryHistoryDialog';
import { EVENT_LABELS, type WebhookWithCreator } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

export function WebhooksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { toast } = useToast();
  const { hasPermission: canUpdateProject } = usePermissionGuard('projects.update');
  const { hasPermission: canDeleteProject } = usePermissionGuard('projects.delete');

  const [search, setSearch] = useState('');
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [page, setPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editWebhook, setEditWebhook] = useState<WebhookWithCreator | null>(null);
  const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null);
  const [historyWebhookId, setHistoryWebhookId] = useState<string | null>(null);

  const { data, isLoading } = useGetWebhooksQuery({
    projectId: projectId!,
    search: search || undefined,
    isEnabled: enabledFilter === 'all' ? undefined : enabledFilter === 'enabled',
    page,
    limit: 20,
  });

  const [toggleWebhook] = useToggleWebhookMutation();
  const [deleteWebhook] = useDeleteWebhookMutation();
  const [testWebhook] = useTestWebhookMutation();

  const handleToggle = async (webhook: WebhookWithCreator) => {
    try {
      await toggleWebhook({ webhookId: webhook.id, isEnabled: !webhook.isEnabled }).unwrap();
      toast({
        title: webhook.isEnabled ? 'Webhook disabled' : 'Webhook enabled',
        description: `"${webhook.name}" has been ${webhook.isEnabled ? 'disabled' : 'enabled'}.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle webhook status.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteWebhookId) return;
    try {
      await deleteWebhook(deleteWebhookId).unwrap();
      toast({
        title: 'Webhook deleted',
        description: 'The webhook has been deleted.',
      });
      setDeleteWebhookId(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete webhook.',
        variant: 'destructive',
      });
    }
  };

  const handleTest = async (webhook: WebhookWithCreator) => {
    try {
      await testWebhook(webhook.id).unwrap();
      toast({
        title: 'Test sent',
        description: 'A test delivery has been triggered.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send test webhook.',
        variant: 'destructive',
      });
    }
  };

  const getSuccessRate = (webhook: WebhookWithCreator) => {
    if (webhook.totalDeliveries === 0) return null;
    return Math.round((webhook.successfulDeliveries / webhook.totalDeliveries) * 100);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground">
            Send event notifications to external services
          </p>
        </div>
        {canUpdateProject && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Webhook
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search webhooks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
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
          ) : data?.webhooks.length === 0 ? (
            <div className="text-center py-12">
              <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No webhooks configured</h3>
              <p className="text-muted-foreground mb-4">
                Add a webhook to send notifications to external services.
              </p>
              {canUpdateProject && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Webhook
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {data?.webhooks.map((webhook) => (
                <WebhookCard
                  key={webhook.id}
                  webhook={webhook}
                  onToggle={() => handleToggle(webhook)}
                  onEdit={() => setEditWebhook(webhook)}
                  onDelete={() => setDeleteWebhookId(webhook.id)}
                  onTest={() => handleTest(webhook)}
                  onViewHistory={() => setHistoryWebhookId(webhook.id)}
                  successRate={getSuccessRate(webhook)}
                  canUpdateProject={canUpdateProject}
                  canDeleteProject={canDeleteProject}
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

      {/* Create Dialog */}
      <WebhookFormDialog
        projectId={projectId!}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Edit Dialog */}
      {editWebhook && (
        <WebhookFormDialog
          projectId={projectId!}
          webhook={editWebhook}
          open={!!editWebhook}
          onOpenChange={(open) => !open && setEditWebhook(null)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteWebhookId} onOpenChange={() => setDeleteWebhookId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The webhook and its delivery history will be permanently
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

      {/* Delivery History */}
      {historyWebhookId && (
        <DeliveryHistoryDialog
          webhookId={historyWebhookId}
          open={!!historyWebhookId}
          onOpenChange={() => setHistoryWebhookId(null)}
        />
      )}
    </div>
  );
}

interface WebhookCardProps {
  webhook: WebhookWithCreator;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onViewHistory: () => void;
  successRate: number | null;
  canUpdateProject: boolean;
  canDeleteProject: boolean;
}

function WebhookCard({
  webhook,
  onToggle,
  onEdit,
  onDelete,
  onTest,
  onViewHistory,
  successRate,
  canUpdateProject,
  canDeleteProject,
}: WebhookCardProps) {
  return (
    <div
      className={`border rounded-lg p-4 transition-colors ${
        webhook.isEnabled ? 'bg-background' : 'bg-muted/50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h3
              className="font-medium truncate cursor-pointer hover:text-primary"
              onClick={onEdit}
            >
              {webhook.name}
            </h3>
            <Badge variant={webhook.isEnabled ? 'default' : 'secondary'}>
              {webhook.isEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
            <Badge variant="outline">{webhook.method}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-2 truncate">{webhook.url}</p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{webhook.events.length} event{webhook.events.length !== 1 ? 's' : ''}</span>
            {webhook.totalDeliveries > 0 && (
              <>
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  {webhook.successfulDeliveries}
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  {webhook.failedDeliveries}
                </span>
                {successRate !== null && (
                  <span
                    className={
                      successRate >= 90
                        ? 'text-green-600'
                        : successRate >= 70
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }
                  >
                    {successRate}% success
                  </span>
                )}
              </>
            )}
            {webhook.lastDeliveryAt && (
              <span className="text-xs">
                Last delivery{' '}
                {formatDistanceToNow(new Date(webhook.lastDeliveryAt), { addSuffix: true })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {webhook.events.slice(0, 3).map((event) => (
              <Badge key={event} variant="outline" className="text-xs">
                {EVENT_LABELS[event]}
              </Badge>
            ))}
            {webhook.events.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{webhook.events.length - 3} more
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Switch
            checked={webhook.isEnabled}
            onCheckedChange={onToggle}
            disabled={!canUpdateProject}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canUpdateProject && (
                <DropdownMenuItem onClick={onEdit}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {canUpdateProject && (
                <DropdownMenuItem onClick={onTest}>
                  <Send className="h-4 w-4 mr-2" />
                  Send test
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onViewHistory}>
                <History className="h-4 w-4 mr-2" />
                Delivery history
              </DropdownMenuItem>
              {canDeleteProject && (
                <>
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
