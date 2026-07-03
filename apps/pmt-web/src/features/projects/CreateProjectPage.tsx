import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  ArrowLeft, Search, Check, ChevronDown,
  FolderKanban, Hash, Calendar, Users, FileText, Sparkles
} from 'lucide-react';
import { useCreateProjectMutation, useGetCategoriesQuery } from './projectsApi';
import { useGetUsersQuery } from '../users/usersApi';
import { RootState } from '../../app/store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Textarea } from '../../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { cn, normalizeAvatarUrl } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().substring(0, 2);

// ─── Section heading helper ───────────────────────────────────────────────────
function SectionHeading({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex items-center justify-center w-6 h-6 rounded bg-primary/10">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <span className="text-sm font-semibold text-foreground/80 tracking-wide uppercase">{label}</span>
      <div className="flex-1 h-px bg-border ml-1" />
    </div>
  );
}

export function CreateProjectPage() {
  const navigate = useNavigate();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [createProject, { isLoading }] = useCreateProjectMutation();
  const { data: categories } = useGetCategoriesQuery({});
  const { data: usersData, isLoading: isLoadingUsers } = useGetUsersQuery({ limit: 100 });
  const [error, setError] = useState('');
  const [isKeyManual, setIsKeyManual] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLeadPopoverOpen, setIsLeadPopoverOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    key: '',
    description: '',
    categoryId: '',
    leadId: '',
    startDate: '',
    targetEndDate: '',
  });

  const filteredUsers = useMemo(() => {
    if (!usersData?.users) return [];
    return usersData.users.filter(
      (user) =>
        user.isActive &&
        user.isVerified &&
        (user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [usersData?.users, searchQuery]);

  const selectedLead = useMemo(
    () => usersData?.users.find((u) => u.id === formData.leadId),
    [usersData?.users, formData.leadId]
  );

  const selectedCategory = useMemo(
    () => categories?.find((c) => c.id === formData.categoryId),
    [categories, formData.categoryId]
  );
  const softwareCategory = useMemo(
    () =>
      categories?.find(
        (c) => c.slug?.toLowerCase() === 'software' || c.name?.toLowerCase() === 'software'
      ),
    [categories]
  );

  // Default lead = current user
  useEffect(() => {
    if (currentUser?.id && !formData.leadId) {
      setFormData((prev) => ({ ...prev, leadId: currentUser.id }));
    }
  }, [currentUser, formData.leadId]);

  // Default project type = Software (fallback to first active category)
  useEffect(() => {
    if (formData.categoryId || !categories?.length) return;
    const fallbackCategory = categories.find((c) => c.isActive) || categories[0];
    const defaultCategory = softwareCategory || fallbackCategory;
    if (defaultCategory?.id) {
      setFormData((prev) => ({ ...prev, categoryId: defaultCategory.id }));
    }
  }, [categories, softwareCategory, formData.categoryId]);

  // Auto-generate key from name
  useEffect(() => {
    if (!isKeyManual && formData.name) {
      const words = formData.name.trim().split(/\s+/);
      const generated =
        words.length >= 2
          ? words.map((w) => w[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10)
          : formData.name.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4);

      if (generated.length >= 2 && /^[A-Z]/.test(generated)) {
        setFormData((prev) => ({ ...prev, key: generated }));
      }
    }
  }, [formData.name, isKeyManual]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.key || !formData.leadId) {
      setError('Project name, key, and lead are required.');
      return;
    }

    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(formData.key)) {
      setError('Project key must start with a letter and be 2–10 uppercase letters/numbers.');
      return;
    }

    if (formData.startDate && formData.targetEndDate && formData.targetEndDate < formData.startDate) {
      setError('Due date cannot be before the start date.');
      return;
    }

    try {
      const payload: any = {
        name: formData.name,
        key: formData.key,
        description: formData.description || undefined,
        categoryId: formData.categoryId || undefined,
        category: selectedCategory?.name || 'software',
        leadId: formData.leadId,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        targetEndDate: formData.targetEndDate ? new Date(formData.targetEndDate).toISOString() : undefined,
      };
      const project = await createProject(payload).unwrap();
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err?.data?.error?.message || 'Failed to create project. Please try again.');
    }
  };

  // ─── Computed preview values ──────────────────────────────────────────────
  const keyPreview = formData.key || 'KEY';
  const namePreview = formData.name || 'Project Name';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-border/60 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <FolderKanban className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-lg font-bold truncate">Create New Project</h1>
          </div>
          {formData.name && (
            <Badge variant="secondary" className="ml-auto shrink-0 font-mono text-xs">
              {keyPreview}
            </Badge>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* ── Preview banner ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-blue-500/5 p-5"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/15 border border-primary/20 shrink-0">
              <FolderKanban className="h-7 w-7 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-foreground truncate">
                {namePreview}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                  {keyPreview}
                </Badge>
                {selectedCategory && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedCategory.name}
                  </Badge>
                )}
                {selectedLead && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={normalizeAvatarUrl(selectedLead.avatarUrl)} />
                      <AvatarFallback className="text-[8px]">{getInitials(selectedLead.displayName)}</AvatarFallback>
                    </Avatar>
                    <span>{selectedLead.displayName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <Sparkles className="absolute right-4 top-4 h-5 w-5 text-primary/20" />
        </motion.div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Section 1: Basic Info ── */}
          <div className="bg-white rounded-xl border border-border/60 p-6 shadow-sm">
            <SectionHeading icon={FolderKanban} label="Basic Info" />

            {/* Name + Key */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">
                  Project Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g. Mobile App Redesign"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-10"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="key" className="text-sm font-medium flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  Project Key <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="key"
                  placeholder="MAR"
                  value={formData.key}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    setFormData({ ...formData, key: value });
                    setIsKeyManual(true);
                  }}
                  maxLength={10}
                  className="h-10 font-mono tracking-widest"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  {!isKeyManual && formData.name ? '✦ Auto-generated from name' : '2–10 chars, uppercase'}
                </p>
              </div>
            </div>

            {/* Lead */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Project Lead <span className="text-red-500">*</span>
                </Label>
                <Popover open={isLeadPopoverOpen} onOpenChange={setIsLeadPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isLeadPopoverOpen}
                      className="w-full h-10 justify-between px-3 bg-background hover:bg-accent/30 border-input"
                    >
                      {selectedLead ? (
                        <div className="flex items-center gap-2.5 text-left min-w-0">
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarImage src={normalizeAvatarUrl(selectedLead.avatarUrl)} />
                            <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                              {getInitials(selectedLead.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate">{selectedLead.displayName}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Choose a lead...</span>
                      )}
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-40 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <div className="flex items-center border-b px-3 py-2 gap-2">
                      <Search className="h-4 w-4 shrink-0 opacity-40" />
                      <input
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Search team members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                      {isLoadingUsers ? (
                        <p className="p-3 text-center text-sm text-muted-foreground animate-pulse">
                          Loading...
                        </p>
                      ) : filteredUsers.length === 0 ? (
                        <p className="p-3 text-center text-sm text-muted-foreground">No users found.</p>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {filteredUsers.map((user) => (
                            <motion.div
                              key={user.id}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.12 }}
                              className={cn(
                                'flex w-full cursor-pointer select-none items-center gap-3 rounded-sm px-3 py-2.5 text-sm hover:bg-accent transition-colors',
                                formData.leadId === user.id && 'bg-accent/60'
                              )}
                              onClick={() => {
                                setFormData({ ...formData, leadId: user.id });
                                setIsLeadPopoverOpen(false);
                                setSearchQuery('');
                              }}
                            >
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage src={normalizeAvatarUrl(user.avatarUrl)} />
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                                  {getInitials(user.displayName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate leading-none mb-0.5">{user.displayName}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {user.designation || user.department || user.email}
                                </p>
                              </div>
                              {formData.leadId === user.id && (
                                <Check className="h-4 w-4 text-primary shrink-0" />
                              )}
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* ── Section 2: Timeline ── */}
          <div className="bg-white rounded-xl border border-border/60 p-6 shadow-sm">
            <SectionHeading icon={Calendar} label="Timeline" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="startDate" className="text-sm font-medium">
                  Start Date
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => { setFormData({ ...formData, startDate: e.target.value }); e.target.blur(); }}
                  className="h-10"
                />
                <p className="text-[11px] text-muted-foreground">When does the project kick off?</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="targetEndDate" className="text-sm font-medium">
                  Due Date
                </Label>
                <Input
                  id="targetEndDate"
                  type="date"
                  value={formData.targetEndDate}
                  min={formData.startDate || undefined}
                  onChange={(e) => { setFormData({ ...formData, targetEndDate: e.target.value }); e.target.blur(); }}
                  className="h-10"
                />
                <p className="text-[11px] text-muted-foreground">Target completion date.</p>
              </div>
            </div>

            {/* Duration indicator */}
            {formData.startDate && formData.targetEndDate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3"
              >
                {(() => {
                  const days = Math.round(
                    (new Date(formData.targetEndDate).getTime() - new Date(formData.startDate).getTime()) /
                      86400000
                  );
                  if (days < 0) return null;
                  const weeks = Math.floor(days / 7);
                  const label =
                    days === 0
                      ? 'Same day'
                      : days < 7
                      ? `${days} day${days !== 1 ? 's' : ''}`
                      : weeks < 4
                      ? `${weeks} week${weeks !== 1 ? 's' : ''} (${days} days)`
                      : `${Math.round(days / 30)} month${Math.round(days / 30) !== 1 ? 's' : ''} (${days} days)`;
                  return (
                    <div className="inline-flex items-center gap-1.5 text-xs text-primary bg-primary/10 rounded-full px-3 py-1 border border-primary/20">
                      <Calendar className="h-3 w-3" />
                      Duration: <strong>{label}</strong>
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </div>

          {/* ── Section 3: Description ── */}
          <div className="bg-white rounded-xl border border-border/60 p-6 shadow-sm">
            <SectionHeading icon={FileText} label="Description" />

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium">
                Project Description
                <span className="text-muted-foreground font-normal ml-1.5">(optional)</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Describe the project goals, scope, and any relevant context..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground text-right">
                {formData.description.length} characters
              </p>
            </div>
          </div>

          {/* ── Footer actions ── */}
          <div className="flex items-center justify-between pt-1 pb-6">
            <Button type="button" variant="ghost" onClick={() => navigate('/projects')}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.name || !formData.key || !formData.leadId}
              className="min-w-[140px]"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4" />
                  Create Project
                </span>
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
