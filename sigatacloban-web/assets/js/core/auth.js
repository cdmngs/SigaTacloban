import { roleLabels } from "./permissions.js";
import { setSharedData } from "./store.js";

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
    const validUser = user && typeof user.id === "string" && typeof user.email === "string" && typeof user.role === "string";
    return validUser
      ? { user: { ...user }, token: parsed.state.token || null, refreshToken: parsed.state.refreshToken || null }
      : { user: null, token: null, refreshToken: null };
  } catch (error) {
    console.error("Unable to read SigaTacloban mock session", error);
    return { user: null, token: null, refreshToken: null };
  }
}

export function saveSession(user, token, refreshToken = null) {
  if (!user || typeof user.id !== "string" || typeof user.role !== "string" || typeof token !== "string") {
    throw new TypeError("A valid user and access token are required to save a session.");
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify({ state: { user, token, refreshToken }, version: 2 }));
  setSharedData({ currentUser: user });
}

export function saveSessionTokens(token, refreshToken) {
  const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  if (!parsed?.state?.user) throw new Error("Cannot refresh a session without an authenticated user.");
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    ...parsed,
    state: { ...parsed.state, token, refreshToken },
  }));
}

export function signIn(email, password) {
  const user = USERS.find((entry) => entry.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!user) return { ok: false, message: "Use an authorized BFP account." };
  if (String(password).length < 6) return { ok: false, message: "Password must be at least 6 characters." };
  localStorage.setItem(SESSION_KEY, JSON.stringify({ state: { user, token: `mock-${user.role}-token`, refreshToken: null }, version: 2 }));
  return { ok: true, user };
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  setSharedData({ currentUser: null });
}

export function isAccessTokenExpired(token, now = Date.now()) {
  if (typeof token !== "string") return true;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const encodedPayload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=")));
    return typeof payload.exp === "number" && payload.exp * 1000 <= now;
  } catch {
    return true;
  }
}

export function getRoleLabel(role) {
  return roleLabels[role] || "BFP User";
}

export function getUserInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase() : (parts[0] || "").slice(0, 2).toUpperCase();
}
