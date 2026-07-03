import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Row,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  CheckCircle2,
  ClipboardList,
  Copy,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Zap,
  Eye,
} from "lucide-react";
import { FormBuilder } from "./components/FormBuilder";
import { FormSubmissionsDrawer } from "./components/FormSubmissionsDrawer";
import type { IssueTemplateConfig } from "./components/IssueSettingsPanel";
import {
  FORM_FIELD_KEY_MAX_LENGTH,
  FormField,
  FormFieldType,
  ProjectForm,
  isAllowedFormFieldType,
  isValidFormDescription,
  isValidFormFieldKey,
  isValidFormName,
  useCreateAccessTokenMutation,
  useCreateFormMutation,
  useDeleteFormMutation,
  useGetFormsQuery,
  usePublishFormMutation,
  useUpdateFormMutation,
} from "./formsApi";
import { useGetIssueTypesQuery } from "../projects/projectConfigApi";

const { Title, Text } = Typography;

const COLORS = {
  primary: "#1268ff",
  success: "#10b981",
  danger: "#ef4444",
  textPrimary: "#101828",
  textSecondary: "#4a5565",
  border: "#e5e7eb",
  shadow: "0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04)",
  cardBg: "#ffffff",
  pageBg: "#f8fafc",
};

type BuilderField = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: FormFieldType;
  isRequired: boolean;
  placeholder?: string;
  helpText?: string;
};

const DEFAULT_BUILDER_FIELDS: BuilderField[] = [
  {
    id: "summary",
    fieldKey: "summary",
    label: "Summary",
    fieldType: "text",
    isRequired: true,
    placeholder: "Answer will be written here",
  },
  {
    id: "details",
    fieldKey: "details",
    label: "Details",
    fieldType: "textarea",
    isRequired: false,
    placeholder: "Answer will be written here",
  },
];

const isAllowedFieldType = (fieldType?: string): fieldType is FormFieldType =>
  isAllowedFormFieldType(fieldType);

const toBuilderFields = (fields?: FormField[]): BuilderField[] => {
  if (!fields || fields.length === 0) return DEFAULT_BUILDER_FIELDS;

  return fields.map((field, index) => ({
    id: field.id || `field-${index}`,
    fieldKey: field.fieldKey || `field_${index + 1}`,
    label: field.label || `Field ${index + 1}`,
    fieldType: isAllowedFieldType(field.fieldType) ? field.fieldType : "text",
    isRequired: Boolean(field.isRequired),
    placeholder: field.placeholder || "Answer will be written here",
    helpText: field.helpText,
  }));
};

const toApiFields = (fields: BuilderField[]): FormField[] =>
  fields.map((field, index) => ({
    fieldKey: String(field.fieldKey || `field_${index + 1}`).trim(),
    label: String(field.label || `Field ${index + 1}`).trim(),
    fieldType: isAllowedFieldType(field.fieldType) ? field.fieldType : "text",
    isRequired: Boolean(field.isRequired),
    position: index,
    placeholder: field.placeholder,
    helpText: field.helpText,
  }));

const getApiErrorMessage = (error: any, fallback: string) =>
  error?.data?.message ||
  error?.data?.error?.message ||
  error?.error ||
  fallback;

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const STATUS_BORDER_COLORS: Record<string, string> = {
  published: "#10b981",
  draft: "#9ca3af",
  archived: "#d97706",
};

export function ProjectFormsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const {
    data: forms = [],
    isLoading,
    isError,
  } = useGetFormsQuery(projectId!, { skip: !projectId });
  const { data: issueTypes = [] } = useGetIssueTypesQuery(projectId!, {
    skip: !projectId,
  });

  const [createForm, { isLoading: isCreatingForm }] = useCreateFormMutation();
  const [updateForm, { isLoading: isUpdatingForm }] = useUpdateFormMutation();
  const [deleteForm, { isLoading: isDeletingForm }] = useDeleteFormMutation();
  const [publishForm, { isLoading: isPublishingForm }] =
    usePublishFormMutation();
  const [createAccessToken] = useCreateAccessTokenMutation();

  const [mode, setMode] = useState<"list" | "builder">("list");
  const [editingFormId, setEditingFormId] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string>("");
  const [sharingFormId, setSharingFormId] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [viewingSubmissionsFormId, setViewingSubmissionsFormId] = useState<
    string | null
  >(null);

  // Form name/description state for the builder
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const editableIssueTypeId = useMemo(() => {
    const first = issueTypes.find(
      (type) => String(type.name || "").toLowerCase() !== "epic"
    );
    return first?.id;
  }, [issueTypes]);

  const activeForm = useMemo<ProjectForm | null>(() => {
    if (!editingFormId) return null;
    return forms.find((form) => form.id === editingFormId) || null;
  }, [forms, editingFormId]);

  const initialFields = useMemo(
    () => toBuilderFields(activeForm?.fields),
    [activeForm]
  );

  const openNewFormBuilder = () => {
    setEditingFormId(null);
    setFormName(`Request Form ${forms.length + 1}`);
    setFormDescription("Collect requests and auto-create project issues.");
    setMode("builder");
  };

  const openEditBuilder = (formId: string) => {
    const form = forms.find((f) => f.id === formId);
    setEditingFormId(formId);
    setFormName(form?.name || "");
    setFormDescription(form?.description || "");
    setMode("builder");
  };

  const closeBuilder = () => {
    setMode("list");
    setEditingFormId(null);
  };

  const handleShare = async (formId: string) => {
    setSharingFormId(formId);
    setGeneratingToken(true);
    setShareModalOpen(true);
    try {
      const result = await createAccessToken({ formId }).unwrap();
      const origin = window.location.origin;
      setShareLink(`${origin}/forms/${formId}/submit?token=${result.token}`);
    } catch (error: any) {
      message.error(
        getApiErrorMessage(error, "Failed to generate share link")
      );
      setShareModalOpen(false);
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard
        .writeText(shareLink)
        .then(() => {
          message.success("Link copied to clipboard!");
        })
        .catch(() => {
          message.error("Failed to copy link");
        });
    }
  };

  const handleSaveBuilder = async (
    fields: BuilderField[],
    issueTemplate: IssueTemplateConfig
  ) => {
    if (!projectId) return;

    const mappedFields = toApiFields(fields).filter(
      (field) => field.fieldKey && field.label
    );
    if (mappedFields.length === 0) {
      message.error("Add at least one form field.");
      return;
    }

    const invalidFieldKey = mappedFields.find(
      (field) =>
        field.fieldKey.length > FORM_FIELD_KEY_MAX_LENGTH ||
        !isValidFormFieldKey(field.fieldKey)
    );
    if (invalidFieldKey) {
      message.error(
        `Invalid field key "${invalidFieldKey.fieldKey}". Use letters/numbers/underscore, start with a letter, max ${FORM_FIELD_KEY_MAX_LENGTH} chars.`
      );
      return;
    }

    const unsupportedFieldType = mappedFields.find(
      (field) => !isAllowedFieldType(field.fieldType)
    );
    if (unsupportedFieldType) {
      message.error(
        `Field type "${unsupportedFieldType.fieldType}" is not supported by the API.`
      );
      return;
    }

    const fieldKeys = mappedFields.map((field) => field.fieldKey);
    if (new Set(fieldKeys).size !== fieldKeys.length) {
      message.error("Field keys must be unique.");
      return;
    }

    if (issueTemplate.enabled && !issueTemplate.typeId && !editableIssueTypeId) {
      message.error("No issue type is configured for this project.");
      return;
    }

    const name = formName.trim() || `Request Form ${forms.length + 1}`;
    const description = formDescription.trim();

    if (!name) {
      message.error("Form name is required.");
      return;
    }
    if (!isValidFormName(name)) {
      message.error("Form name must be 200 characters or fewer.");
      return;
    }
    if (description && !isValidFormDescription(description)) {
      message.error("Form description must be 2000 characters or fewer.");
      return;
    }

    const payload = {
      name,
      description: description || "Collect requests and auto-create project issues.",
      isPublic: activeForm?.isPublic ?? true,
      settings: activeForm?.settings || { allowAnonymous: true },
      issueTemplate: {
        enabled: issueTemplate.enabled,
        typeId: issueTemplate.typeId || editableIssueTypeId,
        statusId: issueTemplate.statusId,
        priorityId: issueTemplate.priorityId,
        assigneeId: issueTemplate.assigneeId,
        titleFieldKey: issueTemplate.titleFieldKey || "summary",
        descriptionFieldKey: issueTemplate.descriptionFieldKey || "details",
      },
      fields: mappedFields,
    };

    try {
      if (activeForm) {
        await updateForm({ formId: activeForm.id, data: payload }).unwrap();
        message.success("Form updated");
      } else {
        await createForm({ projectId, data: payload }).unwrap();
        message.success("Form created");
      }
      closeBuilder();
    } catch (error: any) {
      message.error(getApiErrorMessage(error, "Failed to save form"));
    }
  };

  const handlePublish = async (formId: string) => {
    try {
      await publishForm(formId).unwrap();
      message.success("Form published");
    } catch (error: any) {
      message.error(getApiErrorMessage(error, "Failed to publish form"));
    }
  };

  const handleDelete = async (formId: string) => {
    try {
      await deleteForm(formId).unwrap();
      message.success("Form deleted");
      if (editingFormId === formId) closeBuilder();
    } catch (error: any) {
      message.error(getApiErrorMessage(error, "Failed to delete form"));
    }
  };

  if (!projectId) {
    return (
      <Card style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12 }}>
        <Text style={{ color: COLORS.textSecondary }}>Project not found.</Text>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (mode === "builder") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: COLORS.shadow,
            height: "calc(100vh - 300px)",
            minHeight: 680,
            background: "#f8fafc",
          }}
        >
          <FormBuilder
            projectId={projectId}
            initialFields={initialFields}
            initialIssueTemplate={activeForm?.issueTemplate as IssueTemplateConfig | undefined}
            formName={formName}
            formDescription={formDescription}
            onFormNameChange={setFormName}
            onFormDescriptionChange={setFormDescription}
            onBack={closeBuilder}
            onSave={handleSaveBuilder}
          />
        </div>

        {(isCreatingForm || isUpdatingForm) && (
          <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
            Saving form...
          </Text>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header card */}
      <Card
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          boxShadow: COLORS.shadow,
          background: COLORS.cardBg,
        }}
        styles={{ body: { padding: 16 } }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0, color: COLORS.textPrimary }}>
              Forms
            </Title>
            <Text style={{ color: COLORS.textSecondary }}>
              Create and manage request collection forms for this project.
            </Text>
          </div>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={openNewFormBuilder}
            style={{
              backgroundColor: COLORS.primary,
              borderColor: COLORS.primary,
            }}
          >
            New form
          </Button>
        </div>
      </Card>

      {isError && (
        <Alert
          type="warning"
          showIcon
          message="Could not load forms"
          description="You can still create a new form."
          style={{ borderRadius: 12 }}
        />
      )}

      {forms.length === 0 ? (
        <Card
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            boxShadow: COLORS.shadow,
            background: COLORS.pageBg,
          }}
          styles={{ body: { padding: 28 } }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={2}>
                <Text strong style={{ color: COLORS.textPrimary }}>
                  No forms yet
                </Text>
                <Text style={{ color: COLORS.textSecondary }}>
                  Click "New form" to start building one.
                </Text>
              </Space>
            }
          >
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={openNewFormBuilder}
              style={{
                backgroundColor: COLORS.primary,
                borderColor: COLORS.primary,
              }}
            >
              Create first form
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {forms.map((form) => {
            const borderColor =
              STATUS_BORDER_COLORS[form.status] || "#d1d5db";
            return (
              <Col xs={24} md={12} xl={8} key={form.id}>
                <Card
                  hoverable
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    borderLeft: `3px solid ${borderColor}`,
                    borderRadius: 12,
                    boxShadow: COLORS.shadow,
                    height: "100%",
                    transition: "all 0.2s ease",
                  }}
                  styles={{ body: { padding: 16 } }}
                >
                  <Space
                    direction="vertical"
                    size={10}
                    style={{ width: "100%" }}
                  >
                    {/* Title row */}
                    <Space
                      style={{
                        width: "100%",
                        justifyContent: "space-between",
                      }}
                    >
                      <Space>
                        <ClipboardList size={16} color={COLORS.primary} />
                        <Text
                          strong
                          style={{
                            color: COLORS.textPrimary,
                            fontSize: 15,
                          }}
                        >
                          {form.name}
                        </Text>
                      </Space>
                      <Tag
                        color={
                          form.status === "published"
                            ? "green"
                            : form.status === "archived"
                              ? "orange"
                              : "default"
                        }
                        style={{ borderRadius: 999 }}
                      >
                        {form.status}
                      </Tag>
                    </Space>

                    {/* Description */}
                    <Text
                      style={{
                        color: COLORS.textSecondary,
                        minHeight: 40,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        fontSize: 13,
                      }}
                    >
                      {form.description || "No description"}
                    </Text>

                    {/* Tags */}
                    <Space size={6} wrap>
                      <Tag>{form.fields?.length || 0} fields</Tag>
                      <Tag color={form.isPublic ? "blue" : "default"}>
                        {form.isPublic ? "Public" : "Private"}
                      </Tag>
                      <Tooltip title="Click to view submissions">
                        <Tag
                          icon={<Eye size={11} style={{ marginRight: 4 }} />}
                          color="processing"
                          style={{ cursor: "pointer" }}
                          onClick={() =>
                            setViewingSubmissionsFormId(form.id)
                          }
                        >
                          {form.submissionCount || 0} submissions
                        </Tag>
                      </Tooltip>
                      {form.issueTemplate?.enabled && (
                        <Tag
                          icon={<Zap size={11} style={{ marginRight: 4 }} />}
                          color="purple"
                        >
                          Auto-creates issues
                        </Tag>
                      )}
                    </Space>

                    {/* Timestamp */}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Updated: {formatDateTime(form.updatedAt)}
                    </Text>

                    {/* Actions */}
                    <Space wrap style={{ marginTop: 4 }}>
                      <Button
                        size="small"
                        icon={<Pencil size={13} />}
                        onClick={() => openEditBuilder(form.id)}
                      >
                        Edit
                      </Button>
                      {form.status !== "published" && (
                        <Button
                          size="small"
                          type="primary"
                          loading={isPublishingForm}
                          onClick={() => handlePublish(form.id)}
                          style={{
                            backgroundColor: COLORS.primary,
                            borderColor: COLORS.primary,
                          }}
                        >
                          Publish
                        </Button>
                      )}
                      {form.status === "published" && (
                        <Tooltip title="Generate a shareable link">
                          <Button
                            size="small"
                            icon={<Share2 size={13} />}
                            loading={
                              generatingToken && sharingFormId === form.id
                            }
                            onClick={() => handleShare(form.id)}
                          >
                            Share
                          </Button>
                        </Tooltip>
                      )}
                      <Popconfirm
                        title="Delete this form?"
                        description="This action cannot be undone."
                        onConfirm={() => handleDelete(form.id)}
                        okText="Delete"
                        cancelText="Cancel"
                      >
                        <Button
                          size="small"
                          danger
                          icon={<Trash2 size={13} />}
                          loading={isDeletingForm}
                        >
                          Delete
                        </Button>
                      </Popconfirm>
                    </Space>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Share modal */}
      <Modal
        title="Share Form"
        open={shareModalOpen}
        onCancel={() => {
          setShareModalOpen(false);
          setShareLink("");
          setSharingFormId(null);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setShareModalOpen(false);
              setShareLink("");
              setSharingFormId(null);
            }}
          >
            Close
          </Button>,
        ]}
      >
        {generatingToken ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </div>
        ) : shareLink ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Text>
              Share this link with anyone to let them submit the form:
            </Text>
            <Input.Group compact style={{ display: "flex" }}>
              <Input
                value={shareLink}
                readOnly
                style={{ flex: 1 }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                type="primary"
                icon={<Copy size={14} />}
                onClick={handleCopyLink}
                style={{
                  backgroundColor: COLORS.primary,
                  borderColor: COLORS.primary,
                }}
              >
                Copy
              </Button>
            </Input.Group>
            <Alert
              type="info"
              showIcon
              message="Each share generates a unique access token. The link will work for anyone with access to it."
              style={{ borderRadius: 8 }}
            />
          </Space>
        ) : null}
      </Modal>

      {/* Submissions drawer */}
      <FormSubmissionsDrawer
        formId={viewingSubmissionsFormId}
        projectId={projectId}
        open={!!viewingSubmissionsFormId}
        onClose={() => setViewingSubmissionsFormId(null)}
      />
    </div>
  );
}
