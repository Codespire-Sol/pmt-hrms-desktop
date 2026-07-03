import { Button } from 'antd';
import { ClipboardList, LogOut } from 'lucide-react';
import keycloak from '../../lib/keycloak';
import { useAuthStore } from '../../store/authStore';
import { themeTokens } from '../../styles/theme';

/**
 * Shown to employees/managers whose onboarding is still in progress.
 * Blocks all app functionality until HR marks onboarding complete.
 */
export default function OnboardingGate({ user }) {
  const logout = () => {
    useAuthStore.getState().logout();
    keycloak.logout({ redirectUri: window.location.origin });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: themeTokens.colors.appBackground,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: `1px solid ${themeTokens.colors.borders}`,
        padding: '48px 40px',
        maxWidth: 480,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <ClipboardList size={32} color={themeTokens.colors.primary} />
        </div>

        <h2 style={{
          fontSize: 22,
          fontWeight: 800,
          color: themeTokens.colors.heading,
          marginBottom: 8,
          letterSpacing: '-0.02em',
        }}>
          Onboarding in Progress
        </h2>

        <p style={{
          fontSize: 15,
          color: themeTokens.colors.textTertiary,
          marginBottom: 8,
          lineHeight: 1.6,
        }}>
          Welcome, <strong style={{ color: themeTokens.colors.textSecondary }}>
            {user?.firstName || user?.name || 'there'}
          </strong>!
        </p>

        <p style={{
          fontSize: 14,
          color: themeTokens.colors.textTertiary,
          marginBottom: 32,
          lineHeight: 1.7,
        }}>
          Your account is currently being set up by the HR team. You will gain full access
          to the system once your onboarding has been completed.
        </p>

        <div style={{
          background: '#F8F9FC',
          borderRadius: 10,
          padding: '14px 20px',
          marginBottom: 32,
          textAlign: 'left',
        }}>
          <p style={{ fontSize: 13, color: themeTokens.colors.textTertiary, margin: 0 }}>
            If you have questions, please contact your HR representative.
          </p>
        </div>

        <Button
          icon={<LogOut size={15} />}
          onClick={logout}
          style={{
            borderColor: themeTokens.colors.borders,
            color: themeTokens.colors.textSecondary,
            height: 38,
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
