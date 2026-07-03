import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from '../config';
import { verifyKeycloakToken } from '../utils/keycloak';
import { JwtUtils } from '../utils/jwt';
import { cacheService } from '../services/cache.service';
import { prisma } from '../database/prisma';
import { boardHandler } from './handlers/board.handler';
import { notificationHandler, broadcastNotification, broadcastUnreadCount } from './handlers/notification.handler';
import { commentHandler, broadcastCommentCreated, broadcastCommentUpdated, broadcastCommentDeleted } from './handlers/comment.handler';
import { presenceHandler, getIssueViewers, isUserOnline } from './handlers/presence.handler';
import { logger } from '../utils/logger';

const WS_REVALIDATION_INTERVAL_MS = 5 * 60 * 1000; // Re-check token every 5 minutes

// Export io instance for use by other modules
let ioInstance: Server | null = null;

export function getIO(): Server | null {
  return ioInstance;
}

// Helper to broadcast notifications from outside the websocket module
export function pushNotification(userId: string, notification: any): void {
  if (ioInstance) {
    broadcastNotification(ioInstance, userId, notification);
  }
}

export function pushUnreadCount(userId: string, count: number): void {
  if (ioInstance) {
    broadcastUnreadCount(ioInstance, userId, count);
  }
}

// Helper to broadcast comment events from outside the websocket module
export function pushCommentCreated(issueId: string, comment: any, createdBy: any): void {
  if (ioInstance) {
    broadcastCommentCreated(ioInstance, issueId, comment, createdBy);
  }
}

export function pushCommentUpdated(issueId: string, comment: any, updatedBy: any): void {
  if (ioInstance) {
    broadcastCommentUpdated(ioInstance, issueId, comment, updatedBy);
  }
}

export function pushCommentDeleted(issueId: string, commentId: string, deletedBy: any): void {
  if (ioInstance) {
    broadcastCommentDeleted(ioInstance, issueId, commentId, deletedBy);
  }
}

// Helper to get issue viewers
export function getViewersForIssue(issueId: string): Array<{ user: any; joinedAt: string }> {
  return getIssueViewers(issueId);
}

// Helper to check if user is online
export function checkUserOnline(userId: string): boolean {
  return isUserOnline(userId);
}

// Helper to broadcast issue events from REST API handlers
export function pushIssueEvent(
  event: 'issue:created' | 'issue:updated' | 'issue:deleted' | 'issue:moved',
  projectId: string,
  data: { issueId: string; issue?: any; movedBy?: any; updatedBy?: any; userId?: string }
): void {
  if (ioInstance) {
    ioInstance.in(`project:${projectId}`).emit(event, {
      issueId: data.issueId,
      projectId,
      issue: data.issue,
      movedBy: data.movedBy,
      updatedBy: data.updatedBy,
      userId: data.userId,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function setupWebSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.frontend.corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Attach Redis adapter for cross-instance event broadcasting — but ONLY when
  // Redis is explicitly configured. With no REDIS_URL/REDIS_HOST (e.g. embedded
  // in an Electron app), run Socket.IO as a single node with its default
  // in-memory adapter. This avoids any Redis connection attempt on boot.
  const REDIS_URL = (process.env.REDIS_URL || '').trim();
  const REDIS_HOST = (process.env.REDIS_HOST || '').trim();
  if (REDIS_URL || REDIS_HOST) {
    try {
      // Require lazily so the no-Redis boot path never loads the adapter/ioredis.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createAdapter } = require('@socket.io/redis-adapter');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require('ioredis');
      const connectionTarget = REDIS_URL || {
        host: REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      };
      const pubClient = new Redis(connectionTarget, { lazyConnect: true, maxRetriesPerRequest: 3 });
      const subClient = pubClient.duplicate();
      // Suppress unhandled error events — connection failures are caught by the Promise.all below
      pubClient.on('error', () => {});
      subClient.on('error', () => {});
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.IO Redis adapter attached');
    } catch (err) {
      logger.warn('Socket.IO Redis adapter failed to connect – falling back to in-memory adapter, Redis not available');
    }
  } else {
    logger.info('Socket.IO running single-node with in-memory adapter (Redis not configured)');
  }

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      let userRows: Array<{ id: string; email: string; status: string; is_active: boolean }>;
      let tokenPayload: Record<string, unknown>;

      if (config.auth.mode === 'jwt') {
        // Local JWT mode — verify the locally-issued token and resolve by user id.
        const payload = JwtUtils.verifyAccessToken(token);
        if (await JwtUtils.isTokenRevoked(payload)) {
          return next(new Error('Token has been revoked'));
        }
        userRows = await prisma.$queryRawUnsafe<Array<{ id: string; email: string; status: string; is_active: boolean }>>(
          `SELECT u.id, u.email, e.status::text as status, u.is_active
           FROM users u
           LEFT JOIN employees e ON e.user_id = u.id
           WHERE u.id = $1::uuid AND u.deleted_at IS NULL
           LIMIT 1`,
          payload.userId
        );
        tokenPayload = { ...payload };
      } else {
        // Keycloak mode — verify against the realm JWKS and resolve by sub/email.
        const payload = await verifyKeycloakToken(token);

        // Check token revocation (JTI blacklist)
        if (payload.jti) {
          const revoked = await cacheService.get(`token:bl:${payload.jti}`);
          if (revoked) return next(new Error('Token has been revoked'));
        }

        // Resolve local user by keycloak_sub, fallback by email
        userRows = await prisma.$queryRawUnsafe<Array<{ id: string; email: string; status: string; is_active: boolean }>>(
          `SELECT u.id, u.email, e.status::text as status, u.is_active
           FROM users u
           LEFT JOIN employees e ON e.user_id = u.id
           WHERE u.keycloak_sub = $1
           LIMIT 1`,
          payload.sub
        );
        if (!userRows[0] && payload.email) {
          userRows = await prisma.$queryRawUnsafe(
            `SELECT u.id, u.email, e.status::text as status, u.is_active
             FROM users u
             LEFT JOIN employees e ON e.user_id = u.id
             WHERE u.email = $1
             LIMIT 1`,
            payload.email.toLowerCase()
          );
          if (userRows[0]) {
            await prisma.$queryRawUnsafe(`UPDATE users SET keycloak_sub = $1 WHERE id = $2::uuid`, payload.sub, userRows[0].id);
          }
        }
        tokenPayload = { ...payload };
      }

      const blockedStatuses = ['exited', 'terminated'];
      if (!userRows[0] || userRows[0].is_active === false ||
          (userRows[0].status && blockedStatuses.includes(userRows[0].status))) {
        return next(new Error('Account inactive or not found'));
      }

      socket.data.user = {
        id: userRows[0].id,
        email: userRows[0].email,
      };
      socket.data.tokenPayload = { ...tokenPayload, userId: userRows[0].id };

      next();
    } catch (error: any) {
      const msg = error?.message || 'Invalid token';
      logger.warn(`WebSocket auth failed: ${msg}`);
      next(new Error(msg));
    }
  });

  // Store io instance for external access
  ioInstance = io;

  // Connection handler
  io.on('connection', (socket: Socket) => {
    logger.info(`User connected: ${socket.data.user.id}`);

    // Periodic token revalidation — disconnect if token is revoked or user deactivated
    const revalidationTimer = setInterval(async () => {
      try {
        const payload = socket.data.tokenPayload;
        if (!payload) {
          socket.disconnect(true);
          return;
        }

        // Check token revocation (JTI blacklist)
        if (payload.jti) {
          const revoked = await cacheService.get(`token:bl:${payload.jti}`);
          if (revoked) {
            logger.info(`WebSocket: disconnecting user ${socket.data.user.id} — token revoked`);
            socket.emit('auth:expired', { reason: 'token_revoked' });
            socket.disconnect(true);
            return;
          }
        }

        // Check user status
        const userRecord = await prisma.$queryRawUnsafe<Array<{ status: string; is_active: boolean }>>(
          `SELECT e.status::text as status, u.is_active
           FROM users u
           LEFT JOIN employees e ON e.user_id = u.id
           WHERE u.id = $1::uuid
           LIMIT 1`,
          socket.data.user.id
        );

        const blockedStatuses = ['exited', 'terminated'];
        if (!userRecord[0] || userRecord[0].is_active === false ||
            (userRecord[0].status && blockedStatuses.includes(userRecord[0].status))) {
          logger.info(`WebSocket: disconnecting user ${socket.data.user.id} — account inactive`);
          socket.emit('auth:expired', { reason: 'account_inactive' });
          socket.disconnect(true);
        }
      } catch (error) {
        logger.warn(`WebSocket revalidation error for user ${socket.data.user?.id}:`, error);
      }
    }, WS_REVALIDATION_INTERVAL_MS);

    // Register handlers
    boardHandler(io, socket);
    notificationHandler(io, socket);
    commentHandler(io, socket);
    presenceHandler(io, socket);

    // Disconnect handler
    socket.on('disconnect', () => {
      clearInterval(revalidationTimer);
      logger.info(`User disconnected: ${socket.data.user.id}`);
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}
