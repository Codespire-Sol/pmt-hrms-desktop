import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarClock, AlertTriangle } from 'lucide-react';
import type { TimesheetLog } from '../types';

import { TS } from './timesheet-styles';

const COLORS = {
  primary: TS.primary,
  warning: TS.warning,
  warningBg: TS.warningBg,
  border: TS.border,
  textSecondary: TS.textSecondary,
};

const FIELD_CLASS =
  'border-gray-200 rounded-xl focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-[#1268ff] bg-white shadow-sm transition-all';

const QUICK_PICKS = [
  { label: '30m', hours: 0.5 },
  { label: '1h', hours: 1 },
  { label: '2h', hours: 2 },
  { label: '3h', hours: 3 },
  { label: '4h', hours: 4 },
  { label: '6h', hours: 6 },
  { label: '8h', hours: 8 },
];

export type EditorState = {
  projectId: string;
  issueId: string;
  workDate: string;
  hoursWorked: string;
  notes: string;
  isBillable: boolean;
};

interface Project { id: string; name: string; key: string; }
interface IssueOption { id: string; label: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingLog: TimesheetLog | null;
  editor: EditorState;
  setEditor: React.Dispatch<React.SetStateAction<EditorState>>;
  onSave: () => void;
  saving: boolean;
  projects?: Project[];
  issueOptions?: IssueOption[];
  today: string;
  existingLogs?: TimesheetLog[];
}

export function EnhancedLogTimeDialog({
  open, onOpenChange, editingLog, editor, setEditor,
  onSave, saving, projects, issueOptions, today, existingLogs,
}: Props) {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');

  // Sync from editor.hoursWorked to h/m split
  useEffect(() => {
    const total = parseFloat(editor.hoursWorked) || 0;
    const h = Math.floor(total);
    const m = Math.round((total - h) * 60);
    setHours(h > 0 ? String(h) : '');
    setMinutes(m > 0 ? String(m) : '');
  }, [open]); // only on open

  const updateTime = (h: string, m: string) => {
    const hVal = parseFloat(h) || 0;
    const mVal = parseFloat(m) || 0;
    const total = hVal + mVal / 60;
    setEditor((prev) => ({ ...prev, hoursWorked: total > 0 ? String(Math.round(total * 4) / 4) : '' }));
  };

  const setQuickPick = (h: number) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    setHours(String(hh || ''));
    setMinutes(mm > 0 ? String(mm) : '');
    setEditor((prev) => ({ ...prev, hoursWorked: String(h) }));
  };

  // Duplicate detection
  const duplicateWarning = useMemo(() => {
    if (!existingLogs || editingLog || !editor.issueId || !editor.workDate) return null;
    const existing = existingLogs.filter(
      (l) => l.issueId === editor.issueId && l.workDate === editor.workDate,
    );
    if (!existing.length) return null;
    const total = existing.reduce((s, l) => s + Number(l.hoursWorked), 0);
    return `You already logged ${total.toFixed(1)}h on this issue today — this will add more.`;
  }, [existingLogs, editingLog, editor.issueId, editor.workDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 border-none shadow-2xl rounded-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 pb-4 border-b bg-gray-50/50 flex items-center gap-3 flex-shrink-0 rounded-t-2xl">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <CalendarClock className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-gray-900">
              {editingLog ? 'Edit Time Entry' : 'Log Time'}
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-gray-500">
              Capture your work for the day
            </DialogDescription>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Project + Issue selects (new log only) */}
          {!editingLog && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold" style={{ color: COLORS.textSecondary }}>
                  Project
                </label>
                <Select
                  value={editor.projectId || 'none'}
                  onValueChange={(v) =>
                    setEditor((p) => ({ ...p, projectId: v === 'none' ? '' : v, issueId: '' }))
                  }
                >
                  <SelectTrigger className={FIELD_CLASS}>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[220px]">
                    <SelectItem value="none" className="text-gray-400">Select project</SelectItem>
                    {projects?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-semibold text-blue-600 mr-1.5">{p.key}</span>
                        <span className="text-gray-700">{p.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold" style={{ color: COLORS.textSecondary }}>
                  Issue
                </label>
                <Select
                  value={editor.issueId || 'none'}
                  onValueChange={(v) =>
                    setEditor((p) => ({ ...p, issueId: v === 'none' ? '' : v }))
                  }
                >
                  <SelectTrigger className={FIELD_CLASS}>
                    <SelectValue placeholder="Select issue" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[220px]">
                    <SelectItem value="none" className="text-gray-400">Select issue</SelectItem>
                    {issueOptions?.map((i) => {
                      const parts = i.label.split(' - ');
                      const key = parts[0];
                      const title = parts.slice(1).join(' - ');
                      return (
                        <SelectItem key={i.id} value={i.id}>
                          <span className="font-semibold text-blue-600 mr-1.5">{key}</span>
                          {title && <span className="text-gray-600 truncate">{title}</span>}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Duplicate warning */}
          {duplicateWarning && (
            <div
              className="flex items-start gap-2 rounded-xl px-3 py-2.5"
              style={{ background: COLORS.warningBg, border: `1px solid #fed7aa` }}
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: COLORS.warning }} />
              <p className="text-sm font-medium" style={{ color: COLORS.warning }}>
                {duplicateWarning}
              </p>
            </div>
          )}

          {/* Work Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold" style={{ color: COLORS.textSecondary }}>
              Work Date
            </label>
            <Input
              type="date"
              max={today}
              className={FIELD_CLASS}
              value={editor.workDate}
              onChange={(e) => setEditor((p) => ({ ...p, workDate: e.target.value }))}
            />
          </div>

          {/* Time input with quick picks */}
          <div className="space-y-2">
            <label className="text-sm font-semibold" style={{ color: COLORS.textSecondary }}>
              Time Logged
            </label>
            {/* Quick picks */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PICKS.map((qp) => {
                const currentVal = parseFloat(editor.hoursWorked) || 0;
                const isActive = Math.abs(currentVal - qp.hours) < 0.01;
                return (
                  <button
                    key={qp.label}
                    onClick={() => setQuickPick(qp.hours)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 8,
                      border: `1.5px solid ${isActive ? COLORS.primary : COLORS.border}`,
                      background: isActive ? COLORS.primary : '#fff',
                      color: isActive ? '#fff' : '#374151',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {qp.label}
                  </button>
                );
              })}
            </div>
            {/* H / M split */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 flex-1">
                <Input
                  type="number"
                  min={0}
                  max={24}
                  step={1}
                  placeholder="0"
                  className={`${FIELD_CLASS} text-center`}
                  value={hours}
                  onChange={(e) => {
                    setHours(e.target.value);
                    updateTime(e.target.value, minutes);
                  }}
                />
                <span className="text-sm font-bold text-gray-400">h</span>
              </div>
              <div className="flex items-center gap-1 flex-1">
                <Input
                  type="number"
                  min={0}
                  max={59}
                  step={15}
                  placeholder="0"
                  className={`${FIELD_CLASS} text-center`}
                  value={minutes}
                  onChange={(e) => {
                    setMinutes(e.target.value);
                    updateTime(hours, e.target.value);
                  }}
                />
                <span className="text-sm font-bold text-gray-400">m</span>
              </div>
              <div className="flex-1">
                <Badge
                  variant="secondary"
                  className="rounded-lg font-bold text-sm px-3 py-1.5 w-full justify-center"
                  style={{
                    background: parseFloat(editor.hoursWorked) > 0 ? 'rgba(18,104,255,0.08)' : '#f9fafb',
                    color: parseFloat(editor.hoursWorked) > 0 ? COLORS.primary : '#94a3b8',
                  }}
                >
                  = {parseFloat(editor.hoursWorked) > 0 ? `${parseFloat(editor.hoursWorked).toFixed(2)}h` : '—'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Billable switch */}
          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">Billable</p>
              <p className="text-xs text-gray-400">Mark this time as billable to the client</p>
            </div>
            <Switch
              checked={editor.isBillable}
              onCheckedChange={(checked) => setEditor((p) => ({ ...p, isBillable: checked }))}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold" style={{ color: COLORS.textSecondary }}>
              Notes
              <span className="font-normal text-xs ml-1 text-gray-400">(optional)</span>
            </label>
            <Textarea
              rows={2}
              className={`${FIELD_CLASS} resize-none`}
              value={editor.notes}
              placeholder="What did you work on?"
              onChange={(e) => setEditor((p) => ({ ...p, notes: e.target.value }))}
              maxLength={500}
            />
            <p className="text-[11px] text-gray-400 text-right">{editor.notes.length}/500</p>
          </div>
        </div>

        <DialogFooter className="p-4 border-t bg-gray-50/30 flex gap-2 flex-shrink-0 rounded-b-2xl">
          <Button
            variant="ghost"
            className="rounded-xl font-semibold px-5 h-9 text-[13px]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="rounded-xl font-bold px-7 h-9 text-[13px] shadow-lg shadow-blue-500/20"
            style={{ background: COLORS.primary, color: '#fff' }}
          >
            {saving ? 'Saving...' : editingLog ? 'Update Entry' : 'Log Time'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EnhancedLogTimeDialog;
