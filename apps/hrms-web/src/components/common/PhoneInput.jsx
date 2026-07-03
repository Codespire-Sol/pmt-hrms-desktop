import { useState, useEffect } from 'react';
import { Input, Select } from 'antd';

// Curated 30-country list with dial codes, flags, and per-country digit validation
export const COUNTRY_CONFIGS = [
  { code: 'IN', name: 'India',          dialCode: '91',  flag: '🇮🇳', minDigits: 10, maxDigits: 10, pattern: /^[6-9]\d{9}$/ },
  { code: 'US', name: 'United States',  dialCode: '1',   flag: '🇺🇸', minDigits: 10, maxDigits: 10, pattern: /^\d{10}$/ },
  { code: 'GB', name: 'United Kingdom', dialCode: '44',  flag: '🇬🇧', minDigits: 10, maxDigits: 10, pattern: /^\d{10}$/ },
  { code: 'AE', name: 'UAE',            dialCode: '971', flag: '🇦🇪', minDigits: 9,  maxDigits: 9,  pattern: /^\d{9}$/ },
  { code: 'CA', name: 'Canada',         dialCode: '1',   flag: '🇨🇦', minDigits: 10, maxDigits: 10, pattern: /^\d{10}$/ },
  { code: 'AU', name: 'Australia',      dialCode: '61',  flag: '🇦🇺', minDigits: 9,  maxDigits: 9,  pattern: /^\d{9}$/ },
  { code: 'SG', name: 'Singapore',      dialCode: '65',  flag: '🇸🇬', minDigits: 8,  maxDigits: 8,  pattern: /^[689]\d{7}$/ },
  { code: 'DE', name: 'Germany',        dialCode: '49',  flag: '🇩🇪', minDigits: 10, maxDigits: 11, pattern: /^\d{10,11}$/ },
  { code: 'FR', name: 'France',         dialCode: '33',  flag: '🇫🇷', minDigits: 9,  maxDigits: 9,  pattern: /^\d{9}$/ },
  { code: 'NL', name: 'Netherlands',    dialCode: '31',  flag: '🇳🇱', minDigits: 9,  maxDigits: 9,  pattern: /^\d{9}$/ },
  { code: 'SA', name: 'Saudi Arabia',   dialCode: '966', flag: '🇸🇦', minDigits: 9,  maxDigits: 9,  pattern: /^\d{9}$/ },
  { code: 'QA', name: 'Qatar',          dialCode: '974', flag: '🇶🇦', minDigits: 8,  maxDigits: 8,  pattern: /^\d{8}$/ },
  { code: 'BH', name: 'Bahrain',        dialCode: '973', flag: '🇧🇭', minDigits: 8,  maxDigits: 8,  pattern: /^\d{8}$/ },
  { code: 'KW', name: 'Kuwait',         dialCode: '965', flag: '🇰🇼', minDigits: 8,  maxDigits: 8,  pattern: /^\d{8}$/ },
  { code: 'OM', name: 'Oman',           dialCode: '968', flag: '🇴🇲', minDigits: 8,  maxDigits: 8,  pattern: /^\d{8}$/ },
  { code: 'PK', name: 'Pakistan',       dialCode: '92',  flag: '🇵🇰', minDigits: 10, maxDigits: 10, pattern: /^\d{10}$/ },
  { code: 'BD', name: 'Bangladesh',     dialCode: '880', flag: '🇧🇩', minDigits: 10, maxDigits: 10, pattern: /^\d{10}$/ },
  { code: 'LK', name: 'Sri Lanka',      dialCode: '94',  flag: '🇱🇰', minDigits: 9,  maxDigits: 9,  pattern: /^\d{9}$/ },
  { code: 'NP', name: 'Nepal',          dialCode: '977', flag: '🇳🇵', minDigits: 10, maxDigits: 10, pattern: /^\d{10}$/ },
  { code: 'PH', name: 'Philippines',    dialCode: '63',  flag: '🇵🇭', minDigits: 10, maxDigits: 10, pattern: /^\d{10}$/ },
  { code: 'MY', name: 'Malaysia',       dialCode: '60',  flag: '🇲🇾', minDigits: 9,  maxDigits: 10, pattern: /^\d{9,10}$/ },
  { code: 'ID', name: 'Indonesia',      dialCode: '62',  flag: '🇮🇩', minDigits: 9,  maxDigits: 12, pattern: /^\d{9,12}$/ },
  { code: 'ZA', name: 'South Africa',   dialCode: '27',  flag: '🇿🇦', minDigits: 9,  maxDigits: 9,  pattern: /^\d{9}$/ },
  { code: 'KE', name: 'Kenya',          dialCode: '254', flag: '🇰🇪', minDigits: 9,  maxDigits: 9,  pattern: /^\d{9}$/ },
  { code: 'NG', name: 'Nigeria',        dialCode: '234', flag: '🇳🇬', minDigits: 10, maxDigits: 10, pattern: /^\d{10}$/ },
  { code: 'IE', name: 'Ireland',        dialCode: '353', flag: '🇮🇪', minDigits: 9,  maxDigits: 9,  pattern: /^\d{9}$/ },
  { code: 'NZ', name: 'New Zealand',    dialCode: '64',  flag: '🇳🇿', minDigits: 8,  maxDigits: 9,  pattern: /^\d{8,9}$/ },
  { code: 'SE', name: 'Sweden',         dialCode: '46',  flag: '🇸🇪', minDigits: 9,  maxDigits: 10, pattern: /^\d{9,10}$/ },
  { code: 'DK', name: 'Denmark',        dialCode: '45',  flag: '🇩🇰', minDigits: 8,  maxDigits: 8,  pattern: /^\d{8}$/ },
  { code: 'NO', name: 'Norway',         dialCode: '47',  flag: '🇳🇴', minDigits: 8,  maxDigits: 8,  pattern: /^\d{8}$/ },
];

/**
 * Parse a full phone string (e.g. "+919876543210" or "9876543210") into
 * { country, local } parts. Falls back to India for legacy values without "+".
 */
function parseValue(v) {
  if (!v) return { country: COUNTRY_CONFIGS[0], local: '' };
  const str = String(v).trim();
  if (str.startsWith('+')) {
    // Try longest match first to avoid "+1" matching "+971" as US
    const sorted = [...COUNTRY_CONFIGS].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const c of sorted) {
      if (str.startsWith(`+${c.dialCode}`)) {
        return { country: c, local: str.slice(c.dialCode.length + 1) };
      }
    }
  }
  // No "+" prefix — legacy value, treat as India
  return { country: COUNTRY_CONFIGS[0], local: str };
}

/**
 * Returns an Ant Design Form.Item validator function for phone numbers.
 * Usage: rules={[{ validator: getPhoneValidator(true) }]}
 */
export function getPhoneValidator(required = true) {
  return (_, value) => {
    if (!value || value === '') {
      return required
        ? Promise.reject(new Error('Phone number is required'))
        : Promise.resolve();
    }
    const { country, local } = parseValue(value);
    if (!local) {
      return required
        ? Promise.reject(new Error('Phone number is required'))
        : Promise.resolve();
    }
    if (!country.pattern.test(local)) {
      const digits =
        country.minDigits === country.maxDigits
          ? `${country.minDigits} digits`
          : `${country.minDigits}–${country.maxDigits} digits`;
      return Promise.reject(
        new Error(`Enter a valid ${country.name} number (${digits} after the country code)`)
      );
    }
    return Promise.resolve();
  };
}

/**
 * PhoneInput — Ant Design Input with a country-selector addonBefore.
 *
 * Props:
 *   value      — full phone string, e.g. "+919876543210" (controlled by Form.Item)
 *   onChange   — called with the full phone string whenever country or number changes
 *   placeholder — optional placeholder text for the number field
 *   size       — Ant Design Input size ("small" | "middle" | "large")
 *   disabled   — boolean
 */
export default function PhoneInput({ value, onChange, placeholder, size, disabled }) {
  const parsed = parseValue(value);
  const [selectedCountry, setSelectedCountry] = useState(parsed.country);
  const [localNumber, setLocalNumber] = useState(parsed.local);

  // Sync external value changes (e.g. form reset, EditEmployee pre-population)
  useEffect(() => {
    const p = parseValue(value);
    setSelectedCountry(p.country);
    setLocalNumber(p.local);
  }, [value]);

  const emitChange = (country, local) => {
    if (onChange) {
      onChange(local ? `+${country.dialCode}${local}` : '');
    }
  };

  const handleCountryChange = (countryCode) => {
    const country = COUNTRY_CONFIGS.find((c) => c.code === countryCode) || COUNTRY_CONFIGS[0];
    setSelectedCountry(country);
    emitChange(country, localNumber);
  };

  const handleNumberChange = (e) => {
    // Strip non-digit characters — phone numbers are digits only
    const digits = e.target.value.replace(/\D/g, '');
    setLocalNumber(digits);
    emitChange(selectedCountry, digits);
  };

  const countryOptions = COUNTRY_CONFIGS.map((c) => ({
    value: c.code,
    label: `${c.flag} +${c.dialCode}`,
    // searchLabel is used by optionFilterProp="label" — include country name for search
    searchLabel: `${c.name} +${c.dialCode} ${c.flag}`,
  }));

  return (
    <Input
      addonBefore={
        <Select
          value={selectedCountry.code}
          onChange={handleCountryChange}
          style={{ width: 110 }}
          showSearch
          optionFilterProp="searchLabel"
          popupMatchSelectWidth={false}
          disabled={disabled}
          options={countryOptions}
          optionRender={(opt) => (
            <span title={COUNTRY_CONFIGS.find((c) => c.code === opt.value)?.name}>
              {opt.data.label}
            </span>
          )}
        />
      }
      value={localNumber}
      onChange={handleNumberChange}
      placeholder={
        placeholder ||
        (selectedCountry.minDigits === selectedCountry.maxDigits
          ? `${selectedCountry.minDigits} digits`
          : `${selectedCountry.minDigits}–${selectedCountry.maxDigits} digits`)
      }
      size={size}
      disabled={disabled}
      maxLength={selectedCountry.maxDigits}
    />
  );
}
