import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Typography,
  Button,
  Tree,
  Input,
  Space,
  Dropdown,
  Modal,
  Empty,
  Spin,
  Tooltip,
  Tag,
  message,
} from 'antd';
import type { TreeDataNode } from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined,
  FileTextOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined,
  MoreOutlined,
  FileAddOutlined,
} from '@ant-design/icons';
import {
  useGetProjectPagesQuery,
  useCreatePageMutation,
  useUpdatePageMutation,
  useDeletePageMutation,
  Page,
} from './pagesApi';
import { RichTextEditor } from '@/components/editor/RichTextEditor';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const PAGE_TEMPLATES: Record<string, { title: string; content: string }> = {
  blank: {
    title: 'Untitled Page',
    content: '',
  },
  prd: {
    title: 'Product Requirements',
    content: `# Product Requirements Document

## Overview
Brief description of the feature or product.

## Goals
- Goal 1
- Goal 2

## User Stories
- As a [user type], I want to [action] so that [benefit].

## Requirements

### Functional Requirements
1.

### Non-Functional Requirements
1.

## Design
Link to design mockups or wireframes.

## Timeline
| Phase | Description | Target Date |
|-------|------------|-------------|
| Phase 1 | | |

## Success Metrics
- Metric 1
- Metric 2
`,
  },
  meeting: {
    title: 'Meeting Notes',
    content: `# Meeting Notes

**Date:** ${new Date().toLocaleDateString()}
**Attendees:**

## Agenda
1.

## Discussion
-

## Action Items
- [ ] Action item 1 - Owner
- [ ] Action item 2 - Owner

## Next Steps
-
`,
  },
  decision: {
    title: 'Decision Record',
    content: `# Decision Record

## Status
Proposed / Accepted / Deprecated / Superseded

## Context
What is the issue that we are seeing that is motivating this decision?

## Decision
What is the change that we are proposing and/or doing?

## Options Considered

### Option 1
- Pros:
- Cons:

### Option 2
- Pros:
- Cons:

## Consequences
What becomes easier or more difficult to do because of this change?
`,
  },
  retrospective: {
    title: 'Retrospective',
    content: `# Sprint Retrospective

**Date:** ${new Date().toLocaleDateString()}
**Sprint:**

## What went well
-

## What could be improved
-

## Action items
- [ ] Action item 1
- [ ] Action item 2

## Key metrics
- Velocity:
- Completed stories:
- Bugs found:
`,
  },
};

export function PagesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContentHtml, setEditContentHtml] = useState('');
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<string | null>(null);

  const { data: pages, isLoading } = useGetProjectPagesQuery(
    { projectId: projectId! },
    { skip: !projectId }
  );

  const [createPage, { isLoading: isCreating }] = useCreatePageMutation();
  const [updatePage, { isLoading: isUpdating }] = useUpdatePageMutation();
  const [deletePage, { isLoading: isDeleting }] = useDeletePageMutation();

  const selectedPage = useMemo(() => {
    if (!selectedPageId || !pages) return null;
    return findPageById(pages, selectedPageId);
  }, [selectedPageId, pages]);

  function findPageById(pageList: Page[], id: string): Page | null {
    for (const page of pageList) {
      if (page.id === id) return page;
      if (page.children) {
        const found = findPageById(page.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  const treeData: TreeDataNode[] = useMemo(() => {
    if (!pages) return [];
    return pages.map((page) => convertToTreeNode(page));
  }, [pages]);

  function convertToTreeNode(page: Page): TreeDataNode {
    const contextMenuItems: MenuProps['items'] = [
      {
        key: 'edit',
        label: 'Edit',
        icon: <EditOutlined />,
        onClick: () => {
          setSelectedPageId(page.id);
          startEditing(page);
        },
      },
      {
        key: 'add-child',
        label: 'Add Sub-page',
        icon: <FileAddOutlined />,
        onClick: () => handleCreateChildPage(page.id),
      },
      { type: 'divider' },
      {
        key: 'delete',
        label: 'Delete',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => {
          setPageToDelete(page.id);
          setDeleteConfirmOpen(true);
        },
      },
    ];

    return {
      key: page.id,
      title: (
        <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
            <FileTextOutlined style={{ fontSize: 14, color: '#8c8c8c' }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {page.title}
            </span>
            {!page.isPublished && (
              <Tag color="orange" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', marginRight: 0 }}>
                Draft
              </Tag>
            )}
            <Dropdown menu={{ items: contextMenuItems }} trigger={['click']}>
              <MoreOutlined
                style={{ fontSize: 14, color: '#8c8c8c', padding: '0 2px' }}
                onClick={(e) => e.stopPropagation()}
              />
            </Dropdown>
          </span>
        </Dropdown>
      ),
      children: page.children?.map((child) => convertToTreeNode(child)),
    };
  }

  function startEditing(page: Page) {
    setEditTitle(page.title);
    // Prefer pre-rendered HTML; fall back to converting markdown content to a simple paragraph
    setEditContentHtml(page.contentHtml || (page.content ? `<p>${page.content.replace(/\n/g, '<br/>')}</p>` : ''));
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditTitle('');
    setEditContentHtml('');
  }

  async function handleSave() {
    if (!selectedPageId) return;

    try {
      await updatePage({
        pageId: selectedPageId,
        data: {
          title: editTitle,
          content: editContentHtml.replace(/<[^>]+>/g, '').trim(),
          contentHtml: editContentHtml,
        },
      }).unwrap();

      message.success('Page saved');
      setIsEditing(false);
    } catch (error: any) {
      message.error(error?.data?.message || 'Failed to save page.');
    }
  }

  async function handleCreateFromTemplate(templateKey: string) {
    if (!projectId) return;

    const template = PAGE_TEMPLATES[templateKey];

    try {
      const page = await createPage({
        projectId,
        data: {
          title: template.title,
          content: template.content,
        },
      }).unwrap();

      setTemplateModalOpen(false);
      if (page) {
        setSelectedPageId(page.id);
        startEditing(page);
      }

      message.success(`"${template.title}" created`);
    } catch (error: any) {
      message.error(error?.data?.message || 'Failed to create page.');
    }
  }

  async function handleCreateChildPage(parentId: string) {
    if (!projectId) return;

    try {
      const page = await createPage({
        projectId,
        data: {
          title: 'Untitled Sub-page',
          parentId,
        },
      }).unwrap();

      if (page) {
        setSelectedPageId(page.id);
        startEditing(page);
      }

      message.success('Sub-page created');
    } catch (error: any) {
      message.error(error?.data?.message || 'Failed to create sub-page.');
    }
  }

  async function handleDelete() {
    if (!pageToDelete) return;

    try {
      await deletePage(pageToDelete).unwrap();

      if (selectedPageId === pageToDelete) {
        setSelectedPageId(null);
        setIsEditing(false);
      }

      message.success('Page deleted');
    } catch (error: any) {
      message.error(error?.data?.message || 'Failed to delete page.');
    } finally {
      setDeleteConfirmOpen(false);
      setPageToDelete(null);
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 0, overflow: 'hidden' }}>
      {/* Left Panel - Page Tree */}
      <div
        style={{
          width: 250,
          minWidth: 250,
          borderRight: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          background: '#fafafa',
        }}
      >
        <div
          style={{
            padding: '16px 12px 12px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Title level={5} style={{ margin: 0, fontSize: 14 }}>
            Pages
          </Title>
          <Tooltip title="Create page">
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setTemplateModalOpen(true)}
              loading={isCreating}
            />
          </Tooltip>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {!pages || pages.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center' }}>
              <FileTextOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
              <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
                No pages yet
              </Paragraph>
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setTemplateModalOpen(true)}
              >
                Create first page
              </Button>
            </div>
          ) : (
            <Tree
              treeData={treeData}
              defaultExpandAll
              selectedKeys={selectedPageId ? [selectedPageId] : []}
              onSelect={(keys) => {
                if (keys.length > 0) {
                  const pageId = keys[0] as string;
                  setSelectedPageId(pageId);
                  setIsEditing(false);
                }
              }}
              blockNode
              style={{ background: 'transparent' }}
            />
          )}
        </div>
      </div>

      {/* Right Panel - Content Viewer/Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedPage ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
              flexDirection: 'column',
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  {pages && pages.length > 0
                    ? 'Select a page from the sidebar to view its content'
                    : 'Create your first page to get started'}
                </span>
              }
            >
              {(!pages || pages.length === 0) && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setTemplateModalOpen(true)}
                >
                  Create Page
                </Button>
              )}
            </Empty>
          </div>
        ) : (
          <>
            {/* Page Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ flex: 1 }}>
                {isEditing ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Page title"
                    style={{ fontSize: 18, fontWeight: 600, border: 'none', padding: 0, boxShadow: 'none' }}
                    variant="borderless"
                  />
                ) : (
                  <Title level={4} style={{ margin: 0 }}>
                    {selectedPage.title}
                  </Title>
                )}
                {selectedPage.creator && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Created by {selectedPage.creator.firstName} {selectedPage.creator.lastName}
                    {' \u00b7 '}
                    {new Date(selectedPage.updatedAt).toLocaleDateString()}
                  </Text>
                )}
              </div>
              <Space>
                {isEditing ? (
                  <>
                    <Button
                      icon={<CloseOutlined />}
                      onClick={cancelEditing}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={handleSave}
                      loading={isUpdating}
                    >
                      Save
                    </Button>
                  </>
                ) : (
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => startEditing(selectedPage)}
                  >
                    Edit
                  </Button>
                )}
              </Space>
            </div>

            {/* Page Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
              {isEditing ? (
                <RichTextEditor
                  value={editContentHtml}
                  onChange={setEditContentHtml}
                  placeholder="Write your page content…"
                  editable
                  minHeight={400}
                  showToolbar
                />
              ) : (
                <div>
                  {selectedPage.contentHtml || selectedPage.content ? (
                    <RichTextEditor
                      value={selectedPage.contentHtml || (selectedPage.content ? `<p>${selectedPage.content.replace(/\n/g, '<br/>')}</p>` : '')}
                      editable={false}
                      showToolbar={false}
                    />
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="This page has no content yet"
                    >
                      <Button
                        type="primary"
                        icon={<EditOutlined />}
                        onClick={() => startEditing(selectedPage)}
                      >
                        Start Writing
                      </Button>
                    </Empty>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Template Picker Modal */}
      <Modal
        title="Create New Page"
        open={templateModalOpen}
        onCancel={() => setTemplateModalOpen(false)}
        footer={null}
        width={520}
      >
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Choose a template to get started:
        </Paragraph>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {Object.entries(PAGE_TEMPLATES).map(([key, template]) => {
            const labels: Record<string, { label: string; description: string }> = {
              blank: { label: 'Blank', description: 'Start from scratch' },
              prd: { label: 'Product Requirements', description: 'PRD template with sections' },
              meeting: { label: 'Meeting Notes', description: 'Agenda, notes, and action items' },
              decision: { label: 'Decision Record', description: 'Document architectural decisions' },
              retrospective: { label: 'Retrospective', description: 'Sprint retro template' },
            };

            const info = labels[key] || { label: template.title, description: '' };

            return (
              <div
                key={key}
                onClick={() => handleCreateFromTemplate(key)}
                style={{
                  border: '1px solid #d9d9d9',
                  borderRadius: 8,
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#1677ff';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(22, 119, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#d9d9d9';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <FileTextOutlined style={{ fontSize: 16, color: '#1677ff' }} />
                  <Text strong style={{ fontSize: 14 }}>
                    {info.label}
                  </Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {info.description}
                </Text>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="Delete Page"
        open={deleteConfirmOpen}
        onOk={handleDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setPageToDelete(null);
        }}
        okText="Delete"
        okButtonProps={{ danger: true, loading: isDeleting }}
      >
        <Paragraph>
          Are you sure you want to delete this page? This action cannot be undone.
        </Paragraph>
      </Modal>
    </div>
  );
}

/**
 * Simple client-side markdown rendering for the preview tab.
 * This is a basic transformation; the server renders the full HTML via `marked`.
 */
function renderMarkdownPreview(markdown: string): string {
  if (!markdown) return '<p style="color: #999;">Nothing to preview</p>';

  const html = markdown
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/g, '').replace(/```/g, '');
      return `<pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto;"><code>${code}</code></pre>`;
    })
    // Inline code
    .replace(/`(.+?)`/g, '<code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">$1</code>')
    // Checkboxes
    .replace(/^- \[x\] (.+)$/gm, '<div><input type="checkbox" checked disabled /> $1</div>')
    .replace(/^- \[ \] (.+)$/gm, '<div><input type="checkbox" disabled /> $1</div>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Tables (basic)
    .replace(/\|(.+)\|/g, (match) => {
      if (match.match(/^\|[\s-|]+\|$/)) return '';
      const cells = match.split('|').filter(Boolean).map((c) => c.trim());
      return '<tr>' + cells.map((c) => `<td style="border: 1px solid #e8e8e8; padding: 8px;">${c}</td>`).join('') + '</tr>';
    })
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br />');

  return `<div>${html}</div>`;
}
