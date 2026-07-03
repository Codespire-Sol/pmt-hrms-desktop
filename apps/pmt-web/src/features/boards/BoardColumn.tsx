import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { BoardCard, type BoardCardFieldVisibility } from "./BoardCard";
import {
  useUpdateWipLimitMutation,
  useDeleteBoardColumnMutation,
} from "./boardsApi";
import { Issue } from "../issues/issuesApi";
import {
  AlertCircle,
  Edit2,
  X,
  Check,
  MoreVertical,
  Plus,
  GripVertical,
} from "lucide-react";
import type { BoardColumn as BoardColumnType } from "./boardsApi";
import {
  Typography,
  Button,
  Input,
  Badge,
  Space,
  message,
  Modal,
  Dropdown,
} from "antd";

const { Text, Title } = Typography;

interface BoardColumnProps {
  column: BoardColumnType;
  projectId?: string;
  onIssueUpdate?: () => void;
  canDrag?: boolean;
  onCreateIssue?: (statusId: string) => void;
  cardFieldVisibility?: BoardCardFieldVisibility;
  flaggedIssueIds?: Set<string>;
  onToggleFlag?: (issueId: string) => void;
  onClickIssue?: (issue: Issue) => void;
}

const COLORS = {
  primary: "#0052cc",
  success: "#36b37e",
  warning: "#ffab00",
  danger: "#de350b",
  textPrimary: "#172b4d",
  textSecondary: "#6b778c",
  border: "#dfe1e6",
  surface: "#f4f5f7",
  surfaceHeader: "#f4f5f7",
};

const getApiErrorMessage = (error: any, fallback: string) =>
  error?.data?.message || error?.error || fallback;

export function BoardColumn({
  column,
  projectId,
  onIssueUpdate,
  canDrag = true,
  onCreateIssue,
  cardFieldVisibility,
  flaggedIssueIds,
  onToggleFlag,
  onClickIssue,
}: BoardColumnProps) {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column.id,
  });

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const sortableStyle = {
    transform: CSS.Translate.toString(transform),
    // Merge dnd-kit's transform transition with a smooth height/shadow transition
    transition: [transition, "box-shadow 0.2s ease", "border-color 0.2s ease"]
      .filter(Boolean)
      .join(", "),
    opacity: isDragging ? 0.4 : 1,
    display: "flex",
    flexDirection: "column" as const,
    width: "300px",
    flexShrink: 0,
    borderRadius: "10px",
    backgroundColor: COLORS.surface,
    border: `1px solid ${isOver ? COLORS.primary : COLORS.border}`,
    boxShadow: isOver ? "0 0 0 2px #4c8dff44 inset" : "none",
    // Height is driven by content — no fixed height
  };

  const [isWipModalOpen, setIsWipModalOpen] = useState(false);
  const [wipValue, setWipValue] = useState(column.wipLimit?.toString() || "");
  const [updateWipLimit] = useUpdateWipLimitMutation();
  const [deleteColumn] = useDeleteBoardColumnMutation();

  const issueIds = column.issues.map((issue) => issue.id);
  const isOverLimit = !!(
    column.wipLimit && column.issues.length > column.wipLimit
  );

  const handleSaveWip = async () => {
    const wipLimit = wipValue === "" ? null : parseInt(wipValue, 10);
    try {
      await updateWipLimit({
        projectId: column.issues[0]?.projectId || projectId || "",
        statusId: column.id,
        wipLimit,
      }).unwrap();
      setIsWipModalOpen(false);
      message.success("WIP limit updated");
    } catch {
      message.error("Failed to update WIP limit");
    }
  };

  const handleDeleteColumn = () => {
    Modal.confirm({
      title: "Delete Column",
      content: `Delete "${column.displayName}"? This will fail if the column has issues or is an initial/final workflow column.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await deleteColumn({
            projectId: projectId!,
            statusId: column.id,
          }).unwrap();
          message.success("Column deleted");
          onIssueUpdate?.();
        } catch (error: any) {
          message.error(getApiErrorMessage(error, "Failed to delete column"));
        }
      },
    });
  };

  const columnMenuItems = [
    {
      key: "wip",
      label: "Set WIP Limit",
      icon: <Edit2 size={14} />,
      onClick: () => setIsWipModalOpen(true),
    },
    {
      key: "delete",
      label: "Delete Column",
      icon: <X size={14} />,
      danger: true,
      onClick: handleDeleteColumn,
    },
  ];

  return (
    <div ref={setSortableRef} style={sortableStyle}>
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${COLORS.border}`,
          backgroundColor: COLORS.surfaceHeader,
          borderRadius: "10px 10px 0 0",
          cursor: "default",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "6px",
          }}
        >
          <Space size={8}>
            <div
              {...attributes}
              {...listeners}
              style={{
                cursor: "grab",
                display: "flex",
                alignItems: "center",
                color: COLORS.textSecondary,
              }}
            >
              <GripVertical size={16} />
            </div>
            <Title
              level={5}
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 700,
                color: COLORS.textPrimary,
              }}
            >
              {column.displayName}
            </Title>
            <Badge
              count={column.issues.length}
              style={{
                backgroundColor: "#dfe1e6",
                color: COLORS.textSecondary,
                fontSize: "11px",
                fontWeight: 700,
                boxShadow: "none",
              }}
            />
          </Space>
          <Space size={2}>
            <Dropdown menu={{ items: columnMenuItems }} trigger={["click"]}>
              <Button
                type="text"
                size="small"
                icon={<MoreVertical size={14} color={COLORS.textSecondary} />}
              />
            </Dropdown>
          </Space>
        </div>

        {isOverLimit && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "6px",
            }}
          >
            <AlertCircle size={12} color={COLORS.warning} />
            <Text
              style={{
                fontSize: "11px",
                color: COLORS.warning,
                fontWeight: 600,
              }}
            >
              Over WIP limit ({column.issues.length}/{column.wipLimit})
            </Text>
          </div>
        )}
      </div>

      <div
        ref={setDroppableRef}
        style={{
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          // minHeight keeps empty columns droppable
          minHeight: "80px",
          // Smooth grow when a card is added or the drop placeholder appears
          transition: "min-height 0.25s ease",
        }}
      >
        <SortableContext
          items={issueIds}
          strategy={verticalListSortingStrategy}
        >
          {column.issues.map((issue) => (
            <div key={issue.id} className="board-card-enter">
              <BoardCard
                issue={{
                  ...issue,
                  status: issue.status || {
                    id: column.id,
                    name: column.name,
                    displayName: column.displayName,
                    color: column.color,
                    category: column.category,
                  },
                }}
                projectId={projectId || issue.projectId}
                onQuickEdit={onIssueUpdate}
                canDrag={canDrag}
                fieldVisibility={cardFieldVisibility}
                isFlagged={flaggedIssueIds?.has(issue.id)}
                onToggleFlag={onToggleFlag}
                onClick={() => onClickIssue?.(issue)}
              />
            </div>
          ))}
          {/* Drop Prediction / Placeholder */}
          {isOver && (
            <div
              style={{
                height: "80px",
                borderRadius: "8px",
                backgroundColor: "#091e4214",
                border: `2px dashed ${COLORS.primary}`,
                opacity: 0.6,
                transition: "all 0.2s ease",
                margin: "4px 0",
              }}
            />
          )}
        </SortableContext>

        {column.issues.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: `1px dashed ${isOver ? COLORS.primary : COLORS.border}`,
              backgroundColor: isOver ? "#091e420a" : "transparent",
              borderRadius: "8px",
              padding: "24px 16px",
              textAlign: "center",
              transition: "background-color 0.15s ease, border-color 0.15s ease",
            }}
          >
            <Plus
              size={20}
              color={isOver ? COLORS.primary : COLORS.textSecondary}
              style={{ marginBottom: "8px" }}
            />
            <Text
              style={{
                color: COLORS.textSecondary,
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              {isOver ? "Drop to add" : "Drop issues here"}
            </Text>
          </div>
        )}

        <Button
          type="text"
          icon={<Plus size={16} />}
          onClick={() => onCreateIssue?.(column.id)}
          style={{
            width: "100%",
            height: "36px",
            justifyContent: "flex-start",
            color: COLORS.textSecondary,
            borderRadius: "6px",
            marginTop: "4px",
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            fontSize: "14px",
            fontWeight: 500,
          }}
          className="column-create-btn"
        >
          Create issue
        </Button>
      </div>

      <Modal
        title="Column WIP Limit"
        open={isWipModalOpen}
        onOk={handleSaveWip}
        onCancel={() => setIsWipModalOpen(false)}
        okText="Save"
        width={320}
      >
        <div style={{ padding: "10px 0" }}>
          <Text
            type="secondary"
            style={{ display: "block", marginBottom: "8px" }}
          >
            Limit the number of issues in this column to prevent bottlenecks.
          </Text>
          <Input
            type="number"
            min="0"
            prefix={
              <AlertCircle size={14} style={{ color: COLORS.textSecondary }} />
            }
            placeholder="No limit"
            value={wipValue}
            onChange={(e) => setWipValue(e.target.value)}
            style={{ width: "100%", height: "40px", borderRadius: "8px" }}
          />
        </div>
      </Modal>

      <style>{`
        .column-create-btn:hover {
          background-color: #091e4214 !important;
          color: ${COLORS.textPrimary} !important;
        }
        @keyframes cardSlideIn {
          from {
            opacity: 0;
            transform: translateY(-8px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .board-card-enter {
          animation: cardSlideIn 0.22s cubic-bezier(0.34, 1.3, 0.64, 1) both;
        }
      `}</style>
    </div>
  );
}
