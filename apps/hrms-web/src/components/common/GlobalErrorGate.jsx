import { useEffect, useState } from 'react';
import AppCrashScreen from './AppCrashScreen';
import { APP_FATAL_ERROR_EVENT } from '../../utils/errorEvents';

export default function GlobalErrorGate({ children }) {
  const [fatalError, setFatalError] = useState(null);

  useEffect(() => {
    const onWindowError = (event) => {
      setFatalError({
        title: 'Frontend script error',
        description: event?.error?.message || 'A runtime JavaScript error occurred.',
        errorCode: 'FRONTEND_SCRIPT_ERROR',
      });
    };

    const onUnhandledRejection = (event) => {
      const reason = event?.reason || {};
      setFatalError({
        title: 'Unhandled application error',
        description: reason?.message || 'An unexpected async error occurred.',
        errorCode: reason?.code || 'UNHANDLED_REJECTION',
      });
    };

    const onFatalEvent = (event) => {
      const detail = event?.detail || {};
      setFatalError({
        title: detail?.title || 'Server connection issue',
        description: detail?.message || 'Unable to communicate with the server.',
        errorCode: detail?.code || 'SERVER_UNREACHABLE',
      });
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener(APP_FATAL_ERROR_EVENT, onFatalEvent);

    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener(APP_FATAL_ERROR_EVENT, onFatalEvent);
    };
  }, []);

  if (fatalError) {
    return (
      <AppCrashScreen
        title={fatalError.title}
        description={fatalError.description}
        errorCode={fatalError.errorCode}
      />
    );
  }

  return children;
}
