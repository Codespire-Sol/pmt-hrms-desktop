import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, toast } from './useToast';

describe('useToast', () => {
  it('adds a toast when toast() is called', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: 'Test Toast', description: 'Test description' });
    });

    const newToast = result.current.toasts.find(t => t.title === 'Test Toast');
    expect(newToast).toBeDefined();
    expect(newToast?.description).toBe('Test description');
  });

  it('each toast has a unique id', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: 'Toast 1' });
      toast({ title: 'Toast 2' });
    });

    const ids = result.current.toasts.map(t => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('toast returns id and control functions', () => {
    renderHook(() => useToast());

    let toastResult: ReturnType<typeof toast>;
    act(() => {
      toastResult = toast({ title: 'Test' });
    });

    expect(toastResult!.id).toBeDefined();
    expect(typeof toastResult!.dismiss).toBe('function');
    expect(typeof toastResult!.update).toBe('function');
  });

  it('dismisses a toast when dismiss is called', () => {
    const { result } = renderHook(() => useToast());

    let toastId: string;
    act(() => {
      const returned = toast({ title: 'To Dismiss' });
      toastId = returned.id;
    });

    const toastBefore = result.current.toasts.find(t => t.id === toastId);
    expect(toastBefore?.open).toBe(true);

    act(() => {
      result.current.dismiss(toastId);
    });

    const toastAfter = result.current.toasts.find(t => t.id === toastId);
    expect(toastAfter?.open).toBe(false);
  });

  describe('convenience methods', () => {
    it('toast.success creates a success toast', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast.success('Success!', 'Operation completed');
      });

      const successToast = result.current.toasts.find(t => t.title === 'Success!');
      expect(successToast?.variant).toBe('success');
      expect(successToast?.description).toBe('Operation completed');
    });

    it('toast.error creates a destructive toast', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast.error('Error!', 'Something went wrong');
      });

      const errorToast = result.current.toasts.find(t => t.title === 'Error!');
      expect(errorToast?.variant).toBe('destructive');
    });

    it('toast.warning creates a warning toast', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast.warning('Warning!', 'Be careful');
      });

      const warningToast = result.current.toasts.find(t => t.title === 'Warning!');
      expect(warningToast?.variant).toBe('warning');
    });

    it('toast.info creates a default toast', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast.info('Info', 'Just FYI');
      });

      const infoToast = result.current.toasts.find(t => t.title === 'Info');
      expect(infoToast?.variant).toBeUndefined();
    });
  });

  it('updates a toast', () => {
    const { result } = renderHook(() => useToast());

    let toastInstance: ReturnType<typeof toast>;
    act(() => {
      toastInstance = toast({ title: 'Original' });
    });

    const originalToast = result.current.toasts.find(t => t.id === toastInstance!.id);
    expect(originalToast?.title).toBe('Original');

    act(() => {
      toastInstance.update({ id: toastInstance.id, title: 'Updated' });
    });

    const updatedToast = result.current.toasts.find(t => t.id === toastInstance!.id);
    expect(updatedToast?.title).toBe('Updated');
  });
});
