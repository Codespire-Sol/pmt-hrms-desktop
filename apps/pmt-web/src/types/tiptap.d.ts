declare module '@tiptap/react' {
  export class Editor {
    chain(): any;
    can(): any;
    isActive(name: string, attrs?: Record<string, any>): boolean;
    getAttributes(name: string): Record<string, any>;
    commands: Record<string, (...args: any[]) => any>;
    state: any;
    view: any;
    getHTML(): string;
    getText(): string;
    setEditable(editable: boolean): void;
    isEmpty: boolean;
    isDestroyed: boolean;
    on(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback: (...args: any[]) => void): void;
  }
  export function useEditor(options: any): Editor | null;
  export function EditorContent(props: any): any;
}
declare module '@tiptap/starter-kit';
declare module '@tiptap/extension-placeholder';
declare module '@tiptap/extension-link';
declare module '@tiptap/extension-image';
declare module '@tiptap/extension-table';
declare module '@tiptap/extension-table-row';
declare module '@tiptap/extension-table-header';
declare module '@tiptap/extension-table-cell';
declare module '@tiptap/extension-code-block-lowlight';
declare module '@tiptap/extension-task-list';
declare module '@tiptap/extension-task-item';
declare module '@tiptap/extension-text-style';
declare module '@tiptap/extension-color';
declare module 'lowlight';
declare module 'highlight.js/lib/languages/javascript';
declare module 'highlight.js/lib/languages/typescript';
declare module 'highlight.js/lib/languages/python';
declare module 'highlight.js/lib/languages/java';
declare module 'highlight.js/lib/languages/css';
declare module 'highlight.js/lib/languages/xml';
declare module 'highlight.js/lib/languages/bash';
declare module 'highlight.js/lib/languages/sql';
declare module 'highlight.js/lib/languages/json';
