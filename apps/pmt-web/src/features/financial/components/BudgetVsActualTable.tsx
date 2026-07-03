import { Table, Tag } from 'antd';
import type { BudgetVsActual } from '../types';

interface Props {
  data: BudgetVsActual[];
  currency: string;
}

function fmt(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function fmtHours(h: number) {
  return `${h.toFixed(1)}h`;
}

export function BudgetVsActualTable({ data, currency }: Props) {
  const columns = [
    {
      title: 'Resource',
      dataIndex: 'resource',
      key: 'resource',
      render: (resource: string) => (
        <span style={{ fontWeight: 600, color: '#101828' }}>{resource}</span>
      ),
    },
    {
      title: 'Actual Hours',
      dataIndex: 'actualHours',
      key: 'actualHours',
      render: fmtHours,
      align: 'right' as const,
    },
    {
      title: 'Actual Cost',
      dataIndex: 'actualCost',
      key: 'actualCost',
      render: (v: number) => fmt(v, currency),
      align: 'right' as const,
    },
    {
      title: 'Variance',
      key: 'variance',
      align: 'right' as const,
      render: (_: any, row: BudgetVsActual) => {
        const isOver = row.variance > 0;
        const color = isOver ? '#dc2626' : '#10b981';
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <span style={{ color, fontWeight: 700 }}>
              {isOver ? '+' : ''}{fmt(row.variance, currency)}
            </span>
            <Tag
              style={{
                backgroundColor: isOver ? '#fef2f2' : '#ecfdf5',
                color,
                border: `1px solid ${color}30`,
                borderRadius: 6,
                fontWeight: 600,
                minWidth: 60,
                textAlign: 'center',
              }}
            >
              {isOver ? '+' : ''}{row.variancePercent.toFixed(1)}%
            </Tag>
          </div>
        );
      },
    },
  ];

  // Summary row
  const totals = data.reduce(
    (acc, row) => ({
      actualHours: acc.actualHours + row.actualHours,
      actualCost: acc.actualCost + row.actualCost,
      variance: acc.variance + row.variance,
    }),
    { actualHours: 0, actualCost: 0, variance: 0 },
  );

  const summaryVariancePct =
    totals.actualCost > 0 ? (totals.variance / totals.actualCost) * 100 : 0;

  return (
    <Table
      dataSource={data}
      columns={columns}
      rowKey={(r) => r.resource + (r.userId ?? '')}
      pagination={false}
      size="middle"
      locale={{ emptyText: 'No timesheet data found. Log time with resource rates to see Budget vs Actual.' }}
      summary={() => (
        <Table.Summary.Row style={{ backgroundColor: '#f9fafb', fontWeight: 700 }}>
          <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
          <Table.Summary.Cell index={1} align="right">{fmtHours(totals.actualHours)}</Table.Summary.Cell>
          <Table.Summary.Cell index={2} align="right">{fmt(totals.actualCost, currency)}</Table.Summary.Cell>
          <Table.Summary.Cell index={3} align="right">
            <span style={{ color: totals.variance > 0 ? '#dc2626' : '#10b981' }}>
              {totals.variance > 0 ? '+' : ''}{fmt(totals.variance, currency)} ({summaryVariancePct.toFixed(1)}%)
            </span>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
    />
  );
}
