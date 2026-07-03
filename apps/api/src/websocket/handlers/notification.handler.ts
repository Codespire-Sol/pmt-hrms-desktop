import { Server, Socket } from 'socket.io';
import { notificationsService } from '../../modules/notifications/notifications.service';
import { logger } from '../../utils/logger';

interface MarkReadPayload {
  notificationIds: string[];
}

export function notificationHandler(io: Server, socket: Socket) {
  const userId = socket.data.user.id;

  // Automatically join user-specific notification room on connection
  const userRoom = `user:${userId}`;
  socket.join(userRoom);
  logger.info(`User ${userId} joined notification room`);

  // Handle mark notification as read
  socket.on('notification:markRead', async (payload: MarkReadPayload) => {
    try {
      const { notificationIds } = payload;

      if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
        socket.emit('error', { message: 'Invalid notification IDs' });
        return;
      }

      const count = await notificationsService.markAsRead(notificationIds, userId);

      // Send confirmation back to the user
      socket.emit('notification:markedRead', {
        notificationIds,
        count,
        timestamp: new Date().toISOString(),
      });

      // Also broadcast updated unread count to all user's devices
      const unreadCount = await notificationsService.getUnreadCount(userId);
      io.to(userRoom).emit('notification:unreadCount', { count: unreadCount });

      logger.info(`User ${userId} marked ${count} notifications as read`);
    } catch (error) {
      logger.error('Failed to mark notifications as read:', error);
      socket.emit('error', {
        message: 'Failed to mark notifications as read',
        error: (error as Error).message,
      });
    }
  });

  // Handle mark all notifications as read
  socket.on('notification:markAllRead', async () => {
    try {
      const count = await notificationsService.markAllAsRead(userId);

      // Send confirmation
      socket.emit('notification:allMarkedRead', {
        count,
        timestamp: new Date().toISOString(),
      });

      // Broadcast updated unread count
      io.to(userRoom).emit('notification:unreadCount', { count: 0 });

      logger.info(`User ${userId} marked all notifications as read (${count} total)`);
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
      socket.emit('error', {
        message: 'Failed to mark all notifications as read',
        error: (error as Error).message,
      });
    }
  });

  // Handle request for unread count
  socket.on('notification:getUnreadCount', async () => {
    try {
      const count = await notificationsService.getUnreadCount(userId);
      socket.emit('notification:unreadCount', { count });
    } catch (error) {
      logger.error('Failed to get unread count:', error);
      socket.emit('error', {
        message: 'Failed to get unread count',
        error: (error as Error).message,
      });
    }
  });

  // Handle disconnection - leave notification room
  socket.on('disconnecting', () => {
    socket.leave(userRoom);
    logger.info(`User ${userId} left notification room`);
  });
}

/**
 * Broadcast a new notification to a user via WebSocket.
 * Called by the notifications service when a new notification is created.
 */
export function broadcastNotification(
  io: Server,
  userId: string,
  notification: any
): void {
  const userRoom = `user:${userId}`;
  io.to(userRoom).emit('notification:new', {
    notification,
    timestamp: new Date().toISOString(),
  });
  logger.debug(`Broadcast notification to user ${userId}`);
}

/**
 * Broadcast unread count update to a user.
 */
export function broadcastUnreadCount(
  io: Server,
  userId: string,
  count: number
): void {
  const userRoom = `user:${userId}`;
  io.to(userRoom).emit('notification:unreadCount', { count });
}
