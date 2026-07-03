import { Server, Socket } from 'socket.io';
import { logger } from '../../utils/logger';

// Store for tracking user presence on issues
// In production, this should be stored in Redis for multi-instance support
const issuePresence: Map<string, Map<string, { user: any; joinedAt: Date; isViewing: boolean }>> = new Map();
const userLastActivity: Map<string, Date> = new Map();

interface IssuePresencePayload {
  issueId: string;
}

interface UpdateActivityPayload {
  issueId: string;
  isViewing: boolean;
}

interface CursorPositionPayload {
  issueId: string;
  position: {
    field?: string;
    x?: number;
    y?: number;
  };
}

export function presenceHandler(io: Server, socket: Socket) {
  // Join issue for presence tracking
  socket.on('presence:join', async (payload: IssuePresencePayload) => {
    const { issueId } = payload;
    const roomName = `presence:${issueId}`;
    const userId = socket.data.user.id;

    socket.join(roomName);

    // Track presence
    if (!issuePresence.has(issueId)) {
      issuePresence.set(issueId, new Map());
    }

    const issueUsers = issuePresence.get(issueId)!;
    issueUsers.set(userId, {
      user: socket.data.user,
      joinedAt: new Date(),
      isViewing: true,
    });

    // Update user activity
    userLastActivity.set(userId, new Date());

    // Get all users currently viewing this issue
    const viewers = Array.from(issueUsers.values())
      .filter(v => v.isViewing)
      .map(v => ({
        user: v.user,
        joinedAt: v.joinedAt.toISOString(),
      }));

    // Notify all users in room about updated presence
    io.in(roomName).emit('presence:updated', {
      issueId,
      viewers,
      timestamp: new Date().toISOString(),
    });

    // Notify others about new joiner
    socket.to(roomName).emit('presence:userJoined', {
      issueId,
      user: socket.data.user,
      timestamp: new Date().toISOString(),
    });

    logger.info(`User ${userId} joined presence for issue ${issueId}`);
  });

  // Leave issue presence
  socket.on('presence:leave', (payload: IssuePresencePayload) => {
    const { issueId } = payload;
    const roomName = `presence:${issueId}`;
    const userId = socket.data.user.id;

    socket.leave(roomName);

    // Remove from presence tracking
    const issueUsers = issuePresence.get(issueId);
    if (issueUsers) {
      issueUsers.delete(userId);

      // Clean up empty issue entries
      if (issueUsers.size === 0) {
        issuePresence.delete(issueId);
      }
    }

    // Notify others about user leaving
    socket.to(roomName).emit('presence:userLeft', {
      issueId,
      user: socket.data.user,
      timestamp: new Date().toISOString(),
    });

    // Send updated viewers list
    const viewers = issueUsers
      ? Array.from(issueUsers.values())
          .filter(v => v.isViewing)
          .map(v => ({
            user: v.user,
            joinedAt: v.joinedAt.toISOString(),
          }))
      : [];

    io.in(roomName).emit('presence:updated', {
      issueId,
      viewers,
      timestamp: new Date().toISOString(),
    });

    logger.info(`User ${userId} left presence for issue ${issueId}`);
  });

  // Update activity status (active/away)
  socket.on('presence:activity', (payload: UpdateActivityPayload) => {
    const { issueId, isViewing } = payload;
    const roomName = `presence:${issueId}`;
    const userId = socket.data.user.id;

    // Update presence status
    const issueUsers = issuePresence.get(issueId);
    if (issueUsers && issueUsers.has(userId)) {
      const presence = issueUsers.get(userId)!;
      presence.isViewing = isViewing;
      issueUsers.set(userId, presence);
    }

    // Update activity timestamp
    userLastActivity.set(userId, new Date());

    // Get updated viewers list
    const viewers = issueUsers
      ? Array.from(issueUsers.values())
          .filter(v => v.isViewing)
          .map(v => ({
            user: v.user,
            joinedAt: v.joinedAt.toISOString(),
          }))
      : [];

    // Broadcast updated presence
    io.in(roomName).emit('presence:updated', {
      issueId,
      viewers,
      timestamp: new Date().toISOString(),
    });
  });

  // Share cursor position (for collaborative editing features)
  socket.on('presence:cursor', (payload: CursorPositionPayload) => {
    const { issueId, position } = payload;
    const roomName = `presence:${issueId}`;

    // Broadcast cursor position to others (not sender)
    socket.to(roomName).emit('presence:cursorMoved', {
      user: socket.data.user,
      issueId,
      position,
      timestamp: new Date().toISOString(),
    });
  });

  // Get current viewers of an issue
  socket.on('presence:getViewers', (payload: IssuePresencePayload, callback: (viewers: any[]) => void) => {
    const { issueId } = payload;
    const issueUsers = issuePresence.get(issueId);

    const viewers = issueUsers
      ? Array.from(issueUsers.values())
          .filter(v => v.isViewing)
          .map(v => ({
            user: v.user,
            joinedAt: v.joinedAt.toISOString(),
          }))
      : [];

    if (callback) {
      callback(viewers);
    }
  });

  // Heartbeat to keep presence alive
  socket.on('presence:heartbeat', () => {
    const userId = socket.data.user.id;
    userLastActivity.set(userId, new Date());
  });

  // Handle disconnection - clean up all presence
  socket.on('disconnecting', () => {
    const userId = socket.data.user.id;

    // Clean up presence from all issues
    for (const [issueId, issueUsers] of issuePresence.entries()) {
      if (issueUsers.has(userId)) {
        issueUsers.delete(userId);

        const roomName = `presence:${issueId}`;

        // Notify others about user leaving
        socket.to(roomName).emit('presence:userLeft', {
          issueId,
          user: socket.data.user,
          timestamp: new Date().toISOString(),
        });

        // Send updated viewers list
        const viewers = Array.from(issueUsers.values())
          .filter(v => v.isViewing)
          .map(v => ({
            user: v.user,
            joinedAt: v.joinedAt.toISOString(),
          }));

        socket.to(roomName).emit('presence:updated', {
          issueId,
          viewers,
          timestamp: new Date().toISOString(),
        });

        // Clean up empty entries
        if (issueUsers.size === 0) {
          issuePresence.delete(issueId);
        }
      }
    }

    // Clean up user activity
    userLastActivity.delete(userId);
  });
}

// Helper function to get viewers for an issue from outside the handler
export function getIssueViewers(issueId: string): Array<{ user: any; joinedAt: string }> {
  const issueUsers = issuePresence.get(issueId);

  if (!issueUsers) return [];

  return Array.from(issueUsers.values())
    .filter(v => v.isViewing)
    .map(v => ({
      user: v.user,
      joinedAt: v.joinedAt.toISOString(),
    }));
}

// Helper to check if a user is online
export function isUserOnline(userId: string): boolean {
  const lastActivity = userLastActivity.get(userId);
  if (!lastActivity) return false;

  // Consider user online if active within last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return lastActivity > fiveMinutesAgo;
}

// Helper to get online user count for an issue
export function getOnlineUserCount(issueId: string): number {
  const issueUsers = issuePresence.get(issueId);
  if (!issueUsers) return 0;

  return Array.from(issueUsers.values()).filter(v => v.isViewing).length;
}

// Cleanup stale presence entries (call periodically)
export function cleanupStalePresence(): void {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  for (const [issueId, issueUsers] of issuePresence.entries()) {
    for (const [userId, presence] of issueUsers.entries()) {
      const lastActivity = userLastActivity.get(userId);
      if (!lastActivity || lastActivity < fiveMinutesAgo) {
        issueUsers.delete(userId);
        logger.info(`Cleaned up stale presence for user ${userId} on issue ${issueId}`);
      }
    }

    if (issueUsers.size === 0) {
      issuePresence.delete(issueId);
    }
  }
}
