/* ========================================
   Mazval GPT AI - Complete Auth System
   ======================================== */

const AUTH_CONFIG = {
    adminCredentials: {
        email: 'admin@mazzvall.com',
        password: 'Admin@Secure123!',
        accessKey: 'ADMIN@MAZZVALL2024'
    },
    storageKeys: {
        users: 'mazval_users',
        currentUser: 'mazval_currentUser',
        sessions: 'mazval_sessions'
    }
};

/* ========================================
   Session Management
   ======================================== */
function createSession(user) {
    const session = {
        id: generateSessionId(),
        userId: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        plan: user.plan || 'free',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    const sessions = getSessions();
    sessions[session.id] = session;
    localStorage.setItem(AUTH_CONFIG.storageKeys.sessions, JSON.stringify(sessions));
    localStorage.setItem(AUTH_CONFIG.storageKeys.currentUser, JSON.stringify(session));
    return session;
}

function getSession() {
    try {
        const raw = localStorage.getItem(AUTH_CONFIG.storageKeys.currentUser);
        if (!raw) return null;
        const session = JSON.parse(raw);
        if (new Date(session.expiresAt) < new Date()) {
            destroySession();
            return null;
        }
        // Admin session is valid without checking users DB
        if (session.userId === 'admin_001' && session.role === 'admin') {
            return session;
        }
        const users = getUsers();
        const user = users.find(u => u.id === session.userId);
        if (!user) { destroySession(); return null; }
        // Update session with latest user status
        if (user.status === 'rejected' || user.status === 'suspended') {
            destroySession();
            return null;
        }
        session.status = user.status;
        session.role = user.role;
        session.plan = user.plan || 'free';
        return session;
    } catch { return null; }
}

function destroySession() {
    localStorage.removeItem(AUTH_CONFIG.storageKeys.currentUser);
}

function getSessions() {
    try { return JSON.parse(localStorage.getItem(AUTH_CONFIG.storageKeys.sessions) || '{}'); }
    catch { return {}; }
}

function isLoggedIn() { return getSession() !== null; }

function isAdmin() {
    const s = getSession();
    return s && s.role === 'admin' && s.status === 'approved';
}

function isApproved() {
    const s = getSession();
    return s && s.status === 'approved';
}

function isPending() {
    const s = getSession();
    return s && s.status === 'pending';
}

function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
}

function generateUserId() {
    return 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
}

/* ========================================
   User Database (localStorage)
   ======================================== */
function getUsers() {
    try { return JSON.parse(localStorage.getItem(AUTH_CONFIG.storageKeys.users) || '[]'); }
    catch { return []; }
}

function saveUsers(users) {
    localStorage.setItem(AUTH_CONFIG.storageKeys.users, JSON.stringify(users));
}

function findUserByEmail(email) {
    return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

function findUserById(id) {
    return getUsers().find(u => u.id === id);
}

function isAdminEmail(email) {
    return email.toLowerCase() === AUTH_CONFIG.adminCredentials.email.toLowerCase();
}

/* ========================================
   Register
   ======================================== */
function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('fullName')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const agreeTerms = document.getElementById('agreeTerms')?.checked;

    if (!name || !email || !password || !confirmPassword) {
        showToast('Please fill in all fields', 'error'); return false;
    }
    if (!isValidEmail(email)) {
        showToast('Please enter a valid email', 'error'); return false;
    }
    if (isAdminEmail(email)) {
        showToast('This email is reserved for admin', 'error'); return false;
    }
    if (password.length < 8) {
        showToast('Password must be at least 8 characters', 'error'); return false;
    }
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error'); return false;
    }
    if (!agreeTerms) {
        showToast('Please agree to the terms', 'error'); return false;
    }

    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        showToast('Email already registered', 'error'); return false;
    }

    const newUser = {
        id: generateUserId(),
        name: name,
        email: email,
        password: simpleHash(password),
        role: 'user',
        status: 'pending',
        plan: 'free',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: null
    };

    users.push(newUser);
    saveUsers(users);

    showToast('Registration successful! Waiting for admin approval.', 'success');
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    return false;
}

/* ========================================
   Login
   ======================================== */
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;

    if (!email || !password) {
        showToast('Please fill in all fields', 'error'); return false;
    }

    // Admin login
    if (email === AUTH_CONFIG.adminCredentials.email && password === AUTH_CONFIG.adminCredentials.password) {
        const adminUser = {
            id: 'admin_001',
            name: 'Admin',
            email: AUTH_CONFIG.adminCredentials.email,
            role: 'admin',
            status: 'approved',
            plan: 'premium'
        };
        const session = createSession(adminUser);
        logActivity('admin_login', 'Admin logged in');
        showToast('Welcome back, Admin!', 'success');
        setTimeout(() => { window.location.href = 'admin.html'; }, 800);
        return false;
    }

    // Regular user login
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
        showToast('Email or password is incorrect', 'error'); return false;
    }

    if (!verifyPassword(password, user.password)) {
        showToast('Email or password is incorrect', 'error'); return false;
    }

    if (user.status === 'pending') {
        showToast('Your account is pending admin approval', 'warning');
        setTimeout(() => { window.location.href = 'waiting-approval.html'; }, 1000);
        return false;
    }

    if (user.status === 'rejected') {
        showToast('Your account has been rejected. Please contact admin.', 'error');
        return false;
    }

    if (user.status === 'suspended') {
        showToast('Your account has been suspended. Please contact admin.', 'error');
        return false;
    }

    if (user.status !== 'approved') {
        showToast('Account status error. Please contact admin.', 'error');
        return false;
    }

    user.lastLogin = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    saveUsers(users);

    const session = createSession(user);
    logActivity('user_login', `User ${user.email} logged in`);
    showToast('Login successful!', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
    return false;
}

/* ========================================
   Route Guards
   ======================================== */
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function requireApproval() {
    const s = getSession();
    if (!s) { window.location.href = 'login.html'; return false; }
    if (s.status === 'pending') { window.location.href = 'waiting-approval.html'; return false; }
    if (s.status === 'rejected' || s.status === 'suspended') { window.location.href = 'account-status.html'; return false; }
    return true;
}

function requireAdmin() {
    const s = getSession();
    if (!s) { window.location.href = 'admin-login.html'; return false; }
    if (s.role !== 'admin' || s.status !== 'approved') {
        showToast('Access denied. Admin only.', 'error');
        window.location.href = 'login.html'; return false;
    }
    return true;
}

function requireGuest() {
    if (isLoggedIn()) {
        const s = getSession();
        if (s.role === 'admin') { window.location.href = 'admin.html'; return false; }
        window.location.href = 'index.html'; return false;
    }
    return true;
}

/* ========================================
   Auth Status Page Logic
   ======================================== */
function initWaitingApproval() {
    const s = getSession();
    if (!s) { window.location.href = 'login.html'; return; }
    if (s.status === 'approved') { window.location.href = 'index.html'; return; }
    if (s.status === 'rejected' || s.status === 'suspended') { window.location.href = 'account-status.html'; return; }
    const el = document.getElementById('waitingUserEmail');
    if (el) el.textContent = s.email;
}

function initAccountStatus() {
    const s = getSession();
    if (!s) { window.location.href = 'login.html'; return; }
    if (s.status === 'approved') { window.location.href = 'index.html'; return; }
    if (s.status === 'pending') { window.location.href = 'waiting-approval.html'; return; }
    const el = document.getElementById('statusUserEmail');
    const st = document.getElementById('statusText');
    if (el) el.textContent = s.email;
    if (st) {
        const labels = { rejected: 'Rejected', suspended: 'Suspended' };
        st.textContent = labels[s.status] || 'Unknown';
        st.className = 'status-value ' + s.status;
    }
}

/* ========================================
   Admin Login
   ======================================== */
function handleAdminLogin(e) {
    e.preventDefault();
    const accessKey = document.getElementById('adminKey')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;

    if (accessKey !== AUTH_CONFIG.adminCredentials.accessKey) {
        showToast('Invalid access key', 'error'); return false;
    }
    if (email !== AUTH_CONFIG.adminCredentials.email || password !== AUTH_CONFIG.adminCredentials.password) {
        showToast('Invalid credentials', 'error'); return false;
    }

    const adminUser = {
        id: 'admin_001',
        name: 'Admin',
        email: AUTH_CONFIG.adminCredentials.email,
        role: 'admin',
        status: 'approved',
        plan: 'premium'
    };
    createSession(adminUser);
    logActivity('admin_login', 'Admin logged in via admin portal');
    showToast('Welcome to Admin Dashboard!', 'success');
    setTimeout(() => { window.location.href = 'admin.html'; }, 800);
    return false;
}

/* ========================================
   Guest Login
   ======================================== */
function handleGuestLogin() {
    const guestUser = {
        id: 'guest_' + Date.now(),
        name: 'Guest User',
        email: 'guest_' + Date.now() + '@guest.local',
        role: 'guest',
        status: 'approved',
        plan: 'free'
    };
    createSession(guestUser);
    showToast('Continuing as guest', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
}

/* ========================================
   Logout
   ======================================== */
function handleLogout() {
    destroySession();
    showToast('Logged out successfully', 'success');
    setTimeout(() => { window.location.href = 'login.html'; }, 500);
}

/* ========================================
   Password Utilities (simple hash for demo)
   ======================================== */
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'h_' + Math.abs(hash).toString(36) + '_' + str.length;
}

function verifyPassword(input, hash) {
    return simpleHash(input) === hash;
}

/* ========================================
   Validation Utilities
   ======================================== */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ========================================
   Toast Notifications
   ======================================== */
function showToast(message, type = 'info') {
    const existing = document.querySelectorAll('.toast');
    existing.forEach(t => t.remove());

    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3500);
}

/* ========================================
   Activity Logger
   ======================================== */
function logActivity(action, details) {
    const logs = JSON.parse(localStorage.getItem('mazval_activity_logs') || '[]');
    logs.unshift({ action, details, timestamp: new Date().toISOString() });
    localStorage.setItem('mazval_activity_logs', JSON.stringify(logs.slice(0, 200)));
}

/* ========================================
   Page Init Helpers
   ======================================== */
function setupLoginForm() {
    const form = document.getElementById('loginForm');
    if (form) form.addEventListener('submit', handleLogin);
}

function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    if (form) form.addEventListener('submit', handleRegister);
}

function setupAdminLoginForm() {
    const form = document.getElementById('adminLoginForm');
    if (form) form.addEventListener('submit', handleAdminLogin);
}

function setupPasswordToggle() {
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const input = btn.parentElement.querySelector('input');
            const icon = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });
}

function setupPasswordStrength() {
    const pw = document.getElementById('password');
    const ind = document.getElementById('passwordStrength');
    if (!pw || !ind) return;
    pw.addEventListener('input', (e) => {
        const v = e.target.value;
        let s = 0;
        if (v.length >= 8) s++;
        if (v.length >= 12) s++;
        if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
        if (/\d/.test(v)) s++;
        if (/[^a-zA-Z0-9]/.test(v)) s++;
        ind.className = 'password-strength';
        if (v.length === 0) { ind.querySelector('.strength-bar').style.width = '0'; return; }
        if (s < 3) { ind.classList.add('weak'); ind.querySelector('.strength-text').textContent = 'Weak'; }
        else if (s < 5) { ind.classList.add('medium'); ind.querySelector('.strength-text').textContent = 'Medium'; }
        else { ind.classList.add('strong'); ind.querySelector('.strength-text').textContent = 'Strong'; }
    });
}

function setupGuestLoginButton() {
    const btn = document.getElementById('guestLogin');
    if (btn) btn.addEventListener('click', handleGuestLogin);
}

function setupLogoutButton() {
    const btn = document.getElementById('logoutBtn');
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); handleLogout(); });
}

function updateNavbarAuth() {
    const s = getSession();
    document.querySelectorAll('.auth-only').forEach(el => el.style.display = s ? '' : 'none');
    document.querySelectorAll('.guest-only').forEach(el => el.style.display = s ? 'none' : '');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = (s && s.role === 'admin') ? '' : 'none');
    document.querySelectorAll('.approved-only').forEach(el => el.style.display = (s && s.status === 'approved') ? '' : 'none');
    const nameEl = document.getElementById('userName');
    if (nameEl && s) nameEl.textContent = s.name || s.email.split('@')[0];
}

/* ========================================
   Initialize Auth on DOM Ready
   ======================================== */
function initAuthPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';

    setupPasswordToggle();
    setupPasswordStrength();
    setupPasswordToggle();
    setupLogoutButton();
    updateNavbarAuth();

    if (page === 'login.html' || page === 'login' || page === '') {
        if (page === '' && !path.includes('login')) return;
        setupLoginForm();
        setupGuestLoginButton();
    }
    if (page === 'register.html' || page === 'register') setupRegisterForm();
    if (page === 'admin-login.html' || page === 'admin-login') setupAdminLoginForm();
    if (page === 'waiting-approval.html' || page === 'waiting-approval') initWaitingApproval();
    if (page === 'account-status.html' || page === 'account-status') initAccountStatus();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthPage);
} else {
    initAuthPage();
}
