import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, DatePicker, Empty, Skeleton, Statistic, Row, Col, Typography, Space, Tag,
} from 'antd';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from 'recharts';
import dayjs from 'dayjs';
import { useGetControlChartDataQuery } from './reportsApi';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const COLORS = {
  primary:   '#1268ff',
  success:   '#52c41a',
  warning:   '#faad14',
  danger:    '#ff4d4f',
  border:    '#e5e7eb',
  textPrimary: '#101828',
  textMuted:   '#6a7282',
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#fff', border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontSize: 13,
    }}>
      <Text strong>{d.issueKey}</Text>
      <div style={{ color: COLORS.textMuted }}>{new Date(d.completedAt).toLocaleDateString()}</div>
      <div style={{ marginTop: 4 }}>
        Cycle time: <Text strong>{d.cycleTimeDays} day{d.cycleTimeDays !== 1 ? 's' : ''}</Text>
      </div>
    </div>
  );
};

export function ControlChartPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [dateRange, setDateRange] = useState<[string?, string?]>([undefined, undefined]);

  const { data, isLoading } = useGetControlChartDataQuery({
    projectId: projectId!,
    startDate: dateRange[0],
    endDate:   dateRange[1],
  }, { skip: !projectId });

  const chartData = (data?.points ?? []).map(p => ({
    ...p,
    x: new Date(p.completedAt).getTime(),
    y: p.cycleTimeDays,
  }));

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, color: COLORS.textPrimary }}>Control Chart</Title>
        <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
          Cycle time per issue — how long each issue took from creation to resolution.
          Percentile lines help identify outliers.
        </Text>
      </div>

      {/* Date filter */}
      <Card style={{ marginBottom: 24, borderColor: COLORS.border }}>
        <Space align="center">
          <Text style={{ fontWeight: 600 }}>Date range:</Text>
          <RangePicker
            onChange={(_dates, strs) => setDateRange([strs[0] || undefined, strs[1] || undefined])}
            allowClear
          />
          {data && (
            <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
              Showing {data.dateRange.startDate} → {data.dateRange.endDate}
            </Text>
          )}
        </Space>
      </Card>

      {/* Stats */}
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : data ? (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card style={{ borderColor: COLORS.border, textAlign: 'center' }}>
                <Statistic title="Issues" value={data.points.length} valueStyle={{ color: COLORS.primary }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderColor: COLORS.border, textAlign: 'center' }}>
                <Statistic title="Median (p50)" value={data.percentiles.p50} suffix="days" valueStyle={{ color: COLORS.success }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderColor: COLORS.border, textAlign: 'center' }}>
                <Statistic title="p75" value={data.percentiles.p75} suffix="days" valueStyle={{ color: COLORS.warning }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderColor: COLORS.border, textAlign: 'center' }}>
                <Statistic title="p95" value={data.percentiles.p95} suffix="days" valueStyle={{ color: COLORS.danger }} />
              </Card>
            </Col>
          </Row>

          {/* Scatter plot */}
          {chartData.length === 0 ? (
            <Card style={{ borderColor: COLORS.border }}>
              <Empty description="No completed issues in this date range" />
            </Card>
          ) : (
            <Card style={{ borderColor: COLORS.border }}>
              <Title level={5} style={{ marginTop: 0 }}>Cycle Time Distribution</Title>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(v) => dayjs(v).format('MMM DD')}
                    label={{ value: 'Completed Date', position: 'insideBottom', offset: -10, fontSize: 12 }}
                    scale="time"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    dataKey="y"
                    label={{ value: 'Cycle Time (days)', angle: -90, position: 'insideLeft', fontSize: 12 }}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" />
                  <ReferenceLine
                    y={data.percentiles.p50}
                    stroke={COLORS.success}
                    strokeDasharray="6 3"
                    label={{ value: `Median (${data.percentiles.p50}d)`, position: 'insideTopRight', fontSize: 11, fill: COLORS.success }}
                  />
                  <ReferenceLine
                    y={data.percentiles.p75}
                    stroke={COLORS.warning}
                    strokeDasharray="6 3"
                    label={{ value: `p75 (${data.percentiles.p75}d)`, position: 'insideTopRight', fontSize: 11, fill: COLORS.warning }}
                  />
                  <ReferenceLine
                    y={data.percentiles.p95}
                    stroke={COLORS.danger}
                    strokeDasharray="6 3"
                    label={{ value: `p95 (${data.percentiles.p95}d)`, position: 'insideTopRight', fontSize: 11, fill: COLORS.danger }}
                  />
                  <Scatter
                    name="Completed Issues"
                    data={chartData}
                    fill={COLORS.primary}
                    opacity={0.7}
                    r={5}
                  />
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: COLORS.textMuted }}>
                Each dot represents one resolved issue. Hover for details.
              </div>
            </Card>
          )}
        </>
      ) : (
        <Empty description="No data available" />
      )}
    </div>
  );
}

export default ControlChartPage;
