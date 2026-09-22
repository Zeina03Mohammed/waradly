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
  if (!res.ok) return false;
  const data = await res.json();
  window.localStorage.setItem(ACCESS_KEY, data.access_token);
  return true;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  isFormData?: boolean;
}

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const token = getAccessToken();
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

  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await doFetch();
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
