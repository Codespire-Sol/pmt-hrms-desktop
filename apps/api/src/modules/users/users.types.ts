export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  timezone: string;
  locale: string;
  isActive: boolean;
  isVerified: boolean;
  emailVerifiedAt?: Date | null;
  lastLoginAt?: Date | null;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  timezone: string;
  locale: string;
  isVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: Date;
}

export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string | null;
  designation?: string | null;
  department?: string | null;
  pmtRole?: { id: string; displayName: string } | null;
  roleName?: string | null;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  timezone?: string;
  locale?: string;
}

export interface UpdateAvatarInput {
  avatarUrl: string | null;
}

export interface UserSearchParams {
  search?: string;
  scope?: 'pmt' | 'hrms';
  isActive?: boolean;
  isVerified?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'firstName' | 'lastName' | 'email' | 'createdAt' | 'lastLoginAt';
  sortOrder?: 'asc' | 'desc';
}

export interface UserListResponse {
  users: UserListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
  mentionNotifications: boolean;
  issueAssignedNotifications: boolean;
  issueUpdatedNotifications: boolean;
  sprintNotifications: boolean;
}

export interface UpdatePreferencesInput {
  theme?: 'light' | 'dark' | 'system';
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  weeklyDigest?: boolean;
  mentionNotifications?: boolean;
  issueAssignedNotifications?: boolean;
  issueUpdatedNotifications?: boolean;
  sprintNotifications?: boolean;
}

export interface UpdateUserStatusInput {
  isActive: boolean;
}

export interface UpdateUserInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  isVerified?: boolean;
}
