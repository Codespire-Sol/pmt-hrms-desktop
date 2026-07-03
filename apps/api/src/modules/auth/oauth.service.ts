import axios from 'axios';
import { config } from '../../config';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import {
  OAuthProvider,
  OAuthState,
  OAuthUserInfo,
  OAuthTokens,
  GoogleUserInfo,
  GitHubUserInfo,
  GitHubEmail,
  OAuthProviderRecord,
} from './oauth.types';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USERINFO_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

export class OAuthService {
  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(provider: OAuthProvider, returnUrl?: string): string {
    const state = this.encodeState({ provider, returnUrl });

    if (provider === 'google') {
      return this.getGoogleAuthUrl(state);
    } else if (provider === 'github') {
      return this.getGitHubAuthUrl(state);
    }

    throw ApiError.badRequest(`Unsupported OAuth provider: ${provider}`);
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(
    provider: OAuthProvider,
    code: string
  ): Promise<{ userInfo: OAuthUserInfo; tokens: OAuthTokens }> {
    if (provider === 'google') {
      return this.handleGoogleCallback(code);
    } else if (provider === 'github') {
      return this.handleGitHubCallback(code);
    }

    throw ApiError.badRequest(`Unsupported OAuth provider: ${provider}`);
  }

  /**
   * Find or create OAuth provider record
   */
  async findOrCreateProvider(
    userId: string,
    provider: OAuthProvider,
    providerUserId: string,
    userInfo: OAuthUserInfo,
    tokens: OAuthTokens
  ): Promise<OAuthProviderRecord> {
    // Check if provider already exists for this user
    const existing = await prisma.oauthProvider.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (existing) {
      // Update tokens
      const updated = await prisma.oauthProvider.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          updatedAt: new Date(),
        },
      });

      return this.formatProviderRecord({ ...updated, ...tokens });
    }

    // Create new provider record
    const record = await prisma.oauthProvider.create({
      data: {
        userId,
        provider,
        providerId: providerUserId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        profile: {
          email: userInfo.email,
          name: userInfo.name,
          avatarUrl: userInfo.avatarUrl,
        },
      },
    });

    return this.formatProviderRecord(record);
  }

  /**
   * Find user by OAuth provider
   */
  async findUserByProvider(
    provider: OAuthProvider,
    providerUserId: string
  ): Promise<string | null> {
    const record = await prisma.oauthProvider.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId: providerUserId,
        },
      },
    });

    return record?.userId || null;
  }

  /**
   * Get user's OAuth providers
   */
  async getUserProviders(userId: string): Promise<OAuthProviderRecord[]> {
    const records = await prisma.oauthProvider.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(this.formatProviderRecord);
  }

  /**
   * Remove OAuth provider from user
   */
  async removeProvider(userId: string, provider: OAuthProvider): Promise<void> {
    await prisma.oauthProvider.deleteMany({
      where: {
        userId,
        provider,
      },
    });

    logger.info(`Removed ${provider} OAuth from user: ${userId}`);
  }

  // Private methods

  private getGoogleAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: config.oauth.google.clientId,
      redirect_uri: config.oauth.google.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  private getGitHubAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: config.oauth.github.clientId,
      redirect_uri: config.oauth.github.redirectUri,
      scope: 'user:email read:user',
      state,
    });

    return `${GITHUB_AUTH_URL}?${params.toString()}`;
  }

  private async handleGoogleCallback(
    code: string
  ): Promise<{ userInfo: OAuthUserInfo; tokens: OAuthTokens }> {
    // Exchange code for tokens
    const tokenResponse = await axios.post(GOOGLE_TOKEN_URL, {
      client_id: config.oauth.google.clientId,
      client_secret: config.oauth.google.clientSecret,
      redirect_uri: config.oauth.google.redirectUri,
      code,
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user info
    const userInfoResponse = await axios.get<GoogleUserInfo>(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const googleUser = userInfoResponse.data;

    const userInfo: OAuthUserInfo = {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      firstName: googleUser.given_name,
      lastName: googleUser.family_name,
      avatarUrl: googleUser.picture,
    };

    const tokens: OAuthTokens = {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
    };

    return { userInfo, tokens };
  }

  private async handleGitHubCallback(
    code: string
  ): Promise<{ userInfo: OAuthUserInfo; tokens: OAuthTokens }> {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      GITHUB_TOKEN_URL,
      {
        client_id: config.oauth.github.clientId,
        client_secret: config.oauth.github.clientSecret,
        redirect_uri: config.oauth.github.redirectUri,
        code,
      },
      {
        headers: { Accept: 'application/json' },
      }
    );

    const { access_token } = tokenResponse.data;

    if (!access_token) {
      throw ApiError.unauthorized('Failed to get access token from GitHub');
    }

    // Get user info
    const userInfoResponse = await axios.get<GitHubUserInfo>(GITHUB_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const githubUser = userInfoResponse.data;

    // Get primary email (GitHub may not include email in user info)
    let email = githubUser.email;
    if (!email) {
      const emailsResponse = await axios.get<GitHubEmail[]>(GITHUB_EMAILS_URL, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const primaryEmail = emailsResponse.data.find((e) => e.primary && e.verified);
      email = primaryEmail?.email || emailsResponse.data[0]?.email;
    }

    if (!email) {
      throw ApiError.badRequest(
        'Unable to get email from GitHub. Please ensure your GitHub email is verified.'
      );
    }

    // Split name into first/last
    const nameParts = (githubUser.name || githubUser.login).split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || undefined;

    const userInfo: OAuthUserInfo = {
      id: String(githubUser.id),
      email,
      name: githubUser.name || githubUser.login,
      firstName,
      lastName,
      avatarUrl: githubUser.avatar_url,
    };

    const tokens: OAuthTokens = {
      accessToken: access_token,
    };

    return { userInfo, tokens };
  }

  private encodeState(state: OAuthState): string {
    return Buffer.from(JSON.stringify(state)).toString('base64');
  }

  decodeState(stateString: string): OAuthState {
    try {
      return JSON.parse(Buffer.from(stateString, 'base64').toString('utf-8'));
    } catch {
      throw ApiError.badRequest('Invalid OAuth state');
    }
  }

  private formatProviderRecord(record: any): OAuthProviderRecord {
    const profile = record.profile || {};
    return {
      id: record.id,
      userId: record.userId,
      provider: record.provider,
      providerUserId: record.providerId,
      accessToken: record.accessToken,
      refreshToken: record.refreshToken,
      tokenExpiresAt: record.expiresAt,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

export const oauthService = new OAuthService();
