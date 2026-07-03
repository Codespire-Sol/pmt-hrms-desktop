export const APP_FATAL_ERROR_EVENT = 'hrms:app-fatal-error';

export function emitAppFatalError(payload = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(APP_FATAL_ERROR_EVENT, {
      detail: {
        timestamp: Date.now(),
        ...payload,
      },
    })
  );
}
