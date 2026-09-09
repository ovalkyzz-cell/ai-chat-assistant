/* ========================================
   Pricing Page Logic
   ======================================== */

// Pricing Plans Configuration
const PRICING_PLANS = {
    free: {
        id: 'free',
        name: 'Starter',
        price: 0,
        period: 'forever',
        dailyLimit: 5,
        features: ['chatgpt'],
        imageGen: false,
        tools: false,
        downloaders: false,
        priority: false
    },
    basic: {
        id: 'basic',
        name: 'Basic',
        price: 10000,
        period: 'chat',
        dailyLimit: 100,
        features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'],
        imageGen: false,
        tools: true,
        downloaders: true,
        priority: false
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 20000,
        period: 'month',
        dailyLimit: 500,
        features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'],
        imageGen: true,
        tools: true,
        downloaders: true,
        priority: false
    },
    premium: {
        id: 'premium',
        name: 'Premium',
        price: 35000,
        period: 'month',
        dailyLimit: -1, // Unlimited
        features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'],
        imageGen: true,
        tools: true,
        downloaders: true,
        priority: true
    },
    reseller: {
        id: 'reseller',
        name: 'Reseller',
        price: 50000,
        period: 'month',
        dailyLimit: -1,
        maxUsers: 10,
        features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'],
        imageGen: true,
        tools: true,
        downloaders: true,
        priority: true
    }
};

// Initialize Pricing Page
document.addEventListener('DOMContentLoaded', () => {
    setupBillingToggle();
    loadPricingFromStorage();
});

// Setup Billing Toggle
function setupBillingToggle() {
    const toggle = document.getElementById('billingToggle');
    const monthlyLabel = document.getElementById('monthlyLabel');
    const yearlyLabel = document.getElementById('yearlyLabel');

    if (toggle) {
        toggle.addEventListener('change', () => {
            const isYearly = toggle.checked;
            monthlyLabel.classList.toggle('active', !isYearly);
            yearlyLabel.classList.toggle('active', isYearly);
            updatePrices(isYearly);
        });
    }
}

// Update Prices based on billing period
function updatePrices(isYearly) {
    const amounts = document.querySelectorAll('.plan-price .amount');
    const periods = document.querySelectorAll('.plan-price .period');

    // Apply 20% discount for yearly
    const multiplier = isYearly ? 0.8 : 1;

    // Free plan stays the same
    if (amounts[0]) amounts[0].textContent = '0';

    // Basic (10K per chat)
    if (amounts[1]) amounts[1].textContent = isYearly ? '8' : '10';

    // Pro (20K per month)
    if (amounts[2]) amounts[2].textContent = isYearly ? '16' : '20';

    // Premium (35K per month)
    if (amounts[3]) amounts[3].textContent = isYearly ? '28' : '35';

    // Reseller (50K per month)
    if (amounts[4]) amounts[4].textContent = isYearly ? '40' : '50';
}

// Load Pricing from Storage (for admin updates)
function loadPricingFromStorage() {
    const savedPricing = localStorage.getItem('pricingConfig');
    if (savedPricing) {
        const config = JSON.parse(savedPricing);
        // Update plan prices if admin has changed them
        Object.keys(config).forEach(planId => {
            if (PRICING_PLANS[planId]) {
                PRICING_PLANS[planId].price = config[planId].price || PRICING_PLANS[planId].price;
                PRICING_PLANS[planId].dailyLimit = config[planId].dailyLimit || PRICING_PLANS[planId].dailyLimit;
            }
        });
    }
}

// Export for use in other files
window.PRICING_PLANS = PRICING_PLANS;
