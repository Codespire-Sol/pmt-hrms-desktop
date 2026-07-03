import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Form,
  Input,
  Select,
  AutoComplete,
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
  Alert
} from 'antd';
import {
  User,
  Mail,
  Calendar,
  Briefcase,
  Users,
  ShieldCheck,
  Lock,
  Info,
  Building2,
  ChevronLeft,
  Layers,
} from 'lucide-react';
import dayjs from 'dayjs';
import { employeeAPI } from '../api/employees';
import { adminAPI } from '../api/admin';
import Layout from '../components/layout/Layout';
import { themeTokens } from '../styles/theme';
import { toTitleCase } from '../utils/name';
import { broadcastDataRefresh } from '../utils/realtime';
import { useAuth } from '../hooks/useAuth';
import PhoneInput, { getPhoneValidator } from '../components/common/PhoneInput';

const { Title, Text } = Typography;
const { Option } = Select;

const FIXED_DEPARTMENTS = [
  'Administration',
  'Business Development',
  'Customer Support',
  'Data & Analytics',
  'Design',
  'DevOps / Infrastructure',
  'Engineering',
  'Finance',
  'Human Resources',
  'IT',
  'Legal & Compliance',
  'Marketing',
  'Operations',
  'Product Management',
  'Quality Assurance',
  'Sales',
  'Security',
];

// Seniority levels for the org tree
const DESIGNATION_TYPES = [
  { value: 'Executive',           label: 'Executive',           description: 'C-Suite — CEO, CTO, COO, CFO…' },
  { value: 'Director / VP',       label: 'Director / VP',       description: 'VP & Director-level leadership' },
  { value: 'Manager / Lead',      label: 'Manager / Lead',      description: 'Team & engineering managers' },
  { value: 'Senior',              label: 'Senior',              description: 'Senior individual contributors' },
  { value: 'Engineer / Specialist', label: 'Engineer / Specialist', description: 'Mid-level ICs & specialists' },
  { value: 'Junior / Trainee',    label: 'Junior / Trainee',    description: 'Junior roles, interns & trainees' },
];

// Designation names grouped by type — used to filter options after type is chosen
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

export default function AddEmployee() {
  const { isHR, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState([]);
  const [branches, setBranches] = useState([]);

  // Cascading watches: dept → designationType → designation
  const selectedDept = Form.useWatch('department', form);
  const selectedDesignationType = Form.useWatch('designationType', form);

  // Executive and Director/VP levels don't need a reporting manager
  const isExecutive = ['Executive', 'Director / VP'].includes(selectedDesignationType);

  // Filter designation name options based on selected type
  const filteredDesignationOptions = selectedDesignationType
    ? (DESIGNATION_OPTIONS.find(g => g.label === selectedDesignationType)?.options || [])
    : [];

  useEffect(() => {
    loadManagers();
    if (isAdmin) {
      adminAPI.getBranches().then(res => {
        setBranches(Array.isArray(res?.data) ? res.data : []);
      }).catch(() => {});
    }
  }, [isAdmin]);

  const loadManagers = async () => {
    try {
      const empRes = await employeeAPI.getActiveManagers();
      setManagers(empRes.data);
    } catch (error) {
      console.error('Failed to load managers:', error);
    }
  };

  // Reset downstream fields when a parent selection changes
  const handleDepartmentChange = () => {
    form.resetFields(['designationType', 'designation']);
  };

  const handleDesignationTypeChange = (value) => {
    form.resetFields(['designation']);
    // Executive / Director roles have no reporting manager — clear the field
    if (['Executive', 'Director / VP'].includes(value)) {
      form.setFieldValue('managerId', undefined);
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null,
        joiningDate: values.joiningDate ? values.joiningDate.format('YYYY-MM-DD') : null,
        name: toTitleCase(values.name),
        managerId: values.managerId === 'none' ? null : (values.managerId || null),
        designationType: undefined, // helper field only — not sent to API
        branchId: isAdmin ? (values.branchId || null) : undefined, // admin can select; HR branch set server-side
      };

      const response = await employeeAPI.create(payload);
      message.success(`Account created! Employee Code: ${response.data?.employeeCode || response.data?.employee_id || '-'}`);
      broadcastDataRefresh('employees');
      navigate('/employees');
    } catch (error) {
      message.error(error.message || 'Failed to create employee');
    } finally {
      setLoading(false);
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
        color: themeTokens.colors.primary,
      }}>
        <Icon size={18} />
      </div>
      <Text strong style={{ fontSize: '15px', color: themeTokens.colors.textPrimary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </Text>
    </Space>
  );

  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '40px' }}>
        {/* Header */}
        <Space direction="vertical" size={20} style={{ width: '100%', marginBottom: '24px' }}>
          <Breadcrumb
            items={[
              { title: <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Building2 size={14} /> Dashboard</Link> },
              { title: <Link to="/employees">Employees</Link> },
              { title: 'Add New Employee' },
            ]}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Title level={2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: '#1E2875' }}>Add New Employee</Title>
              <Text type="secondary">Onboard a new member to the organization by providing their basic details.</Text>
            </div>
            <Button
              icon={<ChevronLeft size={16} />}
              onClick={() => navigate('/employees')}
              style={{ display: 'flex', alignItems: 'center', height: '40px', borderRadius: '8px' }}
            >
              Back to List
            </Button>
          </div>
        </Space>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            workMode: 'office',
            userRole: 'Employee',
            status: 'onboarding',
            temporaryPassword: 'Welcome@123',
          }}
          requiredMark="optional"
        >
          <Row gutter={[24, 24]}>
            {/* Left Column */}
            <Col xs={24} lg={16}>
              <Space direction="vertical" size={24} style={{ width: '100%' }}>

                {/* Personal Information */}
                <Card
                  styles={{ body: { padding: '24px' } }}
                  style={{ borderRadius: '12px', boxShadow: themeTokens.shadows.standard, border: '1px solid #e5e7eb' }}
                >
                  {sectionHeader('Personal Information', User)}
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Full Name"
                        name="name"
                        rules={[{ required: true, message: 'Please enter full name' }]}
                      >
                        <Input prefix={<User size={16} style={{ color: '#94a3b8' }} />} placeholder="Enter full name" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Personal Email"
                        name="email"
                        tooltip="The onboarding invite link will be sent to this email. Work email is assigned after onboarding."
                        rules={[
                          { required: true, message: 'Please enter personal email address' },
                          { type: 'email', message: 'Please enter a valid email address' },
                        ]}
                      >
                        <Input prefix={<Mail size={16} style={{ color: '#94a3b8' }} />} placeholder="employee@gmail.com" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Phone Number"
                        name="phone"
                        rules={[
                          { required: true, message: 'Please enter phone number' },
                          { validator: getPhoneValidator(true) },
                        ]}
                      >
                        <PhoneInput />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Date of Birth"
                        name="dateOfBirth"
                        rules={[
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
                          placeholder="Optional — can be filled via onboarding link"
                          disabledDate={(current) => current && current > dayjs().subtract(18, 'years')}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>

                {/* Employment Information */}
                <Card
                  styles={{ body: { padding: '24px' } }}
                  style={{ borderRadius: '12px', boxShadow: themeTokens.shadows.standard, border: '1px solid #e5e7eb' }}
                >
                  {sectionHeader('Employment Information', Briefcase)}
                  <Row gutter={16}>

                    {/* Step 1 — Department */}
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Department"
                        name="department"
                        rules={[{ required: true, message: 'Please select a department' }]}
                      >
                        <Select
                          showSearch
                          placeholder="Select department first"
                          optionFilterProp="label"
                          onChange={handleDepartmentChange}
                        >
                          {FIXED_DEPARTMENTS.map(dept => (
                            <Option key={dept} value={dept}>{dept}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>

                    {/* Step 2 — Designation Type (disabled until dept selected) */}
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Designation Type"
                        name="designationType"
                        tooltip="Choose the seniority level, then select the specific designation title below."
                        rules={[{ required: true, message: 'Please select designation type' }]}
                      >
                        <Select
                          placeholder={selectedDept ? 'Select level (Executive, Senior…)' : 'Select department first'}
                          disabled={!selectedDept}
                          onChange={handleDesignationTypeChange}
                          optionLabelProp="label"
                        >
                          {DESIGNATION_TYPES.map(t => (
                            <Option key={t.value} value={t.value} label={t.label}>
                              <div style={{ padding: '2px 0' }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{t.description}</div>
                              </div>
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>

                    {/* Step 3 — Designation Title: suggestions from filtered list, free text allowed */}
                    <Col xs={24}>
                      <Form.Item
                        label="Designation Title"
                        name="designation"
                        rules={[{ required: true, message: 'Please enter or select a designation title' }]}
                        extra={
                          !selectedDept
                            ? 'Select a department first'
                            : !selectedDesignationType
                            ? 'Select a designation type first'
                            : ''
                        }
                      >
                        <AutoComplete
                          placeholder={
                            !selectedDept
                              ? 'Select department first'
                              : !selectedDesignationType
                              ? 'Select designation type first'
                              : `Type or pick a ${selectedDesignationType} title…`
                          }
                          disabled={!selectedDesignationType}
                          options={filteredDesignationOptions}
                          filterOption={(input, option) =>
                            (option?.label ?? option?.value ?? '')
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          notFoundContent="No suggestion — type to create a custom title"
                          onBlur={() => {
                            const val = form.getFieldValue('designation');
                            if (val) form.setFieldValue('designation', toTitleCase(String(val)));
                          }}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Joining Date"
                        name="joiningDate"
                        rules={[{ required: true, message: 'Please select joining date' }]}
                      >
                        <DatePicker
                          style={{ width: '100%' }}
                          suffixIcon={<Calendar size={16} style={{ color: '#94a3b8' }} />}
                          format="DD MMM YYYY"
                          placeholder="Select joining date"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Work Mode"
                        name="workMode"
                        rules={[{ required: true, message: 'Please select work mode' }]}
                      >
                        <Select placeholder="Select work mode">
                          <Option value="office">Office</Option>
                          <Option value="remote">Remote</Option>
                          <Option value="hybrid">Hybrid</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Office Location"
                        name="workLocation"
                      >
                        <Input placeholder="e.g. Noida HQ, Bangalore Office" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Country"
                        name="country"
                      >
                        <Input placeholder="e.g. India, USA" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Reporting Manager"
                        name="managerId"
                        rules={[{ required: !isExecutive, message: 'Please select a reporting manager' }]}
                        extra={isExecutive ? 'Not applicable — Executive / Director roles sit at the top of the org tree.' : undefined}
                      >
                        <Select
                          placeholder={isExecutive ? 'Not applicable for this role' : 'Select manager'}
                          disabled={isExecutive}
                          allowClear
                        >
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
                        label="User Role"
                        name="userRole"
                        rules={[{ required: true, message: 'Please select user role' }]}
                      >
                        <Select placeholder="Select role">
                          <Option value="Employee">Employee</Option>
                          <Option value="Manager">Manager</Option>
                          {(!isHR || isAdmin) && <Option value="HR">HR Executive</Option>}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Registration Status"
                        name="status"
                        rules={[{ required: true, message: 'Please select status' }]}
                      >
                        <Select placeholder="Select status">
                          <Option value="onboarding">Onboarding</Option>
                          <Option value="active">Active</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    {isAdmin && (
                      <Col xs={24} md={12}>
                        <Form.Item
                          label="Branch"
                          name="branchId"
                          rules={[{ required: false }]}
                          extra="Assign this employee to a branch"
                        >
                          <Select placeholder="Select branch (optional)" allowClear
                            options={branches.map(b => ({ value: b.id, label: b.name }))}
                          />
                        </Form.Item>
                      </Col>
                    )}
                  </Row>
                </Card>

                {/* Access Information */}
                <Card
                  styles={{ body: { padding: '24px' } }}
                  style={{ borderRadius: '12px', boxShadow: themeTokens.shadows.standard, border: '1px solid #e5e7eb' }}
                >
                  {sectionHeader('Access Information', ShieldCheck)}
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Temporary Password"
                        name="temporaryPassword"
                        extra="Employee will be prompted to change this on first login"
                        rules={[{ required: true, message: 'Please enter temporary password' }]}
                      >
                        <Input.Password prefix={<Lock size={16} style={{ color: '#94a3b8' }} />} placeholder="Setup temporary password" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              </Space>
            </Col>

            {/* Right Column */}
            <Col xs={24} lg={8}>
              <Space direction="vertical" size={24} style={{ width: '100%' }}>
                <Card
                  title={<Space><Info size={18} color={themeTokens.colors.primary} /><Text strong>Registration Guide</Text></Space>}
                  style={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: themeTokens.shadows.standard }}
                >
                  <Space direction="vertical" size={16}>
                    <div style={{ padding: '12px', background: themeTokens.colors.accent, borderRadius: '8px' }}>
                      <Text style={{ fontSize: '13px', lineHeight: '1.6' }}>
                        Creating an employee record initiates automated background processes for a seamless onboarding experience.
                      </Text>
                    </div>
                    <ul style={{ paddingLeft: '20px', margin: 0, color: themeTokens.colors.textSecondary, fontSize: '13px' }}>
                      <li style={{ marginBottom: '10px' }}><strong>Auto-ID Generation</strong>: A unique code (e.g., SCC001) will be assigned.</li>
                      <li style={{ marginBottom: '10px' }}><strong>Leave Allocation</strong>: Pro-rated balances calculated from joining date.</li>
                      <li style={{ marginBottom: '10px' }}><strong>Workflow Trigger</strong>: Standard onboarding tasks assigned automatically.</li>
                      <li><strong>Instant Access</strong>: Workspace access enabled with the temporary password.</li>
                    </ul>
                  </Space>
                </Card>

                {/* Org level indicator — shows when a type is picked */}
                {selectedDesignationType && (
                  <Card
                    styles={{ body: { padding: '16px' } }}
                    style={{ borderRadius: '12px', border: '1px solid #e5e7eb', background: '#fafafa' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <Layers size={14} color={themeTokens.colors.primary} />
                      <Text strong style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Org Level
                      </Text>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {DESIGNATION_TYPES.map((t, i) => {
                        const isActive = t.value === selectedDesignationType;
                        return (
                          <div
                            key={t.value}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '5px 8px',
                              borderRadius: 7,
                              background: isActive ? themeTokens.colors.accent : 'transparent',
                              transition: 'background 0.15s',
                            }}
                          >
                            <div style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: isActive ? themeTokens.colors.primary : '#e2e8f0',
                              color: isActive ? '#fff' : '#94a3b8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}>
                              {i + 1}
                            </div>
                            <div style={{
                              fontSize: 12,
                              fontWeight: isActive ? 700 : 500,
                              color: isActive ? themeTokens.colors.primary : '#374151',
                            }}>
                              {t.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                <Card
                  styles={{ body: { padding: '24px' } }}
                  style={{ borderRadius: '12px', background: '#fafafa', border: '1px solid #e5e7eb' }}
                >
                  <Space direction="vertical" size={20} style={{ width: '100%' }}>
                    <Title level={5} style={{ margin: 0 }}>Ready to onboard?</Title>
                    <Text type="secondary" style={{ fontSize: '13px' }}>
                      Please review all information before submitting. The onboarding invite will be sent to the employee's personal email.
                    </Text>
                    <div style={{ marginTop: '8px' }}>
                      <Button
                        type="primary"
                        size="large"
                        block
                        loading={loading}
                        onClick={() => form.submit()}
                        style={{ height: '48px', fontWeight: 600 }}
                      >
                        Continue Onboarding
                      </Button>
                      <Button
                        type="text"
                        block
                        onClick={() => navigate('/employees')}
                        style={{ marginTop: '8px' }}
                      >
                        Discard Changes
                      </Button>
                    </div>
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
