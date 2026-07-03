import { SprintVelocity } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface VelocityChartProps {
  data: SprintVelocity[];
  averageVelocity: number;
}

export function VelocityChart({ data, averageVelocity }: VelocityChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sprint Velocity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No sprint data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const labels = data.map((s) => s.sprintName);
  const maxPoints = Math.max(
    ...data.map((d) => Math.max(d.committedPoints, d.completedPoints)),
    averageVelocity,
    1
  );

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Committed',
        data: data.map((d) => d.committedPoints),
        backgroundColor: 'rgba(147, 197, 253, 0.55)',
        borderColor: 'rgba(59, 130, 246, 0.65)',
        borderWidth: 1,
        borderRadius: 8,
        barThickness: 18,
      },
      {
        label: 'Completed',
        data: data.map((d) => d.completedPoints),
        backgroundColor: 'rgba(37, 99, 235, 0.9)',
        borderColor: 'rgba(30, 64, 175, 1)',
        borderWidth: 1,
        borderRadius: 8,
        barThickness: 18,
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
        ticks: {
          color: '#64748b',
          maxRotation: 0,
          callback: function (_: any, index: number) {
            const label = labels[index] || '';
            return label.length > 10 ? `${label.slice(0, 10)}…` : label;
          },
        },
      },
      y: {
        beginAtZero: true,
        suggestedMax: maxPoints,
        grid: { color: '#e2e8f0' },
        ticks: { color: '#64748b' },
      },
    },
  };

  const averagePlugin = {
    id: 'averageLine',
    afterDraw(chart: any) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;
      const y = scales.y.getPixelForValue(averageVelocity);
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f59e0b';
      ctx.font = '11px sans-serif';
      ctx.fillText('Avg', chartArea.right - 28, y - 6);
      ctx.restore();
    },
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Sprint Velocity</CardTitle>
        <div className="text-sm text-muted-foreground">
          Avg: <span className="font-bold text-foreground">{averageVelocity}</span> pts/sprint
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <Bar data={chartData} options={chartOptions} plugins={[averagePlugin]} />
        </div>

        {/* Sprint details table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Sprint</th>
                <th className="text-right py-2 font-medium">Committed</th>
                <th className="text-right py-2 font-medium">Completed</th>
                <th className="text-right py-2 font-medium">Issues</th>
                <th className="text-right py-2 font-medium">Velocity</th>
              </tr>
            </thead>
            <tbody>
              {data.map((sprint) => (
                <tr key={sprint.sprintId} className="border-b last:border-0">
                  <td className="py-2">{sprint.sprintName}</td>
                  <td className="text-right py-2">{sprint.committedPoints}</td>
                  <td className="text-right py-2">{sprint.completedPoints}</td>
                  <td className="text-right py-2">
                    {sprint.completedIssues}/{sprint.totalIssues}
                  </td>
                  <td className="text-right py-2 font-medium">{sprint.velocity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
