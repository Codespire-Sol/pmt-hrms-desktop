import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedCallback } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    // Change value
    rerender({ value: 'updated' });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast forward past debounce delay
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now value should be updated
    expect(result.current).toBe('updated');
  });

  it('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    // Rapid changes
    rerender({ value: 'change1' });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'change2' });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'change3' });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Still original value because timer keeps resetting
    expect(result.current).toBe('initial');

    // Wait for full delay after last change
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now should have last value
    expect(result.current).toBe('change3');
  });

  it('uses default delay of 500ms', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });

    // At 400ms, still initial
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe('initial');

    // At 500ms+, updated
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('updated');
  });

  it('handles different types', () => {
    // Test with number
    const { result: numResult, rerender: numRerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 0 } }
    );

    numRerender({ value: 42 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(numResult.current).toBe(42);

    // Test with object
    const initialObj = { name: 'test' };
    const { result: objResult, rerender: objRerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: initialObj } }
    );

    const updatedObj = { name: 'updated' };
    objRerender({ value: updatedObj });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(objResult.current).toEqual(updatedObj);
  });
});

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls callback after delay', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    // Call the debounced function
    act(() => {
      result.current('arg1');
    });

    // Callback should not be called yet
    expect(callback).not.toHaveBeenCalled();

    // Fast forward past delay
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now callback should be called
    expect(callback).toHaveBeenCalledWith('arg1');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('only calls callback once for rapid calls', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    // Rapid calls
    act(() => {
      result.current('call1');
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current('call2');
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current('call3');
    });

    // Fast forward past delay
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Callback should be called only once with last args
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('call3');
  });

  it('passes multiple arguments correctly', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 100));

    act(() => {
      result.current('arg1', 'arg2', 'arg3');
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
  });
});
