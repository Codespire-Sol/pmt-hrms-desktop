import React from 'react';
import AppCrashScreen from './AppCrashScreen';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Keep for debugging in browser tools.
    console.error('AppErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <AppCrashScreen
          title="Frontend runtime error"
          description="A UI crash occurred in this session. Reload the app to recover."
          errorCode="FRONTEND_RUNTIME_ERROR"
        />
      );
    }

    return this.props.children;
  }
}
