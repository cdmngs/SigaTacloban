import { roleLabels } from "./permissions.js";

const USERS = Object.freeze([
  { id: "admin-bfp", name: "Cale", email: "admin@bfp.gov.ph", role: "admin", stationUnit: "BFP Tacloban City" },
  { id: "prevention-bfp", name: "Josh Lewis", email: "prevention@bfp.gov.ph", role: "prevention", stationUnit: "Prevention Division" },
  { id: "operations-bfp", name: "John Earth", email: "operations@bfp.gov.ph", role: "operations", stationUnit: "Operations Command" },
  { id: "analyst-bfp", name: "Benedict Josef", email: "analyst@bfp.gov.ph", role: "analyst", stationUnit: "Intelligence Unit" },
]);
const SESSION_KEY = "sigatacloban-session";

// Client-side login is a MOCK only. Production authentication must be performed by the backend.
export function getManagedUsers() {
  return USERS.map((user) => ({ ...user }));
}

export function roleFromEmail(email) {
  const user = USERS.find((entry) => entry.email.toLowerCase() === String(email).trim().toLowerCase());
  return user?.role ?? "admin";
}

export function getSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    const user = parsed?.state?.user;
    const managedUser = USERS.find((candidate) => candidate.id === user?.id && candidate.role === user?.role);
    return managedUser
      ? { user: { ...managedUser }, token: parsed.state.token || null }
      : { user: null, token: null };
  } catch (error) {
    console.error("Unable to read SigaTacloban mock session", error);
    return { user: null, token: null };
  }
}

export function signIn(email, password) {
  const user = USERS.find((entry) => entry.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!user) return { ok: false, message: "Use an authorized BFP account." };
  if (String(password).length < 6) return { ok: false, message: "Password must be at least 6 characters." };
  localStorage.setItem(SESSION_KEY, JSON.stringify({ state: { user, token: `mock-${user.role}-token` }, version: 2 }));
  return { ok: true, user };
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}

export function getRoleLabel(role) {
  return roleLabels[role] || "BFP User";
}

export function getUserInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase() : (parts[0] || "").slice(0, 2).toUpperCase();
}
