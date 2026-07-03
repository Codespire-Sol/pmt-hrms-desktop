import { z } from 'zod';

export const connectGithubSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
});

export const linkRepositorySchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
  autoTransitionOnMerge: z.boolean().optional().default(true),
});

export const updateRepositorySchema = z.object({
  autoTransitionOnMerge: z.boolean().optional(),
  transitionStatusId: z.string().uuid().nullable().optional(),
});

export const createBranchSchema = z.object({
  issueId: z.string().uuid(),
  branchName: z.string().min(1).max(200),
  baseBranch: z.string().optional(),
});

export const suggestBranchNameSchema = z.object({
  issueKey: z.string().min(1),
  issueTitle: z.string().min(1),
  issueType: z.string().min(1),
});

export type ConnectGithubPayload = z.infer<typeof connectGithubSchema>;
export type LinkRepositoryPayload = z.infer<typeof linkRepositorySchema>;
export type UpdateRepositoryPayload = z.infer<typeof updateRepositorySchema>;
export type CreateBranchPayload = z.infer<typeof createBranchSchema>;
export type SuggestBranchNamePayload = z.infer<typeof suggestBranchNameSchema>;
