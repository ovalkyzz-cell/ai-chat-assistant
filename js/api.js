const API = {
    baseUrl: '',
    token: null,
    setToken(t) { this.token = t; t ? localStorage.setItem('mazval_token', t) : localStorage.removeItem('mazval_token'); },
    getToken() { if (!this.token) this.token = localStorage.getItem('mazval_token'); return this.token; },
    async request(ep, opts = {}) {
        const h = { 'Content-Type': 'application/json', ...opts.headers };
        const t = this.getToken();
        if (t) h['Authorization'] = `Bearer ${t}`;
        try {
            const r = await fetch(`${this.baseUrl}${ep}`, { ...opts, headers: h });
            const d = await r.json();
            if (!r.ok) throw { status: r.status, ...d };
            return d;
        } catch (e) { if (e.status) throw e; throw { success: false, error: { code: 'NETWORK', message: 'Network error' } }; }
    },
    get(ep) { return this.request(ep); },
    post(ep, body) { return this.request(ep, { method: 'POST', body: JSON.stringify(body) }); },
    patch(ep, body) { return this.request(ep, { method: 'PATCH', body: JSON.stringify(body) }); },
    delete(ep) { return this.request(ep, { method: 'DELETE' }); },

    async register(n, e, p) { return this.post('/api/auth/register', { name: n, email: e, password: p }); },
    async login(e, p) {
        const d = await this.post('/api/auth/login', { email: e, password: p });
        if (d.success && d.data.token) { this.setToken(d.data.token); localStorage.setItem('mazval_user', JSON.stringify(d.data.user)); }
        return d;
    },
    async logout() { try { await this.post('/api/auth/logout'); } finally { this.setToken(null); localStorage.removeItem('mazval_user'); localStorage.removeItem('mazval_token'); } },
    async getMe() { return this.get('/api/auth/me'); },

    async getConversations(q) { return this.get('/api/conversations' + (q ? '?q=' + encodeURIComponent(q) : '')); },
    async createConversation(title, model) { return this.post('/api/conversations', { title, model }); },
    async getConversation(id) { return this.get(`/api/conversations/${id}`); },
    async updateConversation(id, title) { return this.patch(`/api/conversations/${id}`, { title }); },
    async deleteConversation(id) { return this.delete(`/api/conversations/${id}`); },

    async sendMessage(cid, msg, model) { return this.post('/api/chat', { conversation_id: cid, message: msg, model }); },

    async cekNomor(n) { return this.get(`/api/tools/cek-nomor?nomor=${encodeURIComponent(n)}`); },
    async generateOTP(t, l, c) { return this.get(`/api/tools/otp?type=${t}&limit=${l}&country=${c}`); },
    async screenshotWeb(u) { return this.get(`/api/tools/ssweb?url=${encodeURIComponent(u)}`); },
    async translate(t, to, f) { return this.get(`/api/tools/translate?text=${encodeURIComponent(t)}&to=${to}&from=${f}`); },

    async download(p, u) { return this.get(`/api/downloaders/${p}?url=${encodeURIComponent(u)}`); },
    async generateImage(p) { return this.get(`/api/ai/image?prompt=${encodeURIComponent(p)}`); },

    async speechToText(audio) { return this.post('/api/speech-to-text', { audio }); },
    async uploadFile(file, name, type) { return this.post('/api/files/upload', { file, name, type }); },

    async getPlans() { return this.get('/api/plans'); },
    async createPayment(plan, name, email, pw, desc, disc) { return this.post('/api/payment/create', { plan, name, email, password: pw, description: desc, discountCode: disc }); },
    async checkPayment(txId) { return this.post('/api/payment/check', { transaction_id: txId }); },
    async applyDiscount(code, plan) { return this.post('/api/discounts/apply', { code, plan }); },

    async adminGetUsers() { return this.get('/api/admin/users'); },
    async adminApproveUser(id) { return this.post(`/api/admin/users/${id}/approve`); },
    async adminRejectUser(id) { return this.post(`/api/admin/users/${id}/reject`); },
    async adminSuspendUser(id) { return this.post(`/api/admin/users/${id}/suspend`); },
    async adminGetDiscounts() { return this.get('/api/admin/discounts'); },
    async adminCreateDiscount(code, disc, type) { return this.post('/api/admin/discounts', { code, discount: disc, type }); },
    async adminDeleteDiscount(code) { return this.delete(`/api/admin/discounts/${code}`); },
    async adminToggleDiscount(code) { return this.patch(`/api/admin/discounts/${code}`); }
};
API.token = localStorage.getItem('mazval_token');
