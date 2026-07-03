import { z } from 'zod';

export const connectGitlabSchema = z.object({
  accessToken: z.string().min(1, 'GitLab Personal Access Token is required'),
});

export const linkRepositorySchema = z.object({
  gitlabProjectId: z.number().int().positive('GitLab project ID must be a positive integer'),
});

export const createBranchSchema = z.object({
  name: z.string().min(1).max(255),
  ref: z.string().min(1).default('main'),
  issueId: z.string().uuid().optional(),
});

export type ConnectGitlabPayload = z.infer<typeof connectGitlabSchema>;
export type LinkRepositoryPayload = z.infer<typeof linkRepositorySchema>;
export type CreateBranchPayload = z.infer<typeof createBranchSchema>;
