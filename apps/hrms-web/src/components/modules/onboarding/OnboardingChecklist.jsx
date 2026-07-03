import { useState, useEffect } from 'react';
import { Button, message, Popconfirm, Modal, Form, Input, Space, Alert } from 'antd';
import { CheckCircle2, Circle, ArrowRight, FileText, ExternalLink, KeyRound, ChevronDown, Lock } from 'lucide-react';
import { hrAPI } from '../../../api/hr';
import { broadcastDataRefresh } from '../../../utils/realtime';
import { normalizeFileUrl } from '../../../utils/auth';

const PHASE_LABELS = {
  pre_boarding: 'Pre-Boarding',
  day_1: 'Day 1',
  week_1: 'Week 1',
  month_1: 'Month 1',
};

const PHASE_ORDER = ['pre_boarding', 'day_1', 'week_1', 'month_1'];

const DOC_TYPE_LABELS = {
  aadhar_card: 'Aadhar Card',
  pan_card: 'PAN Card',
  class_10_marksheet: '10th Marksheet',
  class_12_marksheet: '12th Marksheet',
  graduation_certificate: 'Graduation / Semester Result',
  // legacy keys kept for records uploaded before this update
  id_proof: 'ID Proof',
  educational_certificate: 'Educational Certificate',
  offer_letter: 'Offer Letter',
  bank_details: 'Bank Details',
  other: 'Other',
};

const BTN_GRADIENT = 'linear-gradient(135deg, #1368FF 0%, #0052CC 100%)';

// Phases that trigger employee activation when fully completed
const ACTIVATION_PHASES = ['pre_boarding', 'day_1'];

/* ── Phase accordion sub-component ── */
function PhaseAccordion({ phaseLabel, phaseDone, isLocked, phaseCompleted, phaseTotal, tasks, tasksByPhase, updatingTask, isTaskAllowed, handleTaskToggle, data }) {
    const [open, setOpen] = useState(false);

    return (
        <div style={{
            border: `1px solid ${phaseDone ? '#D1FAE5' : '#E5E7EB'}`,
            borderRadius: 12,
            overflow: 'hidden',
            background: '#FFFFFF',
            transition: 'border-color 0.2s',
        }}>
            {/* Phase header */}
            <button
                onClick={() => !isLocked && setOpen(v => !v)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: 'none', border: 'none',
                    cursor: isLocked ? 'default' : 'pointer', textAlign: 'left',
                    fontFamily: 'inherit',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Status indicator */}
                    {phaseDone ? (
                        <CheckCircle2 size={18} color="#10B981" strokeWidth={2.5} />
                    ) : isLocked ? (
                        <Lock size={16} color="#D1D5DB" strokeWidth={2} />
                    ) : (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #1368FF', flexShrink: 0 }} />
                    )}
                    <span style={{
                        fontSize: 14, fontWeight: 600,
                        color: isLocked ? '#9CA3AF' : phaseDone ? '#059669' : '#1E2875',
                        transition: 'color 0.2s',
                    }}>
                        {phaseLabel}
                    </span>
                    <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: phaseDone ? '#059669' : isLocked ? '#D1D5DB' : '#1368FF',
                        background: phaseDone ? '#ECFDF5' : isLocked ? '#F9FAFB' : '#EFF6FF',
                        border: `1px solid ${phaseDone ? '#A7F3D0' : isLocked ? '#E5E7EB' : '#BFDBFE'}`,
                        borderRadius: 6, padding: '1px 8px',
                    }}>
                        {phaseCompleted}/{phaseTotal}
                    </span>
                    {isLocked && (
                        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>Locked</span>
                    )}
                </div>
                {!isLocked && (
                    <ChevronDown
                        size={16}
                        color="#6B7280"
                        style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s', flexShrink: 0 }}
                    />
                )}
            </button>

            {/* Tasks body */}
            <div style={{
                maxHeight: open && !isLocked ? 1000 : 0,
                overflow: 'hidden',
                transition: 'max-height 0.35s ease',
            }}>
                <div style={{ borderTop: '1px solid #F3F4F6' }}>
                    {tasks.map((task, tIdx) => {
                        const allowed = isTaskAllowed(task, data.tasks, tasksByPhase);
                        const isLast = tIdx === tasks.length - 1;
                        return (
                            <div
                                key={task.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '11px 16px',
                                    borderBottom: isLast ? 'none' : '1px solid #F9FAFB',
                                    background: task.completed ? '#FAFFFE' : '#fff',
                                    transition: 'background 0.15s',
                                }}
                            >
                                {/* Circle toggle */}
                                <button
                                    onClick={() => handleTaskToggle(task, tasksByPhase)}
                                    disabled={updatingTask === task.id || (!task.completed && !allowed)}
                                    style={{
                                        flexShrink: 0, background: 'none', border: 'none',
                                        cursor: allowed || task.completed ? 'pointer' : 'default',
                                        padding: 0, display: 'flex', alignItems: 'center',
                                        opacity: updatingTask === task.id ? 0.5 : 1,
                                        transition: 'opacity 0.15s',
                                    }}
                                >
                                    {task.completed
                                        ? <CheckCircle2 size={20} color="#10B981" strokeWidth={2.5} />
                                        : allowed
                                            ? <Circle size={20} color="#1368FF" strokeWidth={2} />
                                            : <Circle size={20} color="#D1D5DB" strokeWidth={1.5} />
                                    }
                                </button>

                                {/* Task info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{
                                            fontSize: 13, fontWeight: task.completed ? 400 : 500,
                                            color: task.completed ? '#9CA3AF' : allowed ? '#111827' : '#9CA3AF',
                                            textDecoration: task.completed ? 'line-through' : 'none',
                                            transition: 'color 0.2s',
                                        }}>
                                            {task.taskName}
                                        </span>
                                        {task.assignee && (
                                            <span style={{
                                                fontSize: 10, fontWeight: 600, padding: '1px 7px',
                                                borderRadius: 5, background: '#F3F4F6',
                                                color: '#6B7280', border: '1px solid #E5E7EB',
                                            }}>
                                                {task.assignee}
                                            </span>
                                        )}
                                        {!allowed && !task.completed && (
                                            <span style={{
                                                fontSize: 10, fontWeight: 500, padding: '1px 7px',
                                                borderRadius: 5, background: '#F9FAFB',
                                                color: '#9CA3AF', border: '1px solid #E5E7EB',
                                                display: 'flex', alignItems: 'center', gap: 3,
                                            }}>
                                                <Lock size={9} />Locked
                                            </span>
                                        )}
                                    </div>
                                    {task.completedAt && (
                                        <div style={{ fontSize: 11, color: '#10B981', marginTop: 2 }}>
                                            Completed on {new Date(task.completedAt).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ── Documents accordion sub-component ── */
function DocsAccordion({ documents }) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            <button
                onClick={() => setOpen(v => !v)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileText size={16} color="#6B7280" strokeWidth={2} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Submitted Documents</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1368FF', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '1px 8px' }}>
                        {documents.length}
                    </span>
                </div>
                <ChevronDown size={16} color="#6B7280" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s' }} />
            </button>
            <div style={{ maxHeight: open ? 800 : 0, overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
                <div style={{ borderTop: '1px solid #F3F4F6' }}>
                    {documents.map((doc, i) => (
                        <div key={doc.id || i} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 16px',
                            borderBottom: i < documents.length - 1 ? '1px solid #F9FAFB' : 'none',
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 5, background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}>
                                        {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
                                    </span>
                                    <span style={{ fontSize: 13, color: '#111827' }}>{doc.documentName}</span>
                                </div>
                                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{new Date(doc.uploadedAt).toLocaleDateString()}</div>
                            </div>
                            {doc.fileUrl && (
                                <a href={normalizeFileUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer" style={{ color: '#1368FF', display: 'flex', alignItems: 'center' }}>
                                    <ExternalLink size={15} strokeWidth={2} />
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function OnboardingChecklist({ employeeId, onComplete, onActivated }) {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [updatingTask, setUpdatingTask] = useState(null);
    const [completing, setCompleting] = useState(false);
    const [workEmailModalOpen, setWorkEmailModalOpen] = useState(false);
    const [settingWorkEmail, setSettingWorkEmail] = useState(false);
    const [workEmailForm] = Form.useForm();

    useEffect(() => {
        loadOnboardingDetails();
        loadDocuments();
    }, [employeeId]);

    const loadOnboardingDetails = async () => {
        try {
            const response = await hrAPI.getOnboardingSummary(employeeId);
            const body = response.data || {};
            setData(body.data || body);
        } catch (error) {
            console.error('Failed to load onboarding details:', error);
            message.error('Failed to load onboarding checklist');
        } finally {
            setLoading(false);
        }
    };

    const loadDocuments = async () => {
        try {
            const response = await hrAPI.getEmployeeDocuments(employeeId);
            const body = response.data || {};
            setDocuments(body.data || body || []);
        } catch {
            // Documents section is optional — silently fail
        }
    };

    /**
     * Determine if a task can be toggled.
     * Step-wise rule:
     *   1. All previous phases must be fully completed.
     *   2. Within the same phase, all tasks before this one (by index) must be completed.
     */
    const isTaskAllowed = (task, allTasks, tasksByPhase) => {
        if (!task.phase || !PHASE_ORDER.includes(task.phase)) return true; // ungrouped tasks: always allowed
        const phaseIdx = PHASE_ORDER.indexOf(task.phase);
        // 1. All previous phases must be done
        for (let i = 0; i < phaseIdx; i++) {
            const prevTasks = tasksByPhase[PHASE_ORDER[i]] || [];
            if (prevTasks.length > 0 && !prevTasks.every(t => t.completed)) {
                return false;
            }
        }
        // 2. All tasks before this one within the same phase must be done
        const phaseTasks = tasksByPhase[task.phase] || [];
        const taskIdx = phaseTasks.findIndex(t => t.id === task.id);
        for (let i = 0; i < taskIdx; i++) {
            if (!phaseTasks[i].completed) return false;
        }
        return true;
    };

    const handleTaskToggle = async (task, tasksByPhase) => {
        if (updatingTask) return;
        if (!isTaskAllowed(task, data.tasks, tasksByPhase)) {
            message.warning('Complete the previous task first before marking this one.');
            return;
        }
        setUpdatingTask(task.id);

        try {
            const newStatus = !task.completed;
            const res = await hrAPI.updateOnboardingTask(data.id, task.id, {
                completed: newStatus,
                notes: newStatus ? 'Marked complete by HR' : 'Marked incomplete by HR'
            });

            // Optimistic update
            const updatedTasks = data.tasks.map(t =>
                t.id === task.id ? { ...t, completed: newStatus } : t
            );

            setData(prev => ({ ...prev, tasks: updatedTasks }));

            message.success(`Task "${task.taskName}" updated`);
            broadcastDataRefresh('onboarding');
            broadcastDataRefresh('employees');

            // Check if backend auto-activated the employee
            const autoActivated = res?.data?.data?.autoActivated ?? false;
            if (autoActivated) {
                const activationTasks = updatedTasks.filter(t => ACTIVATION_PHASES.includes(t.phase));
                const allCoreDone = activationTasks.length > 0 && activationTasks.every(t => t.completed);
                if (allCoreDone) {
                    if (onActivated) onActivated();
                }
            }
        } catch (error) {
            console.error('Failed to update task:', error);
            message.error('Failed to update task status');
        } finally {
            setUpdatingTask(null);
        }
    };

    const handleCompleteOnboarding = async () => {
        setCompleting(true);
        try {
            await hrAPI.completeOnboarding(employeeId);
            message.success('Onboarding completed successfully! Employee is now Active.');
            broadcastDataRefresh('employees');
            // Open work email modal after completing onboarding
            workEmailForm.resetFields();
            setWorkEmailModalOpen(true);
            if (onComplete) onComplete();
        } catch (error) {
            console.error('Failed to complete onboarding:', error);
            message.error(error.message || 'Failed to complete onboarding process');
        } finally {
            setCompleting(false);
        }
    };

    const handleSetWorkEmail = async ({ workEmail, password }) => {
        setSettingWorkEmail(true);
        try {
            await hrAPI.setWorkEmail(employeeId, workEmail, password);
            message.success(`Work email assigned! Credentials sent to ${workEmail}.`);
            setWorkEmailModalOpen(false);
            workEmailForm.resetFields();
            broadcastDataRefresh('employees');
        } catch (err) {
            message.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Failed to set work email.');
        } finally {
            setSettingWorkEmail(false);
        }
    };

    if (loading) return (
        <div style={{ padding: '24px 20px' }}>
            {[1,2,3].map(i => (
                <div key={i} style={{ height: 52, background: '#F3F4F6', borderRadius: 10, marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
        </div>
    );

    if (!data) return (
        <div style={{ padding: '20px', margin: '16px 20px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, fontSize: 13, color: '#92400E' }}>
            Onboarding data not found
        </div>
    );

    const completedCount = data.tasks?.filter(t => t.completed).length || 0;
    const totalCount = data.tasks?.length || 0;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const isAllCompleted = completedCount === totalCount && totalCount > 0;

    // Group tasks by phase
    const tasksByPhase = {};
    const ungroupedTasks = [];
    (data.tasks || []).forEach(task => {
        if (task.phase && PHASE_ORDER.includes(task.phase)) {
            if (!tasksByPhase[task.phase]) tasksByPhase[task.phase] = [];
            tasksByPhase[task.phase].push(task);
        } else {
            ungroupedTasks.push(task);
        }
    });
    const hasPhases = Object.keys(tasksByPhase).length > 0;

    return (
        <>
            <div style={{ padding: '20px' }}>

                {/* ── Header row: title + count ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 4, border: '2px solid #1368FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 10, height: 10, background: '#1368FF', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#1E2875' }}>Onboarding Progress</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1368FF', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '3px 10px' }}>
                        {completedCount} / {totalCount} Completed
                    </span>
                </div>

                {/* ── Overall progress bar ── */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Overall Completion</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: progressPercent === 100 ? '#059669' : '#1368FF' }}>{progressPercent}%</span>
                    </div>
                    <div style={{ background: '#E5E7EB', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: 999,
                            width: `${progressPercent}%`,
                            background: progressPercent === 100 ? 'linear-gradient(90deg,#10B981,#34D399)' : 'linear-gradient(90deg,#1E2875,#1368FF)',
                            transition: 'width 0.5s ease',
                            minWidth: progressPercent > 0 ? 6 : 0,
                        }} />
                    </div>
                </div>

                {/* ── Phase accordions ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(hasPhases ? PHASE_ORDER.filter(p => tasksByPhase[p]) : ['_ungrouped']).map((phase, phaseIdx) => {
                        const phaseTasks = phase === '_ungrouped' ? ungroupedTasks : (tasksByPhase[phase] || []);
                        if (phaseTasks.length === 0) return null;

                        const realPhaseIdx = PHASE_ORDER.indexOf(phase);
                        const prevPhasesDone = realPhaseIdx <= 0 || PHASE_ORDER.slice(0, realPhaseIdx).every(p => {
                            const pts = tasksByPhase[p] || [];
                            return pts.length === 0 || pts.every(t => t.completed);
                        });
                        const phaseDone = phaseTasks.every(t => t.completed);
                        const phaseCompleted = phaseTasks.filter(t => t.completed).length;
                        const isLocked = hasPhases && !prevPhasesDone && !phaseDone;
                        const phaseLabel = phase === '_ungrouped' ? 'Tasks' : (PHASE_LABELS[phase] || phase);

                        return (
                            <PhaseAccordion
                                key={phase}
                                phaseLabel={phaseLabel}
                                phaseDone={phaseDone}
                                isLocked={isLocked}
                                phaseCompleted={phaseCompleted}
                                phaseTotal={phaseTasks.length}
                                tasks={phaseTasks}
                                tasksByPhase={tasksByPhase}
                                updatingTask={updatingTask}
                                isTaskAllowed={isTaskAllowed}
                                handleTaskToggle={handleTaskToggle}
                                data={data}
                            />
                        );
                    })}

                    {/* Submitted Documents */}
                    {documents.length > 0 && (
                        <DocsAccordion documents={documents} />
                    )}
                </div>

                {/* ── Footer: Complete Onboarding ── */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
                    {!isAllCompleted && (
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>* Complete all tasks above to activate the employee account.</span>
                    )}
                    <Popconfirm
                        title="Complete Onboarding"
                        description="This will activate the employee account."
                        onConfirm={handleCompleteOnboarding}
                        okText="Yes, Complete"
                        cancelText="Cancel"
                        disabled={!isAllCompleted}
                    >
                        <button
                            disabled={!isAllCompleted || completing}
                            style={{
                                height: 38, paddingInline: 20, borderRadius: 8,
                                background: isAllCompleted ? 'linear-gradient(135deg,#1E2875,#1368FF)' : '#F3F4F6',
                                color: isAllCompleted ? '#fff' : '#9CA3AF',
                                border: 'none', cursor: isAllCompleted ? 'pointer' : 'default',
                                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                                display: 'flex', alignItems: 'center', gap: 7,
                                transition: 'all 0.2s',
                                boxShadow: isAllCompleted ? '0 2px 8px rgba(19,104,255,0.25)' : 'none',
                            }}
                        >
                            <ArrowRight size={15} strokeWidth={2} />
                            {completing ? 'Completing…' : 'Complete Onboarding'}
                        </button>
                    </Popconfirm>
                </div>
            </div>

            {/* Work Email Modal */}
            <Modal
                open={workEmailModalOpen}
                onCancel={() => { setWorkEmailModalOpen(false); workEmailForm.resetFields(); }}
                footer={null}
                width={isMobile ? '100%' : 480}
                style={isMobile ? { top: 0, margin: 0, maxWidth: '100vw', padding: 0 } : {}}
                centered={!isMobile}
                destroyOnClose
                maskClosable={false}
                zIndex={1400}
                closable={false}
                styles={{ body: { padding: 0 }, content: { borderRadius: 16, overflow: 'hidden', padding: 0 } }}
            >
                {/* Gradient header */}
                <div style={{
                    background: 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)',
                    padding: '24px 24px 20px',
                    position: 'relative',
                }}>
                    {/* Close button */}
                    <button
                        onClick={() => { setWorkEmailModalOpen(false); workEmailForm.resetFields(); }}
                        style={{
                            position: 'absolute', top: 14, right: 14,
                            width: 28, height: 28, borderRadius: '50%',
                            background: 'rgba(255,255,255,0.15)', border: 'none',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', transition: 'background 0.15s',
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>

                    {/* Icon + title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: 'rgba(255,255,255,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <KeyRound size={22} color="#fff" strokeWidth={2} />
                        </div>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                                Assign Work Email
                            </div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                                {data?.employee?.name || data?.employeeName || 'Employee'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px 24px' }}>
                    {/* Info banner */}
                    <div style={{
                        display: 'flex', gap: 12, alignItems: 'flex-start',
                        background: '#EFF6FF', border: '1px solid #BFDBFE',
                        borderRadius: 10, padding: '12px 14px', marginBottom: 20,
                    }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: '#1368FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, marginTop: 1,
                        }}>
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="6.5" fill="#1368FF"/><rect x="6" y="5.5" width="1" height="4.5" rx="0.5" fill="white"/><circle cx="6.5" cy="3.5" r="0.75" fill="white"/></svg>
                        </div>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1E2875', marginBottom: 2 }}>
                                Assign a work email to enable login
                            </div>
                            <div style={{ fontSize: 12, color: '#3B5BDB', lineHeight: 1.55 }}>
                                Set the work email and password. Login credentials will be sent to the work email address.
                            </div>
                        </div>
                    </div>

                    <Form form={workEmailForm} layout="vertical" onFinish={handleSetWorkEmail}>
                        <Form.Item
                            name="workEmail"
                            label={<span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Work Email Address</span>}
                            rules={[
                                { required: true, message: 'Please enter the work email' },
                                { type: 'email', message: 'Enter a valid email address' },
                            ]}
                            style={{ marginBottom: 16 }}
                        >
                            <Input
                                prefix={<KeyRound size={14} color="#9CA3AF" />}
                                placeholder="employee@company.com"
                                size="large"
                                style={{ borderRadius: 8, fontSize: 14 }}
                            />
                        </Form.Item>

                        <Form.Item
                            name="password"
                            label={<span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Password</span>}
                            rules={[
                                { required: true, message: 'Please enter a password' },
                                { min: 8, message: 'Password must be at least 8 characters' },
                            ]}
                            style={{ marginBottom: 20 }}
                        >
                            <Input.Password
                                prefix={<Lock size={14} color="#9CA3AF" />}
                                placeholder="Set login password"
                                size="large"
                                style={{ borderRadius: 8, fontSize: 14 }}
                            />
                        </Form.Item>

                        {/* Footer buttons */}
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => { setWorkEmailModalOpen(false); workEmailForm.resetFields(); }}
                                style={{
                                    height: 40, paddingInline: 20, borderRadius: 8,
                                    background: '#F3F4F6', border: '1px solid #E5E7EB',
                                    color: '#374151', fontSize: 13, fontWeight: 600,
                                    cursor: 'pointer', fontFamily: 'inherit',
                                    transition: 'background 0.15s',
                                }}
                            >
                                Skip for Now
                            </button>
                            <button
                                type="submit"
                                disabled={settingWorkEmail}
                                style={{
                                    height: 40, paddingInline: 20, borderRadius: 8,
                                    background: settingWorkEmail ? '#93A5C8' : 'linear-gradient(135deg, #1E2875 0%, #1368FF 100%)',
                                    border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
                                    cursor: settingWorkEmail ? 'default' : 'pointer', fontFamily: 'inherit',
                                    display: 'flex', alignItems: 'center', gap: 7,
                                    boxShadow: settingWorkEmail ? 'none' : '0 2px 8px rgba(19,104,255,0.3)',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {settingWorkEmail ? (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>
                                        Saving…
                                    </>
                                ) : (
                                    <>
                                        <KeyRound size={14} strokeWidth={2} />
                                        Assign Work Email
                                    </>
                                )}
                            </button>
                        </div>
                        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                    </Form>
                </div>
            </Modal>
        </>
    );
}
