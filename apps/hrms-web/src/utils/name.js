export function toTitleCase(value) {
  if (!value) return '';
  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function getInitials(name) {
  if (!name) return 'U';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  const first = parts[0]?.charAt(0)?.toUpperCase() || '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0)?.toUpperCase() || '' : '';
  return `${first}${last}` || 'U';
}
