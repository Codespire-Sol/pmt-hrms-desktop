import { createContext, useContext, useState, useCallback } from 'react';
import { Modal } from 'antd';
import { IssueDetailPage } from './IssueDetailPage';

// ─── Context ──────────────────────────────────────────────────────────────────

interface IssueModalState {
  issueId: string | null;
  projectId?: string;
}

interface IssueModalContextValue {
  openIssue: (issueId: string, projectId?: string) => void;
  closeIssue: () => void;
}

const IssueModalContext = createContext<IssueModalContextValue>({
  openIssue: () => {},
  closeIssue: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function IssueModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<IssueModalState>({ issueId: null });

  const openIssue = useCallback((issueId: string, projectId?: string) => {
    setState({ issueId, projectId });
  }, []);

  const closeIssue = useCallback(() => {
    setState({ issueId: null });
  }, []);

  return (
    <IssueModalContext.Provider value={{ openIssue, closeIssue }}>
      {children}
      <Modal
        open={!!state.issueId}
        onCancel={closeIssue}
        footer={null}
        width={1100}
        destroyOnClose
        style={{ top: 24, paddingBottom: 24 }}
        styles={{
          body: {
            padding: 0,
            height: 'calc(100vh - 112px)',
            overflow: 'hidden',
          },
        }}
        className="issue-detail-modal"
      >
        {state.issueId && (
          <IssueDetailPage
            issueId={state.issueId}
            projectId={state.projectId}
            onBack={closeIssue}
          />
        )}
      </Modal>
    </IssueModalContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIssueModal() {
  return useContext(IssueModalContext);
}
