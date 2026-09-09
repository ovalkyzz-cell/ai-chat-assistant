/* ========================================
   Admin Dashboard Logic
   ======================================== */

// Admin State
const AdminState = {
    users: [],
    currentFilter: 'all',
    searchQuery: ''
};

// Initialize Admin Dashboard
function initAdmin() {
    checkAdminAuth();
    loadUsers();
    setupAdminEventListeners();
    updateDashboard();
    setupRealTimeUpdates();
}

// Check Admin Authentication
function checkAdminAuth() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || currentUser.role !== 'admin') {
        window.location.href = 'admin-login.html';
        return false;
    }
    return true;
}

// Load Users
function loadUsers() {
    const savedUsers = localStorage.getItem('users');
    if (savedUsers) {
        AdminState.users = JSON.parse(savedUsers);
    }
    updateUserCounts();
}

// Save Users
function saveUsers() {
    localStorage.setItem('users', JSON.stringify(AdminState.users));
}

// Setup Event Listeners
function setupAdminEventListeners() {
    // Sidebar Toggle
    const sidebarToggle = document.getElementById('adminSidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleAdminSidebar);
    }

    // Navigation
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            navigateToSection(section);
        });
    });

    // Search
    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            AdminState.searchQuery = e.target.value.toLowerCase();
            renderUsersTable();
        });
    }

    // Filter Buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            AdminState.currentFilter = btn.dataset.filter;
            renderUsersTable();
        });
    });

    // Approve All Button
    const approveAllBtn = document.getElementById('approveAllBtn');
    if (approveAllBtn) {
        approveAllBtn.addEventListener('click', approveAllPending);
    }

    // Logout
    const logoutBtn = document.getElementById('adminLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleAdminLogout);
    }

    // Settings Form
    const changeCredsForm = document.getElementById('changeAdminCredsForm');
    if (changeCredsForm) {
        changeCredsForm.addEventListener('submit', handlePasswordChange);
    }

    // Modal Close
    const closeModal = document.getElementById('closeModal');
    if (closeModal) {
        closeModal.addEventListener('click', closeUserModal);
    }

    // Modal backdrop click
    const modal = document.getElementById('userModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeUserModal();
        });
    }
}

// Toggle Sidebar
function toggleAdminSidebar() {
    const sidebar = document.querySelector('.admin-sidebar');
    sidebar.classList.toggle('collapsed');
}

// Navigate to Section
function navigateToSection(section) {
    // Update nav items
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === section) {
            item.classList.add('active');
        }
    });

    // Update sections
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.remove('active');
    });

    const sectionId = section + 'Section';
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    const titles = {
        dashboard: 'Dashboard',
        users: 'User Management',
        pending: 'Pending Approvals',
        banned: 'Banned Users',
        settings: 'Settings'
    };
    if (pageTitle) {
        pageTitle.textContent = titles[section] || 'Dashboard';
    }

    // Refresh section data
    switch (section) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'users':
            renderUsersTable();
            break;
        case 'pending':
            renderPendingGrid();
            break;
        case 'banned':
            renderBannedTable();
            break;
    }
}

// Update Dashboard
function updateDashboard() {
    updateUserCounts();
    renderRecentUsers();
    renderPendingDashboard();
}

// Update User Counts
function updateUserCounts() {
    const users = AdminState.users;
    const total = users.length;
    const active = users.filter(u => u.status === 'active').length;
    const pending = users.filter(u => u.status === 'pending').length;
    const banned = users.filter(u => u.status === 'banned').length;

    // Update stat cards
    const totalStat = document.getElementById('totalUsersStat');
    const activeStat = document.getElementById('activeUsersStat');
    const pendingStat = document.getElementById('pendingUsersStat');
    const bannedStat = document.getElementById('bannedUsersStat');

    if (totalStat) totalStat.textContent = total;
    if (activeStat) activeStat.textContent = active;
    if (pendingStat) pendingStat.textContent = pending;
    if (bannedStat) bannedStat.textContent = banned;

    // Update badges
    const userBadge = document.getElementById('userCountBadge');
    const pendingBadge = document.getElementById('pendingCountBadge');
    const bannedBadge = document.getElementById('bannedCountBadge');

    if (userBadge) userBadge.textContent = total;
    if (pendingBadge) pendingBadge.textContent = pending;
    if (bannedBadge) bannedBadge.textContent = banned;
}

// Render Recent Users (Dashboard)
function renderRecentUsers() {
    const container = document.getElementById('recentUsersList');
    if (!container) return;

    const recentUsers = [...AdminState.users]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

    if (recentUsers.length === 0) {
        container.innerHTML = '<p class="empty-state">No recent registrations</p>';
        return;
    }

    container.innerHTML = recentUsers.map(user => `
        <div class="user-item-compact">
            <div class="user-item-avatar">
                ${getInitials(user.name)}
            </div>
            <div class="user-item-info">
                <div class="user-item-name">${escapeHtml(user.name)}</div>
                <div class="user-item-email">${escapeHtml(user.email)}</div>
            </div>
            <span class="status-badge ${user.status}">${user.status}</span>
        </div>
    `).join('');
}

// Render Pending Dashboard
function renderPendingDashboard() {
    const container = document.getElementById('pendingListDashboard');
    if (!container) return;

    const pendingUsers = AdminState.users.filter(u => u.status === 'pending');

    if (pendingUsers.length === 0) {
        container.innerHTML = '<p class="empty-state">No pending approvals</p>';
        return;
    }

    container.innerHTML = pendingUsers.slice(0, 5).map(user => `
        <div class="user-item-compact">
            <div class="user-item-avatar">
                ${getInitials(user.name)}
            </div>
            <div class="user-item-info">
                <div class="user-item-name">${escapeHtml(user.name)}</div>
                <div class="user-item-email">${escapeHtml(user.email)}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="approveUser('${user.id}')">
                <i class="fas fa-check"></i>
            </button>
        </div>
    `).join('');
}

// Render Users Table
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    let filteredUsers = [...AdminState.users];

    // Apply filter
    if (AdminState.currentFilter !== 'all') {
        filteredUsers = filteredUsers.filter(u => u.status === AdminState.currentFilter);
    }

    // Apply search
    if (AdminState.searchQuery) {
        filteredUsers = filteredUsers.filter(u => 
            u.name.toLowerCase().includes(AdminState.searchQuery) ||
            u.email.toLowerCase().includes(AdminState.searchQuery)
        );
    }

    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">No users found</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredUsers.map(user => `
        <tr data-user-id="${user.id}">
            <td>
                <div class="user-cell">
                    <div class="user-cell-avatar">${getInitials(user.name)}</div>
                    <div class="user-cell-info">
                        <span class="user-cell-name">${escapeHtml(user.name)}</span>
                        <span class="user-cell-joined">ID: ${user.id.substring(0, 12)}...</span>
                    </div>
                </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td><span class="status-badge ${user.status}">${user.status}</span></td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
                <div class="action-buttons">
                    ${user.status === 'pending' ? `
                        <button class="action-btn approve" onclick="approveUser('${user.id}')" title="Approve">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-btn reject" onclick="rejectUser('${user.id}')" title="Reject">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : ''}
                    ${user.status === 'active' ? `
                        <button class="action-btn ban" onclick="banUser('${user.id}')" title="Ban">
                            <i class="fas fa-ban"></i>
                        </button>
                    ` : ''}
                    ${user.status === 'banned' ? `
                        <button class="action-btn unban" onclick="unbanUser('${user.id}')" title="Unban">
                            <i class="fas fa-undo"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn" onclick="viewUserDetails('${user.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Render Pending Grid
function renderPendingGrid() {
    const container = document.getElementById('pendingGrid');
    if (!container) return;

    const pendingUsers = AdminState.users.filter(u => u.status === 'pending');

    if (pendingUsers.length === 0) {
        container.innerHTML = '<p class="empty-state">No pending approvals</p>';
        return;
    }

    container.innerHTML = pendingUsers.map(user => `
        <div class="pending-card">
            <div class="pending-card-header">
                <div class="pending-card-avatar">${getInitials(user.name)}</div>
                <div class="pending-card-info">
                    <h4>${escapeHtml(user.name)}</h4>
                    <p>${escapeHtml(user.email)}</p>
                </div>
            </div>
            <div class="pending-card-meta">
                <span><i class="fas fa-calendar"></i> Registered: ${formatDate(user.createdAt)}</span>
                <span><i class="fas fa-id-card"></i> User ID: ${user.id.substring(0, 16)}...</span>
                <span><i class="fas fa-envelope"></i> ${user.email}</span>
            </div>
            <div class="pending-card-actions">
                <button class="btn btn-primary" onclick="approveUser('${user.id}')">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn btn-danger" onclick="rejectUser('${user.id}')">
                    <i class="fas fa-times"></i> Reject
                </button>
                <button class="btn btn-secondary" onclick="viewUserDetails('${user.id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Render Banned Table
function renderBannedTable() {
    const tbody = document.getElementById('bannedTableBody');
    if (!tbody) return;

    const bannedUsers = AdminState.users.filter(u => u.status === 'banned');

    if (bannedUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">No banned users</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = bannedUsers.map(user => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-cell-avatar">${getInitials(user.name)}</div>
                    <span class="user-cell-name">${escapeHtml(user.name)}</span>
                </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td>${formatDate(user.bannedAt || user.updatedAt)}</td>
            <td>${escapeHtml(user.banReason || 'Not specified')}</td>
            <td>
                <button class="action-btn unban" onclick="unbanUser('${user.id}')" title="Unban">
                    <i class="fas fa-undo"></i> Unban
                </button>
            </td>
        </tr>
    `).join('');
}

// ========================================
// User Actions
// ========================================

// Approve User
function approveUser(userId) {
    const user = AdminState.users.find(u => u.id === userId);
    if (!user) return;

    user.status = 'active';
    user.approvedAt = new Date().toISOString();
    user.approvedBy = 'admin';
    
    saveUsers();
    updateDashboard();
    renderUsersTable();
    renderPendingGrid();
    
    showToast(`${user.name} has been approved`, 'success');
    logAdminAction('approve', `Approved user: ${user.name} (${user.email})`);
}

// Reject User
function rejectUser(userId) {
    const user = AdminState.users.find(u => u.id === userId);
    if (!user) return;

    // Remove user
    AdminState.users = AdminState.users.filter(u => u.id !== userId);
    
    saveUsers();
    updateDashboard();
    renderUsersTable();
    renderPendingGrid();
    
    showToast(`${user.name} has been rejected`, 'warning');
    logAdminAction('reject', `Rejected user: ${user.name} (${user.email})`);
}

// Ban User
function banUser(userId) {
    const user = AdminState.users.find(u => u.id === userId);
    if (!user) return;

    // Show ban confirmation with reason
    const reason = prompt('Enter ban reason:');
    if (reason === null) return;

    user.status = 'banned';
    user.bannedAt = new Date().toISOString();
    user.banReason = reason || 'No reason provided';
    
    saveUsers();
    updateDashboard();
    renderUsersTable();
    renderBannedTable();
    
    showToast(`${user.name} has been banned`, 'error');
    logAdminAction('ban', `Banned user: ${user.name} (${user.email}) - Reason: ${user.banReason}`);
}

// Unban User
function unbanUser(userId) {
    const user = AdminState.users.find(u => u.id === userId);
    if (!user) return;

    user.status = 'active';
    user.unbannedAt = new Date().toISOString();
    user.banReason = null;
    
    saveUsers();
    updateDashboard();
    renderUsersTable();
    renderBannedTable();
    
    showToast(`${user.name} has been unbanned`, 'success');
    logAdminAction('unban', `Unbanned user: ${user.name} (${user.email})`);
}

// Approve All Pending
function approveAllPending() {
    const pendingUsers = AdminState.users.filter(u => u.status === 'pending');
    
    if (pendingUsers.length === 0) {
        showToast('No pending users to approve', 'info');
        return;
    }

    if (!confirm(`Are you sure you want to approve ${pendingUsers.length} users?`)) {
        return;
    }

    pendingUsers.forEach(user => {
        user.status = 'active';
        user.approvedAt = new Date().toISOString();
        user.approvedBy = 'admin';
    });

    saveUsers();
    updateDashboard();
    renderPendingGrid();
    
    showToast(`${pendingUsers.length} users have been approved`, 'success');
    logAdminAction('approve_all', `Approved ${pendingUsers.length} users`);
}

// View User Details
function viewUserDetails(userId) {
    const user = AdminState.users.find(u => u.id === userId);
    if (!user) return;

    const modal = document.getElementById('userModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalFooter = document.getElementById('modalFooter');

    modalTitle.textContent = 'User Details';

    modalBody.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                <div style="width: 64px; height: 64px; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: 600;">
                    ${getInitials(user.name)}
                </div>
                <div>
                    <h3 style="font-size: 1.25rem; color: var(--text-primary);">${escapeHtml(user.name)}</h3>
                    <p style="color: var(--text-muted);">${escapeHtml(user.email)}</p>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-md);">
                    <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">User ID</label>
                    <span style="font-size: 0.85rem; color: var(--text-primary); word-break: break-all;">${user.id}</span>
                </div>
                <div style="padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-md);">
                    <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Status</label>
                    <span class="status-badge ${user.status}">${user.status}</span>
                </div>
                <div style="padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-md);">
                    <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Registered</label>
                    <span style="font-size: 0.85rem; color: var(--text-primary);">${formatDate(user.createdAt)}</span>
                </div>
                <div style="padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-md);">
                    <label style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 4px;">Last Login</label>
                    <span style="font-size: 0.85rem; color: var(--text-primary);">${user.lastLogin ? formatDate(user.lastLogin) : 'Never'}</span>
                </div>
            </div>
            
            ${user.banReason ? `
                <div style="padding: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md);">
                    <label style="font-size: 0.75rem; color: var(--danger); display: block; margin-bottom: 4px;">Ban Reason</label>
                    <span style="font-size: 0.85rem; color: var(--text-primary);">${escapeHtml(user.banReason)}</span>
                </div>
            ` : ''}
        </div>
    `;

    // Set footer actions based on user status
    let footerHTML = '';
    switch (user.status) {
        case 'pending':
            footerHTML = `
                <button class="btn btn-primary" onclick="approveUser('${user.id}'); closeUserModal();">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn btn-danger" onclick="rejectUser('${user.id}'); closeUserModal();">
                    <i class="fas fa-times"></i> Reject
                </button>
            `;
            break;
        case 'active':
            footerHTML = `
                <button class="btn btn-danger" onclick="banUser('${user.id}'); closeUserModal();">
                    <i class="fas fa-ban"></i> Ban User
                </button>
            `;
            break;
        case 'banned':
            footerHTML = `
                <button class="btn btn-primary" onclick="unbanUser('${user.id}'); closeUserModal();">
                    <i class="fas fa-undo"></i> Unban User
                </button>
            `;
            break;
    }
    modalFooter.innerHTML = footerHTML;

    modal.classList.add('active');
}

// Close Modal
function closeUserModal() {
    const modal = document.getElementById('userModal');
    modal.classList.remove('active');
}

// ========================================
// Settings
// ========================================

// Handle Password Change
function handlePasswordChange(e) {
    e.preventDefault();
    
    const newPassword = document.getElementById('newAdminPassword').value;
    const confirmPassword = document.getElementById('confirmAdminPassword').value;

    if (!newPassword || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    if (newPassword.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    // In production, this would update the server
    // For demo, we just show success
    showToast('Password updated successfully', 'success');
    logAdminAction('password_change', 'Admin changed password');
    
    document.getElementById('newAdminPassword').value = '';
    document.getElementById('confirmAdminPassword').value = '';
}

// ========================================
// Real-time Updates
// ========================================

function setupRealTimeUpdates() {
    // Check for new users every 5 seconds
    setInterval(() => {
        const previousCount = AdminState.users.length;
        loadUsers();
        const currentCount = AdminState.users.length;
        
        if (currentCount > previousCount) {
            showToast('New user registered!', 'info');
            updateDashboard();
        }
    }, 5000);

    // Listen for storage changes (from other tabs)
    window.addEventListener('storage', (e) => {
        if (e.key === 'users') {
            loadUsers();
            updateDashboard();
        }
    });
}

// ========================================
// Utility Functions
// ========================================

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function logAdminAction(action, details) {
    const activities = JSON.parse(localStorage.getItem('adminActivities') || '[]');
    activities.unshift({
        action,
        details,
        timestamp: new Date().toISOString(),
        admin: 'admin'
    });
    localStorage.setItem('adminActivities', JSON.stringify(activities.slice(0, 100)));
}

function handleAdminLogout(e) {
    e.preventDefault();
    localStorage.removeItem('currentUser');
    logAdminAction('logout', 'Admin logged out');
    window.location.href = 'admin-login.html';
}

// ========================================
// Toast Notifications
// ========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(toast);

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initAdmin);
