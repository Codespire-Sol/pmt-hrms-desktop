import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Typography,
  Space,
  Button,
  Select,
  Row,
  Col,
  Statistic,
  Tag,
  Breadcrumb,
  Empty,
  Skeleton,
  Divider,
  Modal,
  message,
} from 'antd';
import { Download, Eye, FileText, Wallet } from 'lucide-react';
import dayjs from 'dayjs';
import { payrollAPI } from '../api/payroll';
import Layout from '../components/layout/Layout';
import { themeTokens } from '../styles/theme';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useAuthStore } from '../store/authStore';

const { Title, Text } = Typography;

const COMPANY_ADDRESS = '25th Floor, Gold Tower, Wave One, 2514, Sector 18, Noida, Uttar Pradesh 201301';

export default function Payroll() {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [payrollRow, setPayrollRow] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerSrc, setViewerSrc] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadPayroll();
  }, [selectedMonth, selectedYear]);

  useAutoRefresh(loadPayroll, {
    enabled: true,
    scope: 'payroll',
    intervalMs: 120000,
    deps: [selectedMonth, selectedYear],
  });

  async function loadPayroll() {
    setLoading(true);
    try {
      const response = await payrollAPI.getEmployeePayroll({
        month: selectedMonth,
        year: selectedYear,
      });
      setPayrollRow(response?.row || response?.data?.[0] || null);
    } catch (error) {
      console.error('Failed to load payroll:', error);
      setPayrollRow(null);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(Number(amount || 0));

  const getMonthName = (month) =>
    new Date(2000, Math.max(0, Number(month || 1) - 1)).toLocaleString('default', { month: 'long' });

  const normalizedStatus = String(payrollRow?.status || 'draft').toLowerCase();
  const payslipUrl = payrollRow?.payslipUrl || payrollRow?.payslipURL || null;

  const handleDownloadPayslip = async () => {
    if (!payslipUrl) {
      message.warning('Payslip is not available for download yet.');
      return;
    }

    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(payslipUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error('Failed to fetch payslip');
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `payslip-${selectedYear}-${selectedMonth}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objectUrl);
      message.success('Payslip downloaded');
    } catch (error) {
      window.open(payslipUrl, '_blank', 'noopener,noreferrer');
      message.info('Opened payslip in a new tab (direct download was blocked by browser/CORS).');
    }
  };

  const handleOpenViewer = async () => {
    if (!payslipUrl) {
      message.warning('Payslip PDF is not available for this month.');
      return;
    }
    setViewerOpen(true);
    setViewerLoading(true);
    try {
      const token = useAuthStore.getState().token;
      const response = await fetch(payslipUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error('Unable to load PDF blob');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      setViewerSrc(blobUrl);
    } catch {
      // Fallback to direct URL when signed/public URL is provided.
      setViewerSrc(payslipUrl);
    } finally {
      setViewerLoading(false);
    }
  };

  const closeViewer = () => {
    if (viewerSrc && String(viewerSrc).startsWith('blob:')) {
      window.URL.revokeObjectURL(viewerSrc);
    }
    setViewerSrc(null);
    setViewerOpen(false);
  };

  return (
    <Layout>
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
          <div>
            <Breadcrumb items={[{ title: <Link to="/dashboard">Dashboard</Link> }, { title: 'My Payslip' }]} style={{ marginBottom: '8px' }} />
            <Title level={isMobile ? 3 : 2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: '#1E2875' }}>Payroll & Payslip</Title>
            <Text type="secondary">View and download your monthly payslip.</Text>
          </div>
          <Space style={{ flexWrap: 'wrap' }}>
            <Select
              size="large"
              value={selectedMonth}
              onChange={setSelectedMonth}
              style={{ width: isMobile ? '100%' : 150, minWidth: 120 }}
              options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: getMonthName(i + 1) }))}
            />
            <Select
              size="large"
              value={selectedYear}
              onChange={setSelectedYear}
              style={{ width: isMobile ? 120 : 120 }}
              options={Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return { value: year, label: String(year) };
              })}
            />
          </Space>
        </div>

        {loading ? (
          <Card style={{ borderRadius: 16 }}><Skeleton active paragraph={{ rows: 6 }} /></Card>
        ) : !payrollRow ? (
          <Card style={{ borderRadius: 16, textAlign: 'center', padding: '60px 0' }}>
            <Empty description={`No payroll found for ${getMonthName(selectedMonth)} ${selectedYear}`} />
          </Card>
        ) : (
          <Card style={{ borderRadius: 16, border: 'none', boxShadow: themeTokens.shadows.standard }}>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={14}>
                <Space size="middle">
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background: '#f0f3ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Wallet size={26} color={themeTokens.colors.primary} />
                  </div>
                  <div>
                    <Title level={4} style={{ margin: 0 }}>
                      {getMonthName(payrollRow.month)} {payrollRow.year}
                    </Title>
                    <Tag color={normalizedStatus === 'finalized' ? 'success' : (normalizedStatus === 'generated' ? 'processing' : 'warning')}>
                      {normalizedStatus.toUpperCase()}
                    </Tag>
                  </div>
                </Space>
              </Col>
              <Col xs={24} md={10} style={{ textAlign: 'right' }}>
                <Space>
                  <Button
                    icon={<Eye size={16} />}
                    onClick={handleOpenViewer}
                    disabled={!payslipUrl}
                  >
                    View Payslip
                  </Button>
                  <Button
                    type="primary"
                    icon={<Download size={16} />}
                    onClick={handleDownloadPayslip}
                    disabled={!payslipUrl}
                  >
                    Download
                  </Button>
                </Space>
              </Col>
            </Row>

            <Divider />

            <Row gutter={[16, 16]}>
              {[
                { label: 'GROSS PAY', value: formatCurrency(Number(payrollRow.gross || 0)) },
                { label: 'DEDUCTIONS', value: formatCurrency(Number(payrollRow.deductions || 0)) },
                { label: 'NET PAY', value: formatCurrency(Number(payrollRow.net || 0)) },
              ].map(({ label, value }) => (
                <Col xs={24} sm={8} key={label}>
                  <div style={{
                    background: themeTokens.colors.appBackground,
                    borderRadius: 12,
                    border: `1px solid ${themeTokens.colors.borders}`,
                    padding: '14px 16px',
                  }}>
                    <Text style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.7px', color: themeTokens.colors.textTertiary, display: 'block',
                    }}>{label}</Text>
                    <Title level={4} style={{
                      margin: '4px 0 0', fontWeight: 700,
                      color: label === 'NET PAY' ? themeTokens.colors.success : themeTokens.colors.heading,
                    }}>{value}</Title>
                  </div>
                </Col>
              ))}
            </Row>

            <div style={{ marginTop: 18 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {payrollRow.generatedAt ? `Generated: ${dayjs(payrollRow.generatedAt).format('DD MMM YYYY, hh:mm A')}` : 'Payslip not generated yet'}
                {payrollRow.finalizedAt ? ` | Finalized: ${dayjs(payrollRow.finalizedAt).format('DD MMM YYYY, hh:mm A')}` : ''}
              </Text>
            </div>
          </Card>
        )}
      </Space>

      <Modal
        title={<Space><FileText size={16} /> Payslip Preview</Space>}
        open={viewerOpen}
        onCancel={closeViewer}
        footer={null}
        width={isMobile ? '100%' : 960}
        style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw', padding: 0 } : {}}
        centered={!isMobile}
        destroyOnClose
        maskClosable={false}
        zIndex={1400}
      >
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10
          }}>
            <Space size="middle">
              <img src="/Logo.png" alt="Company Logo" style={{ height: 28, width: 'auto' }} />
              <div>
                <Text strong style={{ display: 'block' }}>CodeSpire HRMS</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{COMPANY_ADDRESS}</Text>
              </div>
            </Space>
            <Button size="small" icon={<Download size={14} />} onClick={handleDownloadPayslip} disabled={!payslipUrl}>
              Download
            </Button>
          </div>

          {viewerLoading ? (
            <div style={{ padding: 30, textAlign: 'center' }}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </div>
          ) : viewerSrc ? (
            <iframe
              src={viewerSrc}
              title="Payslip PDF Viewer"
              style={{ width: '100%', height: '72vh', border: 0 }}
            />
          ) : (
            <div style={{ padding: 30, textAlign: 'center' }}>
              <Empty description="Payslip PDF is not available for this month." />
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  );
}
