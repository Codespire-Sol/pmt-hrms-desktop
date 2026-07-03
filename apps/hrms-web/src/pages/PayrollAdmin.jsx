import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Typography,
  Space,
  Button,
  Upload,
  Select,
  Modal,
  Input,
  Dropdown,
  message,
} from 'antd';
import {
  UploadCloud,
  Download,
  FileCheck,
  Lock,
  Unlock,
  AlertCircle,
  Users,
  FileCog,
  CheckCircle,
  Info,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { payrollAPI } from '../api/payroll';
import Layout from '../components/layout/Layout';
import { themeTokens } from '../styles/theme';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { broadcastDataRefresh } from '../utils/realtime';

const { Title, Text } = Typography;
const { Dragger } = Upload;
const { TextArea } = Input;

const C = themeTokens.colors;
const BTN_GRADIENT = `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`;

const STATUS_COLORS = {
  draft: '#6B7280',
  generated: C.primary,
  finalized: '#10B981',
};

/* ─── Small reusable pieces ─────────────────────────────────── */

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: `1px solid ${C.borders}`,
      boxShadow: '0 1px 3px rgba(16,24,40,0.07)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function IconBox({ bg = C.blue50, size = 40, radius = 12, children }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius,
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <Text style={{ fontSize: 12, color: C.textTertiary, display: 'block', marginBottom: 4 }}>
      {children}
    </Text>
  );
}

function SectionTitle({ children }) {
  return (
    <Text strong style={{ fontSize: 14, color: '#00115b', display: 'block', marginBottom: 12 }}>
      {children}
    </Text>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */

export default function PayrollAdmin() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [uploadingRows, setUploadingRows] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [statusData, setStatusData] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [lastOperation, setLastOperation] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualRows, setManualRows] = useState(
    '[\n  { "employeeId": "EMP001", "gross": 50000, "deductions": 5000, "net": 45000 }\n]'
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { loadStatus(); }, [currentMonth, currentYear]);

  useAutoRefresh(loadStatus, {
    enabled: true,
    scope: 'payroll',
    intervalMs: 120000,
    deps: [currentMonth, currentYear],
  });

  async function loadStatus() {
    setLoadingStatus(true);
    try {
      const response = await payrollAPI.getStatus({ month: currentMonth, year: currentYear });
      setStatusData(response?.data || null);
    } catch {
      setStatusData(null);
    } finally {
      setLoadingStatus(false);
    }
  }

  const getMonthName = (month) =>
    new Date(2000, Math.max(0, Number(month || 1) - 1)).toLocaleString('default', { month: 'long' });

  const downloadTemplate = (type = 'detailed') => {
    let csvContent, filename;

    if (type === 'basic') {
      // Basic template — gross/deductions/net only; system auto-computes breakdown per Indian govt. policies
      csvContent = [
        'employee_id,gross_salary,total_deductions,net_salary,total_working_days,leaves,lop_days,paid_days',
        'EMP001,50000,3000,47000,26,0,0,26',
        'EMP002,75000,4500,70500,26,1,0,25',
      ].join('\r\n');
      filename = 'payroll_template_basic.csv';
    } else {
      // Detailed template — explicit breakdown per Indian Govt. salary policies:
      // Basic = 40-50% of Gross | HRA = 40-50% of Basic | Conveyance ≤1600 | Medical ≤1250 | Special = balance
      // EPF = 12% of Basic (max 1800) | ESIC = 0.75% of Gross (only if Gross ≤21000) | PT = state-slab | TDS = per IT slab
      csvContent = [
        'employee_id,basic_salary,hra,conveyance_allowance,medical_allowance,special_allowance,gross_salary,pf_employee,esic_employee,professional_tax,tds,total_deductions,net_salary,total_working_days,leaves,lop_days,paid_days',
        // Example 1: Gross 50000 — Basic=50% HRA=40%basic EPF capped ESIC N/A
        'EMP001,25000,10000,1600,1250,12150,50000,1800,0,200,1000,3000,47000,26,0,0,26',
        // Example 2: Gross 75000 — Basic=50% EPF capped TDS higher
        'EMP002,37500,15000,1600,1250,19650,75000,1800,0,200,3500,5500,69500,26,1,0,25',
        // Example 3: Gross 18000 — ESIC applicable (gross ≤21000)
        'EMP003,9000,3600,1600,1250,2550,18000,1080,135,200,0,1415,16585,26,0,0,26',
      ].join('\r\n');
      filename = 'payroll_template_detailed.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleUploadCsv = async () => {
    if (!selectedFile) { message.warning('Please choose a CSV file first'); return; }
    setUploadingCsv(true);
    try {
      const response = await payrollAPI.uploadCsv({ file: selectedFile, month: currentMonth, year: currentYear });
      const result = response?.data || {};
      setLastOperation({ type: 'upload-csv', result });
      if (result.failed > 0) {
        message.warning(`CSV uploaded with errors: ${result.processed || 0} processed, ${result.failed} failed. Check details below.`);
      } else {
        message.success(`CSV uploaded: ${result.processed || 0}/${result.totalRows || 0} processed`);
      }
      setSelectedFile(null);
      broadcastDataRefresh('payroll');
      await loadStatus();
    } catch (error) {
      message.error(error?.message || 'CSV upload failed');
    } finally {
      setUploadingCsv(false);
    }
  };

  const handleUploadRows = async () => {
    let rows = [];
    try {
      const parsed = JSON.parse(manualRows);
      rows = Array.isArray(parsed) ? parsed : [];
      if (!rows.length) throw new Error('Rows JSON must be a non-empty array');
    } catch (error) {
      message.error(error?.message || 'Invalid rows JSON');
      return;
    }
    setUploadingRows(true);
    try {
      const response = await payrollAPI.uploadRows({ month: currentMonth, year: currentYear, rows });
      const result = response?.data || {};
      setLastOperation({ type: 'upload-rows', result });
      if (result.failed > 0) {
        message.warning(`Rows uploaded with errors: ${result.processed || 0} processed, ${result.failed} failed.`);
      } else {
        message.success(`Rows uploaded: ${result.processed || 0}/${result.totalRows || 0} processed`);
      }
      setManualOpen(false);
      broadcastDataRefresh('payroll');
      await loadStatus();
    } catch (error) {
      message.error(error?.message || 'Rows upload failed');
    } finally {
      setUploadingRows(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await payrollAPI.generate(currentMonth, currentYear);
      const result = response?.data || {};
      setLastOperation({ type: 'generate', result });
      if (result.status === 'partially_generated') {
        message.warning(`Partially completed. Generated: ${result.generated || 0}, Failed: ${result.failed || 0}`);
      } else {
        message.success(`Payslips generated: ${result.generated || 0}/${result.totalRows || 0}`);
      }
      broadcastDataRefresh('payroll');
      await loadStatus();
    } catch (error) {
      message.error(error?.message || 'Payslip generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleFinalize = () => {
    Modal.confirm({
      title: 'Finalize Payroll?',
      content: `Finalize payroll for ${getMonthName(currentMonth)} ${currentYear}. This action locks the month.`,
      okText: 'Finalize',
      okType: 'primary',
      cancelText: 'Cancel',
      onOk: async () => {
        setFinalizing(true);
        try {
          const response = await payrollAPI.finalize(currentMonth, currentYear);
          const result = response?.data || {};
          setLastOperation({ type: 'finalize', result });
          message.success(`Payroll finalized. Locked: ${result.locked ? 'Yes' : 'No'}`);
          broadcastDataRefresh('payroll');
          await loadStatus();
        } catch (error) {
          message.error(error?.message || 'Payroll finalization failed');
        } finally {
          setFinalizing(false);
        }
      },
    });
  };

  const handleExport = async () => {
    try {
      await payrollAPI.downloadPayrollExport({ month: currentMonth, year: currentYear });
      message.success('Payroll CSV exported');
    } catch (error) {
      message.error(error?.message || 'Payroll export failed');
    }
  };

  const summary = statusData?.summary || {};
  const breakdown = Array.isArray(statusData?.breakdown) ? statusData.breakdown : [];
  const isLocked = !!statusData?.locked;
  const canFinalize = !isLocked && Number(summary.total || 0) > 0 &&
    Number(summary.withPayslips || 0) >= Number(summary.total || 0);

  const totalEmployees = Number(summary.total || 0);
  const totalGenerated = Number(summary.generated || 0);
  const totalWithPayslips = Number(summary.withPayslips || 0);

  const kpiCards = [
    {
      label: 'Lock Status',
      value: isLocked ? 'Locked' : 'Open',
      sub: isLocked ? 'Month is locked' : 'Ready for processing',
      icon: isLocked ? Lock : Unlock,
      iconColor: isLocked ? '#78350F' : '#fff',
      iconBg: isLocked ? '#FDE68A' : BTN_GRADIENT,
      valueColor: isLocked ? '#78350F' : C.primary,
    },
    {
      label: 'Total Employees',
      value: totalEmployees,
      sub: 'In payroll system',
      icon: Users,
      iconColor: '#fff',
      iconBg: C.blue50,
      valueColor: '#00115b',
      iconTint: C.primary,
    },
    {
      label: 'Generated',
      value: `${totalGenerated}/${totalEmployees}`,
      sub: 'With payslips',
      icon: FileCheck,
      iconColor: '#fff',
      iconBg: C.blue50,
      valueColor: '#00115b',
      iconTint: C.primary,
    },
    {
      label: 'With Payslips',
      value: `${totalWithPayslips}/${totalEmployees}`,
      sub: 'Payslips generated',
      icon: FileCog,
      iconColor: '#10B981',
      iconBg: '#DCFCE7',
      valueColor: '#00115b',
    },
  ];

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <nav style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 14, color: C.textTertiary }}>
              <Link to="/dashboard" style={{ color: C.textTertiary, textDecoration: 'none' }}>Dashboard</Link>
              <ChevronRight size={14} color={C.borderLight} />
              <span style={{ color: C.primary, fontWeight: 400 }}>Payroll</span>
            </nav>
            <Title level={2} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.02em', color: '#00115b', fontSize: 24, lineHeight: '32px' }}>
              Payroll Processing
            </Title>
            <Text style={{ color: C.textTertiary, fontSize: 14, lineHeight: '20px' }}>
              Upload payroll, generate payslips, finalize month, and export reports
            </Text>
          </div>

          <Space size={8} style={{ flexWrap: 'wrap' }}>
            <Select
              value={currentMonth}
              onChange={setCurrentMonth}
              style={{ width: isMobile ? 140 : 130, borderRadius: 12 }}
              options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: getMonthName(i + 1) }))}
            />
            <Select
              value={currentYear}
              onChange={setCurrentYear}
              style={{ width: 90, borderRadius: 12 }}
              options={Array.from({ length: 5 }, (_, i) => {
                const y = new Date().getFullYear() - i;
                return { value: y, label: String(y) };
              })}
            />
          </Space>
        </div>

        {/* ── KPI Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16 }}>
          {kpiCards.map(({ label, value, sub, icon: Icon, iconColor, iconBg, iconTint, valueColor }) => (
            <Card key={label} style={{ padding: '20px', opacity: loadingStatus ? 0.6 : 1, transition: 'opacity 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Text style={{ fontSize: 12, color: C.textTertiary, display: 'block', marginBottom: 6 }}>{label}</Text>
                  <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: valueColor, marginBottom: 4 }}>{value}</div>
                  <Text style={{ fontSize: 12, color: C.textTertiary }}>{sub}</Text>
                </div>
                <IconBox bg={iconBg} size={32} radius={12}>
                  <Icon size={16} color={iconTint || iconColor} strokeWidth={2} />
                </IconBox>
              </div>
            </Card>
          ))}
        </div>

        {/* ── Main two-column layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 307px', gap: 20, alignItems: 'start' }}>

          {/* ── LEFT: Export + Upload CSV ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Export CSV card */}
            <Card>
              <div style={{ padding: '20px 20px 16px' }}>
                <SectionLabel>Download payroll data</SectionLabel>
                <SectionTitle>Export CSV</SectionTitle>
              </div>
              <div style={{ padding: '0 20px 20px' }}>
                <Button
                  onClick={handleExport}
                  style={{
                    height: 38, borderRadius: 12, border: `1.5px solid ${C.primary}`,
                    background: '#fff', color: C.primary,
                    fontWeight: 700, fontSize: 12,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '0 20px',
                  }}
                  icon={<Download size={14} color={C.primary} />}
                >
                  Export Payroll CSV
                </Button>
              </div>
            </Card>

            {/* Upload CSV card — drag-and-drop focal area */}
            <Card>
              <div style={{ padding: '20px 20px 0' }}>
                <SectionLabel>Import payroll data</SectionLabel>
                <SectionTitle>Upload CSV</SectionTitle>
              </div>

              {/* Drop zone */}
              <div style={{ padding: '0 20px 20px' }}>
                <Dragger
                  accept=".csv"
                  multiple={false}
                  beforeUpload={(file) => { setSelectedFile(file); return false; }}
                  onRemove={() => setSelectedFile(null)}
                  fileList={selectedFile ? [selectedFile] : []}
                  style={{ borderRadius: 12, background: 'transparent', border: `1.5px dashed ${C.borders}` }}
                  disabled={isLocked}
                >
                  <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <IconBox bg={C.blue50} size={64} radius={32}>
                      <UploadCloud size={28} color={C.primary} />
                    </IconBox>
                    <div>
                      <Text style={{ fontSize: 14, fontWeight: 700, color: '#00115b', display: 'block', textAlign: 'center' }}>
                        Click or drag payroll CSV here
                      </Text>
                      <Text style={{ fontSize: 12, color: '#9CA3AF', display: 'block', textAlign: 'center', marginTop: 4 }}>
                        Drag and drop your CSV file or click to browse
                      </Text>
                    </div>
                  </div>
                </Dragger>

                {/* Action buttons row */}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <Button
                    type="primary"
                    loading={uploadingCsv}
                    disabled={!selectedFile || isLocked}
                    onClick={handleUploadCsv}
                    style={{
                      height: 32, borderRadius: 8,
                      background: BTN_GRADIENT, border: 'none',
                      fontWeight: 700, fontSize: 12, padding: '0 16px',
                    }}
                  >
                    Upload Payroll CSV
                  </Button>
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'detailed',
                          label: 'Detailed Template (with salary breakdown)',
                          icon: <FileSpreadsheet size={13} />,
                          onClick: () => downloadTemplate('detailed'),
                        },
                        {
                          key: 'basic',
                          label: 'Basic Template (auto-calculate components)',
                          icon: <Download size={13} />,
                          onClick: () => downloadTemplate('basic'),
                        },
                      ],
                    }}
                    trigger={['click']}
                  >
                    <Button
                      style={{
                        height: 32, borderRadius: 8,
                        background: C.blue50, border: 'none',
                        color: C.primary, fontWeight: 700, fontSize: 12,
                        padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <FileSpreadsheet size={13} />
                      Download Template
                    </Button>
                  </Dropdown>
                </div>

                {/* Info box */}
                <div style={{
                  marginTop: 12, padding: '10px 14px',
                  background: '#EFF6FF', border: '1px solid #BFDBFE',
                  borderRadius: 12,
                }}>
                  <Text style={{ fontSize: 12, fontWeight: 600, color: '#00115b', display: 'block', marginBottom: 4 }}>
                    Salary Breakdown (Indian Govt. Policy)
                  </Text>
                  <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
                    <div><b>Earnings:</b> Basic (40-50% of Gross) · HRA (40-50% of Basic) · Conveyance (≤₹1,600) · Medical (≤₹1,250) · Special Allowance</div>
                    <div><b>Deductions:</b> EPF Employee (12% of Basic, max ₹1,800) · ESIC (0.75% if Gross ≤ ₹21,000) · Professional Tax · TDS</div>
                    <div style={{ marginTop: 4 }}>
                      Use <b>Detailed Template</b> to specify all components, or <b>Basic Template</b> for auto-calculation.{' '}
                      <button
                        onClick={() => setManualOpen(true)}
                        style={{ background: 'none', border: 'none', color: C.primary, cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: 0, textDecoration: 'underline' }}
                      >
                        Manual JSON upload
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Last operation result */}
            {lastOperation && (
              <Card style={{ padding: '20px 20px' }}>
                <Text strong style={{ fontSize: 14, color: '#00115b' }}>
                  Last Operation:{' '}
                  <span style={{ color: C.primary, textTransform: 'capitalize' }}>
                    {lastOperation.type.replace('-', ' ')}
                  </span>
                </Text>
                <div style={{ marginTop: 14, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {[
                    ['Month', lastOperation.result?.month],
                    ['Year', lastOperation.result?.year],
                    ['Status', String(lastOperation.result?.status || '-').replace(/_/g, ' ')],
                    ['Total Rows', lastOperation.result?.totalRows],
                    ['Processed', lastOperation.result?.processed],
                    ['Generated', lastOperation.result?.generated],
                    ['Failed', lastOperation.result?.failed],
                  ].filter(([, v]) => v !== undefined && v !== null).map(([label, val]) => (
                    <div key={label}>
                      <Text style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: C.textTertiary, display: 'block' }}>
                        {label}
                      </Text>
                      <Text strong style={{ fontSize: 15, color: '#00115b', textTransform: 'capitalize' }}>
                        {String(val ?? '—')}
                      </Text>
                    </div>
                  ))}
                </div>
                {Array.isArray(lastOperation.result?.errors) && lastOperation.result.errors.length > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                    <Text style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                      {lastOperation.result.errors.length} error(s):
                    </Text>
                    <div style={{ marginTop: 4, maxHeight: 100, overflowY: 'auto' }}>
                      {lastOperation.result.errors.map((err, i) => (
                        <div key={i} style={{ fontSize: 12, color: '#78350F' }}>
                          • {typeof err === 'string' ? err : JSON.stringify(err)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* ── RIGHT: Status breakdown + actions + status banner ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Status breakdown */}
            <Card>
              <div style={{ padding: '20px 20px 12px' }}>
                <Text style={{ fontSize: 12, color: C.textTertiary, display: 'block', marginBottom: 2 }}>
                  Current processing status
                </Text>
                <Text strong style={{ fontSize: 14, color: '#00115b' }}>Status Breakdown</Text>
              </div>

              <div style={{ padding: '0 20px 8px' }}>
                {(breakdown.length > 0 ? breakdown : ['draft', 'generated', 'finalized'].map(s => ({ status: s, count: null })))
                  .map((row) => {
                    const key = String(row.status || '').toLowerCase();
                    const color = STATUS_COLORS[key] || C.textTertiary;
                    const isEmpty = row.count === null;
                    return (
                      <div key={key} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 0',
                        borderBottom: `1px solid ${C.borders}`,
                        opacity: isEmpty ? (loadingStatus ? 0.4 : 0.35) : 1,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {key === 'finalized'
                            ? <CheckCircle size={14} color={color} />
                            : <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                          }
                          <Text style={{ fontSize: 13, color: C.textPrimary, textTransform: 'capitalize' }}>{key}</Text>
                        </div>
                        <Text strong style={{ fontSize: 13, color: '#00115b' }}>
                          {isEmpty ? '—' : Number(row.count || 0)}
                        </Text>
                      </div>
                    );
                  })}
              </div>

              {/* Generate + Finalize buttons */}
              <div style={{ padding: '14px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Button
                  type="primary"
                  icon={<FileCheck size={14} />}
                  onClick={handleGenerate}
                  loading={generating}
                  disabled={isLocked || Number(summary.total || 0) === 0}
                  style={{
                    width: '100%', height: 38, borderRadius: 8,
                    background: BTN_GRADIENT, border: 'none',
                    fontWeight: 700, fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  Generate Payslips
                </Button>
                <Button
                  icon={<Lock size={14} />}
                  onClick={handleFinalize}
                  loading={finalizing}
                  disabled={!canFinalize}
                  style={{
                    width: '100%', height: 38, borderRadius: 8,
                    border: `1px solid ${C.borders}`,
                    color: C.textSecondary, fontWeight: 600, fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  Finalize Month
                </Button>
              </div>
            </Card>

            {/* Status alert banner */}
            <div style={{
              borderRadius: 12,
              border: `1px solid ${isLocked ? '#86EFAC' : '#FDE68A'}`,
              background: isLocked ? '#DCFCE7' : '#FEF3E2',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}>
              {isLocked
                ? <CheckCircle size={16} color="#10B981" style={{ flexShrink: 0, marginTop: 1 }} />
                : <AlertCircle size={16} color="#92400E" style={{ flexShrink: 0, marginTop: 1 }} />
              }
              <div>
                <Text strong style={{ fontSize: 12, color: isLocked ? '#065F46' : '#92400E', display: 'block', marginBottom: 3 }}>
                  {isLocked ? 'Month is finalized and locked' : 'Month is open for payroll processing'}
                </Text>
                <Text style={{ fontSize: 12, color: isLocked ? '#047857' : '#78350F', lineHeight: 1.6 }}>
                  {isLocked
                    ? 'No further changes can be made for this period.'
                    : 'Complete all payroll entries and generate payslips before finalizing the month. Once finalized, no changes can be made.'
                  }
                </Text>
              </div>
            </div>
          </div>
        </div>

        {/* ── Employee Salary Slips ── */}
        {(() => {
          const employees = Array.isArray(statusData?.employees) ? statusData.employees : [];
          if (employees.length === 0) return null;
          const handleSlipDownload = async (url, name) => {
            try {
              const response = await fetch(url, { mode: 'cors' });
              const blob = await response.blob();
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `payslip-${name}-${currentYear}-${currentMonth}.pdf`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(a.href);
            } catch {
              window.open(url, '_blank', 'noopener,noreferrer');
            }
          };
          return (
            <Card style={{ marginTop: 16 }}>
              <div style={{ padding: '20px 20px 12px' }}>
                <SectionLabel>Employee salary slips</SectionLabel>
                <SectionTitle>Payslips</SectionTitle>
              </div>

              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr auto' : '2fr 1.2fr 1fr 1fr 0.8fr auto',
                padding: '8px 20px',
                gap: 12,
                borderBottom: `1px solid ${C.borders}`,
              }}>
                {(isMobile ? ['Employee', ''] : ['Employee', 'Department', 'Gross', 'Net', 'Status', '']).map(h => (
                  <Text key={h} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary }}>{h}</Text>
                ))}
              </div>

              {/* Rows */}
              {employees.map((emp, idx) => {
                const hasSlip = !!emp.payslipUrl;
                const statusColor = STATUS_COLORS[String(emp.status || '').toLowerCase()] || C.textTertiary;
                const name = [emp.firstName, emp.lastName].filter(Boolean).join(' ');
                return (
                  <div key={emp.payrollId || idx} style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr auto' : '2fr 1.2fr 1fr 1fr 0.8fr auto',
                    padding: '12px 20px',
                    gap: 12,
                    alignItems: 'center',
                    borderBottom: idx < employees.length - 1 ? `1px solid ${C.borders}` : 'none',
                  }}>
                    <div>
                      <Text style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, display: 'block' }}>{name}</Text>
                      <Text style={{ fontSize: 11, color: C.textTertiary }}>{emp.employeeCode}</Text>
                    </div>
                    {!isMobile && <Text style={{ fontSize: 13, color: C.textSecondary }}>{emp.department || '—'}</Text>}
                    {!isMobile && <Text style={{ fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>{emp.gross != null ? `₹${Number(emp.gross).toLocaleString('en-IN')}` : '—'}</Text>}
                    {!isMobile && <Text style={{ fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>{emp.net != null ? `₹${Number(emp.net).toLocaleString('en-IN')}` : '—'}</Text>}
                    {!isMobile && (
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        textTransform: 'capitalize', color: statusColor,
                        background: statusColor === '#10B981' ? '#ECFDF5' : statusColor === C.primary ? '#EFF6FF' : '#F3F4F6',
                        border: `1px solid ${statusColor}33`,
                      }}>
                        {emp.status}
                      </span>
                    )}
                    <Button
                      size="small"
                      icon={<Download size={14} />}
                      disabled={!hasSlip}
                      onClick={() => handleSlipDownload(emp.payslipUrl, emp.employeeCode)}
                      style={{
                        borderRadius: 8, border: `1px solid ${hasSlip ? C.primary : C.borders}`,
                        color: hasSlip ? C.primary : C.textTertiary, fontWeight: 600, fontSize: 12,
                      }}
                    >
                      {isMobile ? '' : 'Download'}
                    </Button>
                  </div>
                );
              })}
            </Card>
          );
        })()}
      </div>

      {/* ── Manual Upload Modal ── */}
      <Modal
        title="Manual Payroll Upload"
        open={manualOpen}
        onCancel={() => setManualOpen(false)}
        width={isMobile ? '100%' : 760}
        style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw', padding: 0 } : {}}
        centered={!isMobile}
        destroyOnClose
        maskClosable={false}
        zIndex={1400}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setManualOpen(false)}>Cancel</Button>
            <Button
              onClick={handleUploadRows}
              loading={uploadingRows}
              style={{ background: BTN_GRADIENT, color: '#fff', border: 'none', fontWeight: 600 }}
            >
              Upload Rows
            </Button>
          </div>
        }
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Month: <Text strong>{currentMonth}</Text>, Year: <Text strong>{currentYear}</Text>
          </Text>
          <TextArea
            rows={14}
            value={manualRows}
            onChange={(e) => setManualRows(e.target.value)}
            style={{ fontFamily: 'Consolas, monospace' }}
          />
        </Space>
      </Modal>
    </Layout>
  );
}
