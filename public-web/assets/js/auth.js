/* Session helpers — plain-JS equivalent of AuthProvider.tsx + useRequireRole.ts. No framework,
 * so "state" is just a module-level variable plus whatever the calling page does with it.
 * Role/ownership are still enforced server-side on every request (see functions/middleware/
 * authenticate.js) — this is UX only, same disclaimer as the original hook. */

const DASHBOARD_BY_ROLE = { buyer: '/buyer/dashboard.html', supplier: '/supplier/rfqs.html', admin: '/admin/index.html' };

async function getCurrentUser() {
  if (!Waradly.getAccessToken()) return null;
  try {
    const data = await Waradly.api('/api/users/me');
    return data.user;
  } catch {
    return null;
  }
}

/** Call at the top of every protected page. Redirects to /login.html if not authenticated, or
 * to that role's own dashboard if the wrong role is signed in. Returns the user on success. */
async function requireRole(...roles) {
  const user = await getCurrentUser();
  if (!user) {
    window.location.assign('/login.html');
    return null;
  }
  if (!roles.includes(user.role)) {
    window.location.assign(DASHBOARD_BY_ROLE[user.role] || '/login.html');
    return null;
  }
  return user;
}

async function logout() {
  try {
    await Waradly.api('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore — clear local tokens regardless
  }
  Waradly.clearTokens();
  window.location.assign('/login.html');
}

window.Waradly = window.Waradly || {};
window.Waradly.getCurrentUser = getCurrentUser;
window.Waradly.requireRole = requireRole;
window.Waradly.logout = logout;
window.Waradly.DASHBOARD_BY_ROLE = DASHBOARD_BY_ROLE;
