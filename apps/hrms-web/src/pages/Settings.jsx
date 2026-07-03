import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Typography,
  Button,
  Form,
  Input,
  Avatar,
  Tag,
  Row,
  Col,
  Divider,
  message,
  Skeleton,
  Upload,
  Select,
  DatePicker,
  Tooltip,
  Empty,
} from 'antd';
import {
  User,
  Mail,
  MapPin,
  Save,
  Briefcase,
  Camera,
  FileText,
  UploadCloud,
  Download,
  Eye,
  Trash2,
  Lock,
  Bell,
  ChevronRight,
  KeyRound,
  Building2,
} from 'lucide-react';
import { settingsAPI } from '../api/settings';
import { authAPI } from '../api/auth';
import keycloak from '../lib/keycloak';
import Layout from '../components/layout/Layout';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { themeTokens } from '../styles/theme';
import { normalizeFileUrl, normalizeRoleName } from '../utils/auth';
import PhoneInput, { getPhoneValidator } from '../components/common/PhoneInput';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const C = themeTokens.colors;

/* ─── Shared field label ─────────────────────────────────────── */
const FieldLabel = ({ children, required }) => (
  <span style={{ fontSize: 12, fontWeight: 600, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
    {required && <span style={{ color: '#EF4444', marginRight: 3 }}>*</span>}
    {children}
  </span>
);

/* ─── Read-only input ────────────────────────────────────────── */
const ReadInput = ({ value }) => (
  <div style={{
    height: 42, padding: '0 14px', borderRadius: 12,
    border: `1px solid ${C.borders}`, background: '#F9FAFB',
    display: 'flex', alignItems: 'center',
    fontSize: 14, color: C.textPrimary,
  }}>
    {value || '—'}
  </div>
);

export default function Settings() {
  const { user, isAdmin, isHR, isManager, isEmployee } = useAuth();
  const { updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { user: rawUser } = useAuthStore();
  const initialTab = 'profile';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [profileForm] = Form.useForm();
  const [myDocuments, setMyDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('other');


  // Employment data (read-only)
  const [employmentData, setEmploymentData] = useState({});

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadSettings();
    loadMyDocuments();
  }, []);

  async function loadMyDocuments() {
    setDocsLoading(true);
    try {
      const res = await settingsAPI.getMyDocuments();
      setMyDocuments(res?.data?.data || res?.data || []);
    } catch {
      setMyDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }

  async function handleUploadMyDocument({ file }) {
    if (!file) return;
    setUploadingDoc(true);
    try {
      await settingsAPI.uploadMyDocument(file, uploadDocType);
      message.success('Document uploaded successfully.');
      loadMyDocuments();
    } catch (err) {
      message.error(err?.response?.data?.error?.message || 'Failed to upload document.');
    } finally {
      setUploadingDoc(false);
    }
  }

  async function loadSettings() {
    setProfileLoading(true);
    try {
      const [profileRes, notifRes] = await Promise.all([
        settingsAPI.getProfile(),
        settingsAPI.getNotificationPreferences(),
      ]);

      const profileData = profileRes.data?.data || profileRes.data || {};
      const allPreferences = notifRes.data?.data?.preferences || [];
      const notifPreferences = allPreferences.filter(p =>
        (p.notificationType || '').startsWith('hrms_')
      );
      setNotificationSettings(notifPreferences);

      const personal = {
        ...(profileData.personal || {}),
        firstName: profileData.personal?.firstName || profileData.firstName,
        lastName: profileData.personal?.lastName || profileData.lastName,
        email: profileData.personal?.email || profileData.email,
        personalEmail: profileData.personal?.personalEmail || profileData.personalEmail,
        phone: profileData.personal?.phone || profileData.phone,
        avatarUrl: profileData.personal?.avatarUrl || profileData.avatarUrl || null,
        maritalStatus: profileData.personal?.maritalStatus || profileData.maritalStatus,
        dateOfBirth: profileData.personal?.dateOfBirth || profileData.dateOfBirth,
        currentAddress: profileData.personal?.currentAddress || profileData.currentAddress,
        permanentAddress: profileData.personal?.permanentAddress || profileData.permanentAddress || profileData.personal?.homeLocation || profileData.homeLocation,
        emergencyContactName: profileData.personal?.emergencyContactName || profileData.emergencyContactName,
        emergencyContactPhone: profileData.personal?.emergencyContactPhone || profileData.emergencyContactPhone || profileData.emergencyContactNumber,
        emergencyContactRelation: profileData.personal?.emergencyContactRelation || profileData.emergencyContactRelation,
      };

      const employment = {
        department: profileData.employment?.department || profileData.department || null,
        designation: profileData.employment?.designation || profileData.designation || null,
        employeeId: profileData.employment?.employeeId || profileData.employeeId ||
          profileData.employment?.employeeCode || profileData.employeeCode || 'N/A',
        workLocation: profileData.employment?.location || profileData.workLocation || profileData.officeLocation || null,
        country: profileData.employment?.country || profileData.country || null,
        branchName: profileData.employment?.branchName || profileData.branchName || null,
        workMode: profileData.employment?.workMode || profileData.workMode || null,
        joiningDate: profileData.employment?.joiningDate || profileData.joiningDate || null,
      };

      const managerName = profileData.manager?.name ||
        (profileData.manager?.firstName ? [profileData.manager.firstName, profileData.manager.lastName].filter(Boolean).join(' ') : null) ||
        (profileData['manager.firstName'] ? [profileData['manager.firstName'], profileData['manager.lastName']].filter(Boolean).join(' ') : null);

      const managerObj = {
        ...(profileData.manager || {}),
        name: managerName || profileData.manager?.name,
        id: profileData['manager.id'] || profileData.manager?.id,
        employeeId: profileData['manager.employeeId'] || profileData.manager?.employeeId,
        avatarUrl: profileData['manager.avatarUrl'] || profileData.manager?.avatarUrl || null,
        designation: profileData['manager.designation'] || profileData.manager?.designation || null,
        department: profileData['manager.department'] || profileData.manager?.department || null,
      };

      setEmploymentData({ ...employment, managerName: managerObj.name, manager: managerObj.name ? managerObj : null });

      updateUser({
        ...personal,
        ...employment,
        manager: managerObj.name ? managerObj : profileData.manager,
        branchName: employment.branchName,
        avatarUrl: personal.avatarUrl || user?.avatarUrl,
        name: profileData.displayName || [personal.firstName, personal.lastName].filter(Boolean).join(' ') || user?.name,
        emergencyContactName: personal.emergencyContactName,
        emergencyContactPhone: personal.emergencyContactPhone,
        emergencyContactRelation: personal.emergencyContactRelation,
        permanentAddress: personal.permanentAddress,
      });

      profileForm.setFieldsValue({
        firstName: personal.firstName,
        lastName: personal.lastName,
        phone: personal.phone,
        personalEmail: personal.personalEmail || null,
        maritalStatus: personal.maritalStatus,
        dateOfBirth: personal.dateOfBirth ? dayjs(personal.dateOfBirth) : null,
        currentAddress: personal.currentAddress,
        permanentAddress: personal.permanentAddress,
        emergencyContactName: personal.emergencyContactName,
        emergencyContactPhone: personal.emergencyContactPhone,
        emergencyContactRelation: personal.emergencyContactRelation,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
      message.error('Could not load profile settings');
    } finally {
      setProfileLoading(false);
    }
  }

  const handleProfileUpdate = async (values) => {
    setLoading(true);
    try {
      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        personalEmail: values.personalEmail,
        maritalStatus: values.maritalStatus,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null,
        currentAddress: values.currentAddress,
        permanentAddress: values.permanentAddress,
        emergencyContactName: values.emergencyContactName,
        emergencyContactPhone: values.emergencyContactPhone,
        emergencyContactRelation: values.emergencyContactRelation,
      };
      await settingsAPI.updateProfile(payload);
      message.success('Profile settings updated successfully');
      await loadSettings();
    } catch (error) {
      message.error(error?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const HRMS_NOTIF_TYPES = [
    'hrms_announcement', 'hrms_leave_submitted', 'hrms_leave_approved',
    'hrms_leave_rejected', 'hrms_leave_cancelled', 'hrms_payroll_generated',
    'hrms_payroll_finalized', 'hrms_regularization_submitted', 'hrms_regularization_approved',
    'hrms_regularization_rejected', 'hrms_onboarding_initiated', 'hrms_onboarding_completed',
    'hrms_offboarding_initiated', 'hrms_offboarding_completed', 'hrms_employee_status_changed',
    'hrms_manager_assigned', 'hrms_role_changed', 'hrms_document_uploaded',
  ];

  const updateNotificationPref = async (notificationType, channel, enabled) => {
    const fieldMap = { email: 'emailEnabled', inApp: 'inAppEnabled' };
    const apiField = fieldMap[channel];
    setNotificationSettings(prev =>
      prev.map(item =>
        item.notificationType === notificationType ? { ...item, [apiField]: enabled } : item
      )
    );
    try {
      await settingsAPI.updateNotificationPreferences([{ notificationType, [apiField]: enabled }]);
      message.success('Preference updated');
    } catch (error) {
      message.error('Failed to update notification settings');
      loadSettings();
    }
  };

  const handleAvatarUpload = async ({ file }) => {
    setLoading(true);
    try {
      const response = await settingsAPI.uploadAvatar(file);
      const newAvatarUrl = response.data?.avatarUrl || response.data?.data?.avatarUrl || response.data?.url;
      if (newAvatarUrl) {
        updateUser({ avatarUrl: newAvatarUrl });
        message.success('Profile picture updated successfully');
      } else {
        loadSettings();
      }
    } catch (error) {
      message.error(error.message || 'Failed to upload profile picture');
    } finally {
      setLoading(false);
    }
  };

  const DOC_TYPE_LABELS = {
    relieving_letter: 'Relieving Letter', salary_slip_1: 'Salary Slip (Month 1)',
    salary_slip_2: 'Salary Slip (Month 2)', salary_slip_3: 'Salary Slip (Month 3)',
    aadhar_card: 'Aadhar Card', pan_card: 'PAN Card',
    class_10_marksheet: '10th Marksheet', class_12_marksheet: '12th Marksheet',
    graduation_certificate: 'Graduation Certificate', offer_letter: 'Offer Letter',
    bank_details: 'Bank Details', id_proof: 'ID Proof',
    educational_certificate: 'Educational Certificate', other: 'Other',
  };

  const DOC_TYPE_OPTIONS = [
    { label: '— Experience Documents —', options: [
      { label: 'Relieving Letter', value: 'relieving_letter' },
      { label: 'Salary Slip (Month 1)', value: 'salary_slip_1' },
      { label: 'Salary Slip (Month 2)', value: 'salary_slip_2' },
      { label: 'Salary Slip (Month 3)', value: 'salary_slip_3' },
    ]},
    { label: '— Identity & Education —', options: [
      { label: 'Aadhar Card', value: 'aadhar_card' },
      { label: 'PAN Card', value: 'pan_card' },
      { label: '10th Marksheet', value: 'class_10_marksheet' },
      { label: '12th Marksheet', value: 'class_12_marksheet' },
      { label: 'Graduation Certificate', value: 'graduation_certificate' },
      { label: 'Offer Letter', value: 'offer_letter' },
      { label: 'Bank Details', value: 'bank_details' },
      { label: 'ID Proof', value: 'id_proof' },
      { label: 'Other', value: 'other' },
    ]},
  ];

  const displayName = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User';
  const initials = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = isAdmin ? 'Super Admin' : (user?.designation || user?.role || 'Employee');

  const getStatusBadge = (status) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'verified') return { label: 'Verified',  bg: '#DCFCE7', color: '#16a34a', dot: '#16a34a' };
    if (s === 'approved') return { label: 'Approved',  bg: '#EFF6FF', color: '#1368FF', dot: '#1368FF' };
    if (s === 'rejected') return { label: 'Rejected',  bg: '#FEF2F2', color: '#ef4444', dot: '#ef4444' };
    if (s === 'pending')  return { label: 'Pending',   bg: '#FFFBEB', color: '#d97706', dot: '#f59e0b' };
    return { label: s.charAt(0).toUpperCase() + s.slice(1), bg: '#F3F4F6', color: '#6B7280', dot: '#9CA3AF' };
  };


  /* ── Tab renderers ──────────────────────────────────────────── */

  const renderProfileTab = () => (
    <div style={{ padding: isMobile ? '20px' : '28px 32px' }}>
      {profileLoading ? (
        <Skeleton active avatar paragraph={{ rows: 8 }} />
      ) : (
        <>
          <Text strong style={{ fontSize: 16, fontWeight: 700, color: '#00115b', display: 'block', marginBottom: 20 }}>
            Profile Information
          </Text>

          {/* Avatar row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <Upload
              showUploadList={false}
              customRequest={handleAvatarUpload}
              beforeUpload={(file) => {
                const ok = (file.type === 'image/jpeg' || file.type === 'image/png') && file.size / 1024 / 1024 < 2;
                if (!ok) message.error('JPG/PNG < 2MB only');
                return ok;
              }}
            >
              <div style={{ position: 'relative', cursor: 'pointer', display: 'inline-block' }}>
                <Avatar size={64} src={user?.avatarUrl} style={{ background: C.primary, fontSize: 22, fontWeight: 700 }}>
                  {!user?.avatarUrl && initials}
                </Avatar>
                <div style={{
                  position: 'absolute', bottom: 1, right: 1,
                  background: C.primary, borderRadius: '50%', width: 20, height: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid white',
                }}>
                  <Camera size={10} color="#fff" />
                </div>
              </div>
            </Upload>
            <div>
              <Text strong style={{ fontSize: 17, color: C.textPrimary, display: 'block' }}>{displayName}</Text>
              <Text style={{ fontSize: 13, color: C.textTertiary }}>{roleLabel}</Text>
              {(user?.employeeId || user?.employeeCode) && (
                <Tag style={{ marginTop: 4, background: '#EFF6FF', border: 'none', color: C.primary, fontWeight: 600, fontSize: 11, borderRadius: 6, width: 'fit-content', padding: '0 8px' }}>
                  ID: {user?.employeeId || user?.employeeCode}
                </Tag>
              )}
            </div>
          </div>

          <Divider style={{ margin: '0 0 24px 0', borderColor: C.borders }} />

          <Form form={profileForm} layout="vertical" onFinish={handleProfileUpdate} requiredMark={false}>
            <Row gutter={[20, 4]}>
              <Col xs={24} sm={12}>
                <Form.Item name="firstName" label={<FieldLabel required>First Name</FieldLabel>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
                  <Input size="large" style={{ borderRadius: 12, borderColor: C.borders }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="lastName" label={<FieldLabel required>Last Name</FieldLabel>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
                  <Input size="large" style={{ borderRadius: 12, borderColor: C.borders }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label={<FieldLabel>Email Address</FieldLabel>} style={{ marginBottom: 16 }}>
                  <Input size="large" value={user?.email} disabled prefix={<Mail size={14} color={C.textTertiary} />} style={{ borderRadius: 12, background: '#F9FAFB', borderColor: C.borders }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="phone" label={<FieldLabel required>Phone Number</FieldLabel>} rules={[{ required: true, message: 'Required' }, { validator: getPhoneValidator(true) }]} style={{ marginBottom: 16 }}>
                  <PhoneInput size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="dateOfBirth" label={<FieldLabel required>Date of Birth</FieldLabel>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
                  <DatePicker size="large" style={{ width: '100%', borderRadius: 12, borderColor: C.borders }} format="DD MMM YYYY" disabledDate={(current) => current && current > dayjs().subtract(18, 'years')} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="maritalStatus" label={<FieldLabel required>Marital Status</FieldLabel>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
                  <Select size="large" placeholder="Select" options={[{ label: 'Single', value: 'single' }, { label: 'Married', value: 'married' }]} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="currentAddress" label={<FieldLabel required>Current Address</FieldLabel>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
                  <Input size="large" style={{ borderRadius: 12, borderColor: C.borders }} placeholder="Current address" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="permanentAddress" label={<FieldLabel required>Permanent Address</FieldLabel>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
                  <Input size="large" style={{ borderRadius: 12, borderColor: C.borders }} placeholder="Permanent address" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="emergencyContactName" label={<FieldLabel required>Emergency Contact Name</FieldLabel>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
                  <Input size="large" style={{ borderRadius: 12, borderColor: C.borders }} placeholder="e.g. John Sharma" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="emergencyContactRelation" label={<FieldLabel required>Emergency Contact Relation</FieldLabel>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
                  <Input size="large" style={{ borderRadius: 12, borderColor: C.borders }} placeholder="e.g. Father, Spouse" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="emergencyContactPhone" label={<FieldLabel required>Emergency Contact Phone</FieldLabel>} rules={[{ required: true, message: 'Required' }, { validator: getPhoneValidator(true) }]} style={{ marginBottom: 16 }}>
                  <PhoneInput size="large" />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ margin: '8px 0 20px 0', borderColor: C.borders }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" htmlType="submit" loading={loading} icon={<Save size={14} />} size="large"
                style={{ background: C.primary, border: 'none', borderRadius: 12, fontWeight: 700, paddingInline: 24, height: 40 }}>
                Save Changes
              </Button>
            </div>
          </Form>
        </>
      )}
    </div>
  );

  const renderEmploymentTab = () => (
    <div style={{ padding: isMobile ? '20px' : '28px 32px' }}>
      {profileLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <>
          <Text strong style={{ fontSize: 16, fontWeight: 700, color: '#00115b', display: 'block', marginBottom: 20 }}>
            Employment Information
          </Text>
          <Row gutter={[20, 16]}>
            <Col xs={24} sm={12}>
              <div style={{ marginBottom: 6 }}><FieldLabel>Work Email</FieldLabel></div>
              <ReadInput value={user?.email} />
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ marginBottom: 6 }}><FieldLabel>Department</FieldLabel></div>
              <ReadInput value={employmentData.department || user?.department} />
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ marginBottom: 6 }}><FieldLabel>Work Mode</FieldLabel></div>
              <ReadInput value={employmentData.workMode ? employmentData.workMode.charAt(0).toUpperCase() + employmentData.workMode.slice(1) : null} />
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ marginBottom: 6 }}><FieldLabel>Joining Date</FieldLabel></div>
              <ReadInput value={employmentData.joiningDate ? dayjs(employmentData.joiningDate).format('DD MMM YYYY') : null} />
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ marginBottom: 6 }}><FieldLabel>Office Location</FieldLabel></div>
              <ReadInput value={employmentData.workLocation} />
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ marginBottom: 6 }}><FieldLabel>Country</FieldLabel></div>
              <ReadInput value={employmentData.country} />
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ marginBottom: 6 }}><FieldLabel>Branch</FieldLabel></div>
              <ReadInput value={employmentData.branchName} />
            </Col>
          </Row>

          {/* Reporting Manager card */}
          <Divider style={{ margin: '24px 0 20px', borderColor: C.borders }} />
          <div style={{ marginBottom: 12 }}><FieldLabel>Reporting Manager</FieldLabel></div>
          {employmentData.manager ? (() => {
            const mgr = employmentData.manager;
            const initials = (mgr.name || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
            return (
              <div style={{
                borderRadius: 16, border: `1px solid ${C.borders}`,
                background: C.appGradient, overflow: 'hidden',
                maxWidth: 340,
              }}>
                {/* Blue header strip */}
                <div style={{
                  height: 56, background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
                  position: 'relative',
                }} />
                {/* Avatar overlapping header */}
                <div style={{ padding: '0 20px 20px', marginTop: -28 }}>
                  <Avatar
                    size={56}
                    src={mgr.avatarUrl}
                    style={{
                      background: C.primary, fontSize: 18, fontWeight: 700,
                      border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 10, lineHeight: 1,
                    }}
                  >
                    {!mgr.avatarUrl && initials}
                  </Avatar>
                  <Text strong style={{ fontSize: 15, color: C.textPrimary, display: 'block', lineHeight: 1.3 }}>
                    {mgr.name}
                  </Text>
                  {mgr.designation && (
                    <Text style={{ fontSize: 12, color: C.primary, fontWeight: 600, display: 'block', marginBottom: 12 }}>
                      {mgr.designation}
                    </Text>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                    {mgr.employeeId && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.textTertiary, fontWeight: 600, minWidth: 90 }}>EMPLOYEE ID</span>
                        <span style={{ fontSize: 12, color: C.textSecondary, fontWeight: 500 }}>{mgr.employeeId}</span>
                      </div>
                    )}
                    {mgr.department && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.textTertiary, fontWeight: 600, minWidth: 90 }}>DEPARTMENT</span>
                        <span style={{ fontSize: 12, color: C.textSecondary, fontWeight: 500 }}>{mgr.department}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })() : (
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              border: `1px solid ${C.borders}`, background: '#F9FAFB',
              fontSize: 14, color: C.textTertiary,
            }}>
              No manager assigned
            </div>
          )}

          {/* Read-only notice */}
          <div style={{
            marginTop: 28, padding: '14px 16px', borderRadius: 12,
            background: '#EFF6FF', border: `1px solid #BFDBFE`,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>i</span>
            </div>
            <div>
              <Text strong style={{ fontSize: 12, color: '#00115b', display: 'block', marginBottom: 2 }}>
                Employment Details are Read-Only
              </Text>
              <Text style={{ fontSize: 12, color: C.textTertiary, lineHeight: 1.5 }}>
                These fields are managed by your HR department. Contact HR to make changes to your employment information.
              </Text>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderNotificationsTab = () => {
    const CHANNELS = [
      { key: 'email', label: 'Email',  field: 'emailEnabled'  },
      { key: 'inApp', label: 'In-App', field: 'inAppEnabled'  },
    ];
    return (
      <div style={{ padding: isMobile ? '20px' : '28px 32px' }}>
        <Text strong style={{ fontSize: 16, fontWeight: 700, color: '#00115b', display: 'block', marginBottom: 4 }}>
          Notification Preferences
        </Text>
        <Text style={{ fontSize: 13, color: C.textTertiary, display: 'block', marginBottom: 24 }}>
          Choose how and where you want to receive HRMS notifications.
        </Text>

        {notificationSettings === null ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : notificationSettings.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">No notification preferences found</Text>} />
        ) : (
          <div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 90px 90px', alignItems: 'center',
              padding: '8px 16px', background: C.appBackground, borderRadius: 8,
              marginBottom: 8, border: `1px solid ${C.borders}`,
            }}>
              <Text style={{ fontSize: 11, fontWeight: 700, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notification</Text>
              {CHANNELS.map(ch => (
                <Text key={ch.key} style={{ fontSize: 11, fontWeight: 700, color: C.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>{ch.label}</Text>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {notificationSettings.map((item) => (
                <div key={item.notificationType} style={{
                  display: 'grid', gridTemplateColumns: '1fr 90px 90px', alignItems: 'center',
                  padding: '14px 16px', background: '#fff', borderRadius: 10, border: `1px solid ${C.borders}`,
                }}>
                  <div>
                    <Text strong style={{ fontSize: 13, color: C.textPrimary, display: 'block' }}>{item.label || item.notificationType}</Text>
                    {item.description && <Text style={{ fontSize: 12, color: C.textTertiary }}>{item.description}</Text>}
                  </div>
                  {CHANNELS.map(ch => (
                    <div key={ch.key} style={{ display: 'flex', justifyContent: 'center' }}>
                      <div
                        onClick={() => updateNotificationPref(item.notificationType, ch.key, !item[ch.field])}
                        style={{
                          width: 40, height: 22, borderRadius: 11,
                          background: item[ch.field] ? C.primary : '#D1D5DB',
                          cursor: 'pointer', position: 'relative', flexShrink: 0,
                          transition: 'background 0.2s',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 2, left: item[ch.field] ? 20 : 2,
                          width: 18, height: 18, borderRadius: '50%', background: '#fff',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.18)', transition: 'left 0.2s',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── Security tab ─────────────────────────────────────────────── */
  const renderSecurityTab = () => (
    <div style={{ padding: isMobile ? '20px' : '28px 32px' }}>
      <Text strong style={{ fontSize: 16, fontWeight: 700, color: '#00115b', display: 'block', marginBottom: 24 }}>
        Security &amp; Privacy
      </Text>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: '#EBF4FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <KeyRound size={20} color={C.primary} />
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 14, color: '#00115b', display: 'block' }}>Change Password</Text>
          <Text style={{ fontSize: 12, color: C.textTertiary }}>Passwords are managed securely via Keycloak</Text>
        </div>
        <Button
          type="primary"
          icon={<KeyRound size={14} />}
          onClick={() => keycloak.accountManagement()}
          style={{ background: C.primary, border: 'none', borderRadius: 12, fontWeight: 700, height: 40, paddingInline: 24, flexShrink: 0 }}
        >
          Manage Account
        </Button>
      </div>

      <Divider style={{ margin: '24px 0 0', borderColor: C.borders }} />
    </div>
  );

  const renderDocumentsTab = () => (
    <div style={{ padding: isMobile ? '20px' : '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: 12, marginBottom: 24 }}>
        <Text strong style={{ fontSize: 16, fontWeight: 700, color: '#00115b' }}>My Documents</Text>
        <Upload showUploadList={false} accept=".pdf" beforeUpload={(file) => { handleUploadMyDocument({ file }); return false; }}>
          <Button type="primary" icon={<UploadCloud size={14} />} loading={uploadingDoc}
            style={{ background: C.primary, border: 'none', borderRadius: 12, fontWeight: 700, height: 38, width: isMobile ? '100%' : 'auto' }}>
            Upload Document
          </Button>
        </Upload>
      </div>

      {docsLoading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : myDocuments.length > 0 ? (
        <div>
          {myDocuments.map((doc, idx) => {
            const badge = getStatusBadge(doc.status || doc.verificationStatus);
            const fileSize = doc.fileSize
              ? doc.fileSize > 1024 * 1024 ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(doc.fileSize / 1024)} KB`
              : null;
            return (
              <div key={doc.id}>
                {idx > 0 && <Divider style={{ margin: 0, borderColor: C.borders }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 4px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: `${C.primary}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={18} color={C.primary} strokeWidth={1.8} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ display: 'block', fontSize: 13, color: C.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.documentName || doc.fileName || 'Document'}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.textTertiary, display: 'block' }}>
                      {DOC_TYPE_LABELS[doc.documentType] || doc.documentType || 'Document'}
                      {fileSize && ` • ${fileSize}`}
                    </Text>
                    {doc.uploadedAt && <Text style={{ fontSize: 11, color: C.textTertiary }}>Uploaded {dayjs(doc.uploadedAt).format('DD MMM YYYY')}</Text>}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: badge.bg, color: badge.color, fontSize: 12, fontWeight: 600, borderRadius: 20, padding: '4px 10px', flexShrink: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: badge.dot }} />
                    {badge.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <Tooltip title="Download">
                      <Button type="text" size="small" icon={<Download size={15} color={C.textTertiary} />} href={normalizeFileUrl(doc.fileUrl)} download target="_blank" rel="noopener noreferrer" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                    </Tooltip>
                    <Tooltip title="View">
                      <Button type="text" size="small" icon={<Eye size={15} color={C.textTertiary} />} href={normalizeFileUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                    </Tooltip>
                    <Tooltip title="Delete">
                      <Button type="text" size="small" icon={<Trash2 size={15} color="#ef4444" />} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                    </Tooltip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">No documents uploaded yet</Text>} />
      )}
    </div>
  );

  /* ── Tab config — Security visible for ALL roles ─────────────── */
  const TABS = [
    { key: 'profile',       label: 'Profile',        icon: User       },
    { key: 'employment',    label: 'Employment',     icon: Building2  },
    { key: 'notifications', label: 'Notifications',  icon: Bell       },
    { key: 'security',      label: 'Security',       icon: Lock       },
  ];

  const tabContent = {
    profile:       renderProfileTab(),
    employment:    renderEmploymentTab(),
    documents:     renderDocumentsTab(),
    notifications: renderNotificationsTab(),
    security:      renderSecurityTab(),
  };

  /* ── Save button only shows on profile tab ───────────────────── */
  const showSaveInHeader = false; // Save button is inside each tab form

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
          <div>
            {/* Breadcrumb */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 14, color: C.textTertiary }}>
              <Link to="/dashboard" style={{ color: C.textTertiary, textDecoration: 'none' }}>Dashboard</Link>
              <ChevronRight size={14} color={C.borderLight} />
              <span style={{ color: C.textSecondary }}>Settings</span>
            </nav>
            <Title level={isMobile ? 3 : 2} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.02em', color: '#00115b', fontSize: isMobile ? 20 : 24, lineHeight: '32px' }}>
              Account Settings
            </Title>
            <Text style={{ color: C.textTertiary, fontSize: 14 }}>
              Manage your profile, employment details, notifications and security settings
            </Text>
          </div>

        </div>

        {/* ── Main card with Figma-style underline tabs ── */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.borders}`, boxShadow: '0 1px 3px rgba(16,24,40,0.07)', overflow: 'hidden' }}>

          {/* Tab nav — Figma underline style, scrollable on mobile */}
          <div style={{ borderBottom: `1px solid ${C.borders}`, padding: isMobile ? '0 12px' : '0 32px', display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {TABS.map(({ key, label, icon: Icon }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: isMobile ? '14px 12px' : '16px 20px',
                    border: 'none', borderBottom: isActive ? `2px solid ${C.primary}` : '2px solid transparent',
                    marginBottom: -1,
                    background: 'transparent', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: isMobile ? 13 : 14, fontWeight: 600,
                    color: isActive ? C.primary : C.textTertiary,
                    transition: 'color 0.15s, border-color 0.15s',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {tabContent[activeTab]}
        </div>
      </div>
    </Layout>
  );
}
