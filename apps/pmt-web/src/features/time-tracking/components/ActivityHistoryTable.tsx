import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  FileSpreadsheet,
  ChevronLeft,
  Clock,
} from 'lucide-react';
import type { TimesheetLog, TimesheetHistoryDayBucket } from '../types';
import { TS, cardClass } from './timesheet-styles';

const PAGE_SIZE = 20;

function fmt(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  } catch {
    return dateStr;
  }
}

interface Props {
  logs: TimesheetLog[];
  dayBuckets: TimesheetHistoryDayBucket[];
  canEdit: (log: TimesheetLog) => boolean;
  canDelete: (log: TimesheetLog) => boolean;
  onEdit: (log: TimesheetLog) => void;
  onDelete: (log: TimesheetLog) => void;
  canViewAll: boolean;
  loading: boolean;
}

export function ActivityHistoryTable({
  logs, dayBuckets, canEdit, canDelete, onEdit, onDelete, canViewAll, loading,
}: Props) {
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const groupedByDate = useMemo(() => {
    const sorted = [...logs].sort((a, b) => b.workDate.localeCompare(a.workDate));
    const groups = new Map<string, TimesheetLog[]>();
    for (const log of sorted) {
      const key = log.workDate;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(log);
    }
    return Array.from(groups.entries()).map(([date, dayLogs]) => ({
      date,
      logs: dayLogs,
      totalHours: dayLogs.reduce((s, l) => s + Number(l.hoursWorked), 0),
    }));
  }, [logs]);

  const totalPages = Math.ceil(groupedByDate.length / PAGE_SIZE);
  const pagedGroups = groupedByDate.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleDay = (date: string) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  if (loading) {
    return (
      <Card className={cardClass}>
        <CardContent className="p-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full rounded-[12px]" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardClass}>
      <CardHeader className="flex flex-row items-center justify-between pb-3 px-5 pt-5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-5 rounded-full" style={{ backgroundColor: TS.primary }} />
          <CardTitle className="text-[18px] font-extrabold" style={{ color: TS.textPrimary }}>
            Activity History
          </CardTitle>
        </div>
        <Badge variant="outline" className="rounded-lg border-[#eaecf0] font-bold text-[11px]" style={{ color: TS.textTertiary }}>
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 py-16">
            <FileSpreadsheet size={48} className="text-[#D0D5DD]" />
            <p className="text-[15px] font-semibold" style={{ color: TS.textTertiary }}>
              No activity recorded yet
            </p>
            <p className="text-[13px]" style={{ color: TS.textMuted }}>
              Log time to see your activity history here
            </p>
          </div>
        ) : (
          <>
            {pagedGroups.map((group) => {
              const isCollapsed = collapsedDays.has(group.date);
              return (
                <div key={group.date}>
                  {/* Day group header */}
                  <button
                    className="w-full flex items-start justify-between px-5 py-3 transition-colors hover:bg-[#F9FAFB]"
                    onClick={() => toggleDay(group.date)}
                    style={{ borderBottom: `1px solid ${TS.borderSubtle}` }}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-0.5">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4" style={{ color: TS.textMuted }} />
                        ) : (
                          <ChevronDown className="h-4 w-4" style={{ color: TS.textMuted }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-bold text-[14px]" style={{ color: TS.textPrimary }}>
                            {fmt(group.date)}
                          </span>
                          <Badge variant="secondary" className="rounded-lg font-semibold text-[11px] bg-[#F2F4F7]">
                            <Clock className="h-3 w-3 mr-1" />
                            {group.logs.length} log{group.logs.length > 1 ? 's' : ''}
                          </Badge>
                          {(() => {
                            const projMap = new Map<string, { key: string; hours: number }>();
                            group.logs.forEach((l) => {
                              const pk = l.issue?.projectKey || '—';
                              const cur = projMap.get(pk) || { key: pk, hours: 0 };
                              cur.hours += Number(l.hoursWorked);
                              projMap.set(pk, cur);
                            });
                            return Array.from(projMap.values())
                              .sort((a, b) => b.hours - a.hours)
                              .slice(0, 4)
                              .map((p) => (
                                <span
                                  key={p.key}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-md px-2 py-0.5"
                                  style={{ background: TS.primaryLight, color: TS.primary }}
                                >
                                  {p.key}
                                  <span className="opacity-70">{p.hours.toFixed(1)}h</span>
                                </span>
                              ));
                          })()}
                        </div>
                        {isCollapsed && (
                          <p className="text-[11px] mt-0.5 truncate" style={{ color: TS.textMuted }}>
                            {group.logs.map((l) => l.issue?.issueKey || 'N/A').join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className="font-extrabold text-[18px] flex-shrink-0 ml-3"
                      style={{ color: TS.primary, letterSpacing: '-0.03em' }}
                    >
                      {group.totalHours.toFixed(1)}h
                    </span>
                  </button>

                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent border-[#F2F4F7]" style={{ background: TS.surfaceHover }}>
                              <TableHead className="text-[11px] font-bold uppercase tracking-wider pl-12" style={{ color: TS.textTertiary }}>Issue</TableHead>
                              <TableHead className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TS.textTertiary }}>Project</TableHead>
                              <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider" style={{ color: TS.textTertiary }}>Hours</TableHead>
                              <TableHead className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TS.textTertiary }}>Type</TableHead>
                              <TableHead className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TS.textTertiary }}>Notes</TableHead>
                              {canViewAll && (
                                <TableHead className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TS.textTertiary }}>User</TableHead>
                              )}
                              <TableHead className="text-right text-[11px] font-bold uppercase tracking-wider pr-5" style={{ color: TS.textTertiary }}>
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <AnimatePresence mode="popLayout">
                              {group.logs.map((log) => (
                                <motion.tr
                                  key={log.id}
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -8 }}
                                  className="group transition-colors border-[#F2F4F7] hover:bg-[#F5F8FF]"
                                >
                                  <TableCell className="pl-12">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-bold group-hover:text-[#1268ff] transition-colors text-[13px] leading-tight" style={{ color: TS.textPrimary }}>
                                        {log.issue?.issueKey || 'N/A'}
                                      </span>
                                      <span className="text-[11px] truncate max-w-[220px] leading-tight" style={{ color: TS.textMuted }} title={log.issue?.title || ''}>
                                        {log.issue?.title || 'Untitled issue'}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <span
                                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold"
                                      style={{ background: TS.primaryLight, color: TS.primary }}
                                    >
                                      {log.issue?.projectKey || '—'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex flex-col items-end gap-1">
                                      <div>
                                        <span className="font-extrabold text-[16px]" style={{ color: TS.textPrimary, letterSpacing: '-0.04em' }}>
                                          {Number(log.hoursWorked).toFixed(1)}
                                        </span>
                                        <span className="text-[10px] font-bold ml-0.5" style={{ color: TS.textMuted }}>h</span>
                                      </div>
                                      <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: TS.borderSubtle }}>
                                        <div
                                          className="h-full rounded-full"
                                          style={{
                                            width: `${Math.min(100, (Number(log.hoursWorked) / Math.max(group.totalHours, 0.01)) * 100)}%`,
                                            background: TS.primary,
                                            opacity: 0.6,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className="rounded-lg font-bold border-none text-[11px]"
                                      style={{
                                        backgroundColor: log.isBillable ? TS.successBg : '#f1f5f9',
                                        color: log.isBillable ? TS.success : TS.textTertiary,
                                      }}
                                    >
                                      {log.isBillable ? 'Billable' : 'Non-billable'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="max-w-[200px]">
                                    <span className="text-[13px] font-medium italic truncate block" style={{ color: TS.textTertiary }} title={log.notes || ''}>
                                      {log.notes || <span className="not-italic" style={{ color: '#D0D5DD' }}>—</span>}
                                    </span>
                                  </TableCell>
                                  {canViewAll && (
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0"
                                          style={{ background: TS.primaryLight, color: TS.primary }}
                                        >
                                          {(log.user?.displayName || '?')[0].toUpperCase()}
                                        </div>
                                        <span className="font-semibold text-[13px] truncate max-w-[110px]" style={{ color: TS.textSecondary }}>
                                          {log.user?.displayName || '—'}
                                        </span>
                                      </div>
                                    </TableCell>
                                  )}
                                  <TableCell className="pr-5">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg hover:bg-white hover:text-[#1268ff] hover:shadow-md"
                                        disabled={!canEdit(log)}
                                        onClick={() => onEdit(log)}
                                      >
                                        <Pencil size={13} />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-lg hover:bg-red-50 hover:text-red-600 hover:shadow-md"
                                        disabled={!canDelete(log)}
                                        onClick={() => onDelete(log)}
                                      >
                                        <Trash2 size={13} />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </motion.tr>
                              ))}
                            </AnimatePresence>
                          </TableBody>
                        </Table>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: `1px solid ${TS.borderSubtle}` }}>
                <p className="text-[13px] font-medium" style={{ color: TS.textTertiary }}>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, groupedByDate.length)} of{' '}
                  {groupedByDate.length} days
                </p>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-[12px] font-semibold hover:bg-[#F2F4F7]"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Prev
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-[12px] font-semibold hover:bg-[#F2F4F7]"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default ActivityHistoryTable;
