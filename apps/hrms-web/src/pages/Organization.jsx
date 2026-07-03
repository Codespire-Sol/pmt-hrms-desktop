import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Typography,
  Space,
  Avatar,
  Input,
  Breadcrumb,
  Empty,
  Skeleton,
  Select,
} from 'antd';
import { Tree, TreeNode } from 'react-organizational-chart';
import { Building2, Mail, Search, ChevronDown, ChevronUp, Users, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { employeeAPI } from '../api/employees';
import { adminAPI } from '../api/admin';
import Layout from '../components/layout/Layout';
import { themeTokens } from '../styles/theme';
import { normalizeAvatarUrl } from '../utils/auth';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useAuth } from '../hooks/useAuth';
import { HRMS_DATA_REFRESH_EVENT, isScopeMatch } from '../utils/realtime';

const { Title, Text } = Typography;

const BRAND_COLOR = '#1368FF';

function buildDeptColorMap(departments) {
  const map = {};
  departments.forEach((dept) => {
    map[dept] = BRAND_COLOR;
  });
  return map;
}

function getInitials(name = '') {
  return name.trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

// ── Smooth hover detail card — floats to the right or left of the org node ───
function EmployeeHoverCard({ node, visible, deptColor, side }) {
  const statusConfig = {
    active:        { bg: '#dcfce7', color: '#16a34a', label: 'Active' },
    onboarding:    { bg: '#fef3c7', color: '#d97706', label: 'Onboarding' },
    inactive:      { bg: '#fee2e2', color: '#dc2626', label: 'Inactive' },
    notice_period: { bg: '#fce7f3', color: '#db2777', label: 'Notice Period' },
  };
  const sc = statusConfig[node.status] || { bg: '#f1f5f9', color: '#64748b', label: node.status || 'Unknown' };
  const isRight = side !== 'left';

  // Slide in from the correct side; spring easing for a soft, natural feel
  const slideOffset = isRight ? '-10px' : '10px';
  const popupTransform = visible
    ? 'translateY(-50%) translateX(0) scale(1)'
    : `translateY(-50%) translateX(${slideOffset}) scale(0.94)`;

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        ...(isRight ? { left: 'calc(100% + 18px)' } : { right: 'calc(100% + 18px)' }),
        transform: popupTransform,
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
        // Slower enter (spring), quicker fade-out
        transition: visible
          ? 'opacity 0.3s ease, transform 0.45s cubic-bezier(0.34, 1.4, 0.64, 1)'
          : 'opacity 0.2s ease, transform 0.25s ease',
        zIndex: 9999,
        width: 258,
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.14), 0 6px 20px rgba(0,0,0,0.08)',
        border: `1.5px solid ${deptColor}33`,
        overflow: 'visible',
      }}
    >
      {/* Header strip */}
      <div
        style={{
          background: `linear-gradient(135deg, ${deptColor}1e, ${deptColor}06)`,
          borderBottom: `1px solid ${deptColor}1e`,
          borderRadius: '13px 13px 0 0',
          padding: '14px 14px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Avatar
          size={46}
          src={normalizeAvatarUrl(node.avatarUrl || node.avatar)}
          style={{
            background: BRAND_COLOR,
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            border: `2px solid ${BRAND_COLOR}66`,
            flexShrink: 0,
          }}
        >
          {getInitials(node.name)}
        </Avatar>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 13.5,
              color: '#1e293b',
              lineHeight: 1.25,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.name || 'Unknown'}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: '#64748b',
              marginTop: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.designation || '—'}
          </div>
        </div>
      </div>

      {/* Details */}
      <div style={{ padding: '12px 14px 14px' }}>
        {/* Employee ID */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: `${deptColor}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: 8, fontWeight: 800, color: deptColor, letterSpacing: '-0.5px' }}>ID</span>
          </div>
          <span style={{ fontSize: 12.5, color: '#1e293b', fontFamily: 'monospace', fontWeight: 600 }}>
            {node.employeeCode || node.employeeId || '—'}
          </span>
        </div>

        {/* Department */}
        {node.department && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: `${deptColor}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Building2 size={12} color={deptColor} />
            </div>
            <span style={{ fontSize: 12, color: '#374151' }}>{node.department}</span>
          </div>
        )}

        {/* Email */}
        {node.email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: '#f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Mail size={12} color="#64748b" />
            </div>
            <span style={{
              fontSize: 11.5, color: '#64748b',
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap', flex: 1,
            }}>
              {node.email}
            </span>
          </div>
        )}

        {/* Status badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: sc.bg,
          color: sc.color,
          padding: '3px 10px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 600,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.color, flexShrink: 0 }} />
          {sc.label}
        </div>
      </div>

      {/* Side arrow pointing toward the card */}
      <div style={{
        position: 'absolute',
        top: '50%',
        ...(isRight
          ? {
              left: -7,
              transform: 'translateY(-50%) rotate(45deg)',
              borderLeft: `1.5px solid ${deptColor}33`,
              borderBottom: `1.5px solid ${deptColor}33`,
            }
          : {
              right: -7,
              transform: 'translateY(-50%) rotate(45deg)',
              borderRight: `1.5px solid ${deptColor}33`,
              borderTop: `1.5px solid ${deptColor}33`,
            }
        ),
        width: 13,
        height: 13,
        background: '#fff',
      }} />
    </div>
  );
}

// ── KEKA-style org card with smart-side hover popup ───────────────────────────
function OrgCard({ node, collapsed, onToggle, deptColorMap }) {
  const [hovered, setHovered] = useState(false);
  const [popupSide, setPopupSide] = useState('right');
  const wrapperRef = useRef(null);

  const hasChildren = Array.isArray(node._children) && node._children.length > 0;
  const deptColor = deptColorMap[node.department] || BRAND_COLOR;
  const childCount = node._children?.length || 0;

  const handleMouseEnter = useCallback((e) => {
    // Pick the side with more viewport space
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setPopupSide(window.innerWidth - rect.right >= rect.left ? 'right' : 'left');
    }
    setHovered(true);
    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)';
    e.currentTarget.style.transform = 'translateY(-2px)';
  }, []);

  const handleMouseLeave = useCallback((e) => {
    setHovered(false);
    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)';
    e.currentTarget.style.transform = 'translateY(0)';
  }, []);

  return (
    <div ref={wrapperRef} style={{ display: 'inline-block', position: 'relative', zIndex: hovered ? 50 : 1 }}>
      {/* Hover detail popup */}
      <EmployeeHoverCard node={node} visible={hovered} deptColor={deptColor} side={popupSide} />

      <div
        style={{
          width: 192,
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 0 0 1px rgba(0,0,0,0.05)',
          borderTop: `3px solid ${deptColor}`,
          position: 'relative',
          transition: 'box-shadow 0.25s ease, transform 0.2s ease',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Card content — no click navigation */}
        <div style={{ padding: '16px 12px 12px', textAlign: 'center', cursor: 'default' }}>
          <Avatar
            size={52}
            src={normalizeAvatarUrl(node.avatarUrl || node.avatar)}
            style={{
              background: BRAND_COLOR,
              color: '#fff',
              fontWeight: 700,
              fontSize: 18,
              border: `2px solid ${BRAND_COLOR}55`,
              flexShrink: 0,
            }}
          >
            {getInitials(node.name)}
          </Avatar>

          <div style={{
            fontWeight: 700,
            fontSize: 13,
            color: '#1e293b',
            marginTop: 8,
            lineHeight: '1.3',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {node.name || 'Unknown'}
          </div>

          {node.designation && (
            <div style={{
              fontSize: 11,
              color: '#64748b',
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {node.designation}
            </div>
          )}

          {node.department && !['pending', 'unassigned'].includes(node.department.toLowerCase()) && (
            <div style={{
              display: 'inline-block',
              marginTop: 6,
              padding: '2px 8px',
              background: `${deptColor}18`,
              color: deptColor,
              borderRadius: 20,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.02em',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {node.department}
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderTop: '1px solid #f1f5f9',
              borderRadius: '0 0 12px 12px',
              padding: '5px 0',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.03em',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = BRAND_COLOR; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
          >
            {collapsed
              ? <><ChevronDown size={11} /> {childCount} report{childCount !== 1 ? 's' : ''}</>
              : <><ChevronUp size={11} /> Collapse</>
            }
          </button>
        )}
      </div>
    </div>
  );
}

// ── Virtual root node ─────────────────────────────────────────────────────────
function VirtualRootLabel({ label, color, count }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: color || BRAND_COLOR,
        color: '#fff',
        padding: '10px 22px',
        borderRadius: 30,
        fontWeight: 700,
        fontSize: 13,
        boxShadow: `0 4px 14px ${BRAND_COLOR}55`,
        letterSpacing: '0.02em',
      }}
    >
      {label === 'Company' ? <Building2 size={15} /> : <Users size={15} />}
      {label}
      <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '1px 8px', fontSize: 11 }}>
        {count}
      </span>
    </div>
  );
}

export default function Organization() {
  const { isAdmin, user } = useAuth();
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [allEmployees, setAllEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [deptColorMap, setDeptColorMap] = useState({});
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [hierarchy, setHierarchy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const [branches, setBranches] = useState([]);
  const [branchFilter, setBranchFilter] = useState(null);
  const [zoom, setZoom] = useState(1);
  const ZOOM_STEP = 0.15;
  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 2;

  useEffect(() => {
    if (isAdmin) {
      adminAPI.getBranches().then(res => {
        setBranches(Array.isArray(res?.data) ? res.data : []);
      }).catch(() => {});
    }
  }, [isAdmin]);

  useEffect(() => { loadHierarchy(); }, [branchFilter]);
  useAutoRefresh(loadHierarchy, { enabled: true, scope: 'org', intervalMs: 120000 });

  // Re-fetch when another page broadcasts an employee data refresh (e.g. after EditEmployee save)
  useEffect(() => {
    const handler = (e) => {
      if (isScopeMatch(e.detail?.scope, 'employees')) loadHierarchy();
    };
    window.addEventListener(HRMS_DATA_REFRESH_EVENT, handler);
    return () => window.removeEventListener(HRMS_DATA_REFRESH_EVENT, handler);
  }, []);

  const normalizeNode = (node) => ({
    ...node,
    name: node.name || [node.firstName, node.lastName].filter(Boolean).join(' ') || 'Unknown',
    children: Array.isArray(node.children) ? node.children.map(normalizeNode) : [],
  });

  const flattenTree = (nodes, result = []) => {
    for (const node of nodes) {
      const { children, ...rest } = node;
      result.push(rest);
      if (Array.isArray(children) && children.length) flattenTree(children, result);
    }
    return result;
  };

  const buildTreeFromFlat = useCallback((employees) => {
    const map = {};
    const roots = [];
    employees.forEach(item => { map[item.id] = { ...item, children: [] }; });
    employees.forEach(item => {
      if (item.managerId && map[item.managerId]) {
        map[item.managerId].children.push(map[item.id]);
      } else {
        roots.push(map[item.id]);
      }
    });
    const sortNodes = (nodes) =>
      nodes
        .map(n => ({ ...n, children: sortNodes(n.children || []) }))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
    return sortNodes(roots);
  }, []);

  async function loadHierarchy() {
    setLoading(true);
    try {
      // Admin can filter by branch via branchFilter; HR branch is enforced server-side
      const effectiveBranchId = isAdmin ? branchFilter : (user?.branchId || null);
      const response = await employeeAPI.getHierarchy(effectiveBranchId);
      const rawData = Array.isArray(response?.data) ? response.data : [];
      const isFlat = rawData.length > 0 && !rawData[0].children;

      let flatList;
      if (isFlat) {
        flatList = rawData.map(n => normalizeNode({ ...n, children: [] }));
      } else {
        flatList = flattenTree(rawData.map(normalizeNode));
      }

      setAllEmployees(flatList);
      const UNSET = new Set(['pending', 'unassigned', '']);
      const depts = [...new Set(flatList.map(e => e.department).filter(d => d && !UNSET.has(d.toLowerCase().trim())))].sort();
      setDepartments(depts);
      setDeptColorMap(buildDeptColorMap(depts));
      setHierarchy(buildTreeFromFlat(flatList));
    } catch (error) {
      console.error('Failed to load hierarchy:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!allEmployees.length) return;
    if (selectedDepartment === 'all') {
      setHierarchy(buildTreeFromFlat(allEmployees));
    } else {
      const filtered = allEmployees.filter(e => e.department === selectedDepartment);
      const filteredIds = new Set(filtered.map(e => e.id));
      const adjusted = filtered.map(e => ({
        ...e,
        managerId: filteredIds.has(e.managerId) ? e.managerId : null,
      }));
      setHierarchy(buildTreeFromFlat(adjusted));
    }
    setCollapsedNodes(new Set());
    setZoom(1);
  }, [selectedDepartment, allEmployees]);

  // Drag-to-pan
  const handleMouseDown = useCallback((e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest?.('button')) return;
    isDragging.current = true;
    startPos.current = {
      x: e.clientX, y: e.clientY,
      scrollLeft: containerRef.current?.scrollLeft || 0,
      scrollTop: containerRef.current?.scrollTop || 0,
    };
  }, []);
  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current || !containerRef.current) return;
    containerRef.current.scrollLeft = startPos.current.scrollLeft - (e.clientX - startPos.current.x);
    containerRef.current.scrollTop = startPos.current.scrollTop - (e.clientY - startPos.current.y);
  }, []);
  const handleMouseUp = useCallback(() => { isDragging.current = false; }, []);

  // Pinch-to-zoom (touch)
  const lastTouchDist = useRef(null);
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, []);
  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = dist / lastTouchDist.current;
      lastTouchDist.current = dist;
      setZoom(z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +(z * delta).toFixed(2))));
    }
  }, []);
  const handleTouchEnd = useCallback(() => { lastTouchDist.current = null; }, []);

  const toggleCollapse = useCallback((nodeId) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  }, []);

  const filterTree = (nodes, search) => {
    if (!search) return nodes;
    const lc = search.toLowerCase();
    return nodes.map(node => {
      const filteredChildren = filterTree(node.children || [], search);
      const matches = (
        (node.name || '').toLowerCase().includes(lc) ||
        (node.designation || '').toLowerCase().includes(lc) ||
        (node.department || '').toLowerCase().includes(lc) ||
        (node.employeeCode || '').toLowerCase().includes(lc)
      );
      if (matches || filteredChildren.length > 0) return { ...node, children: filteredChildren };
      return null;
    }).filter(Boolean);
  };

  const attachOriginalChildren = (nodes) =>
    nodes.map(node => ({
      ...node,
      _children: node.children || [],
      children: attachOriginalChildren(node.children || []),
    }));

  const renderOrgNode = (node) => {
    const isCollapsed = collapsedNodes.has(node.id);
    const visibleChildren = isCollapsed ? [] : (node.children || []);
    return (
      <TreeNode
        key={node.id}
        label={
          <OrgCard
            node={node}
            collapsed={isCollapsed}
            onToggle={toggleCollapse}
            deptColorMap={deptColorMap}
          />
        }
      >
        {visibleChildren.map(child => renderOrgNode(child))}
      </TreeNode>
    );
  };

  const filteredHierarchy = filterTree(
    attachOriginalChildren(Array.isArray(hierarchy) ? hierarchy : []),
    searchValue
  );

  const treeProps = {
    lineColor: '#cbd5e1',
    lineWidth: '1.5px',
    lineBorderRadius: '6px',
    nodePadding: '20px',
  };

  const totalInView = selectedDepartment === 'all'
    ? allEmployees.length
    : allEmployees.filter(e => e.department === selectedDepartment).length;

  const renderTree = () => {
    if (filteredHierarchy.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={searchValue ? `No results for "${searchValue}"` : 'No employees in this view'}
          style={{ padding: '60px 0' }}
        />
      );
    }

    if (filteredHierarchy.length === 1 && selectedDepartment === 'all') {
      const root = filteredHierarchy[0];
      const isCollapsed = collapsedNodes.has(root.id);
      const visibleChildren = isCollapsed ? [] : (root.children || []);
      return (
        <Tree
          {...treeProps}
          label={
            <OrgCard
              node={root}
              collapsed={isCollapsed}
              onToggle={toggleCollapse}
              deptColorMap={deptColorMap}
            />
          }
        >
          {visibleChildren.map(child => renderOrgNode(child))}
        </Tree>
      );
    }

    const virtColor = BRAND_COLOR;
    const virtLabel = selectedDepartment !== 'all' ? selectedDepartment : 'Company';

    return (
      <Tree
        {...treeProps}
        label={<VirtualRootLabel label={virtLabel} color={virtColor} count={totalInView} />}
      >
        {filteredHierarchy.map(root => renderOrgNode(root))}
      </Tree>
    );
  };

  return (
    <Layout>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, flexDirection: isMobile ? 'column' : 'row' }}>
          <div>
            <Breadcrumb
              items={[{ title: <Link to="/dashboard">Dashboard</Link> }, { title: 'Organization' }]}
              style={{ marginBottom: 6 }}
            />
            <Title level={isMobile ? 3 : 2} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: '#1E2875' }}>
              Company Hierarchy
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {isMobile ? 'Scroll to explore · Pinch to zoom · Tap + to expand/collapse' : 'Drag to pan · Hover a card to view details · Use +/− to zoom'}
            </Text>
          </div>
          <Space wrap style={{ width: isMobile ? '100%' : 'auto' }}>
            {isAdmin && branches.length > 0 && (
              <Select
                placeholder="All Branches"
                size="large"
                style={{ width: isMobile ? '100%' : 180, borderRadius: 10 }}
                value={branchFilter || undefined}
                onChange={(v) => setBranchFilter(v || null)}
                allowClear
                options={branches.map(b => ({ value: b.id, label: b.name }))}
              />
            )}
            <Input
              prefix={<Search size={16} color="#94a3b8" />}
              placeholder="Search by name, role or dept..."
              size="large"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              allowClear
              style={{ width: isMobile ? '100%' : 280, borderRadius: 10 }}
            />
          </Space>
        </div>

        {/* Department Filter Pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setSelectedDepartment('all')}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              border: selectedDepartment === 'all' ? `2px solid ${BRAND_COLOR}` : '1.5px solid #e2e8f0',
              background: selectedDepartment === 'all' ? BRAND_COLOR : '#fff',
              color: selectedDepartment === 'all' ? '#fff' : '#475569',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.15s',
            }}
          >
            <Building2 size={12} />
            All
            <span style={{
              background: selectedDepartment === 'all' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
              color: selectedDepartment === 'all' ? '#fff' : '#64748b',
              borderRadius: 10,
              padding: '0 6px',
              fontSize: 11,
            }}>
              {allEmployees.length}
            </span>
          </button>

          {departments.map(dept => {
            const color = deptColorMap[dept] || BRAND_COLOR;
            const count = allEmployees.filter(e => e.department === dept).length;
            const isSelected = selectedDepartment === dept;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(dept)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: isSelected ? `2px solid ${color}` : '1.5px solid #e2e8f0',
                  background: isSelected ? color : '#fff',
                  color: isSelected ? '#fff' : '#475569',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  if (!isSelected) { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; }
                }}
                onMouseLeave={e => {
                  if (!isSelected) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: isSelected ? '#fff' : color, flexShrink: 0 }} />
                {dept}
                <span style={{
                  background: isSelected ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                  color: isSelected ? '#fff' : '#64748b',
                  borderRadius: 10,
                  padding: '0 6px',
                  fontSize: 11,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Org Chart Canvas */}
        {loading ? (
          <Card style={{ borderRadius: 16, border: 'none', boxShadow: themeTokens.shadows.standard }}>
            <Skeleton active avatar paragraph={{ rows: 10 }} />
          </Card>
        ) : (
          <Card
            style={{
              borderRadius: 16,
              boxShadow: themeTokens.shadows.standard,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              position: 'relative',
            }}
            styles={{ body: { padding: 0 } }}
          >
            {/* Zoom controls */}
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 100,
              display: 'flex', alignItems: 'center', gap: 4,
              background: '#fff', borderRadius: 10,
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              padding: '4px 6px',
            }}>
              <button
                onClick={() => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
                disabled={zoom <= ZOOM_MIN}
                title="Zoom out"
                style={{
                  width: 28, height: 28, borderRadius: 6, border: 'none',
                  background: 'none', cursor: zoom <= ZOOM_MIN ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: zoom <= ZOOM_MIN ? '#cbd5e1' : '#475569',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (zoom > ZOOM_MIN) e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <ZoomOut size={15} />
              </button>
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#64748b',
                minWidth: 36, textAlign: 'center', userSelect: 'none',
              }}>
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
                disabled={zoom >= ZOOM_MAX}
                title="Zoom in"
                style={{
                  width: 28, height: 28, borderRadius: 6, border: 'none',
                  background: 'none', cursor: zoom >= ZOOM_MAX ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: zoom >= ZOOM_MAX ? '#cbd5e1' : '#475569',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (zoom < ZOOM_MAX) e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <ZoomIn size={15} />
              </button>
              <div style={{ width: 1, height: 16, background: '#e2e8f0', margin: '0 2px' }} />
              <button
                onClick={() => setZoom(1)}
                title="Reset zoom"
                style={{
                  width: 28, height: 28, borderRadius: 6, border: 'none',
                  background: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#475569', transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <Maximize2 size={13} />
              </button>
            </div>

            <div
              ref={containerRef}
              style={{
                overflow: 'auto',
                cursor: isDragging.current ? 'grabbing' : 'grab',
                userSelect: 'none',
                padding: isMobile ? '32px 20px 40px' : '52px 80px 60px',
                minHeight: 400,
                maxHeight: isMobile ? 'calc(100vh - 200px)' : 'calc(100vh - 320px)',
                textAlign: 'center',
                WebkitOverflowScrolling: 'touch',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div style={{
                display: 'inline-block',
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                transition: 'transform 0.2s ease',
              }}>
                {renderTree()}
              </div>
            </div>
          </Card>
        )}
      </Space>
    </Layout>
  );
}
