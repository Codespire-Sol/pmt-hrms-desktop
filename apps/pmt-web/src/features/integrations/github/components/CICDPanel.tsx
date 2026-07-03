import React from 'react';
import { useGetBuildRunsQuery, type BuildRun } from '../githubApi';

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  pending:   { icon: '⏳', color: '#faad14', label: 'Pending'   },
  running:   { icon: '🔄', color: '#1890ff', label: 'Running'   },
  success:   { icon: '✅', color: '#52c41a', label: 'Success'   },
  failure:   { icon: '❌', color: '#ff4d4f', label: 'Failed'    },
  cancelled: { icon: '⛔', color: '#8c8c8c', label: 'Cancelled' },
  skipped:   { icon: '⏭️',  color: '#bfbfbf', label: 'Skipped'  },
};

function statusInfo(status: string) {
  return STATUS_CONFIG[status] ?? { icon: '❓', color: '#8c8c8c', label: status };
}

function formatDuration(startedAt: string | null, completedAt: string | null): string | null {
  if (!startedAt || !completedAt) return null;
  const secs = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
}

function ProviderBadge({ provider }: { provider: string }) {
  const isGitLab = provider === 'gitlab';
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: 3,
      fontSize: 10,
      fontWeight: 700,
      background: isGitLab ? '#fc6d26' : '#24292f',
      color: '#fff',
      marginLeft: 6,
      verticalAlign: 'middle',
    }}>
      {isGitLab ? 'GitLab' : 'GitHub'}
    </span>
  );
}

function BuildRunRow({ run }: { run: BuildRun }) {
  const { icon, color, label } = statusInfo(run.status);
  const duration = formatDuration(run.startedAt, run.completedAt);
  const timeAgo = run.completedAt
    ? new Date(run.completedAt).toLocaleString()
    : run.startedAt
    ? new Date(run.startedAt).toLocaleString()
    : null;

  return (
    <a
      href={run.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        borderRadius: 8,
        transition: 'background 0.15s',
        cursor: 'pointer',
      }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f7ff')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {/* Status icon */}
        <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>

        {/* Pipeline info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#101828', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {run.pipelineName}
            </span>
            <ProviderBadge provider={run.provider} />
          </div>
          <div style={{ fontSize: 11, color: '#6a7282', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            {run.branchRef && (
              <span>
                <span style={{ fontFamily: 'monospace', background: '#f0f0f0', padding: '0 4px', borderRadius: 3 }}>
                  {run.branchRef}
                </span>
              </span>
            )}
            <span style={{ fontFamily: 'monospace', color: '#8c8c8c' }}>
              {run.commitSha.substring(0, 7)}
            </span>
            {timeAgo && <span>{timeAgo}</span>}
          </div>
        </div>

        {/* Status label + duration */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color }}>
            {label}
          </span>
          {duration && (
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{duration}</div>
          )}
        </div>
      </div>
    </a>
  );
}

interface CICDPanelProps {
  issueId: string;
}

export function CICDPanel({ issueId }: CICDPanelProps) {
  const { data: builds, isLoading } = useGetBuildRunsQuery(issueId);

  if (isLoading) {
    return (
      <div style={{ padding: '12px 0', color: '#8c8c8c', fontSize: 13 }}>
        Loading CI/CD status…
      </div>
    );
  }

  if (!builds || builds.length === 0) {
    return (
      <div style={{
        padding: '12px',
        borderRadius: 8,
        background: '#fafafa',
        border: '1px dashed #e5e7eb',
        textAlign: 'center',
        color: '#8c8c8c',
        fontSize: 13,
      }}>
        No build runs linked to this issue.
        <div style={{ fontSize: 11, marginTop: 4 }}>
          Builds are linked automatically when a commit referencing this issue key is pushed to a connected GitHub or GitLab repository.
        </div>
      </div>
    );
  }

  // Group by provider
  const githubBuilds = builds.filter((b) => b.provider === 'github');
  const gitlabBuilds = builds.filter((b) => b.provider === 'gitlab');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {builds.map((run) => (
        <BuildRunRow key={run.id} run={run} />
      ))}
    </div>
  );
}

export default CICDPanel;
