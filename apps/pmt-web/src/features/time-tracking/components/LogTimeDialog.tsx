import { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, DatePicker, Input, Button, Space, Typography, Row, Col, Divider, message } from 'antd';
import { Clock, Calendar, FileText, ChevronRight, AlertCircle } from 'lucide-react';
import dayjs from 'dayjs';
import { useLogTimeMutation } from '../timeTrackingApi';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface LogTimeDialogProps {
  issueId: string;
  issueKey?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Design System Constants
const COLORS = {
  primary: '#1268ff',
  success: '#10b981',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  background: '#f9fafb'
};

export function LogTimeDialog({ issueId, issueKey, open, onOpenChange }: LogTimeDialogProps) {
  const [logTime, { isLoading }] = useLogTimeMutation();
  const [form] = Form.useForm();

  // Reset form when opening
  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        hours: 0,
        minutes: 0,
        workDate: dayjs(),
        description: ''
      });
    }
  }, [open, form]);

  const handleSubmit = async (values: any) => {
    const { hours = 0, minutes = 0, workDate, description } = values;

    // Convert to decimal hours
    const totalHours = (hours || 0) + (minutes || 0) / 60;

    if (totalHours <= 0) {
      message.error('Please enter a valid time duration');
      return;
    }

    try {
      await logTime({
        issueId,
        body: {
          hours: totalHours,
          description: description || undefined,
          workDate: workDate.format('YYYY-MM-DD'),
        },
      }).unwrap();

      message.success('Time logged successfully');
      onOpenChange(false);
      form.resetFields();
    } catch (err: any) {
      message.error(err?.data?.error?.message || 'Failed to log time');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={() => onOpenChange(false)}
      footer={null}
      width={480}
      centered
      className="premium-modal"
      title={null}
      styles={{
        body: {
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
        }
      }}
    >
      {/* Premium Header */}
      <div style={{
        padding: '24px',
        background: `linear-gradient(135deg, ${COLORS.primary}05 0%, ${COLORS.primary}15 100%)`,
        borderBottom: `1px solid ${COLORS.border}`,
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            color: COLORS.primary
          }}>
            <Clock size={24} strokeWidth={2.5} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Log Time</Title>
            {issueKey && <Text type="secondary" style={{ fontSize: '13px' }}>Working on <Text strong style={{ color: COLORS.primary }}>{issueKey}</Text></Text>}
          </div>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ padding: '24px' }}
        requiredMark={false}
      >
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              label={<Text style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textSecondary }}>Hours</Text>}
              name="hours"
              rules={[{ type: 'number', min: 0 }]}
            >
              <InputNumber
                style={{ width: '100%', height: '42px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
                placeholder="0"
                min={0}
                max={24}
                autoFocus
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label={<Text style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textSecondary }}>Minutes</Text>}
              name="minutes"
              rules={[{ type: 'number', min: 0, max: 59 }]}
            >
              <InputNumber
                style={{ width: '100%', height: '42px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
                placeholder="0"
                min={0}
                max={59}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label={<Text style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textSecondary }}>Work Date</Text>}
          name="workDate"
          rules={[{ required: true, message: 'Please select a date' }]}
        >
          <DatePicker
            style={{ width: '100%', height: '42px', borderRadius: '8px' }}
            suffixIcon={<Calendar size={16} />}
            format="MMMM D, YYYY"
            disabledDate={(current) => current && current > dayjs().endOf('day')}
          />
        </Form.Item>

        <Form.Item
          label={<Text style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textSecondary }}>What did you do?</Text>}
          name="description"
        >
          <TextArea
            rows={4}
            placeholder="Describe your progress..."
            style={{ borderRadius: '8px', padding: '12px' }}
          />
        </Form.Item>

        <Divider style={{ margin: '24px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Button
            onClick={() => onOpenChange(false)}
            style={{ height: '40px', borderRadius: '8px', fontWeight: 600, padding: '0 20px' }}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={isLoading}
            style={{
              height: '40px',
              borderRadius: '8px',
              fontWeight: 600,
              padding: '0 24px',
              backgroundColor: COLORS.primary,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Log Session <ChevronRight size={16} />
          </Button>
        </div>
      </Form>

      <style>{`
        .premium-modal .ant-modal-content {
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
        }
        .premium-modal .ant-input-number:hover,
        .premium-modal .ant-input-number-focused {
          border-color: ${COLORS.primary} !important;
        }
        .premium-modal .ant-form-item-label {
          padding-bottom: 6px !important;
        }
        .premium-modal .ant-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 6px -1px rgba(18, 104, 255, 0.2);
          transition: all 0.2s ease;
        }
      `}</style>
    </Modal>
  );
}

export default LogTimeDialog;
