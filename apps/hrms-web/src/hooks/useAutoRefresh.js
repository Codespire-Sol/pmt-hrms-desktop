import { useEffect, useRef } from 'react';
import { HRMS_DATA_REFRESH_EVENT, isScopeMatch } from '../utils/realtime';

export function useAutoRefresh(refreshFn, options = {}) {
  const {
    intervalMs = 15000,
    enabled = true,
    scope = '*',
    deps = [],
  } = options;

  const refreshRef = useRef(refreshFn);
  refreshRef.current = refreshFn;

  useEffect(() => {
    if (!enabled) return undefined;

    const runRefresh = () => {
      Promise.resolve(refreshRef.current?.()).catch(() => {});
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') runRefresh();
    };

    const onFocus = () => runRefresh();

    const onExternalRefresh = (event) => {
      const eventScope = event?.detail?.scope;
      if (isScopeMatch(eventScope, scope)) runRefresh();
    };

    const timerId = window.setInterval(runRefresh, intervalMs);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener(HRMS_DATA_REFRESH_EVENT, onExternalRefresh);

    return () => {
      window.clearInterval(timerId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(HRMS_DATA_REFRESH_EVENT, onExternalRefresh);
    };
  }, [enabled, intervalMs, scope, ...deps]);
}
