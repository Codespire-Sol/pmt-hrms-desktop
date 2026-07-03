// Components
export { ComponentsPage } from './ComponentsPage';
export { ComponentFormDialog } from './ComponentFormDialog';

// API
export {
  componentsApi,
  useGetProjectComponentsQuery,
  useGetComponentQuery,
  useCreateComponentMutation,
  useUpdateComponentMutation,
  useDeleteComponentMutation,
  useGetComponentIssuesQuery,
  useAddIssueToComponentMutation,
  useRemoveIssueFromComponentMutation,
} from './componentsApi';

// Types
export type {
  Component,
  CreateComponentInput,
  UpdateComponentInput,
  ComponentFilters,
} from './componentsApi';
