import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsLargeDesktop,
  useOrientation,
  BREAKPOINTS,
} from './useMediaQuery';

describe('useMediaQuery', () => {
  let listeners: Array<(e: MediaQueryListEvent) => void> = [];
  let currentMatch = false;

  const mockMatchMedia = (matches: boolean) => {
    currentMatch = matches;
    return {
      matches: currentMatch,
      addEventListener: vi.fn((_, listener) => {
        listeners.push(listener);
      }),
      removeEventListener: vi.fn((_, listener) => {
        listeners = listeners.filter((l) => l !== listener);
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList;
  };

  beforeEach(() => {
    listeners = [];
    currentMatch = false;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => mockMatchMedia(false)),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when query does not match', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);
  });

  it('returns true when query matches', () => {
    vi.mocked(window.matchMedia).mockImplementation(() => mockMatchMedia(true));

    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(true);
  });

  it('updates when media query changes', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));

    expect(result.current).toBe(false);

    // Simulate media query change
    act(() => {
      listeners.forEach((listener) =>
        listener({ matches: true } as MediaQueryListEvent)
      );
    });

    expect(result.current).toBe(true);
  });

  it('cleans up listener on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'));

    expect(listeners.length).toBe(1);

    unmount();

    // Listener should be removed
    expect(listeners.length).toBe(0);
  });
});

describe('Breakpoint hooks', () => {
  let currentMatch = false;

  const mockMatchMedia = (query: string) => {
    // Simulate different breakpoints based on query
    let matches = false;
    if (query.includes('max-width: 767px')) {
      matches = currentMatch === true && query.includes('767');
    } else if (query.includes('min-width: 768px') && query.includes('max-width: 1023px')) {
      matches = currentMatch === true && query.includes('768');
    } else if (query.includes('min-width: 1024px') && !query.includes('max-width')) {
      matches = currentMatch === true && query.includes('1024');
    } else if (query.includes('min-width: 1280px')) {
      matches = currentMatch === true && query.includes('1280');
    }

    return {
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList;
  };

  beforeEach(() => {
    currentMatch = false;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(mockMatchMedia),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('useIsMobile returns correct value', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(typeof result.current).toBe('boolean');
  });

  it('useIsTablet returns correct value', () => {
    const { result } = renderHook(() => useIsTablet());
    expect(typeof result.current).toBe('boolean');
  });

  it('useIsDesktop returns correct value', () => {
    const { result } = renderHook(() => useIsDesktop());
    expect(typeof result.current).toBe('boolean');
  });

  it('useIsLargeDesktop returns correct value', () => {
    const { result } = renderHook(() => useIsLargeDesktop());
    expect(typeof result.current).toBe('boolean');
  });
});

describe('useOrientation', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('portrait'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns portrait when in portrait mode', () => {
    const { result } = renderHook(() => useOrientation());
    expect(result.current).toBe('portrait');
  });

  it('returns landscape when not in portrait mode', () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: !query.includes('portrait'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList));

    const { result } = renderHook(() => useOrientation());
    expect(result.current).toBe('landscape');
  });
});

describe('BREAKPOINTS', () => {
  it('has expected values', () => {
    expect(BREAKPOINTS.sm).toBe(640);
    expect(BREAKPOINTS.md).toBe(768);
    expect(BREAKPOINTS.lg).toBe(1024);
    expect(BREAKPOINTS.xl).toBe(1280);
    expect(BREAKPOINTS['2xl']).toBe(1536);
  });
});
