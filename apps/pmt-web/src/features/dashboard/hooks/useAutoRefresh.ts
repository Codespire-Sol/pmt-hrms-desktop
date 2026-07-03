import { useState, useEffect, useCallback } from 'react';

export interface AutoRefreshConfig {
  enabled: boolean;
  interval: number; // in seconds
}

const STORAGE_KEY = 'dashboard_auto_refresh';

const DEFAULT_CONFIG: AutoRefreshConfig = {
  enabled: false,
  interval: 60, // 1 minute default
};

const INTERVAL_OPTIONS = [
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '2 minutes', value: 120 },
  { label: '5 minutes', value: 300 },
  { label: '10 minutes', value: 600 },
];

export function useAutoRefresh() {
  const [config, setConfig] = useState<AutoRefreshConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  // Persist config to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const setEnabled = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, enabled }));
  }, []);

  const setInterval = useCallback((interval: number) => {
    setConfig((prev) => ({ ...prev, interval }));
  }, []);

  const toggle = useCallback(() => {
    setConfig((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  // Convert to milliseconds for RTK Query pollingInterval
  const pollingInterval = config.enabled ? config.interval * 1000 : 0;

  return {
    config,
    setEnabled,
    setInterval,
    toggle,
    pollingInterval,
    intervalOptions: INTERVAL_OPTIONS,
  };
}
