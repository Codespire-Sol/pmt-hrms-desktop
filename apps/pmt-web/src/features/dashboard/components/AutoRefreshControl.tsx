import { RefreshCw, Settings2, Check } from 'lucide-react';
import { Button, Dropdown, Menu, Switch, Typography, Space } from 'antd';
import type { AutoRefreshConfig } from '../hooks/useAutoRefresh';

const { Text } = Typography;

interface AutoRefreshControlProps {
  config: AutoRefreshConfig;
  onToggle: () => void;
  onIntervalChange: (interval: number) => void;
  intervalOptions: { label: string; value: number }[];
  onManualRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: Date;
}

// Design System Constants from .cursorrules
const COLORS = {
  primary: '#1268ff',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
};

export function AutoRefreshControl({
  config,
  onToggle,
  onIntervalChange,
  intervalOptions,
  onManualRefresh,
  isRefreshing,
  lastUpdated,
}: AutoRefreshControlProps) {
  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const menu = (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 12px 24px rgba(16, 24, 40, 0.08)',
      padding: '8px',
      minWidth: '220px',
      border: `1px solid ${COLORS.border}`
    }}>
      <div style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: '14px' }}>Auto-refresh</Text>
        <Switch
          size="small"
          checked={config.enabled}
          onChange={onToggle}
          style={{ backgroundColor: config.enabled ? COLORS.primary : undefined }}
        />
      </div>
      <div style={{ height: '1px', backgroundColor: COLORS.border, margin: '4px 0' }} />
      <div style={{ padding: '8px 12px 4px' }}>
        <Text style={{ fontSize: '12px', color: COLORS.textSecondary, fontWeight: 700, textTransform: 'uppercase' }}>Interval</Text>
      </div>
      {intervalOptions.map((option) => (
        <div
          key={option.value}
          onClick={() => onIntervalChange(option.value)}
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: config.interval === option.value ? 'rgba(18, 104, 255, 0.05)' : 'transparent',
            color: config.interval === option.value ? COLORS.primary : 'inherit'
          }}
          className="refresh-interval-item"
        >
          <Text style={{ fontSize: '13px', color: config.interval === option.value ? COLORS.primary : 'inherit' }}>{option.label}</Text>
          {config.interval === option.value && <Check size={14} color={COLORS.primary} strokeWidth={3} />}
        </div>
      ))}
      <style>{`
        .refresh-interval-item:hover {
          background-color: #f9fafb !important;
        }
      `}</style>
    </div>
  );

  return (
    <Space size={8}>
      {lastUpdated && (
        <Text style={{ fontSize: '12px', color: COLORS.textSecondary }} className="hidden sm:inline">
          Updated {formatLastUpdated(lastUpdated)}
        </Text>
      )}

      {onManualRefresh && (
        <Button
          type="text"
          icon={<RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} color={COLORS.textSecondary} />}
          onClick={onManualRefresh}
          disabled={isRefreshing}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      )}

      <Dropdown dropdownRender={() => menu} trigger={['click']} placement="bottomRight">
        <span>
          <Button
            style={{
              height: '36px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderColor: config.enabled ? COLORS.primary : COLORS.border,
              color: config.enabled ? COLORS.primary : COLORS.textSecondary,
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            <RefreshCw size={14} className={config.enabled ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">
              {config.enabled
                ? `${intervalOptions.find((o) => o.value === config.interval)?.label}`
                : 'Auto-refresh off'}
            </span>
            <Settings2 size={14} />
          </Button>
        </span>
      </Dropdown>
    </Space>
  );
}
