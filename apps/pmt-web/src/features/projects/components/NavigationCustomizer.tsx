import React, { useState } from 'react';
import { Typography, Input, Button, Card, Space, Badge } from 'antd';
import { Search, ChevronRight, Plus, Eye, Check } from 'lucide-react';

const { Text, Title, Paragraph } = Typography;

const COLORS = {
    primary: '#1268ff',
    textPrimary: '#101828',
    textSecondary: '#4a5565',
    border: '#e5e7eb',
    shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
    accent: 'rgba(18, 104, 255, 0.08)',
};

export interface NavItem {
    key: string;
    label: string;
    icon: React.ReactNode;
    visible: boolean;
    description?: string;
    previewImage?: string;
}

interface NavigationCustomizerProps {
    availableItems: NavItem[];
    pinnedItems: string[];
    onPin: (key: string) => void;
    onUnpin: (key: string) => void;
    onClose: () => void;
}

export function NavigationCustomizer({ availableItems, pinnedItems, onPin, onUnpin, onClose }: NavigationCustomizerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedKey, setSelectedKey] = useState<string>(availableItems[0]?.key || '');

    const filteredItems = availableItems.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedItem = availableItems.find(item => item.key === selectedKey);
    const isPinned = pinnedItems.includes(selectedKey);

    return (
        <div style={{
            width: '720px',
            display: 'flex',
            height: '520px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            overflow: 'hidden'
        }}>
            {/* Left Column: List */}
            <div style={{
                width: '300px',
                borderRight: `1px solid ${COLORS.border}`,
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ padding: '16px', borderBottom: `1px solid ${COLORS.border}` }}>
                    <Title level={5} style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Views</Title>
                    <Input
                        prefix={<Search size={14} color={COLORS.textSecondary} />}
                        placeholder="Search board"
                        variant="filled"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ borderRadius: '8px' }}
                    />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                    {filteredItems.map(item => (
                        <div
                            key={item.key}
                            onClick={() => setSelectedKey(item.key)}
                            style={{
                                padding: '10px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                backgroundColor: selectedKey === item.key ? COLORS.accent : 'transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{
                                color: selectedKey === item.key ? COLORS.primary : COLORS.textSecondary,
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                {item.icon}
                            </div>
                            <Text strong={selectedKey === item.key} style={{
                                flex: 1,
                                fontSize: '14px',
                                color: selectedKey === item.key ? COLORS.primary : COLORS.textPrimary
                            }}>
                                {item.label}
                            </Text>
                            {pinnedItems.includes(item.key) && (
                                <Check size={14} color={COLORS.primary} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Column: Preview */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f9fafb' }}>
                {selectedItem ? (
                    <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '32px'
                        }}>
                            <Card style={{
                                width: '100%',
                                height: '240px',
                                borderRadius: '12px',
                                border: `1px solid ${COLORS.border}`,
                                boxShadow: COLORS.shadow,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                background: '#ffffff'
                            }}>
                                {/* Mock preview UI based on view type */}
                                <div style={{ padding: '24px', textAlign: 'center' }}>
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '16px',
                                        background: COLORS.accent,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 16px auto',
                                        color: COLORS.primary
                                    }}>
                                        {React.cloneElement(selectedItem.icon as React.ReactElement, { size: 32 })}
                                    </div>
                                    <Title level={4} style={{ margin: 0 }}>{selectedItem.label} Preview</Title>
                                    <Paragraph type="secondary" style={{ marginTop: '8px' }}>
                                        Visual representation of the {selectedItem.label} view and its features.
                                    </Paragraph>
                                </div>
                            </Card>
                        </div>

                        <div style={{ marginTop: 'auto' }}>
                            <Title level={4} style={{ margin: '0 0 8px 0', fontSize: '20px' }}>{selectedItem.label}</Title>
                            <Paragraph style={{ color: COLORS.textSecondary, fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
                                {selectedItem.description || `View and manage your project using the ${selectedItem.label.toLowerCase()} interface. This help you organize work efficiently.`}
                            </Paragraph>

                            <div style={{ display: 'flex', gap: 10 }}>
                                {isPinned ? (
                                    <>
                                        <Button
                                            icon={<Check size={16} />}
                                            style={{
                                                height: '44px', borderRadius: '10px', fontWeight: 600,
                                                background: '#ffffff', borderColor: COLORS.border, padding: '0 20px',
                                                color: COLORS.textPrimary,
                                            }}
                                            disabled
                                        >
                                            In navigation
                                        </Button>
                                        <Button
                                            danger
                                            style={{
                                                height: '44px', borderRadius: '10px', fontWeight: 600, padding: '0 20px',
                                            }}
                                            onClick={() => onUnpin(selectedItem.key)}
                                        >
                                            Remove from navigation
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        type="primary"
                                        icon={<Plus size={16} />}
                                        onClick={() => onPin(selectedItem.key)}
                                        style={{
                                            height: '44px', borderRadius: '10px', fontWeight: 600,
                                            background: COLORS.primary, borderColor: COLORS.primary, padding: '0 24px',
                                        }}
                                    >
                                        Add to navigation
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Text type="secondary">Select a view to see preview</Text>
                    </div>
                )}
            </div>
        </div>
    );
}
