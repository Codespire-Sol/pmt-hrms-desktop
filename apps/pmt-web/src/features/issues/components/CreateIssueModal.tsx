import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Sparkles, X, Calendar, Wand2, Paperclip,
  FileText, Image, File, AlertTriangle,
} from 'lucide-react';

import { useDebounce } from '@/hooks/useDebounce';
import { useGetProjectEpicsQuery } from '../../epics/epicsApi';
import { useCreateIssueMutation, useGetIssuesQuery } from '../issuesApi';
import {
  useFindSimilarIssuesQuery,
  useGenerateDescriptionMutation,
} from '@/features/ai/aiApi';
import { WritingAssistant } from '@/features/ai/components/WritingAssistant';
import { useUploadToIssueMutation } from '@/features/attachments/attachmentsApi';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

// ─── Zod Schema ─────────────────────────────────────────────────────────────
const issueSchema = z.object({
  title:       z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().optional(),
  typeId:      z.string().min(1, 'Please select an issue type'),
  priorityId:  z.string().min(1, 'Please select a priority'),
  assigneeId:  z.string().optional(),
  storyPoints: z.number().int().min(0).max(21).optional(),
  dueDate:     z.string().optional(),
});
type IssueFormData = z.infer<typeof issueSchema>;

// ─── Props ───────────────────────────────────────────────────────────────────
interface CreateIssueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  issueTypes?: { id: string; name: string }[];
  priorities?: { id: string; name: string }[];
  members?: { id: string; displayName: string }[];
  defaultStatusId?: string;
  defaultSprintId?: string;
  defaultEpicId?: string;
  onSuccess?: (createdIssue?: any) => void;
}

// ─── Priority colour map ─────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308',
  low: '#22c55e', lowest: '#94a3b8',
};

// ─── File icon helper ────────────────────────────────────────────────────────
function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return <Image className="h-3.5 w-3.5 text-blue-500" />;
  if (mime.includes('pdf'))      return <FileText className="h-3.5 w-3.5 text-red-500" />;
  return <File className="h-3.5 w-3.5 text-muted-foreground" />;
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Slide-in animation preset ───────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const slideIn: any = {
  initial: { opacity: 0, y: -8, height: 0 },
  animate: { opacity: 1, y: 0, height: 'auto' },
  exit:    { opacity: 0, y: -6, height: 0 },
  transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
};

// ─── Main Component ──────────────────────────────────────────────────────────
export function CreateIssueModal({
  open, onOpenChange, projectId,
  issueTypes, priorities, members,
  defaultStatusId, defaultSprintId, defaultEpicId, onSuccess,
}: CreateIssueModalProps) {

  // Fetch both old-style epics and new issue-type epics
  const { data: oldEpics = [] } = useGetProjectEpicsQuery({ projectId }, { skip: !open });
  const { data: allIssuesData } = useGetIssuesQuery(
    { projectId, filters: { limit: 200 } },
    { skip: !open }
  );

  // Merge old epics + issues with type "epic", deduplicate by id
  const epics = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const e of oldEpics) map.set(e.id, { id: e.id, name: e.name });
    for (const i of (allIssuesData?.issues || [])) {
      const typeName = (i.type?.name || i.type?.displayName || '').toLowerCase();
      if (typeName === 'epic' && !map.has(i.id)) {
        map.set(i.id, { id: i.id, name: i.title });
      }
    }
    return Array.from(map.values());
  }, [oldEpics, allIssuesData]);

  const [createIssue,    { isLoading: isCreating }]      = useCreateIssueMutation();
  const [generateDesc,   { isLoading: isGeneratingDesc }] = useGenerateDescriptionMutation();
  const [uploadToIssue,  { isLoading: isUploading }]     = useUploadToIssueMutation();

  // Epic selection
  const [selectedEpicId, setSelectedEpicId] = useState<string>(defaultEpicId || '');

  // AI state
  const [aiDismissed,  setAiDismissed]  = useState(false);
  const [aiPermanentlyOff, setAiPermanentlyOff] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging,  setIsDragging]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const filteredIssueTypes = issueTypes || [];

  const form = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      title: '', description: '', typeId: '',
      priorityId: '', assigneeId: '', storyPoints: undefined, dueDate: '',
    },
  });

  const title       = form.watch('title');
  const description = form.watch('description') || '';
  const debouncedTitle = useDebounce(title, 600);
  const debouncedDesc  = useDebounce(description, 600);

  // Progressive reveal: show body sections once title has ≥3 chars
  const titleReady = title.length >= 3;

  // AI: only fire when title has ≥10 chars and AI is not dismissed/off
  const shouldFetchAI = debouncedTitle.length >= 10 && !aiDismissed && !aiPermanentlyOff;

  const { data: similarData, isFetching: isAILoading, error: similarError } =
    useFindSimilarIssuesQuery(
      { title: debouncedTitle, description: debouncedDesc, projectId, limit: 3 },
      { skip: !shouldFetchAI }
    );

  // If AI errors, permanently turn it off so it stops firing 500s
  useEffect(() => {
    if (similarError) setAiPermanentlyOff(true);
  }, [similarError]);

  // Only show AI results when the query is actively enabled — prevents stale
  // cached data from a previous modal session appearing when title is cleared.
  const aiHasError   = shouldFetchAI && !!similarError;
  const similarIssues = shouldFetchAI ? (similarData?.similarIssues ?? []) : [];
  const highSimilarity = similarIssues.find((i: any) => i.similarity >= 0.8);

  const handleGenerateDescription = async () => {
    if (title.length < 5) return;
    try {
      const result = await generateDesc({ title, issueType: 'issue' }).unwrap();
      form.setValue('description', result.description);
    } catch { /* silent */ }
  };

  // ── Attachment handling ───────────────────────────────────────────────────
  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    setAttachments(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...arr.filter(f => !existing.has(f.name + f.size))];
    });
  }, []);

  const removeAttachment = (idx: number) =>
    setAttachments(prev => prev.filter((_, i) => i !== idx));

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (data: IssueFormData) => {
    try {
      const createdIssue = await createIssue({
        projectId,
        data: {
          title:       data.title,
          description: data.description,
          typeId:      data.typeId,
          statusId:    defaultStatusId || undefined,
          priorityId:  data.priorityId,
          assigneeId:  data.assigneeId === 'unassigned' ? undefined : data.assigneeId,
          storyPoints: data.storyPoints,
          dueDate:     data.dueDate || undefined,
          sprintId:    defaultSprintId || undefined,
          // Link to epic: use parentId for issue-type epics, epicId for old-style epics
          parentId:    selectedEpicId || defaultEpicId || undefined,
          epicId:      undefined,
        },
      }).unwrap();

      // Upload attachments if any
      if (attachments.length > 0 && createdIssue?.id) {
        const fd = new FormData();
        attachments.forEach(f => fd.append('files', f));
        await uploadToIssue({ issueId: createdIssue.id, files: fd }).unwrap();
      }

      form.reset();
      setAttachments([]);
      setAiPermanentlyOff(false);
      setAiDismissed(false);
      onOpenChange(false);
      onSuccess?.(createdIssue);
    } catch (err) {
      console.error('Failed to create issue:', err);
    }
  };

  // Reset on close
  useEffect(() => {
    if (!open) {
      form.reset();
      setAttachments([]);
      setAiDismissed(false);
      setAiPermanentlyOff(false);
    }
  }, [open, form]);

  const isSubmitting = isCreating || isUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl p-0 border-none shadow-2xl overflow-hidden"
        style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* ── Gradient accent bar ────────────────────────────────────── */}
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg, #1268ff 0%, #06b6d4 50%, #8b5cf6 100%)',
          flexShrink: 0,
        }} />

        {/* ── Header ─────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-5 pb-3 flex-shrink-0">
          <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'linear-gradient(135deg,#1268ff,#06b6d4)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </span>
            Create Issue
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {!titleReady
              ? 'Start by giving your issue a clear, descriptive title'
              : 'Fill in the details below, then submit'
            }
          </p>
        </DialogHeader>

        {/* ── Scrollable body ─────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          <Form {...form}>
            <form id="create-issue-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">

              {/* STEP 1 — Title */}
              <div className="pb-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
                        Title <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Fix login redirect on mobile…"
                          className="text-sm font-medium h-10 bg-muted/20 border-border/50 focus-visible:ring-1 focus-visible:ring-blue-400/50 focus-visible:border-blue-400/50 transition-all"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              </div>

              {/* STEP 2 — Duplicate / similar warning */}
              <AnimatePresence>
                {similarIssues.length > 0 && !aiDismissed && (
                  <motion.div {...slideIn} className="overflow-hidden mb-4">
                    <div className={`relative rounded-xl border px-4 py-3 text-xs ${
                      highSimilarity
                        ? 'bg-red-50/70 border-red-200 dark:bg-red-950/30'
                        : 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30'
                    }`}>
                      <div className="flex items-center gap-2 font-semibold mb-1.5" style={{ color: highSimilarity ? '#dc2626' : '#d97706' }}>
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                        {highSimilarity ? 'Possible Duplicate Detected' : 'Similar Issues Found'}
                      </div>
                      <div className="space-y-1">
                        {similarIssues.slice(0, 3).map((si: any) => (
                          <div key={si.issueKey || si.id} className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-muted-foreground">{si.issueKey}</span>
                            <span className="text-gray-700 dark:text-gray-300 truncate">{si.title}</span>
                            <Badge variant="outline" className="text-[9px] ml-auto flex-shrink-0">
                              {Math.round(si.similarity * 100)}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setAiDismissed(true)}
                        className="absolute top-2.5 right-2.5 p-1 rounded-md hover:bg-black/5 transition-colors"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* STEP 2 — Description (revealed when title ≥3 chars) */}
              <AnimatePresence>
                {titleReady && (
                  <motion.div {...slideIn} className="overflow-hidden">
                    <div className="pb-4">
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between mb-1.5">
                              <FormLabel className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 m-0">
                                Description
                              </FormLabel>
                              <div className="flex items-center gap-1">
                                {isAILoading && (
                                  <span className="flex items-center gap-1 text-[10px] text-purple-500">
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" /> AI analyzing…
                                  </span>
                                )}
                                {/* Generate / Regenerate button — always shown when title ≥5 */}
                                {title.length >= 5 && (
                                  <button
                                    type="button"
                                    onClick={handleGenerateDescription}
                                    disabled={isGeneratingDesc}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors disabled:opacity-40"
                                    title={description ? 'Regenerate description from title' : 'Generate description from title'}
                                  >
                                    {isGeneratingDesc
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <Wand2 className="h-3 w-3" />}
                                    {description ? 'Regenerate' : 'Generate'}
                                  </button>
                                )}
                                <WritingAssistant
                                  text={description}
                                  onTextChange={v => form.setValue('description', v)}
                                  type="description"
                                  title={title}
                                />
                              </div>
                            </div>
                            <FormControl>
                              <Textarea
                                placeholder="Describe what needs to be done, why it matters, and any relevant context…"
                                className="min-h-[90px] text-sm bg-muted/20 border-border/50 focus-visible:ring-1 focus-visible:ring-blue-400/50 resize-none transition-all"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>


              {/* AI unavailable note */}
              <AnimatePresence>
                {aiHasError && !aiDismissed && debouncedTitle.length >= 10 && (
                  <motion.div {...slideIn} className="overflow-hidden">
                    <div className="mb-4 flex items-center gap-2 rounded-xl bg-muted/30 border border-border/40 px-3.5 py-2.5 text-xs text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                      AI suggestions unavailable — you can still create the issue normally.
                      <button type="button" onClick={() => setAiDismissed(true)} className="ml-auto p-0.5 hover:opacity-70">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* STEP 3 — Attributes (revealed when title ready) */}
              <AnimatePresence>
                {titleReady && (
                  <motion.div {...slideIn} className="overflow-hidden">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-2">
                      Attributes
                    </div>
                    <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-4 mb-4">
                      {/* Row 1: Type + Priority */}
                      <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={form.control}
                              name="typeId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] font-medium text-muted-foreground/70">
                                    Type <span className="text-red-500">*</span>
                                  </FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-9 text-sm bg-background/60 border-border/50 focus:ring-1 focus:ring-blue-400/40">
                                        <SelectValue placeholder="Select type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {filteredIssueTypes.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage className="text-[10px]" />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="priorityId"
                              render={({ field }) => {
                                const selectedPriority = priorities?.find(p => p.id === field.value);
                                const dotColor = selectedPriority
                                  ? (PRIORITY_COLORS[selectedPriority.name.toLowerCase()] ?? '#94a3b8')
                                  : undefined;
                                return (
                                  <FormItem>
                                    <FormLabel className="text-[11px] font-medium text-muted-foreground/70">
                                      Priority <span className="text-red-500">*</span>
                                    </FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="h-9 text-sm bg-background/60 border-border/50 focus:ring-1 focus:ring-blue-400/40">
                                          {dotColor ? (
                                            <div className="flex items-center gap-2">
                                              <span
                                                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ background: dotColor }}
                                              />
                                              <span>{selectedPriority?.name}</span>
                                            </div>
                                          ) : (
                                            <SelectValue placeholder="Select priority" />
                                          )}
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {priorities?.map(p => (
                                          <SelectItem key={p.id} value={p.id}>
                                            <div className="flex items-center gap-2">
                                              <span
                                                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ background: PRIORITY_COLORS[p.name.toLowerCase()] ?? '#94a3b8' }}
                                              />
                                              {p.name}
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage className="text-[10px]" />
                                  </FormItem>
                                );
                              }}
                            />
                          </div>

                          {/* Row 2: Assignee + Story Points */}
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={form.control}
                              name="assigneeId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] font-medium text-muted-foreground/70">Assignee</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-9 text-sm bg-background/60 border-border/50 focus:ring-1 focus:ring-blue-400/40">
                                        <SelectValue placeholder="Unassigned" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="unassigned">Unassigned</SelectItem>
                                      {members?.map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="storyPoints"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] font-medium text-muted-foreground/70">Story Points</FormLabel>
                                  <Select
                                    onValueChange={v => field.onChange(v ? parseInt(v) : undefined)}
                                    value={field.value?.toString() || ''}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-9 text-sm bg-background/60 border-border/50 focus:ring-1 focus:ring-blue-400/40">
                                        <SelectValue placeholder="Estimate" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {[1, 2, 3, 5, 8, 13, 21].map(n => (
                                        <SelectItem key={n} value={n.toString()}>{n} {n === 1 ? 'pt' : 'pts'}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>

                          {/* Row 2.5: Epic (optional) */}
                          {epics.length > 0 && (
                            <div>
                              <label className="text-[11px] font-medium text-muted-foreground/70 block mb-1.5">Link to Epic (optional)</label>
                              <Select onValueChange={v => setSelectedEpicId(v === 'none' ? '' : v)} value={selectedEpicId || 'none'}>
                                <FormControl>
                                  <SelectTrigger className="h-9 text-sm bg-background/60 border-border/50 focus:ring-1 focus:ring-blue-400/40">
                                    <SelectValue placeholder="No Epic" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">No Epic</SelectItem>
                                  {epics.map((epic: any) => (
                                    <SelectItem key={epic.id} value={epic.id}>
                                      {epic.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {/* Row 3: Due Date */}
                          <FormField
                            control={form.control}
                            name="dueDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[11px] font-medium text-muted-foreground/70">Due Date</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />
                                    <Input
                                      type="date"
                                      className="h-9 pl-9 text-sm bg-background/60 border-border/50 focus-visible:ring-1 focus-visible:ring-blue-400/40"
                                      value={field.value || ''}
                                      onChange={e => field.onChange(e.target.value)}
                                    />
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          {/* Row 4: Attachments */}
                          <div>
                            <label className="text-[11px] font-medium text-muted-foreground/70 mb-1.5 block">
                              Attachments
                            </label>
                            <div
                              onDragOver={onDragOver}
                              onDragLeave={onDragLeave}
                              onDrop={onDrop}
                              onClick={() => fileInputRef.current?.click()}
                              className={`
                                relative flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed
                                cursor-pointer transition-all py-4 px-3 text-center
                                ${isDragging
                                  ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-950/20'
                                  : 'border-border/40 hover:border-blue-300 hover:bg-muted/20'
                                }
                              `}
                            >
                              <Paperclip className={`h-4 w-4 ${isDragging ? 'text-blue-500' : 'text-muted-foreground/40'}`} />
                              <span className="text-[11px] text-muted-foreground">
                                {isDragging ? 'Drop files here' : 'Drag & drop or click to attach files'}
                              </span>
                              <span className="text-[10px] text-muted-foreground/50">Max 10 MB per file</span>
                              <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={e => e.target.files && addFiles(e.target.files)}
                              />
                            </div>

                            {/* File list */}
                            {attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {attachments.map((f, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border/30 px-3 py-1.5"
                                  >
                                    <FileIcon mime={f.type} />
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">{f.name}</span>
                                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{fmtBytes(f.size)}</span>
                                    <button
                                      type="button"
                                      onClick={e => { e.stopPropagation(); removeAttachment(i); }}
                                      className="p-0.5 hover:text-red-500 transition-colors flex-shrink-0"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </form>
          </Form>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-4 pb-5 border-t bg-muted/10 flex-shrink-0"
        >
          {/* Left: attachment count badge */}
          <div className="flex items-center gap-2">
            {attachments.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                {attachments.length} file{attachments.length !== 1 ? 's' : ''} attached
              </span>
            )}
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              form="create-issue-form"
              type="submit"
              size="sm"
              disabled={isSubmitting || !titleReady}
              className="px-6 font-semibold shadow-md shadow-blue-500/20"
              style={{
                background: titleReady
                  ? 'linear-gradient(135deg, #1268ff 0%, #0a50d6 100%)'
                  : undefined,
              }}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />{isUploading ? 'Uploading…' : 'Creating…'}</>
              ) : (
                'Create Issue'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CreateIssueModal;
