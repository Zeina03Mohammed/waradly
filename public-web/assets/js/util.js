/* Small shared helpers used across pages. */

/** Every page that injects a user-controlled string into innerHTML must escape it first —
 * RFQ titles, usernames, messages, etc. are all attacker-controlled input. */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Firestore timestamps come back over the API as {_seconds, _nanoseconds}; plain ISO strings
 * also show up (e.g. from routes that pass through a JS Date before the first read-back). */
function formatDate(value) {
  if (!value) return '—';
  const date = typeof value === 'object' && value._seconds !== undefined ? new Date(value._seconds * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function showError(containerId, err) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = err instanceof Waradly.ApiError ? err.message : 'Something went wrong.';
  el.style.display = 'block';
}

function clearError(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = '';
  el.style.display = 'none';
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/** The avatar endpoint requires a bearer token, which a plain <img src> can't send — fetch the
 * bytes with the token attached and render them as a blob URL instead (same fix the old React
 * Avatar.tsx component needed for the same reason). */
async function loadAvatarInto(imgEl, userId) {
  try {
    const token = Waradly.getAccessToken();
    const res = await fetch(`/api/users/${userId}/avatar`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return false;
    const blob = await res.blob();
    imgEl.src = URL.createObjectURL(blob);
    return true;
  } catch {
    return false;
  }
}

window.Waradly = window.Waradly || {};
window.Waradly.escapeHtml = escapeHtml;
window.Waradly.formatDate = formatDate;
window.Waradly.showError = showError;
window.Waradly.clearError = clearError;
window.Waradly.qs = qs;
window.Waradly.loadAvatarInto = loadAvatarInto;
