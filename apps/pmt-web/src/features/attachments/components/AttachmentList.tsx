import { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Download, Trash2, Eye, Image, File, FileText, Paperclip, Loader2 } from 'lucide-react';
import {
  useGetAttachmentsByIssueQuery,
  useDeleteAttachmentMutation,
} from '../attachmentsApi';
import { useAppSelector } from '@/app/hooks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Attachment } from '../types';
import { normalizeAvatarUrl } from '@/lib/utils';

// ─── Authenticated image component ───────────────────────────────────────────
// Regular <img> can't send Authorization headers; we fetch + create object URL.
function AuthImage({
  src,
  alt,
  className,
  token,
}: {
  src: string;
  alt: string;
  className: string;
  token: string | null;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [errored, setErrored]     = useState(false);
  const revokeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;

    const load = async () => {
      try {
        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : {};
        const res = await fetch(src, { headers, credentials: 'include' });
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revokeRef.current = url;
        setObjectUrl(url);
      } catch {
        if (!cancelled) setErrored(true);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (revokeRef.current) {
        URL.revokeObjectURL(revokeRef.current);
        revokeRef.current = null;
      }
    };
  }, [src, token]);

  if (errored) return <Image className="h-8 w-8 text-blue-500" />;
  if (!objectUrl) return <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />;
  return <img src={objectUrl} alt={alt} className={className} />;
}

interface AttachmentListProps {
  issueId: string;
  initialData?: any[];
}

export function AttachmentList({ issueId, initialData }: AttachmentListProps) {
  const currentUserId = useAppSelector((state) => state.auth.user?.id);
  const { data: fetchedData, isLoading: isFetchLoading } = useGetAttachmentsByIssueQuery(issueId, { skip: !!initialData });
  const data = initialData ?? fetchedData;
  const isLoading = !initialData && isFetchLoading;
  const [deleteAttachment, { isLoading: isDeleting }] = useDeleteAttachmentMutation();

  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Attachment | null>(null);

  const token = useAppSelector((state) => state.auth.accessToken);

  useEffect(() => {
    let objectUrl: string | null = null;

    const loadPdfPreview = async () => {
      if (
        previewAttachment &&
        (previewAttachment.mimeType === 'application/pdf' ||
          previewAttachment.mimeType === 'application/x-pdf' ||
          previewAttachment.originalFilename.toLowerCase().endsWith('.pdf'))
      ) {
        setIsPreviewLoading(true);
        try {
          const response = await fetch(normalizeAvatarUrl(previewAttachment.downloadUrl) ?? previewAttachment.downloadUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) throw new Error('Failed to fetch PDF');

          const blob = await response.blob();
          // Force set the MIME type to application/pdf to ensure browser viewer is triggered
          const pdfBlob = new Blob([blob], { type: 'application/pdf' });
          objectUrl = URL.createObjectURL(pdfBlob);
          setPreviewUrl(objectUrl);
        } catch (error) {
          console.error('PDF fetch error:', error);
          setPreviewUrl(null);
        } finally {
          setIsPreviewLoading(false);
        }
      } else {
        setPreviewUrl(null);
      }
    };

    loadPdfPreview();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [previewAttachment, token]);

  const attachments = Array.isArray(data) ? data : (data?.data || []);

  const handleDownload = async (attachment: Attachment) => {
    try {
      const url = normalizeAvatarUrl(attachment.downloadUrl) ?? attachment.downloadUrl;
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(url, { headers, credentials: 'include' });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      // Force the correct MIME type so the browser doesn't mangle the file
      const typedBlob = new Blob([blob], { type: attachment.mimeType || blob.type });
      const objectUrl = URL.createObjectURL(typedBlob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.originalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Revoke after a short delay to allow the download to start
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteAttachment({
        attachmentId: deleteConfirm.id,
        issueId,
      }).unwrap();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete attachment:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-8 w-8 text-blue-500" />;
    }
    if (mimeType === 'application/pdf' || mimeType === 'application/x-pdf') {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    if (
      mimeType.includes('word') ||
      mimeType.includes('document')
    ) {
      return <FileText className="h-8 w-8 text-blue-600" />;
    }
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return <FileText className="h-8 w-8 text-green-600" />;
    }
    return <File className="h-8 w-8 text-gray-500" />;
  };

  const canPreview = (mimeType: string, filename: string) => {
    return (
      mimeType.startsWith('image/') ||
      mimeType === 'application/pdf' ||
      mimeType === 'application/x-pdf' ||
      filename.toLowerCase().endsWith('.pdf')
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Paperclip className="h-5 w-5" />
          <h3 className="font-semibold">Attachments</h3>
        </div>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Paperclip className="h-5 w-5" />
        <h3 className="font-semibold">Attachments</h3>
        <span className="text-sm text-muted-foreground">({attachments.length})</span>
      </div>

      {/* Attachment Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="group relative border rounded-lg overflow-hidden bg-card hover:shadow-md transition-shadow"
          >
            {/* Thumbnail or Icon */}
            <div className="aspect-square flex items-center justify-center bg-muted">
              {attachment.thumbnailUrl ? (
                <AuthImage
                  src={normalizeAvatarUrl(attachment.thumbnailUrl) ?? attachment.thumbnailUrl}
                  alt={attachment.originalFilename}
                  className="w-full h-full object-cover"
                  token={token}
                />
              ) : attachment.mimeType.startsWith('image/') ? (
                <AuthImage
                  src={normalizeAvatarUrl(attachment.downloadUrl) ?? attachment.downloadUrl}
                  alt={attachment.originalFilename}
                  className="w-full h-full object-cover"
                  token={token}
                />
              ) : (
                getFileIcon(attachment.mimeType)
              )}
            </div>

            {/* File Info */}
            <div className="p-2 space-y-1">
              <p
                className="text-xs font-medium truncate"
                title={attachment.originalFilename}
              >
                {attachment.originalFilename}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(attachment.fileSize)}
              </p>
            </div>

            {/* Hover Actions */}
            <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
              {canPreview(attachment.mimeType, attachment.originalFilename) && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPreviewAttachment(attachment)}
                  title="Preview"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleDownload(attachment)}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
              {attachment.uploader.id === currentUserId && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDeleteConfirm(attachment)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">
              {previewAttachment?.originalFilename}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center overflow-auto">
            {isPreviewLoading ? (
              <div className="flex flex-col items-center justify-center h-[70vh] w-full gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              </div>
            ) : previewAttachment?.mimeType.startsWith('image/') ? (
              <AuthImage
                src={normalizeAvatarUrl(previewAttachment.downloadUrl) ?? previewAttachment.downloadUrl}
                alt={previewAttachment.originalFilename}
                className="max-w-full max-h-[70vh] object-contain"
                token={token}
              />
            ) : previewUrl ? (
              <object
                data={previewUrl}
                type="application/pdf"
                className="w-full h-[70vh]"
                key={previewUrl}
              >
                <iframe
                  src={previewUrl}
                  className="w-full h-full"
                  title={previewAttachment?.originalFilename}
                >
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">PDF preview not supported by your browser</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      You can download the file to view it offline.
                    </p>
                    <Button onClick={() => previewAttachment && handleDownload(previewAttachment)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  </div>
                </iframe>
              </object>
            ) : previewAttachment && (
              previewAttachment.mimeType === 'application/pdf' ||
              previewAttachment.mimeType === 'application/x-pdf' ||
              previewAttachment.originalFilename.toLowerCase().endsWith('.pdf')
            ) ? (
              <div className="flex flex-col items-center justify-center h-[70vh] w-full p-4 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-destructive">Failed to load preview</p>
                <p className="text-sm text-muted-foreground mb-4">
                  The file could not be loaded for previewing.
                </p>
                <Button onClick={() => handleDownload(previewAttachment)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download to View
                </Button>
              </div>
            ) : null}
          </div>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>
              Uploaded by {previewAttachment?.uploader.displayName}{' '}
              {previewAttachment?.createdAt &&
                formatDistanceToNow(new Date(previewAttachment.createdAt), {
                  addSuffix: true,
                })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => previewAttachment && handleDownload(previewAttachment)}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attachment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.originalFilename}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
