export const BOOKING_REQUEST_STATUS = "PENDING_TEAM_REVIEW" as const;

export type BookingActor = {
  authenticated: boolean;
  tenantId: string;
  roles: readonly string[];
};

export function canConfirmBooking(actor: BookingActor, bookingTenantId: string): boolean {
  return (
    actor.authenticated &&
    actor.tenantId.length > 0 &&
    actor.tenantId === bookingTenantId &&
    (actor.roles.includes("operator") || actor.roles.includes("tenant_admin"))
  );
}
