/* ========================================
   Reseller Dashboard Logic
   ======================================== */

// Reseller State
const ResellerState = {
    users: [],
    maxUsers: 10,
    plan: 'reseller',
    expiryDate: null
};

// Initialize Reseller Dashboard
function initReseller() {
    checkResellerAuth();
    loadResellerData();
    setupEventListeners();
    updateDashboard();
}

// Check Reseller Authentication
function checkResellerAuth() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser || currentUser.role !== 'reseller') {
        window.location.href = 'login.html';
        return false;
    }
    
    // Update reseller name
    document.getElementById('resellerName').textContent = currentUser.name || currentUser.email;
    
    return true;
}

// Load Reseller Data
function loadResellerData() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return;

    // Load users managed by this reseller
    const allUsers = JSON.parse(localStorage.getItem('users') || '[]');
    ResellerState.users = allUsers.filter(u => u.resellerId === currentUser.id);
    
    // Load subscription info
    ResellerState.expiryDate = currentUser.expiryDate || getDefaultExpiryDate();
    
    updateDashboard();
}

// Save Reseller Data
function saveResellerData() {
    const allUsers = JSON.parse(localStorage.getItem('users') || '[]');
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    // Update users managed by this reseller
    const otherUsers = allUsers.filter(u => u.resellerId !== currentUser.id);
    const updatedUsers = [...otherUsers, ...ResellerState.users];
    
    localStorage.setItem('users', JSON.stringify(updatedUsers));
}

// Get Default Expiry Date (30 days from now)
function getDefaultExpiryDate() {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString();
}

// Setup Event Listeners
function setupEventListeners() {
    // Sidebar Toggle
    document.getElementById('adminSidebarToggle')?.addEventListener('click', () => {
        document.querySelector('.admin-sidebar').classList.toggle('collapsed');
    });

    // Navigation
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToSection(item.dataset.section);
        });
    });

    // Logout
    document.getElementById('resellerLogout')?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    });
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

    const sectionId = section.replace('-', '') + 'Section';
    const targetSection = document.getElementById(sectionId) || 
                         document.getElementById(section.replace('-', '') + 'Section');
    
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Update page title
    const titles = {
        'dashboard': 'Reseller Dashboard',
        'users': 'My Users',
        'create-user': 'Create New User',
        'subscription': 'My Subscription'
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';

    // Refresh section data
    if (section === 'users') renderUsersTable();
}

// Update Dashboard
function updateDashboard() {
    // Update stats
    document.getElementById('totalUsersStat').textContent = 
        `${ResellerState.users.length}/${ResellerState.maxUsers}`;
    document.getElementById('userCountBadge').textContent = 
        `${ResellerState.users.length}/${ResellerState.maxUsers}`;
    
    // Calculate total chats today
    const today = new Date().toDateString();
    const totalChats = ResellerState.users.reduce((sum, user) => {
        return sum + (user.chatsToday || 0);
    }, 0);
    document.getElementById('totalChatsStat').textContent = totalChats;
    
    // Calculate days left
    const expiryDate = new Date(ResellerState.expiryDate);
    const todayDate = new Date();
    const daysLeft = Math.max(0, Math.ceil((expiryDate - todayDate) / (1000 * 60 * 60 * 24)));
    document.getElementById('daysLeftStat').textContent = daysLeft;
    
    // Update next billing
    document.getElementById('nextBilling').textContent = 
        expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Update user count
    document.getElementById('userCount').textContent = ResellerState.users.length;
    
    // Render users table
    renderUsersTable();
    
    // Render recent activity
    renderRecentActivity();
}

// Render Users Table
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (ResellerState.users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 12px; display: block;"></i>
                    No users yet. Create your first user!
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = ResellerState.users.map(user => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-cell-avatar">${getInitials(user.name)}</div>
                    <span class="user-cell-name">${escapeHtml(user.name)}</span>
                </div>
            </td>
            <td>${escapeHtml(user.email)}</td>
            <td><span class="status-badge ${user.status}">${user.status}</span></td>
            <td>${user.lastActive ? formatDate(user.lastActive) : 'Never'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn" onclick="toggleUserStatus('${user.id}')" title="Toggle Status">
                        <i class="fas fa-${user.status === 'active' ? 'ban' : 'check'}"></i>
                    </button>
                    <button class="action-btn" onclick="resetUserPassword('${user.id}')" title="Reset Password">
                        <i class="fas fa-key"></i>
                    </button>
                    <button class="action-btn ban" onclick="deleteUser('${user.id}')" title="Delete User">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Render Recent Activity
function renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    if (!container) return;

    const recentUsers = [...ResellerState.users]
        .filter(u => u.lastActive)
        .sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive))
        .slice(0, 5);

    if (recentUsers.length === 0) {
        container.innerHTML = '<p class="empty-state">No activity yet</p>';
        return;
    }

    container.innerHTML = recentUsers.map(user => `
        <div class="user-item-compact">
            <div class="user-item-avatar">${getInitials(user.name)}</div>
            <div class="user-item-info">
                <div class="user-item-name">${escapeHtml(user.name)}</div>
                <div class="user-item-email">Last active: ${formatDate(user.lastActive)}</div>
            </div>
            <span class="status-badge ${user.status}">${user.status}</span>
        </div>
    `).join('');
}

// Create User
function createUser() {
    // Check user limit
    if (ResellerState.users.length >= ResellerState.maxUsers) {
        showToast('User limit reached! Maximum 10 users per reseller.', 'error');
        return;
    }

    const name = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const plan = document.getElementById('newUserPlan').value;
    const limit = parseInt(document.getElementById('newUserLimit').value) || 500;

    // Validation
    if (!name || !email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    // Check if email exists
    const allUsers = JSON.parse(localStorage.getItem('users') || '[]');
    if (allUsers.find(u => u.email === email)) {
        showToast('Email already registered', 'error');
        return;
    }

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    // Create user
    const newUser = {
        id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: name,
        email: email,
        password: password,
        role: 'user',
        status: 'active',
        plan: plan,
        dailyLimit: limit,
        messagesUsed: 0,
        resellerId: currentUser.id,
        createdAt: new Date().toISOString(),
        lastActive: null
    };

    ResellerState.users.push(newUser);
    saveResellerData();
    updateDashboard();

    // Clear form
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserLimit').value = '500';

    showToast(`User ${name} created successfully!`, 'success');
    
    // Navigate to users section
    navigateToSection('users');
}

// Generate Password
function generatePassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('newUserPassword').value = password;
}

// Toggle User Status
function toggleUserStatus(userId) {
    const user = ResellerState.users.find(u => u.id === userId);
    if (!user) return;

    user.status = user.status === 'active' ? 'suspended' : 'active';
    saveResellerData();
    updateDashboard();

    showToast(`User ${user.name} ${user.status === 'active' ? 'activated' : 'suspended'}`, 'success');
}

// Reset User Password
function resetUserPassword(userId) {
    const user = ResellerState.users.find(u => u.id === userId);
    if (!user) return;

    const newPassword = prompt(`Enter new password for ${user.name}:`);
    if (!newPassword) return;

    user.password = newPassword;
    saveResellerData();

    showToast(`Password updated for ${user.name}`, 'success');
}

// Delete User
function deleteUser(userId) {
    const user = ResellerState.users.find(u => u.id === userId);
    if (!user) return;

    if (!confirm(`Are you sure you want to delete ${user.name}?`)) return;

    ResellerState.users = ResellerState.users.filter(u => u.id !== userId);
    saveResellerData();
    updateDashboard();

    showToast(`User ${user.name} deleted`, 'success');
}

// Export User Data
function exportUserData() {
    const data = ResellerState.users.map(user => ({
        name: user.name,
        email: user.email,
        status: user.status,
        plan: user.plan,
        createdAt: user.createdAt,
        lastActive: user.lastActive
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reseller-users-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('User data exported successfully', 'success');
}

// Utility Functions
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
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

// Toast Notifications
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
document.addEventListener('DOMContentLoaded', initReseller);
