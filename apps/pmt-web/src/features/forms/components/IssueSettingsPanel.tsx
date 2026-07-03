import React from "react";
import { Select, Switch, Typography, Spin } from "antd";
import {
  Zap,
  FileText,
  AlignLeft,
  CircleDot,
  Flag,
  UserCheck,
} from "lucide-react";
import {
  useGetIssueTypesQuery,
  useGetPrioritiesQuery,
} from "@/features/projects/projectConfigApi";
import { useGetProjectWorkflowQuery } from "@/features/workflows/workflowsApi";
import { useGetProjectMembersQuery } from "@/features/projects/projectsApi";

const { Text } = Typography;

export interface IssueTemplateConfig {
  enabled: boolean;
  typeId?: string;
  statusId?: string;
  priorityId?: string;
  assigneeId?: string;
  titleFieldKey?: string;
  descriptionFieldKey?: string;
}

interface FormFieldOption {
  fieldKey: string;
  label: string;
}

interface IssueSettingsPanelProps {
  projectId: string;
  issueTemplate: IssueTemplateConfig;
  onIssueTemplateChange: (template: IssueTemplateConfig) => void;
  formFields: FormFieldOption[];
}

export const IssueSettingsPanel: React.FC<IssueSettingsPanelProps> = ({
  projectId,
  issueTemplate,
  onIssueTemplateChange,
  formFields,
}) => {
  const { data: issueTypes = [], isLoading: loadingTypes } =
    useGetIssueTypesQuery(projectId);
  const { data: priorities = [], isLoading: loadingPriorities } =
    useGetPrioritiesQuery();
  const { data: workflow, isLoading: loadingWorkflow } =
    useGetProjectWorkflowQuery(projectId);
  const { data: members = [], isLoading: loadingMembers } =
    useGetProjectMembersQuery(projectId);

  const isLoading =
    loadingTypes || loadingPriorities || loadingWorkflow || loadingMembers;

  const nonEpicTypes = issueTypes.filter(
    (t) => t.name.toLowerCase() !== "epic"
  );
  const statuses = workflow?.statuses || [];

  const update = (patch: Partial<IssueTemplateConfig>) => {
    onIssueTemplateChange({ ...issueTemplate, ...patch });
  };

  const fieldOptions = formFields.map((f) => ({
    label: f.label,
    value: f.fieldKey,
  }));

  return (
    <div className="space-y-1">
      <h2 className="text-sm font-black uppercase tracking-widest text-[#9eaec2] mb-3">
        Issue Settings
      </h2>
      <p className="text-sm text-[#5e6c84] mb-6 leading-relaxed">
        Configure how form submissions automatically create issues in your
        project.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spin size="small" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#f4f5f7] border border-[#dfe1e6]">
            <div className="flex items-center gap-2.5">
              <Zap size={16} className="text-[#0052cc]" />
              <span className="text-sm font-bold text-[#172b4d]">
                Auto-create issues
              </span>
            </div>
            <Switch
              size="small"
              checked={issueTemplate.enabled}
              onChange={(checked) => update({ enabled: checked })}
            />
          </div>

          {issueTemplate.enabled && (
            <>
              {/* Issue Type */}
              <SettingRow icon={CircleDot} label="Issue Type">
                <Select
                  size="small"
                  className="w-full"
                  placeholder="Select type..."
                  value={issueTemplate.typeId || undefined}
                  onChange={(val) => update({ typeId: val })}
                  options={nonEpicTypes.map((t) => ({
                    label: t.displayName || t.name,
                    value: t.id,
                  }))}
                  allowClear
                />
              </SettingRow>

              {/* Map title field */}
              <SettingRow icon={FileText} label="Title Field">
                <Select
                  size="small"
                  className="w-full"
                  placeholder="Map to issue title..."
                  value={issueTemplate.titleFieldKey || undefined}
                  onChange={(val) => update({ titleFieldKey: val })}
                  options={fieldOptions}
                  allowClear
                />
              </SettingRow>

              {/* Map description field */}
              <SettingRow icon={AlignLeft} label="Description Field">
                <Select
                  size="small"
                  className="w-full"
                  placeholder="Map to issue description..."
                  value={issueTemplate.descriptionFieldKey || undefined}
                  onChange={(val) => update({ descriptionFieldKey: val })}
                  options={fieldOptions}
                  allowClear
                />
              </SettingRow>

              {/* Default Status */}
              <SettingRow icon={CircleDot} label="Default Status">
                <Select
                  size="small"
                  className="w-full"
                  placeholder="Initial status..."
                  value={issueTemplate.statusId || undefined}
                  onChange={(val) => update({ statusId: val })}
                  options={statuses.map((s) => ({
                    label: s.displayName || s.name,
                    value: s.id,
                  }))}
                  allowClear
                />
              </SettingRow>

              {/* Default Priority */}
              <SettingRow icon={Flag} label="Default Priority">
                <Select
                  size="small"
                  className="w-full"
                  placeholder="Select priority..."
                  value={issueTemplate.priorityId || undefined}
                  onChange={(val) => update({ priorityId: val })}
                  options={priorities.map((p) => ({
                    label: p.displayName || p.name,
                    value: p.id,
                  }))}
                  allowClear
                />
              </SettingRow>

              {/* Default Assignee */}
              <SettingRow icon={UserCheck} label="Default Assignee">
                <Select
                  size="small"
                  className="w-full"
                  placeholder="Select assignee..."
                  value={issueTemplate.assigneeId || undefined}
                  onChange={(val) => update({ assigneeId: val })}
                  options={members.map((m) => ({
                    label: m.user.displayName || m.user.email,
                    value: m.userId,
                  }))}
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label as string)
                      ?.toLowerCase()
                      .includes(input.toLowerCase()) ?? false
                  }
                />
              </SettingRow>
            </>
          )}

          {!issueTemplate.enabled && (
            <Text className="text-xs text-[#9eaec2] block mt-2">
              When disabled, form submissions will be recorded but no issues
              will be created automatically.
            </Text>
          )}
        </div>
      )}
    </div>
  );
};

const SettingRow: React.FC<{
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}> = ({ icon: Icon, label, children }) => (
  <div>
    <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#9eaec2] mb-1.5">
      <Icon size={13} />
      {label}
    </label>
    {children}
  </div>
);

export default IssueSettingsPanel;
