export type TenantId = string & { readonly __brand: "TenantId" };
export interface TenantContext { tenantId: TenantId; actorId: string; roles: readonly string[]; }
// No tenant data access until authenticated RLS-backed persistence is implemented.
