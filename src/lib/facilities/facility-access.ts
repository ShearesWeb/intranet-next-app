import { AuthenticatedUser } from "@/types/user";

export function getChairCcaIds(user: AuthenticatedUser): number[] {
  return user.appointments
    .filter((a) => a.position_type === "lead" || a.position_type === "vice")
    .map((a) => a.cca_id);
}

export function isChairOfCca(user: AuthenticatedUser, ccaId: number): boolean {
  return getChairCcaIds(user).includes(ccaId);
}

export function canManageFacilities(user: AuthenticatedUser): boolean {
  return user.is_admin || user.is_jcrc;
}
