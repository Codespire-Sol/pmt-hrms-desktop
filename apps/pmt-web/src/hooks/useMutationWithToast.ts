import { useCallback, useState } from 'react';
import { toast } from '@/hooks/useToast';

interface MutationOptions<TData, TError> {
  onSuccess?: (data: TData) => void;
  onError?: (error: TError) => void;
  successMessage?: string;
  errorMessage?: string;
  loadingMessage?: string;
}

interface MutationState {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * A wrapper hook for RTK Query mutations that provides toast notifications
 * and loading state management.
 *
 * @example
 * const [createIssue, { isLoading }] = useCreateIssueMutation();
 * const { execute, state } = useMutationWithToast(createIssue, {
 *   successMessage: 'Issue created successfully',
 *   errorMessage: 'Failed to create issue',
 * });
 */
export function useMutationWithToast<TArg, TResult, TError = unknown>(
  mutationFn: (arg: TArg) => Promise<{ data?: TResult; error?: TError }>,
  options: MutationOptions<TResult, TError> = {}
) {
  const [state, setState] = useState<MutationState>({
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
  });

  const execute = useCallback(
    async (arg: TArg): Promise<TResult | undefined> => {
      setState({
        isLoading: true,
        isSuccess: false,
        isError: false,
        error: null,
      });

      // Show loading toast if message provided
      let loadingToastId: { dismiss: () => void } | undefined;
      if (options.loadingMessage) {
        loadingToastId = toast.info(options.loadingMessage);
      }

      try {
        const result = await mutationFn(arg);

        // Dismiss loading toast
        loadingToastId?.dismiss();

        if (result.error) {
          setState({
            isLoading: false,
            isSuccess: false,
            isError: true,
            error: result.error,
          });

          if (options.errorMessage) {
            toast.error(options.errorMessage);
          }

          options.onError?.(result.error as TError);
          return undefined;
        }

        setState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
        });

        if (options.successMessage) {
          toast.success(options.successMessage);
        }

        options.onSuccess?.(result.data as TResult);
        return result.data;
      } catch (error) {
        loadingToastId?.dismiss();

        setState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error,
        });

        if (options.errorMessage) {
          toast.error(options.errorMessage);
        }

        options.onError?.(error as TError);
        return undefined;
      }
    },
    [mutationFn, options]
  );

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
    });
  }, []);

  return { execute, state, reset };
}

export default useMutationWithToast;
