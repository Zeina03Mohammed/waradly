/* Session helpers — plain-JS equivalent of AuthProvider.tsx + useRequireRole.ts. No framework,
 * so "state" is just a module-level variable plus whatever the calling page does with it.
 * Role/ownership are still enforced server-side on every request (see functions/middleware/
 * authenticate.js) — this is UX only, same disclaimer as the original hook. */

const DASHBOARD_BY_ROLE = { buyer: '/buyer/dashboard.html', supplier: '/supplier/rfqs.html', admin: '/admin/index.html' };

async function getCurrentUser() {
  if (!Warradly.getAccessToken()) return null;
  try {
    const data = await Warradly.api('/api/users/me');
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
    await Warradly.api('/api/auth/logout', { method: 'POST' });
  } catch {
    // ignore — clear local tokens regardless
  }
  Warradly.clearTokens();
  window.location.assign('/login.html');
}

window.Warradly = window.Warradly || {};
window.Warradly.getCurrentUser = getCurrentUser;
window.Warradly.requireRole = requireRole;
window.Warradly.logout = logout;
window.Warradly.DASHBOARD_BY_ROLE = DASHBOARD_BY_ROLE;
