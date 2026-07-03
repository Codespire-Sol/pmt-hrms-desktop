import { Card, Col, Row, Statistic, Tag, Tooltip } from 'antd';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle } from 'lucide-react';
import type { BudgetSummary } from '../types';

interface Props {
  summary: BudgetSummary;
}

const STATUS_CONFIG = {
  on_track: { color: '#10b981', label: 'On Track', bg: '#ecfdf5' },
  warning: { color: '#f59e0b', label: 'Warning', bg: '#fffbeb' },
  critical: { color: '#ef4444', label: 'Critical', bg: '#fef2f2' },
  exceeded: { color: '#dc2626', label: 'Exceeded', bg: '#fef2f2' },
  no_budget: { color: '#6b7280', label: 'No Budget Set', bg: '#f9fafb' },
};

function fmt(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

export function BudgetSummaryCards({ summary }: Props) {
  const cfg = STATUS_CONFIG[summary.status];
  const isOverBudget = summary.status === 'exceeded';

  const cards = [
    {
      title: 'Total Budget',
      value: fmt(summary.totalBudget, summary.currency),
      icon: <DollarSign size={20} color="#1268ff" />,
      bg: '#eff6ff',
      suffix: null,
    },
    {
      title: 'Amount Spent',
      value: fmt(summary.totalSpent, summary.currency),
      icon: isOverBudget
        ? <TrendingUp size={20} color="#dc2626" />
        : <TrendingUp size={20} color="#10b981" />,
      bg: isOverBudget ? '#fef2f2' : '#ecfdf5',
      suffix: (
        <Tag color={cfg.color} style={{ marginLeft: 8, fontWeight: 600, borderRadius: 6 }}>
          {summary.percentUsed.toFixed(1)}%
        </Tag>
      ),
    },
    {
      title: 'Remaining',
      value: fmt(summary.remaining, summary.currency),
      icon: <TrendingDown size={20} color={summary.remaining > 0 ? '#10b981' : '#dc2626'} />,
      bg: summary.remaining > 0 ? '#ecfdf5' : '#fef2f2',
      suffix: null,
    },
    {
      title: 'Weekly Burn Rate',
      value: fmt(summary.burnRatePerWeek, summary.currency),
      icon: <AlertTriangle size={20} color="#f59e0b" />,
      bg: '#fffbeb',
      suffix: summary.weeksRemaining !== null ? (
        <Tooltip title="Estimated weeks until budget is exhausted at current burn rate">
          <Tag color="#f59e0b" style={{ marginLeft: 8, fontWeight: 600, borderRadius: 6 }}>
            {summary.weeksRemaining}w left
          </Tag>
        </Tooltip>
      ) : null,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#4a5565' }}>Budget Status:</span>
        <Tag
          style={{
            backgroundColor: cfg.bg,
            color: cfg.color,
            border: `1px solid ${cfg.color}30`,
            fontWeight: 700,
            borderRadius: 6,
            padding: '2px 10px',
          }}
        >
          {cfg.label}
        </Tag>
        {summary.projectedTotalCost > summary.totalBudget && summary.totalBudget > 0 && (
          <span style={{ fontSize: 13, color: '#dc2626' }}>
            Projected overrun: {fmt(summary.projectedTotalCost - summary.totalBudget, summary.currency)}
          </span>
        )}
      </div>
      <Row gutter={[16, 16]}>
        {cards.map((card) => (
          <Col xs={24} sm={12} lg={6} key={card.title}>
            <Card
              style={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(16,24,40,0.04)' }}
              styles={{ body: { padding: '20px 24px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: card.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {card.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#101828', lineHeight: 1 }}>
                      {card.value}
                    </span>
                    {card.suffix}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
