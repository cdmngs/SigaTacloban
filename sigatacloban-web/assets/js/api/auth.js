import { ApiError, api, unwrapResponse } from "./client.js";
import { getManagedUsers, getSession, saveSession, saveSessionTokens, signOut } from "../core/auth.js";

export async function login(payload, options = {}) {
  const result = unwrapResponse(await api.post("/auth/login", payload, {
    ...options,
    mockSample: "auth-login",
    mockTransform: (sample) => {
      const user = getManagedUsers().find((candidate) => candidate.email.toLowerCase() === String(payload.email || "").trim().toLowerCase());
      if (!user) throw new ApiError({ code: "INVALID_CREDENTIALS", message: "Invalid email or password.", status: 401 });
      return {
        data: {
          ...sample,
          accessToken: `mock-${user.role}-token`,
          refreshToken: `mock-${user.role}-refresh-token`,
          user,
        },
        meta: {},
      };
    },
  }));
  if (result?.user && result.accessToken) saveSession(result.user, result.accessToken, result.refreshToken || null);
  return result;
}

export async function logout(options = {}) {
  const { refreshToken } = getSession();
  await api.post("/auth/logout", { refreshToken }, { ...options, mockSample: "auth-logout" });
  signOut();
}

export async function getCurrentUser(options = {}) {
  const user = unwrapResponse(await api.get("/auth/me", {
    ...options,
    mockSample: "auth-me",
    mockTransform: (sample) => ({ data: getSession().user || sample, meta: {} }),
  }));
  if (user?.id && user?.role) {
    const session = getSession();
    if (session.token) saveSession(user, session.token, session.refreshToken);
  }
  return user;
}

export async function refreshToken(refreshTokenValue, options = {}) {
  const result = unwrapResponse(await api.post("/auth/refresh", { refreshToken: refreshTokenValue }, { ...options, mockSample: "auth-refresh" }));
  if (result?.accessToken && result.refreshToken) saveSessionTokens(result.accessToken, result.refreshToken);
  return result;
}
