import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Issue } from "../issues/issuesApi";
import { RootState } from "../../app/store";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useGetBoardQuery } from "./boardsApi";
import { useBoardFilters } from "./hooks/useBoard";
import { useSocket } from "../../hooks/useSocket";
import {
  LayoutGrid,
  List as ListIcon,
  Calendar as CalendarIcon,
  Filter,
  Plus,
  SlidersHorizontal,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Search,
  User,
} from "lucide-react";
import { BoardColumn } from "./BoardColumn";
import { BoardCard, type BoardCardFieldVisibility } from "./BoardCard";
import {
  BoardViewSwitcher,
  BoardViewType,
} from "./components/BoardViewSwitcher";
import { BoardListView } from "./components/BoardListView";
import { BoardTimelineView } from "./components/BoardTimelineView";
import { CalendarView } from "../calendar/CalendarView";
import { CreateIssueModal } from "../issues/components/CreateIssueModal";
import { useIssueModal } from "../issues/IssueDetailModal";
import { ConfigureBoardModal } from "./components/ConfigureBoardModal";
import {
  useReorderBoardColumnsMutation,
} from "./boardsApi";
import {
  Typography,
  Space,
  Button,
  Badge,
  Skeleton,
  Alert,
  Tooltip,
  Divider,
  Select,
  Input,
  Tag,
  Avatar,
  Drawer,
  Switch,
  Dropdown,
  Modal,
  Grid,
} from "antd";
import { usePermission as usePermissionGuard } from "@/features/rbac/components/PermissionGuard";
import { normalizeAvatarUrl } from "@/lib/utils";
import { useGetProjectMembersQuery } from "../projects/projectsApi";
import { toast } from "@/hooks/useToast";

const { Title, Text } = Typography;

interface OnlineUser {
  userId: string;
  email: string;
}

const COLORS = {
  primary: "#0052cc",
  success: "#36b37e",
  warning: "#ffab00",
  textPrimary: "#172b4d",
  textSecondary: "#6b778c",
  border: "#dfe1e6",
  danger: "#de350b",
  shadow: "0 1px 1px rgba(9, 30, 66, 0.25), 0 0 1px 0 rgba(9, 30, 66, 0.31)",
};

type SwimlaneGroupBy = "none" | "assignee" | "priority" | "type" | "epic" | "sprint";

const getStoredView = (): BoardViewType => {
  try {
    return (
      (localStorage.getItem("board_view_preference") as BoardViewType) ||
      "kanban"
    );
  } catch {
    return "kanban";
  }
};

const getStoredGroupBy = (): SwimlaneGroupBy => {
  try {
    return (localStorage.getItem("board_groupby") as SwimlaneGroupBy) || "none";
  } catch {
    return "none";
  }
};

const DEFAULT_CARD_FIELDS: BoardCardFieldVisibility = {
  showWorkType: true,
  showIssueKey: true,
  showEpic: true,
  showDueDate: true,
  showLinkedItems: false,
  showAssignee: true,
  showPriority: true,
  showLabels: false,
  showStoryPoints: true,
};

const getStoredCardFields = (projectId: string): BoardCardFieldVisibility => {
  try {
    const raw = localStorage.getItem(`board_card_fields_${projectId}`);
    return raw
      ? { ...DEFAULT_CARD_FIELDS, ...JSON.parse(raw) }
      : DEFAULT_CARD_FIELDS;
  } catch {
    return DEFAULT_CARD_FIELDS;
  }
};

const saveStoredCardFields = (
  projectId: string,
  fields: BoardCardFieldVisibility,
) => {
  try {
    localStorage.setItem(
      `board_card_fields_${projectId}`,
      JSON.stringify(fields),
    );
  } catch { /* ignored */ }
};

const getStoredFlaggedIssues = (projectId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(`board_flags_${projectId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const saveStoredFlaggedIssues = (projectId: string, issueIds: Set<string>) => {
  try {
    localStorage.setItem(
      `board_flags_${projectId}`,
      JSON.stringify(Array.from(issueIds)),
    );
  } catch { /* ignored */ }
};

const getApiErrorMessage = (error: any, fallback: string) =>
  error?.data?.message || error?.error || fallback;

// ─── Board Member Stack with hover card ─────────────────────────────────────
function BoardMemberStack({
  members,
  onlineUserIds,
}: {
  members: any[];
  onlineUserIds: Set<string>;
}) {
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_VISIBLE = 4;

  const open = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHovered(true);
  };
  const close = () => {
    timerRef.current = setTimeout(() => setHovered(false), 120);
  };

  const visible = members.slice(0, MAX_VISIBLE);
  const overflow = members.length - MAX_VISIBLE;

  return (
    <div style={{ position: "relative" }} onMouseEnter={open} onMouseLeave={close}>
      {/* Stacked avatars */}
      <div style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
        {visible.map((member, i) => {
          const user = member.user ?? member;
          const avatarUrl = normalizeAvatarUrl(user.avatarUrl);
          const isOnline = onlineUserIds.has(user.id);
          const initial = (user.displayName || user.email || "?")[0].toUpperCase();
          const hue = user.id
            ? (user.id.charCodeAt(0) * 37 + user.id.charCodeAt(1) * 17) % 360
            : 200;

          return (
            <div
              key={user.id}
              style={{
                position: "relative",
                marginLeft: i === 0 ? 0 : "-9px",
                zIndex: MAX_VISIBLE - i,
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user.displayName}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid #fff",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: `hsl(${hue}, 55%, 52%)`,
                    color: "#fff",
                    fontSize: "10px",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #fff",
                  }}
                >
                  {initial}
                </div>
              )}
              {/* Online indicator dot */}
              {isOnline && (
                <span
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: "#36b37e",
                    border: "1.5px solid #fff",
                  }}
                />
              )}
            </div>
          );
        })}
        {overflow > 0 && (
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "#f2f4f7",
              color: COLORS.textSecondary,
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #fff",
              marginLeft: "-9px",
              zIndex: 0,
            }}
          >
            +{overflow}
          </div>
        )}
        <Text
          style={{ fontSize: "12px", fontWeight: 600, color: COLORS.textSecondary, marginLeft: "6px" }}
        >
          {onlineUserIds.size > 0 ? `${onlineUserIds.size} online` : `${members.length} members`}
        </Text>
      </div>

      {/* Hover card */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            onMouseEnter={open}
            onMouseLeave={close}
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              width: "220px",
              background: "#fff",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              boxShadow: "0 8px 24px rgba(16,24,40,0.10)",
              zIndex: 1000,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid #f0f0f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: "12px", fontWeight: 700, color: "#101828" }}>
                Project Members
              </Text>
              <Text style={{ fontSize: "11px", color: COLORS.textSecondary }}>
                {members.length} total
              </Text>
            </div>

            {/* Member list */}
            <div style={{ maxHeight: "220px", overflowY: "auto", padding: "6px 0" }}>
              {members.map((member, i) => {
                const user = member.user ?? member;
                const avatarUrl = normalizeAvatarUrl(user.avatarUrl);
                const isOnline = onlineUserIds.has(user.id);
                const initial = (user.displayName || user.email || "?")[0].toUpperCase();
                const hue = user.id
                  ? (user.id.charCodeAt(0) * 37 + user.id.charCodeAt(1) * 17) % 360
                  : 200;

                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.12 }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "9px",
                      padding: "6px 14px",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={user.displayName}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                          style={{
                            width: "26px",
                            height: "26px",
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "26px",
                            height: "26px",
                            borderRadius: "50%",
                            background: `hsl(${hue}, 55%, 52%)`,
                            color: "#fff",
                            fontSize: "10px",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {initial}
                        </div>
                      )}
                      {isOnline && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: 0,
                            right: 0,
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            background: "#36b37e",
                            border: "1.5px solid #fff",
                          }}
                        />
                      )}
                    </div>

                    {/* Name + role */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#101828",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {user.displayName || user.email}
                      </div>
                      {member.role && (
                        <div style={{ fontSize: "11px", color: COLORS.textSecondary }}>
                          {member.role}
                        </div>
                      )}
                    </div>

                    {/* Online badge */}
                    {isOnline && (
                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "#36b37e",
                          background: "rgba(54,179,126,0.10)",
                          padding: "1px 6px",
                          borderRadius: "999px",
                          flexShrink: 0,
                        }}
                      >
                        Online
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export function KanbanBoardPage() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { hasPermission: canUpdateIssue } = usePermissionGuard(
    ["issues.update", "issues.update_own"],
    "any",
  );
  const { hasPermission: canCreateIssue } = usePermissionGuard("issues.create");
  const { hasPermission: canViewIssues } = usePermissionGuard(
    [
      "issues.read",
      "issues.create",
      "issues.update",
      "issues.update_own",
      "issues.delete",
      "issues.assign",
    ],
    "any",
  );
  const { hasPermission: canManageSprints } =
    usePermissionGuard("sprints.manage");
  const { hasPermission: canManageColumns } =
    usePermissionGuard("projects.update");
  const {
    data: boardData,
    refetch,
    isLoading,
  } = useGetBoardQuery(
    { projectId: projectId! },
    {
      skip: !projectId,
    },
  );
  const { data: membersData } = useGetProjectMembersQuery(projectId!, {
    skip: !projectId,
  });
  const { socket, isConnected } = useSocket();
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [currentView, setCurrentView] = useState<BoardViewType>(getStoredView);
  const [columns, setColumns] = useState<any[]>([]);
  const [groupBy, setGroupBy] = useState<SwimlaneGroupBy>(getStoredGroupBy);
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<string>>(
    new Set(),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configureBoardOpen, setConfigureBoardOpen] = useState(false);
  const [openInSidebar, setOpenInSidebar] = useState(false);
  const [workSuggestions, setWorkSuggestions] = useState(true);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [createIssueStatusId, setCreateIssueStatusId] = useState<
    string | undefined
  >(undefined);
  const [cardFields, setCardFields] = useState<BoardCardFieldVisibility>(() =>
    getStoredCardFields(projectId || "global"),
  );
  const [flaggedIssueIds, setFlaggedIssueIds] = useState<Set<string>>(() =>
    getStoredFlaggedIssues(projectId || "global"),
  );
  const { openIssue } = useIssueModal();
  const [activeColumn, setActiveColumn] = useState<any | null>(null);
  const [reorderBoardColumns] = useReorderBoardColumnsMutation();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const isAdmin = useSelector((state: RootState) => state.auth.isAdmin);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  // Refs for horizontal auto-scroll while dragging
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRafRef = useRef<number | null>(null);
  // Stores the columns state (+ attempted status IDs) just before an optimistic
  // move so we can revert and show a meaningful error if the backend rejects it.
  const preMovColumnsRef = useRef<{
    columns: any[];
    fromStatusId: string;
    toStatusId: string;
  } | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  // Board filters hook (already fully implemented!)
  const {
    filters,
    updateFilter,
    toggleFilter,
    clearFilters,
    hasActiveFilters,
    filterIssues,
  } = useBoardFilters();

  useEffect(() => {
    if (!projectId) return;
    setCardFields(getStoredCardFields(projectId));
    setFlaggedIssueIds(getStoredFlaggedIssues(projectId));
  }, [projectId]);

  // Active sprint comes directly from the board API response (backend queries it alongside columns)
  const activeSprint = boardData?.activeSprint ?? null;
  const activeSprintId = activeSprint?.id;

  const boardFilters = boardData?.filters;

  const issueTypesForCreate = useMemo(
    () =>
      (boardFilters?.types || [])
        .filter(
          (t: any) => (t.displayName || t.name || "").toLowerCase() !== "epic",
        )
        .map((t: any) => ({
          id: t.id,
          name: t.displayName || t.name,
        })),
    [boardFilters],
  );

  const prioritiesForCreate = useMemo(
    () =>
      (boardFilters?.priorities || []).map((p: any) => ({
        id: p.id,
        name: p.displayName || p.name,
      })),
    [boardFilters],
  );

  const membersForCreate = useMemo(() => {
    const projectMembers = membersData || [];
    if (projectMembers.length > 0) {
      return projectMembers.map((member: any) => ({
        id: member.user.id,
        displayName: member.user.displayName,
      }));
    }
    return (boardFilters?.assignees || []).map((a: any) => ({
      id: a.id,
      displayName: a.displayName,
    }));
  }, [membersData, boardFilters]);

  const openCreateIssue = (statusId?: string) => {
    if (!canCreateIssue) {
      toast.warning("Permission Denied", "You do not have permission to create issues.");
      return;
    }
    setCreateIssueStatusId(statusId);
    setIsCreateIssueOpen(true);
  };

  const handleCardFieldToggle = (
    field: keyof BoardCardFieldVisibility,
    checked: boolean,
  ) => {
    if (!projectId) return;
    setCardFields((prev) => {
      const next = { ...prev, [field]: checked };
      saveStoredCardFields(projectId, next);
      return next;
    });
  };

  const handleToggleFlag = useCallback(
    (issueId: string) => {
      if (!projectId) return;
      setFlaggedIssueIds((prev) => {
        const next = new Set(prev);
        if (next.has(issueId)) {
          next.delete(issueId);
          toast.success("Flag Removed");
        } else {
          next.add(issueId);
          toast.success("Issue Flagged");
        }
        saveStoredFlaggedIssues(projectId, next);
        return next;
      });
    },
    [projectId],
  );

  /* Navigation tabs logic removed: handled by ProjectDetailPage */

  const handleViewChange = (view: BoardViewType) => {
    setCurrentView(view);
    try {
      localStorage.setItem("board_view_preference", view);
    } catch { /* ignored */ }
  };

  const handleGroupByChange = (value: SwimlaneGroupBy) => {
    setGroupBy(value);
    try {
      localStorage.setItem("board_groupby", value);
    } catch { /* ignored */ }
  };

  const toggleSwimlane = (id: string) => {
    setCollapsedSwimlanes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  useEffect(() => {
    if (!activeIssue && !activeColumn) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [activeIssue, activeColumn]);

  useEffect(() => {
    if (!socket || !projectId) return;
    socket.emit("board:join", { projectId });
    socket.on(
      "user:joined",
      (data: { user: OnlineUser; users: OnlineUser[] }) => {
        setOnlineUsers(Array.isArray(data.users) ? data.users : []);
      },
    );
    socket.on("user:left", (data: { userId: string; users: OnlineUser[] }) => {
      setOnlineUsers(Array.isArray(data.users) ? data.users : []);
    });
    socket.on("issue:moved", (payload: any) => {
      // Backend sends { issue, movedBy, timestamp }
      const issueId = payload?.issue?.id ?? payload?.issueId;
      const toStatusId = payload?.issue?.status_id ?? payload?.toStatusId;
      const parsedPosition = Number(payload?.issue?.position ?? payload?.position);

      // If the current user initiated this move, the optimistic update is
      // already applied — skip to avoid a redundant re-render.
      const movedByMe = payload?.movedBy?.id === currentUser?.id;
      if (movedByMe) return;

      if (
        typeof issueId !== "string" ||
        typeof toStatusId !== "string" ||
        !Number.isFinite(parsedPosition)
      ) {
        refetch();
        return;
      }

      setColumns((prevColumns) => {
        const nextColumns = prevColumns.map((column) => ({
          ...column,
          issues: [...column.issues],
        }));

        const sourceColumn = nextColumns.find((column) =>
          column.issues.some((issue: any) => issue.id === issueId),
        );
        const targetColumn = nextColumns.find(
          (column) => column.id === toStatusId,
        );

        if (!sourceColumn || !targetColumn) return prevColumns;

        const movingIssueIndex = sourceColumn.issues.findIndex(
          (issue: any) => issue.id === issueId,
        );
        if (movingIssueIndex === -1) return prevColumns;

        const [movingIssue] = sourceColumn.issues.splice(movingIssueIndex, 1);
        const boundedPosition = Math.max(
          0,
          Math.min(Math.trunc(parsedPosition), targetColumn.issues.length),
        );
        targetColumn.issues.splice(boundedPosition, 0, movingIssue);

        return nextColumns;
      });
    });
    socket.on("issue:updated", (payload: any) => {
      // Skip refetch when the current user triggered the update — the
      // RTK Query mutation already handles local cache updates.
      if (payload?.updatedBy?.id === currentUser?.id) return;
      refetch();
    });
    socket.on("issue:moveError", (payload: { issueId: string; message: string; code: string }) => {
      // Revert the optimistic update and show a descriptive error.
      if (preMovColumnsRef.current) {
        const { columns: prev, fromStatusId, toStatusId } = preMovColumnsRef.current;
        setColumns(prev);

        // Resolve human-readable status names from the snapshot.
        const allCols = prev as any[];
        const fromName =
          allCols.find((c: any) => c.id === fromStatusId)?.name ||
          allCols.find((c: any) => c.id === fromStatusId)?.displayName ||
          "current status";
        const toName =
          allCols.find((c: any) => c.id === toStatusId)?.name ||
          allCols.find((c: any) => c.id === toStatusId)?.displayName ||
          "target status";

        preMovColumnsRef.current = null;

        toast.error(
          "Transition Not Allowed",
          `"${fromName}" → "${toName}" is not a permitted step in this workflow.`,
        );
      } else {
        toast.error("Transition Not Allowed", payload?.message || "This status transition is not allowed by the workflow.");
      }
    });
    return () => {
      socket.emit("board:leave", { projectId });
      socket.off("user:joined");
      socket.off("user:left");
      socket.off("issue:moved");
      socket.off("issue:updated");
      socket.off("issue:moveError");
    };
  }, [socket, projectId, refetch, currentUser]);

  useEffect(() => {
    if (boardData?.columns) {
      setColumns(boardData.columns);
    }
  }, [boardData]);

  const getIssueSprintId = useCallback((issue: any): string | undefined => {
    if (typeof issue?.sprintId === "string" && issue.sprintId)
      return issue.sprintId;
    if (typeof issue?.sprint?.id === "string" && issue.sprint.id)
      return issue.sprint.id;
    if (Array.isArray(issue?.sprints) && issue.sprints.length > 0) {
      const sprint = issue.sprints[0];
      if (typeof sprint === "string" && sprint) return sprint;
      if (typeof sprint?.id === "string" && sprint.id) return sprint.id;
    }
    return undefined;
  }, []);

  // Apply filters and sprint filtering to columns
  const filteredColumns = useMemo(() => {
    return columns.map((col) => {
      let issues = [...col.issues];

      // Some board responses do not include sprint data per issue.
      // If sprint info is missing, keep the issue instead of hiding it.
      if (activeSprintId) {
        issues = issues.filter((iss: any) => {
          const issueSprintId = getIssueSprintId(iss);
          return !issueSprintId || issueSprintId === activeSprintId;
        });
      }

      // Apply board filters
      issues = filterIssues(issues);

      return { ...col, issues };
    });
  }, [columns, activeSprintId, filterIssues, getIssueSprintId]);

  // Show each workflow status as its own board column (Jira-style).
  // No collapsing into 3 buckets — each status is a column, sorted by position.
  const sprintBoardColumns = useMemo(() => {
    return filteredColumns;
  }, [filteredColumns]);

  // Swimlane grouping
  const swimlanes = useMemo(() => {
    if (groupBy === "none") return null;

    const groups = new Map<
      string,
      {
        id: string;
        name: string;
        color?: string;
        avatarUrl?: string;
        issues: any[];
      }
    >();

    const allIssues = sprintBoardColumns.flatMap((col) =>
      col.issues.map((iss: any) => ({ ...iss, _colId: col.id })),
    );

    allIssues.forEach((issue: any) => {
      let groupKey = "none";
      let groupName = "Unassigned";
      let groupColor = "#9ca3af";
      let groupAvatar: string | undefined;

      if (groupBy === "assignee") {
        groupKey = issue.assignee?.id || "none";
        groupName = issue.assignee?.displayName || "Unassigned";
        groupAvatar = issue.assignee?.avatarUrl;
      } else if (groupBy === "priority") {
        groupKey = issue.priority?.id || "none";
        groupName =
          issue.priority?.displayName || issue.priority?.name || "No Priority";
        groupColor = issue.priority?.color || "#9ca3af";
      } else if (groupBy === "type") {
        groupKey = issue.type?.id || "none";
        groupName = issue.type?.displayName || issue.type?.name || "Unknown";
        groupColor = issue.type?.color || "#9ca3af";
      } else if (groupBy === "epic") {
        groupKey = issue.epicId || issue.epic?.id || "none";
        groupName = issue.epic?.name || "No Epic";
        groupColor = issue.epic?.color || "#9ca3af";
      } else if (groupBy === "sprint") {
        groupKey = issue.sprintId || "none";
        groupName = issue.sprint?.name || "No Sprint";
        groupColor = issue.sprint?.status === "active" ? "#16a34a" : "#6b7280";
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          name: groupName,
          color: groupColor,
          avatarUrl: groupAvatar,
          issues: [],
        });
      }
      groups.get(groupKey)!.issues.push(issue);
    });

    return Array.from(groups.values());
  }, [sprintBoardColumns, groupBy]);

  const getIssueMoveResult = useCallback(
    (
      currentColumns: any[],
      issueId: string,
      overId: string,
      options?: {
        isOverColumn?: boolean;
        overSortableIndex?: number;
        dragDeltaY?: number;
      },
    ) => {
      const sourceColumnIndex = currentColumns.findIndex((col) =>
        col.issues.some((iss: any) => iss.id === issueId),
      );
      const targetColumnIndex = currentColumns.findIndex(
        (col) =>
          col.id === overId || col.issues.some((iss: any) => iss.id === overId),
      );

      if (sourceColumnIndex === -1 || targetColumnIndex === -1) return null;

      const sourceColumn = currentColumns[sourceColumnIndex];
      const targetColumn = currentColumns[targetColumnIndex];

      const sourceIssues = [...sourceColumn.issues];
      const movingIssueIndex = sourceIssues.findIndex(
        (iss: any) => iss.id === issueId,
      );
      if (movingIssueIndex === -1) return null;

      // Same-column reordering: support drop over cards and column surface.
      if (sourceColumnIndex === targetColumnIndex) {
        const overIssueIndex = sourceIssues.findIndex(
          (iss: any) => iss.id === overId,
        );
        let newIndex =
          typeof options?.overSortableIndex === "number"
            ? options.overSortableIndex
            : overIssueIndex;

        if (newIndex < 0 || options?.isOverColumn) {
          newIndex =
            typeof options?.dragDeltaY === "number" && options.dragDeltaY < 0
              ? 0
              : sourceIssues.length - 1;
        }

        const boundedNewIndex = Math.max(
          0,
          Math.min(newIndex, sourceIssues.length - 1),
        );
        if (movingIssueIndex === boundedNewIndex) return null;

        const reorderedIssues = arrayMove(
          sourceIssues,
          movingIssueIndex,
          boundedNewIndex,
        );
        const nextColumns = [...currentColumns];
        nextColumns[sourceColumnIndex] = {
          ...sourceColumn,
          issues: reorderedIssues,
        };

        return {
          nextColumns,
          fromStatusId: sourceColumn.id,
          toStatusId: targetColumn.id,
          position: boundedNewIndex,
        };
      }

      const [movingIssue] = sourceIssues.splice(movingIssueIndex, 1);
      const targetIssues = [...targetColumn.issues];

      let insertIndex = targetIssues.length;
      const overIssueIndex = targetIssues.findIndex(
        (iss: any) => iss.id === overId,
      );
      if (overIssueIndex >= 0) {
        insertIndex = overIssueIndex;
      } else if (
        options?.isOverColumn &&
        typeof options?.dragDeltaY === "number" &&
        options.dragDeltaY < 0
      ) {
        insertIndex = 0;
      }

      targetIssues.splice(insertIndex, 0, movingIssue);

      const nextColumns = [...currentColumns];
      nextColumns[sourceColumnIndex] = {
        ...sourceColumn,
        issues: sourceIssues,
      };
      nextColumns[targetColumnIndex] = {
        ...targetColumn,
        issues: targetIssues,
      };

      return {
        nextColumns,
        fromStatusId: sourceColumn.id,
        toStatusId: targetColumn.id,
        position: insertIndex,
      };
    },
    [],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id as string;

    // Check if dragging a column
    const column = columns.find((col) => col.id === activeId);
    if (column) {
      setActiveColumn(column);
      return;
    }

    // Check if dragging an issue
    const issue = columns
      .flatMap((col) => col.issues)
      .find((iss) => iss.id === activeId);
    setActiveIssue(issue || null);
  };

  // ─── Horizontal auto-scroll while dragging ───────────────────────────────
  // Uses document pointermove (raw e.clientX) so left ↔ right transitions are
  // instant and perfectly accurate — no drift from activatorEvent + delta calc.
  useEffect(() => {
    const container = boardScrollRef.current;
    if (!container || (!activeIssue && !activeColumn)) {
      stopAutoScroll();
      return;
    }

    const EDGE = 100;     // px from edge where scroll zone begins
    const MAX_SPEED = 14; // max px per animation frame

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      stopAutoScroll();

      let speed = 0;
      if (e.clientX < rect.left + EDGE) {
        speed = -MAX_SPEED * ((rect.left + EDGE - e.clientX) / EDGE);
      } else if (e.clientX > rect.right - EDGE) {
        speed = MAX_SPEED * ((e.clientX - (rect.right - EDGE)) / EDGE);
      }

      if (Math.abs(speed) > 0.5) {
        const tick = () => {
          if (boardScrollRef.current) boardScrollRef.current.scrollLeft += speed;
          autoScrollRafRef.current = requestAnimationFrame(tick);
        };
        autoScrollRafRef.current = requestAnimationFrame(tick);
      }
    };

    document.addEventListener("pointermove", onPointerMove);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      stopAutoScroll();
    };
  }, [activeIssue, activeColumn, stopAutoScroll]);

  const handleDragEnd = async (event: DragEndEvent) => {
    stopAutoScroll();
    const { active, over } = event;
    const activeId = active.id as string;

    setActiveIssue(null);
    setActiveColumn(null);

    if (!over) return;

    const overId = over.id as string;

    // Handle column reordering
    if (activeColumn) {
      if (activeId !== overId) {
        const oldIndex = columns.findIndex((col) => col.id === activeId);
        const newIndex = columns.findIndex((col) => col.id === overId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const previousColumns = columns;
          const newColumns = arrayMove(previousColumns, oldIndex, newIndex);
          setColumns(newColumns);

          try {
            await reorderBoardColumns({
              projectId: projectId!,
              statusIds: newColumns.map((column) => column.id),
            }).unwrap();
            toast.success("Column Reordered");
          } catch (error: any) {
            toast.error("Failed to Reorder", getApiErrorMessage(error, "Could not reorder columns. Please try again."));
            setColumns(previousColumns);
          }
        }
      }
      return;
    }

    // Handle issue move
    if (!socket) return;
    const issueId = activeId;
    const dropTargetId = overId;

    const isOverColumn = columns.some((column) => column.id === dropTargetId);
    const overSortableIndex = over?.data?.current?.sortable?.index;
    const moveResult = getIssueMoveResult(columns, issueId, dropTargetId, {
      isOverColumn,
      overSortableIndex:
        typeof overSortableIndex === "number" ? overSortableIndex : undefined,
      dragDeltaY:
        typeof event.delta?.y === "number" ? event.delta.y : undefined,
    });
    if (!moveResult) return;

    // Snapshot current state so we can revert if the backend rejects the move.
    preMovColumnsRef.current = {
      columns,
      fromStatusId: moveResult.fromStatusId,
      toStatusId: moveResult.toStatusId,
    };

    // Optimistic UI update for smooth in-column and cross-column moves.
    setColumns(moveResult.nextColumns);

    socket.emit("issue:move", {
      issueId,
      fromStatusId: moveResult.fromStatusId,
      toStatusId: moveResult.toStatusId,
      position: moveResult.position,
    });
  };

  const safeOnlineUsers = Array.isArray(onlineUsers) ? onlineUsers : [];
  const displayedUsers = [...safeOnlineUsers];
  if (
    currentUser &&
    isConnected &&
    !displayedUsers.find((u) => u.userId === currentUser.id)
  ) {
    displayedUsers.push({ userId: currentUser.id, email: currentUser.email });
  }
  const onlineUserIds = new Set(displayedUsers.map((u) => u.userId));
  const projectMembers: any[] = membersData ?? [];

  const viewLabels: Record<BoardViewType, string> = {
    kanban: "Kanban View",
    list: "List View",
    timeline: "Timeline View",
    calendar: "Calendar View",
  };

  const activeFilterCount = [
    filters.assigneeIds.length > 0,
    filters.typeIds.length > 0,
    filters.priorityIds.length > 0,
    filters.labelIds.length > 0,
    filters.searchQuery.length > 0,
  ].filter(Boolean).length;

  if (isLoading) {
    return (
      <div style={{ padding: "24px" }}>
        <Skeleton active paragraph={{ rows: 12 }} />
      </div>
    );
  }

  if (!canViewIssues) {
    return (
      <div style={{ padding: "24px" }}>
        <Alert
          type="warning"
          showIcon
          message="Access denied"
          description="You don't have permission to view issues for this project."
        />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "16px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {/* Removed redundant sub-navigation tab bar to fix "two tabs" issue. Use project-level navigation instead. */}

      {/* Board Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: isMobile ? "10px" : "16px",
        }}
      >
        <div>
          <Title
            level={2}
            style={{
              fontSize: isMobile ? "18px" : "28px",
              fontWeight: 700,
              color: COLORS.textPrimary,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {boardData?.project.name} Board
          </Title>
          <Space style={{ marginTop: "4px" }}>
            <Badge
              status="processing"
              text={
                <Text
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: COLORS.primary,
                  }}
                >
                  {boardData?.project.key}
                </Text>
              }
            />
            <Text style={{ fontSize: "13px", color: COLORS.textSecondary }}>
              - {viewLabels[currentView]}
            </Text>
          </Space>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "10px", flexWrap: "wrap" }}>
          {/* Active Sprint Tag */}
          {activeSprint ? (
            <Tag
              color="green"
              style={{
                borderRadius: "999px",
                padding: "2px 10px",
                fontWeight: 600,
                fontSize: "12px",
              }}
            >
              {isMobile ? activeSprint.name : `Active sprint: ${activeSprint.name}`}
            </Tag>
          ) : null}

          {/* Group By — desktop only */}
          {!isMobile && (
            <Select
              value={groupBy}
              onChange={handleGroupByChange}
              style={{ minWidth: "140px", height: "36px" }}
              placeholder="Group by"
            >
              <Select.Option value="none">No Grouping</Select.Option>
              <Select.Option value="assignee">Assignee</Select.Option>
              <Select.Option value="priority">Priority</Select.Option>
              <Select.Option value="type">Type</Select.Option>
              <Select.Option value="epic">Epic</Select.Option>
              <Select.Option value="sprint">Sprint</Select.Option>
            </Select>
          )}

          {!isMobile && <Divider type="vertical" style={{ height: "28px", margin: 0 }} />}

          {/* Filters */}
          <Tooltip title={isMobile ? "Filters" : undefined}>
            <Button
              icon={<Filter size={15} />}
              onClick={() => setShowFilters(!showFilters)}
              type={showFilters ? "primary" : "default"}
              style={{
                height: "36px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                paddingInline: isMobile ? "10px" : undefined,
              }}
            >
              {!isMobile && "Filters"}
              {activeFilterCount > 0 && (
                <Badge
                  count={activeFilterCount}
                  size="small"
                  style={{ marginLeft: "2px", backgroundColor: COLORS.primary }}
                />
              )}
            </Button>
          </Tooltip>

          {/* Only My Issues */}
          <Tooltip title={isMobile ? "Only my issues" : undefined}>
            <Button
              type={
                filters.assigneeIds.includes(currentUser?.id || "") &&
                filters.assigneeIds.length === 1
                  ? "primary"
                  : "default"
              }
              icon={isMobile ? <User size={15} /> : undefined}
              onClick={() => {
                if (currentUser) {
                  if (
                    filters.assigneeIds.includes(currentUser.id) &&
                    filters.assigneeIds.length === 1
                  ) {
                    updateFilter("assigneeIds", []);
                  } else {
                    updateFilter("assigneeIds", [currentUser.id]);
                  }
                }
              }}
              style={{
                height: "36px",
                borderRadius: "8px",
                paddingInline: isMobile ? "10px" : undefined,
              }}
            >
              {!isMobile && "Only my issues"}
            </Button>
          </Tooltip>

          {/* View Switcher */}
          <BoardViewSwitcher
            currentView={currentView}
            onViewChange={handleViewChange}
          />

          {/* View Settings — desktop only */}
          {!isMobile && (
            <Button
              icon={<SlidersHorizontal size={15} />}
              onClick={() => setSettingsOpen(true)}
              style={{ borderRadius: "8px", height: "36px" }}
            >
              View settings
            </Button>
          )}

          {/* Overflow / More menu */}
          {(isMobile || isAdmin || canManageColumns) && (
            <Dropdown
              menu={{
                items: [
                  ...(isMobile
                    ? [
                        {
                          key: "groupby",
                          label: "Group By",
                          children: [
                            { key: "gb-none", label: `${groupBy === "none" ? "✓ " : ""}No Grouping`, onClick: () => handleGroupByChange("none") },
                            { key: "gb-assignee", label: `${groupBy === "assignee" ? "✓ " : ""}Assignee`, onClick: () => handleGroupByChange("assignee") },
                            { key: "gb-priority", label: `${groupBy === "priority" ? "✓ " : ""}Priority`, onClick: () => handleGroupByChange("priority") },
                            { key: "gb-type", label: `${groupBy === "type" ? "✓ " : ""}Type`, onClick: () => handleGroupByChange("type") },
                            { key: "gb-epic", label: `${groupBy === "epic" ? "✓ " : ""}Epic`, onClick: () => handleGroupByChange("epic") },
                            { key: "gb-sprint", label: `${groupBy === "sprint" ? "✓ " : ""}Sprint`, onClick: () => handleGroupByChange("sprint") },
                          ],
                        },
                        { type: "divider" as const, key: "d1" },
                        { key: "view-settings", label: "View settings", onClick: () => setSettingsOpen(true) },
                        ...(isAdmin || canManageColumns ? [{ type: "divider" as const, key: "d2" }] : []),
                      ]
                    : []),
                  ...(isAdmin || canManageColumns
                    ? [{ key: "configure", label: "Configure board", onClick: () => setConfigureBoardOpen(true) }]
                    : []),
                ],
              }}
              trigger={["click"]}
            >
              <Button
                icon={<MoreHorizontal size={15} />}
                style={{ borderRadius: "8px", height: "36px" }}
              />
            </Dropdown>
          )}

          {/* Member Avatars — desktop only */}
          {!isMobile && projectMembers.length > 0 && (
            <>
              <Divider type="vertical" style={{ height: "28px", margin: 0 }} />
              <BoardMemberStack members={projectMembers} onlineUserIds={onlineUserIds} />
            </>
          )}
        </div>
      </div>

      {/* Board Content Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        {/* Sprint Info Bar — Jira-style */}
        {activeSprint ? (
          <div
            style={{
              padding: isMobile ? "10px 12px" : "10px 16px",
              backgroundColor: "#ffffff",
              border: `1px solid ${COLORS.border}`,
              borderRadius: "10px",
              marginBottom: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
          >
            {/* Left: sprint name + dates */}
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 20, flexWrap: "wrap" }}>
              <div>
                <Text style={{ fontSize: "11px", color: COLORS.textSecondary, fontWeight: 500, display: "block", lineHeight: 1 }}>
                  Active Sprint
                </Text>
                <Text strong style={{ fontSize: isMobile ? "13px" : "15px", color: COLORS.textPrimary, lineHeight: 1.3 }}>
                  {activeSprint.name}
                </Text>
              </div>
              {!isMobile && <Divider type="vertical" style={{ height: "28px", margin: 0 }} />}
              {(activeSprint.startDate || activeSprint.endDate) && (
                <Text style={{ fontSize: "12px", color: COLORS.textSecondary }}>
                  {activeSprint.startDate ? new Date(activeSprint.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "?"}
                  {" – "}
                  {activeSprint.endDate ? new Date(activeSprint.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "?"}
                </Text>
              )}
              {!isMobile && activeSprint.goal && (
                <>
                  <Divider type="vertical" style={{ height: "28px", margin: 0 }} />
                  <Text style={{ fontSize: "12px", color: COLORS.textSecondary, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    🎯 {activeSprint.goal}
                  </Text>
                </>
              )}
            </div>

            {/* Right: progress + manage button */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Progress bar */}
              {activeSprint.totalIssues > 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, minWidth: isMobile ? 100 : 140 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <Text style={{ fontSize: "11px", color: COLORS.textSecondary }}>Progress</Text>
                    <Text style={{ fontSize: "11px", fontWeight: 600, color: COLORS.textPrimary }}>
                      {activeSprint.completedIssues}/{activeSprint.totalIssues}
                    </Text>
                  </div>
                  <div style={{ width: "100%", height: 6, backgroundColor: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.round((activeSprint.completedIssues / activeSprint.totalIssues) * 100)}%`,
                        height: "100%",
                        backgroundColor: COLORS.success,
                        borderRadius: 99,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                  <Text style={{ fontSize: "10px", color: COLORS.textSecondary }}>
                    {Math.round((activeSprint.completedIssues / activeSprint.totalIssues) * 100)}% complete
                  </Text>
                </div>
              )}
              {canManageSprints && (
                <Button
                  onClick={() => navigate(`/projects/${projectId}/sprints`)}
                  style={{ borderRadius: "8px", flexShrink: 0 }}
                  size={isMobile ? "small" : "middle"}
                >
                  {isMobile ? "Manage" : "Complete Sprint"}
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {/* Search & Filters */}
        {showFilters && (
          <div
            style={{
              padding: "16px",
              background: "#ffffff",
              borderRadius: "10px",
              border: `1px solid ${COLORS.border}`,
              marginBottom: "16px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <Text strong style={{ fontSize: "16px" }}>
                Search & Filters
              </Text>
              <Button
                type="link"
                size="small"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                Clear All
              </Button>
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Input
                prefix={<Search size={14} color={COLORS.textSecondary} />}
                placeholder="Search issues..."
                value={filters.searchQuery}
                onChange={(e) => updateFilter("searchQuery", e.target.value)}
                style={{ width: "240px", height: "36px", borderRadius: "8px" }}
              />
              <Select
                mode="multiple"
                placeholder="Assignee"
                value={filters.assigneeIds}
                onChange={(val) => updateFilter("assigneeIds", val)}
                style={{ minWidth: "150px" }}
                maxTagCount={1}
                allowClear
              >
                {membersForCreate.map((m) => (
                  <Select.Option key={m.id} value={m.id}>
                    {m.displayName}
                  </Select.Option>
                ))}
              </Select>
              <Select
                mode="multiple"
                placeholder="Type"
                value={filters.typeIds}
                onChange={(val) => updateFilter("typeIds", val)}
                style={{ minWidth: "120px" }}
                maxTagCount={1}
                allowClear
              >
                {issueTypesForCreate.map((t) => (
                  <Select.Option key={t.id} value={t.id}>
                    {t.name}
                  </Select.Option>
                ))}
              </Select>
              <Select
                mode="multiple"
                placeholder="Priority"
                value={filters.priorityIds}
                onChange={(val) => updateFilter("priorityIds", val)}
                style={{ minWidth: "120px" }}
                maxTagCount={1}
                allowClear
              >
                {prioritiesForCreate.map((p) => (
                  <Select.Option key={p.id} value={p.id}>
                    {p.name}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {/* Main Board View */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {currentView === "kanban" ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              autoScroll={false}
            >
              {groupBy === "none" ? (
                <div
                  ref={boardScrollRef}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "16px",
                    paddingBottom: "16px",
                    minHeight: "100%",
                    overflowX: "auto",
                    overflowY: "auto",
                    overscrollBehaviorX: "contain",
                  }}
                >
                  <SortableContext
                    items={sprintBoardColumns.map((c) => c.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {sprintBoardColumns.map((column) => (
                      <BoardColumn
                        key={column.id}
                        column={column}
                        projectId={projectId}
                        onIssueUpdate={refetch}
                        onCreateIssue={openCreateIssue}
                        onClickIssue={(issue) => openIssue(issue.id, projectId)}
                        cardFieldVisibility={cardFields}
                        flaggedIssueIds={flaggedIssueIds}
                        onToggleFlag={handleToggleFlag}
                      />
                    ))}
                  </SortableContext>

                </div>
              ) : (
                /* Swimlane View Implementation */
                <div style={{ overflowY: "auto", height: "100%" }}>
                  {swimlanes?.map((lane) => (
                    <div
                      key={lane.id}
                      style={{
                        marginBottom: "16px",
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: "12px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        onClick={() => toggleSwimlane(lane.id)}
                        style={{
                          padding: "10px 16px",
                          background: "#f4f5f7",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          borderBottom: collapsedSwimlanes.has(lane.id)
                            ? "none"
                            : `1px solid ${COLORS.border}`,
                        }}
                      >
                        {collapsedSwimlanes.has(lane.id) ? (
                          <ChevronRight size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                        <Text
                          strong
                          style={{
                            fontSize: "14px",
                            color: COLORS.textPrimary,
                          }}
                        >
                          {lane.name}
                        </Text>
                        <Tag
                          style={{
                            fontSize: "11px",
                            lineHeight: "18px",
                            borderRadius: "9px",
                          }}
                        >
                          {lane.issues.length}
                        </Tag>
                      </div>
                      {!collapsedSwimlanes.has(lane.id) && (
                        <div
                          style={{
                            display: "flex",
                            gap: "16px",
                            padding: "16px",
                            overflowX: "auto",
                          }}
                        >
                          {sprintBoardColumns.map((col) => {
                            const laneIssues = lane.issues.filter(
                              (iss: any) => iss._colId === col.id,
                            );
                            return (
                              <BoardColumn
                                key={`${lane.id}-${col.id}`}
                                column={{ ...col, issues: laneIssues }}
                                projectId={projectId}
                                onIssueUpdate={refetch}
                                onCreateIssue={openCreateIssue}
                                onClickIssue={(issue) => openIssue(issue.id, projectId)}
                                cardFieldVisibility={cardFields}
                                flaggedIssueIds={flaggedIssueIds}
                                onToggleFlag={handleToggleFlag}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <DragOverlay style={{ pointerEvents: "none", zIndex: 1000 }}>
                {activeIssue ? (
                  <BoardCard
                    issue={activeIssue}
                    projectId={projectId}
                    isDragging
                    fieldVisibility={cardFields}
                  />
                ) : activeColumn ? (
                  <BoardColumn
                    column={activeColumn}
                    projectId={projectId}
                    cardFieldVisibility={cardFields}
                    canDrag={false}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : currentView === "list" ? (
            <BoardListView
              columns={filteredColumns}
              projectId={projectId!}
              onCreateIssue={openCreateIssue}
            />
          ) : currentView === "timeline" ? (
            <BoardTimelineView
              columns={filteredColumns}
              projectId={projectId}
            />
          ) : (
            <CalendarView columns={filteredColumns} projectId={projectId!} />
          )}
        </div>
      </div>

      {/* Modals & Overlays */}

      <CreateIssueModal
        open={isCreateIssueOpen}
        onOpenChange={setIsCreateIssueOpen}
        projectId={projectId!}
        defaultStatusId={createIssueStatusId}
        defaultSprintId={activeSprintId}
        issueTypes={issueTypesForCreate}
        priorities={prioritiesForCreate}
        members={membersForCreate}
        onSuccess={() => {
          setIsCreateIssueOpen(false);
          refetch();
        }}
      />

      <Drawer
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <SlidersHorizontal size={18} /> View settings
          </div>
        }
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        width={360}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <Title level={5}>Card fields</Title>
            <Text
              type="secondary"
              style={{ display: "block", marginBottom: "16px" }}
            >
              Choose which fields to show on cards.
            </Text>
            <Space direction="vertical" style={{ width: "100%" }}>
              {[
                { key: "showWorkType", label: "Work type" },
                { key: "showIssueKey", label: "Issue key" },
                { key: "showStoryPoints", label: "Story points" },
                { key: "showDueDate", label: "Due date" },
                { key: "showAssignee", label: "Assignee" },
                { key: "showPriority", label: "Priority" },
              ].map((field) => (
                <div
                  key={field.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text>{field.label}</Text>
                  <Switch
                    size="small"
                    checked={
                      cardFields[field.key as keyof BoardCardFieldVisibility]
                    }
                    onChange={(checked) =>
                      handleCardFieldToggle(
                        field.key as keyof BoardCardFieldVisibility,
                        checked,
                      )
                    }
                  />
                </div>
              ))}
            </Space>
          </div>

          <Divider style={{ margin: 0 }} />

          <div>
            <Title level={5}>Preferences</Title>
            <Space
              direction="vertical"
              style={{ width: "100%", marginTop: "16px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text>Open in sidebar</Text>
                <Switch
                  size="small"
                  checked={openInSidebar}
                  onChange={setOpenInSidebar}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text>Work suggestions</Text>
                <Switch
                  size="small"
                  checked={workSuggestions}
                  onChange={setWorkSuggestions}
                />
              </div>
            </Space>
          </div>
        </div>
      </Drawer>

      {configureBoardOpen && projectId && (
        <ConfigureBoardModal
          open={configureBoardOpen}
          onClose={() => setConfigureBoardOpen(false)}
          projectId={projectId}
          boardColumns={columns}
          onSaved={() => {
            setConfigureBoardOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
