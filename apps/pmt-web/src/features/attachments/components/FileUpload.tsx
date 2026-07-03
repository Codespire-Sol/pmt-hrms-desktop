import { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, X, File, Image, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUploadToIssueMutation } from '../attachmentsApi';

interface FileUploadProps {
  issueId: string;
  onUploadComplete?: () => void;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_FILES = 10;

const ACCEPT_TYPES: Record<string, string[]> = {
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/*': ['.txt', '.md', '.csv'],
  'application/zip': ['.zip'],
};

export function FileUpload({ issueId, onUploadComplete }: FileUploadProps) {
  const [uploadToIssue, { isLoading }] = useUploadToIssueMutation();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setError(null);

      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const errors = rejectedFiles.map((rejection) => {
          const { file, errors } = rejection;
          const errorMessages = errors.map((e) => {
            if (e.code === 'file-too-large') {
              return `${file.name} exceeds 25MB limit`;
            }
            if (e.code === 'file-invalid-type') {
              return `${file.name} has unsupported file type`;
            }
            return e.message;
          });
          return errorMessages.join(', ');
        });
        setError(errors.join('; '));
      }

      // Add accepted files to pending list
      setPendingFiles((prev) => [...prev, ...acceptedFiles].slice(0, MAX_FILES));
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: MAX_FILES,
    multiple: true,
  });

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleUpload = async () => {
    if (pendingFiles.length === 0) return;

    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    pendingFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      // Simulate progress (since we can't track real progress with RTK Query)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      await uploadToIssue({ issueId, files: formData }).unwrap();

      clearInterval(progressInterval);
      setUploadProgress(100);

      setPendingFiles([]);
      onUploadComplete?.();

      // Reset progress after a short delay
      setTimeout(() => setUploadProgress(0), 500);
    } catch (err: any) {
      setError(err.data?.error?.message || 'Upload failed');
      setUploadProgress(0);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4 text-blue-500" />;
    }
    if (file.type === 'application/pdf') {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handle file from clipboard paste
  const handlePastedFile = useCallback((file: File) => {
    setPendingFiles((prev) => [...prev, file].slice(0, MAX_FILES));
  }, []);

  // Expose paste handler
  (window as any).__handlePastedFile = handlePastedFile;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-primary font-medium">Drop files here...</p>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground">
              Drag & drop files here, or click to select
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Max 25MB per file - Images, PDFs, Documents, Text files
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Pending Files List */}
      {pendingFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              {pendingFiles.length} file(s) selected
            </h4>
            <Button onClick={handleUpload} disabled={isLoading} size="sm">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload All
                </>
              )}
            </Button>
          </div>

          {/* Upload progress */}
          {isLoading && uploadProgress > 0 && (
            <Progress value={uploadProgress} className="h-2" />
          )}

          {/* File list */}
          <div className="space-y-2">
            {pendingFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center gap-3 p-2 bg-muted rounded-lg"
              >
                {/* Preview for images */}
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-background flex items-center justify-center">
                    {getFileIcon(file)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeFile(index)}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
