import { useState } from 'react';
import { Badge, Popover, Button, List, Tag, Empty } from 'antd';
import { Bell, X } from 'lucide-react';
import type { BudgetAlert } from '../types';
import { useMarkAlertsReadMutation } from '../financialApi';

interface Props {
  projectId: string;
  alerts: BudgetAlert[];
}

const ALERT_CONFIG = {
  warning: { color: '#f59e0b', bg: '#fffbeb', label: 'Warning' },
  critical: { color: '#ef4444', bg: '#fef2f2', label: 'Critical' },
  exceeded: { color: '#dc2626', bg: '#fef2f2', label: 'Exceeded' },
  resource_overrun: { color: '#8b5cf6', bg: '#f5f3ff', label: 'Overrun' },
};

function AlertItem({ alert }: { alert: BudgetAlert }) {
  const cfg = ALERT_CONFIG[alert.alertType] ?? ALERT_CONFIG.warning;
  const spent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(alert.currentSpend);
  const budget = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(alert.totalBudget);
  const date = new Date(alert.triggeredAt).toLocaleDateString();
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        backgroundColor: alert.isRead ? '#fafafa' : cfg.bg,
        border: `1px solid ${alert.isRead ? '#f0f0f0' : cfg.color + '40'}`,
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Tag
          style={{
            backgroundColor: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.color}30`,
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 11,
          }}
        >
          {cfg.label}
        </Tag>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{date}</span>
      </div>
      <div style={{ fontSize: 13, color: '#374151' }}>
        Budget {alert.thresholdPercent.toFixed(0)}% threshold reached
      </div>
      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
        Spent {spent} of {budget} ({Number(alert.currentSpend / alert.totalBudget * 100).toFixed(1)}%)
      </div>
    </div>
  );
}

export function BudgetAlertsBadge({ projectId, alerts }: Props) {
  const [open, setOpen] = useState(false);
  const [markRead] = useMarkAlertsReadMutation();
  const unread = alerts.filter((a) => !a.isRead).length;

  const handleMarkRead = async () => {
    await markRead(projectId);
  };

  const content = (
    <div style={{ width: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#101828' }}>Budget Alerts</span>
        {unread > 0 && (
          <Button size="small" type="link" onClick={handleMarkRead} style={{ padding: 0, fontSize: 12 }}>
            Mark all read
          </Button>
        )}
      </div>
      {alerts.length === 0 ? (
        <Empty description="No alerts" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '16px 0' }} />
      ) : (
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {alerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={(v) => { setOpen(v); if (v && unread > 0) handleMarkRead(); }}
      placement="bottomRight"
      overlayInnerStyle={{ padding: 16, borderRadius: 12 }}
    >
      <Badge count={unread} size="small">
        <Button
          icon={<Bell size={18} />}
          style={{
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 36,
            width: 36,
            padding: 0,
            border: unread > 0 ? '1px solid #f59e0b' : '1px solid #e5e7eb',
            color: unread > 0 ? '#f59e0b' : '#6b7280',
          }}
        />
      </Badge>
    </Popover>
  );
}
