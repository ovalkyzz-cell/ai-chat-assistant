var API = {
    baseUrl: '',
    token: localStorage.getItem('mazval_token'),

    setToken: function(t) {
        this.token = t;
        if (t) { localStorage.setItem('mazval_token', t); }
        else { localStorage.removeItem('mazval_token'); }
    },

    getToken: function() {
        if (!this.token) this.token = localStorage.getItem('mazval_token');
        return this.token;
    },

    request: function(ep, opts) {
        opts = opts || {};
        var headers = { 'Content-Type': 'application/json' };
        if (opts.headers) { for (var k in opts.headers) headers[k] = opts.headers[k]; }
        var token = this.getToken();
        if (token) headers['Authorization'] = 'Bearer ' + token;

        return fetch(this.baseUrl + ep, {
            method: opts.method || 'GET',
            headers: headers,
            body: opts.body ? JSON.stringify(opts.body) : undefined
        }).then(function(r) {
            return r.json().then(function(d) {
                if (!r.ok) throw { status: r.status, error: d.error || { message: 'Request failed' } };
                return d;
            });
        }).catch(function(e) {
            if (e.status) throw e;
            throw { error: { code: 'NETWORK', message: 'Network error' } };
        });
    },

    get: function(ep) { return this.request(ep); },
    post: function(ep, body) { return this.request(ep, { method: 'POST', body: body }); },
    patch: function(ep, body) { return this.request(ep, { method: 'PATCH', body: body }); },
    del: function(ep) { return this.request(ep, { method: 'DELETE' }); },

    login: function(email, password) {
        var self = this;
        return this.post('/api/auth/login', { email: email, password: password }).then(function(d) {
            if (d.success && d.data.token) {
                self.setToken(d.data.token);
                localStorage.setItem('mazval_user', JSON.stringify(d.data.user));
            }
            return d;
        });
    },

    logout: function() {
        var self = this;
        return this.post('/api/auth/logout', {}).then(function() {
            self.setToken(null);
            localStorage.removeItem('mazval_user');
        }).catch(function() {
            self.setToken(null);
            localStorage.removeItem('mazval_user');
        });
    },

    getConversations: function(q) {
        return this.get('/api/conversations' + (q ? '?q=' + encodeURIComponent(q) : ''));
    },
    createConversation: function(title, model) {
        return this.post('/api/conversations', { title: title, model: model });
    },
    getConversation: function(id) {
        return this.get('/api/conversations/' + id);
    },
    updateConversation: function(id, title) {
        return this.patch('/api/conversations/' + id, { title: title });
    },
    deleteConversation: function(id) {
        return this.del('/api/conversations/' + id);
    },

    sendMessage: function(conversationId, message, model) {
        return this.post('/api/chat', { conversation_id: conversationId, message: message, model: model });
    },

    cekNomor: function(n) { return this.get('/api/tools/cek-nomor?nomor=' + encodeURIComponent(n)); },
    generateOTP: function(t, l, c) { return this.get('/api/tools/otp?type=' + t + '&limit=' + l + '&country=' + c); },
    screenshotWeb: function(u) { return this.get('/api/tools/ssweb?url=' + encodeURIComponent(u)); },
    translate: function(t, to, f) { return this.get('/api/tools/translate?text=' + encodeURIComponent(t) + '&to=' + to + '&from=' + f); },
    download: function(p, u) { return this.get('/api/downloaders/' + p + '?url=' + encodeURIComponent(u)); },
    speechToText: function(audio) { return this.post('/api/speech-to-text', { audio: audio }); },
    uploadFile: function(file, name, type) { return this.post('/api/files/upload', { file: file, name: name, type: type }); }
};
