import React, { useState } from "react";
import {
  Drawer,
  Table,
  Tag,
  Typography,
  Button,
  Empty,
  Tooltip,
} from "antd";
import {
  X,
  ExternalLink,
  Clock,
  User,
  FileText,
} from "lucide-react";
import { useGetSubmissionsQuery } from "../formsApi";
import type { FormSubmission } from "../formsApi";
import type { ColumnsType } from "antd/es/table";

const { Text } = Typography;

interface FormSubmissionsDrawerProps {
  formId: string | null;
  projectId: string;
  open: boolean;
  onClose: () => void;
}

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

const getSummaryFromPayload = (
  payload: Record<string, unknown>
): string => {
  const summary =
    payload?.summary || payload?.title || payload?.name || "";
  const str = String(summary).trim();
  return str.length > 80 ? str.slice(0, 80) + "..." : str || "-";
};

export const FormSubmissionsDrawer: React.FC<FormSubmissionsDrawerProps> = ({
  formId,
  projectId,
  open,
  onClose,
}) => {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useGetSubmissionsQuery(
    { formId: formId!, page, limit: 20 },
    { skip: !formId }
  );

  const submissions = data?.submissions || [];
  const pagination = data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  };

  const columns: ColumnsType<FormSubmission> = [
    {
      title: "#",
      width: 50,
      render: (_, __, index) => (
        <Text className="text-[#9eaec2] text-xs font-mono">
          {(page - 1) * 20 + index + 1}
        </Text>
      ),
    },
    {
      title: (
        <span className="flex items-center gap-1.5">
          <Clock size={13} /> Submitted
        </span>
      ),
      dataIndex: "createdAt",
      width: 130,
      render: (val: string) => (
        <Tooltip title={new Date(val).toLocaleString()}>
          <Text className="text-[#5e6c84] text-xs">{formatDate(val)}</Text>
        </Tooltip>
      ),
    },
    {
      title: (
        <span className="flex items-center gap-1.5">
          <User size={13} /> By
        </span>
      ),
      dataIndex: "submittedBy",
      width: 120,
      render: (val: string | null) => (
        <Text className="text-xs">
          {val ? (
            <span className="text-[#172b4d]">{val}</span>
          ) : (
            <span className="text-[#9eaec2] italic">Anonymous</span>
          )}
        </Text>
      ),
    },
    {
      title: (
        <span className="flex items-center gap-1.5">
          <FileText size={13} /> Summary
        </span>
      ),
      dataIndex: "payload",
      render: (payload: Record<string, unknown>) => (
        <Text className="text-sm text-[#172b4d]">
          {getSummaryFromPayload(payload)}
        </Text>
      ),
    },
    {
      title: "Issue",
      dataIndex: "createdIssueId",
      width: 100,
      render: (issueId: string | null) =>
        issueId ? (
          <Button
            type="link"
            size="small"
            icon={<ExternalLink size={13} />}
            onClick={() => {
              window.open(
                `/projects/${projectId}/issues/${issueId}`,
                "_blank"
              );
            }}
            className="text-[#0052cc] text-xs p-0 h-auto"
          >
            View
          </Button>
        ) : (
          <Text className="text-[#9eaec2] text-xs">-</Text>
        ),
    },
  ];

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-[#0052cc]" />
          <span className="text-[#172b4d] font-bold">Form Submissions</span>
          {pagination.total > 0 && (
            <Tag className="ml-1">{pagination.total}</Tag>
          )}
        </div>
      }
      open={open}
      onClose={onClose}
      width={700}
      closeIcon={<X size={20} className="text-[#5e6c84]" />}
      styles={{
        body: { padding: 0 },
      }}
    >
      {!formId ? (
        <div className="p-8">
          <Empty description="No form selected" />
        </div>
      ) : (
        <Table
          dataSource={submissions}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={
            pagination.totalPages > 1
              ? {
                  current: page,
                  pageSize: 20,
                  total: pagination.total,
                  onChange: (p) => setPage(p),
                  showSizeChanger: false,
                  size: "small",
                }
              : false
          }
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No submissions yet"
              />
            ),
          }}
          expandable={{
            expandedRowRender: (record) => (
              <div className="p-3 bg-[#f8fafc] rounded-lg">
                <Text className="text-xs font-bold uppercase tracking-wider text-[#9eaec2] block mb-2">
                  Full Payload
                </Text>
                <div className="space-y-1.5">
                  {Object.entries(record.payload || {}).map(([key, val]) => (
                    <div key={key} className="flex gap-3">
                      <Text className="text-xs font-mono text-[#5e6c84] min-w-[120px]">
                        {key}:
                      </Text>
                      <Text className="text-xs text-[#172b4d]">
                        {val === null || val === undefined
                          ? "-"
                          : typeof val === "object"
                            ? JSON.stringify(val)
                            : String(val)}
                      </Text>
                    </div>
                  ))}
                </div>
                {record.metadata?.issueCreationError && (
                  <div className="mt-3 p-2 bg-red-50 rounded border border-red-100">
                    <Text className="text-xs text-red-600">
                      Issue creation error:{" "}
                      {String(record.metadata.issueCreationError)}
                    </Text>
                  </div>
                )}
              </div>
            ),
            rowExpandable: (record) =>
              !!record.payload && Object.keys(record.payload).length > 0,
          }}
          className="submissions-table"
        />
      )}

      <style>{`
        .submissions-table .ant-table-thead > tr > th {
          background: #f8fafc !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          color: #9eaec2 !important;
          border-bottom: 1px solid #e5e7eb !important;
          padding: 10px 12px !important;
        }
        .submissions-table .ant-table-tbody > tr > td {
          padding: 10px 12px !important;
          border-bottom: 1px solid #f4f5f7 !important;
        }
        .submissions-table .ant-table-tbody > tr:hover > td {
          background: #f8fafc !important;
        }
      `}</style>
    </Drawer>
  );
};

export default FormSubmissionsDrawer;
