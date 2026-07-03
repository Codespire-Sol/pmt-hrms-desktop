import React, { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Lock,
  Share2,
  Trash2,
  Pencil,
  GripVertical,
  User,
  Clock,
  Tag as TagIcon,
  FolderOpen,
  RefreshCw,
  Calendar,
  Hash,
  Users,
  Plus,
  CheckCircle2,
  X,
  Menu,
  Zap,
  Type,
  AlignLeft,
  Mail,
  ListChecks,
  ToggleLeft,
  CircleDot,
  CalendarClock,
  Settings2,
} from "lucide-react";
import {
  Button,
  Input,
  Switch,
  Modal,
  Select,
  message,
  Typography,
  Tooltip,
  Drawer,
  Tabs,
  Tag,
} from "antd";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useGetProjectCustomFieldsQuery } from "@/features/custom-fields/customFieldsApi";
import { IssueSettingsPanel } from "./IssueSettingsPanel";
import type { IssueTemplateConfig } from "./IssueSettingsPanel";
import { CreateCustomFieldModal } from "./CreateCustomFieldModal";

const { Text } = Typography;

// --- Types ---
interface FormField {
  id: string;
  fieldKey: string;
  label: string;
  fieldType:
    | "text"
    | "textarea"
    | "number"
    | "email"
    | "select"
    | "multiselect"
    | "checkbox"
    | "radio"
    | "date"
    | "datetime";
  isRequired: boolean;
  placeholder?: string;
  helpText?: string;
}

interface AvailableField {
  id: string;
  label: string;
  fieldType: FormField["fieldType"];
  icon: React.ElementType;
}

export interface FormBuilderProps {
  onBack?: () => void;
  onSave?: (fields: FormField[], issueTemplate: IssueTemplateConfig) => void;
  initialFields?: any[];
  initialIssueTemplate?: IssueTemplateConfig;
  projectId: string;
  formName?: string;
  formDescription?: string;
  onFormNameChange?: (name: string) => void;
  onFormDescriptionChange?: (desc: string) => void;
}

// --- Constants ---
const AVAILABLE_FIELDS: AvailableField[] = [
  { id: "assignee", label: "Assignee", fieldType: "select", icon: User },
  { id: "due_date", label: "Due date", fieldType: "date", icon: Clock },
  { id: "labels", label: "Labels", fieldType: "select", icon: TagIcon },
  { id: "parent", label: "Parent", fieldType: "text", icon: FolderOpen },
  { id: "sprint", label: "Sprint", fieldType: "select", icon: RefreshCw },
  {
    id: "start_date",
    label: "Start date",
    fieldType: "date",
    icon: Calendar,
  },
  {
    id: "story_point",
    label: "Story point estimate",
    fieldType: "number",
    icon: Hash,
  },
  { id: "team", label: "Team", fieldType: "select", icon: Users },
];

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  email: Mail,
  select: ListChecks,
  multiselect: ListChecks,
  checkbox: ToggleLeft,
  radio: CircleDot,
  date: Calendar,
  datetime: CalendarClock,
};

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: "#0052cc",
  textarea: "#7c3aed",
  number: "#0891b2",
  email: "#2563eb",
  select: "#059669",
  multiselect: "#059669",
  checkbox: "#d97706",
  radio: "#dc2626",
  date: "#ea580c",
  datetime: "#ea580c",
};

// --- Components ---

const DraggableFieldTemplate = ({ field }: { field: AvailableField }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `template-${field.id}`,
      data: {
        type: "Template",
        field,
      },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2.5 px-3 py-2 mb-1.5 rounded-lg border border-[#e5e7eb] bg-white hover:bg-[#f8fafc] hover:border-[#0052cc]/30 cursor-grab active:cursor-grabbing transition-all group"
    >
      <GripVertical
        size={14}
        className="text-[#d1d5db] group-hover:text-[#9ca3af] flex-shrink-0"
      />
      <field.icon size={15} className="text-[#0052cc] flex-shrink-0" />
      <span className="text-[13px] font-medium text-[#374151] truncate">
        {field.label}
      </span>
    </div>
  );
};

const SortableFormField = ({
  field,
  onEdit,
  onDelete,
}: {
  field: FormField;
  onEdit: (f: FormField) => void;
  onDelete: (id: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: {
      type: "Field",
      field,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 100 : "auto",
    opacity: isDragging ? 0.3 : 1,
  };

  const borderColor = FIELD_TYPE_COLORS[field.fieldType] || "#0052cc";
  const FieldIcon = FIELD_TYPE_ICONS[field.fieldType] || Type;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderLeft: `3px solid ${borderColor}`,
      }}
      className={`relative mb-3 p-5 rounded-lg border border-[#e5e7eb] bg-white group transition-all duration-200 ${
        isDragging ? "shadow-xl ring-2 ring-[#0052cc]/20" : "hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-[#d1d5db] hover:text-[#6b7280] hover:bg-[#f3f4f6] rounded transition-colors"
          >
            <GripVertical size={16} />
          </div>
          <FieldIcon
            size={16}
            className="flex-shrink-0"
            style={{ color: borderColor }}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#111827]">
              {field.label}
              {field.isRequired && (
                <span className="text-red-500 ml-0.5">*</span>
              )}
            </span>
            <Tag
              className="text-[10px] font-semibold uppercase border-0 rounded px-1.5 py-0"
              style={{
                color: borderColor,
                backgroundColor: `${borderColor}10`,
              }}
            >
              {field.fieldType}
            </Tag>
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<Pencil size={14} />}
              onClick={() => onEdit(field)}
              className="text-[#6b7280] hover:text-[#0052cc] hover:bg-[#0052cc]/5"
            />
          </Tooltip>
          <Tooltip title="Remove">
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 size={14} />}
              onClick={() => onDelete(field.id)}
              className="hover:bg-red-50"
            />
          </Tooltip>
        </div>
      </div>

      <div>
        {field.fieldType === "textarea" ? (
          <div className="w-full h-20 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3 text-[#9ca3af] text-sm italic">
            {field.placeholder || "Answer will be written here"}
          </div>
        ) : (
          <div className="w-full h-10 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 flex items-center text-[#9ca3af] text-sm italic">
            {field.placeholder || "Answer will be written here"}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center pt-3 border-t border-[#f3f4f6]">
        <div className="flex items-center gap-2">
          <Switch size="small" checked={field.isRequired} disabled />
          <span className="text-xs font-medium text-[#6b7280]">Required</span>
        </div>
      </div>
    </div>
  );
};

export const FormBuilder: React.FC<FormBuilderProps> = ({
  onBack,
  onSave,
  initialFields,
  initialIssueTemplate,
  projectId,
  formName,
  formDescription,
  onFormNameChange,
  onFormDescriptionChange,
}) => {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showCreateCustomField, setShowCreateCustomField] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);

  const [fields, setFields] = useState<FormField[]>(
    (initialFields && initialFields.length > 0
      ? initialFields
      : [
          {
            id: "field-1",
            fieldKey: "summary",
            label: "Summary",
            fieldType: "text",
            isRequired: true,
            placeholder: "Enter a brief summary",
          },
          {
            id: "field-2",
            fieldKey: "description",
            label: "Description",
            fieldType: "textarea",
            isRequired: false,
            placeholder: "Provide detailed information",
          },
        ]
    ).map((f: any, i: number) => ({
      ...f,
      id: f.id || `field-${i}-${Date.now()}`,
    }))
  );

  const [issueTemplate, setIssueTemplate] = useState<IssueTemplateConfig>(
    initialIssueTemplate ?? {
      enabled: true,
      titleFieldKey: "summary",
      descriptionFieldKey: "details",
    }
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<AvailableField | null>(
    null
  );
  const [editingField, setEditingField] = useState<FormField | null>(null);

  // Fetch project custom fields for the sidebar
  const { data: customFieldsData } = useGetProjectCustomFieldsQuery(
    projectId,
    { skip: !projectId }
  );
  const projectCustomFields = customFieldsData?.data || [];

  const usedFieldKeys = useMemo(
    () => new Set(fields.map((f) => f.fieldKey)),
    [fields]
  );

  const availableTemplates = useMemo(
    () =>
      AVAILABLE_FIELDS.filter(
        (t) => !usedFieldKeys.has(t.id.replace(/-/g, "_"))
      ),
    [usedFieldKeys]
  );

  const availableCustomFields = useMemo(() => {
    const formFieldTypes = new Set([
      "text",
      "textarea",
      "number",
      "email",
      "select",
      "multiselect",
      "checkbox",
      "radio",
      "date",
      "datetime",
    ]);
    return projectCustomFields
      .filter(
        (cf) =>
          formFieldTypes.has(cf.fieldType) && !usedFieldKeys.has(cf.fieldKey)
      )
      .map((cf) => ({
        id: cf.fieldKey,
        label: cf.name,
        fieldType: cf.fieldType as FormField["fieldType"],
        icon: FIELD_TYPE_ICONS[cf.fieldType] || Type,
      }));
  }, [projectCustomFields, usedFieldKeys]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { setNodeRef: setCanvasDroppableRef } = useDroppable({
    id: "canvas-droppable",
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    if (active.data.current?.type === "Template") {
      setActiveTemplate(active.data.current.field);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveTemplate(null);

    if (!over) return;

    if (
      active.data.current?.type === "Field" &&
      (over.data.current?.type === "Field" || over.id === "canvas-droppable")
    ) {
      if (active.id !== over.id) {
        setFields((items) => {
          const oldIndex = items.findIndex((i) => i.id === active.id);
          const newIndex = items.findIndex((i) => i.id === over.id);
          if (newIndex === -1) return items;
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }

    if (active.data.current?.type === "Template") {
      const template = active.data.current.field as AvailableField;
      const templateFieldKey = template.id.replace(/-/g, "_");
      if (fields.some((field) => field.fieldKey === templateFieldKey)) {
        message.info("Field already added");
        return;
      }

      const newField: FormField = {
        id: `field-${Date.now()}`,
        fieldKey: templateFieldKey,
        label: template.label,
        fieldType: template.fieldType,
        isRequired: false,
        placeholder: "Answer will be written here",
      };

      const overIndex = fields.findIndex((f) => f.id === over.id);
      if (overIndex !== -1) {
        setFields((prev) => {
          const newFields = [...prev];
          newFields.splice(overIndex, 0, newField);
          return newFields;
        });
      } else {
        setFields((prev) => [...prev, newField]);
      }
      setIsDrawerOpen(false);
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: <span className="font-semibold">Delete this field?</span>,
      content: (
        <p className="text-[#6b7280]">
          This will remove the field from your form. Existing submissions retain
          their data.
        </p>
      ),
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      okButtonProps: { className: "bg-[#ff4d4f]" },
      onOk: () => {
        setFields((prev) => prev.filter((f) => f.id !== id));
        message.success("Field removed");
      },
    });
  };

  const handleSaveEdit = (values: FormField) => {
    setFields((prev) =>
      prev.map((f) => (f.id === editingField?.id ? { ...f, ...values } : f))
    );
    setEditingField(null);
    message.success("Configuration saved");
  };

  const handleCustomFieldCreated = (field: {
    id: string;
    fieldKey: string;
    label: string;
    fieldType: FormField["fieldType"];
    isRequired: boolean;
    placeholder?: string;
  }) => {
    const newField: FormField = {
      id: field.id,
      fieldKey: field.fieldKey,
      label: field.label,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      placeholder: field.placeholder || "Answer will be written here",
    };
    setFields((prev) => [...prev, newField]);
  };

  const FieldListContent = (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#9ca3af]">
          Fields
        </h2>
        <Tag className="text-[10px] font-medium border-0 bg-[#f3f4f6] text-[#6b7280] rounded px-1.5">
          {fields.length} added
        </Tag>
      </div>
      <p className="text-xs text-[#6b7280] mb-4 leading-relaxed">
        Drag and drop fields into the form canvas to build your request.
      </p>

      {/* Predefined fields */}
      {availableTemplates.length > 0 && (
        <div className="space-y-0.5 mb-3">
          {availableTemplates.map((field) => (
            <DraggableFieldTemplate key={field.id} field={field} />
          ))}
        </div>
      )}

      {availableTemplates.length === 0 && availableCustomFields.length === 0 && (
        <Text className="text-xs text-[#9ca3af] block mb-3">
          All available fields are in the form.
        </Text>
      )}

      {/* Custom fields from project */}
      {availableCustomFields.length > 0 && (
        <>
          <div className="mt-3 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">
              Custom Fields
            </span>
          </div>
          <div className="space-y-0.5 mb-3">
            {availableCustomFields.map((field) => (
              <DraggableFieldTemplate key={field.id} field={field} />
            ))}
          </div>
        </>
      )}

      <Button
        type="text"
        icon={<Plus size={15} />}
        className="w-full mt-4 py-5 border-2 border-dashed border-[#e5e7eb] hover:border-[#0052cc] hover:bg-[#0052cc]/5 text-[#6b7280] hover:text-[#0052cc] transition-all flex items-center justify-center gap-2 bg-white rounded-lg text-xs font-semibold"
        onClick={() => setShowCreateCustomField(true)}
      >
        Create new custom field
      </Button>
    </div>
  );

  const SidebarContent = (
    <Tabs
      defaultActiveKey="fields"
      size="small"
      className="form-builder-tabs"
      items={[
        {
          key: "fields",
          label: (
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <ListChecks size={14} /> Fields
            </span>
          ),
          children: FieldListContent,
        },
        {
          key: "settings",
          label: (
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <Settings2 size={14} /> Issue Settings
            </span>
          ),
          children: (
            <IssueSettingsPanel
              projectId={projectId}
              issueTemplate={issueTemplate}
              onIssueTemplateChange={setIssueTemplate}
              formFields={fields.map((f) => ({
                fieldKey: f.fieldKey,
                label: f.label,
              }))}
            />
          ),
        },
      ]}
    />
  );

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] text-[#111827] overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#e5e7eb] bg-white z-10">
        <div className="flex items-center gap-4">
          {!isDesktop && (
            <Button
              type="text"
              icon={<Menu size={20} />}
              onClick={() => setIsDrawerOpen(true)}
              className="text-[#374151]"
            />
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold text-[#111827]">
                Form Builder
              </h1>
              <Lock size={14} className="text-[#d1d5db]" />
              <Share2
                size={14}
                className="text-[#d1d5db] cursor-pointer hover:text-[#0052cc] transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Tag
                className="text-[10px] font-semibold uppercase border-0 rounded px-1.5 py-0"
                color="blue"
              >
                Issue Form
              </Tag>
              {issueTemplate.enabled ? (
                <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold">
                  <Zap size={11} />
                  Auto-creates issues
                </span>
              ) : (
                <span className="text-[10px] text-[#9ca3af] flex items-center gap-1 font-medium">
                  Issues disabled
                </span>
              )}
              <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-medium ml-2">
                <CheckCircle2 size={11} />
                Saved
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="text"
            onClick={onBack}
            className="text-[#6b7280] hover:text-[#111827] font-medium h-9 px-4"
          >
            Cancel
          </Button>
          <Button
            type="primary"
            onClick={() => onSave?.(fields, issueTemplate)}
            className="bg-[#0052cc] border-[#0052cc] hover:bg-[#0747a6] h-9 px-8 font-semibold rounded-lg"
          >
            Save & Close
          </Button>
        </div>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 overflow-hidden">
          {/* Mobile drawer */}
          <Drawer
            title={
              <span className="text-[#111827] font-semibold">
                Form Fields & Settings
              </span>
            }
            placement="right"
            onClose={() => setIsDrawerOpen(false)}
            open={isDrawerOpen}
            styles={{
              header: {
                backgroundColor: "#fff",
                borderBottom: "1px solid #e5e7eb",
              },
              body: { backgroundColor: "#fff", padding: "16px 20px" },
            }}
            closeIcon={<X size={18} className="text-[#6b7280]" />}
          >
            {SidebarContent}
          </Drawer>

          {/* Main canvas */}
          <main className="flex-1 overflow-y-auto bg-[#f8fafc] p-6 lg:p-12">
            <div className="max-w-2xl mx-auto">
              {/* Editable form name & description */}
              <div className="mb-10 text-center">
                {editingName ? (
                  <Input
                    autoFocus
                    value={formName || ""}
                    onChange={(e) => onFormNameChange?.(e.target.value)}
                    onBlur={() => setEditingName(false)}
                    onPressEnter={() => setEditingName(false)}
                    className="text-2xl font-bold text-center border-0 border-b-2 border-[#0052cc] bg-transparent shadow-none rounded-none mb-2 max-w-md mx-auto"
                    placeholder="Form name"
                  />
                ) : (
                  <h2
                    className="text-2xl font-bold mb-2 text-[#111827] cursor-pointer hover:text-[#0052cc] transition-colors inline-block"
                    onClick={() => setEditingName(true)}
                    title="Click to edit form name"
                  >
                    {formName || "Untitled Form"}
                  </h2>
                )}
                {editingDesc ? (
                  <Input.TextArea
                    autoFocus
                    value={formDescription || ""}
                    onChange={(e) => onFormDescriptionChange?.(e.target.value)}
                    onBlur={() => setEditingDesc(false)}
                    rows={2}
                    className="text-sm text-center border-0 border-b border-[#d1d5db] bg-transparent shadow-none rounded-none max-w-lg mx-auto"
                    placeholder="Add a description for this form"
                  />
                ) : (
                  <p
                    className="text-sm text-[#9ca3af] cursor-pointer hover:text-[#6b7280] transition-colors"
                    onClick={() => setEditingDesc(true)}
                    title="Click to edit description"
                  >
                    {formDescription || "Click to add a description"}
                  </p>
                )}
              </div>

              <SortableContext
                items={fields.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  ref={setCanvasDroppableRef}
                  id="canvas-droppable"
                  className="space-y-0 min-h-[400px] pb-20"
                >
                  {fields.map((field) => (
                    <SortableFormField
                      key={field.id}
                      field={field}
                      onEdit={setEditingField}
                      onDelete={handleDelete}
                    />
                  ))}

                  {fields.length === 0 && (
                    <div className="border-2 border-dashed border-[#e5e7eb] rounded-xl p-12 flex flex-col items-center justify-center text-[#9ca3af] gap-4 bg-white/50 transition-all hover:bg-white/80">
                      <div className="p-5 rounded-full bg-[#f3f4f6]">
                        <Plus size={40} className="text-[#d1d5db]" />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-[#6b7280]">
                          Start building your form
                        </p>
                        <p className="text-sm text-[#9ca3af] mt-1">
                          Drag fields from the sidebar or click to add
                        </p>
                      </div>
                    </div>
                  )}

                  {fields.length > 0 && (
                    <div className="py-6 border-t border-dashed border-[#e5e7eb] flex items-center justify-center mt-4">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#d1d5db]">
                        Drop fields here
                      </span>
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          </main>

          {/* Desktop sidebar */}
          {isDesktop && (
            <aside className="w-72 border-l border-[#e5e7eb] bg-white p-5 overflow-y-auto">
              {SidebarContent}
            </aside>
          )}
        </div>

        <DragOverlay
          dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: { active: { opacity: "0.4" } },
            }),
          }}
        >
          {activeId ? (
            activeTemplate ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-[#0052cc] bg-white shadow-xl">
                <GripVertical size={14} className="text-[#0052cc]/40" />
                <activeTemplate.icon size={16} className="text-[#0052cc]" />
                <span className="text-sm font-semibold text-[#111827]">
                  {activeTemplate.label}
                </span>
              </div>
            ) : (
              <div className="p-5 rounded-lg border-2 border-[#0052cc] bg-white shadow-xl">
                <div className="flex items-center gap-3">
                  <GripVertical size={16} className="text-[#0052cc]/40" />
                  <span className="font-bold text-[#111827]">
                    {fields.find((f) => f.id === activeId)?.label}
                  </span>
                  <Tag
                    className="text-[10px] font-semibold uppercase border-0 rounded px-1.5 py-0"
                    color="blue"
                  >
                    {fields.find((f) => f.id === activeId)?.fieldType}
                  </Tag>
                </div>
              </div>
            )
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Field edit modal */}
      <Modal
        title={
          <span className="text-[#111827] font-bold text-base">
            Field Configuration
          </span>
        }
        open={!!editingField}
        onCancel={() => setEditingField(null)}
        footer={null}
        width={500}
        closeIcon={<X size={20} className="text-[#6b7280]" />}
      >
        <div className="space-y-5 mt-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-1.5">
              Display Label
            </label>
            <Input
              value={editingField?.label}
              onChange={(e) =>
                setEditingField((prev) =>
                  prev ? { ...prev, label: e.target.value } : null
                )
              }
              className="h-10"
              placeholder="e.g. Summary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-1.5">
                Field Type
              </label>
              <Select
                value={editingField?.fieldType}
                onChange={(val) =>
                  setEditingField((prev) =>
                    prev ? { ...prev, fieldType: val as any } : null
                  )
                }
                className="w-full"
                options={[
                  { label: "Short Text", value: "text" },
                  { label: "Paragraph", value: "textarea" },
                  { label: "Email", value: "email" },
                  { label: "Numeric", value: "number" },
                  { label: "Single Select", value: "select" },
                  { label: "Multi Select", value: "multiselect" },
                  { label: "Checkbox", value: "checkbox" },
                  { label: "Radio", value: "radio" },
                  { label: "Date Picker", value: "date" },
                  { label: "Date Time", value: "datetime" },
                ]}
              />
            </div>
            <div className="flex flex-col justify-end">
              <div className="flex items-center justify-between gap-3 h-[32px] px-3 rounded-lg bg-[#f9fafb] border border-[#e5e7eb]">
                <span className="text-xs font-semibold text-[#6b7280]">
                  Required
                </span>
                <Switch
                  size="small"
                  checked={editingField?.isRequired}
                  onChange={(checked) =>
                    setEditingField((prev) =>
                      prev ? { ...prev, isRequired: checked } : null
                    )
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#9ca3af] mb-1.5">
              Placeholder Hint
            </label>
            <Input
              value={editingField?.placeholder}
              onChange={(e) =>
                setEditingField((prev) =>
                  prev ? { ...prev, placeholder: e.target.value } : null
                )
              }
              className="h-10"
              placeholder="Hint text for users..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#f3f4f6]">
            <Button onClick={() => setEditingField(null)}>Cancel</Button>
            <Button
              onClick={() => editingField && handleSaveEdit(editingField)}
              type="primary"
              className="bg-[#0052cc] border-[#0052cc]"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Custom field creation modal */}
      <CreateCustomFieldModal
        open={showCreateCustomField}
        onClose={() => setShowCreateCustomField(false)}
        projectId={projectId}
        onCreated={handleCustomFieldCreated}
      />

      <style>{`
        .form-builder-tabs .ant-tabs-nav {
          margin-bottom: 12px !important;
        }
        .form-builder-tabs .ant-tabs-tab {
          padding: 6px 0 !important;
          font-size: 12px !important;
        }
        .form-builder-tabs .ant-tabs-ink-bar {
          background: #0052cc !important;
        }
        .form-builder-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #0052cc !important;
        }
        .ant-switch { background: #d1d5db !important; }
        .ant-switch-checked { background: #0052cc !important; }
      `}</style>
    </div>
  );
};

export default FormBuilder;
