import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Checkbox } from '../../../components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../components/ui/accordion';
import { useToast } from '../../../components/ui/use-toast';
import { useCreateWebhookMutation, useUpdateWebhookMutation } from '../webhooksApi';
import {
  EVENT_CATEGORIES,
  EVENT_LABELS,
  type WebhookWithCreator,
  type WebhookEventType,
  type HttpMethod,
  type PayloadFormat,
} from '../types';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  url: z.string().url('Please enter a valid URL'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  secret: z.string().max(500).optional(),
  events: z.array(z.string()).min(1, 'Select at least one event'),
  maxRetries: z.number().int().min(0).max(10),
  retryDelaySeconds: z.number().int().min(10).max(3600),
  exponentialBackoff: z.boolean(),
  payloadFormat: z.enum(['json', 'form']),
  customPayload: z.string().max(10000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface WebhookFormDialogProps {
  projectId: string;
  webhook?: WebhookWithCreator;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WebhookFormDialog({
  projectId,
  webhook,
  open,
  onOpenChange,
}: WebhookFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!webhook;
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      url: '',
      method: 'POST',
      secret: '',
      events: [],
      maxRetries: 3,
      retryDelaySeconds: 60,
      exponentialBackoff: true,
      payloadFormat: 'json',
      customPayload: '',
    },
  });

  const [createWebhook, { isLoading: isCreating }] = useCreateWebhookMutation();
  const [updateWebhook, { isLoading: isUpdating }] = useUpdateWebhookMutation();

  const selectedEvents = watch('events');

  useEffect(() => {
    if (webhook) {
      reset({
        name: webhook.name,
        description: webhook.description || '',
        url: webhook.url,
        method: webhook.method,
        secret: webhook.secret || '',
        events: webhook.events,
        maxRetries: webhook.maxRetries,
        retryDelaySeconds: webhook.retryDelaySeconds,
        exponentialBackoff: webhook.exponentialBackoff,
        payloadFormat: webhook.payloadFormat,
        customPayload: webhook.customPayload || '',
      });
      setHeaders(
        Object.entries(webhook.headers || {}).map(([key, value]) => ({ key, value }))
      );
    } else {
      reset({
        name: '',
        description: '',
        url: '',
        method: 'POST',
        secret: '',
        events: [],
        maxRetries: 3,
        retryDelaySeconds: 60,
        exponentialBackoff: true,
        payloadFormat: 'json',
        customPayload: '',
      });
      setHeaders([]);
    }
  }, [webhook, reset]);

  const toggleEvent = (event: WebhookEventType, checked: boolean) => {
    const current = selectedEvents || [];
    if (checked) {
      setValue('events', [...current, event]);
    } else {
      setValue(
        'events',
        current.filter((e) => e !== event)
      );
    }
  };

  const toggleCategory = (categoryEvents: WebhookEventType[], checked: boolean) => {
    const current = selectedEvents || [];
    if (checked) {
      const newEvents = [...new Set([...current, ...categoryEvents])];
      setValue('events', newEvents);
    } else {
      setValue(
        'events',
        current.filter((e) => !categoryEvents.includes(e as WebhookEventType))
      );
    }
  };

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...headers];
    updated[index][field] = value;
    setHeaders(updated);
  };

  const onSubmit = async (data: FormValues) => {
    const headersObj = headers.reduce(
      (acc, { key, value }) => {
        if (key.trim()) {
          acc[key.trim()] = value;
        }
        return acc;
      },
      {} as Record<string, string>
    );

    try {
      if (isEditing) {
        await updateWebhook({
          webhookId: webhook.id,
          input: {
            ...data,
            headers: headersObj,
          } as any,
        }).unwrap();
        toast({
          title: 'Webhook updated',
          description: 'Your webhook has been updated.',
        });
      } else {
        await createWebhook({
          projectId,
          input: {
            ...data,
            headers: headersObj,
          } as any,
        }).unwrap();
        toast({
          title: 'Webhook created',
          description: 'Your webhook has been created.',
        });
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.data?.error?.message || 'Failed to save webhook.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your webhook configuration'
              : 'Configure a new webhook to receive event notifications'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="e.g., Slack notifications"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="What does this webhook do?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-3 space-y-2">
                <Label htmlFor="url">Payload URL *</Label>
                <Input
                  id="url"
                  {...register('url')}
                  placeholder="https://example.com/webhook"
                />
                {errors.url && (
                  <p className="text-sm text-destructive">{errors.url.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <Select
                  value={watch('method')}
                  onValueChange={(v) => setValue('method', v as HttpMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Events */}
          <div className="space-y-2">
            <Label>Events *</Label>
            <p className="text-sm text-muted-foreground">
              Select which events will trigger this webhook
            </p>
            {errors.events && (
              <p className="text-sm text-destructive">{errors.events.message}</p>
            )}
            <Accordion type="multiple" className="border rounded-lg">
              {Object.entries(EVENT_CATEGORIES).map(([key, { label, events }]) => {
                const allSelected = events.every((e) => selectedEvents?.includes(e));
                const someSelected =
                  events.some((e) => selectedEvents?.includes(e)) && !allSelected;

                return (
                  <AccordionItem key={key} value={key}>
                    <AccordionTrigger className="px-4">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={allSelected}
                          ref={(ref) => {
                            if (ref) {
                              (ref as any).indeterminate = someSelected;
                            }
                          }}
                          onCheckedChange={(checked) => toggleCategory(events, !!checked)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span>{label}</span>
                        <span className="text-xs text-muted-foreground">
                          ({events.filter((e) => selectedEvents?.includes(e)).length}/{events.length})
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="grid grid-cols-2 gap-2">
                        {events.map((event) => (
                          <div key={event} className="flex items-center gap-2">
                            <Checkbox
                              id={event}
                              checked={selectedEvents?.includes(event)}
                              onCheckedChange={(checked) => toggleEvent(event, !!checked)}
                            />
                            <Label htmlFor={event} className="text-sm font-normal">
                              {EVENT_LABELS[event]}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          {/* Advanced Settings */}
          <Accordion type="single" collapsible>
            <AccordionItem value="advanced">
              <AccordionTrigger>Advanced Settings</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {/* Secret */}
                <div className="space-y-2">
                  <Label htmlFor="secret">Secret</Label>
                  <Input
                    id="secret"
                    type="password"
                    {...register('secret')}
                    placeholder="Used to sign payloads for verification"
                  />
                  <p className="text-xs text-muted-foreground">
                    If set, payloads will include an X-Webhook-Signature header
                  </p>
                </div>

                {/* Headers */}
                <div className="space-y-2">
                  <Label>Custom Headers</Label>
                  {headers.map((header, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Header name"
                        value={header.key}
                        onChange={(e) => updateHeader(index, 'key', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Value"
                        value={header.value}
                        onChange={(e) => updateHeader(index, 'value', e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHeader(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addHeader}>
                    Add Header
                  </Button>
                </div>

                {/* Retry Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxRetries">Max Retries</Label>
                    <Input
                      id="maxRetries"
                      type="number"
                      min={0}
                      max={10}
                      {...register('maxRetries', { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retryDelaySeconds">Retry Delay (seconds)</Label>
                    <Input
                      id="retryDelaySeconds"
                      type="number"
                      min={10}
                      max={3600}
                      {...register('retryDelaySeconds', { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={watch('exponentialBackoff')}
                    onCheckedChange={(v) => setValue('exponentialBackoff', v)}
                    id="exponentialBackoff"
                  />
                  <Label htmlFor="exponentialBackoff">Use exponential backoff</Label>
                </div>

                {/* Payload Format */}
                <div className="space-y-2">
                  <Label>Payload Format</Label>
                  <Select
                    value={watch('payloadFormat')}
                    onValueChange={(v) => setValue('payloadFormat', v as PayloadFormat)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON (application/json)</SelectItem>
                      <SelectItem value="form">Form (application/x-www-form-urlencoded)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Payload */}
                <div className="space-y-2">
                  <Label htmlFor="customPayload">Custom Payload Template</Label>
                  <Textarea
                    id="customPayload"
                    {...register('customPayload')}
                    placeholder='{"event": "{{event}}", "data": {{data}}}'
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {'{{field}}'} syntax to interpolate values. Leave empty for default payload.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
