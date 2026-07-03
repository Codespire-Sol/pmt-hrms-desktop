import { useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker } from 'antd';
import dayjs from 'dayjs';
import {
  useCreateEpicMutation,
  useUpdateEpicMutation,
  Epic,
  EpicStatus,
} from './epicsApi';

const { TextArea } = Input;

const PRESET_COLORS = [
  '#1677ff',
  '#52c41a',
  '#faad14',
  '#ff4d4f',
  '#722ed1',
  '#13c2c2',
  '#eb2f96',
  '#fa8c16',
];

const statusOptions: { value: EpicStatus; label: string }[] = [
  { value: 'to_do', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

interface EpicFormModalProps {
  projectId: string;
  epic?: Epic | null;
  open: boolean;
  onClose: () => void;
}

interface EpicFormValues {
  name: string;
  summary?: string;
  color: string;
  status: EpicStatus;
  startDate?: dayjs.Dayjs | null;
  endDate?: dayjs.Dayjs | null;
}

export function EpicFormModal({ projectId, epic, open, onClose }: EpicFormModalProps) {
  const isEditing = !!epic;
  const [form] = Form.useForm<EpicFormValues>();

  const [createEpic, { isLoading: isCreating }] = useCreateEpicMutation();
  const [updateEpic, { isLoading: isUpdating }] = useUpdateEpicMutation();

  const isSubmitting = isCreating || isUpdating;

  useEffect(() => {
    if (open) {
      if (epic) {
        form.setFieldsValue({
          name: epic.name,
          summary: epic.summary || '',
          color: epic.color || PRESET_COLORS[0],
          status: epic.status,
          startDate: epic.startDate ? dayjs(epic.startDate) : null,
          endDate: epic.endDate ? dayjs(epic.endDate) : null,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          color: PRESET_COLORS[0],
          status: 'to_do',
        });
      }
    }
  }, [open, epic, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        summary: values.summary || undefined,
        color: values.color,
        status: values.status,
        startDate: values.startDate ? values.startDate.toISOString() : undefined,
        endDate: values.endDate ? values.endDate.toISOString() : undefined,
      };

      if (isEditing && epic) {
        await updateEpic({
          epicId: epic.id,
          data: {
            ...payload,
            startDate: values.startDate ? values.startDate.toISOString() : null,
            endDate: values.endDate ? values.endDate.toISOString() : null,
          },
        }).unwrap();
      } else {
        await createEpic({
          projectId,
          data: payload,
        }).unwrap();
      }

      onClose();
    } catch {
      // Form validation or API error - handled by Ant Design form or RTK Query
    }
  };

  const selectedColor = Form.useWatch('color', form);

  return (
    <Modal
      title={isEditing ? 'Edit Epic' : 'Create Epic'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={isSubmitting ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Epic' : 'Create Epic')}
      cancelText="Cancel"
      confirmLoading={isSubmitting}
      destroyOnClose
      width={520}
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="name"
          label="Name"
          rules={[
            { required: true, message: 'Epic name is required' },
            { max: 100, message: 'Name must be 100 characters or less' },
          ]}
        >
          <Input placeholder="e.g., User Authentication, Payment Integration" />
        </Form.Item>

        <Form.Item
          name="summary"
          label="Summary"
          rules={[{ max: 500, message: 'Summary must be 500 characters or less' }]}
        >
          <TextArea
            placeholder="Briefly describe the goal of this epic..."
            rows={3}
          />
        </Form.Item>

        <Form.Item
          name="color"
          label="Color"
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => form.setFieldsValue({ color })}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  backgroundColor: color,
                  border: selectedColor === color ? '3px solid #101828' : '2px solid transparent',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'border-color 0.2s, transform 0.2s',
                  transform: selectedColor === color ? 'scale(1.1)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </Form.Item>

        <Form.Item
          name="status"
          label="Status"
        >
          <Select options={statusOptions} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item
            name="startDate"
            label="Start Date"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="endDate"
            label="End Date"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}

export default EpicFormModal;
