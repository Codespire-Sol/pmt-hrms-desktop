export const HRMS_DATA_REFRESH_EVENT = 'hrms:data-refresh';

export function broadcastDataRefresh(scope = '*') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(HRMS_DATA_REFRESH_EVENT, {
      detail: { scope, timestamp: Date.now() },
    })
  );
}

export function isScopeMatch(eventScope, targetScope) {
  if (!eventScope || eventScope === '*') return true;
  if (!targetScope || targetScope === '*') return true;
  return eventScope === targetScope;
}
