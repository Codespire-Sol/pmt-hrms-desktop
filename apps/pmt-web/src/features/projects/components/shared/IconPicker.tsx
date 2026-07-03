import {
  Check,
  Tag,
  Bug,
  CheckCircle2,
  CheckSquare2,
  HelpCircle,
  AlertCircle,
  MessageSquare,
  Zap,
  Play,
  Layers,
  BookOpen,
  GitCommit,
  Sparkles,
  Wrench,
  Hexagon,
  Flag,
  ArrowUp,
  ArrowDown,
  Star,
  Target,
  TrendingUp,
  AlertTriangle,
  Clock,
  Flame,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface IconPickerProps {
  selectedIcon: string;
  onIconChange: (icon: string) => void;
  icons: string[];
  className?: string;
}

export const ICON_MAP: Record<string, LucideIcon> = {
  Flag,
  ArrowUp,
  ArrowDown,
  Flame,
  AlertTriangle,
  AlertCircle,
  Zap,
  Star,
  Tag,
  Bug,
  CheckCircle2,
  CheckSquare2,
  HelpCircle,
  MessageSquare,
  Play,
  Hexagon,
  Layers,
  BookOpen,
  GitCommit,
  Sparkles,
  Wrench,
  Target,
  TrendingUp,
  Clock,
  Shield,
};

export function IconPicker({
  selectedIcon,
  onIconChange,
  icons,
  className
}: IconPickerProps) {
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {icons.map((iconName) => {
        const Icon = ICON_MAP[iconName] || Tag;
        const isSelected = selectedIcon === iconName;

        return (
          <button
            key={iconName}
            type="button"
            title={iconName}
            className={cn(
              "w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all relative overflow-hidden",
              isSelected
                ? "border-primary bg-primary/10 text-primary shadow-sm"
                : "border-border bg-background hover:bg-muted hover:border-muted-foreground/30"
            )}
            onClick={() => onIconChange(iconName)}
            aria-label={`Select icon ${iconName}`}
          >
            <Icon className={cn("w-4 h-4", isSelected ? "text-primary" : "text-muted-foreground")} />
            {isSelected && (
              <div className="absolute top-0 right-0 p-0.5 bg-primary text-white rounded-bl-md">
                <Check className="w-2 h-2" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
