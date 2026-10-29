import { api, unwrapResponse } from "./client.js";
import { USE_MOCK } from "./config.js";

let mockUsers;
const MOCK_USERS_KEY = "sigatacloban-mock-users";

function restoreMockUsers() {
  if (!USE_MOCK || mockUsers || !globalThis.sessionStorage) return;
  const saved = globalThis.sessionStorage.getItem(MOCK_USERS_KEY);
  if (saved !== null) {
    const records = JSON.parse(saved);
    if (!Array.isArray(records)) throw new TypeError("Saved mock users must be an array.");
    mockUsers = records;
  }
}

function persistMockUsers() {
  if (USE_MOCK && mockUsers && globalThis.sessionStorage) {
    globalThis.sessionStorage.setItem(MOCK_USERS_KEY, JSON.stringify(mockUsers));
  }
}

async function usersSample(signal) {
  restoreMockUsers();
  if (!mockUsers) mockUsers = unwrapResponse(await api.get("/users", { signal, mockSample: "users-list" }));
  return mockUsers;
}

export async function listUsers(options = {}) {
  restoreMockUsers();
  const response = await api.get("/users", {
    ...options,
    mockSample: "users-list",
    mockTransform: (records, meta) => {
      if (!mockUsers) mockUsers = records;
      persistMockUsers();
      return { data: mockUsers, meta: { ...meta, total: mockUsers.length } };
    },
  });
  if (!mockUsers) mockUsers = unwrapResponse(response);
  return unwrapResponse(response);
}

export async function addUser(user, options = {}) {
  await usersSample(options.signal);
  const response = await api.post("/users", user, {
    ...options,
    mockSample: "users-create",
    mockTransform: (sample) => {
      const created = { ...sample, ...user, id: `user-mock-${Date.now()}`, pendingInvite: true };
      mockUsers = [...(mockUsers || []), created];
      persistMockUsers();
      return { data: created, meta: {} };
    },
  });
  return unwrapResponse(response);
}

export async function updateUser(id, updates, options = {}) {
  await usersSample(options.signal);
  const response = await api.patch(`/users/${encodeURIComponent(id)}`, updates, {
    ...options,
    mockSample: "users-update",
    mockTransform: (sample) => {
      mockUsers = (mockUsers || []).map((user) => user.id === id ? { ...user, ...updates } : user);
      persistMockUsers();
      return { data: mockUsers.find((user) => user.id === id) || { ...sample, ...updates, id }, meta: {} };
    },
  });
  return unwrapResponse(response);
}

export async function activateUser(id, options = {}) {
  await usersSample(options.signal);
  const response = await api.post(`/users/${encodeURIComponent(id)}/activate`, {}, {
    ...options,
    mockSample: "users-activate",
    mockTransform: (sample) => {
      mockUsers = (mockUsers || []).map((user) => user.id === id ? { ...user, active: true, pendingInvite: false } : user);
      persistMockUsers();
      return { data: mockUsers.find((user) => user.id === id) || sample, meta: {} };
    },
  });
  return unwrapResponse(response);
}

export async function deactivateUser(id, options = {}) {
  await usersSample(options.signal);
  const response = await api.post(`/users/${encodeURIComponent(id)}/deactivate`, {}, {
    ...options,
    mockSample: "users-deactivate",
    mockTransform: (sample) => {
      mockUsers = (mockUsers || []).map((user) => user.id === id ? { ...user, active: false, pendingInvite: false } : user);
      persistMockUsers();
      return { data: mockUsers.find((user) => user.id === id) || sample, meta: {} };
    },
  });
  return unwrapResponse(response);
}

export async function deleteUser(id, _currentEmail, options = {}) {
  await usersSample(options.signal);
  await api.delete(`/users/${encodeURIComponent(id)}`, {
    ...options,
    mockSample: "users-delete",
    mockTransform: () => {
      mockUsers = (mockUsers || []).filter((user) => user.id !== id);
      persistMockUsers();
      return { data: null, meta: {} };
    },
  });
}

export async function resetUserPassword(id, options = {}) {
  return unwrapResponse(await api.post(`/users/${encodeURIComponent(id)}/password-reset`, {}, { ...options, mockSample: "users-password-reset" }));
}

export async function resendInvite(id, options = {}) {
  return unwrapResponse(await api.post(`/users/${encodeURIComponent(id)}/invite`, {}, { ...options, mockSample: "users-invite" }));
}

export async function getRolePermissions(options = {}) {
  return unwrapResponse(await api.get("/roles/permissions", { ...options, mockSample: "roles-permissions" }));
}
