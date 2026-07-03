import React, { lazy, Suspense, ComponentType, useCallback, useRef, useEffect } from 'react';

/**
 * Frontend Performance Utilities
 *
 * Collection of utilities for optimizing React application performance
 * including lazy loading, debouncing, throttling, and memoization.
 */

// ============================================
// LAZY LOADING
// ============================================

/**
 * Create a lazy-loaded component with suspense fallback
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFn);

  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback || <DefaultLoadingFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * Default loading fallback component
 */
function DefaultLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

/**
 * Preload a lazy component
 */
export function preloadComponent(importFn: () => Promise<any>): void {
  importFn();
}

// ============================================
// DEBOUNCE & THROTTLE
// ============================================

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Hook for debounced callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    debounce((...args: Parameters<T>) => callbackRef.current(...args), delay) as T,
    [delay]
  );
}

/**
 * Hook for throttled callback
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    throttle((...args: Parameters<T>) => callbackRef.current(...args), limit) as T,
    [limit]
  );
}

// ============================================
// DEBOUNCED VALUE
// ============================================

/**
 * Hook for debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================
// INTERSECTION OBSERVER (LAZY RENDER)
// ============================================

interface UseIntersectionOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number | number[];
  triggerOnce?: boolean;
}

/**
 * Hook for intersection observer (useful for lazy loading)
 */
export function useIntersection(
  options: UseIntersectionOptions = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const { root = null, rootMargin = '0px', threshold = 0, triggerOnce = true } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isInView = entry.isIntersecting;
        setIsIntersecting(isInView);

        if (isInView && triggerOnce) {
          observer.unobserve(element);
        }
      },
      { root, rootMargin, threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [root, rootMargin, threshold, triggerOnce]);

  return [ref, isIntersecting];
}

/**
 * Component that renders children only when visible
 */
interface LazyRenderProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  rootMargin?: string;
}

export function LazyRender({ children, placeholder, rootMargin = '100px' }: LazyRenderProps) {
  const [ref, isVisible] = useIntersection({ rootMargin, triggerOnce: true });

  return (
    <div ref={ref}>
      {isVisible ? children : placeholder || <div className="min-h-[100px]" />}
    </div>
  );
}

// ============================================
// PERFORMANCE MEASUREMENT
// ============================================

/**
 * Measure component render time
 */
export function measureRenderTime(componentName: string) {
  return function <P extends object>(Component: ComponentType<P>): ComponentType<P> {
    return function MeasuredComponent(props: P) {
      const startTime = performance.now();

      useEffect(() => {
        const endTime = performance.now();
        const duration = endTime - startTime;

        if (duration > 16) {
          // Longer than one frame
          console.warn(`[Performance] ${componentName} took ${duration.toFixed(2)}ms to render`);
        }
      });

      return React.createElement(Component, props);
    };
  };
}

/**
 * Performance mark and measure utilities
 */
export const perfMark = {
  start: (name: string) => {
    if (typeof performance !== 'undefined') {
      performance.mark(`${name}-start`);
    }
  },

  end: (name: string) => {
    if (typeof performance !== 'undefined') {
      performance.mark(`${name}-end`);
      try {
        performance.measure(name, `${name}-start`, `${name}-end`);
        const measure = performance.getEntriesByName(name, 'measure')[0];
        console.log(`[Performance] ${name}: ${measure.duration.toFixed(2)}ms`);
        performance.clearMarks(`${name}-start`);
        performance.clearMarks(`${name}-end`);
        performance.clearMeasures(name);
      } catch (e) {
        // Ignore errors from missing marks
      }
    }
  },
};

// ============================================
// MEMOIZATION
// ============================================

/**
 * Simple memoization for functions with primitive arguments
 */
export function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * LRU cache with max size
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Delete oldest (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================
// IMAGE OPTIMIZATION
// ============================================

/**
 * Get optimized image URL with width parameter
 */
export function getOptimizedImageUrl(url: string, width: number): string {
  if (!url) return '';

  // Handle different image services
  if (url.includes('cloudinary.com')) {
    return url.replace('/upload/', `/upload/w_${width},f_auto,q_auto/`);
  }

  if (url.includes('imgix.net')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}w=${width}&auto=format`;
  }

  // Return original URL if no optimization available
  return url;
}

/**
 * Preload critical images
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

// ============================================
// BUNDLE ANALYSIS HELPERS
// ============================================

/**
 * Log component chunk info (for debugging code splitting)
 */
export function logChunkInfo(chunkName: string) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Chunk] Loading: ${chunkName}`);
  }
}

export default {
  lazyLoad,
  preloadComponent,
  debounce,
  throttle,
  useDebouncedCallback,
  useThrottledCallback,
  useDebouncedValue,
  useIntersection,
  LazyRender,
  measureRenderTime,
  perfMark,
  memoize,
  LRUCache,
  getOptimizedImageUrl,
  preloadImage,
  logChunkInfo,
};
