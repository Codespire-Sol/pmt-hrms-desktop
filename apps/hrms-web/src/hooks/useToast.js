import { create } from 'zustand';

const useToastStore = create((set) => ({
  toasts: [],
  addToast: (message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, duration }]
    }));
    return id;
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }));
  },
  clearToasts: () => {
    set({ toasts: [] });
  }
}));

export function useToast() {
  const { addToast, removeToast, toasts } = useToastStore();

  const showToast = (message, type = 'info', duration = 5000) => {
    return addToast(message, type, duration);
  };

  return {
    showToast,
    toasts,
    removeToast,
    success: (message, duration) => showToast(message, 'success', duration),
    error: (message, duration) => showToast(message, 'error', duration),
    warning: (message, duration) => showToast(message, 'warning', duration),
    info: (message, duration) => showToast(message, 'info', duration)
  };
}
