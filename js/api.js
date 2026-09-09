/* ========================================
   API Client for Mazval GPT AI
   ======================================== */

const API = {
    baseUrl: '',
    token: null,

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('mazval_token', token);
        } else {
            localStorage.removeItem('mazval_token');
        }
    },

    getToken() {
        if (!this.token) {
            this.token = localStorage.getItem('mazval_token');
        }
        return this.token;
    },

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw { status: response.status, ...data };
            }

            return data;
        } catch (error) {
            if (error.status) throw error;
            throw { success: false, error: { code: 'NETWORK_ERROR', message: 'Network error' } };
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    patch(endpoint, body) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(body)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    // Auth
    async register(name, email, password) {
        return this.post('/api/auth/register', { name, email, password });
    },

    async login(email, password) {
        const data = await this.post('/api/auth/login', { email, password });
        if (data.success && data.data.token) {
            this.setToken(data.data.token);
            localStorage.setItem('mazval_user', JSON.stringify(data.data.user));
        }
        return data;
    },

    async logout() {
        try {
            await this.post('/api/auth/logout');
        } finally {
            this.setToken(null);
            localStorage.removeItem('mazval_user');
        }
    },

    async getMe() {
        return this.get('/api/auth/me');
    },

    // Conversations
    async getConversations() {
        return this.get('/api/conversations');
    },

    async createConversation(title, model) {
        return this.post('/api/conversations', { title, model });
    },

    async getConversation(id) {
        return this.get(`/api/conversations/${id}`);
    },

    async updateConversation(id, title) {
        return this.patch(`/api/conversations/${id}`, { title });
    },

    async deleteConversation(id) {
        return this.delete(`/api/conversations/${id}`);
    },

    // Chat
    async sendMessage(conversationId, message, model) {
        return this.post('/api/chat', { conversation_id: conversationId, message, model });
    },

    // Tools
    async cekNomor(nomor) {
        return this.get(`/api/tools/cek-nomor?nomor=${encodeURIComponent(nomor)}`);
    },

    async generateOTP(type, limit, country) {
        return this.get(`/api/tools/otp?type=${type}&limit=${limit}&country=${country}`);
    },

    async screenshotWeb(url) {
        return this.get(`/api/tools/ssweb?url=${encodeURIComponent(url)}`);
    },

    async translate(text, to, from) {
        return this.get(`/api/tools/translate?text=${encodeURIComponent(text)}&to=${to}&from=${from}`);
    },

    // Downloaders
    async download(platform, url) {
        return this.get(`/api/downloaders/${platform}?url=${encodeURIComponent(url)}`);
    },

    // Image
    async generateImage(prompt) {
        return this.get(`/api/ai/image?prompt=${encodeURIComponent(prompt)}`);
    },

    // Plans
    async getPlans() {
        return this.get('/api/plans');
    },

    // Payment
    async createPayment(plan, name, email, password, description, discountCode) {
        return this.post('/api/payment/create', { plan, name, email, password, description, discountCode });
    },

    async checkPayment(transactionId) {
        return this.post('/api/payment/check', { transaction_id: transactionId });
    },

    // Discounts
    async applyDiscount(code, plan) {
        return this.post('/api/discounts/apply', { code, plan });
    },

    // Admin
    async adminGetUsers() {
        return this.get('/api/admin/users');
    },

    async adminApproveUser(id) {
        return this.post(`/api/admin/users/${id}/approve`);
    },

    async adminRejectUser(id) {
        return this.post(`/api/admin/users/${id}/reject`);
    },

    async adminSuspendUser(id) {
        return this.post(`/api/admin/users/${id}/suspend`);
    },

    async adminGetDiscounts() {
        return this.get('/api/admin/discounts');
    },

    async adminCreateDiscount(code, discount, type) {
        return this.post('/api/admin/discounts', { code, discount, type });
    },

    async adminDeleteDiscount(code) {
        return this.delete(`/api/admin/discounts/${code}`);
    },

    async adminToggleDiscount(code) {
        return this.patch(`/api/admin/discounts/${code}`);
    }
};

// Initialize API token from localStorage
API.token = localStorage.getItem('mazval_token');
