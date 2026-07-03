import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, X, Filter, Plus, Download } from 'lucide-react';
import type { UserWithRole } from '@/features/rbac/types';
import { cn } from '@/lib/utils';
import {
  TS,
  segmentedContainerClass,
  segmentActiveClass,
  segmentInactiveClass,
} from './timesheet-styles';

export type DateMode = 'week' | 'month' | 'custom';

function fmt(date: Date, format: 'yyyy-MM-dd' | 'MMM d, yyyy' | 'MMMM yyyy'): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (format === 'yyyy-MM-dd')
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (format === 'MMMM yyyy') return `${months[date.getMonth()]} ${date.getFullYear()}`;
  return `${shortMonths[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

interface Project { id: string; name: string; key: string; }
interface Issue { id: string; issueKey: string; title: string; }

interface Props {
  dateMode: DateMode;
  setDateMode: (m: DateMode) => void;
  weekStart: Date;
  setWeekStart: (d: Date) => void;
  customStart: string;
  setCustomStart: (s: string) => void;
  customEnd: string;
  setCustomEnd: (s: string) => void;
  startDate: string;
  endDate: string;
  canViewAll: boolean;
  selectedUserId: string;
  setSelectedUserId: (id: string) => void;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  selectedIssueId: string;
  setSelectedIssueId: (id: string) => void;
  billableFilter: 'all' | 'billable' | 'nonBillable';
  setBillableFilter: (f: 'all' | 'billable' | 'nonBillable') => void;
  users?: UserWithRole[];
  projects?: Project[];
  issues?: Issue[];
  onExport: () => void;
  exporting: boolean;
  onLogTime: () => void;
  canLog: boolean;
  isAdmin?: boolean;
  className?: string;
}

const SELECT_CLASS = 'border-[#eaecf0] rounded-xl h-9 text-[13px] font-medium bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]';

export function TimesheetFilterPanel({
  dateMode, setDateMode, weekStart, setWeekStart,
  customStart, setCustomStart, customEnd, setCustomEnd, startDate, endDate,
  canViewAll, selectedUserId, setSelectedUserId,
  selectedProjectId, setSelectedProjectId,
  selectedIssueId, setSelectedIssueId,
  billableFilter, setBillableFilter,
  users, projects, issues,
  onExport, exporting, onLogTime, canLog,
  isAdmin,
  className,
}: Props) {
  const today = fmt(new Date(), 'yyyy-MM-dd');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const navWeek = (dir: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(d);
  };

  const currentMonthStart = useMemo(() => {
    if (dateMode === 'month') {
      const d = new Date(startDate + 'T00:00:00');
      return startOfMonth(d);
    }
    return startOfMonth(new Date());
  }, [dateMode, startDate]);

  const navMonth = (dir: number) => {
    const d = new Date(currentMonthStart);
    d.setMonth(d.getMonth() + dir);
    setWeekStart(startOfMonth(d));
  };

  // Check if "today" button should show a dot (current view doesn't include today)
  const todayIsInView = today >= startDate && today <= endDate;

  // Active filter chips
  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (selectedUserId !== 'me' && canViewAll) {
    const user = users?.find((u) => u.id === selectedUserId);
    activeChips.push({ label: user?.displayName || 'User', onRemove: () => setSelectedUserId('me') });
  }
  if (selectedProjectId !== 'all') {
    const proj = projects?.find((p) => p.id === selectedProjectId);
    activeChips.push({ label: proj ? `${proj.key}` : 'Project', onRemove: () => { setSelectedProjectId('all'); setSelectedIssueId('all'); } });
  }
  if (selectedIssueId !== 'all') {
    const iss = issues?.find((i) => i.id === selectedIssueId);
    activeChips.push({ label: iss ? iss.issueKey : 'Issue', onRemove: () => setSelectedIssueId('all') });
  }
  if (billableFilter !== 'all') {
    activeChips.push({ label: billableFilter === 'billable' ? 'Billable only' : 'Non-billable only', onRemove: () => setBillableFilter('all') });
  }

  const clearAll = () => {
    setSelectedUserId('me');
    setSelectedProjectId('all');
    setSelectedIssueId('all');
    setBillableFilter('all');
  };

  // Filter selects (shared between desktop and mobile popover)
  const filterSelects = (
    <>
      {canViewAll && (
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className={cn(SELECT_CLASS, 'flex-1 min-w-[130px] max-w-[180px]')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-[280px]">
            {!isAdmin && <SelectItem value="me" className="font-semibold">My Timesheet</SelectItem>}
            <SelectItem value="all_users" className="font-semibold">All Users</SelectItem>
            <div className="mx-2 my-1 h-px bg-[#F2F4F7]" />
            {users?.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={selectedProjectId} onValueChange={(v) => { setSelectedProjectId(v); setSelectedIssueId('all'); }}>
        <SelectTrigger className={cn(SELECT_CLASS, 'flex-1 min-w-[120px] max-w-[170px]')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[260px]">
          <SelectItem value="all" className="font-semibold">All Projects</SelectItem>
          <div className="mx-2 my-1 h-px bg-[#F2F4F7]" />
          {projects?.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className="font-semibold text-blue-600 mr-1">{p.key}</span>
              <span>{p.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedIssueId} onValueChange={setSelectedIssueId}>
        <SelectTrigger className={cn(SELECT_CLASS, 'flex-1 min-w-[110px] max-w-[160px]')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[260px]">
          <SelectItem value="all" className="font-semibold">All Issues</SelectItem>
          <div className="mx-2 my-1 h-px bg-[#F2F4F7]" />
          {issues?.map((i) => (
            <SelectItem key={i.id} value={i.id}>{i.issueKey}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={billableFilter} onValueChange={(v) => setBillableFilter(v as any)}>
        <SelectTrigger className={cn(SELECT_CLASS, 'flex-1 min-w-[110px] max-w-[155px]')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="font-semibold">All Types</SelectItem>
          <div className="mx-2 my-1 h-px bg-[#F2F4F7]" />
          <SelectItem value="billable">Billable</SelectItem>
          <SelectItem value="nonBillable">Non-billable</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <div
      className={cn(
        'bg-white/95 backdrop-blur-sm border border-[#eaecf0] rounded-[14px]',
        'shadow-[0_1px_3px_rgba(16,24,40,0.04),0_1px_2px_rgba(16,24,40,0.02)]',
        'px-4 sm:px-5 py-3',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Date mode segmented control */}
        <div className={segmentedContainerClass}>
          {(['week', 'month', 'custom'] as DateMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setDateMode(mode)}
              className={cn(
                'cursor-pointer capitalize select-none',
                dateMode === mode ? segmentActiveClass : segmentInactiveClass,
              )}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Date navigator — Week */}
        {dateMode === 'week' && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:bg-[#F2F4F7] transition-colors"
              onClick={() => navWeek(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 rounded-xl text-xs font-bold px-3 relative',
                'hover:bg-[#F2F4F7] transition-colors',
              )}
              onClick={() => setWeekStart(startOfWeek(new Date()))}
            >
              Today
              {!todayIsInView && (
                <span
                  className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: TS.primary }}
                />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:bg-[#F2F4F7] transition-colors"
              onClick={() => navWeek(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Date navigator — Month */}
        {dateMode === 'month' && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-[#F2F4F7]" onClick={() => navMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[13px] font-bold px-2" style={{ color: TS.textSecondary }}>
              {fmt(currentMonthStart, 'MMMM yyyy')}
            </span>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-[#F2F4F7]" onClick={() => navMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Date navigator — Custom */}
        {dateMode === 'custom' && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customStart}
              max={customEnd || today}
              onChange={(e) => {
                const newStart = e.target.value;
                setCustomStart(newStart);
                if (customEnd && newStart && newStart > customEnd) {
                  setCustomEnd('');
                }
              }}
              className="h-9 rounded-xl border-[#eaecf0] text-[13px] w-36"
            />
            <span className="text-[#98A2B3] text-[13px] font-medium">→</span>
            <Input
              type="date"
              value={customEnd}
              min={customStart}
              max={today}
              onChange={(e) => {
                const newEnd = e.target.value;
                setCustomEnd(newEnd);
                if (customStart && newEnd && newEnd < customStart) {
                  setCustomStart('');
                }
              }}
              className="h-9 rounded-xl border-[#eaecf0] text-[13px] w-36"
            />
          </div>
        )}

        {/* Divider */}
        <div className="hidden sm:block h-6 w-px bg-[#F2F4F7]" />

        {/* Desktop filters */}
        <div className="hidden md:flex items-center gap-2">
          {filterSelects}
        </div>

        {/* Mobile filter popover */}
        <div className="md:hidden">
          <Popover open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-[#eaecf0] text-[13px] font-semibold gap-1.5"
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {activeChips.length > 0 && (
                  <Badge
                    className="h-5 min-w-[20px] rounded-full text-[10px] font-bold px-1.5"
                    style={{ backgroundColor: TS.primary, color: '#fff' }}
                  >
                    {activeChips.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start">
              <div className="flex flex-col gap-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                  Filters
                </p>
                {filterSelects}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Spacer */}
        <div className="hidden sm:block flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl border-[#eaecf0] font-semibold text-[13px] gap-1.5 flex-1 sm:flex-none hover:bg-[#F9FAFB]"
            onClick={onExport}
            disabled={exporting}
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? 'Exporting...' : 'Export'}
          </Button>

          {canLog && (
            <Button
              size="sm"
              className="h-9 rounded-xl font-bold text-[13px] gap-1.5 shadow-md shadow-blue-500/15 flex-1 sm:flex-none"
              style={{ background: TS.primary }}
              onClick={onLogTime}
            >
              <Plus className="h-3.5 w-3.5" />
              Log Time
            </Button>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      <AnimatePresence>
        {activeChips.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-[#F2F4F7] flex-wrap">
              <Filter className="h-3.5 w-3.5 text-[#98A2B3]" />
              {activeChips.map((chip) => (
                <motion.div
                  key={chip.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  <Badge
                    variant="secondary"
                    className="rounded-lg text-xs font-semibold gap-1 pr-1 cursor-pointer bg-[#F2F4F7] hover:bg-[#E4E7EC] transition-colors"
                  >
                    {chip.label}
                    <button
                      onClick={chip.onRemove}
                      className="ml-0.5 hover:text-red-500 transition-colors rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </motion.div>
              ))}
              <button
                onClick={clearAll}
                className="text-xs font-semibold text-[#667085] hover:text-[#101828] transition-colors"
              >
                Clear all
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TimesheetFilterPanel;
