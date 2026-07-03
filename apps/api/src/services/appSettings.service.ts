import crypto from 'crypto';
import { prisma } from '../database/prisma';
import { config } from '../config';

/**
 * App-configuration settings stored in the `system_settings` table and editable
 * from the admin Settings page — SMTP (email), company info, and attendance rules.
 * Each getter falls back to the corresponding environment variable so a fresh
 * install works before anything is configured. Secrets (SMTP password) are
 * encrypted at rest with a key derived from JWT_SECRET.
 */

const ENC_KEY = crypto.createHash('sha256').update(config.jwt.secret).digest(); // 32 bytes

function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:' + Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith('enc:')) return stored; // legacy plaintext
  try {
    const raw = Buffer.from(stored.slice(4), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

async function readKey<T>(key: string): Promise<T | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ setting_value: unknown }>>(
    `SELECT setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1`,
    key,
  );
  return (rows[0]?.setting_value as T) ?? null;
}

async function writeKey(key: string, value: unknown, updatedBy?: string | null): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO system_settings (setting_key, setting_value, updated_by, created_at, updated_at)
     VALUES ($1, $2::jsonb, $3, NOW(), NOW())
     ON CONFLICT (setting_key) DO UPDATE
       SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    key, JSON.stringify(value), updatedBy ?? null,
  );
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface SmtpConfig {
  host: string; port: number; secure: boolean;
  user: string; password: string; fromName: string; fromEmail: string;
}
export interface CompanyConfig { name: string; }
export interface AttendanceConfig {
  fullDayHours: number; halfDayHours: number; officeStartTime: string; timezone: string;
}
export interface BiometricConfig { pushToken: string; }

// ── SMTP ─────────────────────────────────────────────────────────────────────
export async function getSmtp(): Promise<SmtpConfig> {
  const s = (await readKey<Partial<SmtpConfig> & { password?: string }>('smtp')) || {};
  return {
    host: s.host || config.email.smtp.host,
    port: s.port ?? config.email.smtp.port,
    secure: s.secure ?? config.email.smtp.secure,
    user: s.user ?? config.email.smtp.user,
    password: s.password ? decrypt(s.password) : config.email.smtp.password,
    fromName: s.fromName || config.email.fromName,
    fromEmail: s.fromEmail || config.email.fromEmail,
  };
}

// ── Company ──────────────────────────────────────────────────────────────────
export async function getCompany(): Promise<CompanyConfig> {
  const c = (await readKey<Partial<CompanyConfig>>('company')) || {};
  return { name: c.name || 'Codespire' };
}
// Sync cached accessor for hot paths (loaded lazily + refreshed on update).
let companyCache: CompanyConfig = { name: 'Codespire' };
export function getCompanyCached(): CompanyConfig { return companyCache; }

// ── Attendance ───────────────────────────────────────────────────────────────
export async function getAttendance(): Promise<AttendanceConfig> {
  const a = (await readKey<Partial<AttendanceConfig>>('attendance')) || {};
  return {
    fullDayHours: a.fullDayHours ?? Number(process.env.FULL_DAY_HOURS ?? 9),
    halfDayHours: a.halfDayHours ?? Number(process.env.HALF_DAY_HOURS ?? 4),
    officeStartTime: a.officeStartTime || process.env.OFFICE_START_TIME || '09:30',
    timezone: a.timezone || process.env.COMPANY_TIMEZONE || 'Asia/Kolkata',
  };
}
let attendanceCache: AttendanceConfig | null = null;
export function getAttendanceCached(): AttendanceConfig {
  return attendanceCache || {
    fullDayHours: Number(process.env.FULL_DAY_HOURS ?? 9),
    halfDayHours: Number(process.env.HALF_DAY_HOURS ?? 4),
    officeStartTime: process.env.OFFICE_START_TIME || '09:30',
    timezone: process.env.COMPANY_TIMEZONE || 'Asia/Kolkata',
  };
}

// ── Biometric (device push token) ────────────────────────────────────────────
export async function getBiometric(): Promise<BiometricConfig> {
  const b = (await readKey<Partial<BiometricConfig> & { pushToken?: string }>('biometric')) || {};
  return {
    pushToken: b.pushToken ? decrypt(b.pushToken) : (process.env.BIOMETRIC_PUSH_TOKEN || ''),
  };
}
// Sync cached accessor for the device-push middleware (hot path, no login).
// Loaded lazily on boot + refreshed on every settings save.
let biometricCache: BiometricConfig | null = null;
export function getBiometricPushToken(): string {
  if (biometricCache) return biometricCache.pushToken;
  return process.env.BIOMETRIC_PUSH_TOKEN || '';
}

/** Refresh the in-memory caches (company + attendance + biometric). Call on boot and on save. */
export async function refreshSettingsCache(): Promise<void> {
  try { companyCache = await getCompany(); } catch { /* keep default */ }
  try { attendanceCache = await getAttendance(); } catch { /* keep default */ }
  try { biometricCache = await getBiometric(); } catch { /* keep default */ }
}

// ── Read (masked) for the admin UI ───────────────────────────────────────────
export async function getSettingsMasked() {
  const [smtp, company, attendance, biometric] = await Promise.all([
    getSmtp(), getCompany(), getAttendance(), getBiometric(),
  ]);
  return {
    smtp: {
      host: smtp.host, port: smtp.port, secure: smtp.secure,
      user: smtp.user, fromName: smtp.fromName, fromEmail: smtp.fromEmail,
      passwordSet: !!smtp.password, // never return the actual password
    },
    company,
    attendance,
    biometric: {
      pushTokenSet: !!biometric.pushToken, // never return the actual token
    },
  };
}

// ── Update from the admin UI ─────────────────────────────────────────────────
export async function updateSettings(
  patch: {
    smtp?: Partial<SmtpConfig> & { password?: string };
    company?: Partial<CompanyConfig>;
    attendance?: Partial<AttendanceConfig>;
    biometricPushToken?: string;
  },
  updatedBy?: string | null,
): Promise<void> {
  if (patch.smtp) {
    const current = (await readKey<Record<string, unknown>>('smtp')) || {};
    const next: Record<string, unknown> = { ...current, ...patch.smtp };
    // Only re-encrypt when a new non-empty password is provided; blank = keep existing.
    if (patch.smtp.password !== undefined) {
      if (patch.smtp.password) next.password = encrypt(patch.smtp.password);
      else next.password = current.password ?? '';
    }
    await writeKey('smtp', next, updatedBy);
  }
  if (patch.company) {
    const current = (await readKey<Record<string, unknown>>('company')) || {};
    await writeKey('company', { ...current, ...patch.company }, updatedBy);
  }
  if (patch.attendance) {
    const current = (await readKey<Record<string, unknown>>('attendance')) || {};
    await writeKey('attendance', { ...current, ...patch.attendance }, updatedBy);
  }
  if (patch.biometricPushToken !== undefined) {
    const current = (await readKey<Record<string, unknown>>('biometric')) || {};
    const next: Record<string, unknown> = { ...current };
    // Non-empty = encrypt & set; blank = clear the token (endpoint becomes open).
    next.pushToken = patch.biometricPushToken ? encrypt(patch.biometricPushToken) : '';
    await writeKey('biometric', next, updatedBy);
  }
  await refreshSettingsCache();
}
