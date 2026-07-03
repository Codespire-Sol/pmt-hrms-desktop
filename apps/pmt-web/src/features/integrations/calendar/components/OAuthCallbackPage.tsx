import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Lightweight callback page that runs inside the OAuth popup.
 * Extracts the authorization code from the URL and sends it
 * to the parent window via postMessage, then closes itself.
 */
export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'sending' | 'error'>('sending');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setErrorMessage(searchParams.get('error_description') || 'Authorization was denied');
      if (window.opener) {
        window.opener.postMessage({ type: 'calendar-oauth-error', error: errorMessage }, window.location.origin);
      }
      setTimeout(() => window.close(), 2000);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('No authorization code received');
      setTimeout(() => window.close(), 2000);
      return;
    }

    // Send the code to the parent window which has the authenticated session
    if (window.opener) {
      window.opener.postMessage(
        { type: 'calendar-oauth-callback', code, state },
        window.location.origin
      );
    }
    setTimeout(() => window.close(), 1500);
  }, [searchParams]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: "'Inter', sans-serif",
      backgroundColor: '#f8fafc',
    }}>
      {status === 'sending' && (
        <>
          <div style={{
            width: 40, height: 40, border: '3px solid #e2e8f0',
            borderTopColor: '#0f172a', borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <p style={{ marginTop: 16, color: '#64748b' }}>Connecting your calendar...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </>
      )}
      {status === 'error' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 8, color: '#dc2626' }}>&#10007;</div>
          <p style={{ color: '#dc2626', fontWeight: 600 }}>Connection failed</p>
          <p style={{ color: '#64748b', fontSize: 14 }}>{errorMessage}</p>
          <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>This window will close automatically.</p>
        </>
      )}
    </div>
  );
}
