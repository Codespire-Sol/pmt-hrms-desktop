import { useState } from 'react';
import { User, Lock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import keycloak from '@/lib/keycloak';
import { ProfilePage } from './ProfilePage';

const TABS = [
  { key: 'profile',  label: 'Profile',  icon: User },
  { key: 'security', label: 'Security', icon: Lock },
] as const;

type TabKey = typeof TABS[number]['key'];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e5e7eb' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '9px 16px',
                fontSize: '13.5px', fontWeight: active ? 600 : 500,
                color: active ? '#1268ff' : '#4a5565',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: active ? '2px solid #1268ff' : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'color 0.15s',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'profile' && <ProfilePage />}

      {activeTab === 'security' && (
        <Card>
          <CardHeader>
            <CardTitle>Password &amp; Account Security</CardTitle>
            <CardDescription>
              Password, two-factor authentication, and account security are managed via your identity provider.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => keycloak.accountManagement()}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Account Management
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SettingsPage;
