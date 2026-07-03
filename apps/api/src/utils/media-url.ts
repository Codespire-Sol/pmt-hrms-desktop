import { config } from '../config';

const AVATAR_FILE_REGEX = /(?:^|\/)avatars\/([^/?#]+?)(?:\.(?:jpg|jpeg|png|webp))?(?:$|[?#])/i;

/** API prefix for all proxied routes (e.g. "/api/v1"). */
const API_PREFIX = `/api/${config.apiVersion}`;

/** File-serving route prefix for backward-compat (kept so old DB records resolve).
 *  New downloads use /api/v1/attachments/:id/file — an ID-based route with no
 *  file extension in the URL, matching the avatar pattern that nginx does not intercept. */
const FILES_PREFIX = `${API_PREFIX}/files`;

export function buildAvatarApiUrl(userId: string): string {
  return `${API_PREFIX}/users/avatars/${userId}`;
}

/**
 * Convert a raw media URL (from the DB or upload result) into a path that is
 * reachable through the /api proxy.
 *
 * DB stores:     `/uploads/attachments/uuid-file.pdf`
 * Returns:       `/api/v1/media/attachments/uuid-file.pdf`
 *
 * Both PMT and HRMS frontends proxy /api/* to the API backend, so these
 * paths resolve correctly from any frontend domain.
 */
export function normalizeMediaUrl(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const value = input.trim();
  if (!value) {
    return null;
  }

  // Extract pathname from absolute URLs
  const getPath = (raw: string): string => {
    if (!/^https?:\/\//i.test(raw)) {
      return raw;
    }
    try {
      return new URL(raw).pathname;
    } catch {
      return raw;
    }
  };

  const normalizedPath = getPath(value);

  // Avatar file paths → /api/v1/users/avatars/:id (public route, before auth middleware)
  const avatarMatch = normalizedPath.match(AVATAR_FILE_REGEX);
  if (avatarMatch?.[1]) {
    return buildAvatarApiUrl(avatarMatch[1]);
  }

  // Already an API-prefixed path → return as-is
  if (normalizedPath.startsWith(`${API_PREFIX}/`)) {
    return normalizedPath;
  }

  // Absolute URL with /uploads/ → extract the sub-path and route through /api/v1/files/
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith('/uploads/')) {
        const subPath = parsed.pathname.slice('/uploads/'.length);
        return `${FILES_PREFIX}/${subPath}`;
      }
      // External URL (e.g. GitHub avatar) — keep as-is
      return value;
    } catch {
      return value;
    }
  }

  // Relative /uploads/... → /api/v1/files/...
  if (value.startsWith('/uploads/')) {
    const subPath = value.slice('/uploads/'.length);
    return `${FILES_PREFIX}/${subPath}`;
  }

  // Bare uploads/... → /api/v1/files/...
  if (value.startsWith('uploads/')) {
    const subPath = value.slice('uploads/'.length);
    return `${FILES_PREFIX}/${subPath}`;
  }

  // Raw /avatars/... or avatars/... → route through files endpoint
  if (value.startsWith('/avatars/')) {
    return `${FILES_PREFIX}${value}`;
  }
  if (value.startsWith('avatars/')) {
    return `${FILES_PREFIX}/${value}`;
  }

  return value;
}

/**
 * Build a public URL for a storage path (e.g. "attachments/uuid-file.pdf").
 * Routes through /api/v1/files/ so it's accessible via the /api proxy.
 */
export function buildUploadsUrl(storagePath: string): string {
  return `${FILES_PREFIX}/${storagePath.replace(/^\/+/, '')}`;
}
