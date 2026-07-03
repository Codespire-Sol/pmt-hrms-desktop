import { prisma } from '../../database/prisma';
import {
  TransitionCondition,
  TransitionValidator,
  TransitionPostFunction,
  TransitionApprovalConfig,
  IssueTransitionApproval,
  IssueTransitionApprovalResponse,
  CreateConditionInput,
  CreateValidatorInput,
  CreatePostFunctionInput,
  CreateApprovalConfigInput,
  ApprovalStatus,
} from './transition-conditions.types';

export class TransitionConditionsRepository {
  // === Conditions ===

  async createCondition(transitionId: string, input: CreateConditionInput): Promise<TransitionCondition> {
    return prisma.workflowTransitionCondition.create({
      data: {
        transitionId,
        name: input.name,
        description: input.description,
        type: input.type,
        config: input.config as any,
        isBlocking: input.isBlocking ?? true,
        errorMessage: input.errorMessage,
        executionOrder: input.executionOrder || 0,
      },
    }) as unknown as TransitionCondition;
  }

  async findConditionsByTransition(transitionId: string): Promise<TransitionCondition[]> {
    return prisma.workflowTransitionCondition.findMany({
      where: {
        transitionId,
        isEnabled: true,
      },
      orderBy: { executionOrder: 'asc' },
    }) as unknown as TransitionCondition[];
  }

  async updateCondition(id: string, input: Partial<CreateConditionInput> & { isEnabled?: boolean }): Promise<TransitionCondition | null> {
    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.config !== undefined) updateData.config = input.config;
    if (input.isBlocking !== undefined) updateData.isBlocking = input.isBlocking;
    if (input.errorMessage !== undefined) updateData.errorMessage = input.errorMessage;
    if (input.executionOrder !== undefined) updateData.executionOrder = input.executionOrder;
    if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;

    return prisma.workflowTransitionCondition.update({
      where: { id },
      data: updateData,
    }) as unknown as TransitionCondition;
  }

  async deleteCondition(id: string): Promise<boolean> {
    try {
      await prisma.workflowTransitionCondition.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // === Validators ===

  async createValidator(transitionId: string, input: CreateValidatorInput): Promise<TransitionValidator> {
    return prisma.workflowTransitionValidator.create({
      data: {
        transitionId,
        name: input.name,
        description: input.description,
        type: input.type,
        field: input.field,
        config: input.config as any,
        errorMessage: input.errorMessage,
        executionOrder: input.executionOrder || 0,
      },
    }) as unknown as TransitionValidator;
  }

  async findValidatorsByTransition(transitionId: string): Promise<TransitionValidator[]> {
    return prisma.workflowTransitionValidator.findMany({
      where: {
        transitionId,
        isEnabled: true,
      },
      orderBy: { executionOrder: 'asc' },
    }) as unknown as TransitionValidator[];
  }

  async updateValidator(id: string, input: Partial<CreateValidatorInput> & { isEnabled?: boolean }): Promise<TransitionValidator | null> {
    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.field !== undefined) updateData.field = input.field;
    if (input.config !== undefined) updateData.config = input.config;
    if (input.errorMessage !== undefined) updateData.errorMessage = input.errorMessage;
    if (input.executionOrder !== undefined) updateData.executionOrder = input.executionOrder;
    if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;

    return prisma.workflowTransitionValidator.update({
      where: { id },
      data: updateData,
    }) as unknown as TransitionValidator;
  }

  async deleteValidator(id: string): Promise<boolean> {
    try {
      await prisma.workflowTransitionValidator.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // === Post Functions ===

  async createPostFunction(transitionId: string, input: CreatePostFunctionInput): Promise<TransitionPostFunction> {
    return prisma.workflowTransitionPostfunction.create({
      data: {
        transitionId,
        name: input.name,
        description: input.description,
        type: input.type,
        config: input.config as any,
        executionOrder: input.executionOrder || 0,
      },
    }) as unknown as TransitionPostFunction;
  }

  async findPostFunctionsByTransition(transitionId: string): Promise<TransitionPostFunction[]> {
    return prisma.workflowTransitionPostfunction.findMany({
      where: {
        transitionId,
        isEnabled: true,
      },
      orderBy: { executionOrder: 'asc' },
    }) as unknown as TransitionPostFunction[];
  }

  async updatePostFunction(id: string, input: Partial<CreatePostFunctionInput> & { isEnabled?: boolean }): Promise<TransitionPostFunction | null> {
    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.config !== undefined) updateData.config = input.config;
    if (input.executionOrder !== undefined) updateData.executionOrder = input.executionOrder;
    if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;

    return prisma.workflowTransitionPostfunction.update({
      where: { id },
      data: updateData,
    }) as unknown as TransitionPostFunction;
  }

  async deletePostFunction(id: string): Promise<boolean> {
    try {
      await prisma.workflowTransitionPostfunction.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // === Approval Config ===

  async createApprovalConfig(transitionId: string, input: CreateApprovalConfigInput): Promise<TransitionApprovalConfig> {
    return prisma.workflowTransitionApproval.upsert({
      where: { transitionId },
      create: {
        transitionId,
        requiredApprovals: input.requiredApprovals || 1,
        approverType: input.approverType as any,
        approvers: (input.approvers || []) as any,
        allowSelfApproval: input.allowSelfApproval ?? false,
        expiryHours: input.expiryHours,
      },
      update: {
        requiredApprovals: input.requiredApprovals || 1,
        approverType: input.approverType as any,
        approvers: (input.approvers || []) as any,
        allowSelfApproval: input.allowSelfApproval ?? false,
        expiryHours: input.expiryHours,
      },
    }) as unknown as TransitionApprovalConfig;
  }

  async findApprovalConfig(transitionId: string): Promise<TransitionApprovalConfig | null> {
    return prisma.workflowTransitionApproval.findUnique({
      where: { transitionId },
    }) as unknown as TransitionApprovalConfig | null;
  }

  async deleteApprovalConfig(transitionId: string): Promise<boolean> {
    try {
      await prisma.workflowTransitionApproval.delete({
        where: { transitionId },
      });
      return true;
    } catch {
      return false;
    }
  }

  // === Issue Approvals ===

  async createIssueApproval(data: {
    issueId: string;
    transitionId: string;
    requestedBy: string;
    approvalsRequired: number;
    expiresAt?: Date;
  }): Promise<IssueTransitionApproval> {
    return prisma.issueTransitionApproval.create({
      data: {
        issueId: data.issueId,
        transitionId: data.transitionId,
        requestedBy: data.requestedBy,
        approvalsRequired: data.approvalsRequired,
        expiresAt: data.expiresAt,
      },
    }) as unknown as IssueTransitionApproval;
  }

  async findPendingApproval(issueId: string, transitionId: string): Promise<IssueTransitionApproval | null> {
    return prisma.issueTransitionApproval.findFirst({
      where: {
        issueId,
        transitionId,
        status: 'pending',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    }) as unknown as IssueTransitionApproval | null;
  }

  async updateIssueApproval(id: string, data: {
    status?: ApprovalStatus;
    approvalsReceived?: number;
    completedAt?: Date;
  }): Promise<IssueTransitionApproval | null> {
    const updateData: any = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.approvalsReceived !== undefined) updateData.approvalsReceived = data.approvalsReceived;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;

    return prisma.issueTransitionApproval.update({
      where: { id },
      data: updateData,
    }) as unknown as IssueTransitionApproval;
  }

  async createApprovalResponse(data: {
    approvalId: string;
    userId: string;
    decision: 'approved' | 'rejected';
    comment?: string;
  }): Promise<IssueTransitionApprovalResponse> {
    return prisma.issueTransitionApprovalResponse.create({
      data: {
        approvalId: data.approvalId,
        userId: data.userId,
        decision: data.decision,
        comment: data.comment,
      },
    }) as unknown as IssueTransitionApprovalResponse;
  }

  async findApprovalResponses(approvalId: string): Promise<IssueTransitionApprovalResponse[]> {
    return prisma.issueTransitionApprovalResponse.findMany({
      where: { approvalId },
      orderBy: { createdAt: 'asc' },
    }) as unknown as IssueTransitionApprovalResponse[];
  }

  async hasUserResponded(approvalId: string, userId: string): Promise<boolean> {
    const count = await prisma.issueTransitionApprovalResponse.count({
      where: { approvalId, userId },
    });
    return count > 0;
  }
}
