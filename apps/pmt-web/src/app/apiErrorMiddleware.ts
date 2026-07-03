import { isRejectedWithValue, Middleware } from '@reduxjs/toolkit';
import { toast } from '@/hooks/useToast';
import { logout } from '@/features/auth/authSlice';
import keycloak from '@/lib/keycloak';
import { ENV } from '@/lib/env';

interface ValidationDetail {
  path?: (string | number)[];
  message?: string;
  code?: string;
  validation?: string;
}

interface ApiError {
  status: number;
  data?: {
    error?: {
      message?: string;
      code?: string;
      details?: ValidationDetail[];
    };
    message?: string;
  };
}

// Convert camelCase/snake_case field names to readable labels
const FIELD_LABELS: Record<string, string> = {
  assigneeId: 'Assignee',
  reporterId: 'Reporter',
  projectId: 'Project',
  priorityId: 'Priority',
  typeId: 'Issue Type',
  statusId: 'Status',
  sprintId: 'Sprint',
  epicId: 'Epic',
  parentId: 'Parent Issue',
  leadId: 'Lead',
  categoryId: 'Category',
  memberId: 'Member',
  storyPoints: 'Story Points',
  dueDate: 'Due Date',
  startDate: 'Start Date',
  targetEndDate: 'Target End Date',
  title: 'Title',
  name: 'Name',
  description: 'Description',
  email: 'Email',
  password: 'Password',
};

function formatFieldName(path: (string | number)[]): string {
  const field = path[path.length - 1];
  if (typeof field === 'number') return `Item ${field + 1}`;
  return FIELD_LABELS[field] || field.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function formatValidationDetails(details: ValidationDetail[]): string {
  return details
    .map(d => {
      const field = d.path?.length ? formatFieldName(d.path) : '';
      const msg = d.message || 'is invalid';
      return field ? `${field}: ${msg}` : msg;
    })
    .join('\n');
}

// Map HTTP status codes to user-friendly messages
const getErrorMessage = (error: ApiError): { title: string; description: string } => {
  const { status, data } = error;

  // Handle validation errors with field-level details
  if (data?.error?.code === 'VALIDATION_ERROR' && data.error.details?.length) {
    return {
      title: 'Validation Error',
      description: formatValidationDetails(data.error.details),
    };
  }

  // Check for custom error message from API
  if (data?.error?.message) {
    return { title: 'Error', description: data.error.message };
  }
  if (data?.message) {
    return { title: 'Error', description: data.message };
  }

  // Default messages based on status code
  let description: string;
  switch (status) {
    case 400:
      description = 'Invalid request. Please check your input.'; break;
    case 401:
      description = 'Your session has expired. Please log in again.'; break;
    case 403:
      description = 'You do not have permission to perform this action.'; break;
    case 404:
      description = 'The requested resource was not found.'; break;
    case 409:
      description = 'This action conflicts with existing data.'; break;
    case 422:
      description = 'The provided data is invalid.'; break;
    case 429:
      description = 'Too many requests. Please try again later.'; break;
    case 500:
      description = 'Server error. Please try again later.'; break;
    case 502:
    case 503:
    case 504:
      description = 'Service temporarily unavailable. Please try again.'; break;
    default:
      description = 'An unexpected error occurred. Please try again.';
  }
  return { title: 'Error', description };
};

// Endpoints that should not show error toasts (handled manually)
const silentEndpoints = [
  'login', // Login handles its own errors
  'refreshToken', // Token refresh is silent
  'getWorkflow', // WorkflowBuilder handles its own errors; avoids stale 404 after workflow reassignment
];

let logoutInFlight = false;

export const apiErrorMiddleware: Middleware = (api) => (next) => (action) => {
  if (isRejectedWithValue(action)) {
    const payload = action.payload as ApiError;
    const endpointName = (action as any).meta?.arg?.endpointName || '';

    // Skip silent endpoints
    if (silentEndpoints.includes(endpointName)) {
      return next(action);
    }

    // Handle 401: token refresh already attempted in baseQuery and failed —
    // clear state and redirect to login without showing a toast (the redirect is enough)
    if (payload?.status === 401) {
      if (!logoutInFlight) {
        logoutInFlight = true;
        api.dispatch(logout());
        if (ENV.AUTH_MODE === 'jwt') {
          window.location.assign('/login');
        } else {
          keycloak.login({ redirectUri: window.location.href });
        }
        // Reset flag after redirect completes (browser navigates away anyway)
        window.setTimeout(() => { logoutInFlight = false; }, 5000);
      }
      return next(action);
    }

    // Show error toast
    const { title, description } = getErrorMessage(payload);
    toast.error(title, description);
  }

  return next(action);
};

export default apiErrorMiddleware;
