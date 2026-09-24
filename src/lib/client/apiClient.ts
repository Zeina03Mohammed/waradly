'use client';

const ACCESS_KEY = 'wardly_access_token';
const REFRESH_KEY = 'wardly_refresh_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  window.localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;
  data?: Record<string, unknown>;

  constructor(status: number, message: string, code?: string, fields?: Record<string, string>, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.data = data;
  }
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    // Refresh tokens rotate on every use (see /api/auth/refresh) — a 401 here means this one
    // was already used, expired, or revoked (e.g. reuse-detection kicked in and killed every
    // session). Either way the stale pair is unusable; drop it rather than retrying with it.
    clearTokens();
    return false;
  }
  const data = await res.json();
  window.localStorage.setItem(ACCESS_KEY, data.access_token);
  window.localStorage.setItem(REFRESH_KEY, data.refresh_token);
  return true;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  isFormData?: boolean;
  /** Use this bearer token instead of the stored session (e.g. the short-lived WebAuthn
   * enrollment token the register form gets back before any real session exists). Skips the
   * refresh/redirect-to-login handling below, since it isn't a real session to begin with. */
  token?: string;
}

// Paths where a 401 is a normal, expected, inline-handled response (wrong password, expired
// reset link, etc.) — never the "your whole session just died" case the redirect below is for.
const AUTH_FLOW_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const hadAccessToken = Boolean(options.token ?? getAccessToken());

  const doFetch = async (): Promise<Response> => {
    const token = options.token ?? getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (options.isFormData) {
        body = options.body as FormData;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
      }
    }
    return fetch(path, { method: options.method ?? 'GET', headers, body });
  };

  let res = await doFetch();

  if (!options.token && res.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await doFetch();
  }

  // The request believed it had a live session (a token was attached) but still got rejected,
  // and refreshing didn't fix it — the session is dead, not just this one call. Every page in
  // the app fires requests from a bare `.then(setState)` with no `.catch`, so leaving this
  // unhandled means the page just renders nothing forever (React state never updates) with no
  // way back to login. Recover once here instead of chasing that same bug on every page.
  if (!options.token && res.status === 401 && hadAccessToken && !AUTH_FLOW_PATHS.includes(path) && typeof window !== 'undefined') {
    clearTokens();
    window.location.assign('/login');
  }

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = data?.error?.message ?? `Request failed (${res.status})`;
    const { code, fields, message: _msg, ...rest } = data?.error ?? {};
    throw new ApiError(res.status, message, code, fields, rest);
  }

  return data as T;
}
