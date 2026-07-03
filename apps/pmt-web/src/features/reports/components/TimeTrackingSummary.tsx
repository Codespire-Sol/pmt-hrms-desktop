import { useIssueModal } from '../../issues/IssueDetailModal';
import { format } from 'date-fns';
import { Clock, User, Folder, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TimeTrackingReport } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface TimeTrackingSummaryProps {
  data: TimeTrackingReport;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function TimeTrackingSummary({ data }: TimeTrackingSummaryProps) {
  const { openIssue } = useIssueModal();
  const maxByUser = Math.max(...data.byUser.map((u) => u.totalMinutes), 1);
  const maxByProject = Math.max(...data.byProject.map((p) => p.totalMinutes), 1);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(data.totalMinutes)}</p>
                <p className="text-xs text-muted-foreground">Total Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <FileText className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalLogs}</p>
                <p className="text-xs text-muted-foreground">Time Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <User className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.byUser.length}</p>
                <p className="text-xs text-muted-foreground">Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Folder className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.byProject.length}</p>
                <p className="text-xs text-muted-foreground">Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Time by User */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Time by Team Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.byUser.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No data</p>
            ) : (
              <div className="space-y-4">
                {data.byUser.slice(0, 10).map((user) => (
                  <div key={user.userId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.displayName}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                            {user.displayName.charAt(0)}
                          </div>
                        )}
                        <span>{user.displayName}</span>
                      </div>
                      <span className="font-medium">{formatDuration(user.totalMinutes)}</span>
                    </div>
                    <Progress
                      value={(user.totalMinutes / maxByUser) * 100}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time by Project */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Time by Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.byProject.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No data</p>
            ) : (
              <div className="space-y-4">
                {data.byProject.slice(0, 10).map((project) => (
                  <div key={project.projectId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <Link
                        to={`/projects/${project.projectId}`}
                        className="flex items-center gap-2 hover:text-primary"
                      >
                        <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                          {project.projectKey.substring(0, 2)}
                        </div>
                        <span>{project.projectName}</span>
                      </Link>
                      <span className="font-medium">{formatDuration(project.totalMinutes)}</span>
                    </div>
                    <Progress
                      value={(project.totalMinutes / maxByProject) * 100}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Time Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No time entries</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-left py-2 font-medium">User</th>
                    <th className="text-left py-2 font-medium">Issue</th>
                    <th className="text-left py-2 font-medium">Description</th>
                    <th className="text-right py-2 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentLogs.slice(0, 20).map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-2">
                        {format(new Date(log.loggedAt), 'MMM d, yyyy')}
                      </td>
                      <td className="py-2">{log.userName}</td>
                      <td className="py-2">
                        <button
                          onClick={() => openIssue(log.issueId, log.projectId)}
                          className="text-primary hover:underline bg-transparent border-0 p-0 cursor-pointer"
                        >
                          {log.issueKey}
                        </button>
                      </td>
                      <td className="py-2 text-muted-foreground max-w-xs truncate">
                        {log.description || '-'}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {formatDuration(log.durationMinutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
