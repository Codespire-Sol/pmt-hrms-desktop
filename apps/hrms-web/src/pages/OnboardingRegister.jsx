import { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import {
  Steps, Form, Input, Select, DatePicker, Button, Typography,
  Card, Space, Alert, Spin, Tag, Divider, message, Row, Col, Result,
} from 'antd';
import {
  CheckCircleOutlined, UserOutlined, FileTextOutlined, BankOutlined,
  MailOutlined, SafetyOutlined, TrophyOutlined,
  CalendarOutlined, ClockCircleOutlined, SendOutlined,
  UploadOutlined, ReloadOutlined, WarningOutlined,
} from '@ant-design/icons';
import { hrAPI } from '../api/hr';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const DOCUMENT_TYPES = [
  {
    value: 'aadhar_card',
    label: 'Aadhar Card',
    mandatory: true,
    hint: 'Front & back of your Aadhaar card — PDF only',
  },
  {
    value: 'pan_card',
    label: 'PAN Card',
    mandatory: true,
    hint: 'Clear scan of your PAN card — PDF only',
  },
  {
    value: 'class_10_marksheet',
    label: '10th Marksheet',
    mandatory: true,
    hint: 'Secondary school (Class X) certificate or marksheet',
  },
  {
    value: 'class_12_marksheet',
    label: '12th Marksheet',
    mandatory: true,
    hint: 'Higher secondary (Class XII) certificate or marksheet',
  },
  {
    value: 'graduation_certificate',
    label: 'Graduation Degree / Semester Result',
    mandatory: false,
    hint: 'Degree certificate, provisional certificate, or all-semester results if not yet graduated',
  },
  {
    value: 'other',
    label: 'Other Document',
    mandatory: false,
    hint: 'Any other supporting document',
  },
];

// Document types that MUST be uploaded before the employee can proceed
const MANDATORY_DOC_TYPES = DOCUMENT_TYPES.filter(d => d.mandatory).map(d => d.value);

function getDaysUntilJoining(joiningDate) {
  if (!joiningDate) return null;
  const joining = new Date(joiningDate);
  const today = new Date();
  joining.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((joining - today) / (1000 * 60 * 60 * 24));
}

// ── Joining date + countdown badge ─────────────────────────────────────────────
function JoiningDateBadge({ joiningDate }) {
  const days = getDaysUntilJoining(joiningDate);
  if (!joiningDate) return null;

  const formatted = new Date(joiningDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  let countdownTag = null;
  if (days === 0) {
    countdownTag = <Tag color="red" style={tagStyle}>🎉 Today is your joining day!</Tag>;
  } else if (days > 0) {
    countdownTag = (
      <Tag color="green" icon={<ClockCircleOutlined />} style={tagStyle}>
        {days} day{days !== 1 ? 's' : ''} to go
      </Tag>
    );
  } else {
    countdownTag = <Tag color="purple" style={tagStyle}>Welcome aboard!</Tag>;
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      <Tag color="blue" icon={<CalendarOutlined />} style={tagStyle}>
        Joining: {formatted}
      </Tag>
      {countdownTag}
    </div>
  );
}

// ── Document upload — one row per document type ────────────────────────────────
function DocumentUploadSection({ onUpload, uploading, uploadedDocs }) {
  const [uploadingType, setUploadingType] = useState(null);
  const fileInputRefs = useRef({});

  // Latest upload per document type
  const uploadedByType = {};
  uploadedDocs.forEach(doc => { uploadedByType[doc.type] = doc; });

  const handleFileSelect = async (e, docType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingType(docType);
    try {
      await onUpload(file, docType);
    } finally {
      setUploadingType(null);
      e.target.value = '';
    }
  };

  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {DOCUMENT_TYPES.map(doc => {
        const uploaded = uploadedByType[doc.value];
        const isUploadingThis = uploadingType === doc.value;

        return (
          <div
            key={doc.value}
            className="onboarding-doc-row"
            style={{
              border: uploaded
                ? '1.5px solid #b7eb8f'
                : doc.mandatory
                ? '1.5px solid #ffd8bf'
                : '1.5px solid #e2e8f0',
              background: uploaded ? '#f6ffed' : '#fff',
            }}
          >
            {/* Status icon */}
            <div style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: uploaded ? '#52c41a' : doc.mandatory ? '#fff7e6' : '#f1f5f9',
            }}>
              {uploaded
                ? <CheckCircleOutlined style={{ color: '#fff', fontSize: 16 }} />
                : <FileTextOutlined style={{ color: doc.mandatory ? '#fa8c16' : '#94a3b8', fontSize: 15 }} />
              }
            </div>

            {/* Label + hint */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                <Text strong style={{ fontSize: 13 }}>{doc.label}</Text>
                <Tag
                  color={doc.mandatory ? 'orange' : 'default'}
                  style={{ fontSize: 10, margin: 0, lineHeight: '18px', padding: '0 6px' }}
                >
                  {doc.mandatory ? 'Required' : 'Optional'}
                </Tag>
              </div>
              {uploaded
                ? <Text style={{ fontSize: 11, color: '#52c41a' }}>✓ {uploaded.fileName}</Text>
                : <Text type="secondary" style={{ fontSize: 11 }}>{doc.hint}</Text>
              }
            </div>

            {/* Hidden file input + Upload / Replace button */}
            <input
              ref={el => { fileInputRefs.current[doc.value] = el; }}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={e => handleFileSelect(e, doc.value)}
            />
            <Button
              size="small"
              type={uploaded ? 'default' : doc.mandatory ? 'primary' : 'dashed'}
              icon={isUploadingThis ? null : uploaded ? <ReloadOutlined /> : <UploadOutlined />}
              loading={isUploadingThis}
              disabled={uploading && !isUploadingThis}
              onClick={() => fileInputRefs.current[doc.value]?.click()}
              style={{ minWidth: 86, flexShrink: 0 }}
            >
              {isUploadingThis ? 'Uploading…' : uploaded ? 'Replace' : 'Upload'}
            </Button>
          </div>
        );
      })}
    </Space>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OnboardingRegister() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Token validation
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState(null);
  const [employeeInfo, setEmployeeInfo] = useState(null);

  // OTP
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Onboarding form (only unlocked after OTP)
  const [sessionToken, setSessionToken] = useState(null);
  const [step, setStep] = useState(0); // 0–3
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);

  const [personalForm] = Form.useForm();

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setTokenError('No registration token found. Please use the link from your invitation email.');
      setTokenLoading(false);
      return;
    }
    validateToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  // When OTP is verified and session token is set, load existing docs from backend
  useEffect(() => {
    if (!sessionToken || !token) return;
    loadExistingDocs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const validateToken = async () => {
    setTokenLoading(true);
    try {
      const res = await hrAPI.validateInviteToken(token);
      const info = res?.data?.data || res?.data;
      setEmployeeInfo(info);
      // If already submitted, jump straight to the offer letter status screen
      if (info?.tokenStatus === 'pending_offer_letter' || info?.tokenStatus === 'offer_letter_sent') {
        setStep(2);
      }
    } catch (err) {
      setTokenError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Invalid or expired registration link.');
    } finally {
      setTokenLoading(false);
    }
  };

  const loadExistingDocs = async () => {
    try {
      const res = await hrAPI.getOnboardingDocuments(token, sessionToken);
      const docs = res?.data?.data || [];
      if (docs.length > 0) {
        const mapped = docs.map(d => ({
          type: d.documentType,
          label: DOCUMENT_TYPES.find(dt => dt.value === d.documentType)?.label || d.documentType,
          fileName: d.documentName,
          fileUrl: d.fileUrl,
        }));
        setUploadedDocs(mapped);
      }
    } catch {
      // silently ignore — not critical
    }
  };

  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      await hrAPI.sendOnboardingOtp(token);
      setOtpSent(true);
      setResendCooldown(60);
      message.success('OTP sent to your registered email!');
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length < 6) {
      message.warning('Please enter the 6-digit OTP');
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await hrAPI.verifyOnboardingOtp(token, otpValue);
      const data = res?.data?.data || res?.data;
      setSessionToken(data.sessionToken);
      // Pre-fill personal email and phone from HR-entered data (read-only)
      personalForm.setFieldsValue({
        personalEmail: employeeInfo?.email || '',
        phone: employeeInfo?.phone || '',
      });
      message.success('Email verified! You can now complete your registration.');
    } catch (err) {
      message.error(err?.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handlePersonalSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = { ...values, dateOfBirth: values.dateOfBirth?.format('YYYY-MM-DD') };
      await hrAPI.submitSelfRegistration(token, payload, sessionToken);
      message.success('Personal details saved!');
      setStep(1);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to save details. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDocumentUpload = async (file, documentType) => {
    if (!documentType) {
      message.warning('Please select a document type before uploading.');
      return false;
    }
    setUploading(true);
    try {
      const res = await hrAPI.uploadOnboardingDocument(token, file, documentType, sessionToken);
      const data = res?.data?.data || res?.data;
      setUploadedDocs(prev => {
        // Replace if same type already exists
        const filtered = prev.filter(d => d.type !== documentType);
        return [...filtered, {
          type: documentType,
          label: DOCUMENT_TYPES.find(d => d.value === documentType)?.label || documentType,
          fileName: data?.fileName || file.name,
          fileUrl: data?.fileUrl,
        }];
      });
      message.success(`${file.name} uploaded successfully`);
    } catch (err) {
      message.error(err?.response?.data?.message || `Failed to upload ${file.name}`);
    } finally {
      setUploading(false);
    }
    return false;
  };

  // Navigate back to personal details from documents
  const handleBackToPersonal = () => {
    setStep(0);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (tokenLoading) {
    return (
      <div style={pageStyle}>
        <Spin size="large" tip="Verifying your registration link..." />
      </div>
    );
  }

  // ── Token error ────────────────────────────────────────────────────────────
  if (tokenError) {
    return (
      <div className="onboarding-page" style={pageStyle}>
        <Card className="onboarding-card" style={{ ...cardStyle, maxWidth: 520 }}>
          <Result
            status="error"
            title="Registration Link Invalid"
            subTitle={tokenError}
            extra={<Paragraph type="secondary">Please contact your HR team to get a new registration link.</Paragraph>}
          />
        </Card>
      </div>
    );
  }

  // ── Already submitted — show offer letter status directly, no OTP needed ──
  if (!sessionToken && (employeeInfo?.tokenStatus === 'pending_offer_letter' || employeeInfo?.tokenStatus === 'offer_letter_sent')) {
    return (
      <div className="onboarding-page" style={pageStyle}>
        <Card className="onboarding-card" style={{ ...cardStyle, maxWidth: 560 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={logoBox}>👋</div>
            <Title level={3} style={{ margin: '14px 0 4px' }}>Welcome to Codespire!</Title>
            <Text type="secondary">
              Hi <strong>{employeeInfo?.name}</strong> · {employeeInfo?.designation} · {employeeInfo?.department}
            </Text>
          </div>
          <JoiningDateBadge joiningDate={employeeInfo?.joiningDate} />
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            {employeeInfo?.tokenStatus === 'offer_letter_sent' ? (
              <>
                <div style={{ ...logoBox, background: 'linear-gradient(135deg, #52c41a, #389e0d)', margin: '0 auto 20px' }}>
                  <CheckCircleOutlined style={{ fontSize: 28, color: '#fff' }} />
                </div>
                <Title level={4} style={{ margin: '0 0 8px' }}>Offer Letter Released!</Title>
                <Paragraph type="secondary" style={{ maxWidth: 420, margin: '0 auto 20px' }}>
                  Your offer letter has been officially released by our HR team.
                  Please check your registered email inbox for the details.
                </Paragraph>
                <Alert
                  type="success"
                  showIcon
                  message="Kindly check your email"
                  description="Your offer letter notification has been sent to your registered company email. Contact HR if you haven't received it."
                  style={{ textAlign: 'left' }}
                />
              </>
            ) : (
              <>
                <div style={{ ...logoBox, background: 'linear-gradient(135deg, #faad14, #d48806)', margin: '0 auto 20px' }}>
                  <ClockCircleOutlined style={{ fontSize: 28, color: '#fff' }} />
                </div>
                <Title level={4} style={{ margin: '0 0 8px' }}>Offer Letter Pending</Title>
                <Paragraph type="secondary" style={{ maxWidth: 420, margin: '0 auto 20px' }}>
                  Your personal details and documents have been submitted successfully.
                  Our HR team will review your information and release your official offer letter shortly.
                </Paragraph>
                <Alert
                  type="warning"
                  showIcon
                  message="No further action needed from your side"
                  description="HR is preparing your offer letter. This typically takes 1–2 business days."
                  style={{ textAlign: 'left' }}
                />
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // ── OTP Verification phase (no session yet) ────────────────────────────────
  if (!sessionToken) {
    return (
      <div className="onboarding-page" style={pageStyle}>
        <Card className="onboarding-card" style={{ ...cardStyle, maxWidth: 480 }}>
          {/* Brand header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={logoBox}>
              {otpSent
                ? <SafetyOutlined style={{ fontSize: 26, color: '#fff' }} />
                : <MailOutlined style={{ fontSize: 26, color: '#fff' }} />}
            </div>
            <Title level={3} style={{ margin: '14px 0 4px' }}>Verify Your Email</Title>
            <Text type="secondary">
              Hi <strong>{employeeInfo?.name}</strong>, verify your email to access your onboarding form.
            </Text>
          </div>

          <JoiningDateBadge joiningDate={employeeInfo?.joiningDate} />

          {!otpSent ? (
            // ── Send OTP ──────────────────────────────────────────────────
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                type="info"
                showIcon
                message="One-time verification required"
                description="For your security, we'll send a 6-digit OTP to your registered company email before allowing access to the registration form."
              />
              <Button
                type="primary"
                size="large"
                loading={sendingOtp}
                onClick={handleSendOtp}
                icon={<SendOutlined />}
                block
                style={{ height: 48 }}
              >
                Send OTP to My Email
              </Button>
            </Space>
          ) : (
            // ── Enter OTP ─────────────────────────────────────────────────
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert type="success" showIcon message="OTP sent! Check your registered company email inbox." />

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Enter 6-digit OTP</Text>
                <Input
                  size="large"
                  maxLength={6}
                  value={otpValue}
                  onChange={e => setOtpValue(e.target.value.replace(/\D/g, ''))}
                  placeholder="· · · · · ·"
                  style={{ textAlign: 'center', fontSize: 28, letterSpacing: 12, fontWeight: 700, height: 60 }}
                  onPressEnter={handleVerifyOtp}
                />
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                  OTP is valid for 10 minutes and can only be used once.
                </Text>
              </div>

              <Button
                type="primary"
                size="large"
                loading={verifyingOtp}
                onClick={handleVerifyOtp}
                disabled={otpValue.length < 6}
                block
                icon={<CheckCircleOutlined />}
                style={{ height: 48 }}
              >
                Verify & Continue
              </Button>

              <div style={{ textAlign: 'center' }}>
                {resendCooldown > 0 ? (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Resend OTP in {resendCooldown}s
                  </Text>
                ) : (
                  <Button type="link" onClick={handleSendOtp} loading={sendingOtp}>
                    Resend OTP
                  </Button>
                )}
              </div>
            </Space>
          )}
        </Card>
      </div>
    );
  }

  // ── 4-Step Onboarding ──────────────────────────────────────────────────────
  const stepItems = [
    { title: 'Personal Details', icon: <UserOutlined /> },
    { title: 'Upload Documents', icon: <FileTextOutlined /> },
    { title: 'Offer Letter', icon: <SafetyOutlined /> },
    { title: 'Onboarding Done', icon: <TrophyOutlined /> },
  ];

  return (
    <div className="onboarding-page" style={pageStyle}>
      <Card className="onboarding-card" style={cardStyle}>
        {/* Welcome header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={logoBox} >👋</div>
          <Title level={3} style={{ margin: '14px 0 4px' }}>Welcome to Codespire!</Title>
          <Text type="secondary">
            Hi <strong>{employeeInfo?.name}</strong> · {employeeInfo?.designation} · {employeeInfo?.department}
          </Text>
        </div>

        {/* Joining date + countdown */}
        <JoiningDateBadge joiningDate={employeeInfo?.joiningDate} />

        {/* 4-step progress bar */}
        <Steps current={step} style={{ margin: '4px 0 36px' }} items={stepItems} />

        {/* ── Step 0: Personal Details ───────────────────────────────────── */}
        {step === 0 && (
          <Form form={personalForm} layout="vertical" onFinish={handlePersonalSubmit}>
            <Divider orientation="left">Basic Info</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Personal Email"
                  name="personalEmail"
                  rules={[
                    { required: true, message: 'Personal email is required' },
                    { type: 'email', message: 'Enter a valid email' },
                  ]}
                >
                  {/* Pre-filled from HR data — employee cannot edit */}
                  <Input
                    placeholder="your@personal-email.com"
                    disabled
                    style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Mobile Number"
                  name="phone"
                  rules={[{ required: true, message: 'Mobile number is required' }]}
                >
                  {/* Pre-filled from HR data — employee cannot edit */}
                  <Input
                    placeholder="+91 9876543210"
                    disabled
                    style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  label="Date of Birth"
                  name="dateOfBirth"
                  rules={[
                    { required: true, message: 'Date of birth is required' },
                    {
                      validator: (_, value) => {
                        if (!value) return Promise.resolve();
                        const age = dayjs().diff(value, 'years');
                        if (age < 18) return Promise.reject(new Error('Must be at least 18 years old'));
                        return Promise.resolve();
                      }
                    }
                  ]}
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    format="DD/MM/YYYY"
                    disabledDate={(current) => current && current > dayjs().subtract(18, 'years').endOf('day')}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  label="Gender"
                  name="gender"
                  rules={[{ required: true, message: 'Gender is required' }]}
                >
                  <Select placeholder="Select gender">
                    <Option value="male">Male</Option>
                    <Option value="female">Female</Option>
                    <Option value="other">Prefer not to say</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  label="Blood Group"
                  name="bloodGroup"
                  rules={[{ required: true, message: 'Blood group is required' }]}
                >
                  <Select placeholder="Select blood group">
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                      <Option key={bg} value={bg}>{bg}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Marital Status"
                  name="maritalStatus"
                  rules={[{ required: true, message: 'Marital status is required' }]}
                >
                  <Select placeholder="Select status">
                    <Option value="single">Single</Option>
                    <Option value="married">Married</Option>
                    <Option value="divorced">Divorced</Option>
                    <Option value="widowed">Widowed</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">Address</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Current Address"
                  name="currentAddress"
                  rules={[{ required: true, message: 'Current address is required' }]}
                >
                  <Input.TextArea rows={3} placeholder="House No, Street, City, State, PIN" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Permanent Address"
                  name="permanentAddress"
                  rules={[{ required: true, message: 'Permanent address is required' }]}
                >
                  <Input.TextArea rows={3} placeholder="House No, Street, City, State, PIN" />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">Emergency Contact</Divider>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  label="Contact Name"
                  name="emergencyContactName"
                  rules={[{ required: true, message: 'Emergency contact name is required' }]}
                >
                  <Input placeholder="Full name" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  label="Contact Phone"
                  name="emergencyContactPhone"
                  rules={[{ required: true, message: 'Emergency contact phone is required' }]}
                >
                  <Input placeholder="+91 9876543210" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  label="Relationship"
                  name="emergencyContactRelation"
                  rules={[{ required: true, message: 'Relationship is required' }]}
                >
                  <Input placeholder="Spouse, Parent, Sibling..." />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">
              <Space><BankOutlined /> Bank Details</Space>
            </Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Bank Name"
                  name="bankName"
                  rules={[{ required: true, message: 'Bank name is required' }]}
                >
                  <Input placeholder="State Bank of India" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Account Holder Name"
                  name="bankAccountHolderName"
                  rules={[{ required: true, message: 'Account holder name is required' }]}
                >
                  <Input placeholder="Name as on bank account" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  label="Account Number"
                  name="bankAccountNumber"
                  rules={[{ required: true, message: 'Account number is required' }]}
                >
                  <Input placeholder="00000000000" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  label="IFSC Code"
                  name="bankIfscCode"
                  rules={[{ required: true, message: 'IFSC code is required' }]}
                >
                  <Input placeholder="SBIN0000001" style={{ textTransform: 'uppercase' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  label="Branch Name"
                  name="bankBranchName"
                  rules={[{ required: true, message: 'Branch name is required' }]}
                >
                  <Input placeholder="Mumbai Main Branch" />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Button type="primary" htmlType="submit" size="large" loading={submitting} style={{ minWidth: 160 }}>
                Save & Continue →
              </Button>
            </div>
          </Form>
        )}

        {/* ── Step 1: Upload Documents ───────────────────────────────────── */}
        {step === 1 && (() => {
          const mandatoryDone = MANDATORY_DOC_TYPES.every(t => uploadedDocs.some(d => d.type === t));
          const missingMandatory = DOCUMENT_TYPES.filter(
            d => d.mandatory && !uploadedDocs.some(u => u.type === d.value)
          );
          const totalMandatory = MANDATORY_DOC_TYPES.length;
          const doneCount = MANDATORY_DOC_TYPES.filter(t => uploadedDocs.some(d => d.type === t)).length;

          return (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {/* Progress summary */}
              <Alert
                type={mandatoryDone ? 'success' : 'info'}
                showIcon
                message={
                  mandatoryDone
                    ? `All ${totalMandatory} required documents uploaded — you're good to go!`
                    : `Upload required documents to continue (${doneCount} / ${totalMandatory} done)`
                }
                description={
                  mandatoryDone
                    ? 'You may also upload the optional Graduation certificate if available.'
                    : `Still needed: ${missingMandatory.map(d => d.label).join(', ')}`
                }
              />

              {/* Per-document rows */}
              <DocumentUploadSection
                onUpload={handleDocumentUpload}
                uploading={uploading}
                uploadedDocs={uploadedDocs}
              />

              <Text type="secondary" style={{ fontSize: 11 }}>
                Accepted format: PDF only · Max 10 MB per file
              </Text>

              {/* Missing mandatory warning */}
              {!mandatoryDone && uploadedDocs.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  message="Some required documents are still missing"
                  description={`Please upload: ${missingMandatory.map(d => d.label).join(', ')}`}
                />
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <Button size="large" onClick={handleBackToPersonal}>← Back</Button>
                <Button
                  type="primary"
                  size="large"
                  onClick={async () => {
                    try {
                      await hrAPI.markOnboardingComplete(token, sessionToken);
                    } catch {
                      // non-blocking — proceed even if this call fails
                    }
                    setStep(2);
                  }}
                  disabled={!mandatoryDone}
                  title={!mandatoryDone ? `Upload all required documents to continue` : ''}
                  style={{ minWidth: 190 }}
                >
                  Submit Documents →
                </Button>
              </div>
            </Space>
          );
        })()}

        {/* ── Step 2: Offer Letter status ────────────────────────────────── */}
        {step === 2 && (
          <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
            {employeeInfo?.tokenStatus === 'offer_letter_sent' ? (
              <>
                <div style={{ ...logoBox, background: 'linear-gradient(135deg, #52c41a, #389e0d)', margin: '0 auto 20px' }}>
                  <CheckCircleOutlined style={{ fontSize: 28, color: '#fff' }} />
                </div>
                <Title level={4} style={{ margin: '0 0 8px' }}>Offer Letter Released!</Title>
                <Paragraph type="secondary" style={{ maxWidth: 460, margin: '0 auto 24px' }}>
                  Your offer letter has been officially released by our HR team.
                  Please check your registered email inbox for the details.
                </Paragraph>
                <Alert
                  type="success"
                  showIcon
                  message="Kindly check your email"
                  description="Your offer letter notification has been sent to your registered company email. Contact HR if you haven't received it."
                  style={{ textAlign: 'left', maxWidth: 460, margin: '0 auto 24px' }}
                />
              </>
            ) : (
              <>
                <div style={{ ...logoBox, background: 'linear-gradient(135deg, #faad14, #d48806)', margin: '0 auto 20px' }}>
                  <ClockCircleOutlined style={{ fontSize: 28, color: '#fff' }} />
                </div>
                <Title level={4} style={{ margin: '0 0 8px' }}>Offer Letter Pending</Title>
                <Paragraph type="secondary" style={{ maxWidth: 460, margin: '0 auto 24px' }}>
                  Your personal details and documents have been submitted successfully.
                  Our HR team will review your information and release your official offer letter shortly.
                  You'll be notified via email once it is ready.
                </Paragraph>
                <Alert
                  type="warning"
                  showIcon
                  message="No further action needed from your side"
                  description="HR is preparing your offer letter. This typically takes 1–2 business days."
                  style={{ textAlign: 'left', maxWidth: 460, margin: '0 auto 24px' }}
                />
              </>
            )}
            {/* Back button only in active session flow */}
            {sessionToken && (
              <Space>
                <Button size="large" onClick={() => setStep(1)}>← Back to Documents</Button>
              </Space>
            )}
          </div>
        )}

        {/* ── Step 3: Onboarding Done ────────────────────────────────────── */}
        {step === 3 && (
          <Result
            status="success"
            icon={<TrophyOutlined style={{ color: '#52c41a' }} />}
            title="Onboarding Complete!"
            subTitle={
              <Space direction="vertical" style={{ textAlign: 'center' }}>
                <Text>Congratulations, <strong>{employeeInfo?.name}</strong>! Welcome to the Codespire family.</Text>
                <Text type="secondary">
                  Your HR team has completed your onboarding. Everything will be ready for your first day.
                </Text>
                {employeeInfo?.joiningDate && (
                  <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px', marginTop: 8 }}>
                    Your First Day: {new Date(employeeInfo.joiningDate).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </Tag>
                )}
              </Space>
            }
          />
        )}
      </Card>
    </div>
  );
}

// ── Responsive CSS injected once ────────────────────────────────────────────────
const RESPONSIVE_STYLE_ID = 'onboarding-responsive';
if (typeof document !== 'undefined' && !document.getElementById(RESPONSIVE_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = RESPONSIVE_STYLE_ID;
  style.textContent = `
    .onboarding-page {
      min-height: 100vh;
      background: linear-gradient(135deg, #f0f4ff 0%, #fafbff 100%);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 40px 20px;
    }
    .onboarding-card {
      width: 100%;
      max-width: 840px;
      border-radius: 20px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.10);
      border: 1px solid #e8eef5;
    }
    .onboarding-card .ant-steps {
      overflow-x: auto;
    }
    .onboarding-doc-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 10px;
      transition: border-color 0.2s, background 0.2s;
    }
    @media (max-width: 576px) {
      .onboarding-page {
        padding: 12px 6px;
      }
      .onboarding-card {
        border-radius: 12px;
      }
      .onboarding-card .ant-card-body {
        padding: 16px 12px !important;
      }
      .onboarding-card .ant-steps {
        flex-wrap: nowrap;
        overflow-x: auto;
        padding-bottom: 4px;
      }
      .onboarding-card .ant-steps .ant-steps-item-title {
        font-size: 11px !important;
      }
      .onboarding-card .ant-divider-inner-text {
        font-size: 13px !important;
      }
      .onboarding-doc-row {
        flex-wrap: wrap;
        gap: 8px;
        padding: 10px 12px;
      }
      .onboarding-doc-row > div:nth-child(2) {
        flex: 1 1 calc(100% - 46px);
        min-width: 0;
      }
      .onboarding-doc-row > button,
      .onboarding-doc-row > .ant-btn {
        width: 100%;
        margin-top: 4px;
      }
    }
  `;
  document.head.appendChild(style);
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const pageStyle = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #f0f4ff 0%, #fafbff 100%)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '40px 20px',
};

const cardStyle = {
  width: '100%',
  maxWidth: 840,
  borderRadius: 20,
  boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
  border: '1px solid #e8eef5',
};

const logoBox = {
  width: 56,
  height: 56,
  borderRadius: 14,
  background: 'linear-gradient(135deg, #1268ff, #0e50d4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto',
  fontSize: 28,
};

const tagStyle = {
  fontSize: 13,
  padding: '4px 12px',
};
