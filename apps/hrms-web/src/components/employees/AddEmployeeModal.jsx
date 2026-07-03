import { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  AutoComplete,
  DatePicker,
  message,
} from 'antd';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  ShieldCheck,
  Lock,
  Info,
  Building2,
  CheckCircle2,
  X,
  Globe,
} from 'lucide-react';
import dayjs from 'dayjs';
import { employeeAPI } from '../../api/employees';
import { adminAPI } from '../../api/admin';
import { useAuth } from '../../hooks/useAuth';
import { themeTokens } from '../../styles/theme';
import { toTitleCase } from '../../utils/name';
import { broadcastDataRefresh } from '../../utils/realtime';
import PhoneInput, { getPhoneValidator } from '../common/PhoneInput';

const { Option } = Select;

const BTN_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';

const FIXED_DEPARTMENTS = [
  'Administration', 'Business Development', 'Customer Support', 'Data & Analytics',
  'Design', 'DevOps / Infrastructure', 'Engineering', 'Finance', 'Human Resources',
  'IT', 'Legal & Compliance', 'Marketing', 'Operations', 'Product Management',
  'Quality Assurance', 'Sales', 'Security',
];

const DESIGNATION_TYPES = [
  { value: 'Executive',             label: 'Executive',             description: 'C-Suite — CEO, CTO, COO, CFO…' },
  { value: 'Director / VP',         label: 'Director / VP',         description: 'VP & Director-level leadership' },
  { value: 'Manager / Lead',        label: 'Manager / Lead',        description: 'Team & engineering managers' },
  { value: 'Senior',                label: 'Senior',                description: 'Senior individual contributors' },
  { value: 'Engineer / Specialist', label: 'Engineer / Specialist', description: 'Mid-level ICs & specialists' },
  { value: 'Junior / Trainee',      label: 'Junior / Trainee',      description: 'Junior roles, interns & trainees' },
];

const DESIGNATION_OPTIONS = [
  { label: 'Executive', options: [
    { value: 'CEO' }, { value: 'CTO' }, { value: 'COO' }, { value: 'CFO' }, { value: 'CHRO' },
  ]},
  { label: 'Director / VP', options: [
    { value: 'VP of Engineering' }, { value: 'VP of Product' }, { value: 'VP of Sales' },
    { value: 'Director of Engineering' }, { value: 'Director of HR' },
    { value: 'Director of Operations' }, { value: 'Director of Finance' }, { value: 'Director of Marketing' },
  ]},
  { label: 'Manager / Lead', options: [
    { value: 'Engineering Manager' }, { value: 'Tech Lead' }, { value: 'Team Lead' },
    { value: 'Project Manager' }, { value: 'Product Manager' }, { value: 'HR Manager' },
    { value: 'Operations Manager' }, { value: 'Finance Manager' },
    { value: 'Marketing Manager' }, { value: 'Sales Manager' },
  ]},
  { label: 'Senior', options: [
    { value: 'Senior Software Engineer' }, { value: 'Senior Frontend Engineer' },
    { value: 'Senior Backend Engineer' }, { value: 'Senior Full Stack Engineer' },
    { value: 'Senior QA Engineer' }, { value: 'Senior DevOps Engineer' },
    { value: 'Senior Data Scientist' }, { value: 'Senior UI/UX Designer' },
    { value: 'Senior Business Analyst' }, { value: 'Senior HR Executive' },
  ]},
  { label: 'Engineer / Specialist', options: [
    { value: 'Software Engineer' }, { value: 'Frontend Engineer' }, { value: 'Backend Engineer' },
    { value: 'Full Stack Engineer' }, { value: 'Mobile Developer' }, { value: 'QA Engineer' },
    { value: 'DevOps Engineer' }, { value: 'Data Scientist' }, { value: 'Data Analyst' },
    { value: 'UI/UX Designer' }, { value: 'Business Analyst' }, { value: 'HR Executive' },
    { value: 'IT Support Engineer' }, { value: 'System Administrator' }, { value: 'Accountant' },
  ]},
  { label: 'Junior / Trainee', options: [
    { value: 'Junior Software Engineer' }, { value: 'Junior Frontend Engineer' },
    { value: 'Junior Backend Engineer' }, { value: 'Junior QA Engineer' },
    { value: 'Junior Data Analyst' }, { value: 'Junior HR Executive' },
    { value: 'Trainee Engineer' }, { value: 'Intern' },
  ]},
];

const COUNTRIES = [
  { value: 'India', flag: '🇮🇳' },
  { value: 'United States', flag: '🇺🇸' },
  { value: 'United Kingdom', flag: '🇬🇧' },
  { value: 'United Arab Emirates', flag: '🇦🇪' },
  { value: 'Canada', flag: '🇨🇦' },
  { value: 'Australia', flag: '🇦🇺' },
  { value: 'Singapore', flag: '🇸🇬' },
  { value: 'Germany', flag: '🇩🇪' },
  { value: 'France', flag: '🇫🇷' },
  { value: 'Netherlands', flag: '🇳🇱' },
  { value: 'Saudi Arabia', flag: '🇸🇦' },
  { value: 'Qatar', flag: '🇶🇦' },
  { value: 'Bahrain', flag: '🇧🇭' },
  { value: 'Kuwait', flag: '🇰🇼' },
  { value: 'Oman', flag: '🇴🇲' },
  { value: 'Pakistan', flag: '🇵🇰' },
  { value: 'Bangladesh', flag: '🇧🇩' },
  { value: 'Sri Lanka', flag: '🇱🇰' },
  { value: 'Nepal', flag: '🇳🇵' },
  { value: 'Philippines', flag: '🇵🇭' },
  { value: 'Malaysia', flag: '🇲🇾' },
  { value: 'Indonesia', flag: '🇮🇩' },
  { value: 'South Africa', flag: '🇿🇦' },
  { value: 'Kenya', flag: '🇰🇪' },
  { value: 'Nigeria', flag: '🇳🇬' },
  { value: 'Ireland', flag: '🇮🇪' },
  { value: 'New Zealand', flag: '🇳🇿' },
  { value: 'Sweden', flag: '🇸🇪' },
  { value: 'Denmark', flag: '🇩🇰' },
  { value: 'Norway', flag: '🇳🇴' },
];

const STEPS = [
  { number: 1, label: 'Personal Info',   icon: User },
  { number: 2, label: 'Employment',      icon: Briefcase },
  { number: 3, label: 'Access & Review', icon: CheckCircle2 },
];

// Custom label element for Form.Item
function FLabel({ icon: Icon, text, required }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {Icon && <Icon size={12} color={themeTokens.colors.textTertiary} strokeWidth={2} />}
      <span style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: themeTokens.colors.textTertiary,
      }}>
        {text}
      </span>
      {required && <span style={{ color: '#E11D48', marginLeft: 1 }}>*</span>}
    </span>
  );
}

// Step indicator
function StepIndicator({ current, isMobile }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: isMobile ? '16px 16px 14px' : '24px 32px 20px',
      borderBottom: `1px solid ${themeTokens.colors.borders}`,
    }}>
      {STEPS.map((step, idx) => {
        const done   = current > step.number;
        const active = current === step.number;
        const Icon   = step.icon;
        const circleSize = isMobile ? 32 : 44;
        const iconSize = isMobile ? 14 : 18;

        return (
          <div key={step.number} style={{ display: 'flex', alignItems: 'center', flex: idx < STEPS.length - 1 ? 1 : 'none' }}>
            {/* Icon + label inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, flexShrink: 0 }}>
              <div style={{
                width: circleSize, height: circleSize, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? '#DCFCE7' : active ? BTN_GRADIENT : '#F3F4F6',
                border: done ? '2px solid #10B981' : active ? 'none' : `2px solid ${themeTokens.colors.borders}`,
                transition: 'all 0.2s',
                flexShrink: 0,
              }}>
                {done
                  ? <CheckCircle2 size={isMobile ? 14 : 20} color="#10B981" strokeWidth={2.5} />
                  : <Icon size={iconSize} color={active ? '#fff' : themeTokens.colors.textTertiary} strokeWidth={2} />
                }
              </div>
              {!isMobile && (
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: done ? '#10B981' : active ? '#1368FF' : themeTokens.colors.textTertiary,
                    lineHeight: 1.2, marginBottom: 2,
                  }}>
                    STEP {step.number}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: active ? 700 : 500,
                    color: done ? '#10B981' : active ? themeTokens.colors.textPrimary : themeTokens.colors.textTertiary,
                    lineHeight: 1.2,
                  }}>
                    {step.label}
                  </div>
                </div>
              )}
              {isMobile && active && (
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: themeTokens.colors.textPrimary,
                  lineHeight: 1.2,
                  maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {step.label}
                </div>
              )}
            </div>
            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: isMobile ? '0 6px' : '0 12px',
                background: done ? '#10B981' : themeTokens.colors.borders,
                transition: 'background 0.3s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Section heading inside form body
function SectionHeading({ icon: Icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, background: '#EFF6FF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={17} color="#1368FF" strokeWidth={2} />
      </div>
      <span style={{ fontSize: 15, fontWeight: 700, color: themeTokens.colors.textPrimary }}>
        {label}
      </span>
    </div>
  );
}

// Two-column grid helper
function Grid2({ children, single, isMobile }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: (single || isMobile) ? '1fr' : '1fr 1fr',
      gap: '0 16px',
    }}>
      {children}
    </div>
  );
}

export default function AddEmployeeModal({ open, onClose, onSuccess }) {
  const { isHR, isAdmin } = useAuth();
  const [form] = Form.useForm();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const selectedDept            = Form.useWatch('department', form);
  const selectedDesignationType = Form.useWatch('designationType', form);
  const isExecutive             = ['Executive', 'Director / VP'].includes(selectedDesignationType);

  const filteredDesignationOptions = selectedDesignationType
    ? (DESIGNATION_OPTIONS.find(g => g.label === selectedDesignationType)?.options || [])
    : [];

  useEffect(() => {
    if (open) {
      employeeAPI.getActiveManagers().then(r => setManagers(r.data)).catch(() => {});
      if (isAdmin) {
        adminAPI.getBranches().then(r => {
          const list = Array.isArray(r?.data) ? r.data : [];
          setBranches(list);
          // Auto-select if only one branch exists
          if (list.length === 1) form.setFieldValue('branchId', list[0].id);
        }).catch(() => {});
      }
    }
  }, [open, isAdmin]);

  const handleClose = () => {
    form.resetFields();
    setStep(1);
    onClose();
  };

  const STEP1_FIELDS = ['name', 'email', 'phone', 'country'];
  const STEP2_FIELDS = [
    'department', 'designationType', 'designation', 'joiningDate', 'workMode',
    'userRole',
    ...(isExecutive ? [] : ['managerId']),
    ...(isAdmin ? ['branchId'] : []),
  ];

  const handleNext = async () => {
    try {
      await form.validateFields(step === 1 ? STEP1_FIELDS : STEP2_FIELDS);
      setStep(s => s + 1);
    } catch (_) {}
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await form.validateFields(['temporaryPassword']);
      const values = form.getFieldsValue(true);
      const payload = {
        ...values,
        status: 'onboarding',
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null,
        joiningDate: values.joiningDate ? values.joiningDate.format('YYYY-MM-DD') : null,
        name: toTitleCase(values.name),
        managerId: values.managerId === 'none' ? null : (values.managerId || null),
        designationType: undefined,
        branchId: isAdmin ? (values.branchId || null) : undefined,
      };

      const response = await employeeAPI.create(payload);
      message.success(`Account created! Employee Code: ${response.data?.employeeCode || response.data?.employee_id || '—'}`);
      broadcastDataRefresh('employees');
      handleClose();
      onSuccess?.();
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.message || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const formItemStyle = { marginBottom: 20 };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,17,91,0.50)',
        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
        padding: isMobile ? 0 : 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        background: '#fff',
        borderRadius: isMobile ? '20px 20px 0 0' : 20,
        width: '100%', maxWidth: isMobile ? '100%' : 760,
        maxHeight: isMobile ? '95vh' : '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,17,91,0.18)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: isMobile ? '20px 16px 0' : '24px 32px 0',
        }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#00115B', marginBottom: 4 }}>
              Add New Employee
            </div>
            <div style={{ fontSize: 13, color: themeTokens.colors.textTertiary }}>
              Onboard a new member to the organization by providing their basic details
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: `1px solid ${themeTokens.colors.borders}`,
              background: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <X size={16} color={themeTokens.colors.textTertiary} strokeWidth={2} />
          </button>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} isMobile={isMobile} />

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 16px' : '28px 32px' }}>
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={{
              workLocation: 'Office',
              userRole: 'Employee',
              status: 'onboarding',
              temporaryPassword: 'Welcome@123',
            }}
          >

            {/* ══ STEP 1 — Personal Info ══ */}
            {step === 1 && (
              <>
                <SectionHeading icon={User} label="Personal Information" />

                <Form.Item
                  name="name"
                  label={<FLabel icon={User} text="Full Name" required />}
                  rules={[{ required: true, message: 'Please enter full name' }]}
                  style={formItemStyle}
                >
                  <Input placeholder="Enter full name" size="large" style={{ borderRadius: 10 }} />
                </Form.Item>

                <Grid2 isMobile={isMobile}>
                  <Form.Item
                    name="email"
                    label={<FLabel icon={Mail} text="Personal Email" required />}
                    rules={[
                      { required: true, message: 'Please enter email' },
                      { type: 'email', message: 'Invalid email' },
                    ]}
                    style={formItemStyle}
                    extra={<span style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>Work email will be auto-generated</span>}
                  >
                    <Input placeholder="employee@gmail.com" size="large" style={{ borderRadius: 10 }} />
                  </Form.Item>

                  <Form.Item
                    name="phone"
                    label={<FLabel icon={Phone} text="Phone Number" required />}
                    rules={[
                      { required: true, message: 'Please enter phone number' },
                      { validator: getPhoneValidator(true) },
                    ]}
                    style={formItemStyle}
                  >
                    <PhoneInput />
                  </Form.Item>
                </Grid2>

                <Grid2 isMobile={isMobile}>
                  <Form.Item
                    name="dateOfBirth"
                    label={<FLabel icon={Calendar} text="Date of Birth (Optional)" />}
                    rules={[{
                      validator: (_, v) => {
                        if (!v) return Promise.resolve();
                        if (dayjs().diff(v, 'years') < 18)
                          return Promise.reject(new Error('Must be at least 18 years old'));
                        return Promise.resolve();
                      },
                    }]}
                    style={formItemStyle}
                  >
                    <DatePicker
                      style={{ width: '100%', borderRadius: 10 }}
                      size="large"
                      format="DD MMM YYYY"
                      placeholder="Select date of birth"
                      disabledDate={c => c && c > dayjs().subtract(18, 'years')}
                    />
                  </Form.Item>

                  <Form.Item
                    name="country"
                    label={<FLabel icon={Globe} text="Country" required />}
                    rules={[{ required: true, message: 'Please select country' }]}
                    style={formItemStyle}
                  >
                    <Select
                      showSearch
                      size="large"
                      placeholder="Select country"
                      style={{ width: '100%' }}
                      optionFilterProp="label"
                      options={COUNTRIES.map(c => ({
                        value: c.value,
                        label: c.value,
                        emoji: c.flag,
                      }))}
                      optionRender={opt => (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{opt.data.emoji}</span>
                          {opt.data.label}
                        </span>
                      )}
                      labelRender={opt => (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>
                            {COUNTRIES.find(c => c.value === opt.value)?.flag}
                          </span>
                          {opt.label}
                        </span>
                      )}
                    />
                  </Form.Item>
                </Grid2>

                {/* Info box */}
                <div style={{
                  background: '#EFF6FF', border: '1px solid #BFDBFE',
                  borderRadius: 10, padding: '14px 16px',
                  display: 'flex', gap: 10, marginTop: 4,
                }}>
                  <Info size={16} color="#1368FF" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#00115B', marginBottom: 4 }}>
                      Auto-Generated Features
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: themeTokens.colors.textSecondary, lineHeight: 1.8 }}>
                      <li>Employee ID will be automatically assigned</li>
                      <li>Work email will be created based on name</li>
                      <li>Leave balance calculated from joining date</li>
                    </ul>
                  </div>
                </div>
              </>
            )}

            {/* ══ STEP 2 — Employment ══ */}
            {step === 2 && (
              <>
                <SectionHeading icon={Briefcase} label="Employment Information" />

                <Grid2 isMobile={isMobile}>
                  <Form.Item
                    name="department"
                    label={<FLabel icon={Building2} text="Department" required />}
                    rules={[{ required: true, message: 'Please select department' }]}
                    style={formItemStyle}
                  >
                    <Select
                      showSearch size="large" placeholder="Select department"
                      optionFilterProp="label" style={{ width: '100%' }}
                      onChange={() => form.resetFields(['designationType', 'designation'])}
                    >
                      {FIXED_DEPARTMENTS.map(d => <Option key={d} value={d}>{d}</Option>)}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="designationType"
                    label={<FLabel text="Designation Type" required />}
                    rules={[{ required: true, message: 'Please select designation type' }]}
                    style={formItemStyle}
                  >
                    <Select
                      size="large"
                      placeholder={selectedDept ? 'Select level' : 'Select department first'}
                      disabled={!selectedDept}
                      style={{ width: '100%' }}
                      onChange={v => {
                        form.resetFields(['designation']);
                        if (['Executive', 'Director / VP'].includes(v)) form.setFieldValue('managerId', undefined);
                      }}
                    >
                      {DESIGNATION_TYPES.map(t => (
                        <Option key={t.value} value={t.value}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{t.description}</div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Grid2>

                <Form.Item
                  name="designation"
                  label={<FLabel text="Designation Title" required />}
                  rules={[{ required: true, message: 'Please enter designation title' }]}
                  style={formItemStyle}
                >
                  <AutoComplete
                    placeholder={!selectedDesignationType ? 'Select designation type first' : `Type or pick a ${selectedDesignationType} title…`}
                    disabled={!selectedDesignationType}
                    options={filteredDesignationOptions}
                    filterOption={(input, option) =>
                      (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    size="large"
                    style={{ width: '100%' }}
                    onBlur={() => {
                      const v = form.getFieldValue('designation');
                      if (v) form.setFieldValue('designation', toTitleCase(String(v)));
                    }}
                  />
                </Form.Item>

                <Grid2 isMobile={isMobile}>
                  <Form.Item
                    name="joiningDate"
                    label={<FLabel icon={Calendar} text="Joining Date" required />}
                    rules={[{ required: true, message: 'Please select joining date' }]}
                    style={formItemStyle}
                  >
                    <DatePicker style={{ width: '100%', borderRadius: 10 }} size="large" format="DD MMM YYYY" placeholder="Select joining date" />
                  </Form.Item>

                  <Form.Item
                    name="workMode"
                    label={<FLabel text="Work Mode" required />}
                    rules={[{ required: true, message: 'Please select work mode' }]}
                    style={formItemStyle}
                  >
                    <Select size="large" style={{ width: '100%' }}>
                      <Option value="office">Office</Option>
                      <Option value="remote">Remote</Option>
                      <Option value="hybrid">Hybrid</Option>
                    </Select>
                  </Form.Item>
                </Grid2>

                <Grid2 isMobile={isMobile}>
                  <Form.Item
                    name="managerId"
                    label={<FLabel text={isExecutive ? 'Reporting Manager (N/A)' : 'Reporting Manager'} required={!isExecutive} />}
                    rules={[{ required: !isExecutive, message: 'Please select a reporting manager' }]}
                    style={formItemStyle}
                  >
                    <Select
                      size="large" style={{ width: '100%' }}
                      placeholder={isExecutive ? 'Not applicable for this role' : 'Select manager'}
                      disabled={isExecutive} allowClear
                    >
                      <Option value="none">No Manager (Top Level)</Option>
                      {managers.map(m => (
                        <Option key={m.id} value={m.id}>{m.name} ({m.employeeCode})</Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="userRole"
                    label={<FLabel text="User Role" required />}
                    rules={[{ required: true, message: 'Please select user role' }]}
                    style={formItemStyle}
                  >
                    <Select size="large" style={{ width: '100%' }}>
                      <Option value="Employee">Employee</Option>
                      <Option value="Manager">Manager</Option>
                      {(!isHR || isAdmin) && <Option value="HR">HR Executive</Option>}
                    </Select>
                  </Form.Item>
                </Grid2>

                {/* Fixed onboarding status indicator */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: themeTokens.colors.textSecondary, marginBottom: 8 }}>
                    Registration Status
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                    <CheckCircle2 size={16} color="#EA580C" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#EA580C' }}>Onboarding</span>
                    <span style={{ fontSize: 12, color: '#92400E', marginLeft: 4 }}>— Employee will go through the onboarding journey before activation</span>
                  </div>
                </div>

                {isAdmin && (
                  <Form.Item
                    name="branchId"
                    label={<FLabel icon={Building2} text="Branch" required={branches.length > 1} />}
                    rules={branches.length > 1 ? [{ required: true, message: 'Please select a branch' }] : []}
                    style={formItemStyle}
                  >
                    <Select size="large" style={{ width: '100%' }} placeholder="Select branch" allowClear={branches.length <= 1}
                      options={branches.map(b => ({ value: b.id, label: b.name }))}
                    />
                  </Form.Item>
                )}
              </>
            )}

            {/* ══ STEP 3 — Access & Review ══ */}
            {step === 3 && (() => {
              const v = form.getFieldsValue(true);
              return (
                <>
                  <SectionHeading icon={ShieldCheck} label="Access & Review" />

                  <Form.Item
                    name="temporaryPassword"
                    label={<FLabel icon={Lock} text="Temporary Password" required />}
                    rules={[{ required: true, message: 'Please enter temporary password' }]}
                    style={formItemStyle}
                    extra={<span style={{ fontSize: 11, color: themeTokens.colors.textTertiary }}>Employee will be prompted to change this on first login</span>}
                  >
                    <Input.Password
                      placeholder="Setup temporary password"
                      size="large"
                      style={{ borderRadius: 10 }}
                    />
                  </Form.Item>

                  {/* Review summary */}
                  <div style={{
                    background: themeTokens.colors.appBackground,
                    border: `1px solid ${themeTokens.colors.borders}`,
                    borderRadius: 12, padding: '20px',
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px',
                    marginBottom: 20,
                  }}>
                    {[
                      { label: 'Full Name',    value: v.name ? toTitleCase(v.name) : '—' },
                      { label: 'Country',      value: v.country || '—' },
                      { label: 'Email',        value: v.email || '—' },
                      { label: 'Department',   value: v.department || '—' },
                      { label: 'Designation',  value: v.designation || '—' },
                      { label: 'Joining Date', value: v.joiningDate ? v.joiningDate.format('DD MMM YYYY') : '—' },
                      { label: 'Work Mode',    value: v.workMode ? toTitleCase(v.workMode) : '—' },
                      { label: 'User Role',    value: v.userRole || '—' },
                      { label: 'Status',       value: 'Onboarding' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div style={{
                          fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                          letterSpacing: '0.06em', color: themeTokens.colors.textTertiary, marginBottom: 2,
                        }}>
                          {label}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: themeTokens.colors.textPrimary }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Info box */}
                  <div style={{
                    background: '#EFF6FF', border: '1px solid #BFDBFE',
                    borderRadius: 10, padding: '14px 16px',
                    display: 'flex', gap: 10,
                  }}>
                    <Info size={16} color="#1368FF" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 12, color: themeTokens.colors.textSecondary, lineHeight: 1.7 }}>
                      An Employee ID will be auto-assigned, work email created, leave balance calculated,
                      and onboarding tasks triggered automatically upon submission.
                    </div>
                  </div>
                </>
              );
            })()}
          </Form>
        </div>

        {/* Footer */}
        <div style={{
          padding: isMobile ? '12px 16px' : '16px 32px',
          borderTop: `1px solid ${themeTokens.colors.borders}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#fff',
        }}>
          <button
            onClick={step === 1 ? handleClose : () => setStep(s => s - 1)}
            style={{
              height: 42, paddingInline: 24, borderRadius: 10,
              border: `1px solid ${themeTokens.colors.borders}`,
              background: '#fff', color: themeTokens.colors.textSecondary,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <button
            onClick={step < 3 ? handleNext : handleSubmit}
            disabled={loading}
            style={{
              height: 42, paddingInline: 32, borderRadius: 10,
              background: loading ? '#93c5fd' : BTN_GRADIENT,
              color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(19,104,255,0.30)',
            }}
          >
            {loading ? 'Creating…' : step < 3 ? 'Continue' : 'Create Employee'}
          </button>
        </div>
      </div>
    </div>
  );
}
