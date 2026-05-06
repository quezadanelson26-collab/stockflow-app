// ─── Role Definitions ───────────────────────────────────────
export type UserRole = 'owner' | 'admin' | 'manager' | 'staff';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  staff: 1,
};

// ─── Store / Location Types ─────────────────────────────────
export type StoreSlug = 'columbus' | 'madison' | 'warehouse';

export const ALL_STORES: { slug: StoreSlug; label: string }[] = [
  { slug: 'columbus', label: 'Columbus' },
  { slug: 'madison', label: 'Madison' },
  { slug: 'warehouse', label: 'Warehouse' },
];

// ─── User Types ─────────────────────────────────────────────
export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  stores: StoreSlug[];
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface InviteUserPayload {
  email: string;
  name: string;
  role: UserRole;
  stores: StoreSlug[];
}

export interface UpdateUserPayload {
  name?: string;
  role?: UserRole;
  stores?: StoreSlug[];
  is_active?: boolean;
}

// ─── Permission Helpers ─────────────────────────────────────

/** Check if roleA outranks roleB */
export function outranks(roleA: UserRole, roleB: UserRole): boolean {
  return ROLE_HIERARCHY[roleA] > ROLE_HIERARCHY[roleB];
}

/** Can this role manage (invite/edit/deactivate) other users? */
export function canManageUsers(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['admin'];
}

/** Can this role access the Settings section? */
export function canAccessSettings(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['admin'];
}

/** Can this role see inventory across ALL locations? */
export function canAccessAllLocations(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['admin'];
}

/** Can this role create/process cycle counts? */
export function canManageCycleCounts(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['manager'];
}

/** Can this role create/submit inventory adjustments? */
export function canMakeAdjustments(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['manager'];
}

/** Can this role create and manage purchase orders? */
export function canManagePurchaseOrders(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['manager'];
}

/** Can this role view the movement ledger and discrepancies? */
export function canViewAuditTrail(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY['staff'];
}

// ─── Role Display Helpers ───────────────────────────────────

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    manager: 'Manager',
    staff: 'Staff',
  };
  return labels[role];
}

export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    owner: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    manager: 'bg-green-100 text-green-700',
    staff: 'bg-gray-100 text-gray-700',
  };
  return colors[role];
}

/** Roles that a given role is allowed to assign to others */
export function assignableRoles(myRole: UserRole): UserRole[] {
  return (['owner', 'admin', 'manager', 'staff'] as UserRole[]).filter(
    (r) => ROLE_HIERARCHY[myRole] > ROLE_HIERARCHY[r]
  );
}
