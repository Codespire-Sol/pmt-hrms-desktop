import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Card,
  Typography,
  Space,
  Row,
  Col,
  Breadcrumb,
  message,
  Divider,
  Alert,
  Skeleton,
  Avatar,
  Popconfirm,
} from 'antd';
import {
  User,
  Mail,
  Calendar,
  Briefcase,
  Users,
  ShieldCheck,
  Building2,
  ChevronLeft,
  Save,
  MapPin,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import dayjs from 'dayjs';

const COUNTRIES = [
  { value: 'India', flag: '🇮🇳' }, { value: 'United States', flag: '🇺🇸' },
  { value: 'United Kingdom', flag: '🇬🇧' }, { value: 'United Arab Emirates', flag: '🇦🇪' },
  { value: 'Canada', flag: '🇨🇦' }, { value: 'Australia', flag: '🇦🇺' },
  { value: 'Singapore', flag: '🇸🇬' }, { value: 'Germany', flag: '🇩🇪' },
  { value: 'France', flag: '🇫🇷' }, { value: 'Netherlands', flag: '🇳🇱' },
  { value: 'Saudi Arabia', flag: '🇸🇦' }, { value: 'Qatar', flag: '🇶🇦' },
  { value: 'Bahrain', flag: '🇧🇭' }, { value: 'Kuwait', flag: '🇰🇼' },
  { value: 'Oman', flag: '🇴🇲' }, { value: 'Pakistan', flag: '🇵🇰' },
  { value: 'Bangladesh', flag: '🇧🇩' }, { value: 'Sri Lanka', flag: '🇱🇰' },
  { value: 'Nepal', flag: '🇳🇵' }, { value: 'Philippines', flag: '🇵🇭' },
  { value: 'Malaysia', flag: '🇲🇾' }, { value: 'Indonesia', flag: '🇮🇩' },
  { value: 'South Africa', flag: '🇿🇦' }, { value: 'Ireland', flag: '🇮🇪' },
  { value: 'New Zealand', flag: '🇳🇿' }, { value: 'Sweden', flag: '🇸🇪' },
];
import { employeeAPI } from '../api/employees';
import { adminAPI } from '../api/admin';
import Layout from '../components/layout/Layout';
import { themeTokens } from '../styles/theme';
import { broadcastDataRefresh } from '../utils/realtime';
import PhoneInput, { getPhoneValidator } from '../components/common/PhoneInput';
import { useAuth } from '../hooks/useAuth';
import { toTitleCase, getInitials } from '../utils/name';

const { Title, Text } = Typography;
const { Option } = Select;

const DESIGNATION_OPTIONS = [
  {
    label: 'Executive',
    options: [
      { value: 'CEO', label: 'CEO' },
      { value: 'CTO', label: 'CTO' },
      { value: 'COO', label: 'COO' },
      { value: 'CFO', label: 'CFO' },
      { value: 'CHRO', label: 'CHRO' },
    ],
  },
  {
    label: 'Director / VP',
    options: [
      { value: 'VP of Engineering', label: 'VP of Engineering' },
      { value: 'VP of Product', label: 'VP of Product' },
      { value: 'VP of Sales', label: 'VP of Sales' },
      { value: 'Director of Engineering', label: 'Director of Engineering' },
      { value: 'Director of HR', label: 'Director of HR' },
      { value: 'Director of Operations', label: 'Director of Operations' },
      { value: 'Director of Finance', label: 'Director of Finance' },
      { value: 'Director of Marketing', label: 'Director of Marketing' },
    ],
  },
  {
    label: 'Manager / Lead',
    options: [
      { value: 'Engineering Manager', label: 'Engineering Manager' },
      { value: 'Tech Lead', label: 'Tech Lead' },
      { value: 'Team Lead', label: 'Team Lead' },
      { value: 'Project Manager', label: 'Project Manager' },
      { value: 'Product Manager', label: 'Product Manager' },
      { value: 'HR Manager', label: 'HR Manager' },
      { value: 'Operations Manager', label: 'Operations Manager' },
      { value: 'Finance Manager', label: 'Finance Manager' },
      { value: 'Marketing Manager', label: 'Marketing Manager' },
      { value: 'Sales Manager', label: 'Sales Manager' },
    ],
  },
  {
    label: 'Senior',
    options: [
      { value: 'Senior Software Engineer', label: 'Senior Software Engineer' },
      { value: 'Senior Frontend Engineer', label: 'Senior Frontend Engineer' },
      { value: 'Senior Backend Engineer', label: 'Senior Backend Engineer' },
      { value: 'Senior Full Stack Engineer', label: 'Senior Full Stack Engineer' },
      { value: 'Senior Mobile Developer', label: 'Senior Mobile Developer' },
      { value: 'Senior QA Engineer', label: 'Senior QA Engineer' },
      { value: 'Senior DevOps Engineer', label: 'Senior DevOps Engineer' },
      { value: 'Senior Data Scientist', label: 'Senior Data Scientist' },
      { value: 'Senior Data Analyst', label: 'Senior Data Analyst' },
      { value: 'Senior UI/UX Designer', label: 'Senior UI/UX Designer' },
      { value: 'Senior Product Designer', label: 'Senior Product Designer' },
      { value: 'Senior Business Analyst', label: 'Senior Business Analyst' },
      { value: 'Senior HR Executive', label: 'Senior HR Executive' },
    ],
  },
  {
    label: 'Engineer / Specialist',
    options: [
      { value: 'Software Engineer', label: 'Software Engineer' },
      { value: 'Frontend Engineer', label: 'Frontend Engineer' },
      { value: 'Backend Engineer', label: 'Backend Engineer' },
      { value: 'Full Stack Engineer', label: 'Full Stack Engineer' },
      { value: 'Mobile Developer', label: 'Mobile Developer' },
      { value: 'Android Developer', label: 'Android Developer' },
      { value: 'iOS Developer', label: 'iOS Developer' },
      { value: 'QA Engineer', label: 'QA Engineer' },
      { value: 'DevOps Engineer', label: 'DevOps Engineer' },
      { value: 'Cloud Engineer', label: 'Cloud Engineer' },
      { value: 'Security Engineer', label: 'Security Engineer' },
      { value: 'Data Scientist', label: 'Data Scientist' },
      { value: 'Data Analyst', label: 'Data Analyst' },
      { value: 'UI/UX Designer', label: 'UI/UX Designer' },
      { value: 'Product Designer', label: 'Product Designer' },
      { value: 'Business Analyst', label: 'Business Analyst' },
      { value: 'HR Executive', label: 'HR Executive' },
      { value: 'IT Support Engineer', label: 'IT Support Engineer' },
      { value: 'System Administrator', label: 'System Administrator' },
      { value: 'Network Engineer', label: 'Network Engineer' },
      { value: 'Accountant', label: 'Accountant' },
    ],
  },
  {
    label: 'Junior / Trainee',
    options: [
      { value: 'Junior Software Engineer', label: 'Junior Software Engineer' },
      { value: 'Junior Frontend Engineer', label: 'Junior Frontend Engineer' },
      { value: 'Junior Backend Engineer', label: 'Junior Backend Engineer' },
      { value: 'Junior QA Engineer', label: 'Junior QA Engineer' },
      { value: 'Junior Data Analyst', label: 'Junior Data Analyst' },
      { value: 'Junior HR Executive', label: 'Junior HR Executive' },
      { value: 'Trainee Engineer', label: 'Trainee Engineer' },
      { value: 'Intern', label: 'Intern' },
    ],
  },
];

export default function EditEmployee() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isHR, isAdmin } = useAuth();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [managers, setManagers] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [branches, setBranches] = useState([]);
  const selectedRole = Form.useWatch('userRole', form);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [empRes, mgrRes, branchRes] = await Promise.all([
        employeeAPI.getById(id),
        employeeAPI.getActiveManagers(),
        adminAPI.getBranches(),
      ]);

      const emp = empRes.data;
      setEmployee(emp);
      setManagers(mgrRes.data.filter(m => m.id !== id));
      const branchList = Array.isArray(branchRes?.data) ? branchRes.data : [];
      setBranches(branchList);

      // Auto-select branch: use employee's branch, or single branch if unassigned
      const resolvedBranchId = emp.branchId || (branchList.length === 1 ? branchList[0].id : undefined);

      form.setFieldsValue({
        firstName: emp.firstName,
        lastName: emp.lastName,
        personalEmail: emp.personalEmail || '',
        phone: emp.phone,
        gender: emp.gender || undefined,
        dateOfBirth: emp.dateOfBirth ? dayjs(emp.dateOfBirth) : null,
        joiningDate: emp.joiningDate ? dayjs(emp.joiningDate) : null,
        designation: emp.designation,
        department: emp.department,
        workMode: (emp.workMode || 'office').toLowerCase(),
        country: emp.country || undefined,
        managerId: emp.managerId || 'none',
        userRole: toTitleCase(emp.userRole || emp.role || 'Employee'),
        status: (emp.status || 'active').toLowerCase(),
        branchId: resolvedBranchId,
      });
    } catch (error) {
      console.error('Failed to load employee data:', error);
      message.error('Failed to load employee details');
      navigate('/employees');
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await employeeAPI.hardDelete(id);
      message.success('Employee record deleted successfully.');
      broadcastDataRefresh('employees');
      navigate('/employees');
    } catch (error) {
      message.error(error.message || 'Failed to delete employee');
    } finally {
      setDeleting(false);
    }
  };

  const onFinish = async (values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null,
        joiningDate: values.joiningDate ? values.joiningDate.format('YYYY-MM-DD') : undefined,
        managerId: values.managerId === 'none' ? null : values.managerId,
        role: values.userRole,
        gender: values.gender || null,
        branchId: values.branchId || null,
      };

      await employeeAPI.update(id, payload);
      message.success('Employee profile updated successfully!');
      broadcastDataRefresh('employees');
      navigate(`/employees/${id}`);
    } catch (error) {
      message.error(error.message || 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  const sectionHeader = (title, Icon) => (
    <Space size={10} style={{ marginBottom: '16px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        background: themeTokens.colors.accent,
        color: themeTokens.colors.primary
      }}>
        <Icon size={18} />
      </div>
      <Text strong style={{ fontSize: '14px', color: themeTokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </Text>
    </Space>
  );

  if (loading) {
    return (
      <Layout>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            <Skeleton active avatar paragraph={{ rows: 2 }} />
            <Row gutter={24}>
              <Col span={16}><Skeleton active paragraph={{ rows: 12 }} /></Col>
              <Col span={8}><Skeleton active paragraph={{ rows: 8 }} /></Col>
            </Row>
          </Space>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>
        {/* Navigation & Header */}
        <Space direction="vertical" size={20} style={{ width: '100%', marginBottom: '24px' }}>
          <Breadcrumb
            items={[
              { title: <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Building2 size={14} /> Dashboard</Link> },
              { title: <Link to="/employees">Employees</Link> },
              { title: <Link to={`/employees/${id}`}>{employee?.name}</Link> },
              { title: 'Edit Profile' }
            ]}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space size={16}>
              <Button
                shape="circle"
                icon={<ArrowLeft size={18} />}
                onClick={() => navigate(`/employees/${id}`)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              />
              <div>
                <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: '#1E2875' }}>Edit Profile</Title>
                <Text type="secondary">Update administrative and personal details for {employee?.name}.</Text>
              </div>
            </Space>
            <Space>
              <Button onClick={() => navigate(`/employees/${id}`)} style={{ borderRadius: '8px' }}>Cancel</Button>
              <Button
                type="primary"
                icon={<Save size={18} />}
                loading={saving}
                onClick={() => form.submit()}
                style={{ borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                Save Changes
              </Button>
            </Space>
          </div>
        </Space>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark="optional"
        >
          <Row gutter={[24, 24]}>
            {/* Left Column: Form Fields */}
            <Col xs={24} lg={16}>
              <Space direction="vertical" size={24} style={{ width: '100%' }}>

                {/* Profile Overview Banner */}
                <Card
                  style={{
                    borderRadius: '16px',
                    background: `linear-gradient(135deg, ${themeTokens.colors.primary} 0%, #4a90e2 100%)`,
                    border: 'none',
                    marginBottom: '8px'
                  }}
                  styles={{ body: { padding: '24px' } }}
                >
                  <Space size={20}>
                    <Avatar
                      size={64}
                      src={employee?.avatarUrl || undefined}
                      style={{
                        backgroundColor: '#ffffff',
                        color: themeTokens.colors.primary,
                        fontSize: '24px',
                        fontWeight: 700,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    >
                      {getInitials(employee?.name)}
                    </Avatar>
                    <div>
                      <Title level={4} style={{ color: '#fff', margin: 0 }}>{employee?.name}</Title>
                      <Text style={{ color: 'rgba(255,255,255,0.8)' }}>{employee?.employeeCode} • {employee?.designation}</Text>
                    </div>
                  </Space>
                </Card>

                {/* Personal Information */}
                <Card
                  styles={{ body: { padding: '24px' } }}
                  style={{ borderRadius: '12px', boxShadow: themeTokens.shadows.standard, border: '1px solid #e5e7eb' }}
                >
                  {sectionHeader('Personal Details', User)}
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="First Name"
                        name="firstName"
                        rules={[{ required: true, message: 'First name is required' }]}
                      >
                        <Input prefix={<User size={16} style={{ color: '#94a3b8' }} />} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Last Name"
                        name="lastName"
                        rules={[{ required: true, message: 'Last name is required' }]}
                      >
                        <Input prefix={<User size={16} style={{ color: '#94a3b8' }} />} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Personal Email"
                        name="personalEmail"
                        rules={[{ type: 'email', message: 'Enter a valid email' }]}
                        tooltip="Personal email where the onboarding invite was sent. Work email is assigned after onboarding."
                      >
                        <Input prefix={<Mail size={16} style={{ color: '#94a3b8' }} />} placeholder="employee@gmail.com" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Phone Number"
                        name="phone"
                        rules={[
                          { required: true, message: 'Phone number is required' },
                          { validator: getPhoneValidator(true) },
                        ]}
                      >
                        <PhoneInput />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Gender"
                        name="gender"
                      >
                        <Select placeholder="Select gender" allowClear>
                          <Option value="male">Male</Option>
                          <Option value="female">Female</Option>
                          <Option value="other">Other</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Date of Birth"
                        name="dateOfBirth"
                        rules={[
                          { required: true, message: 'Date of birth is required' },
                          {
                            validator: (_, value) => {
                              if (!value) return Promise.resolve();
                              if (dayjs().diff(value, 'years') < 18)
                                return Promise.reject(new Error('Employee must be at least 18 years old'));
                              return Promise.resolve();
                            },
                          },
                        ]}
                      >
                        <DatePicker
                          style={{ width: '100%' }}
                          suffixIcon={<Calendar size={16} style={{ color: '#94a3b8' }} />}
                          format="DD MMM YYYY"
                          disabledDate={(current) => current && current > dayjs().subtract(18, 'years')}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* Professional Details */}
                <Card
                  styles={{ body: { padding: '24px' } }}
                  style={{ borderRadius: '12px', boxShadow: themeTokens.shadows.standard, border: '1px solid #e5e7eb' }}
                >
                  {sectionHeader('Employment & Role', Briefcase)}
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Designation"
                        name="designation"
                        rules={[{ required: true }]}
                      >
                        <Select
                          showSearch
                          placeholder="Select designation"
                          optionFilterProp="label"
                          options={DESIGNATION_OPTIONS}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Department"
                        name="department"
                        rules={[{ required: true }]}
                      >
                        <Select showSearch placeholder="Select department" optionFilterProp="label">
                          {[
                            'Administration', 'Business Development', 'Customer Support', 'Data & Analytics',
                            'Design', 'DevOps / Infrastructure', 'Engineering', 'Finance',
                            'Human Resources', 'IT', 'Legal & Compliance', 'Marketing',
                            'Operations', 'Product Management', 'Quality Assurance', 'Sales', 'Security',
                          ].map(dept => (
                            <Option key={dept} value={dept}>{dept}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Joining Date"
                        name="joiningDate"
                        rules={[{ required: true, message: 'Joining date is required' }]}
                      >
                        <DatePicker
                          style={{ width: '100%' }}
                          suffixIcon={<Calendar size={16} style={{ color: '#94a3b8' }} />}
                          format="DD MMM YYYY"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Work Mode"
                        name="workMode"
                        rules={[{ required: true }]}
                      >
                        <Select>
                          <Option value="office">Office</Option>
                          <Option value="remote">Remote</Option>
                          <Option value="hybrid">Hybrid</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="Country" name="country" rules={[{ required: true, message: 'Country is required' }]}>
                        <Select
                          showSearch
                          placeholder="Select country"
                          optionFilterProp="label"
                          options={COUNTRIES.map(c => ({ value: c.value, label: `${c.flag} ${c.value}` }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Reporting Manager"
                        name="managerId"
                        rules={[{ required: true }]}
                      >
                        <Select showSearch optionFilterProp="children">
                          <Option value="none">No Manager (Top Level)</Option>
                          {managers.map(mgr => (
                            <Option key={mgr.id} value={mgr.id}>
                              {mgr.name} ({mgr.employeeCode})
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Employee Status"
                        name="status"
                        rules={[{ required: true }]}
                      >
                        <Select>
                          <Option value="active">Active</Option>
                          <Option value="onboarding">Onboarding</Option>
                          <Option value="notice period">Notice Period</Option>
                          <Option value="exited">Exited</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="System Access Role"
                        name="userRole"
                        rules={[{ required: true }]}
                      >
                        <Select>
                          <Option value="Employee">Employee</Option>
                          <Option value="Manager">Manager</Option>
                          {isAdmin && <Option value="HR">HR Executive</Option>}
                        </Select>
                      </Form.Item>
                    </Col>
                    {isAdmin && branches.length > 0 ? (
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="Branch"
                          name="branchId"
                          tooltip="The branch this employee belongs to."
                          rules={branches.length > 1 ? [{ required: true, message: 'Please select a branch' }] : []}
                        >
                          <Select
                            showSearch
                            allowClear={branches.length <= 1}
                            placeholder="Select branch"
                            optionFilterProp="label"
                            options={branches.map(b => ({ value: b.id, label: b.name }))}
                          />
                        </Form.Item>
                      </Col>
                    ) : null}
                  </Row>
                </Card>
              </Space>
            </Col>

            {/* Right Column: Actions & Info */}
            <Col xs={24} lg={8}>
              <Space direction="vertical" size={24} style={{ width: '100%' }}>
                <Card
                  title={<Space><ShieldCheck size={18} color={themeTokens.colors.primary} /> <Text strong>Security & Audit</Text></Space>}
                  style={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: themeTokens.shadows.standard }}
                >
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>LAST UPDATED</Text>
                      <Text strong style={{ fontSize: '13px' }}>{employee?.updatedAt ? dayjs(employee.updatedAt).format('DD MMM YYYY, HH:mm') : 'Initial Creation'}</Text>
                    </div>

                    <Alert
                      type="info"
                      showIcon
                      message="Employee ID"
                      description="Employee ID is system-generated and cannot be changed. Personal email can be updated if the employee has changed it."
                      style={{ borderRadius: '8px' }}
                    />

                    <Divider style={{ margin: '12px 0' }} />

                    <Button block danger type="dashed" style={{ borderRadius: '8px' }}>
                      Reset User Password
                    </Button>
                  </Space>
                </Card>

                {/* Delete — only while onboarding */}
                {employee?.status === 'onboarding' && (
                  <Card
                    style={{ borderRadius: '12px', border: '1px solid #fca5a5', background: '#fff5f5' }}
                    styles={{ body: { padding: '20px' } }}
                  >
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <Space size={8}>
                        <Trash2 size={16} color="#dc2626" />
                        <Text strong style={{ color: '#dc2626', fontSize: 14 }}>Delete Employee</Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        This will permanently remove the employee record. Only available while onboarding is incomplete.
                      </Text>
                      <Popconfirm
                        title="Delete Employee"
                        description={`Permanently delete ${employee?.name}? This cannot be undone.`}
                        onConfirm={handleDelete}
                        okText="Yes, Delete"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          block
                          danger
                          type="primary"
                          icon={<Trash2 size={14} />}
                          loading={deleting}
                          style={{ borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                          Delete Employee
                        </Button>
                      </Popconfirm>
                    </Space>
                  </Card>
                )}

                <Card
                  styles={{ body: { padding: '24px' } }}
                  style={{ background: '#fafafa', borderRadius: '12px', border: '1px solid #e5e7eb' }}
                >
                  <Title level={5} style={{ margin: 0, marginBottom: '12px' }}>Confirm Changes</Title>
                  <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginBottom: '20px' }}>
                    Updating these details may affect organizational hierarchy and payroll processing.
                  </Text>
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    <Button
                      type="primary"
                      size="large"
                      block
                      loading={saving}
                      onClick={() => form.submit()}
                      style={{ height: '48px', fontWeight: 600, borderRadius: '8px' }}
                    >
                      Update Profile
                    </Button>
                    <Button
                      block
                      size="large"
                      onClick={() => navigate(`/employees/${id}`)}
                      style={{ borderRadius: '8px' }}
                    >
                      Discard
                    </Button>
                  </Space>
                </Card>
              </Space>
            </Col>
          </Row>
        </Form>
      </div>
    </Layout>
  );
}
