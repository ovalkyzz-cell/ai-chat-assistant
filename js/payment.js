/* ========================================
   Payment System - Mazval GPT AI
   Uses API Client for all requests
   ======================================== */

// Payment State
const PaymentState = {
    selectedPlan: null,
    selectedPrice: 0,
    transactionId: null,
    timerInterval: null,
    timerSeconds: 900,
    checkingStatus: false,
    discount: null
};

// Plan Details
const PLAN_DETAILS = {
    basic: { name: 'Basic', price: 10000, dailyLimit: 100, duration: null },
    pro: { name: 'Pro', price: 20000, dailyLimit: 500, duration: 30 },
    premium: { name: 'Premium', price: 35000, dailyLimit: -1, duration: 30 },
    reseller: { name: 'Reseller', price: 50000, dailyLimit: -1, duration: 30, maxUsers: 10 }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
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
    
    document.querySelectorAll('.plan-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    const selectedOption = document.querySelector(`.plan-option[data-plan="${plan}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    document.getElementById('continueToStep2').disabled = false;
}

// Setup Navigation
function setupNavigation() {
    document.getElementById('continueToStep2').addEventListener('click', () => {
        if (!PaymentState.selectedPlan) {
            showToast('Please select a plan', 'warning');
            return;
        }
        goToStep(2);
        updateOrderSummary();
    });
    
    document.getElementById('backToStep1').addEventListener('click', () => {
        goToStep(1);
    });
    
    document.getElementById('continueToStep3').addEventListener('click', () => {
        if (validateForm()) {
            createPayment();
        }
    });
}

// Go to Step
function goToStep(step) {
    document.querySelectorAll('.payment-step').forEach(s => {
        s.classList.remove('active');
    });
    document.getElementById(`step${step}`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Update Order Summary
function updateOrderSummary() {
    const plan = PLAN_DETAILS[PaymentState.selectedPlan];
    if (!plan) return;
    
    document.getElementById('summaryPlan').textContent = `${plan.name} Plan`;
    document.getElementById('summaryPrice').textContent = formatPrice(plan.price);
    
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

// Create Payment
async function createPayment() {
    const plan = PLAN_DETAILS[PaymentState.selectedPlan];
    const name = document.getElementById('customerName').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const password = document.getElementById('customerPassword').value;
    const description = document.getElementById('paymentDesc').value.trim() || `Payment for ${plan.name} Plan`;
    const discountCode = document.getElementById('discountCode')?.value.trim() || '';
    
    goToStep(3);
    document.getElementById('qrisTotalAmount').textContent = formatPrice(plan.price);
    
    const qrContainer = document.getElementById('qrisCode');
    qrContainer.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="spinner" style="margin: 0 auto 16px;"></div><p style="color: #666;">Generating QR Code...</p></div>';
    
    try {
        // Get current user if logged in
        let user = null;
        try {
            user = JSON.parse(localStorage.getItem('mazval_user'));
        } catch {}
        
        const data = await API.createPayment(
            PaymentState.selectedPlan,
            name,
            email,
            password,
            description,
            discountCode
        );
        
        if (data.success && data.data) {
            PaymentState.transactionId = data.data.transaction_id;
            
            localStorage.setItem('pendingPayment', JSON.stringify({
                transactionId: data.data.transaction_id,
                plan: PaymentState.selectedPlan,
                name: name,
                email: email,
                password: password,
                amount: plan.price,
                createdAt: new Date().toISOString()
            }));
            
            displayQRCode(data.data);
            startTimer();
            startAutoCheckStatus();
            
            showToast('QR Code generated successfully', 'success');
        } else {
            throw new Error(data.message || 'Failed to create transaction');
        }
    } catch (error) {
        console.error('Payment Error:', error);
        showToast(error.error?.message || 'Failed to create QR Code', 'error');
        
        qrContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #e74c3c;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i>
                <p style="margin-bottom: 16px;">Failed to create QR Code</p>
                <button onclick="createPayment()" class="btn-retry" style="padding: 10px 20px; background: #10a37f; color: white; border: none; border-radius: 8px; cursor: pointer;">
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
    const qrUrl = data.qr_url;
    const qrisImage = data.qris_image;
    const paymentUrl = data.payment_url;
    
    if (qrUrl) {
        qrContainer.innerHTML = `<img src="${qrUrl}" alt="QRIS Code" onerror="this.onerror=null;this.src='${qrisImage || ''}'">`;
    } else if (qrisImage) {
        qrContainer.innerHTML = `<img src="${qrisImage}" alt="QRIS Code">`;
    } else if (paymentUrl) {
        qrContainer.innerHTML = `<div style="text-align: center;"><p style="color: #333; margin-bottom: 16px;">Click below to pay</p><a href="${paymentUrl}" target="_blank" style="display: inline-block; padding: 12px 24px; background: #10a37f; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Open Payment Page</a></div>`;
    } else {
        qrContainer.innerHTML = '<div style="text-align: center; color: #666;"><p>QR Code not available</p></div>';
    }
}

// Start Timer
function startTimer() {
    PaymentState.timerSeconds = 900;
    updateTimerDisplay();
    
    PaymentState.timerInterval = setInterval(() => {
        PaymentState.timerSeconds--;
        updateTimerDisplay();
        
        if (PaymentState.timerSeconds <= 0) {
            clearInterval(PaymentState.timerInterval);
            showToast('QR Code has expired. Please create a new one.', 'warning');
            document.getElementById('paymentStatus').innerHTML = '<div class="status-icon failed"><i class="fas fa-times-circle"></i></div><span>QR Code expired</span>';
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(PaymentState.timerSeconds / 60);
    const seconds = PaymentState.timerSeconds % 60;
    document.getElementById('timerDisplay').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
        const data = await API.checkPayment(PaymentState.transactionId);
        
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

function updatePaymentStatus(status) {
    const statusEl = document.getElementById('paymentStatus');
    
    const statusConfig = {
        pending: { icon: 'fa-hourglass-half', class: 'pending', text: 'Waiting for payment...' },
        success: { icon: 'fa-check-circle', class: 'success', text: 'Payment successful!' },
        failed: { icon: 'fa-times-circle', class: 'failed', text: 'Payment failed' },
        expired: { icon: 'fa-clock', class: 'failed', text: 'Payment expired' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    
    statusEl.innerHTML = `<div class="status-icon ${config.class}"><i class="fas ${config.icon}"></i></div><span>${config.text}</span>`;
}

function startAutoCheckStatus() {
    setInterval(() => {
        if (PaymentState.transactionId && PaymentState.timerSeconds > 0) {
            checkPaymentStatus();
        }
    }, 10000);
}

// Handle Payment Success
function handlePaymentSuccess(paymentData) {
    clearInterval(PaymentState.timerInterval);
    
    goToStep(4);
    
    document.getElementById('successTxId').textContent = PaymentState.transactionId;
    document.getElementById('successPlan').textContent = PLAN_DETAILS[PaymentState.selectedPlan]?.name || PaymentState.selectedPlan;
    document.getElementById('successAmount').textContent = formatPrice(paymentData.amount || PaymentState.selectedPrice);
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    document.getElementById('successExpiry').textContent = formatDate(expiryDate.toISOString());
    
    showToast('Payment successful! Account created.', 'success');
    
    // Clear pending payment
    localStorage.removeItem('pendingPayment');
}

// Format Price
function formatPrice(amount) {
    return 'Rp' + amount.toLocaleString('id-ID');
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span class="toast-message">${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Apply Discount
async function applyDiscount() {
    const codeInput = document.getElementById('discountCode');
    const hintEl = document.getElementById('discountHint');
    const code = codeInput.value.trim().toUpperCase();
    
    if (!code) {
        hintEl.textContent = 'Please enter a discount code';
        hintEl.style.color = '#e74c3c';
        return;
    }
    
    if (!code.startsWith('GOVAL-')) {
        hintEl.textContent = 'Invalid format. Code must start with GOVAL-';
        hintEl.style.color = '#e74c3c';
        return;
    }
    
    try {
        const data = await API.applyDiscount(code, PaymentState.selectedPlan);
        
        if (data.success) {
            PaymentState.discount = data.data;
            hintEl.textContent = `Discount applied! -${formatPrice(data.data.discount)}`;
            hintEl.style.color = '#10a37f';
            updateOrderSummary();
            showToast('Discount code applied successfully!', 'success');
        }
    } catch (error) {
        hintEl.textContent = error.error?.message || 'Invalid discount code';
        hintEl.style.color = '#e74c3c';
    }
}
