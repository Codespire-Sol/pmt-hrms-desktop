import { useEffect, useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor} from '@tiptap/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';       // v3: named export only
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TextStyle } from '@tiptap/extension-text-style'; // v3: named export only
import Color from '@tiptap/extension-color';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  List,
  ListOrdered,
  CheckSquare,
  Table as TableIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  Type,
  RowsIcon,
  Columns3,
} from 'lucide-react';
import './RichTextEditor.css';

// Setup lowlight with common languages
const lowlight = createLowlight();
lowlight.register('javascript', javascript);
lowlight.register('js', javascript);
lowlight.register('typescript', typescript);
lowlight.register('ts', typescript);
lowlight.register('python', python);
lowlight.register('py', python);
lowlight.register('java', java);
lowlight.register('css', css);
lowlight.register('html', xml);
lowlight.register('xml', xml);
lowlight.register('bash', bash);
lowlight.register('sh', bash);
lowlight.register('sql', sql);
lowlight.register('json', json);

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  minHeight?: number;
  autoFocus?: boolean;
  showToolbar?: boolean;
  compact?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'rte-toolbar-btn',
        isActive ? 'rte-toolbar-btn--active' : '',
        disabled ? 'rte-toolbar-btn--disabled' : '',
      ].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="rte-toolbar-divider" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const openLinkDialog = useCallback(() => {
    // Save selection before dialog steals focus
    const { from, to } = editor.state.selection;
    savedSelectionRef.current = { from, to };
    const previousUrl = editor.getAttributes('link').href;
    setLinkUrl(previousUrl || 'https://');
    setLinkDialogOpen(true);
  }, [editor]);

  const confirmLink = useCallback(() => {
    setLinkDialogOpen(false);
    if (!linkUrl.trim()) return;

    const sel = savedSelectionRef.current;
    const hasSelection = sel && sel.from !== sel.to;

    if (hasSelection) {
      // Text is selected — apply link mark on that selection
      editor
        .chain()
        .focus()
        .setTextSelection({ from: sel.from, to: sel.to })
        .setLink({ href: linkUrl, target: '_blank' })
        .run();
    } else {
      // No selection — insert the URL as linked text at cursor
      const pos = sel ? sel.from : editor.state.selection.from;
      editor
        .chain()
        .focus()
        .insertContentAt(pos, {
          type: 'text',
          text: linkUrl,
          marks: [{ type: 'link', attrs: { href: linkUrl, target: '_blank' } }],
        })
        .run();
    }
  }, [editor, linkUrl]);

  const openImageDialog = useCallback(() => {
    setImageUrl('');
    setImageDialogOpen(true);
  }, []);

  const confirmImage = useCallback(() => {
    setImageDialogOpen(false);
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
    }
  }, [editor, imageUrl]);

  const insertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  return (
    <div className="rte-toolbar">
      {/* Undo / Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo size={14} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      >
        <Heading1 size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setParagraph().run()}
        isActive={editor.isActive('paragraph')}
        title="Normal text"
      >
        <Type size={14} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Inline formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="Inline code"
      >
        <Code size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={openLinkDialog}
        isActive={editor.isActive('link')}
        title="Add link"
      >
        <LinkIcon size={14} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet list"
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Ordered list"
      >
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title="Task list"
      >
        <CheckSquare size={14} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Blocks */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Blockquote"
      >
        <Quote size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Code block"
      >
        <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{'{}'}</span>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      >
        <Minus size={14} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Table */}
      <ToolbarButton onClick={insertTable} title="Insert table">
        <TableIcon size={14} />
      </ToolbarButton>
      {editor.isActive('table') && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Add column after"
          >
            <Columns3 size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Add row after"
          >
            <RowsIcon size={14} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete table"
          >
            <span style={{ fontSize: 10, fontWeight: 600, color: '#ef4444' }}>×T</span>
          </ToolbarButton>
        </>
      )}

      {/* Image */}
      <ToolbarButton onClick={openImageDialog} title="Insert image">
        <ImageIcon size={14} />
      </ToolbarButton>

      {/* Link dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="https://"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmLink(); } }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmLink}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Enter image URL"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmImage(); } }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmImage}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Write something...',
  editable = true,
  minHeight = 120,
  autoFocus = false,
  showToolbar = true,
  compact = false,
}: RichTextEditorProps) {
  // Track whether the editor is focused so we never reset content while typing
  const focusedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by CodeBlockLowlight
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'rte-link', rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({ HTMLAttributes: { class: 'rte-image' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
    ],
    content: value,
    editable,
    autofocus: autoFocus,
    onFocus: () => { focusedRef.current = true; },
    onBlur:  () => { focusedRef.current = false; },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  // Sync external value changes ONLY when the editor is not focused.
  // This prevents the cursor from jumping while the user is typing and an
  // auto-save round-trip returns with the (slightly normalised) server HTML.
  useEffect(() => {
    if (!editor) return;
    if (focusedRef.current) return;   // user is actively editing – don't reset
    const currentHTML = editor.getHTML();
    if (currentHTML !== value && value !== undefined) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  // Sync editable prop
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editable, editor]);

  if (!editor) return null;

  return (
    <div className={['rte-root', compact ? 'rte-root--compact' : ''].filter(Boolean).join(' ')}>
      {editable && showToolbar && <Toolbar editor={editor} />}

      <EditorContent
        editor={editor}
        className="rte-content"
        style={{ minHeight: editable ? minHeight : undefined }}
      />
    </div>
  );
}

export default RichTextEditor;
