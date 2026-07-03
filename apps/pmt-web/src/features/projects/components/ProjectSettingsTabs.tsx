import { useState } from 'react';
import { Settings, Users, Tag, Flag, Workflow, Archive } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IssueTypesSettings } from './IssueTypesSettings';
import { PrioritiesSettings } from './PrioritiesSettings';
import {
  useGetIssueTypesQuery,
  useCreateIssueTypeMutation,
  useUpdateIssueTypeMutation,
  useDeleteIssueTypeMutation,
  useReorderIssueTypesMutation
} from '../projectConfigApi';
import {
  useGetPrioritiesQuery,
  useCreatePriorityMutation,
  useUpdatePriorityMutation,
  useDeletePriorityMutation
} from '../projectConfigApi';
import { toast } from 'sonner';

interface ProjectSettingsTabsProps {
  projectId: string;
}

export function ProjectSettingsTabs({ projectId }: ProjectSettingsTabsProps) {
  const [activeTab, setActiveTab] = useState('general');

  // Issue Types API
  const { data: issueTypes, isLoading: isLoadingIssueTypes, error: issueTypesError } = useGetIssueTypesQuery(projectId);
  const [createIssueType, { isLoading: isCreatingIssueType }] = useCreateIssueTypeMutation();
  const [updateIssueType, { isLoading: isUpdatingIssueType }] = useUpdateIssueTypeMutation();
  const [deleteIssueType, { isLoading: isDeletingIssueType }] = useDeleteIssueTypeMutation();
  const [reorderIssueTypes] = useReorderIssueTypesMutation();

  // Priorities API
  const { data: priorities, isLoading: isLoadingPriorities, error: prioritiesError } = useGetPrioritiesQuery();
  const [createPriority, { isLoading: isCreatingPriority }] = useCreatePriorityMutation();
  const [updatePriority, { isLoading: isUpdatingPriority }] = useUpdatePriorityMutation();
  const [deletePriority, { isLoading: isDeletingPriority }] = useDeletePriorityMutation();

  // Issue Types handlers
  const handleCreateIssueType = async (data: any) => {
    try {
      await createIssueType({ ...data, projectId }).unwrap();
      // Success toast would go here
    } catch (error) {
      // Error toast would go here
    }
  };

  const handleUpdateIssueType = async (id: string, data: any) => {
    try {
      await updateIssueType({ id, data }).unwrap();
      // Success toast would go here
    } catch (error) {
      // Error toast would go here
    }
  };

  const handleDeleteIssueType = async (id: string) => {
    try {
      await deleteIssueType(id).unwrap();
      // Success toast would go here
    } catch (error) {
      // Error toast would go here
    }
  };

  const handleReorderIssueTypes = async (newOrder: any[]) => {
    try {
      const typeIds = newOrder.map(t => t.id);
      await reorderIssueTypes({ projectId, typeIds }).unwrap();
      toast.success('Issue types reordered successfully');
    } catch (error) {
      toast.error('Failed to reorder issue types');
    }
  };

  // Priorities handlers
  const handleCreatePriority = async (data: any) => {
    try {
      await createPriority(data).unwrap();
      // Success toast would go here
    } catch (error) {
      // Error toast would go here
    }
  };

  const handleUpdatePriority = async (id: string, data: any) => {
    try {
      await updatePriority({ id, data }).unwrap();
      // Success toast would go here
    } catch (error) {
      // Error toast would go here
    }
  };

  const handleDeletePriority = async (id: string) => {
    try {
      await deletePriority(id).unwrap();
      // Success toast would go here
    } catch (error) {
      // Error toast would go here
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="general">
          <Settings className="h-4 w-4 mr-2" />
          General
        </TabsTrigger>
        <TabsTrigger value="members">
          <Users className="h-4 w-4 mr-2" />
          Members
        </TabsTrigger>
        <TabsTrigger value="issue-types">
          <Tag className="h-4 w-4 mr-2" />
          Issue Types
        </TabsTrigger>
        <TabsTrigger value="priorities">
          <Flag className="h-4 w-4 mr-2" />
          Priorities
        </TabsTrigger>
        <TabsTrigger value="workflow">
          <Workflow className="h-4 w-4 mr-2" />
          Workflow
        </TabsTrigger>
        <TabsTrigger value="labels">
          <Archive className="h-4 w-4 mr-2" />
          Labels
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        {/* General settings content - existing implementation */}
        <div>General settings coming soon...</div>
      </TabsContent>

      <TabsContent value="members">
        {/* Members settings content - existing implementation */}
        <div>Members settings coming soon...</div>
      </TabsContent>

      <TabsContent value="issue-types">
        <IssueTypesSettings
          projectId={projectId}
          issueTypes={issueTypes}
          isLoading={isLoadingIssueTypes}
          error={issueTypesError}
          onCreate={handleCreateIssueType}
          onUpdate={handleUpdateIssueType}
          onDelete={handleDeleteIssueType}
          onReorder={handleReorderIssueTypes}
        />
      </TabsContent>

      <TabsContent value="priorities">
        <PrioritiesSettings
          projectId={projectId}
          priorities={priorities}
          isLoading={isLoadingPriorities}
          error={prioritiesError}
          onCreate={handleCreatePriority}
          onUpdate={handleUpdatePriority}
          onDelete={handleDeletePriority}
        />
      </TabsContent>

      <TabsContent value="workflow">
        {/* Workflow settings content - existing implementation */}
        <div>Workflow settings coming soon...</div>
      </TabsContent>

      <TabsContent value="labels">
        {/* Labels settings content - existing implementation */}
        <div>Labels settings coming soon...</div>
      </TabsContent>
    </Tabs>
  );
}
