import { useSearchParams, useNavigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import {
  BarChart3,
  Users,
  Clock,
  Download,
  Loader2,
  Calendar,
  ChevronDown,
  TrendingUp,
  Activity,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGetProjectsQuery } from '@/features/projects/projectsApi';
import {
  VelocityChart,
  BurndownChart,
  TeamWorkloadTable,
  TimeTrackingSummary,
  CumulativeFlowDiagram,
  useGetSprintReportQuery,
  useGetTeamWorkloadReportQuery,
  useGetTimeTrackingReportQuery,
  getExportUrls,
} from '@/features/reports';
import { useAppSelector } from '@/app/hooks';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

type DateRange = '7d' | '30d' | '90d' | 'custom';

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

function getDateRange(range: DateRange): { startDate: string; endDate: string } {
  const endDate = format(new Date(), 'yyyy-MM-dd');
  let startDate: string;

  switch (range) {
    case '7d':
      startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      break;
    case '90d':
      startDate = format(subDays(new Date(), 90), 'yyyy-MM-dd');
      break;
    case '30d':
    default:
      startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      break;
  }

  return { startDate, endDate };
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'sprint';
  const selectedProject = searchParams.get('project') || '';
  const dateRange = (searchParams.get('range') as DateRange) || '30d';

  const { accessToken } = useAppSelector((state) => state.auth);
  const { hasPermission: canViewReports } = usePermissionGuard('reports.view');
  const { hasPermission: canExportReports } = usePermissionGuard('reports.export');
  const { data: projectsData } = useGetProjectsQuery({});
  const projects = projectsData?.projects || [];

  const { startDate, endDate } = getDateRange(dateRange);

  // Queries
  const { data: sprintReport, isLoading: sprintLoading } = useGetSprintReportQuery(
    selectedProject,
    { skip: !selectedProject || activeTab !== 'sprint' }
  );

  const { data: workloadReport, isLoading: workloadLoading } = useGetTeamWorkloadReportQuery(
    { projectId: selectedProject, startDate, endDate },
    { skip: !selectedProject || activeTab !== 'workload' }
  );

  const { data: timeReport, isLoading: timeLoading } = useGetTimeTrackingReportQuery(
    { startDate, endDate, projectId: selectedProject || undefined },
    { skip: activeTab !== 'time' }
  );

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params);
  };

  const handleProjectChange = (projectId: string) => {
    const params = new URLSearchParams(searchParams);
    if (projectId && projectId !== 'all') {
      params.set('project', projectId);
    } else {
      params.delete('project');
    }
    setSearchParams(params);
  };

  const handleDateRangeChange = (range: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('range', range);
    setSearchParams(params);
  };

  const handleExport = async (type: 'sprint' | 'workload' | 'time', format: 'csv' | 'json') => {
    if (!accessToken) return;

    const urls = getExportUrls(accessToken);
    let url: string;

    switch (type) {
      case 'sprint':
        url = urls.sprintVelocity(selectedProject, format);
        break;
      case 'workload':
        url = urls.teamWorkload(selectedProject, startDate, endDate, format);
        break;
      case 'time':
        url = urls.timeTracking(startDate, endDate, selectedProject || undefined, format);
        break;
    }

    // Fetch with auth header and trigger download
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${type}-report.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (!canViewReports) {
    return (
      <div className="p-6">
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          You don’t have permission to view reports.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-50 via-white to-slate-100/60 p-6 shadow-sm">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-slate-200/50 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-slate-200/40 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Reports
              </h1>
              <p className="text-muted-foreground mt-1">
                Analyze project performance and team productivity
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border bg-white/70 px-2.5 py-1">
                Range: {dateRangeOptions.find((o) => o.value === dateRange)?.label}
              </span>
              <span className="rounded-full border bg-white/70 px-2.5 py-1">
                {selectedProject ? 'Project Scoped' : 'All Projects'}
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border bg-white/70 p-3 backdrop-blur">
            <Select value={selectedProject || 'all'} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger className="w-[170px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateRangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="sprint" className="flex items-center gap-2 rounded-lg">
              <BarChart3 className="h-4 w-4" />
              Sprint Metrics
            </TabsTrigger>
            <TabsTrigger value="workload" className="flex items-center gap-2 rounded-lg">
              <Users className="h-4 w-4" />
              Team Workload
            </TabsTrigger>
            <TabsTrigger value="time" className="flex items-center gap-2 rounded-lg">
              <Clock className="h-4 w-4" />
              Time Tracking
            </TabsTrigger>
            <TabsTrigger value="cfd" className="flex items-center gap-2 rounded-lg">
              <TrendingUp className="h-4 w-4" />
              Cumulative Flow
            </TabsTrigger>
            <TabsTrigger value="control-chart" className="flex items-center gap-2 rounded-lg">
              <Activity className="h-4 w-4" />
              Control Chart
            </TabsTrigger>
          </TabsList>

          {/* Export button */}
          {canExportReports && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="shadow-sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleExport(activeTab as any, 'csv')}
                  disabled={activeTab === 'sprint' && !selectedProject}
                >
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExport(activeTab as any, 'json')}
                  disabled={activeTab === 'sprint' && !selectedProject}
                >
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Sprint Metrics Tab */}
        <TabsContent value="sprint">
          {!selectedProject ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl bg-muted/30">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a project to view sprint metrics</p>
            </div>
          ) : sprintLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sprintReport ? (
            <div className="space-y-6">
              <div className="rounded-xl border bg-card/60 p-4">
                <VelocityChart
                  data={sprintReport.velocityHistory}
                  averageVelocity={sprintReport.averageVelocity}
                />
              </div>
              {sprintReport.currentSprint && (
                <div className="rounded-xl border bg-card/60 p-4">
                  <BurndownChart data={sprintReport.currentSprint} />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl bg-muted/30">
              <p>No sprint data available</p>
            </div>
          )}
        </TabsContent>

        {/* Team Workload Tab */}
        <TabsContent value="workload">
          {!selectedProject ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl bg-muted/30">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a project to view team workload</p>
            </div>
          ) : workloadLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : workloadReport ? (
            <div className="rounded-xl border bg-card/60 p-4">
              <TeamWorkloadTable data={workloadReport} />
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl bg-muted/30">
              <p>No workload data available</p>
            </div>
          )}
        </TabsContent>

        {/* Time Tracking Tab */}
        <TabsContent value="time">
          {timeLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : timeReport ? (
            <div className="rounded-xl border bg-card/60 p-4">
              <TimeTrackingSummary data={timeReport} />
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl bg-muted/30">
              <p>No time tracking data available</p>
            </div>
          )}
        </TabsContent>

        {/* Cumulative Flow Diagram Tab */}
        <TabsContent value="cfd">
          {!selectedProject ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl bg-muted/30">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a project to view cumulative flow diagram</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card/60 p-4">
              <CumulativeFlowDiagram projectId={selectedProject} />
            </div>
          )}
        </TabsContent>

        {/* Control Chart Tab */}
        <TabsContent value="control-chart">
          {!selectedProject ? (
            <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl bg-muted/30">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a project to view the control chart</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card/60 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Cycle Time Control Chart</h3>
                  <p className="text-sm text-muted-foreground">Scatter plot of cycle time per resolved issue with percentile reference lines.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/projects/${selectedProject}/reports/control-chart`)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Full View
                </Button>
              </div>
              <div
                className="flex items-center justify-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/projects/${selectedProject}/reports/control-chart`)}
              >
                <Activity className="h-5 w-5 mr-2 opacity-50" />
                Click "Open Full View" to see the interactive control chart
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
