import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  Badge,
  Button,
  Card,
  Divider,
  Drawer,
  Empty,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Circle,
  CornerDownRight,
  Filter,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  UserCircle2,
} from "lucide-react";
import { format } from "date-fns";
import {
  BacklogIssue,
  Sprint,
  useAddIssuesToSprintMutation,
  useGetBacklogQuery,
  useGetSprintsQuery,
  useRemoveIssueFromSprintMutation,
  useStartSprintMutation,
} from "../sprints/sprintsApi";
import { CreateSprintDialog } from "../sprints/CreateSprintDialog";
import { CompleteSprintDialog } from "../sprints/CompleteSprintDialog";
import {
  useGetEpicIssuesQuery,
  useGetProjectEpicsQuery,
  type Epic,
} from "../epics/epicsApi";
import { EpicFormModal } from "../epics/EpicFormModal";
import { useIssueModal } from "../issues/IssueDetailModal";
import { normalizeAvatarUrl } from "@/lib/utils";
import { useUpdateIssueMutation } from "../issues/issuesApi";
import { CreateIssueModal } from "../issues/components/CreateIssueModal";
import { useGetBoardQuery } from "../boards/boardsApi";
import { useGetProjectMembersQuery } from "../projects/projectsApi";
import { usePermission as usePermissionGuard } from "../rbac/components/PermissionGuard";

const { Title, Text } = Typography;

type DensityMode = "default" | "compact";
type EpicFilterMode = "all" | "none" | string;

interface FieldVisibility {
  showWorkType: boolean;
  showIssueKey: boolean;
  showEpic: boolean;
  showDueDate: boolean;
  showStatus: boolean;
  showPriority: boolean;
  showAssignee: boolean;
  showStoryPoints: boolean;
}

interface StatusOption {
  value: string;
  label: string;
}

const COLORS = {
  primary: "#1268ff",
  success: "#10b981",
  warning: "#faad14",
  danger: "#ff4d4f",
  textPrimary: "#101828",
  textSecondary: "#4a5565",
  border: "#e5e7eb",
  surface: "#ffffff",
  appBg: "#f9fafb",
  panelBg: "#ffffff",
  accent: "rgba(18, 104, 255, 0.08)",
  shadow: "0 8px 16px rgba(16, 24, 40, 0.06)",
};

const DEFAULT_FIELDS: FieldVisibility = {
  showWorkType: true,
  showIssueKey: true,
  showEpic: true,
  showDueDate: true,
  showStatus: true,
  showPriority: true,
  showAssignee: true,
  showStoryPoints: true,
};

// Fixed column widths — shared between header and rows to ensure alignment
const COL_WIDTHS = {
  key:      96,
  status:   148,
  priority: 90,
  dueDate:  72,
  assignee: 140,
  sp:       62,
};

const getIssueTitle = (issue: any) =>
  issue?.title || issue?.summary || "Untitled issue";

/**
 * Build 3-level tree: Epic → Issue → Sub-Issue
 * - Level 0: Epics (issues with type.name === 'epic') + standalone issues (no epic, no parent)
 * - Level 1: Issues linked to an epic via epicId, or child issues via parentId of an epic
 * - Level 2: Sub-issues linked to a level-1 issue via parentId
 */
function buildTreeOrder(
  issues: any[],
  collapsedIds: Set<string> = new Set()
): Array<{ issue: any; depth: number; childCount: number }> {
  const isEpicType = (issue: any) => (issue.type?.name || '').toLowerCase() === 'epic';
  const issueMap = new Map(issues.map(i => [i.id, i]));

  // Group: children by parentId
  const childrenByParent = new Map<string, any[]>();
  // Group: issues by epicId
  const issuesByEpic = new Map<string, any[]>();
  // Epics
  const epics: any[] = [];
  // Standalone (no epic, no parent, not an epic type)
  const standalone: any[] = [];

  for (const issue of issues) {
    if (isEpicType(issue)) {
      epics.push(issue);
      continue;
    }

    const pid = issue.parentId;
    if (pid && issueMap.has(pid) && !isEpicType(issueMap.get(pid)!)) {
      // Sub-issue: parent is a non-epic issue
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid)!.push(issue);
      continue;
    }

    const eid = issue.epicId;
    if (eid && issues.some(i => i.id === eid && isEpicType(i))) {
      // Issue linked to an epic
      if (!issuesByEpic.has(eid)) issuesByEpic.set(eid, []);
      issuesByEpic.get(eid)!.push(issue);
      continue;
    }

    if (pid && issueMap.has(pid) && isEpicType(issueMap.get(pid)!)) {
      // Issue whose parent is an epic (treat parentId as epicId)
      if (!issuesByEpic.has(pid)) issuesByEpic.set(pid, []);
      issuesByEpic.get(pid)!.push(issue);
      continue;
    }

    // Standalone issue
    standalone.push(issue);
  }

  const result: Array<{ issue: any; depth: number; childCount: number }> = [];

  // Render epics first
  for (const epic of epics) {
    const epicIssues = issuesByEpic.get(epic.id) || [];
    const totalChildren = epicIssues.reduce(
      (sum, i) => sum + (childrenByParent.get(i.id)?.length || 0),
      0
    );
    result.push({ issue: epic, depth: 0, childCount: epicIssues.length });

    if (!collapsedIds.has(epic.id)) {
      for (const child of epicIssues) {
        const subTasks = childrenByParent.get(child.id) || [];
        result.push({ issue: child, depth: 1, childCount: subTasks.length });

        if (!collapsedIds.has(child.id)) {
          for (const sub of subTasks) {
            result.push({ issue: sub, depth: 2, childCount: 0 });
          }
        }
      }
    }
  }

  // Render standalone issues (not linked to any epic)
  for (const issue of standalone) {
    const subTasks = childrenByParent.get(issue.id) || [];
    result.push({ issue, depth: 0, childCount: subTasks.length });

    if (!collapsedIds.has(issue.id)) {
      for (const sub of subTasks) {
        result.push({ issue: sub, depth: 1, childCount: 0 });
      }
    }
  }

  return result;
}

const getIssueEpicId = (issue: any): string | null =>
  issue?.epicId || issue?.epic?.id || issue?.epic?.epicId || null;

const getIssueEpicName = (issue: any): string | undefined =>
  issue?.epic?.name || issue?.epicName;

const getIssueDueDate = (issue: any): string | undefined =>
  issue?.dueDate || issue?.due_date;

const getIssueStatusCategory = (
  issue: any,
): "todo" | "in_progress" | "done" => {
  const fromCategory = String(
    issue?.status?.category || issue?.statusCategory || "",
  ).toLowerCase();
  const fromName = String(issue?.status?.name || "").toLowerCase();
  if (
    fromCategory === "done" ||
    fromName.includes("done") ||
    fromName.includes("closed")
  )
    return "done";
  if (
    fromCategory === "in_progress" ||
    fromName.includes("progress") ||
    fromName.includes("doing")
  )
    return "in_progress";
  return "todo";
};

const countByStatus = (issues: any[]) => {
  return issues.reduce(
    (acc, issue) => {
      const category = getIssueStatusCategory(issue);
      acc[category] += 1;
      return acc;
    },
    { todo: 0, in_progress: 0, done: 0 },
  );
};

const formatDateLabel = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "MMM d");
};
function AssigneeAvatar({ assignee }: { assignee?: any }) {
  const [imgFailed, setImgFailed] = useState(false);
  const avatarUrl = assignee?.avatarUrl
    ? normalizeAvatarUrl(assignee.avatarUrl)
    : undefined;
  const initial = assignee?.displayName?.[0]?.toUpperCase() ?? '';

  if (!assignee) {
    return <UserCircle2 size={18} color="#9aa4b2" />;
  }

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt={assignee.displayName}
        onError={() => setImgFailed(true)}
        style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }

  // Fallback: coloured initials circle
  return (
    <span style={{
      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
      background: COLORS.primary, color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 700,
    }}>
      {initial || <UserCircle2 size={13} />}
    </span>
  );
}

function AssigneeCell({ assignee }: { assignee?: any }) {
  const name = assignee?.displayName || "Unassigned";

  return (
    <div
      style={{
        width: COL_WIDTHS.assignee,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflow: "hidden",
      }}
    >
      <AssigneeAvatar assignee={assignee} />
      <span
        style={{
          fontSize: 12,
          color: assignee ? COLORS.textPrimary : COLORS.textSecondary,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name}
      </span>
    </div>
  );
}

function BacklogTableHeader({
  fields,
  density,
  canUpdateIssue,
}: {
  fields: FieldVisibility;
  density: DensityMode;
  canUpdateIssue: boolean;
}) {
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    userSelect: "none",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: density === "compact" ? "5px 12px" : "7px 12px",
        borderBottom: `1px solid ${COLORS.border}`,
        background: "#f8fafc",
      }}
    >
      {/* Title column */}
      <div style={{ flex: 1, ...labelStyle }}>Issue</div>

      {fields.showIssueKey && (
        <div style={{ width: COL_WIDTHS.key, ...labelStyle }}>Key</div>
      )}
      {fields.showStatus && (
        <div style={{ width: COL_WIDTHS.status, ...labelStyle }}>Status</div>
      )}
      {fields.showPriority && (
        <div style={{ width: COL_WIDTHS.priority, ...labelStyle }}>Priority</div>
      )}
      {fields.showDueDate && (
        <div style={{ width: COL_WIDTHS.dueDate, ...labelStyle }}>Due</div>
      )}
      {fields.showAssignee && (
        <div style={{ width: COL_WIDTHS.assignee, textAlign: "center", ...labelStyle }}>
          Assignee
        </div>
      )}
      {fields.showStoryPoints && canUpdateIssue && (
        <div style={{ width: COL_WIDTHS.sp, textAlign: "center", ...labelStyle }}>
          SP
        </div>
      )}
    </div>
  );
}

/** Wrapper that manages expand/collapse state for tree view */
function TreeBacklogList({
  issues, density, fields, statusOptions, canUpdateIssue,
  onOpenIssue, onChangeStatus, onChangePoints,
}: {
  issues: any[];
  density: DensityMode;
  fields: FieldVisibility;
  statusOptions: StatusOption[];
  canUpdateIssue: boolean;
  onOpenIssue: (issueId: string) => void;
  onChangeStatus: (issueId: string, statusId: string) => void;
  onChangePoints?: (issueId: string, points: number | null) => void;
}) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (issueId: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  };

  const treeItems = buildTreeOrder(issues, collapsedIds);

  return (
    <>
      {treeItems.map(({ issue, depth, childCount }) => (
        <BacklogIssueRow
          key={issue.id}
          issue={issue}
          density={density}
          fields={fields}
          statusOptions={statusOptions}
          canUpdateIssue={canUpdateIssue}
          onOpenIssue={onOpenIssue}
          onChangeStatus={onChangeStatus}
          onChangePoints={onChangePoints}
          depth={depth}
          childCount={childCount}
          isExpanded={!collapsedIds.has(issue.id)}
          onToggleExpand={() => toggleExpand(issue.id)}
        />
      ))}
    </>
  );
}

function BacklogIssueRow({
  issue,
  density,
  fields,
  statusOptions,
  canUpdateIssue,
  onOpenIssue,
  onChangeStatus,
  onChangePoints,
  depth = 0,
  childCount = 0,
  isExpanded,
  onToggleExpand,
}: {
  issue: any;
  density: DensityMode;
  fields: FieldVisibility;
  statusOptions: StatusOption[];
  canUpdateIssue: boolean;
  onOpenIssue: (issueId: string) => void;
  onChangeStatus: (issueId: string, statusId: string) => void;
  onChangePoints?: (issueId: string, points: number | null) => void;
  depth?: number;
  childCount?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const rowHeight = density === "compact" ? 40 : 48;
  const statusId = issue?.status?.id || issue?.statusId;
  const epicName = getIssueEpicName(issue);
  const dueDate = getIssueDueDate(issue);

  return (
    <div>
      <div
        onClick={() => onOpenIssue(issue.id)}
        style={{
          minHeight: rowHeight,
          paddingTop: density === "compact" ? 5 : 7,
          paddingBottom: density === "compact" ? 5 : 7,
          paddingLeft: 12,
          paddingRight: 12,
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          backgroundColor: depth > 0 ? "#fafbfc" : "#ffffff",
          transition: "background-color 0.15s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f0f5ff'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = depth > 0 ? '#fafbfc' : '#ffffff'; }}
      >
        {/* ── Title column (flex 1) — handles indentation internally ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingLeft: depth * 24,
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          {/* Type dot */}
          {fields.showWorkType && (
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: issue.type?.color || COLORS.primary,
                flexShrink: 0,
              }}
            />
          )}

          {/* Expand/collapse for parents */}
          {childCount > 0 && (
            <div
              onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                height: 20,
                borderRadius: 5,
                cursor: "pointer",
                color: COLORS.primary,
                flexShrink: 0,
                padding: "0 5px 0 2px",
                background: isExpanded ? `${COLORS.primary}08` : "#f1f5f9",
                border: `1px solid ${isExpanded ? COLORS.primary + "20" : "#e2e8f0"}`,
                transition: "all 0.15s",
              }}
            >
              <ChevronRight size={11} style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
              <span style={{ fontSize: 10, fontWeight: 700 }}>{childCount}</span>
            </div>
          )}

          {/* Tree connector for child rows */}
          {depth > 0 && childCount === 0 && (
            <CornerDownRight size={13} style={{ color: COLORS.textSecondary, flexShrink: 0 }} />
          )}

          {fields.showEpic && epicName && (
            <Tag style={{ margin: 0, borderRadius: 999, fontSize: 10, lineHeight: "18px", padding: "0 6px", flexShrink: 0 }} color="purple">
              {epicName}
            </Tag>
          )}

          <Text
            style={{
              color: COLORS.textPrimary,
              fontSize: density === "compact" ? 12 : 13,
              lineHeight: 1.4,
            }}
            ellipsis
          >
            {getIssueTitle(issue)}
          </Text>
        </div>

        {/* ── Fixed-width columns ── */}

        {fields.showIssueKey && (
          <div style={{ width: COL_WIDTHS.key, flexShrink: 0 }}>
            <Text
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                color: COLORS.primary,
              }}
            >
              {issue.issueKey}
            </Text>
          </div>
        )}

        {fields.showStatus && (
          <div style={{ width: COL_WIDTHS.status, flexShrink: 0 }}>
            {(() => {
              const hasMatchingOption = statusOptions.some(o => o.value === statusId);
              if (statusOptions.length > 0 && hasMatchingOption) {
                return (
                  <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                    <Select
                      size="small"
                      value={statusId}
                      options={statusOptions}
                      style={{ width: COL_WIDTHS.status - 8 }}
                      onChange={(value) => onChangeStatus(issue.id, value)}
                      disabled={!canUpdateIssue}
                    />
                  </div>
                );
              }
              const statusLabel = issue.status?.displayName || issue.status?.name;
              return statusLabel ? (
                <Tag style={{ margin: 0, borderRadius: 6, fontSize: 11 }}>{statusLabel}</Tag>
              ) : null;
            })()}
          </div>
        )}

        {fields.showPriority && (
          <div style={{ width: COL_WIDTHS.priority, flexShrink: 0 }}>
            {issue.priority && (
              <Tag style={{ margin: 0, borderRadius: 999, fontSize: 11 }}>
                {issue.priority.displayName || issue.priority.name}
              </Tag>
            )}
          </div>
        )}

        {fields.showDueDate && (
          <div style={{ width: COL_WIDTHS.dueDate, flexShrink: 0 }}>
            {dueDate && (
              <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                {formatDateLabel(dueDate)}
              </Text>
            )}
          </div>
        )}

        {fields.showAssignee && (
          <AssigneeCell assignee={issue.assignee} />
        )}

        {fields.showStoryPoints && canUpdateIssue && (
          <div
            style={{ width: COL_WIDTHS.sp, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <InputNumber
              size="small"
              min={0}
              max={999}
              value={issue.storyPoints ?? null}
              placeholder="SP"
              style={{ width: COL_WIDTHS.sp - 4, fontSize: 12, borderRadius: 4 }}
              controls={false}
              onBlur={(e) => {
                const raw = e.target.value;
                const val = raw === "" ? null : parseInt(raw, 10);
                if (!isNaN(val as number) || val === null) {
                  onChangePoints?.(issue.id, val);
                }
              }}
              onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
function SprintLane({
  sprint,
  filterIssue,
  showEmptySprints,
  density,
  fields,
  statusOptions,
  canUpdateIssue,
  canManageSprints,
  onOpenIssue,
  onChangeStatus,
  onChangePoints,
  onCreateIssue,
  onStartSprint,
  onCompleteSprint,
}: {
  sprint: Sprint;
  filterIssue: (issue: any) => boolean;
  showEmptySprints: boolean;
  density: DensityMode;
  fields: FieldVisibility;
  statusOptions: StatusOption[];
  canUpdateIssue: boolean;
  canManageSprints: boolean;
  onOpenIssue: (issueId: string) => void;
  onChangeStatus: (issueId: string, statusId: string) => void;
  onChangePoints?: (issueId: string, points: number | null) => void;
  onCreateIssue: (sprintId?: string) => void;
  onStartSprint: (sprintId: string) => void;
  onCompleteSprint: (sprint: Sprint) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `sprint-${sprint.id}` });
  const visibleIssues = (sprint.issues || []).filter(filterIssue);
  const counts = countByStatus(visibleIssues);

  if (!showEmptySprints && visibleIssues.length === 0) return null;

  return (
    <div
      ref={setNodeRef}
      style={{
        border: `1px solid ${isOver ? COLORS.primary : COLORS.border}`,
        borderRadius: 10,
        background: "#ffffff",
        boxShadow: isOver ? "0 0 0 2px rgba(18,104,255,0.15)" : "none",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <ChevronDown size={14} color={COLORS.textSecondary} />
        <Text strong style={{ color: COLORS.textPrimary }}>
          {sprint.name}
        </Text>
        {sprint.startDate && sprint.endDate && (
          <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
            {format(new Date(sprint.startDate), "d MMM")} -{" "}
            {format(new Date(sprint.endDate), "d MMM")}
          </Text>
        )}
        <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
          ({visibleIssues.length} work item
          {visibleIssues.length !== 1 ? "s" : ""})
        </Text>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Tag style={{ margin: 0, borderRadius: 4 }}>{counts.todo}</Tag>
          <Tag color="blue" style={{ margin: 0, borderRadius: 4 }}>
            {counts.in_progress}
          </Tag>
          <Tag color="green" style={{ margin: 0, borderRadius: 4 }}>
            {counts.done}
          </Tag>
          <Button
            size="small"
            disabled={!canManageSprints}
            onClick={() =>
              sprint.status === "active"
                ? onCompleteSprint(sprint)
                : onStartSprint(sprint.id)
            }
          >
            {sprint.status === "active" ? "Complete sprint" : "Start sprint"}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<MoreHorizontal size={14} />}
          />
        </div>
      </div>

      <BacklogTableHeader fields={fields} density={density} canUpdateIssue={canUpdateIssue} />

      <div style={{ minHeight: density === "compact" ? 40 : 52 }}>
        {visibleIssues.length > 0 ? (
          <TreeBacklogList
            issues={visibleIssues}
            density={density}
            fields={fields}
            statusOptions={statusOptions}
            canUpdateIssue={canUpdateIssue}
            onOpenIssue={onOpenIssue}
            onChangeStatus={onChangeStatus}
            onChangePoints={onChangePoints}
          />
        ) : (
          <div
            style={{
              margin: 12,
              border: `1px dashed ${COLORS.border}`,
              borderRadius: 8,
              padding: "14px 12px",
              color: COLORS.textSecondary,
              textAlign: "center",
              fontSize: 13,
            }}
          >
            There&apos;s nothing that matches this filter
          </div>
        )}
      </div>

      {/* Create row — styled like a table row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderTop: `1px solid ${COLORS.border}`,
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#f0f5ff"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
        onClick={() => onCreateIssue(sprint.id)}
      >
        <Plus size={13} color={COLORS.textSecondary} />
        <span style={{ fontSize: 13, color: COLORS.textSecondary }}>Create issue</span>
      </div>
    </div>
  );
}

function BacklogLane({
  issues,
  filterIssue,
  density,
  fields,
  statusOptions,
  canUpdateIssue,
  canManageSprints,
  onOpenIssue,
  onChangeStatus,
  onChangePoints,
  onCreateIssue,
  onCreateSprint,
}: {
  issues: BacklogIssue[];
  filterIssue: (issue: any) => boolean;
  density: DensityMode;
  fields: FieldVisibility;
  statusOptions: StatusOption[];
  canUpdateIssue: boolean;
  canManageSprints: boolean;
  onOpenIssue: (issueId: string) => void;
  onChangeStatus: (issueId: string, statusId: string) => void;
  onChangePoints?: (issueId: string, points: number | null) => void;
  onCreateIssue: () => void;
  onCreateSprint: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "backlog" });
  const visibleIssues = issues.filter(filterIssue);
  const counts = countByStatus(visibleIssues);

  return (
    <div
      ref={setNodeRef}
      style={{
        border: `1px solid ${isOver ? COLORS.primary : COLORS.border}`,
        borderRadius: 10,
        background: "#ffffff",
        boxShadow: isOver ? "0 0 0 2px rgba(18,104,255,0.15)" : "none",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <ChevronDown size={14} color={COLORS.textSecondary} />
        <Text strong style={{ color: COLORS.textPrimary }}>
          Backlog
        </Text>
        <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
          ({visibleIssues.length} work item
          {visibleIssues.length !== 1 ? "s" : ""})
        </Text>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Tag style={{ margin: 0, borderRadius: 4 }}>{counts.todo}</Tag>
          <Tag color="blue" style={{ margin: 0, borderRadius: 4 }}>
            {counts.in_progress}
          </Tag>
          <Tag color="green" style={{ margin: 0, borderRadius: 4 }}>
            {counts.done}
          </Tag>
          {/* Sprint creation hidden — simplified workflow */}
        </div>
      </div>

      <BacklogTableHeader fields={fields} density={density} canUpdateIssue={canUpdateIssue} />

      <div style={{ minHeight: density === "compact" ? 40 : 52 }}>
        {visibleIssues.length > 0 ? (
          <TreeBacklogList
            issues={visibleIssues}
            density={density}
            fields={fields}
            statusOptions={statusOptions}
            canUpdateIssue={canUpdateIssue}
            onOpenIssue={onOpenIssue}
            onChangeStatus={onChangeStatus}
            onChangePoints={onChangePoints}
          />
        ) : (
          <div
            style={{
              margin: 12,
              border: `1px dashed ${COLORS.border}`,
              borderRadius: 8,
              padding: "14px 12px",
              color: COLORS.textSecondary,
              textAlign: "center",
              fontSize: 13,
            }}
          >
            Your backlog is empty.
          </div>
        )}
      </div>

      {/* Create row — styled like a table row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderTop: `1px solid ${COLORS.border}`,
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#f0f5ff"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
        onClick={onCreateIssue}
      >
        <Plus size={13} color={COLORS.textSecondary} />
        <span style={{ fontSize: 13, color: COLORS.textSecondary }}>Create issue</span>
      </div>
    </div>
  );
}
export function BacklogPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEpicFilter, setSelectedEpicFilter] =
    useState<EpicFilterMode>("all");

  const [showEpicPanel, setShowEpicPanel] = useState(true);
  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);
  const [showEmptySprints, setShowEmptySprints] = useState(true);
  const [density, setDensity] = useState<DensityMode>("default");
  const [fieldVisibility, setFieldVisibility] =
    useState<FieldVisibility>(DEFAULT_FIELDS);

  const [activeIssue, setActiveIssue] = useState<any | null>(null);
  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);
  const { openIssue } = useIssueModal();
  const [isCreateEpicOpen, setIsCreateEpicOpen] = useState(false);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [createIssueEpicId, setCreateIssueEpicId] = useState<string | null>(null);
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [sprintToComplete, setSprintToComplete] = useState<Sprint | null>(null);
  const [newIssueTargetSprintId, setNewIssueTargetSprintId] = useState<
    string | null
  >(null);
  const [createIssueStatusId, setCreateIssueStatusId] = useState<
    string | undefined
  >(undefined);
  const [localSprints, setLocalSprints] = useState<Sprint[]>([]);
  const [localBacklogIssues, setLocalBacklogIssues] = useState<BacklogIssue[]>(
    [],
  );

  const { hasPermission: canCreateIssue } = usePermissionGuard("issues.create");
  const { hasPermission: canUpdateIssue } = usePermissionGuard(
    ["issues.update", "issues.update_own"],
    "any",
  );
  const { hasPermission: canManageSprints } =
    usePermissionGuard("sprints.manage");

  const {
    data: sprintsData,
    isLoading: sprintsLoading,
    refetch: refetchSprints,
  } = useGetSprintsQuery(
    { projectId: projectId!, status: "planned,active" },
    { skip: !projectId },
  );
  const {
    data: backlogData,
    isLoading: backlogLoading,
    refetch: refetchBacklog,
  } = useGetBacklogQuery(
    {
      projectId: projectId!,
      params: {
        page: 1,
        limit: 200,
        ...(selectedEpicFilter !== 'all' && selectedEpicFilter !== 'none'
          ? { epicId: selectedEpicFilter }
          : {}),
      },
    },
    { skip: !projectId },
  );
  const { data: boardData } = useGetBoardQuery(
    { projectId: projectId! },
    { skip: !projectId },
  );
  const { data: membersData } = useGetProjectMembersQuery(projectId!, {
    skip: !projectId,
  });
  const { data: epics = [], isLoading: epicsLoading } = useGetProjectEpicsQuery(
    { projectId: projectId! },
    { skip: !projectId },
  );

  const { data: selectedEpicIssuesData, isLoading: selectedEpicIssuesLoading } =
    useGetEpicIssuesQuery(
      { epicId: selectedEpic?.id || "" },
      { skip: !selectedEpic?.id },
    );

  const [addIssuesToSprint] = useAddIssuesToSprintMutation();
  const [removeIssueFromSprint] = useRemoveIssueFromSprintMutation();
  const [updateIssue] = useUpdateIssueMutation();
  const [startSprint] = useStartSprintMutation();

  const queriedSprints = useMemo(() => {
    const all = sprintsData?.sprints || [];
    return all.filter((s) => s.status === "planned" || s.status === "active");
  }, [sprintsData]);

  const queriedBacklogIssues = backlogData?.issues || [];

  useEffect(() => {
    setLocalSprints(queriedSprints);
  }, [queriedSprints]);

  useEffect(() => {
    setLocalBacklogIssues(queriedBacklogIssues);
  }, [queriedBacklogIssues]);

  const sprints = localSprints;
  const backlogIssues = localBacklogIssues;
  const allIssues = useMemo(
    () => [...sprints.flatMap((s) => s.issues || []), ...backlogIssues],
    [sprints, backlogIssues],
  );

  const statusOptions = useMemo<StatusOption[]>(
    () =>
      ((boardData as any)?.columns || []).map((column: any) => ({
        value: column.id,
        label: column.displayName || column.name,
      })),
    [boardData],
  );

  const defaultCreateStatusId = useMemo(() => {
    const columns = (boardData as any)?.columns || [];
    const todoColumn = columns.find((col: any) => col.category === "todo");
    return todoColumn?.id || columns[0]?.id;
  }, [boardData]);

  const issueTypesForCreate = useMemo(
    () =>
      (((boardData as any)?.filters?.types || []) as any[])
        .map((t) => ({ id: t.id, name: t.displayName || t.name })),
    [boardData],
  );

  const prioritiesForCreate = useMemo(
    () =>
      (((boardData as any)?.filters?.priorities || []) as any[]).map((p) => ({
        id: p.id,
        name: p.displayName || p.name,
      })),
    [boardData],
  );

  const membersForCreate = useMemo(() => {
    const projectMembers = membersData || [];
    if (projectMembers.length > 0) {
      return projectMembers.map((member: any) => ({
        id: member.user.id,
        displayName: member.user.displayName,
      }));
    }
    return (((boardData as any)?.filters?.assignees || []) as any[]).map(
      (assignee) => ({
        id: assignee.id,
        displayName: assignee.displayName,
      }),
    );
  }, [membersData, boardData]);

  const epicIssueCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of allIssues as any[]) {
      const epicId = getIssueEpicId(issue);
      if (!epicId) continue;
      counts.set(epicId, (counts.get(epicId) || 0) + 1);
    }
    return counts;
  }, [allIssues]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const filterIssue = useCallback(
    (issue: any) => {
      const search = searchTerm.toLowerCase();
      const title = getIssueTitle(issue).toLowerCase();
      const issueKey = String(issue.issueKey || "").toLowerCase();
      const matchesSearch =
        !search || title.includes(search) || issueKey.includes(search);

      const epicId = getIssueEpicId(issue);
      const matchesEpic =
        selectedEpicFilter === "all"
          ? true
          : selectedEpicFilter === "none"
            ? !epicId
            : epicId === selectedEpicFilter;

      return matchesSearch && matchesEpic;
    },
    [searchTerm, selectedEpicFilter],
  );

  const findIssue = useCallback(
    (id: string) => {
      const fromBacklog = backlogIssues.find((issue) => issue.id === id);
      if (fromBacklog) return fromBacklog;
      for (const sprint of sprints) {
        const sprintIssue = (sprint.issues || []).find(
          (issue) => issue.id === id,
        );
        if (sprintIssue) return sprintIssue;
      }
      return null;
    },
    [backlogIssues, sprints],
  );

  const findSourceContainer = useCallback(
    (issueId: string): string | null => {
      if (backlogIssues.find((issue) => issue.id === issueId)) return "backlog";
      for (const sprint of sprints) {
        if ((sprint.issues || []).find((issue) => issue.id === issueId)) {
          return `sprint-${sprint.id}`;
        }
      }
      return null;
    },
    [backlogIssues, sprints],
  );

  const resolveTargetContainer = useCallback(
    (overId: string): string | null => {
      if (overId === "backlog" || overId.startsWith("sprint-")) return overId;
      return findSourceContainer(overId);
    },
    [findSourceContainer],
  );

  const getOptimisticMoveResult = useCallback(
    (
      currentSprints: Sprint[],
      currentBacklogIssues: BacklogIssue[],
      issueId: string,
      sourceId: string,
      targetId: string,
      overId: string,
    ) => {
      const nextSprints = currentSprints.map((sprint) => ({
        ...sprint,
        issues: [...(sprint.issues || [])],
      }));
      const nextBacklogIssues = [...currentBacklogIssues];

      const removeIssueById = (list: any[]) => {
        const issueIndex = list.findIndex((issue) => issue.id === issueId);
        if (issueIndex === -1) return null;
        const [removed] = list.splice(issueIndex, 1);
        return removed;
      };

      let movingIssue: any = null;

      if (sourceId === "backlog") {
        movingIssue = removeIssueById(nextBacklogIssues);
      } else if (sourceId.startsWith("sprint-")) {
        const sourceSprintId = sourceId.replace("sprint-", "");
        const sourceSprint = nextSprints.find(
          (sprint) => sprint.id === sourceSprintId,
        );
        if (sourceSprint) {
          movingIssue = removeIssueById(sourceSprint.issues || []);
        }
      }

      if (!movingIssue) return null;

      movingIssue = {
        ...movingIssue,
        sprintId:
          targetId === "backlog" ? null : targetId.replace("sprint-", ""),
      };

      const getInsertIndex = (list: any[]) => {
        if (overId === targetId) return list.length;
        const overIndex = list.findIndex((issue) => issue.id === overId);
        return overIndex >= 0 ? overIndex : list.length;
      };

      if (targetId === "backlog") {
        const insertIndex = getInsertIndex(nextBacklogIssues);
        nextBacklogIssues.splice(insertIndex, 0, movingIssue);
      } else if (targetId.startsWith("sprint-")) {
        const targetSprintId = targetId.replace("sprint-", "");
        const targetSprint = nextSprints.find(
          (sprint) => sprint.id === targetSprintId,
        );
        if (!targetSprint) return null;
        const targetIssues = targetSprint.issues || (targetSprint.issues = []);
        const insertIndex = getInsertIndex(targetIssues);
        targetIssues.splice(insertIndex, 0, movingIssue);
      }

      return { nextSprints, nextBacklogIssues };
    },
    [],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const refreshBacklogData = async () => {
    await Promise.allSettled([refetchSprints(), refetchBacklog()]);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const issueId = event.active.id as string;
    setActiveIssue(findIssue(issueId));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIssue(null);

    if (!over) return;

    const issueId = active.id as string;
    const sourceId = findSourceContainer(issueId);
    const targetId = resolveTargetContainer(over.id as string);

    if (!sourceId || !targetId || sourceId === targetId) return;

    const optimisticMove = getOptimisticMoveResult(
      sprints,
      backlogIssues,
      issueId,
      sourceId,
      targetId,
      over.id as string,
    );
    if (!optimisticMove) return;

    const previousSprints = sprints;
    const previousBacklogIssues = backlogIssues;
    setLocalSprints(optimisticMove.nextSprints);
    setLocalBacklogIssues(optimisticMove.nextBacklogIssues);

    try {
      if (targetId.startsWith("sprint-")) {
        const targetSprintId = targetId.replace("sprint-", "");
        if (sourceId.startsWith("sprint-")) {
          const sourceSprintId = sourceId.replace("sprint-", "");
          await removeIssueFromSprint({
            sprintId: sourceSprintId,
            issueId,
          }).unwrap();
        }
        await addIssuesToSprint({
          sprintId: targetSprintId,
          issueIds: [issueId],
        }).unwrap();
        message.success("Issue moved successfully");
      } else if (targetId === "backlog" && sourceId.startsWith("sprint-")) {
        const sourceSprintId = sourceId.replace("sprint-", "");
        await removeIssueFromSprint({
          sprintId: sourceSprintId,
          issueId,
        }).unwrap();
        message.success("Issue moved to backlog");
      }

      void refreshBacklogData();
    } catch {
      setLocalSprints(previousSprints);
      setLocalBacklogIssues(previousBacklogIssues);
      message.error("Failed to move issue");
    }
  };

  const handleStatusChange = async (issueId: string, statusId: string) => {
    if (!canUpdateIssue) {
      message.warning("You do not have permission to update issues.");
      return;
    }
    try {
      await updateIssue({ issueId, data: { statusId } }).unwrap();
      message.success("Issue status updated");
      await refreshBacklogData();
    } catch {
      message.error("Failed to update issue status");
    }
  };

  const handleChangePoints = async (issueId: string, points: number | null) => {
    if (!canUpdateIssue) return;
    try {
      await updateIssue({ issueId, data: { storyPoints: points ?? undefined } }).unwrap();
    } catch {
      message.error("Failed to update story points");
    }
  };

  const handleOpenCreateIssue = (targetSprintId?: string) => {
    if (!canCreateIssue) {
      message.warning("You do not have permission to create issues.");
      return;
    }
    setNewIssueTargetSprintId(targetSprintId || null);
    setCreateIssueStatusId(defaultCreateStatusId);
    setIsCreateIssueOpen(true);
  };

  const handleIssueCreated = async (createdIssue?: any) => {
    try {
      if (newIssueTargetSprintId && createdIssue?.id) {
        await addIssuesToSprint({
          sprintId: newIssueTargetSprintId,
          issueIds: [createdIssue.id],
        }).unwrap();
        message.success("Issue created and added to sprint");
      } else {
        message.success("Issue created");
      }
    } catch {
      message.warning("Issue was created but could not be added to the sprint");
    } finally {
      setIsCreateIssueOpen(false);
      setNewIssueTargetSprintId(null);
      await refreshBacklogData();
    }
  };

  const handleStartSprint = async (sprintId: string) => {
    if (!canManageSprints) {
      message.warning("You do not have permission to manage sprints.");
      return;
    }
    try {
      await startSprint(sprintId).unwrap();
      message.success("Sprint started");
      await refreshBacklogData();
    } catch {
      message.error("Failed to start sprint");
    }
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setSelectedEpicFilter("all");
  };

  const activeFilterCount = [
    searchTerm.length > 0,
    selectedEpicFilter !== "all",
  ].filter(Boolean).length;
  const isLoading = sprintsLoading || backlogLoading || epicsLoading;

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 12 }} />
      </div>
    );
  }
  return (
    <div style={{ padding: 16, background: COLORS.appBg, borderRadius: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Space wrap>
          <Input
            allowClear
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            prefix={<Search size={14} color={COLORS.textSecondary} />}
            placeholder="Search backlog"
            style={{ width: 240 }}
          />
          <Button
            icon={<Filter size={14} />}
            type={activeFilterCount > 0 ? "primary" : "default"}
          >
            Filter {activeFilterCount > 0 ? activeFilterCount : ""}
          </Button>
          {activeFilterCount > 0 && (
            <Button
              type="text"
              onClick={clearFilters}
              style={{ color: COLORS.textSecondary }}
            >
              Clear filters
            </Button>
          )}
        </Space>

        <Button
          icon={<Settings2 size={14} />}
          onClick={() => setIsViewSettingsOpen(true)}
        >
          Customize
        </Button>
      </div>

      <div
        style={{ display: "flex", gap: 16, minHeight: "calc(100vh - 340px)" }}
      >
        {/* Epic panel removed — epics are managed via issue creation */}

        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          {backlogIssues.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                border: `1px dashed ${COLORS.primary}`,
                borderRadius: 12,
                padding: '32px 24px',
                background: COLORS.accent,
                textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              }}>
                <div>
                  <Text strong style={{ fontSize: 16, color: COLORS.textPrimary, display: 'block', marginBottom: 6 }}>
                    Your backlog is empty
                  </Text>
                  <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>
                    Create issues to start tracking your work. You can link issues to epics for better organization.
                  </Text>
                </div>
                <Space>
                  {canCreateIssue && (
                    <Button
                      type="primary"
                      icon={<Plus size={14} />}
                      onClick={() => handleOpenCreateIssue()}
                      style={{ borderRadius: 8, fontWeight: 600 }}
                    >
                      Create Issue
                    </Button>
                  )}
                </Space>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                autoScroll={false}
              >
                <BacklogLane
                  issues={backlogIssues}
                  filterIssue={filterIssue}
                  density={density}
                  fields={fieldVisibility}
                  statusOptions={statusOptions}
                  canUpdateIssue={canUpdateIssue}
                  canManageSprints={canManageSprints}
                  onOpenIssue={(id) => openIssue(id, projectId)}
                  onChangeStatus={handleStatusChange}
                  onChangePoints={handleChangePoints}
                  onCreateIssue={() => handleOpenCreateIssue()}
                  onCreateSprint={() => setIsCreateSprintOpen(true)}
                />
              </DndContext>
            </div>
          ) : (
            <div style={{ height: "100%", overflowY: "auto", paddingRight: 4 }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                autoScroll={false}
              >
                {/* Sprints hidden — simplified workflow */}

                <BacklogLane
                  issues={backlogIssues}
                  filterIssue={filterIssue}
                  density={density}
                  fields={fieldVisibility}
                  statusOptions={statusOptions}
                  canUpdateIssue={canUpdateIssue}
                  canManageSprints={canManageSprints}
                  onOpenIssue={(id) => openIssue(id, projectId)}
                  onChangeStatus={handleStatusChange}
                  onChangePoints={handleChangePoints}
                  onCreateIssue={() => handleOpenCreateIssue()}
                  onCreateSprint={() => setIsCreateSprintOpen(true)}
                />

                <DragOverlay>
                  {activeIssue ? (
                    <div
                      style={{
                        border: `1px solid ${COLORS.primary}`,
                        background: "#ffffff",
                        borderRadius: 8,
                        boxShadow: "0 12px 24px rgba(16,24,40,0.15)",
                        padding: "8px 12px",
                        maxWidth: 360,
                      }}
                    >
                      <Text
                        style={{
                          display: "block",
                          color: COLORS.textSecondary,
                          fontFamily: "monospace",
                        }}
                      >
                        {activeIssue.issueKey}
                      </Text>
                      <Text strong>{getIssueTitle(activeIssue)}</Text>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          )}
        </div>
      </div>
      <Drawer
        open={isViewSettingsOpen}
        onClose={() => setIsViewSettingsOpen(false)}
        width={340}
        title="View settings"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Text>Epic panel</Text>
            <Switch
              size="small"
              checked={showEpicPanel}
              onChange={setShowEpicPanel}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Text>Empty sprints</Text>
            <Switch
              size="small"
              checked={showEmptySprints}
              onChange={setShowEmptySprints}
            />
          </div>

          <Divider style={{ margin: "6px 0" }} />

          <div>
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Density
            </Text>
            <Space>
              <Button
                type={density === "default" ? "primary" : "default"}
                size="small"
                onClick={() => setDensity("default")}
              >
                Default
              </Button>
              <Button
                type={density === "compact" ? "primary" : "default"}
                size="small"
                onClick={() => setDensity("compact")}
              >
                Compact
              </Button>
            </Space>
          </div>

          <Divider style={{ margin: "6px 0" }} />

          <div>
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Fields
            </Text>
            {[
              { key: "showWorkType", label: "Work type" },
              { key: "showIssueKey", label: "Work item key" },
              { key: "showEpic", label: "Epic" },
              { key: "showDueDate", label: "Due date" },
              { key: "showStatus", label: "Status" },
              { key: "showPriority", label: "Priority" },
              { key: "showAssignee", label: "Assignee" },
              { key: "showStoryPoints", label: "Story points" },
            ].map((field) => (
              <div
                key={field.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text>{field.label}</Text>
                <Switch
                  size="small"
                  checked={fieldVisibility[field.key as keyof FieldVisibility]}
                  onChange={(checked) =>
                    setFieldVisibility((prev) => ({
                      ...prev,
                      [field.key]: checked,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </Drawer>

      <Drawer
        open={!!selectedEpic}
        onClose={() => setSelectedEpic(null)}
        width={460}
        title={selectedEpic ? `${selectedEpic.name} details` : "Epic details"}
      >
        {selectedEpic && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Space align="center">
              <Badge color={selectedEpic.color} />
              <Text strong style={{ fontSize: 18 }}>
                {selectedEpic.name}
              </Text>
              <Tag>{selectedEpic.status}</Tag>
            </Space>

            <Card size="small" style={{ borderRadius: 10 }}>
              <Text strong>Description</Text>
              <Text
                style={{
                  display: "block",
                  color: COLORS.textSecondary,
                  marginTop: 6,
                }}
              >
                {selectedEpic.description ||
                  selectedEpic.summary ||
                  "No description"}
              </Text>
            </Card>

            <Card size="small" style={{ borderRadius: 10 }}>
              <Text strong>Details</Text>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <Text>
                  <CalendarDays
                    size={14}
                    style={{ marginRight: 6, verticalAlign: "middle" }}
                  />
                  Start:{" "}
                  {selectedEpic.startDate
                    ? format(new Date(selectedEpic.startDate), "MMM d, yyyy")
                    : "None"}
                </Text>
                <Text>
                  <CalendarDays
                    size={14}
                    style={{ marginRight: 6, verticalAlign: "middle" }}
                  />
                  Due:{" "}
                  {selectedEpic.endDate
                    ? format(new Date(selectedEpic.endDate), "MMM d, yyyy")
                    : "None"}
                </Text>
                <Text>Progress: {selectedEpic.progress}%</Text>
                <Text>Work items: {selectedEpic.stats?.totalIssues || 0}</Text>
              </div>
            </Card>

            <Card size="small" style={{ borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text strong>Issues in epic</Text>
                <Button
                  type="primary"
                  size="small"
                  icon={<Plus size={14} />}
                  style={{ borderRadius: 6, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => {
                    const epicId = selectedEpic?.id || null;
                    setSelectedEpic(null); // Close drawer first to avoid focus trap conflict
                    setTimeout(() => {
                      setCreateIssueEpicId(epicId);
                      setIsCreateIssueOpen(true);
                    }, 200);
                  }}
                >
                  Create Issue
                </Button>
              </div>
              {selectedEpicIssuesLoading ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : (selectedEpicIssuesData?.issues || []).length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {(selectedEpicIssuesData?.issues || []).map((issue: any) => (
                    <Button
                      key={issue.id}
                      style={{
                        textAlign: "left",
                        height: "auto",
                        padding: "8px 10px",
                      }}
                      onClick={() => openIssue(issue.id, projectId)}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                        }}
                      >
                        <Text
                          strong
                          style={{
                            color: COLORS.primary,
                            fontFamily: "monospace",
                          }}
                        >
                          {issue.issueKey}
                        </Text>
                        <Text style={{ color: COLORS.textPrimary }}>
                          {getIssueTitle(issue)}
                        </Text>
                      </div>
                    </Button>
                  ))}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No issues linked to this epic"
                />
              )}
            </Card>
          </div>
        )}
      </Drawer>


      <CreateIssueModal
        open={isCreateIssueOpen}
        onOpenChange={(open) => { setIsCreateIssueOpen(open); if (!open) setCreateIssueEpicId(null); }}
        projectId={projectId!}
        defaultStatusId={createIssueStatusId}
        defaultEpicId={createIssueEpicId || undefined}
        issueTypes={issueTypesForCreate}
        priorities={prioritiesForCreate}
        members={membersForCreate}
        onSuccess={handleIssueCreated}
      />

      {/* CreateSprintDialog hidden — simplified workflow */}

      {sprintToComplete && (
        <CompleteSprintDialog
          sprint={sprintToComplete}
          sprints={sprints.filter(
            (s) => s.status === "planned" && s.id !== sprintToComplete.id,
          )}
          open={!!sprintToComplete}
          onOpenChange={(open) => {
            if (!open) {
              setSprintToComplete(null);
              void refreshBacklogData();
            }
          }}
        />
      )}

      <EpicFormModal
        projectId={projectId!}
        open={isCreateEpicOpen}
        onClose={() => setIsCreateEpicOpen(false)}
      />
    </div>
  );
}
