import { format } from 'date-fns';
import { SprintBurndown } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface BurndownChartProps {
  data: SprintBurndown;
}

export function BurndownChart({ data }: BurndownChartProps) {
  if (data.dataPoints.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sprint Burndown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No burndown data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxPoints = Math.max(data.totalPoints, 1);
  const labels = data.dataPoints.map((p) => format(new Date(p.date), 'MMM d'));

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Ideal',
        data: data.dataPoints.map((p) => p.idealRemaining),
        borderColor: '#94a3b8',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
      },
      {
        label: 'Actual',
        data: data.dataPoints.map((p) => p.actualRemaining),
        borderColor: '#0284c7',
        backgroundColor: 'rgba(2, 132, 199, 0.12)',
        borderWidth: 2.5,
        tension: 0.35,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#e2e8f0',
        bodyColor: '#e2e8f0',
        borderColor: '#334155',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#64748b', maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
      },
      y: {
        beginAtZero: true,
        suggestedMax: maxPoints,
        grid: { color: '#e2e8f0' },
        ticks: { color: '#64748b' },
      },
    },
  };

  const lastPoint = data.dataPoints[data.dataPoints.length - 1];
  const isAhead = lastPoint.actualRemaining < lastPoint.idealRemaining;
  const isBehind = lastPoint.actualRemaining > lastPoint.idealRemaining;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Sprint Burndown</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{data.sprintName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{data.totalPoints} points</Badge>
          {isAhead && <Badge className="bg-green-500">Ahead of schedule</Badge>}
          {isBehind && <Badge className="bg-orange-500">Behind schedule</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <Line data={chartData} options={chartOptions} />
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold">{data.totalPoints}</p>
            <p className="text-xs text-muted-foreground">Total Points</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{lastPoint.completedPoints}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-sky-600">{lastPoint.actualRemaining}</p>
            <p className="text-xs text-muted-foreground">Remaining</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
