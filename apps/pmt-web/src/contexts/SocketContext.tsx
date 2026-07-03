import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { ENV } from '@/lib/env';
import { toast } from '@/hooks/useToast';
import { issuesApi } from '@/features/issues/issuesApi';
import { boardsApi } from '@/features/boards/boardsApi';
import { sprintsApi } from '@/features/sprints/sprintsApi';
import { commentsApi } from '@/features/comments/commentsApi';
import { dashboardApi } from '@/features/dashboard/dashboardApi';
import { projectsApi } from '@/features/projects/projectsApi';
import { notificationsApi } from '@/features/notifications/notificationsApi';
import { attachmentsApi } from '@/features/attachments/attachmentsApi';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  emit: (event: string, data?: any) => void;
  onlineUsers: Set<string>;
}

const SocketContext = createContext<SocketContextValue | null>(null);

// Event types for real-time updates
export interface IssueUpdateEvent {
  issueId: string;
  projectId: string;
  action: 'created' | 'updated' | 'deleted' | 'moved';
  data: any;
  userId: string;
  userName: string;
}

export interface CommentEvent {
  commentId: string;
  issueId: string;
  action: 'created' | 'updated' | 'deleted';
  data: any;
  userId: string;
  userName: string;
}

export interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  createdAt: string;
}

export interface PresenceEvent {
  userId: string;
  userName: string;
  action: 'join' | 'leave';
  room: string;
}

interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const currentUser = useAppSelector((state) => state.auth.user);
  const joinedRooms = useRef<Set<string>>(new Set());
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!accessToken) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsConnected(false);
      setOnlineUsers(new Set());
      return;
    }

    const wsUrl = ENV.WS_URL || undefined;
    const newSocket = io(wsUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket] Connected');

      // Rejoin rooms after reconnection
      joinedRooms.current.forEach((room) => {
        newSocket.emit('join', room);
      });
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket] Disconnected:', reason);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
    });

    // Handle server-side auth expiry (token revoked or account deactivated)
    newSocket.on('auth:expired', (data: { reason: string }) => {
      console.warn('[Socket] Auth expired:', data.reason);
      newSocket.disconnect();
    });

    // ── Global RTK Query cache invalidation on socket events ──────────────────
    // These listeners run for ALL connected users, not just per-component
    // subscribers, so every open view refreshes immediately without polling.

    const invalidateIssueData = (event: IssueUpdateEvent) => {
      // Invalidate the specific issue + the full list for the project
      dispatch(issuesApi.util.invalidateTags([
        { type: 'Issue', id: event.issueId },
        { type: 'Issue', id: 'LIST' },
      ]));
      // Cascade: board columns, sprint, and all dashboard widgets need refresh
      dispatch(boardsApi.util.invalidateTags(['Board']));
      dispatch(sprintsApi.util.invalidateTags(['Sprint', 'Backlog']));
      dispatch(dashboardApi.util.invalidateTags([
        'Dashboard',
        { type: 'ProjectDashboard', id: event.projectId },
      ]));
    };

    newSocket.on('issue:created', invalidateIssueData);
    newSocket.on('issue:updated', invalidateIssueData);
    newSocket.on('issue:deleted', invalidateIssueData);
    // issue:moved is handled optimistically by KanbanBoardPage — only
    // invalidate non-board caches (sprint counts, dashboard widgets).
    // Invalidating 'Board' here would wipe the optimistic UI and cause
    // a visible full-board refresh on every drag-and-drop.
    newSocket.on('issue:moved', (event: any) => {
      // Backend sends { issue, movedBy, timestamp } — extract IDs safely
      const issueId = event?.issue?.id ?? event?.issueId;
      const projectId = event?.issue?.project_id ?? event?.projectId;
      dispatch(issuesApi.util.invalidateTags([
        { type: 'Issue', id: issueId },
        { type: 'Issue', id: 'LIST' },
      ]));
      dispatch(sprintsApi.util.invalidateTags(['Sprint', 'Backlog']));
      dispatch(dashboardApi.util.invalidateTags([
        'Dashboard',
        ...(projectId ? [{ type: 'ProjectDashboard' as const, id: projectId }] : []),
      ]));
    });

    const invalidateCommentData = (event: CommentEvent) => {
      dispatch(commentsApi.util.invalidateTags([
        { type: 'Comment' as const, id: `LIST-${event.issueId}` },
        { type: 'Activity' as const, id: `LIST-${event.issueId}` },
      ]));
      // Comment count on the parent issue also needs to update
      dispatch(issuesApi.util.invalidateTags([
        { type: 'Issue', id: event.issueId },
      ]));
    };

    newSocket.on('comment:created', invalidateCommentData);
    newSocket.on('comment:updated', invalidateCommentData);
    newSocket.on('comment:deleted', invalidateCommentData);

    const invalidateAttachmentData = (event: { issueId: string }) => {
      dispatch(attachmentsApi.util.invalidateTags([
        { type: 'Attachment' as const, id: `ISSUE-${event.issueId}` },
      ]));
      dispatch(issuesApi.util.invalidateTags([
        { type: 'Issue', id: event.issueId },
      ]));
    };

    newSocket.on('attachment:created', invalidateAttachmentData);
    newSocket.on('attachment:deleted', invalidateAttachmentData);

    const invalidateProjectData = (event: { projectId: string }) => {
      dispatch(projectsApi.util.invalidateTags([
        'Project' as const,
        { type: 'Project' as const, id: event.projectId },
        'ProjectMember' as const,
      ]));
      dispatch(dashboardApi.util.invalidateTags([
        'Dashboard',
        { type: 'ProjectDashboard', id: event.projectId },
      ]));
    };

    newSocket.on('project:updated', invalidateProjectData);
    newSocket.on('project:member:added', invalidateProjectData);
    newSocket.on('project:member:removed', invalidateProjectData);

    // ─────────────────────────────────────────────────────────────────────────

    // Handle real-time notifications
    newSocket.on('notification:new', (notification: NotificationEvent) => {
      toast.info(notification.title, notification.message);
      // Also refresh notification badge count
      dispatch(notificationsApi.util.invalidateTags([
        'Notifications' as const,
        'UnreadCount' as const,
      ]));
    });

    // Handle presence updates
    newSocket.on('presence:update', (users: string[]) => {
      setOnlineUsers(new Set(users));
    });

    newSocket.on('presence:join', (event: PresenceEvent) => {
      if (event.userId !== currentUser?.id) {
        setOnlineUsers((prev) => new Set([...prev, event.userId]));
      }
    });

    newSocket.on('presence:leave', (event: PresenceEvent) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(event.userId);
        return next;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [accessToken, currentUser?.id, dispatch]);

  const joinRoom = useCallback((room: string) => {
    if (socket && isConnected) {
      socket.emit('join', room);
      joinedRooms.current.add(room);
    }
  }, [socket, isConnected]);

  const leaveRoom = useCallback((room: string) => {
    if (socket && isConnected) {
      socket.emit('leave', room);
      joinedRooms.current.delete(room);
    }
  }, [socket, isConnected]);

  const emit = useCallback((event: string, data?: any) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    }
  }, [socket, isConnected]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        joinRoom,
        leaveRoom,
        emit,
        onlineUsers,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}

// Hook for subscribing to real-time issue updates
export function useRealtimeIssues(projectId: string | undefined, onUpdate?: (event: IssueUpdateEvent) => void) {
  const { socket, isConnected, joinRoom, leaveRoom } = useSocketContext();

  useEffect(() => {
    if (!projectId || !isConnected) return;

    const room = `project:${projectId}`;
    joinRoom(room);

    return () => {
      leaveRoom(room);
    };
  }, [projectId, isConnected, joinRoom, leaveRoom]);

  useEffect(() => {
    if (!socket || !onUpdate) return;

    const handleUpdate = (event: IssueUpdateEvent) => {
      if (event.projectId === projectId) {
        onUpdate(event);
      }
    };

    socket.on('issue:created', handleUpdate);
    socket.on('issue:updated', handleUpdate);
    socket.on('issue:deleted', handleUpdate);
    socket.on('issue:moved', handleUpdate);

    return () => {
      socket.off('issue:created', handleUpdate);
      socket.off('issue:updated', handleUpdate);
      socket.off('issue:deleted', handleUpdate);
      socket.off('issue:moved', handleUpdate);
    };
  }, [socket, projectId, onUpdate]);
}

// Hook for subscribing to real-time comment updates
export function useRealtimeComments(issueId: string | undefined, onUpdate?: (event: CommentEvent) => void) {
  const { socket, isConnected, joinRoom, leaveRoom } = useSocketContext();

  useEffect(() => {
    if (!issueId || !isConnected) return;

    const room = `issue:${issueId}`;
    joinRoom(room);

    return () => {
      leaveRoom(room);
    };
  }, [issueId, isConnected, joinRoom, leaveRoom]);

  useEffect(() => {
    if (!socket || !onUpdate) return;

    const handleUpdate = (event: CommentEvent) => {
      if (event.issueId === issueId) {
        onUpdate(event);
      }
    };

    socket.on('comment:created', handleUpdate);
    socket.on('comment:updated', handleUpdate);
    socket.on('comment:deleted', handleUpdate);

    return () => {
      socket.off('comment:created', handleUpdate);
      socket.off('comment:updated', handleUpdate);
      socket.off('comment:deleted', handleUpdate);
    };
  }, [socket, issueId, onUpdate]);
}

// Hook for checking if a user is online
export function useUserPresence(userId: string | undefined) {
  const { onlineUsers } = useSocketContext();
  return userId ? onlineUsers.has(userId) : false;
}

export default SocketProvider;
