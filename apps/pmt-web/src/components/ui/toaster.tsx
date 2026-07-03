import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  accentColor,
} from '@/components/ui/toast';
import { useToast } from '@/hooks/useToast';

// Variant configuration
const VARIANT_CONFIG: Record<string, {
  icon: React.ReactNode;
  duration: number;
  iconBg: string;
}> = {
  destructive: {
    icon: <XCircle className="h-4 w-4" />,
    duration: 5000,
    iconBg: '#ef4444',
  },
  success: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    duration: 3500,
    iconBg: '#10b981',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    duration: 4500,
    iconBg: '#f59e0b',
  },
  default: {
    icon: <Info className="h-4 w-4" />,
    duration: 3500,
    iconBg: '#6366f1',
  },
};

// Progress bar that counts down the auto-dismiss duration
function ToastProgress({ duration, variant }: { duration: number; variant?: string | null }) {
  const [progress, setProgress] = useState(100);
  const color = accentColor[variant ?? 'default'] ?? accentColor.default;

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [duration]);

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: 2,
        background: 'rgba(0,0,0,0.06)',
        borderRadius: '0 0 16px 16px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: color,
          opacity: 0.7,
          transition: 'width 30ms linear',
          borderRadius: '0 2px 2px 0',
        }}
      />
    </div>
  );
}

const MAX_DESC_LENGTH = 120;

function sanitizeDescription(desc: React.ReactNode): React.ReactNode {
  if (typeof desc !== 'string') return desc;
  if (desc.length <= MAX_DESC_LENGTH) return desc;
  return desc.slice(0, MAX_DESC_LENGTH).trimEnd() + '…';
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={3500}>
      {toasts.map(({ id, title, description, action, variant, ...props }) => {
        const key = variant ?? 'default';
        const cfg = VARIANT_CONFIG[key] ?? VARIANT_CONFIG.default;

        return (
          <Toast key={id} variant={variant} duration={cfg.duration} {...props}>
            {/* Inner content row — pl-5 to clear the left accent bar */}
            <div className="flex items-start gap-3 pl-5 pr-8 pt-3.5 pb-4 min-w-0">
              {/* Icon badge */}
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28, height: 28,
                  borderRadius: 8,
                  background: `${cfg.iconBg}22`,
                  color: cfg.iconBg,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {cfg.icon}
              </span>

              {/* Text */}
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{sanitizeDescription(description)}</ToastDescription>
                )}
              </div>

              {/* Action */}
              {action && (
                <div className="flex-shrink-0 mt-0.5">{action}</div>
              )}
            </div>

            {/* Auto-dismiss progress bar */}
            <ToastProgress duration={cfg.duration} variant={variant} />

            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
