import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ENV } from '@/lib/env';
import {
  Button,
  Card,
  Input,
  InputNumber,
  Select,
  Checkbox,
  Radio,
  DatePicker,
  Typography,
  message,
  Spin,
  Alert,
  Space,
  Result,
  ConfigProvider,
} from 'antd';
import { CheckCircle2, ClipboardList, AlertCircle } from 'lucide-react';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const API_VERSION = ENV.API_VERSION;
const API_BASE = `/api/${API_VERSION}`;

// -- Design system constants (mirrors App.tsx) --
const COLORS = {
  primary: '#1268ff',
  appBackground: '#f5f5f5',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  success: '#10b981',
  dangerText: '#ff4d4f',
};

// -- Types --

interface FormFieldOption {
  label: string;
  value: string;
}

interface FormField {
  id?: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  isRequired?: boolean;
  position?: number;
  placeholder?: string;
  helperText?: string;
  options?: FormFieldOption[];
}

interface PublicFormData {
  id: string;
  name: string;
  description?: string;
  fields: FormField[];
  status: string;
}

// -- Component --

export function PublicFormPage() {
  const { formId } = useParams<{ formId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [form, setForm] = useState<PublicFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fetch public form metadata
  useEffect(() => {
    if (!formId) {
      setError('No form ID provided.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = `${API_BASE}/forms/${formId}/public${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 403) throw new Error('Invalid or expired access token.');
          if (res.status === 404) throw new Error('This form does not exist or is no longer accepting responses.');
          throw new Error('Unable to load the form. Please try again later.');
        }
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const data: PublicFormData = json.data || json;
        // Sort fields by position if available
        if (data.fields) {
          data.fields.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        }
        setForm(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load form.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formId, token]);

  // Field value setter
  const setValue = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear field error when user starts typing
    setFieldErrors((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev;
    });
  }, []);

  // Client-side validation
  const validate = useCallback((): boolean => {
    if (!form) return false;

    const errors: Record<string, string> = {};

    for (const field of form.fields) {
      const val = values[field.fieldKey];
      const isEmpty =
        val === undefined ||
        val === null ||
        val === '' ||
        (typeof val === 'string' && val.trim().length === 0) ||
        (Array.isArray(val) && val.length === 0);

      if (field.isRequired && isEmpty) {
        errors[field.fieldKey] = `${field.label} is required`;
        continue;
      }

      if (isEmpty) continue;

      // Type-specific validations
      if (field.fieldType === 'email' && typeof val === 'string') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          errors[field.fieldKey] = 'Please enter a valid email address';
        }
      }
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      message.error('Please fix the highlighted errors before submitting.');
      return false;
    }

    return true;
  }, [form, values]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!formId || !form) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/forms/${formId}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-form-token': token } : {}),
        },
        body: JSON.stringify({ payload: values }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const serverMessage =
          data?.error?.message || data?.message || 'Submission failed. Please try again.';
        throw new Error(serverMessage);
      }

      setSubmitted(true);
      message.success('Form submitted successfully!');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit form.';
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [formId, form, token, values, validate]);

  // Reset form for another submission
  const handleReset = useCallback(() => {
    setSubmitted(false);
    setValues({});
    setFieldErrors({});
  }, []);

  // Render individual field input
  const renderField = (field: FormField) => {
    const val = values[field.fieldKey];
    const hasError = !!fieldErrors[field.fieldKey];
    const status = hasError ? 'error' as const : undefined;

    const basePlaceholder = field.placeholder || `Enter ${field.label.toLowerCase()}`;

    switch (field.fieldType) {
      case 'textarea':
        return (
          <TextArea
            placeholder={basePlaceholder}
            rows={4}
            value={(val as string) || ''}
            onChange={(e) => setValue(field.fieldKey, e.target.value)}
            status={status}
            style={{ width: '100%' }}
          />
        );

      case 'number':
        return (
          <InputNumber
            placeholder={basePlaceholder}
            value={val as number | undefined}
            onChange={(v) => setValue(field.fieldKey, v)}
            status={status}
            style={{ width: '100%' }}
          />
        );

      case 'email':
        return (
          <Input
            placeholder={basePlaceholder}
            type="email"
            value={(val as string) || ''}
            onChange={(e) => setValue(field.fieldKey, e.target.value)}
            status={status}
            style={{ width: '100%' }}
          />
        );

      case 'select':
        // Fall back to text input when no options are defined
        if (!field.options || field.options.length === 0) {
          return (
            <Input
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              value={(val as string) || ''}
              onChange={(e) => setValue(field.fieldKey, e.target.value)}
              status={status}
              style={{ width: '100%' }}
            />
          );
        }
        return (
          <Select
            placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`}
            value={(val as string) || undefined}
            onChange={(v) => setValue(field.fieldKey, v)}
            allowClear
            status={status}
            style={{ width: '100%' }}
          >
            {field.options.map((opt) => (
              <Select.Option key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Option>
            ))}
          </Select>
        );

      case 'multiselect':
        // Fall back to text input when no options are defined
        if (!field.options || field.options.length === 0) {
          return (
            <Input
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()} (comma-separated)`}
              value={(val as string) || ''}
              onChange={(e) => setValue(field.fieldKey, e.target.value)}
              status={status}
              style={{ width: '100%' }}
            />
          );
        }
        return (
          <Select
            placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`}
            mode="multiple"
            value={(val as string[]) || []}
            onChange={(v) => setValue(field.fieldKey, v)}
            status={status}
            style={{ width: '100%' }}
          >
            {field.options.map((opt) => (
              <Select.Option key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Option>
            ))}
          </Select>
        );

      case 'checkbox':
        return (
          <Checkbox
            checked={!!val}
            onChange={(e) => setValue(field.fieldKey, e.target.checked)}
          >
            {field.placeholder || field.label}
          </Checkbox>
        );

      case 'radio':
        // Fall back to text input when no options are defined
        if (!field.options || field.options.length === 0) {
          return (
            <Input
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              value={(val as string) || ''}
              onChange={(e) => setValue(field.fieldKey, e.target.value)}
              status={status}
              style={{ width: '100%' }}
            />
          );
        }
        return (
          <Radio.Group
            value={val}
            onChange={(e) => setValue(field.fieldKey, e.target.value)}
          >
            <Space direction="vertical">
              {field.options.map((opt) => (
                <Radio key={opt.value} value={opt.value}>
                  {opt.label}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        );

      case 'date':
        return (
          <DatePicker
            placeholder={field.placeholder || 'Select date'}
            value={val ? dayjs(val as string) : null}
            onChange={(_date, dateString) =>
              setValue(field.fieldKey, dateString || null)
            }
            status={status}
            style={{ width: '100%' }}
          />
        );

      case 'datetime':
        return (
          <DatePicker
            showTime
            placeholder={field.placeholder || 'Select date and time'}
            value={val ? dayjs(val as string) : null}
            onChange={(_date, dateString) =>
              setValue(field.fieldKey, dateString || null)
            }
            status={status}
            style={{ width: '100%' }}
          />
        );

      // Default: treat as text
      default:
        return (
          <Input
            placeholder={basePlaceholder}
            value={(val as string) || ''}
            onChange={(e) => setValue(field.fieldKey, e.target.value)}
            status={status}
            style={{ width: '100%' }}
          />
        );
    }
  };

  // -- Render states --

  // Loading state
  if (loading) {
    return (
      <div style={styles.centeredContainer}>
        <Spin size="large" tip="Loading form..." />
      </div>
    );
  }

  // Error state
  if (error || !form) {
    return (
      <div style={styles.centeredContainer}>
        <Card style={styles.statusCard}>
          <Result
            icon={<AlertCircle size={48} color={COLORS.dangerText} />}
            title="Unable to load form"
            subTitle={error || 'This form does not exist or is no longer accepting responses.'}
          />
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div style={styles.centeredContainer}>
        <Card style={styles.statusCard}>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle2
              size={56}
              color={COLORS.success}
              style={{ marginBottom: 16 }}
            />
            <Title level={3} style={{ marginBottom: 8 }}>
              Thank you!
            </Title>
            <Paragraph
              type="secondary"
              style={{ marginBottom: 24, fontSize: 15 }}
            >
              Your response has been recorded successfully.
            </Paragraph>
            <Button type="primary" size="large" onClick={handleReset}>
              Submit another response
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Form state
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: COLORS.primary,
          borderRadius: 8,
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
        components: {
          Button: { borderRadius: 8, fontWeight: 600, controlHeight: 44 },
          Input: { borderRadius: 8, controlHeight: 40 },
          Select: { borderRadius: 8, controlHeight: 40 },
          DatePicker: { borderRadius: 8, controlHeight: 40 },
        },
      }}
    >
      <div style={styles.pageWrapper}>
        <div style={styles.formContainer}>
          <Card
            style={{ borderRadius: 12, overflow: 'hidden' }}
            styles={{ body: { padding: 0 } }}
          >
            {/* Form header */}
            <div style={styles.formHeader}>
              <Space align="start" size={10} style={{ marginBottom: 4 }}>
                <ClipboardList
                  size={22}
                  color={COLORS.primary}
                  style={{ marginTop: 4 }}
                />
                <Title level={3} style={{ margin: 0 }}>
                  {form.name}
                </Title>
              </Space>
              {form.description && (
                <Paragraph
                  type="secondary"
                  style={{ margin: '8px 0 0', fontSize: 14 }}
                >
                  {form.description}
                </Paragraph>
              )}
            </div>

            {/* Form fields */}
            <div style={styles.fieldsContainer}>
              {form.fields.length === 0 && (
                <Alert
                  type="info"
                  message="This form has no fields configured."
                  showIcon
                />
              )}

              {form.fields.map((field) => (
                <div key={field.fieldKey} style={styles.fieldWrapper}>
                  {/* Label row (skip for checkbox, it has inline label) */}
                  {field.fieldType !== 'checkbox' && (
                    <div style={{ marginBottom: 6 }}>
                      <Text strong style={{ fontSize: 14 }}>
                        {field.label}
                      </Text>
                      {field.isRequired && (
                        <Text style={{ color: COLORS.dangerText }}> *</Text>
                      )}
                    </div>
                  )}

                  {/* Help text */}
                  {field.helperText && (
                    <Text
                      type="secondary"
                      style={{
                        fontSize: 12,
                        display: 'block',
                        marginBottom: 6,
                        lineHeight: '18px',
                      }}
                    >
                      {field.helperText}
                    </Text>
                  )}

                  {/* For checkbox: show required indicator before the control */}
                  {field.fieldType === 'checkbox' && field.isRequired && (
                    <Text
                      type="secondary"
                      style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
                    >
                      <Text style={{ color: COLORS.dangerText }}>*</Text>{' '}
                      Required
                    </Text>
                  )}

                  {/* Field input */}
                  {renderField(field)}

                  {/* Inline error */}
                  {fieldErrors[field.fieldKey] && (
                    <Text
                      style={{
                        color: COLORS.dangerText,
                        fontSize: 12,
                        display: 'block',
                        marginTop: 4,
                      }}
                    >
                      {fieldErrors[field.fieldKey]}
                    </Text>
                  )}
                </div>
              ))}

              {/* Submit button */}
              {form.fields.length > 0 && (
                <Button
                  type="primary"
                  size="large"
                  block
                  loading={submitting}
                  onClick={handleSubmit}
                  style={{
                    marginTop: 12,
                    height: 46,
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 15,
                    backgroundColor: COLORS.primary,
                  }}
                >
                  Submit
                </Button>
              )}
            </div>
          </Card>

          {/* Footer */}
          <div style={styles.footer}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Never submit passwords or sensitive information through this form.
            </Text>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}

// -- Styles --

const styles: Record<string, React.CSSProperties> = {
  centeredContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: COLORS.appBackground,
    padding: '24px 16px',
  },
  statusCard: {
    maxWidth: 500,
    width: '100%',
    borderRadius: 12,
  },
  pageWrapper: {
    minHeight: '100vh',
    background: COLORS.appBackground,
    padding: '48px 16px 64px',
  },
  formContainer: {
    maxWidth: 640,
    margin: '0 auto',
  },
  formHeader: {
    borderBottom: `3px solid ${COLORS.primary}`,
    padding: '28px 28px 20px',
    background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
  },
  fieldsContainer: {
    padding: '24px 28px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
  },
  fieldWrapper: {
    // individual field spacing handled by gap on parent
  },
  footer: {
    textAlign: 'center' as const,
    padding: '16px 0',
  },
};

export default PublicFormPage;
