import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ENV } from './env';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
export function normalizeAvatarUrl(url?: string | null): string | undefined {
  if (!url) return undefined;

  const apiVersion = ENV.API_VERSION || 'v1';

  // If it's already a full data URL or blob, return as is
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // Handle absolute URLs
  if (url.startsWith('http')) {
    // If it's a full URL and contains our key path markers, extract the relative part
    // to ensure it correctly prepends the CURRENT environment's domain
    if (url.includes('/uploads/') || url.includes('/api/')) {
      const pathMarker = url.includes('/uploads/') ? '/uploads/' : '/api/';
      const relativePath = url.substring(url.indexOf(pathMarker));
      return normalizeRelativePath(relativePath);
    }
    return url;
  }

  // Handle relative paths
  if (url.startsWith('/')) {
    return normalizeRelativePath(url);
  }

  // Handle cases where only a filename or UUID is provided (legacy or raw data)
  // We assume these should point to the new robust avatar endpoint
  if (url.length > 5 && !url.includes('/')) {
    // Strip extension if present to get the clean ID for the new API
    const id = url.split('.')[0];
    return normalizeRelativePath(`/api/${apiVersion}/users/avatars/${id}`);
  }

  return url;
}

function normalizeRelativePath(urlPath: string): string {
  const apiVersion = ENV.API_VERSION || 'v1';

  // Convert /uploads/... paths to /api/v1/files/... so they route through the proxy
  if (urlPath.startsWith('/uploads/')) {
    urlPath = `/api/${apiVersion}/files/${urlPath.slice('/uploads/'.length)}`;
  }

  const baseUrl = ENV.API_URL || '';

  // In production (non-localhost), prepend the base URL for absolute path resolution
  if (baseUrl && baseUrl.startsWith('http') && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBaseUrl}${urlPath}`;
  }

  // In development (localhost), keep paths relative so the Vite proxy handles them
  return urlPath;
}
