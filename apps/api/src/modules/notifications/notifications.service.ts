import { notificationsRepository } from './notifications.repository';
import {
  Notification,
  NotificationWithDetails,
  NotificationPreference,
  NotifyParams,
  HrmsBroadcastParams,
  NotificationType,
  NOTIFICATION_TYPE_LABELS,
  UpdatePreferenceInput,
} from './notifications.types';
import { pushNotification, pushUnreadCount } from '../../websocket';
import { pushService, PushSubscriptionInput, PushSubscription } from '../../services/push.service';
import { emailService } from '../../services/email.service';
import { prisma } from '../../database/prisma';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { featureFlagsService } from '../../services/featureFlags.service';

// Content templates for notification types
function generateNotificationContent(
  type: NotificationType,
  actorName: string,
  metadata: Record<string, any> = {}
): { title: string; message: string } {
  const issueKey = metadata.issueKey || 'an issue';
  const issueName = metadata.issueTitle || '';
  const projectName = metadata.projectName || '';
  const sprintName = metadata.sprintName || '';
  const commentPreview = metadata.commentPreview || '';
  const fieldName = metadata.fieldName || '';
  const oldValue = metadata.oldValue || '';
  const newValue = metadata.newValue || '';

  switch (type) {
    case 'project_member_added':
      return {
        title: `${actorName} added you to ${projectName || 'a project'}`,
        message: '',
      };

    case 'issue_created':
      return {
        title: `${actorName} created ${issueKey}`,
        message: issueName ? `"${issueName}"` : '',
      };

    case 'issue_updated':
      if (fieldName) {
        return {
          title: `${actorName} updated ${issueKey}`,
          message: `Changed ${fieldName}${oldValue && newValue ? ` from "${oldValue}" to "${newValue}"` : ''}`,
        };
      }
      return {
        title: `${actorName} updated ${issueKey}`,
        message: issueName ? `"${issueName}"` : '',
      };

    case 'issue_assigned':
      return {
        title: `${actorName} assigned ${issueKey} to you`,
        message: issueName ? `"${issueName}"` : '',
      };

    case 'issue_commented':
      return {
        title: `${actorName} commented on ${issueKey}`,
        message: commentPreview ? `"${commentPreview}"` : '',
      };

    case 'issue_mentioned':
      return {
        title: `${actorName} mentioned you in ${issueKey}`,
        message: commentPreview ? `"${commentPreview}"` : '',
      };

    case 'sprint_started':
      return {
        title: `Sprint "${sprintName}" has started`,
        message: projectName ? `in ${projectName}` : '',
      };

    case 'sprint_ending': {
      const daysLeft = metadata.daysLeft || 1;
      return {
        title: `Sprint "${sprintName}" ends ${daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}`,
        message: projectName ? `in ${projectName}` : '',
      };
    }

    case 'due_date_approaching': {
      const dueDays = metadata.daysUntilDue || 1;
      return {
        title: `${issueKey} is due ${dueDays === 0 ? 'today' : dueDays === 1 ? 'tomorrow' : `in ${dueDays} days`}`,
        message: issueName ? `"${issueName}"` : '',
      };
    }

    case 'issue_status_changed':
      return {
        title: `${actorName} moved ${issueKey} to ${newValue || 'a new status'}`,
        message: issueName ? `"${issueName}"` : '',
      };

    case 'hrms_announcement':
      return {
        title: metadata.title || `HRMS update from ${actorName}`,
        message: metadata.message || '',
      };

    case 'hrms_employee_status_changed':
      return {
        title: `${metadata.employeeName || 'Employee'} status updated`,
        message: `Changed to ${metadata.newStatus || 'updated status'} by ${actorName}`,
      };

    case 'hrms_manager_assigned':
      return {
        title: `Manager assignment updated`,
        message: `${metadata.employeeName || 'Employee'} now reports to ${metadata.managerName || 'assigned manager'}`,
      };

    case 'hrms_role_changed':
      return {
        title: `Role updated for ${metadata.employeeName || 'employee'}`,
        message: `New role: ${metadata.newRole || 'updated role'}`,
      };

    case 'hrms_onboarding_initiated':
      return {
        title: `Onboarding initiated for ${metadata.employeeName || 'employee'}`,
        message: metadata.targetCompletionDate
          ? `Target completion: ${metadata.targetCompletionDate}`
          : 'Onboarding checklist has been created',
      };

    case 'hrms_onboarding_completed':
      return {
        title: `Onboarding completed for ${metadata.employeeName || 'employee'}`,
        message: `${metadata.employeeName || 'Employee'} is now active`,
      };

    case 'hrms_offboarding_initiated':
      return {
        title: `Offboarding initiated for ${metadata.employeeName || 'employee'}`,
        message: metadata.lastWorkingDay
          ? `Last working day: ${metadata.lastWorkingDay}`
          : 'Offboarding process started',
      };

    case 'hrms_offboarding_completed':
      return {
        title: `Offboarding completed for ${metadata.employeeName || 'employee'}`,
        message: 'System access revoked and employee marked exited',
      };

    case 'hrms_leave_submitted':
      return {
        title: `${metadata.employeeName || 'Employee'} submitted leave`,
        message: metadata.leaveRange || '',
      };

    case 'hrms_leave_approved':
      return {
        title: `Leave approved for ${metadata.employeeName || 'employee'}`,
        message: metadata.leaveRange || '',
      };

    case 'hrms_leave_rejected':
      return {
        title: `Leave rejected for ${metadata.employeeName || 'employee'}`,
        message: metadata.reason || '',
      };

    case 'hrms_leave_cancelled':
      return {
        title: `Leave cancelled for ${metadata.employeeName || 'employee'}`,
        message: metadata.leaveRange || '',
      };

    case 'hrms_payroll_generated':
      return {
        title: `Payroll generated for ${metadata.monthYear || 'selected period'}`,
        message: 'Payslips are available for review',
      };

    case 'hrms_payroll_finalized':
      return {
        title: `Payroll finalized for ${metadata.monthYear || 'selected period'}`,
        message: 'Attendance is locked for this payroll period',
      };

    case 'hrms_regularization_submitted':
      return {
        title: `${metadata.employeeName || 'Employee'} submitted a regularization request`,
        message: metadata.attendanceDate ? `For ${metadata.attendanceDate}` : '',
      };

    case 'hrms_regularization_approved':
      return {
        title: `Regularization request approved`,
        message: metadata.attendanceDate ? `For ${metadata.attendanceDate}` : '',
      };

    case 'hrms_regularization_rejected':
      return {
        title: `Regularization request rejected`,
        message: metadata.reason || '',
      };

    case 'hrms_document_uploaded':
      return {
        title: `${metadata.employeeName || 'Employee'} uploaded ${metadata.documentType ? `a ${metadata.documentType.replace(/_/g, ' ')}` : 'a document'}`,
        message: metadata.fileName || '',
      };

    default: {
      // Type guard to handle exhaustive checking
      const _type = type as NotificationType;
      return {
        title: NOTIFICATION_TYPE_LABELS[_type]?.title || 'Notification',
        message: '',
      };
    }
  }
}

type NotificationRuleEvent =
  | 'issue_created'
  | 'issue_updated'
  | 'issue_assigned'
  | 'issue_status_changed'
  | 'issue_commented'
  | 'issue_deleted'
  | 'project_member_added';

function mapNotificationTypeToRuleEvent(type: NotificationType): NotificationRuleEvent | null {
  switch (type) {
    case 'issue_created':
    case 'issue_updated':
    case 'issue_assigned':
    case 'issue_status_changed':
    case 'issue_commented':
    case 'project_member_added':
      return type;
    default:
      return null;
  }
}

async function resolveNotificationSchemeRecipients(params: NotifyParams): Promise<string[] | null> {
  if (!params.projectId) {
    return null;
  }

  const enabled = await featureFlagsService.isEnabled('features.notificationSchemes', params.projectId);
  if (!enabled) {
    return null;
  }

  const eventType = mapNotificationTypeToRuleEvent(params.type);
  if (!eventType) {
    return null;
  }

  const assignment = await prisma.projectNotificationScheme.findUnique({
    where: { projectId: params.projectId },
    include: {
      notificationScheme: {
        include: {
          rules: {
            where: {
              eventType,
              isEnabled: true,
            },
          },
        },
      },
    },
  });

  if (!assignment?.notificationScheme || assignment.notificationScheme.status !== 'active') {
    return null;
  }

  const rules = assignment.notificationScheme.rules || [];
  if (rules.length === 0) {
    return [];
  }

  let assigneeId: string | null = null;
  let reporterId: string | null = null;
  let watcherIds: string[] = [];

  if (params.issueId) {
    const [issue, watchers] = await Promise.all([
      prisma.issue.findUnique({
        where: { id: params.issueId },
        select: { assigneeId: true, reporterId: true },
      }),
      prisma.issueWatcher.findMany({
        where: { issueId: params.issueId },
        select: { userId: true },
      }),
    ]);

    assigneeId = issue?.assigneeId || null;
    reporterId = issue?.reporterId || null;
    watcherIds = watchers.map((watcher) => watcher.userId);
  }

  const recipients = new Set<string>();

  for (const rule of rules) {
    switch (rule.recipientType) {
      case 'assignee':
        if (assigneeId) {
          recipients.add(assigneeId);
        }
        break;
      case 'reporter':
        if (reporterId) {
          recipients.add(reporterId);
        }
        break;
      case 'watchers':
        watcherIds.forEach((id) => recipients.add(id));
        break;
      case 'specific_user':
        if (rule.recipientId) {
          recipients.add(rule.recipientId);
        }
        break;
      case 'user_role': {
        if (!rule.recipientId) {
          break;
        }
        const users = await prisma.user.findMany({
          where: { role: { name: rule.recipientId } },
          select: { id: true },
        });
        users.forEach((user) => recipients.add(user.id));
        break;
      }
      case 'project_role': {
        if (!rule.recipientId || !params.projectId) {
          break;
        }
        const members = await prisma.projectMember.findMany({
          where: {
            projectId: params.projectId,
            role: rule.recipientId as any,
          },
          select: { userId: true },
        });
        members.forEach((member) => recipients.add(member.userId));
        break;
      }
      case 'group': {
        if (!rule.recipientId) {
          break;
        }
        const members = await prisma.userGroupMember.findMany({
          where: { groupId: rule.recipientId },
          select: { userId: true },
        });
        members.forEach((member) => recipients.add(member.userId));
        break;
      }
      default:
        break;
    }
  }

  return Array.from(recipients);
}

export const notificationsService = {
  // Send notifications to multiple users
  async notify(params: NotifyParams, actorName: string): Promise<Notification[]> {
    const { type, recipientIds, actorId, issueId, commentId, projectId, metadata = {} } = params;

    const schemeRecipients = await resolveNotificationSchemeRecipients(params);
    const baseRecipients = schemeRecipients === null ? recipientIds : schemeRecipients;

    // Filter out the actor from recipients (don't notify yourself)
    const filteredRecipients = Array.from(new Set(baseRecipients)).filter((id) => id !== actorId);

    if (filteredRecipients.length === 0) {
      return [];
    }

    // Get preferences for all recipients
    const preferences = await notificationsRepository.getPreferencesForUsers(
      filteredRecipients,
      type
    );

    // Filter recipients who have in-app notifications enabled
    const inAppRecipients = filteredRecipients.filter((userId) => {
      const pref = preferences.get(userId);
      return pref?.inAppEnabled !== false;
    });

    if (inAppRecipients.length === 0) {
      return [];
    }

    // Generate notification content
    const { title, message } = generateNotificationContent(type, actorName, metadata);

    // Create notifications for all recipients
    const notifications = await notificationsRepository.createMany(
      inAppRecipients.map((userId) => ({
        userId,
        type,
        title,
        message,
        actorId,
        issueId,
        commentId,
        projectId,
        metadata,
      }))
    );

    // Push notifications via WebSocket to each recipient
    for (const notification of notifications) {
      pushNotification(notification.userId, notification);

      // Also push updated unread count
      const unreadCount = await notificationsRepository.getUnreadCount(notification.userId);
      pushUnreadCount(notification.userId, unreadCount);
    }

    // Send browser push notifications to users with push enabled
    const pushRecipients = filteredRecipients.filter((userId) => {
      const pref = preferences.get(userId);
      return (pref as any)?.pushEnabled === true;
    });

    if (pushRecipients.length > 0 && pushService.isConfigured()) {
      try {
        await pushService.sendToUsers(pushRecipients, {
          title,
          body: message || '',
          tag: `notification-${type}`,
          data: {
            type,
            notificationId: notifications[0]?.id,
            issueId,
            projectId,
            url: this.getNotificationUrl(type, metadata),
          },
        });
      } catch (error) {
        logger.error('Failed to send push notifications:', error);
      }
    }

    // Send email notifications to recipients with emailEnabled
    const emailRecipients = filteredRecipients.filter((userId) => {
      const pref = preferences.get(userId);
      return pref?.emailEnabled === true;
    });

    if (emailRecipients.length > 0) {
      // Get user details for email recipients
      const users = await prisma.user.findMany({
        where: {
          id: { in: emailRecipients },
          email: { not: null },
        },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      const notificationUrl = this.getNotificationUrl(type, { ...metadata, issueId, projectId });
      // Use the HRMS frontend URL for HRMS notification types
      const baseUrl = type.startsWith('hrms_') ? config.frontend.hrmsUrl : config.frontend.url;
      const fullUrl = `${baseUrl}${notificationUrl}`;

      // Send emails in parallel (don't block the main flow)
      Promise.all(
        users.map(async (user: any) => {
          try {
            const recipientName = `${user.firstName} ${user.lastName}`.trim() || 'User';
            await emailService.sendNotificationEmail(user.email, {
              recipientName,
              notificationType: type,
              title,
              message: message || '',
              actionUrl: fullUrl,
              actionText: this.getEmailActionText(type),
            });
            logger.debug(`Email notification sent to ${user.email} for ${type}`);
          } catch (error) {
            logger.error(`Failed to send email notification to ${user.email}:`, error);
          }
        })
      ).catch((error) => {
        logger.error('Error sending email notifications:', error);
      });
    }

    return notifications;
  },

  // Helper to generate notification URL
  getNotificationUrl(type: NotificationType, metadata: Record<string, any>): string {
    const projectId = metadata.projectId;
    const issueId = metadata.issueId;

    switch (type) {
      case 'project_member_added':
        return projectId ? `/projects/${projectId}` : '/projects';
      case 'issue_created':
      case 'issue_updated':
      case 'issue_assigned':
      case 'issue_status_changed':
      case 'due_date_approaching':
        return issueId && projectId ? `/projects/${projectId}/issues/${issueId}` : '/';
      case 'issue_commented':
      case 'issue_mentioned':
        return issueId && projectId
          ? `/projects/${projectId}/issues/${issueId}#comments`
          : '/';
      case 'sprint_started':
      case 'sprint_ending':
        return projectId ? `/projects/${projectId}/sprints` : '/';
      case 'hrms_announcement':
      case 'hrms_employee_status_changed':
      case 'hrms_manager_assigned':
      case 'hrms_role_changed':
      case 'hrms_onboarding_initiated':
      case 'hrms_onboarding_completed':
      case 'hrms_offboarding_initiated':
      case 'hrms_offboarding_completed':
      case 'hrms_leave_submitted':
      case 'hrms_leave_approved':
      case 'hrms_leave_rejected':
      case 'hrms_leave_cancelled':
      case 'hrms_payroll_generated':
      case 'hrms_payroll_finalized':
        return '/hrms/notifications';
      case 'hrms_regularization_submitted':
      case 'hrms_regularization_approved':
      case 'hrms_regularization_rejected':
        return '/attendance';
      case 'hrms_document_uploaded':
        return '/employees';
      default:
        return '/notifications';
    }
  },

  // Helper to get action button text for emails
  getEmailActionText(type: NotificationType): string {
    switch (type) {
      case 'project_member_added':
        return 'Open Project';
      case 'issue_created':
        return 'View Issue';
      case 'issue_updated':
      case 'issue_status_changed':
        return 'View Changes';
      case 'issue_assigned':
        return 'View Assigned Issue';
      case 'issue_commented':
        return 'View Comment';
      case 'issue_mentioned':
        return 'View Mention';
      case 'sprint_started':
        return 'View Sprint';
      case 'sprint_ending':
        return 'View Sprint';
      case 'due_date_approaching':
        return 'View Issue';
      case 'hrms_announcement':
      case 'hrms_employee_status_changed':
      case 'hrms_manager_assigned':
      case 'hrms_role_changed':
      case 'hrms_onboarding_initiated':
      case 'hrms_onboarding_completed':
      case 'hrms_offboarding_initiated':
      case 'hrms_offboarding_completed':
      case 'hrms_leave_submitted':
      case 'hrms_leave_approved':
      case 'hrms_leave_rejected':
      case 'hrms_leave_cancelled':
      case 'hrms_payroll_generated':
      case 'hrms_payroll_finalized':
        return 'Open HRMS';
      case 'hrms_regularization_submitted':
        return 'Review Request';
      case 'hrms_regularization_approved':
      case 'hrms_regularization_rejected':
        return 'View Attendance';
      case 'hrms_document_uploaded':
        return 'View Employee';
      default:
        return 'View Details';
    }
  },

  // Create a single notification directly
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    options: {
      message?: string;
      actorId?: string;
      issueId?: string;
      commentId?: string;
      projectId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<Notification> {
    return notificationsRepository.create({
      userId,
      type,
      title,
      message: options.message,
      actorId: options.actorId,
      issueId: options.issueId,
      commentId: options.commentId,
      projectId: options.projectId,
      metadata: options.metadata,
    });
  },

  // Get notification by ID
  async getById(notificationId: string): Promise<Notification | null> {
    return notificationsRepository.getById(notificationId);
  },

  // Get notifications for user with pagination
  async getByUserId(
    userId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
      type?: string;
      module?: 'hrms' | 'toolkit' | 'all';
    } = {}
  ): Promise<{ notifications: NotificationWithDetails[]; total: number }> {
    return notificationsRepository.getByUserId(userId, options);
  },

  async hrmsBroadcast(params: HrmsBroadcastParams): Promise<Notification[]> {
    const type = params.type || 'hrms_announcement';
    const uniqueRecipients = Array.from(new Set(params.recipientUserIds)).filter(
      (id) => id !== params.actorId
    );
    if (uniqueRecipients.length === 0) {
      return [];
    }

    const notifications = await notificationsRepository.createMany(
      uniqueRecipients.map((userId) => ({
        userId,
        type,
        title: params.title,
        message: params.message,
        actorId: params.actorId,
        metadata: params.metadata || {},
      }))
    );

    for (const n of notifications) {
      pushNotification(n.userId, n);
      const unreadCount = await notificationsRepository.getUnreadCount(n.userId);
      pushUnreadCount(n.userId, unreadCount);
    }

    return notifications;
  },

  // Mark specific notifications as read
  async markAsRead(notificationIds: string[], userId: string): Promise<number> {
    return notificationsRepository.markAsRead(notificationIds, userId);
  },

  // Mark all notifications as read
  async markAllAsRead(userId: string, module?: 'hrms' | 'toolkit'): Promise<number> {
    return notificationsRepository.markAllAsRead(userId, module);
  },

  // Get unread count
  async getUnreadCount(userId: string): Promise<number> {
    return notificationsRepository.getUnreadCount(userId);
  },

  // Get user preferences
  async getPreferences(userId: string): Promise<NotificationPreference[]> {
    return notificationsRepository.getPreferences(userId);
  },

  // Update a preference
  async updatePreference(
    userId: string,
    input: UpdatePreferenceInput
  ): Promise<NotificationPreference> {
    // Get existing preference or use defaults
    const existing = await notificationsRepository.getPreference(userId, input.notificationType);

    const inAppEnabled = input.inAppEnabled ?? existing?.inAppEnabled ?? true;
    const emailEnabled =
      input.emailEnabled ??
      existing?.emailEnabled ??
      (input.notificationType === 'issue_assigned' ||
        input.notificationType === 'issue_mentioned' ||
        input.notificationType.startsWith('hrms_'));

    return notificationsRepository.upsertPreference(
      userId,
      input.notificationType,
      inAppEnabled,
      emailEnabled
    );
  },

  // Update multiple preferences at once
  async updatePreferences(
    userId: string,
    inputs: UpdatePreferenceInput[]
  ): Promise<NotificationPreference[]> {
    const results: NotificationPreference[] = [];

    for (const input of inputs) {
      const result = await this.updatePreference(userId, input);
      results.push(result);
    }

    return results;
  },

  // Cleanup old notifications
  async cleanup(olderThanDays: number = 90): Promise<number> {
    return notificationsRepository.deleteOlderThan(olderThanDays);
  },

  // ========== Push Notification Management ==========

  // Get VAPID public key for client
  getVapidPublicKey(): string {
    return pushService.getVapidPublicKey();
  },

  // Check if push is configured
  isPushConfigured(): boolean {
    return pushService.isConfigured();
  },

  // Subscribe device for push notifications
  async subscribePush(userId: string, input: PushSubscriptionInput): Promise<PushSubscription> {
    return pushService.subscribe(userId, input);
  },

  // Unsubscribe device
  async unsubscribePush(userId: string, endpoint: string): Promise<boolean> {
    return pushService.unsubscribe(userId, endpoint);
  },

  // Unsubscribe all devices for user
  async unsubscribeAllPush(userId: string): Promise<number> {
    return pushService.unsubscribeAll(userId);
  },

  // Get user's push subscriptions
  async getPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    return pushService.getSubscriptions(userId);
  },

  // Send test push notification
  async sendTestPush(userId: string): Promise<{ sent: number; failed: number }> {
    return pushService.sendToUser(userId, {
      title: 'Test Notification',
      body: 'This is a test push notification from ProjectFlow AI',
      tag: 'test',
      data: {
        type: 'test',
        url: '/notifications',
      },
    });
  },
};
