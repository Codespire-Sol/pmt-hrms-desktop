import { useState } from 'react';
import { Table, Button, Modal, Form, InputNumber, Select, Popconfirm, Avatar, Tag, message } from 'antd';
import { Plus, Edit2, Trash2, User } from 'lucide-react';
import type { ResourceRate, CreateResourceRateInput, UpdateResourceRateInput } from '../types';
import {
  useCreateResourceRateMutation,
  useUpdateResourceRateMutation,
  useDeleteResourceRateMutation,
} from '../financialApi';
import { useGetProjectMembersQuery } from '../../projects/projectsApi';

interface Props {
  projectId: string;
  rates: ResourceRate[];
  canManage: boolean;
  currency: string;
}

export function ResourceRatesTable({ projectId, rates, canManage, currency }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ResourceRate | null>(null);
  const [form] = Form.useForm();

  const { data: members = [] } = useGetProjectMembersQuery(projectId);
  const usedUserIds = rates.map((r) => r.userId).filter(Boolean);

  const [createRate, { isLoading: creating }] = useCreateResourceRateMutation();
  const [updateRate, { isLoading: updating }] = useUpdateResourceRateMutation();
  const [deleteRate] = useDeleteResourceRateMutation();

  const openCreate = () => {
    setEditingRate(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (rate: ResourceRate) => {
    setEditingRate(rate);
    form.setFieldsValue({
      userId: rate.userId,
      hourlyRate: rate.hourlyRate,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const member = members.find((m) => m.userId === values.userId);
      const role = member?.pmtRole?.displayName ?? 'Member';
      const data = { ...values, role, currency };
      if (editingRate) {
        await updateRate({
          projectId,
          rateId: editingRate.id,
          data: data as UpdateResourceRateInput,
        }).unwrap();
        message.success('Resource rate updated');
      } else {
        await createRate({ projectId, data: data as CreateResourceRateInput }).unwrap();
        message.success('Resource rate created');
      }
      setModalOpen(false);
    } catch {
      message.error('Failed to save resource rate');
    }
  };

  const handleDelete = async (rateId: string) => {
    try {
      await deleteRate({ projectId, rateId }).unwrap();
      message.success('Resource rate deleted');
    } catch {
      message.error('Failed to delete resource rate');
    }
  };

  const columns = [
    {
      title: 'Resource',
      key: 'resource',
      render: (_: any, rate: ResourceRate) => {
        const member = members.find((m) => m.userId === rate.userId);
        const displayName = rate.user
          ? `${rate.user.firstName} ${rate.user.lastName}`
          : member?.user?.displayName ?? rate.role;
        const email = rate.user?.email ?? member?.user?.email;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar
              size={32}
              src={rate.user?.avatarUrl ?? member?.user?.avatarUrl ?? undefined}
              icon={<User size={14} />}
              style={{ backgroundColor: '#1268ff20', color: '#1268ff', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#101828' }}>
                {displayName}
              </div>
              {email && (
                <div style={{ fontSize: 12, color: '#6b7280' }}>{email}</div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color="blue" style={{ fontWeight: 600, borderRadius: 6 }}>{role}</Tag>
      ),
    },
    {
      title: 'Hourly Rate',
      key: 'hourlyRate',
      render: (_: any, rate: ResourceRate) => (
        <span style={{ fontWeight: 700, fontSize: 15, color: '#101828' }}>
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: rate.currency }).format(rate.hourlyRate)}
          <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginLeft: 4 }}>/hr</span>
        </span>
      ),
    },
    {
      title: 'Currency',
      key: 'currency',
      render: () => <Tag style={{ borderRadius: 6 }}>{currency}</Tag>,
    },
    ...(canManage
      ? [
          {
            title: '',
            key: 'actions',
            width: 100,
            render: (_: any, rate: ResourceRate) => (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="small"
                  icon={<Edit2 size={13} />}
                  onClick={() => openEdit(rate)}
                  style={{ borderRadius: 6 }}
                />
                <Popconfirm
                  title="Delete this rate?"
                  onConfirm={() => handleDelete(rate.id)}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={13} />}
                    style={{ borderRadius: 6 }}
                  />
                </Popconfirm>
              </div>
            ),
          },
        ]
      : []),
  ];

  // Members available for selection: exclude those who already have a rate (unless editing that rate)
  const availableMembers = members.filter(
    (m) => !usedUserIds.includes(m.userId) || m.userId === editingRate?.userId
  );

  return (
    <div>
      {canManage && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={openCreate}
            style={{ borderRadius: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Add Rate
          </Button>
        </div>
      )}

      <Table
        dataSource={rates}
        columns={columns}
        rowKey="id"
        pagination={false}
        size="middle"
        locale={{ emptyText: 'No resource rates defined. Add rates to enable cost tracking.' }}
      />

      <Modal
        title={editingRate ? 'Edit Resource Rate' : 'Add Resource Rate'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={creating || updating}
        okText={editingRate ? 'Update' : 'Create'}
        okButtonProps={{ style: { borderRadius: 8, fontWeight: 600 } }}
        cancelButtonProps={{ style: { borderRadius: 8 } }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="userId"
            label="Member"
            rules={[{ required: true, message: 'Please select a member' }]}
          >
            <Select
              showSearch
              placeholder="Select member"
              optionFilterProp="label"
              style={{ borderRadius: 8 }}
              options={availableMembers.map((m) => ({
                label: `${m.user.displayName}${m.pmtRole ? ` — ${m.pmtRole.displayName}` : ''}`,
                value: m.userId,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="hourlyRate"
            label="Hourly Rate"
            rules={[{ required: true, message: 'Please enter the hourly rate' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%', borderRadius: 8 }}
              placeholder="e.g. 75.00"
            />
          </Form.Item>
          <Form.Item label="Currency">
            <Tag style={{ borderRadius: 6, fontSize: 14, padding: '2px 10px' }}>{currency}</Tag>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              Inherited from project budget
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
