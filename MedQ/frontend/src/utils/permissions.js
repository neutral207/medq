/**
 * Role-based permission utilities
 */

import { getCurrentUser } from "./authApi";

// Define what each role can access
const PERMISSIONS = {
  // Pages
  canViewAnalytics: ['admin', 'doctor', 'physician'],
  canViewStaffManagement: ['admin'],
  canViewDashboard: ['admin', 'doctor', 'physician', 'nurse'],

  // Actions
  canManageStaff: ['admin'],
  canClockInOut: ['nurse', 'doctor', 'physician', 'admin'],
  canAssignPatients: ['nurse', 'doctor', 'physician', 'admin'],
  canUpdateVisitStatus: ['nurse', 'doctor', 'physician', 'admin'],
};

/**
 * Check if current user has permission
 * @param {string} permission - Permission key from PERMISSIONS object
 * @returns {boolean}
 */
export function hasPermission(permission) {
  const user = getCurrentUser();
  if (!user || !user.role) return false;

  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;

  return allowedRoles.includes(user.role);
}

/**
 * Get user's role
 * @returns {string|null}
 */
export function getUserRole() {
  const user = getCurrentUser();
  return user?.role || null;
}

/**
 * Check if user is admin
 * @returns {boolean}
 */
export function isAdmin() {
  return getUserRole() === 'admin';
}

/**
 * Check if user is clinical staff (can perform patient care actions)
 * @returns {boolean}
 */
export function isClinicalStaff() {
  const role = getUserRole();
  return ['nurse', 'doctor', 'physician', 'admin'].includes(role);
}

/**
 * Check if user needs to clock in/out (clinical staff but not admin)
 * @returns {boolean}
 */
export function needsClockInOut() {
  const role = getUserRole();
  return ['nurse', 'doctor', 'physician'].includes(role);
}
