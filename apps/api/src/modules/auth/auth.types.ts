export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface AuthResponse {
  user: UserResponse;
  tokens: TokenPair;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface VerifyEmailInput {
  token: string;
}

export interface ResendVerificationInput {
  email: string;
}

export interface OAuthProvider {
  id: string;
  userId: string;
  provider: 'google' | 'github';
  providerUserId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  createdAt: Date;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface OAuthCallbackInput {
  code: string;
  state?: string;
}
