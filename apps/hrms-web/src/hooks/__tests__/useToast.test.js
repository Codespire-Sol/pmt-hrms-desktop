import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useToast } from '../useToast';

describe('useToast Hook', () => {
  beforeEach(() => {
    // Clear toasts before each test
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toasts.forEach(toast => {
        result.current.removeToast(toast.id);
      });
    });
  });

  it('should add toast with default type', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Test message');
    expect(result.current.toasts[0].type).toBe('info');
  });

  it('should add toast with specific type', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Success message', 'success');
    });

    expect(result.current.toasts[0].type).toBe('success');
  });

  it('should add multiple toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Message 1');
      result.current.showToast('Message 2');
      result.current.showToast('Message 3');
    });

    expect(result.current.toasts).toHaveLength(3);
  });

  it('should remove specific toast', () => {
    const { result } = renderHook(() => useToast());

    let toastId;
    act(() => {
      toastId = result.current.showToast('Test message');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.removeToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should have convenience methods for types', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Success');
      result.current.error('Error');
      result.current.warning('Warning');
      result.current.info('Info');
    });

    expect(result.current.toasts).toHaveLength(4);
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[1].type).toBe('error');
    expect(result.current.toasts[2].type).toBe('warning');
    expect(result.current.toasts[3].type).toBe('info');
  });

  it('should set custom duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.showToast('Test', 'info', 10000);
    });

    expect(result.current.toasts[0].duration).toBe(10000);
  });
});
