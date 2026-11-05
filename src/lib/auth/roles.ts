import type { Role } from "@/db/schema";

export const ROLE_HOME: Record<Role, string> = {
  patient: "/patient",
  doctor: "/doctor",
  pharmacist: "/pharmacy",
  admin: "/admin",
};

export const ROLE_LABEL: Record<Role, string> = {
  patient: "Patient",
  doctor: "Doctor",
  pharmacist: "Pharmacy",
  admin: "Administrator",
};
