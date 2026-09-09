/* ========================================
   Payment System with QRIS Integration
   ======================================== */

// QRIS API Configuration
// Note: In production, these should be stored in environment variables
// For demo purposes, they are loaded from localStorage or use defaults
const QRIS_CONFIG = {
    baseUrl: 'https://api.buatqris.site',
    accountId: localStorage.getItem('qris_account_id') || '',
    secretToken: localStorage.getItem('qris_secret_token') || ''
};

// Initialize QRIS Config from admin settings
function initQRISConfig() {
    const savedConfig = localStorage.getItem('qrisConfig');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        QRIS_CONFIG.accountId = config.accountId || '';
        QRIS_CONFIG.secretToken = config.secretToken || '';
    }
}

// Payment State
const PaymentState = {
    selectedPlan: null,
    selectedPrice: 0,
    transactionId: null,
    timerInterval: null,
    timerSeconds: 900, // 15 minutes
    checkingStatus: false
};

// Plan Details
const PLAN_DETAILS = {
    basic: { name: 'Basic', price: 10000, dailyLimit: 100, duration: null },
    pro: { name: 'Pro', price: 20000, dailyLimit: 500, duration: 30 },
    premium: { name: 'Premium', price: 35000, dailyLimit: -1, duration: 30 },
    reseller: { name: 'Reseller', price: 50000, dailyLimit: -1, duration: 30, maxUsers: 10 }
};

// Initialize Payment Page
document.addEventListener('DOMContentLoaded', () => {
    initQRISConfig();
    setupPlanSelection();
    setupNavigation();
    setupPaymentButtons();
    checkUrlParams();
});

// Check URL Parameters
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');
    if (plan && PLAN_DETAILS[plan]) {
        selectPlan(plan);
    }
}

// Setup Plan Selection
function setupPlanSelection() {
    document.querySelectorAll('.plan-option').forEach(option => {
        option.addEventListener('click', () => {
            const plan = option.dataset.plan;
            const price = parseInt(option.dataset.price);
            selectPlan(plan, price);
        });
    });
}

// Select Plan
function selectPlan(plan, price = null) {
    PaymentState.selectedPlan = plan;
    PaymentState.selectedPrice = price || PLAN_DETAILS[plan]?.price || 0;

    // Update UI
    document.querySelectorAll('.plan-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    const selectedOption = document.querySelector(`.plan-option[data-plan="${plan}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }

    // Enable continue button
    document.getElementById('continueToStep2').disabled = false;
}

// Setup Navigation
function setupNavigation() {
    // Step 1 to Step 2
    document.getElementById('continueToStep2').addEventListener('click', () => {
        if (!PaymentState.selectedPlan) {
            showToast('Please select a plan', 'warning');
            return;
        }
        goToStep(2);
        updateOrderSummary();
    });

    // Step 2 to Step 1
    document.getElementById('backToStep1').addEventListener('click', () => {
        goToStep(1);
    });

    // Step 2 to Step 3 (Create QRIS)
    document.getElementById('continueToStep3').addEventListener('click', () => {
        if (validateForm()) {
            createQRISTransaction();
        }
    });
}

// Go to Step
function goToStep(step) {
    document.querySelectorAll('.payment-step').forEach(s => {
        s.classList.remove('active');
    });
    document.getElementById(`step${step}`).classList.add('active');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update Order Summary
function updateOrderSummary() {
    const plan = PLAN_DETAILS[PaymentState.selectedPlan];
    if (!plan) return;

    document.getElementById('summaryPlan').textContent = `${plan.name} Plan`;
    document.getElementById('summaryPrice').textContent = formatPrice(plan.price);
    
    // Apply discount if any
    let total = plan.price;
    const discountRow = document.getElementById('discountRow');
    const discountEl = document.getElementById('summaryDiscount');
    
    if (PaymentState.discount) {
        discountRow.style.display = 'flex';
        discountEl.textContent = `-${formatPrice(PaymentState.discount.amount)}`;
        total = plan.price - PaymentState.discount.amount;
        if (total < 0) total = 0;
    } else {
        discountRow.style.display = 'none';
    }
    
    document.getElementById('summaryFee').textContent = 'Rp0';
    document.getElementById('summaryTotal').textContent = formatPrice(total);
}

// Validate Form
function validateForm() {
    const name = document.getElementById('customerName').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const password = document.getElementById('customerPassword').value;

    if (!name) {
        showToast('Please enter your name', 'warning');
        return false;
    }

    if (!email || !isValidEmail(email)) {
        showToast('Please enter a valid email', 'warning');
        return false;
    }

    if (!password || password.length < 6) {
        showToast('Password must be at least 6 characters', 'warning');
        return false;
    }

    return true;
}

// Create QRIS Transaction
async function createQRISTransaction() {
    const plan = PLAN_DETAILS[PaymentState.selectedPlan];
    const name = document.getElementById('customerName').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const password = document.getElementById('customerPassword').value;
    const description = document.getElementById('paymentDesc').value.trim() || 
                       `Payment for ${plan.name} Plan - AI Chat Assistant`;
    const discountCode = document.getElementById('discountCode')?.value.trim() || '';

    // Go to step 3
    goToStep(3);
    document.getElementById('qrisTotalAmount').textContent = formatPrice(plan.price);

    // Show loading state
    const qrContainer = document.getElementById('qrisCode');
    qrContainer.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="spinner" style="margin: 0 auto 16px;"></div>
            <p style="color: #666;">Generating QR Code...</p>
        </div>
    `;

    try {
        // Check if QRIS config is set
        if (!QRIS_CONFIG.accountId || !QRIS_CONFIG.secretToken) {
            throw new Error('QRIS configuration not set. Please contact admin.');
        }

        const response = await fetch(QRIS_CONFIG.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'api_create_qris',
                account_id: QRIS_CONFIG.accountId,
                secret_token: QRIS_CONFIG.secretToken,
                amount: plan.price.toString(),
                description: description,
                qris_method: 'qris_two',
                fee_by: 'user'
            })
        });

        const data = await response.json();
        console.log('QRIS Response:', data);

        if (data.success && data.data) {
            PaymentState.transactionId = data.data.transaction_id;
            
            // Store payment info
            localStorage.setItem('pendingPayment', JSON.stringify({
                transactionId: data.data.transaction_id,
                plan: PaymentState.selectedPlan,
                name: name,
                email: email,
                password: password,
                amount: plan.price,
                createdAt: new Date().toISOString()
            }));

            // Display QR Code
            displayQRCode(data.data);
            
            // Start timer
            startTimer();
            
            // Start auto-check status
            startAutoCheckStatus();

            showToast('QR Code generated successfully', 'success');
        } else {
            throw new Error(data.message || data.error || 'Failed to create transaction');
        }
    } catch (error) {
        console.error('QRIS Error:', error);
        
        // Show user-friendly error message
        let errorMessage = 'Failed to create QR Code. ';
        if (error.message.includes('configuration')) {
            errorMessage += 'Payment system not configured. Please contact admin.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage += 'Network error. Please check your connection.';
        } else {
            errorMessage += 'Please try again or contact admin.';
        }
        
        showToast(errorMessage, 'error');
        
        // Show error in QR container
        qrContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #e74c3c;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i>
                <p style="margin-bottom: 16px;">${errorMessage}</p>
                <button onclick="createQRISTransaction()" class="btn-retry" style="padding: 10px 20px; background: #10a37f; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
        
        goToStep(2);
    }
}

// Display QR Code
function displayQRCode(data) {
    const qrContainer = document.getElementById('qrisCode');
    
    // Use qr_url (recommended) or fallback to qris_image
    const qrUrl = data.qr_url;
    const qrisImage = data.qris_image;
    const paymentUrl = data.payment_url;

    if (qrUrl) {
        qrContainer.innerHTML = `
            <img src="${qrUrl}" alt="QRIS Code" 
                 onerror="this.onerror=null;this.src='${qrisImage || ''}'">
        `;
    } else if (qrisImage) {
        qrContainer.innerHTML = `
            <img src="${qrisImage}" alt="QRIS Code">
        `;
    } else if (paymentUrl) {
        // Redirect to payment page
        qrContainer.innerHTML = `
            <div style="text-align: center;">
                <p style="color: #333; margin-bottom: 16px;">Click below to pay</p>
                <a href="${paymentUrl}" target="_blank" 
                   style="display: inline-block; padding: 12px 24px; background: #10a37f; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">
                    Open Payment Page
                </a>
            </div>
        `;
    } else {
        qrContainer.innerHTML = `
            <div style="text-align: center; color: #666;">
                <p>QR Code not available</p>
            </div>
        `;
    }
}

// Start Timer
function startTimer() {
    PaymentState.timerSeconds = 900; // 15 minutes
    updateTimerDisplay();

    PaymentState.timerInterval = setInterval(() => {
        PaymentState.timerSeconds--;
        updateTimerDisplay();

        if (PaymentState.timerSeconds <= 0) {
            clearInterval(PaymentState.timerInterval);
            showToast('QR Code has expired. Please create a new one.', 'warning');
            document.getElementById('paymentStatus').innerHTML = `
                <div class="status-icon failed">
                    <i class="fas fa-times-circle"></i>
                </div>
                <span>QR Code expired</span>
            `;
        }
    }, 1000);
}

// Update Timer Display
function updateTimerDisplay() {
    const minutes = Math.floor(PaymentState.timerSeconds / 60);
    const seconds = PaymentState.timerSeconds % 60;
    document.getElementById('timerDisplay').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Setup Payment Buttons
function setupPaymentButtons() {
    document.getElementById('checkStatusBtn').addEventListener('click', checkPaymentStatus);
}

// Check Payment Status
async function checkPaymentStatus() {
    if (!PaymentState.transactionId) {
        showToast('No transaction to check', 'warning');
        return;
    }

    if (PaymentState.checkingStatus) return;
    PaymentState.checkingStatus = true;

    const btn = document.getElementById('checkStatusBtn');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';

    try {
        const response = await fetch(QRIS_CONFIG.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'api_check_status',
                account_id: QRIS_CONFIG.accountId,
                secret_token: QRIS_CONFIG.secretToken,
                transaction_id: PaymentState.transactionId
            })
        });

        const data = await response.json();

        if (data.success && data.data) {
            const status = data.data.status;
            updatePaymentStatus(status);

            if (status === 'success') {
                handlePaymentSuccess(data.data);
            } else if (status === 'failed' || status === 'expired') {
                clearInterval(PaymentState.timerInterval);
            }
        }
    } catch (error) {
        console.error('Status Check Error:', error);
        showToast('Failed to check status', 'error');
    } finally {
        PaymentState.checkingStatus = false;
        btn.innerHTML = '<i class="fas fa-sync-alt"></i> Check Payment Status';
    }
}

// Update Payment Status
function updatePaymentStatus(status) {
    const statusEl = document.getElementById('paymentStatus');
    
    const statusConfig = {
        pending: { icon: 'fa-hourglass-half', class: 'pending', text: 'Waiting for payment...' },
        success: { icon: 'fa-check-circle', class: 'success', text: 'Payment successful!' },
        failed: { icon: 'fa-times-circle', class: 'failed', text: 'Payment failed' },
        expired: { icon: 'fa-clock', class: 'failed', text: 'Payment expired' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    
    statusEl.innerHTML = `
        <div class="status-icon ${config.class}">
            <i class="fas ${config.icon}"></i>
        </div>
        <span>${config.text}</span>
    `;
}

// Start Auto Check Status
function startAutoCheckStatus() {
    // Check every 10 seconds
    setInterval(() => {
        if (PaymentState.transactionId && PaymentState.timerSeconds > 0) {
            checkPaymentStatus();
        }
    }, 10000);
}

// Handle Payment Success
function handlePaymentSuccess(paymentData) {
    clearInterval(PaymentState.timerInterval);

    const pendingPayment = JSON.parse(localStorage.getItem('pendingPayment') || '{}');
    
    // Create user account
    const newUser = {
        id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: pendingPayment.name || 'User',
        email: pendingPayment.email,
        password: pendingPayment.password,
        role: pendingPayment.plan === 'reseller' ? 'reseller' : 'user',
        status: 'active',
        plan: pendingPayment.plan,
        dailyLimit: PLAN_DETAILS[pendingPayment.plan]?.dailyLimit || 5,
        transactionId: PaymentState.transactionId,
        createdAt: new Date().toISOString(),
        expiryDate: getExpiryDate(PLAN_DETAILS[pendingPayment.plan]?.duration || 30)
    };

    // Save user
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    // Save transaction
    const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
    transactions.unshift({
        id: PaymentState.transactionId,
        userId: newUser.id,
        plan: pendingPayment.plan,
        amount: pendingPayment.amount,
        status: 'success',
        createdAt: new Date().toISOString()
    });
    localStorage.setItem('transactions', JSON.stringify(transactions));

    // Clear pending payment
    localStorage.removeItem('pendingPayment');

    // Show success page
    showSuccessPage(newUser, paymentData);
}

// Show Success Page
function showSuccessPage(user, paymentData) {
    goToStep(4);

    document.getElementById('successTxId').textContent = PaymentState.transactionId;
    document.getElementById('successPlan').textContent = PLAN_DETAILS[user.plan]?.name || user.plan;
    document.getElementById('successAmount').textContent = formatPrice(paymentData.amount || user.dailyLimit);
    document.getElementById('successExpiry').textContent = formatDate(user.expiryDate);

    showToast('Payment successful! Account created.', 'success');
}

// Get Expiry Date
function getExpiryDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
}

// Format Price
function formatPrice(amount) {
    return 'Rp' + amount.toLocaleString('id-ID');
}

// Format Date
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Validate Email
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Show Toast
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ========================================
// Discount Code System
// ========================================

// Discount codes storage (admin can create these)
const DISCOUNT_CODES_KEY = 'discountCodes';

// Initialize discount codes
function initDiscountCodes() {
    const existing = localStorage.getItem(DISCOUNT_CODES_KEY);
    if (!existing) {
        // Default discount codes
        const defaultCodes = [
            { code: 'GOVAL-2024', discount: 10, type: 'percent', active: true, createdAt: new Date().toISOString() },
            { code: 'GOVAL-WELCOME', discount: 5000, type: 'fixed', active: true, createdAt: new Date().toISOString() }
        ];
        localStorage.setItem(DISCOUNT_CODES_KEY, JSON.stringify(defaultCodes));
    }
}

// Apply Discount Code
function applyDiscount() {
    const codeInput = document.getElementById('discountCode');
    const hintEl = document.getElementById('discountHint');
    const code = codeInput.value.trim().toUpperCase();

    if (!code) {
        hintEl.textContent = 'Please enter a discount code';
        hintEl.style.color = '#e74c3c';
        return;
    }

    // Validate GOVAL-XXXX format
    if (!code.startsWith('GOVAL-')) {
        hintEl.textContent = 'Invalid format. Code must start with GOVAL-';
        hintEl.style.color = '#e74c3c';
        return;
    }

    // Get discount codes
    const codes = JSON.parse(localStorage.getItem(DISCOUNT_CODES_KEY) || '[]');
    const discountCode = codes.find(c => c.code === code && c.active);

    if (!discountCode) {
        hintEl.textContent = 'Invalid or expired discount code';
        hintEl.style.color = '#e74c3c';
        return;
    }

    // Calculate discount
    const plan = PLAN_DETAILS[PaymentState.selectedPlan];
    if (!plan) {
        hintEl.textContent = 'Please select a plan first';
        hintEl.style.color = '#e74c3c';
        return;
    }

    let discountAmount = 0;
    if (discountCode.type === 'percent') {
        discountAmount = Math.floor(plan.price * (discountCode.discount / 100));
    } else {
        discountAmount = discountCode.discount;
    }

    // Store discount
    PaymentState.discount = {
        code: discountCode.code,
        amount: discountAmount,
        type: discountCode.type,
        value: discountCode.discount
    };

    // Update UI
    hintEl.textContent = `Discount applied! -${formatPrice(discountAmount)}`;
    hintEl.style.color = '#10a37f';

    // Update order summary
    updateOrderSummary();

    showToast('Discount code applied successfully!', 'success');
}

// Validate Discount Code Format
function isValidDiscountCode(code) {
    return /^GOVAL-[A-Z0-9]{4,}$/.test(code);
}

// Get Discount Codes (for admin)
function getDiscountCodes() {
    return JSON.parse(localStorage.getItem(DISCOUNT_CODES_KEY) || '[]');
}

// Save Discount Codes (for admin)
function saveDiscountCodes(codes) {
    localStorage.setItem(DISCOUNT_CODES_KEY, JSON.stringify(codes));
}

// Create Discount Code (for admin)
function createDiscountCode(code, discount, type = 'percent') {
    const codes = getDiscountCodes();
    
    // Validate format
    if (!code.startsWith('GOVAL-')) {
        return { success: false, message: 'Code must start with GOVAL-' };
    }

    // Check if exists
    if (codes.find(c => c.code === code)) {
        return { success: false, message: 'Code already exists' };
    }

    const newCode = {
        code: code.toUpperCase(),
        discount: discount,
        type: type,
        active: true,
        createdAt: new Date().toISOString()
    };

    codes.push(newCode);
    saveDiscountCodes(codes);

    return { success: true, message: 'Discount code created' };
}

// Delete Discount Code (for admin)
function deleteDiscountCode(code) {
    const codes = getDiscountCodes();
    const filtered = codes.filter(c => c.code !== code);
    saveDiscountCodes(filtered);
    return { success: true, message: 'Discount code deleted' };
}

// Toggle Discount Code (for admin)
function toggleDiscountCode(code) {
    const codes = getDiscountCodes();
    const codeObj = codes.find(c => c.code === code);
    if (codeObj) {
        codeObj.active = !codeObj.active;
        saveDiscountCodes(codes);
        return { success: true, message: `Discount code ${codeObj.active ? 'activated' : 'deactivated'}` };
    }
    return { success: false, message: 'Code not found' };
}

// Initialize discount codes on page load
initDiscountCodes();
