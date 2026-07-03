import { useEffect } from 'react';
import { Modal, Form, InputNumber, Select, Slider, Input, Alert } from 'antd';
import type { ProjectBudget, UpsertBudgetInput } from '../types';
import { useUpsertProjectBudgetMutation } from '../financialApi';
import { message } from 'antd';

interface Props {
  projectId: string;
  budget: ProjectBudget | null | undefined;
  open: boolean;
  onClose: () => void;
}

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD'];

export function BudgetSettingsModal({ projectId, budget, open, onClose }: Props) {
  const [form] = Form.useForm();
  const [upsert, { isLoading }] = useUpsertProjectBudgetMutation();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        totalBudget: budget ? Number(budget.totalBudget) : undefined,
        currency: budget?.currency ?? 'USD',
        alertThreshold: budget ? Math.round(Number(budget.alertThreshold) * 100) : 80,
        warningThreshold: budget ? Math.round(Number(budget.warningThreshold) * 100) : 90,
        notes: budget?.notes ?? '',
      });
    }
  }, [open, budget, form]);

  const handleSubmit = async (values: any) => {
    try {
      await upsert({
        projectId,
        data: {
          totalBudget: values.totalBudget,
          currency: values.currency,
          alertThreshold: values.alertThreshold / 100,
          warningThreshold: values.warningThreshold / 100,
          notes: values.notes || undefined,
        } as UpsertBudgetInput,
      }).unwrap();
      message.success('Budget settings saved');
      onClose();
    } catch {
      message.error('Failed to save budget settings');
    }
  };

  return (
    <Modal
      title={budget ? 'Edit Budget Settings' : 'Set Project Budget'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={isLoading}
      okText="Save Budget"
      okButtonProps={{ style: { borderRadius: 8, fontWeight: 600 } }}
      cancelButtonProps={{ style: { borderRadius: 8 } }}
      width={480}
    >
      <Alert
        type="info"
        showIcon
        message="Set the total project budget and alert thresholds. You'll receive notifications when spending approaches these limits."
        style={{ marginBottom: 20, borderRadius: 8 }}
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item
            name="totalBudget"
            label="Total Budget"
            rules={[{ required: true, message: 'Please enter the budget' }]}
            style={{ flex: 1 }}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%', borderRadius: 8 }}
              placeholder="e.g. 50000"
            />
          </Form.Item>
          <Form.Item name="currency" label="Currency" style={{ width: 120 }}>
            <Select
              style={{ borderRadius: 8 }}
              options={CURRENCY_OPTIONS.map((c) => ({ label: c, value: c }))}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="alertThreshold"
          label={
            <span>
              Warning Threshold{' '}
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                (yellow alert)
              </span>
            </span>
          }
        >
          <Slider
            min={50}
            max={100}
            marks={{ 50: '50%', 75: '75%', 90: '90%', 100: '100%' }}
            tooltip={{ formatter: (v) => `${v}%` }}
          />
        </Form.Item>

        <Form.Item
          name="warningThreshold"
          label={
            <span>
              Critical Threshold{' '}
              <span style={{ color: '#ef4444', fontWeight: 600 }}>
                (red alert)
              </span>
            </span>
          }
        >
          <Slider
            min={50}
            max={100}
            marks={{ 50: '50%', 75: '75%', 90: '90%', 100: '100%' }}
            tooltip={{ formatter: (v) => `${v}%` }}
          />
        </Form.Item>

        <Form.Item name="notes" label="Notes (optional)">
          <Input.TextArea
            rows={2}
            placeholder="Add notes about this budget..."
            style={{ borderRadius: 8 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
