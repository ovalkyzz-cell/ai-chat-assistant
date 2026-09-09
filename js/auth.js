/* ========================================
   Authentication System
   ======================================== */

// Admin Credentials (in production, use environment variables)
const ADMIN_CREDENTIALS = {
    accessKey: 'ADMIN@MAZZVALL2024',
    email: 'admin@mazzvall.com',
    password: 'Admin@Secure123!'
};

// Initialize Auth
function initAuth() {
    setupLoginForm();
    setupRegisterForm();
    setupAdminLoginForm();
    setupGoogleAuth();
    setupPasswordToggle();
    setupPasswordStrength();
    setupGuestLogin();
    checkAuthStatus();
}

// ========================================
// Login Form
// ========================================
function setupLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe')?.checked;

        if (!email || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        // Check admin credentials
        if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
            const adminUser = {
                id: 'admin',
                name: 'Admin',
                email: ADMIN_CREDENTIALS.email,
                role: 'admin',
                status: 'active',
                createdAt: new Date().toISOString()
            };
            
            localStorage.setItem('currentUser', JSON.stringify(adminUser));
            showToast('Welcome back, Admin!', 'success');
            
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1000);
            return;
        }

        // Check regular users
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);

        if (!user) {
            showToast('Invalid email or password', 'error');
            return;
        }

        if (user.status === 'banned') {
            showToast('Your account has been banned. Please contact admin.', 'error');
            return;
        }

        if (user.status === 'pending') {
            showToast('Your account is pending admin approval. Please wait before logging in.', 'warning');
            return;
        }

        if (user.status !== 'active') {
            showToast('Your account is not active. Please contact admin.', 'error');
            return;
        }

        // Update last login
        user.lastLogin = new Date().toISOString();
        localStorage.setItem('users', JSON.stringify(users));
        
        // Set current user
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        showToast('Login successful!', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    });
}

// ========================================
// Register Form
// ========================================
function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const agreeTerms = document.getElementById('agreeTerms').checked;

        // Validation
        if (!fullName || !email || !password || !confirmPassword) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showToast('Please enter a valid email', 'error');
            return;
        }

        if (password.length < 8) {
            showToast('Password must be at least 8 characters', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        if (!agreeTerms) {
            showToast('Please agree to the terms', 'error');
            return;
        }

        // Check if user already exists
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        if (users.find(u => u.email === email)) {
            showToast('Email already registered', 'error');
            return;
        }

        // Create new user
        const newUser = {
            id: generateUserId(),
            name: fullName,
            email: email,
            password: password, // In production, hash this!
            role: 'user',
            status: 'pending', // Requires admin approval
            plan: 'free',
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));

        showToast('Registration successful! Please wait for admin approval before logging in.', 'success');
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    });
}

// ========================================
// Admin Login Form
// ========================================
function setupAdminLoginForm() {
    const form = document.getElementById('adminLoginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const accessKey = document.getElementById('adminKey').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Validate access key
        if (accessKey !== ADMIN_CREDENTIALS.accessKey) {
            showToast('Invalid admin access key', 'error');
            return;
        }

        // Validate credentials
        if (email !== ADMIN_CREDENTIALS.email || password !== ADMIN_CREDENTIALS.password) {
            showToast('Invalid credentials', 'error');
            return;
        }

        // Create admin session
        const adminUser = {
            id: 'admin',
            name: 'Admin',
            email: ADMIN_CREDENTIALS.email,
            role: 'admin',
            status: 'active',
            createdAt: new Date().toISOString()
        };

        localStorage.setItem('currentUser', JSON.stringify(adminUser));
        
        // Log admin activity
        logAdminActivity('login', 'Admin logged in');
        
        showToast('Welcome to Admin Dashboard!', 'success');
        
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 1000);
    });
}

// ========================================
// Google Authentication (Mock)
// ========================================
function setupGoogleAuth() {
    const googleLogin = document.getElementById('googleLogin');
    const googleRegister = document.getElementById('googleRegister');

    if (googleLogin) {
        googleLogin.addEventListener('click', () => handleGoogleAuth('login'));
    }

    if (googleRegister) {
        googleRegister.addEventListener('click', () => handleGoogleAuth('register'));
    }
}

function handleGoogleAuth(type) {
    // Mock Google authentication
    // In production, integrate with Google OAuth
    
    const mockGoogleUser = {
        id: 'google_' + generateUserId(),
        name: 'Google User',
        email: 'user@gmail.com',
        avatar: null,
        provider: 'google',
        role: 'user',
        status: 'pending', // Requires admin approval
        plan: 'free',
        createdAt: new Date().toISOString(),
        lastLogin: null
    };

    // Check if user exists
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const existingUser = users.find(u => u.email === mockGoogleUser.email);

    if (existingUser) {
        // Login existing user
        if (existingUser.status === 'banned') {
            showToast('Your account has been banned. Please contact admin.', 'error');
            return;
        }

        if (existingUser.status === 'pending') {
            showToast('Your account is pending admin approval. Please wait before logging in.', 'warning');
            return;
        }

        if (existingUser.status !== 'active') {
            showToast('Your account is not active. Please contact admin.', 'error');
            return;
        }

        existingUser.lastLogin = new Date().toISOString();
        localStorage.setItem('users', JSON.stringify(users));
        localStorage.setItem('currentUser', JSON.stringify(existingUser));
        
        showToast('Welcome back!', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    } else {
        // Register new user - requires admin approval
        users.push(mockGoogleUser);
        localStorage.setItem('users', JSON.stringify(users));
        
        showToast('Google account registered! Please wait for admin approval before logging in.', 'success');
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    }
}

// ========================================
// Guest Login
// ========================================
function setupGuestLogin() {
    const guestBtn = document.getElementById('guestLogin');
    if (!guestBtn) return;

    guestBtn.addEventListener('click', () => {
        const guestUser = {
            id: 'guest_' + generateUserId(),
            name: 'Guest User',
            email: 'guest@example.com',
            role: 'guest',
            status: 'active',
            createdAt: new Date().toISOString()
        };

        localStorage.setItem('currentUser', JSON.stringify(guestUser));
        showToast('Continuing as guest', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    });
}

// ========================================
// Password Toggle
// ========================================
function setupPasswordToggle() {
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const input = btn.parentElement.querySelector('input');
            const icon = btn.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
}

// ========================================
// Password Strength Indicator
// ========================================
function setupPasswordStrength() {
    const passwordInput = document.getElementById('password');
    const strengthIndicator = document.getElementById('passwordStrength');
    
    if (!passwordInput || !strengthIndicator) return;

    passwordInput.addEventListener('input', (e) => {
        const password = e.target.value;
        const strength = calculatePasswordStrength(password);
        
        strengthIndicator.className = 'password-strength';
        
        if (password.length === 0) {
            strengthIndicator.querySelector('.strength-bar').style.width = '0';
            strengthIndicator.querySelector('.strength-text').textContent = '';
            return;
        }

        if (strength < 3) {
            strengthIndicator.classList.add('weak');
            strengthIndicator.querySelector('.strength-text').textContent = 'Weak';
        } else if (strength < 5) {
            strengthIndicator.classList.add('medium');
            strengthIndicator.querySelector('.strength-text').textContent = 'Medium';
        } else {
            strengthIndicator.classList.add('strong');
            strengthIndicator.querySelector('.strength-text').textContent = 'Strong';
        }
    });
}

function calculatePasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    return strength;
}

// ========================================
// Check Auth Status
// ========================================
function checkAuthStatus() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const isAuthPage = window.location.pathname.includes('login.html') || 
                       window.location.pathname.includes('register.html') ||
                       window.location.pathname.includes('admin-login.html');
    const isAdminPage = window.location.pathname.includes('admin.html');

    // Redirect based on auth status
    if (!currentUser && !isAuthPage && !isAdminPage) {
        // Allow access to main page for guests
        if (!window.location.pathname.includes('index.html')) {
            // window.location.href = 'login.html';
        }
    }

    // Check admin access
    if (isAdminPage && (!currentUser || currentUser.role !== 'admin')) {
        window.location.href = 'admin-login.html';
    }
}

// ========================================
// Utility Functions
// ========================================
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function logAdminActivity(action, details) {
    const activities = JSON.parse(localStorage.getItem('adminActivities') || '[]');
    activities.unshift({
        action,
        details,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('adminActivities', JSON.stringify(activities.slice(0, 100)));
}

// ========================================
// Toast Notifications
// ========================================
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

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

    // Add to container or create one
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    container.appendChild(toast);

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });

    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'toastSlide 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initAuth);
