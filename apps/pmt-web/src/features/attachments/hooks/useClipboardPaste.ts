import { useCallback, useEffect } from 'react';

interface UseClipboardPasteOptions {
  onPaste: (file: File) => void;
  enabled?: boolean;
  acceptedTypes?: string[];
}

export function useClipboardPaste({
  onPaste,
  enabled = true,
  acceptedTypes = ['image/'],
}: UseClipboardPasteOptions) {
  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      if (!enabled) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        // Check if the item type matches any of the accepted types
        const isAccepted = acceptedTypes.some((type) =>
          type.endsWith('/') ? item.type.startsWith(type) : item.type === type
        );

        if (isAccepted) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();

            // Generate a better filename for pasted images
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const extension = file.type.split('/')[1] || 'png';
            const newFile = new File([file], `pasted-image-${timestamp}.${extension}`, {
              type: file.type,
            });

            onPaste(newFile);
            break; // Only handle the first matching item
          }
        }
      }
    },
    [onPaste, enabled, acceptedTypes]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste, enabled]);
}

export default useClipboardPaste;
