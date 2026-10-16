import { USE_MOCKS } from "./config.js";
import { requestJson } from "./client.js";
import { mockDelay } from "./mockDelay.js";

const ACCOUNTS = Object.freeze([
  Object.freeze({ id: "admin-bfp", name: "Cale", email: "admin@bfp.gov.ph", role: "admin", stationUnit: "BFP Tacloban City", lastActive: "Online", active: true, pendingInvite: false }),
  Object.freeze({ id: "prevention-bfp", name: "Josh Lewis", email: "prevention@bfp.gov.ph", role: "prevention", stationUnit: "Prevention Division", lastActive: "Online", active: true, pendingInvite: false }),
  Object.freeze({ id: "operations-bfp", name: "John Earth", email: "operations@bfp.gov.ph", role: "operations", stationUnit: "Operations Command", lastActive: "Online", active: true, pendingInvite: false }),
  Object.freeze({ id: "analyst-bfp", name: "Benedict Josef", email: "analyst@bfp.gov.ph", role: "analyst", stationUnit: "Intelligence Unit", lastActive: "Online", active: true, pendingInvite: false }),
]);
const mockReadOnlyError = () => new Error("The mock account directory is fixed to the four configured BFP accounts.");

export async function listUsers() {
  if (USE_MOCKS) { await mockDelay(); return ACCOUNTS.map((user) => ({ ...user })); }
  return requestJson("/users");
}
export async function addUser(user) {
  if (!USE_MOCKS) return requestJson("/users", { method: "POST", body: JSON.stringify(user) });
  await mockDelay();
  throw mockReadOnlyError();
}
export async function updateUser(id, updates) {
  if (!USE_MOCKS) return requestJson(`/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(updates) });
  await mockDelay();
  if (!ACCOUNTS.some((user) => user.id === id)) throw new Error("The requested account was not found.");
  throw mockReadOnlyError();
}
export async function deleteUser(id, currentEmail) {
  if (!USE_MOCKS) return requestJson(`/users/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "X-Current-User": currentEmail } });
  await mockDelay();
  if (!ACCOUNTS.some((user) => user.id === id) || ACCOUNTS.find((user) => user.id === id)?.email === currentEmail) return false;
  throw mockReadOnlyError();
}
export async function resetUserPassword(id) {
  if (!USE_MOCKS) return requestJson(`/users/${encodeURIComponent(id)}/password-reset`, { method: "POST" });
  await mockDelay();
  if (!ACCOUNTS.some((user) => user.id === id)) throw new Error("The requested account was not found.");
  return id;
}
export async function resendInvite(id) {
  if (!USE_MOCKS) return requestJson(`/users/${encodeURIComponent(id)}/invite`, { method: "POST" });
  await mockDelay();
  if (!ACCOUNTS.some((user) => user.id === id)) throw new Error("The requested account was not found.");
  return id;
}
