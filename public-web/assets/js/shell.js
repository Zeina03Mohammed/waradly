/* Sidebar nav — plain-JS port of Shell.tsx's per-role NAV map, redesigned as icon+grouped
 * sections (a flat 11-item list for admin read as an overwhelming wall of text). Call
 * Waradly.mountShell(user, currentPath) after requireRole() resolves; it injects into
 * #sidebar-slot, which every protected page includes. Same markup renders the desktop sidebar
 * and the mobile slide-out drawer — only the CSS (see theme.css) differs between them. */

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  document: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  tag: '<path d="M20.59 13.41 12 22l-9-9V3h10l7.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7.5" cy="7.5" r="1"/>',
  box: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V15"/>',
  scale: '<path d="M12 3v18"/><path d="m5 8 4-4 4 4"/><path d="M14.5 8h5l-2.5 6a2.5 2.5 0 0 1-5 0z"/><path d="M4.5 8h5l-2.5 6a2.5 2.5 0 0 1-5 0z"/><path d="m19 8-4-4-4 4"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  truck: '<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
};

function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

// Each role: array of {group?, items:[{href,label,icon}]}. A group with no label renders with
// no section header — used for buyer's short list, where grouping would just add noise.
const NAV = {
  buyer: [
    { items: [
      { href: '/buyer/dashboard.html', label: 'Dashboard', icon: 'dashboard' },
      { href: '/buyer/rfqs.html', label: 'My RFQs', icon: 'document' },
      { href: '/buyer/orders.html', label: 'Orders', icon: 'box' },
      { href: '/buyer/profile.html', label: 'Profile', icon: 'user' },
    ] },
  ],
  supplier: [
    { group: 'Marketplace', items: [
      { href: '/supplier/rfqs.html', label: 'Available RFQs', icon: 'document' },
      { href: '/supplier/offers.html', label: 'My Offers', icon: 'tag' },
      { href: '/supplier/orders.html', label: 'Orders', icon: 'box' },
    ] },
    { group: 'Account', items: [
      { href: '/supplier/performance.html', label: 'Performance', icon: 'chart' },
      { href: '/supplier/verification.html', label: 'Verification', icon: 'check' },
      { href: '/supplier/categories.html', label: 'Capabilities', icon: 'folder' },
      { href: '/supplier/profile.html', label: 'Profile', icon: 'user' },
    ] },
  ],
  admin: [
    { group: 'Overview', items: [
      { href: '/admin/index.html', label: 'Dashboard', icon: 'dashboard' },
      { href: '/admin/audit-logs.html', label: 'Audit Log', icon: 'clipboard' },
    ] },
    { group: 'Marketplace', items: [
      { href: '/admin/rfqs-review.html', label: 'RFQ Review', icon: 'document' },
      { href: '/admin/offers.html', label: 'Offers', icon: 'tag' },
      { href: '/admin/orders.html', label: 'Orders', icon: 'box' },
      { href: '/admin/categories.html', label: 'Categories', icon: 'folder' },
    ] },
    { group: 'Moderation', items: [
      { href: '/admin/users.html', label: 'Users', icon: 'users' },
      { href: '/admin/suppliers-verification.html', label: 'Supplier Verification', icon: 'check' },
      { href: '/admin/messages-flags.html', label: 'Message Flags', icon: 'flag' },
      { href: '/admin/disputes.html', label: 'Disputes', icon: 'scale' },
    ] },
    { group: 'Account', items: [{ href: '/admin/profile.html', label: 'Profile', icon: 'user' }] },
  ],
};

const HOME_BY_ROLE = { buyer: '/buyer/dashboard.html', supplier: '/supplier/rfqs.html', admin: '/admin/index.html' };

function mountShell(user, currentPath) {
  const slot = document.getElementById('sidebar-slot');
  if (!slot) return;

  const groups = NAV[user.role] || [];
  const navHtml = groups
    .map((g) => `
      ${g.group ? `<div class="nav-group-label">${g.group}</div>` : ''}
      ${g.items
        .map(
          (item) => `<a href="${item.href}" class="${currentPath === item.href ? 'active' : ''}">${icon(item.icon)}<span>${item.label}</span></a>`,
        )
        .join('')}`)
    .join('');

  const initials = (user.username || user.email || '?').trim().slice(0, 2).toUpperCase();

  // The mobile topbar/backdrop only render (via CSS media query) below 768px — see theme.css.
  // On desktop this markup is inert, the original flex sidebar+content layout is unchanged.
  slot.innerHTML = `
    <div class="mobile-topbar">
      <button class="hamburger" id="waradly-sidebar-toggle" type="button" aria-label="Open menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <a class="logo" href="${HOME_BY_ROLE[user.role]}">Waradly</a>
    </div>
    <div class="sidebar-backdrop" id="waradly-sidebar-backdrop"></div>
    <aside class="sidebar" id="waradly-sidebar">
      <a class="logo" href="${HOME_BY_ROLE[user.role]}"><span class="logo-mark">W</span>Waradly</a>
      <div class="sidebar-profile">
        <div class="avatar-circle">${initials}</div>
        <div class="sidebar-profile-text">
          <div class="name">${user.username || user.email}</div>
          ${user.username ? `<div class="email">${user.email}</div>` : ''}
        </div>
      </div>
      <nav>${navHtml}</nav>
      <a href="#" id="waradly-logout-btn" class="logout-link">${icon('logout')}<span>Log out</span></a>
    </aside>`;

  document.getElementById('waradly-logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    Waradly.logout();
  });

  const sidebar = document.getElementById('waradly-sidebar');
  const backdrop = document.getElementById('waradly-sidebar-backdrop');
  const openSidebar = () => {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
  };
  const closeSidebar = () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
  };
  document.getElementById('waradly-sidebar-toggle').addEventListener('click', openSidebar);
  backdrop.addEventListener('click', closeSidebar);
  sidebar.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeSidebar));
}

window.Waradly = window.Waradly || {};
window.Waradly.mountShell = mountShell;
window.Waradly.icon = icon;
