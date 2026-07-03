import { AlertTriangle, User } from 'lucide-react';
import { TeamWorkloadReport } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface TeamWorkloadTableProps {
  data: TeamWorkloadReport;
}

export function TeamWorkloadTable({ data }: TeamWorkloadTableProps) {
  if (data.members.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Workload</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No team members found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Workload</CardTitle>
        <p className="text-sm text-muted-foreground">
          {data.dateRange.startDate} - {data.dateRange.endDate}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 font-medium">Team Member</th>
                <th className="text-right py-3 font-medium">Assigned</th>
                <th className="text-right py-3 font-medium">In Progress</th>
                <th className="text-right py-3 font-medium">Completed</th>
                <th className="text-right py-3 font-medium">Points</th>
                <th className="text-right py-3 font-medium">Hours</th>
                <th className="text-right py-3 font-medium">Overdue</th>
                <th className="text-center py-3 font-medium w-32">Progress</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((member) => {
                const completionRate =
                  member.assignedIssues > 0
                    ? Math.round((member.completedIssues / member.assignedIssues) * 100)
                    : 0;

                return (
                  <tr key={member.userId} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.displayName}
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium">{member.displayName}</span>
                      </div>
                    </td>
                    <td className="text-right py-3">{member.assignedIssues}</td>
                    <td className="text-right py-3 text-blue-600">{member.inProgressIssues}</td>
                    <td className="text-right py-3 text-green-600">{member.completedIssues}</td>
                    <td className="text-right py-3">
                      <span className="text-green-600">{member.completedPoints}</span>
                      <span className="text-muted-foreground">/{member.totalPoints}</span>
                    </td>
                    <td className="text-right py-3">{member.hoursLogged}h</td>
                    <td className="text-right py-3">
                      {member.overdueIssues > 0 ? (
                        <span className="flex items-center justify-end gap-1 text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                          {member.overdueIssues}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Progress value={completionRate} className="h-2 flex-1" />
                        <span className="text-xs w-8 text-right">{completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-medium">
                <td className="py-3">Total</td>
                <td className="text-right py-3">{data.totals.totalAssigned}</td>
                <td className="text-right py-3 text-blue-600">{data.totals.totalInProgress}</td>
                <td className="text-right py-3 text-green-600">{data.totals.totalCompleted}</td>
                <td className="text-right py-3">{data.totals.totalPoints}</td>
                <td className="text-right py-3">{data.totals.totalHoursLogged}h</td>
                <td className="text-right py-3">-</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <Progress
                      value={
                        data.totals.totalAssigned > 0
                          ? Math.round(
                              (data.totals.totalCompleted / data.totals.totalAssigned) * 100
                            )
                          : 0
                      }
                      className="h-2 flex-1"
                    />
                    <span className="text-xs w-8 text-right">
                      {data.totals.totalAssigned > 0
                        ? Math.round(
                            (data.totals.totalCompleted / data.totals.totalAssigned) * 100
                          )
                        : 0}
                      %
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
