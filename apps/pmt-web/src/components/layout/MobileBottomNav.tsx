import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  LayoutGrid,
  FolderKanban,
  User,
  Plus,
  Clock,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: LayoutGrid, label: 'Projects', path: '/projects' },
  { icon: Clock, label: 'Timesheet', path: '/timesheet' },
  { icon: Bell, label: 'Alerts', path: '/notifications' },
  { icon: User, label: 'Profile', path: '/profile' },
];

interface MobileBottomNavProps {
  onCreateClick?: () => void;
  showCreateButton?: boolean;
}

export function MobileBottomNav({
  onCreateClick,
  showCreateButton = true,
}: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center w-full h-full relative transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'scale-110')} />
                <span className={cn('text-xs mt-1', active && 'font-medium')}>
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <span className="absolute top-1 right-1/4 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button */}
      {showCreateButton && (
        <button
          onClick={onCreateClick}
          className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Create new"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </>
  );
}

// Slim variant for less prominent navigation
export function MobileBottomNavSlim() {
  const location = useLocation();
  const navigate = useNavigate();

  const slimItems: NavItem[] = [
    { icon: Home, label: 'Home', path: '/dashboard' },
    { icon: LayoutGrid, label: 'Projects', path: '/projects' },
    { icon: Clock, label: 'Time', path: '/timesheet' },
    { icon: User, label: 'Me', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t safe-area-pb">
      <div className="flex items-center justify-around h-14">
        {slimItems.map((item) => {
          const Icon = item.icon;
          const active =
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`);

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
