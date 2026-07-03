import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Typography,
  Button,
  Switch,
  Row,
  Col,
  Tag,
  Spin,
  message,
} from 'antd';
import {
  Mail,
  Clock,
  Calendar,
  BarChart2,
  ClipboardList,
  Send,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import Layout from '../components/layout/Layout';
import { emailScheduleApi } from '../api/emailSchedule';
import { themeTokens } from '../styles/theme';

const { Title, Text } = Typography;
const C = themeTokens.colors;
const BTN_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';

// ─── Schedule metadata ────────────────────────────────────────────────────────
const SCHEDULES = [
  {
    type: 'daily_pmt',
    title: 'Daily PMT Time Log Summary',
    icon: ClipboardList,
    time: '5:30 PM IST — Every day',
    description: "Sends a summary of all users' project time logs for the day. Includes project name, issue, description, and hours logged.",
    accent: '#4f46e5',
    accentBg: '#eef2ff',
    accentShadow: 'rgba(79,70,229,0.20)',
  },
  {
    type: 'daily_attendance',
    title: 'Daily Attendance Report',
    icon: Clock,
    time: '8:00 PM IST — Every day',
    description: "Sends a full attendance report with each employee's clock-in time, clock-out time, work hours, and status.",
    accent: '#059669',
    accentBg: '#ecfdf5',
    accentShadow: 'rgba(5,150,105,0.20)',
  },
  {
    type: 'weekly_report',
    title: 'Weekly Project Report',
    icon: BarChart2,
    time: '9:00 AM IST — Every Monday',
    description: 'Sends a complete week-wise project report showing all active projects, issues worked on, contributors, and total hours logged.',
    accent: '#d97706',
    accentBg: '#fffbeb',
    accentShadow: 'rgba(217,119,6,0.20)',
  },
  {
    type: 'monthly_summary',
    title: 'Monthly Attendance Summary',
    icon: Calendar,
    time: '9:00 AM IST — 1st of every month',
    description: 'Sends a monthly summary with total present days, absent days, and leaves approved/used per employee.',
    accent: '#db2777',
    accentBg: '#fdf2f8',
    accentShadow: 'rgba(219,39,119,0.20)',
  },
];

// ─── Recipient Tag Input ──────────────────────────────────────────────────────
function RecipientInput({ recipients, onChange, accent }) {
  const [inputValue, setInputValue] = useState('');
  const [focused, setFocused] = useState(false);

  function addEmail() {
    const email = inputValue.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setInputValue(''); return; }
    if (recipients.includes(email)) { setInputValue(''); return; }
    onChange([...recipients, email]);
    setInputValue('');
  }

  function removeEmail(email) {
    onChange(recipients.filter((r) => r !== email));
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        border: `1.5px solid ${focused ? accent : C.borders}`,
        borderRadius: 10,
        padding: '8px 12px',
        minHeight: 46,
        background: '#fff',
        alignItems: 'center',
        transition: 'border-color 0.2s',
        cursor: 'text',
        boxShadow: focused ? `0 0 0 3px ${accent}18` : 'none',
      }}
      onClick={() => document.getElementById('recipient-input-' + accent)?.focus()}
    >
      {recipients.map((email) => (
        <Tag
          key={email}
          closable
          onClose={() => removeEmail(email)}
          style={{
            background: accent + '15',
            color: accent,
            border: `1px solid ${accent}30`,
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 500,
            padding: '1px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            margin: 0,
          }}
        >
          {email}
        </Tag>
      ))}
      <input
        id={'recipient-input-' + accent}
        type="email"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(); }
          if (e.key === 'Backspace' && !inputValue && recipients.length > 0) {
            onChange(recipients.slice(0, -1));
          }
        }}
        onBlur={() => { addEmail(); setFocused(false); }}
        onFocus={() => setFocused(true)}
        placeholder={recipients.length === 0 ? 'Type email and press Enter…' : 'Add more…'}
        style={{
          border: 'none',
          outline: 'none',
          flex: 1,
          minWidth: 200,
          fontSize: 13,
          background: 'transparent',
          color: C.textPrimary,
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

// ─── Schedule Card ────────────────────────────────────────────────────────────
function ScheduleCard({ meta, config, onToggle, onSave, onTrigger, saving, triggering }) {
  const [recipients, setRecipients] = useState(config?.recipients ?? []);
  const [dirty, setDirty] = useState(false);
  const Icon = meta.icon;

  useEffect(() => {
    setRecipients(config?.recipients ?? []);
    setDirty(false);
  }, [config]);

  function handleRecipientChange(emails) {
    setRecipients(emails);
    setDirty(true);
  }

  async function handleTriggerClick() {
    if (dirty && recipients.length > 0) {
      await onSave(meta.type, recipients);
    }
    await onTrigger(meta.type);
  }

  const isEnabled = config?.enabled ?? false;

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: `1px solid ${C.borders}`,
      boxShadow: themeTokens.shadows.standard,
      overflow: 'hidden',
    }}>
      {/* Card Header */}
      <div style={{
        padding: '20px 24px',
        background: meta.accentBg,
        borderBottom: `1px solid ${meta.accent}20`,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Icon Box */}
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: meta.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 4px 12px ${meta.accentShadow}`,
          }}>
            <Icon size={20} color="#fff" strokeWidth={2} />
          </div>

          <div>
            <Text style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary, display: 'block', lineHeight: 1.3 }}>
              {meta.title}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: 600, color: meta.accent, display: 'block', marginTop: 3 }}>
              ⏰ {meta.time}
            </Text>
            <Text style={{ fontSize: 13, color: C.textTertiary, display: 'block', marginTop: 6, lineHeight: 1.5 }}>
              {meta.description}
            </Text>
          </div>
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <Switch
            checked={isEnabled}
            onChange={(checked) => onToggle(meta.type, checked)}
            style={{ background: isEnabled ? meta.accent : undefined }}
          />
          <Text style={{
            fontSize: 11,
            fontWeight: 700,
            color: isEnabled ? meta.accent : C.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {isEnabled ? 'Active' : 'Paused'}
          </Text>
        </div>
      </div>

      {/* Card Body */}
      <div style={{ padding: '20px 24px' }}>
        <Row gutter={[24, 16]} align="bottom">
          <Col xs={24} lg={16}>
            <Text style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: C.textTertiary,
              display: 'block',
              marginBottom: 8,
            }}>
              Recipients
            </Text>
            <RecipientInput
              recipients={recipients}
              onChange={handleRecipientChange}
              accent={meta.accent}
            />
            <Text style={{ fontSize: 11, color: C.textTertiary, marginTop: 5, display: 'block' }}>
              Press Enter or comma to add each email address. Backspace removes the last one.
            </Text>
          </Col>

          <Col xs={24} lg={8}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Last sent info */}
              {config?.lastSentAt && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: '#f0fdf4',
                  borderRadius: 8,
                  border: '1px solid #bbf7d0',
                }}>
                  <CheckCircle2 size={13} color="#16a34a" />
                  <Text style={{ fontSize: 11, color: '#15803d', fontWeight: 500 }}>
                    Last sent {new Date(config.lastSentAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} IST
                  </Text>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  onClick={() => onSave(meta.type, recipients)}
                  disabled={saving || !dirty}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 9,
                    fontWeight: 600,
                    fontSize: 13,
                    background: dirty ? BTN_GRADIENT : undefined,
                    color: dirty ? '#fff' : undefined,
                    border: dirty ? 'none' : undefined,
                    boxShadow: dirty ? '0 2px 8px rgba(19,104,255,0.25)' : 'none',
                  }}
                >
                  {saving ? <Spin size="small" /> : 'Save'}
                </Button>

                <Button
                  onClick={handleTriggerClick}
                  disabled={triggering || saving || recipients.length === 0}
                  title={recipients.length === 0 ? 'Add at least one recipient first' : dirty ? 'Will save & send' : 'Send test email'}
                  icon={<Send size={13} />}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 9,
                    fontWeight: 600,
                    fontSize: 13,
                    border: `1.5px solid ${recipients.length === 0 ? C.borders : meta.accent}`,
                    color: recipients.length === 0 ? C.textTertiary : meta.accent,
                    background: '#fff',
                  }}
                >
                  {triggering ? 'Sending…' : dirty && recipients.length > 0 ? 'Save & Test' : 'Test'}
                </Button>
              </div>
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EmailSettings() {
  const [configs, setConfigs]       = useState({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(null);
  const [triggering, setTriggering] = useState(null);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    try {
      setLoading(true);
      const res = await emailScheduleApi.getAll();
      const map = {};
      (res.data || []).forEach((c) => { map[c.scheduleType] = c; });
      setConfigs(map);
    } catch {
      message.error('Failed to load email schedule settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(type, enabled) {
    try {
      const res = await emailScheduleApi.update(type, { enabled });
      setConfigs((prev) => ({ ...prev, [type]: res.data }));
      message.success(`Schedule ${enabled ? 'enabled' : 'paused'}`);
    } catch {
      message.error('Failed to update schedule');
    }
  }

  async function handleSave(type, recipients) {
    try {
      setSaving(type);
      const res = await emailScheduleApi.update(type, { recipients });
      setConfigs((prev) => ({ ...prev, [type]: res.data }));
      message.success(`Recipients saved (${recipients.length} address${recipients.length !== 1 ? 'es' : ''})`);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to save recipients');
    } finally {
      setSaving(null);
    }
  }

  async function handleTrigger(type) {
    try {
      setTriggering(type);
      const res = await emailScheduleApi.trigger(type);
      const recipients = res?.recipients ?? [];
      message.success(`Test email sent to: ${recipients.join(', ')}`);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to send test email');
    } finally {
      setTriggering(null);
    }
  }

  // Stats
  const totalActive   = Object.values(configs).filter((c) => c.enabled).length;
  const totalInactive = SCHEDULES.length - totalActive;

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Page Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <Text style={{ fontSize: 13, color: C.textTertiary }}>
              <Link to="/dashboard" style={{ color: C.primary }}>Dashboard</Link>
              {' / '}
              <Link to="/settings" style={{ color: C.primary }}>Settings</Link>
              {' / '}
              <span style={{ color: C.textTertiary }}>Email Schedule</span>
            </Text>
            <Title level={2} style={{ margin: '6px 0 4px', fontWeight: 800, letterSpacing: '-0.02em', color: '#1E2875' }}>
              Email Schedule
            </Title>
            <Text style={{ color: C.textTertiary, fontSize: 14 }}>
              Manage automated email reports. All scheduled times are in <strong>IST (UTC+5:30)</strong>.
            </Text>
          </div>

          <Button
            onClick={loadAll}
            style={{ height: 38, borderRadius: 9, fontWeight: 600 }}
          >
            Refresh
          </Button>
        </div>

        {/* ── KPI Cards ── */}
        <Row gutter={[16, 16]}>
          {[
            { label: 'Total Schedules', value: SCHEDULES.length, icon: Mail, color: C.primary, shadow: 'rgba(19,104,255,0.25)' },
            { label: 'Active',          value: totalActive,       icon: CheckCircle2, color: '#059669', shadow: 'rgba(5,150,105,0.25)' },
            { label: 'Paused',          value: totalInactive,     icon: XCircle,      color: '#d97706', shadow: 'rgba(217,119,6,0.25)' },
          ].map(({ label, value, icon: Icon, color, shadow }) => (
            <Col xs={24} sm={8} key={label}>
              <div style={{
                background: '#fff',
                borderRadius: 14,
                border: `1px solid ${C.borders}`,
                boxShadow: themeTokens.shadows.standard,
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <Text style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: C.textTertiary, display: 'block' }}>
                    {label}
                  </Text>
                  <Title level={3} style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: '#1E2875' }}>
                    {loading ? '—' : value}
                  </Title>
                </div>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 12px ${shadow}`,
                }}>
                  <Icon size={20} color="#fff" strokeWidth={2} />
                </div>
              </div>
            </Col>
          ))}
        </Row>

        {/* ── Schedule Cards ── */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
            <Spin size="large" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {SCHEDULES.map((meta) => (
              <ScheduleCard
                key={meta.type}
                meta={meta}
                config={configs[meta.type]}
                onToggle={handleToggle}
                onSave={handleSave}
                onTrigger={handleTrigger}
                saving={saving === meta.type}
                triggering={triggering === meta.type}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
