import { Server, Socket } from 'socket.io';
import { IssuesService } from '../../modules/issues/issues.service';
import { logger } from '../../utils/logger';

interface BoardJoinPayload {
  projectId: string;
}

interface IssueMovePayload {
  issueId: string;
  fromStatusId: string;
  toStatusId: string;
  position: number;
}

interface IssueQuickUpdatePayload {
  issueId: string;
  updates: any;
}

export function boardHandler(io: Server, socket: Socket) {
  const issuesService = new IssuesService();

  // Join project board room
  socket.on('board:join', async (payload: BoardJoinPayload) => {
    const { projectId } = payload;
    const roomName = `project:${projectId}`;

    // Join room
    socket.join(roomName);

    // Notify others
    socket.to(roomName).emit('user:joined', {
      user: socket.data.user,
      timestamp: new Date().toISOString(),
    });

    // Send current users in room
    const sockets = await io.in(roomName).fetchSockets();
    const users = sockets.map((s) => s.data.user);
    socket.emit('board:users', { users });

    logger.info(`User ${socket.data.user.id} joined board ${projectId}`);
  });

  // Leave project board room
  socket.on('board:leave', (payload: BoardJoinPayload) => {
    const { projectId } = payload;
    const roomName = `project:${projectId}`;

    socket.leave(roomName);

    socket.to(roomName).emit('user:left', {
      user: socket.data.user,
      timestamp: new Date().toISOString(),
    });

    logger.info(`User ${socket.data.user.id} left board ${projectId}`);
  });

  // Issue moved (drag and drop)
  socket.on('issue:move', async (payload: IssueMovePayload) => {
    try {
      const { issueId, fromStatusId, toStatusId, position } = payload;


      // Update issue in database
      const updatedIssue = await issuesService.updateIssue(
        issueId,
        { statusId: toStatusId, position },
        socket.data.user.id
      );

      // Get project room
      const roomName = `project:${updatedIssue.project_id}`;

      // Broadcast to all clients in room (including sender for confirmation)
      io.in(roomName).emit('issue:moved', {
        issue: updatedIssue,
        movedBy: socket.data.user,
        timestamp: new Date().toISOString(),
      });

      logger.info(`Issue ${issueId} moved by ${socket.data.user.id}`);
    } catch (error) {
      logger.error('Failed to move issue:', error);
      socket.emit('error', {
        message: 'Failed to move issue',
        error: (error as Error).message,
      });
    }
  });

  // Issue quick update
  socket.on('issue:quickUpdate', async (payload: IssueQuickUpdatePayload) => {
    try {
      const { issueId, updates } = payload;

      const updatedIssue = await issuesService.updateIssue(
        issueId,
        updates,
        socket.data.user.id
      );

      const roomName = `project:${updatedIssue.project_id}`;

      io.in(roomName).emit('issue:updated', {
        issue: updatedIssue,
        updatedBy: socket.data.user,
        timestamp: new Date().toISOString(),
      });

      logger.info(`Issue ${issueId} updated by ${socket.data.user.id}`);
    } catch (error) {
      logger.error('Failed to update issue:', error);
      socket.emit('error', {
        message: 'Failed to update issue',
        error: (error as Error).message,
      });
    }
  });

  // Handle disconnection from all rooms
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room.startsWith('project:')) {
        socket.to(room).emit('user:left', {
          user: socket.data.user,
          timestamp: new Date().toISOString(),
        });
      }
    }
  });
}
