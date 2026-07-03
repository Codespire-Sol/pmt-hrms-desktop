import React, { useState } from 'react';
import { Menu, Bell, Search, X } from 'lucide-react';
import { useIsMobile, useIsTablet } from '@/hooks/useMediaQuery';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MobileBottomNav } from './MobileBottomNav';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  header?: React.ReactNode;
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  notifications?: number;
  onNotificationsClick?: () => void;
  onSearchClick?: () => void;
  onUserClick?: () => void;
}

export function ResponsiveLayout({
  children,
  sidebar,
  header,
  user,
  notifications = 0,
  onNotificationsClick,
  onSearchClick,
  onUserClick,
}: ResponsiveLayoutProps) {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Mobile Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between h-14 px-4 bg-background border-b">
          <div className="flex items-center gap-2">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between p-4 border-b">
                    <span className="font-semibold text-lg">codeSpire solutions</span>
                    <SheetClose asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    </SheetClose>
                  </div>
                  <div className="flex-1 overflow-y-auto">{sidebar}</div>
                </div>
              </SheetContent>
            </Sheet>

            <span className="font-semibold">codeSpire solutions</span>
          </div>

          <div className="flex items-center gap-1">
            {searchOpen ? (
              <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                <Input
                  type="search"
                  placeholder="Search..."
                  className="h-8"
                  autoFocus
                  onBlur={() => setSearchOpen(false)}
                />
              </div>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="h-5 w-5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 relative"
                  onClick={onNotificationsClick}
                >
                  <Bell className="h-5 w-5" />
                  {notifications > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {notifications > 9 ? '9+' : notifications}
                    </Badge>
                  )}
                </Button>

                {user && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={onUserClick}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.avatarUrl} />
                      <AvatarFallback className="text-xs">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                )}
              </>
            )}
          </div>
        </header>

        {/* Mobile Content */}
        <main className="flex-1 overflow-y-auto pb-16">{children}</main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </div>
    );
  }

  // Tablet Layout
  if (isTablet) {
    return (
      <div className="min-h-screen bg-background flex">
        {/* Collapsible Sidebar */}
        <aside className="w-16 border-r bg-background flex flex-col items-center py-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mb-4">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <div className="flex flex-col h-full">
                <div className="p-4 border-b">
                  <span className="font-semibold text-lg">codeSpire solutions</span>
                </div>
                <div className="flex-1 overflow-y-auto">{sidebar}</div>
              </div>
            </SheetContent>
          </Sheet>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {header && (
            <header className="sticky top-0 z-40 h-14 border-b bg-background px-4 flex items-center">
              {header}
            </header>
          )}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    );
  }

  // Desktop Layout
  return (
    <div className="min-h-screen bg-background flex">
      {/* Full Sidebar */}
      <aside className="w-64 border-r bg-background flex flex-col">
        <div className="p-4 border-b">
          <span className="font-semibold text-lg">codeSpire solutions</span>
        </div>
        <div className="flex-1 overflow-y-auto">{sidebar}</div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {header && (
          <header className="sticky top-0 z-40 h-14 border-b bg-background px-6 flex items-center justify-between">
            {header}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onSearchClick}>
                <Search className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={onNotificationsClick}
              >
                <Bell className="h-5 w-5" />
                {notifications > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {notifications > 9 ? '9+' : notifications}
                  </Badge>
                )}
              </Button>
              {user && (
                <Button variant="ghost" className="gap-2" onClick={onUserClick}>
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user.avatarUrl} />
                    <AvatarFallback className="text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden lg:inline">{user.name}</span>
                </Button>
              )}
            </div>
          </header>
        )}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export default ResponsiveLayout;
