import { toTitleCase } from './name';
import { ENV } from '../lib/env';

export function extractRoleName(rawRole) {
  if (!rawRole) return null;
  if (typeof rawRole === 'string') return rawRole;
  if (typeof rawRole === 'object') {
    return rawRole.name || rawRole.displayName || rawRole.display_name || rawRole.roleName || rawRole.role || null;
  }
  return String(rawRole);
}

export function normalizeRoleName(rawRole) {
  const roleName = extractRoleName(rawRole);
  if (!roleName) return null;
  const value = String(roleName).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (value === '[object_object]' || value === 'object_object') return null;

  if (['admin', 'hrms_admin', 'super_admin'].includes(value)) return 'admin';
  if (['hr', 'hr_admin'].includes(value)) return 'hr';
  if (value === 'manager') return 'manager';
  if (value === 'employee') return 'employee';

  return value;
}

export function buildDisplayName(user) {
  if (!user) return '';
  const firstName = user.firstName || user.personal?.firstName;
  const lastName = user.lastName || user.personal?.lastName;
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return toTitleCase(fullName || user.name || '') || user.email || 'User';
}

export function resolveUserRole(user, roleData) {
  return normalizeRoleName(
    extractRoleName(roleData) || extractRoleName(user?.role) || extractRoleName(user?.roleName)
  );
}

/**
 * Normalise an avatar URL.
 *
 * The API returns /api/v1/users/avatars/:id paths which go through the
 * frontend's own nginx → backend (public route, registered before auth middleware).
 */
export function normalizeAvatarUrl(url) {
  if (!url) return null;
  if (typeof url !== 'string') return url;

  // Already absolute — return as-is
  if (/^https?:\/\//i.test(url)) return url;

  // Relative /api/... or /uploads/... paths — keep as-is, nginx proxies to backend
  return url;
}

/**
 * Normalise a document/file URL.
 *
 * The API returns /api/v1/files/... paths which go through the frontend's
 * own /api proxy — works from both hms.dev and pmt.dev without cross-origin.
 */
export function normalizeFileUrl(url) {
  if (!url || typeof url !== 'string') return url;
  // Already absolute — nothing to do
  if (/^https?:\/\//i.test(url)) return url;

  // /api/... paths work through the local frontend's nginx /api proxy — keep relative
  return url;
}


