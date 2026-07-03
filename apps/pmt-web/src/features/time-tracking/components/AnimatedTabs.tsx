import { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TS } from './timesheet-styles';

interface Tab {
  value: string;
  label: string;
  icon: React.ReactNode;
  hidden?: boolean;
}

interface AnimatedTabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function AnimatedTabs({ tabs, value, onChange, className }: AnimatedTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check reduced-motion preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Measure active tab and position indicator
  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-tab-value="${value}"]`) as HTMLElement;
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      });
    }
  }, [value]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // Re-measure on resize
  useEffect(() => {
    const observer = new ResizeObserver(() => updateIndicator());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateIndicator]);

  const visibleTabs = tabs.filter((t) => !t.hidden);

  return (
    <div
      ref={containerRef}
      className={cn('relative flex items-center gap-0.5', className)}
      style={{ borderBottom: `1px solid ${TS.border}` }}
    >
      {visibleTabs.map((tab) => (
        <button
          key={tab.value}
          data-tab-value={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold transition-colors duration-150 relative',
            'hover:text-[#101828] outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-t-lg',
            value === tab.value ? 'text-[#1268ff]' : 'text-[#667085]',
          )}
        >
          <span className="flex-shrink-0 [&>svg]:h-4 [&>svg]:w-4">{tab.icon}</span>
          {tab.label}
        </button>
      ))}

      {/* Sliding underline indicator */}
      <motion.div
        className="absolute bottom-0 h-[2px] rounded-full"
        style={{ backgroundColor: TS.primary }}
        animate={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
        }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 500, damping: 35 }
        }
      />
    </div>
  );
}
