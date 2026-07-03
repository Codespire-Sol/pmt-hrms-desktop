import { useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Card,
  Button,
  Input,
  Typography,
  Skeleton,
  Avatar,
  Tag,
  Checkbox,
  Statistic,
  Row,
  Col,
  Divider,
  Empty,
  message,
} from 'antd';
import {
  HeartOutlined,
  HeartFilled,
  PlusOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  useGetSprintQuery,
  useUpdateRetrospectiveMutation,
} from './sprintsApi';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const COLORS = {
  primary: '#1677ff',
  success: '#52c41a',
  warning: '#faad14',
  danger: '#ff4d4f',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
};

// ---------- Types ----------

interface RetroItem {
  id: string;
  text: string;
  votes: number;
}

interface ActionItem {
  id: string;
  text: string;
  assignee: string;
  done: boolean;
}

interface RetroData {
  wentWell: RetroItem[];
  needsImprovement: RetroItem[];
  actionItems: ActionItem[];
}

const defaultRetroData: RetroData = {
  wentWell: [],
  needsImprovement: [],
  actionItems: [],
};

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
}

// ---------- Column Card Component ----------

function RetroItemCard({
  item,
  color,
  onVote,
  onDelete,
}: {
  item: RetroItem;
  color: string;
  onVote: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [voted, setVoted] = useState(false);

  const handleVote = () => {
    setVoted(!voted);
    onVote(item.id);
  };

  return (
    <Card
      size="small"
      style={{
        marginBottom: 8,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
      }}
      bodyStyle={{ padding: '10px 12px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Paragraph
          style={{
            margin: 0,
            flex: 1,
            fontSize: 13,
            color: COLORS.textPrimary,
            whiteSpace: 'pre-wrap',
          }}
        >
          {item.text}
        </Paragraph>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, flexShrink: 0 }}>
          <Button
            type="text"
            size="small"
            icon={voted ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />}
            onClick={handleVote}
            style={{ fontSize: 14, padding: '0 4px' }}
          />
          <Text type="secondary" style={{ fontSize: 12, minWidth: 16, textAlign: 'center' }}>
            {item.votes}
          </Text>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(item.id)}
            style={{ fontSize: 12, padding: '0 4px' }}
          />
        </div>
      </div>
    </Card>
  );
}

// ---------- Action Item Card ----------

function ActionItemCard({
  item,
  onToggleDone,
  onUpdateAssignee,
  onDelete,
}: {
  item: ActionItem;
  onToggleDone: (id: string) => void;
  onUpdateAssignee: (id: string, assignee: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card
      size="small"
      style={{
        marginBottom: 8,
        borderLeft: '3px solid #1677ff',
        borderRadius: 6,
        opacity: item.done ? 0.7 : 1,
      }}
      bodyStyle={{ padding: '10px 12px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Checkbox
          checked={item.done}
          onChange={() => onToggleDone(item.id)}
          style={{ marginTop: 2 }}
        />
        <div style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 13,
              textDecoration: item.done ? 'line-through' : 'none',
              color: item.done ? COLORS.textSecondary : COLORS.textPrimary,
              display: 'block',
              whiteSpace: 'pre-wrap',
            }}
          >
            {item.text}
          </Text>
          {item.assignee && (
            <div style={{ marginTop: 4 }}>
              <Tag icon={<UserOutlined />} style={{ fontSize: 11 }}>
                {item.assignee}
              </Tag>
            </div>
          )}
        </div>
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onDelete(item.id)}
          style={{ flexShrink: 0 }}
        />
      </div>
    </Card>
  );
}

// ---------- Main Component ----------

export function SprintRetrospectivePage() {
  const { projectId, sprintId } = useParams<{ projectId: string; sprintId: string }>();

  const {
    data: sprint,
    isLoading,
  } = useGetSprintQuery(sprintId!, { skip: !sprintId });

  const [updateRetrospective, { isLoading: isSaving }] = useUpdateRetrospectiveMutation();

  // Parse existing retro data from sprint
  const initialRetroData = useMemo((): RetroData => {
    if (!sprint) return defaultRetroData;
    try {
      // retrospectiveNotes might be stored as a JSON string
      const notes = (sprint as any).retrospectiveNotes;
      if (notes && typeof notes === 'string') {
        const parsed = JSON.parse(notes);
        return {
          wentWell: parsed.wentWell || [],
          needsImprovement: parsed.needsImprovement || [],
          actionItems: parsed.actionItems || [],
        };
      }
    } catch {
      // not JSON, ignore
    }
    return defaultRetroData;
  }, [sprint]);

  const [retroData, setRetroData] = useState<RetroData>(initialRetroData);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync from server when sprint data loads
  useState(() => {
    if (initialRetroData !== defaultRetroData) {
      setRetroData(initialRetroData);
    }
  });

  // Input states for adding new items
  const [wentWellInput, setWentWellInput] = useState('');
  const [needsImprovementInput, setNeedsImprovementInput] = useState('');
  const [actionItemInput, setActionItemInput] = useState('');
  const [actionItemAssignee, setActionItemAssignee] = useState('');

  // ---------- Handlers ----------

  const markChanged = useCallback(() => setHasChanges(true), []);

  const addWentWell = () => {
    if (!wentWellInput.trim()) return;
    setRetroData((prev) => ({
      ...prev,
      wentWell: [...prev.wentWell, { id: generateId(), text: wentWellInput.trim(), votes: 0 }],
    }));
    setWentWellInput('');
    markChanged();
  };

  const addNeedsImprovement = () => {
    if (!needsImprovementInput.trim()) return;
    setRetroData((prev) => ({
      ...prev,
      needsImprovement: [
        ...prev.needsImprovement,
        { id: generateId(), text: needsImprovementInput.trim(), votes: 0 },
      ],
    }));
    setNeedsImprovementInput('');
    markChanged();
  };

  const addActionItem = () => {
    if (!actionItemInput.trim()) return;
    setRetroData((prev) => ({
      ...prev,
      actionItems: [
        ...prev.actionItems,
        {
          id: generateId(),
          text: actionItemInput.trim(),
          assignee: actionItemAssignee.trim(),
          done: false,
        },
      ],
    }));
    setActionItemInput('');
    setActionItemAssignee('');
    markChanged();
  };

  const handleVote = (column: 'wentWell' | 'needsImprovement', itemId: string) => {
    setRetroData((prev) => ({
      ...prev,
      [column]: prev[column].map((item) =>
        item.id === itemId ? { ...item, votes: item.votes + 1 } : item
      ),
    }));
    markChanged();
  };

  const handleDelete = (column: 'wentWell' | 'needsImprovement', itemId: string) => {
    setRetroData((prev) => ({
      ...prev,
      [column]: prev[column].filter((item) => item.id !== itemId),
    }));
    markChanged();
  };

  const handleDeleteAction = (itemId: string) => {
    setRetroData((prev) => ({
      ...prev,
      actionItems: prev.actionItems.filter((item) => item.id !== itemId),
    }));
    markChanged();
  };

  const handleToggleDone = (itemId: string) => {
    setRetroData((prev) => ({
      ...prev,
      actionItems: prev.actionItems.map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item
      ),
    }));
    markChanged();
  };

  const handleUpdateAssignee = (itemId: string, assignee: string) => {
    setRetroData((prev) => ({
      ...prev,
      actionItems: prev.actionItems.map((item) =>
        item.id === itemId ? { ...item, assignee } : item
      ),
    }));
    markChanged();
  };

  const handleSave = async () => {
    if (!sprintId) return;
    try {
      await updateRetrospective({
        sprintId,
        retrospectiveNotes: JSON.stringify(retroData),
      }).unwrap();
      setHasChanges(false);
      message.success('Retrospective saved successfully');
    } catch {
      message.error('Failed to save retrospective');
    }
  };

  // ---------- Sprint Metrics ----------

  const velocity = sprint?.progress?.completedStoryPoints || 0;
  const totalIssues = sprint?.progress?.totalIssues || 0;
  const completedIssues = sprint?.progress?.completedIssues || 0;
  const completionPercent = sprint?.progress?.percentComplete || 0;

  // ---------- Render ----------

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 3 }} />
        <Row gutter={16} style={{ marginTop: 24 }}>
          <Col span={8}><Skeleton active paragraph={{ rows: 8 }} /></Col>
          <Col span={8}><Skeleton active paragraph={{ rows: 8 }} /></Col>
          <Col span={8}><Skeleton active paragraph={{ rows: 8 }} /></Col>
        </Row>
      </div>
    );
  }

  if (!sprint) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Empty description="Sprint not found" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to={`/projects/${projectId}/sprints`}>
            <Button type="text" icon={<ArrowLeftOutlined />} />
          </Link>
          <div>
            <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>
              Retrospective: {sprint.name}
            </Title>
            <Text type="secondary">
              Reflect on the sprint and capture improvement actions
            </Text>
          </div>
        </div>
        <Button
          type="primary"
          onClick={handleSave}
          loading={isSaving}
          disabled={!hasChanges}
        >
          {hasChanges ? 'Save Changes' : 'Saved'}
        </Button>
      </div>

      {/* Sprint Metrics Summary */}
      <Card
        style={{ marginBottom: 24, borderRadius: 8 }}
        bodyStyle={{ padding: '16px 24px' }}
      >
        <Row gutter={32}>
          <Col>
            <Statistic
              title="Velocity"
              value={velocity}
              suffix="SP"
              valueStyle={{ color: COLORS.primary, fontSize: 28 }}
              prefix={<ThunderboltOutlined />}
            />
          </Col>
          <Col>
            <Divider type="vertical" style={{ height: 48 }} />
          </Col>
          <Col>
            <Statistic
              title="Completion"
              value={completionPercent}
              suffix="%"
              valueStyle={{
                color: completionPercent >= 80 ? COLORS.success : COLORS.warning,
                fontSize: 28,
              }}
              prefix={<CheckCircleOutlined />}
            />
          </Col>
          <Col>
            <Divider type="vertical" style={{ height: 48 }} />
          </Col>
          <Col>
            <Statistic
              title="Total Issues"
              value={`${completedIssues} / ${totalIssues}`}
              valueStyle={{ fontSize: 28, color: COLORS.textPrimary }}
            />
          </Col>
        </Row>
      </Card>

      {/* Three Column Retro Board */}
      <Row gutter={16}>
        {/* Went Well Column */}
        <Col xs={24} md={8}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: COLORS.success,
                }} />
                <span>Went Well</span>
                <Tag color="green" style={{ marginLeft: 'auto' }}>
                  {retroData.wentWell.length}
                </Tag>
              </div>
            }
            style={{ borderTop: `3px solid ${COLORS.success}`, borderRadius: 8, minHeight: 400 }}
            bodyStyle={{ padding: 12 }}
          >
            {retroData.wentWell
              .slice()
              .sort((a, b) => b.votes - a.votes)
              .map((item) => (
                <RetroItemCard
                  key={item.id}
                  item={item}
                  color={COLORS.success}
                  onVote={(id) => handleVote('wentWell', id)}
                  onDelete={(id) => handleDelete('wentWell', id)}
                />
              ))}

            {retroData.wentWell.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px 0', color: COLORS.textSecondary }}>
                <Text type="secondary">No items yet</Text>
              </div>
            )}

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <TextArea
                placeholder="What went well?"
                value={wentWellInput}
                onChange={(e) => setWentWellInput(e.target.value)}
                autoSize={{ minRows: 1, maxRows: 3 }}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    addWentWell();
                  }
                }}
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={addWentWell}
                style={{ backgroundColor: COLORS.success, borderColor: COLORS.success }}
              />
            </div>
          </Card>
        </Col>

        {/* Needs Improvement Column */}
        <Col xs={24} md={8}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: COLORS.warning,
                }} />
                <span>Needs Improvement</span>
                <Tag color="orange" style={{ marginLeft: 'auto' }}>
                  {retroData.needsImprovement.length}
                </Tag>
              </div>
            }
            style={{ borderTop: `3px solid ${COLORS.warning}`, borderRadius: 8, minHeight: 400 }}
            bodyStyle={{ padding: 12 }}
          >
            {retroData.needsImprovement
              .slice()
              .sort((a, b) => b.votes - a.votes)
              .map((item) => (
                <RetroItemCard
                  key={item.id}
                  item={item}
                  color={COLORS.warning}
                  onVote={(id) => handleVote('needsImprovement', id)}
                  onDelete={(id) => handleDelete('needsImprovement', id)}
                />
              ))}

            {retroData.needsImprovement.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px 0', color: COLORS.textSecondary }}>
                <Text type="secondary">No items yet</Text>
              </div>
            )}

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <TextArea
                placeholder="What could be improved?"
                value={needsImprovementInput}
                onChange={(e) => setNeedsImprovementInput(e.target.value)}
                autoSize={{ minRows: 1, maxRows: 3 }}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    addNeedsImprovement();
                  }
                }}
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={addNeedsImprovement}
                style={{ backgroundColor: COLORS.warning, borderColor: COLORS.warning }}
              />
            </div>
          </Card>
        </Col>

        {/* Action Items Column */}
        <Col xs={24} md={8}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: COLORS.primary,
                }} />
                <span>Action Items</span>
                <Tag color="blue" style={{ marginLeft: 'auto' }}>
                  {retroData.actionItems.filter((a) => !a.done).length} / {retroData.actionItems.length}
                </Tag>
              </div>
            }
            style={{ borderTop: `3px solid ${COLORS.primary}`, borderRadius: 8, minHeight: 400 }}
            bodyStyle={{ padding: 12 }}
          >
            {retroData.actionItems.map((item) => (
              <ActionItemCard
                key={item.id}
                item={item}
                onToggleDone={handleToggleDone}
                onUpdateAssignee={handleUpdateAssignee}
                onDelete={handleDeleteAction}
              />
            ))}

            {retroData.actionItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px 0', color: COLORS.textSecondary }}>
                <Text type="secondary">No action items yet</Text>
              </div>
            )}

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <TextArea
                placeholder="What action should we take?"
                value={actionItemInput}
                onChange={(e) => setActionItemInput(e.target.value)}
                autoSize={{ minRows: 1, maxRows: 3 }}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    addActionItem();
                  }
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  placeholder="Assignee (optional)"
                  value={actionItemAssignee}
                  onChange={(e) => setActionItemAssignee(e.target.value)}
                  prefix={<UserOutlined />}
                  style={{ flex: 1 }}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={addActionItem}
                />
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
