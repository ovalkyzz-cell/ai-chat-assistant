/* Admin Dashboard - Mazval GPT AI */

var USERS_KEY = 'mazval_users';
var DISCOUNT_KEY = 'discountCodes';
var users = [];
var currentFilter = 'all';
var searchQuery = '';

function getUsers() { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
function getDiscounts() { return JSON.parse(localStorage.getItem(DISCOUNT_KEY) || '[]'); }
function saveDiscounts(c) { localStorage.setItem(DISCOUNT_KEY, JSON.stringify(c)); }

function init() {
    loadDashboard();
    setupEvents();
    setInterval(loadDashboard, 10000);
}

function setupEvents() {
    document.getElementById('adminSidebarToggle').onclick = function() {
        document.querySelector('.admin-sidebar').classList.toggle('collapsed');
    };
    document.querySelectorAll('.nav-item[data-section]').forEach(function(item) {
        item.onclick = function(e) {
            e.preventDefault();
            navigateTo(item.dataset.section);
        };
    });
    document.getElementById('userSearch').oninput = function(e) {
        searchQuery = e.target.value.toLowerCase();
        renderUsersTable();
    };
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
        btn.onclick = function() {
            document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderUsersTable();
        };
    });
    document.getElementById('approveAllBtn').onclick = approveAll;
    document.getElementById('addDiscountBtn').onclick = addDiscount;
    document.getElementById('adminLogout').onclick = function(e) {
        e.preventDefault();
        localStorage.removeItem('mazval_user');
        window.location.href = 'login.html';
    };
    document.getElementById('changeAdminCredsForm').onsubmit = function(e) {
        e.preventDefault();
        var p = document.getElementById('newAdminPassword').value;
        var c = document.getElementById('confirmAdminPassword').value;
        if (!p || !c) { showToast('Fill all fields', 'error'); return; }
        if (p !== c) { showToast('Passwords do not match', 'error'); return; }
        showToast('Password updated', 'success');
        document.getElementById('newAdminPassword').value = '';
        document.getElementById('confirmAdminPassword').value = '';
    };
    document.getElementById('closeModal').onclick = function() {
        document.getElementById('userModal').classList.remove('active');
    };
    document.getElementById('userModal').onclick = function(e) {
        if (e.target === this) this.classList.remove('active');
    };
}

function navigateTo(section) {
    document.querySelectorAll('.nav-item[data-section]').forEach(function(i) { i.classList.remove('active'); });
    document.querySelector('[data-section="' + section + '"]').classList.add('active');
    document.querySelectorAll('.content-section').forEach(function(s) { s.classList.remove('active'); });
    var sec = document.getElementById(section + 'Section');
    if (sec) sec.classList.add('active');
    var titles = { dashboard: 'Dashboard', users: 'Users', pending: 'Pending Approvals', discounts: 'Discount Codes', settings: 'Settings' };
    document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';
    if (section === 'users') renderUsersTable();
    if (section === 'pending') renderPending();
    if (section === 'discounts') renderDiscounts();
}

function loadDashboard() {
    users = getUsers();
    var total = users.length;
    var active = users.filter(function(u) { return u.status === 'approved'; }).length;
    var pending = users.filter(function(u) { return u.status === 'pending'; }).length;
    var banned = users.filter(function(u) { return u.status === 'rejected' || u.status === 'suspended'; }).length;
    document.getElementById('totalUsersStat').textContent = total;
    document.getElementById('activeUsersStat').textContent = active;
    document.getElementById('pendingUsersStat').textContent = pending;
    document.getElementById('bannedUsersStat').textContent = banned;
    document.getElementById('userCountBadge').textContent = total;
    document.getElementById('pendingCountBadge').textContent = pending;
    renderRecent();
    renderPendingDash();
}

function renderRecent() {
    var c = document.getElementById('recentUsersList');
    var recent = users.slice().sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 5);
    if (!recent.length) { c.innerHTML = '<p class="empty-state">No users yet</p>'; return; }
    c.innerHTML = recent.map(function(u) {
        return '<div class="user-item-compact"><div class="user-item-avatar">' + initials(u.name) + '</div><div class="user-item-info"><div class="user-item-name">' + esc(u.name) + '</div><div class="user-item-email">' + esc(u.email) + '</div></div><span class="status-badge ' + u.status + '">' + u.status + '</span></div>';
    }).join('');
}

function renderPendingDash() {
    var c = document.getElementById('pendingListDashboard');
    var pending = users.filter(function(u) { return u.status === 'pending'; });
    if (!pending.length) { c.innerHTML = '<p class="empty-state">No pending approvals</p>'; return; }
    c.innerHTML = pending.slice(0, 5).map(function(u) {
        return '<div class="user-item-compact"><div class="user-item-avatar">' + initials(u.name) + '</div><div class="user-item-info"><div class="user-item-name">' + esc(u.name) + '</div><div class="user-item-email">' + esc(u.email) + '</div></div><button class="btn btn-primary btn-sm" onclick="approveUser(\'' + u.id + '\')"><i class="fas fa-check"></i></button></div>';
    }).join('');
}

function renderUsersTable() {
    var tbody = document.getElementById('usersTableBody');
    var list = users.slice();
    if (currentFilter !== 'all') list = list.filter(function(u) { return u.status === currentFilter; });
    if (searchQuery) list = list.filter(function(u) { return (u.name + u.email).toLowerCase().indexOf(searchQuery) > -1; });
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No users found</td></tr>'; return; }
    tbody.innerHTML = list.map(function(u) {
        var actions = '';
        if (u.status === 'pending') actions = '<button class="action-btn approve" onclick="approveUser(\'' + u.id + '\')" title="Approve"><i class="fas fa-check"></i></button><button class="action-btn reject" onclick="rejectUser(\'' + u.id + '\')" title="Reject"><i class="fas fa-times"></i></button>';
        else if (u.status === 'approved') actions = '<button class="action-btn ban" onclick="rejectUser(\'' + u.id + '\')" title="Reject"><i class="fas fa-ban"></i></button>';
        else if (u.status === 'rejected' || u.status === 'suspended') actions = '<button class="action-btn unban" onclick="approveUser(\'' + u.id + '\')" title="Approve"><i class="fas fa-undo"></i></button>';
        actions += '<button class="action-btn" onclick="viewUser(\'' + u.id + '\')" title="View"><i class="fas fa-eye"></i></button>';
        return '<tr><td><div class="user-cell"><div class="user-cell-avatar">' + initials(u.name) + '</div><div class="user-cell-info"><span class="user-cell-name">' + esc(u.name) + '</span></div></div></td><td>' + esc(u.email) + '</td><td><span class="status-badge ' + u.status + '">' + u.status + '</span></td><td>' + (u.plan || 'free') + '</td><td><div class="action-buttons">' + actions + '</div></td></tr>';
    }).join('');
}

function renderPending() {
    var c = document.getElementById('pendingGrid');
    var pending = users.filter(function(u) { return u.status === 'pending'; });
    if (!pending.length) { c.innerHTML = '<p class="empty-state">No pending approvals</p>'; return; }
    c.innerHTML = pending.map(function(u) {
        return '<div class="pending-card"><div class="pending-card-header"><div class="pending-card-avatar">' + initials(u.name) + '</div><div class="pending-card-info"><h4>' + esc(u.name) + '</h4><p>' + esc(u.email) + '</p></div></div><div class="pending-card-actions"><button class="btn btn-primary" onclick="approveUser(\'' + u.id + '\')"><i class="fas fa-check"></i> Approve</button><button class="btn btn-danger" onclick="rejectUser(\'' + u.id + '\')"><i class="fas fa-times"></i> Reject</button></div></div>';
    }).join('');
}

function approveUser(id) {
    var u = users.find(function(x) { return x.id === id; });
    if (!u) return;
    u.status = 'approved';
    saveUsers(users);
    loadDashboard();
    renderUsersTable();
    renderPending();
    showToast(u.name + ' approved', 'success');
}

function rejectUser(id) {
    var u = users.find(function(x) { return x.id === id; });
    if (!u) return;
    if (!confirm('Reject ' + u.name + '?')) return;
    u.status = 'rejected';
    saveUsers(users);
    loadDashboard();
    renderUsersTable();
    renderPending();
    showToast(u.name + ' rejected', 'warning');
}

function approveAll() {
    var pending = users.filter(function(u) { return u.status === 'pending'; });
    if (!pending.length) { showToast('No pending users', 'info'); return; }
    if (!confirm('Approve all ' + pending.length + ' users?')) return;
    pending.forEach(function(u) { u.status = 'approved'; });
    saveUsers(users);
    loadDashboard();
    renderPending();
    showToast(pending.length + ' users approved', 'success');
}

function viewUser(id) {
    var u = users.find(function(x) { return x.id === id; });
    if (!u) return;
    var m = document.getElementById('userModal');
    document.getElementById('modalTitle').textContent = 'User Details';
    document.getElementById('modalBody').innerHTML = '<div style="display:flex;flex-direction:column;gap:12px"><div style="display:flex;align-items:center;gap:16px;margin-bottom:12px"><div style="width:56px;height:56px;background:linear-gradient(135deg,#10a37f,#1a7f64);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:1.2rem;font-weight:600">' + initials(u.name) + '</div><div><h3 style="color:var(--text-primary)">' + esc(u.name) + '</h3><p style="color:var(--text-muted)">' + esc(u.email) + '</p></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="padding:10px;background:var(--bg-tertiary);border-radius:8px"><small style="color:var(--text-muted)">Status</small><br><span class="status-badge ' + u.status + '">' + u.status + '</span></div><div style="padding:10px;background:var(--bg-tertiary);border-radius:8px"><small style="color:var(--text-muted)">Plan</small><br><span style="color:var(--text-primary)">' + (u.plan || 'free') + '</span></div><div style="padding:10px;background:var(--bg-tertiary);border-radius:8px"><small style="color:var(--text-muted)">Joined</small><br><span style="color:var(--text-primary)">' + fmtDate(u.createdAt) + '</span></div><div style="padding:10px;background:var(--bg-tertiary);border-radius:8px"><small style="color:var(--text-muted)">ID</small><br><span style="color:var(--text-primary);font-size:0.75rem;word-break:break-all">' + u.id + '</span></div></div></div>';
    document.getElementById('modalFooter').innerHTML = '';
    m.classList.add('active');
}

/* Discount Codes */
function renderDiscounts() {
    var tbody = document.getElementById('discountsTableBody');
    var codes = getDiscounts();
    if (!codes.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No discount codes</td></tr>'; return; }
    tbody.innerHTML = codes.map(function(c) {
        return '<tr><td><strong>' + esc(c.code) + '</strong></td><td>' + (c.type === 'percent' ? c.discount + '%' : 'Rp' + c.discount.toLocaleString()) + '</td><td>' + (c.type === 'percent' ? 'Percent' : 'Fixed') + '</td><td><span class="status-badge ' + (c.active ? 'active' : 'banned') + '">' + (c.active ? 'Active' : 'Inactive') + '</span></td><td><div class="action-buttons"><button class="action-btn" onclick="toggleDiscount(\'' + esc(c.code) + '\')" title="Toggle"><i class="fas fa-' + (c.active ? 'ban' : 'check') + '"></i></button><button class="action-btn reject" onclick="deleteDiscount(\'' + esc(c.code) + '\')" title="Delete"><i class="fas fa-trash"></i></button></div></td></tr>';
    }).join('');
}

function addDiscount() {
    var code = prompt('Discount code (must start with GOVAL-):');
    if (!code) return;
    code = code.toUpperCase();
    if (!code.startsWith('GOVAL-')) { showToast('Must start with GOVAL-', 'warning'); return; }
    var val = prompt('Discount value:');
    if (!val) return;
    var type = confirm('OK = percentage, Cancel = fixed amount') ? 'percent' : 'fixed';
    var codes = getDiscounts();
    if (codes.find(function(c) { return c.code === code; })) { showToast('Code exists', 'error'); return; }
    codes.push({ code: code, discount: parseInt(val), type: type, active: true, createdAt: new Date().toISOString() });
    saveDiscounts(codes);
    renderDiscounts();
    showToast('Code created', 'success');
}

function toggleDiscount(code) {
    var codes = getDiscounts();
    var c = codes.find(function(x) { return x.code === code; });
    if (c) { c.active = !c.active; saveDiscounts(codes); renderDiscounts(); showToast('Updated', 'success'); }
}

function deleteDiscount(code) {
    if (!confirm('Delete ' + code + '?')) return;
    var codes = getDiscounts().filter(function(c) { return c.code !== code; });
    saveDiscounts(codes);
    renderDiscounts();
    showToast('Deleted', 'success');
}

/* Utilities */
function initials(name) { return name ? name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().substring(0, 2) : '?'; }
function esc(t) { if (!t) return ''; var d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'; }
function showToast(msg, type) {
    var t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    var icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' };
    t.innerHTML = '<i class="fas ' + (icons[type] || 'fa-info-circle') + '"></i><span class="toast-message">' + msg + '</span><button class="toast-close"><i class="fas fa-times"></i></button>';
    document.getElementById('toastContainer').appendChild(t);
    t.querySelector('.toast-close').onclick = function() { t.remove(); };
    setTimeout(function() { t.remove(); }, 4000);
}

document.addEventListener('DOMContentLoaded', init);
