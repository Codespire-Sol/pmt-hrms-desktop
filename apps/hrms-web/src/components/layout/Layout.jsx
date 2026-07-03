import { useState, useEffect, useRef } from 'react';
import { Layout as AntLayout, Drawer } from 'antd';
import { useAuth } from '../../hooks/useAuth';
import keycloak from '../../lib/keycloak';
import Sidebar from './Sidebar';
import Header from './Header';
import OnboardingGate from './OnboardingGate';
import { themeTokens } from '../../styles/theme';

const { Content } = AntLayout;

export default function Layout({ children }) {
  const { isAuthenticated, user, isEmployee, isManager } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileVisible, setMobileVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const loginTriggered = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (!mobile) setMobileVisible(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isAuthenticated && !keycloak.authenticated && !loginTriggered.current) {
      loginTriggered.current = true;
      keycloak.login({ redirectUri: window.location.href });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return null;
  }

  // Block employees/managers whose onboarding hasn't been completed yet
  const isOnboarding = (isEmployee || isManager) && user?.status === 'onboarding';
  if (isOnboarding) {
    return <OnboardingGate user={user} />;
  }

  const sidebarWidth = isMobile ? 0 : (collapsed ? 80 : 260);

  return (
    <AntLayout style={{ minHeight: '100vh', background: themeTokens.colors.appBackground }}>
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />}

      {/* Mobile Drawer */}
      <Drawer
        placement="left"
        onClose={() => setMobileVisible(false)}
        open={mobileVisible}
        width={260}
        zIndex={900}
        styles={{
          body: { padding: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
        }}
        closable={false}
      >
        <Sidebar collapsed={false} setCollapsed={() => { }} isMobile={true} closeMobile={() => setMobileVisible(false)} />
      </Drawer>

      <AntLayout style={{
        marginLeft: sidebarWidth,
        transition: 'all 0.2s',
        background: themeTokens.colors.appBackground,
        minWidth: 0,
        height: '100vh',
        overflow: 'hidden'
      }}>
        <Header
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          isMobile={isMobile}
          onShowMobile={() => setMobileVisible(true)}
        />
        <Content style={{
          margin: isMobile ? '16px' : '24px',
          padding: 0,
          minHeight: 280,
          background: 'transparent',
          overflowX: 'hidden',
          overflowY: 'auto',
        }}>
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
