/* Shared fetch wrapper — plain JS port of the old apiClient.ts. Every route lives under /api,
 * matching the Hosting rewrite + Express mount (see functions/app.js). */

const ACCESS_KEY = 'waradly_access_token';
const REFRESH_KEY = 'waradly_refresh_token';

function getAccessToken() { return localStorage.getItem(ACCESS_KEY); }
function getRefreshToken() { return localStorage.getItem(REFRESH_KEY); }
function setTokens(accessToken, refreshToken) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}
function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

class ApiError extends Error {
  constructor(status, message, code, fields, data) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields || {};
    this.data = data || {};
  }
}

async function tryRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) { clearTokens(); return false; }
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return true;
}

const AUTH_FLOW_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];

/** api(path, {method, body, isFormData, token}) */
async function api(path, options = {}) {
  const hadAccessToken = Boolean(options.token || getAccessToken());

  const doFetch = async () => {
    const token = options.token || getAccessToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let body;
    if (options.body !== undefined) {
      if (options.isFormData) {
        body = options.body;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
      }
    }
    return fetch(path, { method: options.method || 'GET', headers, body });
  };

  let res = await doFetch();

  if (!options.token && res.status === 401 && getRefreshToken()) {
    if (await tryRefresh()) res = await doFetch();
  }

  if (!options.token && res.status === 401 && hadAccessToken && !AUTH_FLOW_PATHS.includes(path)) {
    clearTokens();
    window.location.assign('/login.html');
    throw new ApiError(401, 'Session expired.');
  }

  if (res.status === 204) return undefined;

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = data?.error?.message || `Request failed (${res.status})`;
    const { code, fields, message: _msg, ...rest } = data?.error || {};
    throw new ApiError(res.status, message, code, fields, rest);
  }

  return data;
}

window.Waradly = window.Waradly || {};
window.Waradly.api = api;
window.Waradly.ApiError = ApiError;
window.Waradly.getAccessToken = getAccessToken;
window.Waradly.getRefreshToken = getRefreshToken;
window.Waradly.setTokens = setTokens;
window.Waradly.clearTokens = clearTokens;
