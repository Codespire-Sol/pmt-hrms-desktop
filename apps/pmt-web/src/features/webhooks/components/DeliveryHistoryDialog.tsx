import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { useToast } from '../../../components/ui/use-toast';
import { useGetDeliveriesQuery, useRetryDeliveryMutation } from '../webhooksApi';
import {
  EVENT_LABELS,
  DELIVERY_STATUS_LABELS,
  type WebhookDelivery,
  type DeliveryStatus,
} from '../types';
import { formatDistanceToNow, format } from 'date-fns';

interface DeliveryHistoryDialogProps {
  webhookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeliveryHistoryDialog({
  webhookId,
  open,
  onOpenChange,
}: DeliveryHistoryDialogProps) {
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useGetDeliveriesQuery({
    webhookId,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    page,
    limit: 10,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Delivery History</DialogTitle>
          <DialogDescription>View recent webhook deliveries and their status</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as DeliveryStatus | 'all');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="retrying">Retrying</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-auto space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : data?.deliveries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No deliveries found
            </div>
          ) : (
            data?.deliveries.map((delivery) => (
              <DeliveryCard key={delivery.id} delivery={delivery} />
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

function DeliveryCard({ delivery }: { delivery: WebhookDelivery }) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const [retryDelivery, { isLoading: isRetrying }] = useRetryDeliveryMutation();

  const handleRetry = async () => {
    try {
      await retryDelivery(delivery.id).unwrap();
      toast({
        title: 'Retry initiated',
        description: 'The delivery is being retried.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to retry delivery.',
        variant: 'destructive',
      });
    }
  };

  const statusConfig: Record<
    DeliveryStatus,
    { icon: React.ReactNode; color: string; bgColor: string }
  > = {
    success: {
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    failed: {
      icon: <XCircle className="h-4 w-4" />,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    retrying: {
      icon: <RefreshCw className="h-4 w-4 animate-spin" />,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    pending: {
      icon: <Clock className="h-4 w-4" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
  };

  const config = statusConfig[delivery.status];

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
                  <Badge variant="outline">{EVENT_LABELS[delivery.eventType]}</Badge>
                  <Badge
                    variant="outline"
                    className={`${config.color} ${config.bgColor} border-0`}
                  >
                    {DELIVERY_STATUS_LABELS[delivery.status]}
                  </Badge>
                  {delivery.responseStatusCode && (
                    <Badge
                      variant="outline"
                      className={
                        delivery.responseStatusCode >= 200 && delivery.responseStatusCode < 300
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {delivery.responseStatusCode}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(delivery.createdAt), 'MMM d, HH:mm:ss')} (
                  {formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true })})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {delivery.durationMs && <span>{delivery.durationMs}ms</span>}
              <span>
                Attempt {delivery.attemptNumber}/{delivery.maxAttempts}
              </span>
              {delivery.status === 'retrying' && delivery.nextRetryAt && (
                <span className="text-xs">
                  Next retry:{' '}
                  {formatDistanceToNow(new Date(delivery.nextRetryAt), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t p-4 space-y-4 bg-muted/30">
            {/* Error Message */}
            {delivery.errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800 font-medium">Error</p>
                <p className="text-sm text-red-700">{delivery.errorMessage}</p>
              </div>
            )}

            {/* Request Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{delivery.requestMethod}</span>
                <span className="text-sm text-muted-foreground truncate flex-1">
                  {delivery.requestUrl}
                </span>
                <a
                  href={delivery.requestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Tabs for Headers, Payload, Response */}
            <Tabs defaultValue="payload" className="w-full">
              <TabsList>
                <TabsTrigger value="payload">Payload</TabsTrigger>
                <TabsTrigger value="headers">Headers Sent</TabsTrigger>
                {delivery.responseBody && <TabsTrigger value="response">Response</TabsTrigger>}
              </TabsList>

              <TabsContent value="payload">
                <pre className="text-xs bg-background p-3 rounded border overflow-auto max-h-48">
                  {JSON.stringify(delivery.payload, null, 2)}
                </pre>
              </TabsContent>

              <TabsContent value="headers">
                <pre className="text-xs bg-background p-3 rounded border overflow-auto max-h-48">
                  {JSON.stringify(delivery.headersSent, null, 2)}
                </pre>
              </TabsContent>

              {delivery.responseBody && (
                <TabsContent value="response">
                  <div className="space-y-2">
                    {delivery.responseHeaders && (
                      <div>
                        <p className="text-xs font-medium mb-1">Response Headers</p>
                        <pre className="text-xs bg-background p-2 rounded border overflow-auto max-h-24">
                          {JSON.stringify(delivery.responseHeaders, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium mb-1">Response Body</p>
                      <pre className="text-xs bg-background p-2 rounded border overflow-auto max-h-48">
                        {delivery.responseBody}
                      </pre>
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>

            {/* Retry Button */}
            {delivery.status === 'failed' && delivery.attemptNumber < delivery.maxAttempts && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
                Retry Now
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
