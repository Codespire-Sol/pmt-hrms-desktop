import React, { useState, useCallback } from "react";
import { Modal, Input, Select, Switch, Button, message, Space } from "antd";
import { Plus, Trash2, X } from "lucide-react";
import { useCreateCustomFieldMutation } from "@/features/custom-fields/customFieldsApi";
import type { CustomFieldType } from "@/features/custom-fields/types";
import { FORM_FIELD_KEY_REGEX } from "../formsApi";
import type { FormFieldType } from "../formsApi";

interface CreateCustomFieldModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onCreated: (field: {
    id: string;
    fieldKey: string;
    label: string;
    fieldType: FormFieldType;
    isRequired: boolean;
    placeholder?: string;
  }) => void;
}

const FIELD_TYPE_OPTIONS: {
  label: string;
  value: CustomFieldType;
  formType: FormFieldType;
}[] = [
  { label: "Short Text", value: "text", formType: "text" },
  { label: "Number", value: "number", formType: "number" },
  { label: "Email", value: "email", formType: "email" },
  { label: "Single Select", value: "select", formType: "select" },
  { label: "Multi Select", value: "multiselect", formType: "multiselect" },
  { label: "Checkbox", value: "checkbox", formType: "checkbox" },
  { label: "Date", value: "date", formType: "date" },
  { label: "Date Time", value: "datetime", formType: "datetime" },
];

const toFieldKey = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .replace(/^(\d)/, "field_$1") || "custom_field";

export const CreateCustomFieldModal: React.FC<CreateCustomFieldModalProps> = ({
  open,
  onClose,
  projectId,
  onCreated,
}) => {
  const [name, setName] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState<{ label: string; value: string }[]>(
    []
  );
  const [keyEdited, setKeyEdited] = useState(false);

  const [createCustomField, { isLoading }] = useCreateCustomFieldMutation();

  const reset = useCallback(() => {
    setName("");
    setFieldKey("");
    setFieldType("text");
    setIsRequired(false);
    setOptions([]);
    setKeyEdited(false);
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!keyEdited) {
      setFieldKey(toFieldKey(val));
    }
  };

  const needsOptions = fieldType === "select" || fieldType === "multiselect";

  const addOption = () => {
    setOptions((prev) => [
      ...prev,
      { label: "", value: `option_${prev.length + 1}` },
    ]);
  };

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateOption = (
    index: number,
    field: "label" | "value",
    val: string
  ) => {
    setOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, [field]: val } : opt))
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      message.error("Field name is required");
      return;
    }
    if (!fieldKey.trim() || !FORM_FIELD_KEY_REGEX.test(fieldKey)) {
      message.error(
        "Field key must start with a letter and contain only letters, numbers, and underscores"
      );
      return;
    }
    if (needsOptions && options.length === 0) {
      message.error("Add at least one option for select fields");
      return;
    }
    if (needsOptions && options.some((o) => !o.label.trim())) {
      message.error("All options must have a label");
      return;
    }

    try {
      const result = await createCustomField({
        projectId,
        body: {
          name: name.trim(),
          fieldKey: fieldKey.trim(),
          fieldType,
          isRequired,
          ...(needsOptions && options.length > 0
            ? {
                options: options.map((o) => ({
                  label: o.label.trim(),
                  value: o.value.trim() || o.label.trim().toLowerCase().replace(/\s+/g, "_"),
                })),
              }
            : {}),
        },
      }).unwrap();

      const matchedType = FIELD_TYPE_OPTIONS.find(
        (t) => t.value === fieldType
      );

      onCreated({
        id: `field-custom-${Date.now()}`,
        fieldKey: fieldKey.trim(),
        label: name.trim(),
        fieldType: matchedType?.formType || "text",
        isRequired,
      });

      message.success(`Custom field "${name.trim()}" created`);
      reset();
      onClose();
    } catch (err: any) {
      message.error(
        err?.data?.message || err?.data?.error?.message || "Failed to create custom field"
      );
    }
  };

  return (
    <Modal
      title={
        <span className="text-[#172b4d] font-bold text-base">
          Create Custom Field
        </span>
      }
      open={open}
      onCancel={() => {
        reset();
        onClose();
      }}
      footer={null}
      width={480}
      destroyOnClose
      closeIcon={<X size={20} className="text-[#5e6c84]" />}
    >
      <div className="space-y-5 mt-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#9eaec2] mb-1.5">
            Field Name
          </label>
          <Input
            placeholder="e.g. Customer Name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="h-10"
          />
        </div>

        {/* Field Key */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#9eaec2] mb-1.5">
            Field Key
          </label>
          <Input
            placeholder="e.g. customer_name"
            value={fieldKey}
            onChange={(e) => {
              setFieldKey(e.target.value);
              setKeyEdited(true);
            }}
            className="h-10 font-mono text-sm"
          />
          <span className="text-[11px] text-[#9eaec2] mt-1 block">
            Used as the unique identifier. Auto-generated from name.
          </span>
        </div>

        {/* Field Type */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#9eaec2] mb-1.5">
            Field Type
          </label>
          <Select
            className="w-full"
            value={fieldType}
            onChange={(val) => setFieldType(val)}
            options={FIELD_TYPE_OPTIONS.map((t) => ({
              label: t.label,
              value: t.value,
            }))}
          />
        </div>

        {/* Required */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-[#f4f5f7] border border-[#dfe1e6]">
          <span className="text-sm font-bold text-[#5e6c84]">Required</span>
          <Switch
            size="small"
            checked={isRequired}
            onChange={setIsRequired}
          />
        </div>

        {/* Options (for select/multiselect) */}
        {needsOptions && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#9eaec2] mb-2">
              Options
            </label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder={`Option ${i + 1} label`}
                    value={opt.label}
                    onChange={(e) => updateOption(i, "label", e.target.value)}
                    className="flex-1 h-9"
                  />
                  <Button
                    type="text"
                    danger
                    icon={<Trash2 size={14} />}
                    onClick={() => removeOption(i)}
                    className="flex items-center justify-center"
                    size="small"
                  />
                </div>
              ))}
              <Button
                type="dashed"
                icon={<Plus size={14} />}
                onClick={addOption}
                className="w-full"
                size="small"
              >
                Add option
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-[#f4f5f7]">
          <Button
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={isLoading}
            className="bg-[#0052cc] border-[#0052cc]"
          >
            Create Field
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateCustomFieldModal;
