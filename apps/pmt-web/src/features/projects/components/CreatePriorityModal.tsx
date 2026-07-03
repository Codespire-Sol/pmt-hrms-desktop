import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ColorPicker } from './shared/ColorPicker';
import { IconPicker, ICON_MAP } from './shared/IconPicker';

const prioritySchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(50, 'Name must be less than 50 characters')
    .regex(/^[a-z0-9_-]+$/, 'Name must only contain lowercase letters, numbers, hyphens, and underscores'),
  displayName: z.string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be less than 100 characters'),
  description: z.string()
    .max(255, 'Description must be less than 255 characters')
    .optional(),
  icon: z.string().optional(),
  color: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (#RRGGBB)')
    .optional(),
  level: z.number()
    .min(0, 'Level must be at least 0')
    .max(100, 'Level must be at most 100'),
});

type PriorityFormData = z.infer<typeof prioritySchema>;

interface CreatePriorityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSubmit: (data: PriorityFormData) => void | Promise<void>;
  initialData?: Partial<PriorityFormData>;
  isSubmitting?: boolean;
}

const PRESET_COLORS = [
  '#2563eb', '#16a34a', '#7c3aed', '#9333ea',
  '#dc2626', '#ea580c', '#d97706', '#ca8a04',
  '#0891b2', '#0284c7', '#059669', '#65a30d',
  '#1e3a5f', '#374151', '#6b7280', '#9ca3af',
];

const PRESET_ICONS = [
  'Flag', 'ArrowUp', 'ArrowDown', 'Flame',
  'AlertTriangle', 'AlertCircle', 'Zap', 'Star',
  'Tag', 'Bug', 'Target', 'Shield',
  'Layers', 'Sparkles', 'Clock', 'CheckCircle2',
];

const PRIORITY_LEVELS = [
  { value: 20, label: 'Low',     color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  { value: 40, label: 'Medium',  color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { value: 60, label: 'High',    color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
  { value: 80, label: 'Highest', color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
];

export function CreatePriorityModal({
  open,
  onOpenChange,
  projectId,
  onSubmit,
  initialData,
  isSubmitting = false,
}: CreatePriorityModalProps) {
  const [selectedColor, setSelectedColor] = useState(initialData?.color || PRESET_COLORS[0]);
  const [selectedIcon,  setSelectedIcon]  = useState(initialData?.icon  || PRESET_ICONS[0]);

  const form = useForm<PriorityFormData>({
    resolver: zodResolver(prioritySchema),
    defaultValues: {
      name: '',
      displayName: '',
      description: '',
      icon: selectedIcon,
      color: selectedColor,
      level: 50,
      ...initialData,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: '',
        displayName: '',
        description: '',
        icon: selectedIcon,
        color: selectedColor,
        level: 50,
        ...initialData,
      });
      if (initialData.color) setSelectedColor(initialData.color);
      if (initialData.icon)  setSelectedIcon(initialData.icon);
    }
  }, [initialData]);

  const currentLevel       = form.watch('level');
  const currentDisplayName = form.watch('displayName');

  const handleSubmit = async (data: PriorityFormData) => {
    try {
      await onSubmit({ ...data, icon: selectedIcon, color: selectedColor });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to submit priority:', error);
    }
  };

  const handleReset = () => {
    form.reset();
    setSelectedColor(PRESET_COLORS[0]);
    setSelectedIcon(PRESET_ICONS[0]);
  };

  useEffect(() => {
    if (!open) handleReset();
  }, [open]);

  const getLevelInfo = (level: number) =>
    PRIORITY_LEVELS.reduce((prev, curr) =>
      Math.abs(curr.value - level) < Math.abs(prev.value - level) ? curr : prev
    );

  const levelInfo   = getLevelInfo(currentLevel);
  const PreviewIcon = ICON_MAP[selectedIcon] || ICON_MAP['Flag'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Gradient accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

        <DialogHeader className="pt-2">
          <DialogTitle className="text-lg font-bold">
            {initialData ? 'Edit Priority' : 'Create New Priority'}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? 'Update the priority level configuration.'
              : 'Define a new priority level for your project issues.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 pt-2">

            {/* Name + Display Name */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="high"
                        {...field}
                        onChange={(e) => {
                          const value = e.target.value.toLowerCase().replace(/\s+/g, '_');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Lowercase, no spaces</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="High" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Shown to all team members</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe this priority level..."
                      rows={2}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Optional description for team members</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority Level */}
            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority Level</FormLabel>
                  <FormControl>
                    <div className="space-y-3 pt-1">
                      <Slider
                        min={0}
                        max={100}
                        step={10}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="w-full"
                      />
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">Level {field.value}</span>
                          <span className={`text-sm font-medium ${levelInfo.color}`}>
                            ({levelInfo.label})
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          {PRIORITY_LEVELS.map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => field.onChange(preset.value)}
                              className={`px-3 py-1 text-xs font-medium rounded-md border transition-all ${
                                Math.abs(field.value - preset.value) < 5
                                  ? `${preset.bg} ${preset.border} ${preset.color} border-2`
                                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Higher numbers indicate higher priority (0–100)</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Icon + Color side by side */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <FormLabel>Icon</FormLabel>
                <IconPicker
                  selectedIcon={selectedIcon}
                  onIconChange={setSelectedIcon}
                  icons={PRESET_ICONS}
                />
              </div>
              <div className="space-y-2">
                <FormLabel>Color</FormLabel>
                <ColorPicker
                  selectedColor={selectedColor}
                  onColorChange={setSelectedColor}
                  colors={PRESET_COLORS}
                />
              </div>
            </div>

            {/* Preview */}
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: `${selectedColor}40`, background: `${selectedColor}08` }}
            >
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Preview
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: `${selectedColor}20`, border: `1.5px solid ${selectedColor}40` }}
                >
                  <PreviewIcon className="w-4 h-4" style={{ color: selectedColor }} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">
                    {currentDisplayName || 'Priority Name'}
                  </span>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${selectedColor}15`,
                      color: selectedColor,
                      border: `1px solid ${selectedColor}30`,
                    }}
                  >
                    Level {currentLevel}
                  </span>
                  <span className={`text-xs font-medium ${levelInfo.color}`}>
                    {levelInfo.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="pt-2 pb-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {initialData ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  initialData ? 'Update Priority' : 'Create Priority'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
