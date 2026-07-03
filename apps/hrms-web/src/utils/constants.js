// Employee Status
export const EMPLOYEE_STATUS = {
  ONBOARDING: 'Onboarding',
  ACTIVE: 'Active',
  NOTICE_PERIOD: 'Notice Period',
  EXITED: 'Exited'
};

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  HR: 'hr',
  MANAGER: 'manager',
  EMPLOYEE: 'employee'
};

// Attendance Status
export const ATTENDANCE_STATUS = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  INCOMPLETE: 'Incomplete',
  ON_LEAVE: 'On Leave',
  HOLIDAY: 'Holiday'
};

// Leave Types
export const LEAVE_TYPES = {
  CASUAL: 'Casual',
  SICK: 'Sick',
  EARNED: 'Earned',
  LOP: 'LOP'
};

// Leave Status
export const LEAVE_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled'
};

// Status Colors (for badges)
export const STATUS_COLORS = {
  // Employee Status
  [EMPLOYEE_STATUS.ACTIVE]: 'badge-success',
  [EMPLOYEE_STATUS.ONBOARDING]: 'badge-info',
  [EMPLOYEE_STATUS.NOTICE_PERIOD]: 'badge-warning',
  [EMPLOYEE_STATUS.EXITED]: 'badge-error',

  // Attendance Status
  [ATTENDANCE_STATUS.PRESENT]: 'badge-success',
  [ATTENDANCE_STATUS.INCOMPLETE]: 'badge-warning',
  [ATTENDANCE_STATUS.ABSENT]: 'badge-error',
  [ATTENDANCE_STATUS.ON_LEAVE]: 'badge-info',
  [ATTENDANCE_STATUS.HOLIDAY]: 'badge-info',

  // Leave Status
  [LEAVE_STATUS.APPROVED]: 'badge-success',
  [LEAVE_STATUS.PENDING]: 'badge-warning',
  [LEAVE_STATUS.REJECTED]: 'badge-error',
  [LEAVE_STATUS.CANCELLED]: 'badge-error'
};

// Navigation Items
export const NAV_ITEMS = {
  HR_ADMIN: [
    { name: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
    { name: 'Employees', path: '/employees', icon: 'Users' },
    { name: 'Attendance', path: '/attendance', icon: 'Calendar' },
    { name: 'Leave', path: '/leave', icon: 'CalendarDays' },
    { name: 'Payroll', path: '/payroll', icon: 'DollarSign' },
    { name: 'Organization', path: '/organization', icon: 'Building' },
    { name: 'Onboarding', path: '/onboarding', icon: 'UserPlus' },
    { name: 'Offboarding', path: '/offboarding', icon: 'UserMinus' },
    { name: 'Holidays', path: '/holidays', icon: 'CalendarCheck' }
  ],
  MANAGER: [
    { name: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
    { name: 'Team', path: '/employees', icon: 'Users' },
    { name: 'Attendance', path: '/attendance', icon: 'Calendar' },
    { name: 'Leave', path: '/leave', icon: 'CalendarDays' },
    { name: 'Organization', path: '/organization', icon: 'Building' }
  ],
  EMPLOYEE: [
    { name: 'Dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
    { name: 'My Attendance', path: '/attendance', icon: 'Calendar' },
    { name: 'My Leave', path: '/leave', icon: 'CalendarDays' },
    { name: 'Payslips', path: '/payroll', icon: 'DollarSign' },
    { name: 'Organization', path: '/organization', icon: 'Building' }
  ]
};
