/**
 * Control704 roles. Ordered from least to most privileged.
 * Edge-safe (no node: imports) — used by middleware and route handlers.
 */

export const ROLES = ['viewer', 'technician', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

export function roleRank(role: Role): number {
  return ROLES.indexOf(role);
}

/** True when `have` is at least as privileged as `need`. */
export function hasRole(have: Role | null | undefined, need: Role): boolean {
  if (!have || !isRole(have)) return false;
  return roleRank(have) >= roleRank(need);
}

/** The less privileged of two roles (used when an account was downgraded after sign-in). */
export function minRole(a: Role, b: Role): Role {
  return roleRank(a) <= roleRank(b) ? a : b;
}
