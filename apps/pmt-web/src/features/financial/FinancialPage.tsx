import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Tabs, Button, Segmented, Skeleton, Empty, DatePicker, Space, Typography } from 'antd';
import { Settings, BarChart2, DollarSign, List } from 'lucide-react';
import dayjs from 'dayjs';
import {
  useGetProjectBudgetQuery,
  useGetResourceRatesQuery,
  useGetBurnoutChartQuery,
  useGetBudgetSummaryQuery,
  useGetCostBreakdownQuery,
  useGetBudgetVsActualQuery,
  useGetBudgetAlertsQuery,
} from './financialApi';
import { BudgetSummaryCards } from './components/BudgetSummaryCards';
import { BurnoutChart } from './components/BurnoutChart';
import { ResourceRatesTable } from './components/ResourceRatesTable';
import { BudgetVsActualTable } from './components/BudgetVsActualTable';
import { CostBreakdownChart } from './components/CostBreakdownChart';
import { AIFinancialInsights } from './components/AIFinancialInsights';
import { BudgetSettingsModal } from './components/BudgetSettingsModal';
import { BudgetAlertsBadge } from './components/BudgetAlertsBadge';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

const { RangePicker } = DatePicker;
const { Title } = Typography;

const COLORS = {
  primary: '#1268ff',
  border: '#e5e7eb',
  shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
};

export function FinancialPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [granularity, setGranularity] = useState<'weekly' | 'monthly'>('weekly');
  const [dateRange, setDateRange] = useState<[string, string] | [undefined, undefined]>([undefined, undefined]);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);

  const { hasPermission: canManage } = usePermissionGuard('projects.manage_members');

  const { data: budget, isLoading: loadingBudget } = useGetProjectBudgetQuery(projectId!, { skip: !projectId });
  const { data: rates = [], isLoading: loadingRates } = useGetResourceRatesQuery(projectId!, { skip: !projectId });
  const { data: burnoutData = [], isLoading: loadingBurnout } = useGetBurnoutChartQuery(
    { projectId: projectId!, granularity, startDate: dateRange[0], endDate: dateRange[1] },
    { skip: !projectId },
  );
  const { data: summary, isLoading: loadingSummary } = useGetBudgetSummaryQuery(projectId!, { skip: !projectId });
  const { data: costBreakdown = [], isLoading: loadingCost } = useGetCostBreakdownQuery(
    { projectId: projectId!, startDate: dateRange[0], endDate: dateRange[1] },
    { skip: !projectId },
  );
  const { data: budgetVsActual = [], isLoading: loadingVsActual } = useGetBudgetVsActualQuery(projectId!, { skip: !projectId });
  const { data: alerts = [] } = useGetBudgetAlertsQuery(projectId!, { skip: !projectId });

  const currency = budget?.currency ?? summary?.currency ?? 'USD';

  const handleDateChange = (dates: any) => {
    if (!dates) {
      setDateRange([undefined, undefined]);
    } else {
      setDateRange([
        dates[0]?.format('YYYY-MM-DD') ?? undefined,
        dates[1]?.format('YYYY-MM-DD') ?? undefined,
      ]);
    }
  };

  const tabItems = [
    {
      key: 'breakdown',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart2 size={15} /> Cost Breakdown
        </span>
      ),
      children: loadingCost ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <CostBreakdownChart data={costBreakdown} currency={currency} />
      ),
    },
    {
      key: 'vsActual',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <DollarSign size={15} /> Budget vs Actual
        </span>
      ),
      children: loadingVsActual ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : (
        <BudgetVsActualTable data={budgetVsActual} currency={currency} />
      ),
    },
    {
      key: 'rates',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <List size={15} /> Resource Rates
        </span>
      ),
      children: loadingRates ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : (
        <ResourceRatesTable projectId={projectId!} rates={rates} canManage={canManage} currency={currency} />
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 40px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: '#101828' }}>Financial Overview</Title>
        <Space>
          <BudgetAlertsBadge projectId={projectId!} alerts={alerts} />
          {canManage && (
            <Button
              icon={<Settings size={16} />}
              onClick={() => setBudgetModalOpen(true)}
              style={{ borderRadius: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {budget ? 'Edit Budget' : 'Set Budget'}
            </Button>
          )}
        </Space>
      </div>

      {/* Budget Summary Cards */}
      {loadingSummary ? (
        <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 24 }} />
      ) : summary ? (
        <div style={{ marginBottom: 24 }}>
          <BudgetSummaryCards summary={summary} />
        </div>
      ) : (
        <Card
          style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, marginBottom: 24 }}
          styles={{ body: { padding: 24, textAlign: 'center' } }}
        >
          <Empty
            description={
              canManage
                ? 'No budget configured. Click "Set Budget" to get started.'
                : 'No budget has been set for this project yet.'
            }
          />
          {canManage && (
            <Button
              type="primary"
              onClick={() => setBudgetModalOpen(true)}
              style={{ marginTop: 12, borderRadius: 8 }}
            >
              Set Project Budget
            </Button>
          )}
        </Card>
      )}

      {/* Burnout Chart */}
      <Card
        style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, boxShadow: COLORS.shadow, marginBottom: 24 }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#101828' }}>Budget Burnout Chart</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Cumulative spend vs planned budget over time</div>
          </div>
          <Space>
            <RangePicker
              onChange={handleDateChange}
              format="YYYY-MM-DD"
              style={{ borderRadius: 8 }}
              placeholder={['Start date', 'End date']}
            />
            <Segmented
              options={[
                { label: 'Weekly', value: 'weekly' },
                { label: 'Monthly', value: 'monthly' },
              ]}
              value={granularity}
              onChange={(v) => setGranularity(v as 'weekly' | 'monthly')}
              style={{ borderRadius: 8 }}
            />
          </Space>
        </div>

        {loadingBurnout ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : (
          <BurnoutChart
            data={burnoutData}
            totalBudget={Number(budget?.totalBudget ?? 0)}
            alertThreshold={Number(budget?.alertThreshold ?? 0.8)}
            warningThreshold={Number(budget?.warningThreshold ?? 0.9)}
            currency={currency}
          />
        )}
      </Card>

      {/* Tabbed breakdown section */}
      <Card
        style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, boxShadow: COLORS.shadow, marginBottom: 24 }}
        styles={{ body: { padding: '8px 24px 24px' } }}
      >
        <Tabs items={tabItems} destroyInactiveTabPane />
      </Card>

      {/* AI Financial Insights */}
      <AIFinancialInsights
        projectId={projectId!}
        summary={summary}
        costBreakdown={costBreakdown}
      />

      {/* Budget Settings Modal */}
      <BudgetSettingsModal
        projectId={projectId!}
        budget={budget}
        open={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
      />
    </div>
  );
}
