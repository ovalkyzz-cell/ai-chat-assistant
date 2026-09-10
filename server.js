const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ========================================
// DATABASE - File-based persistence
// ========================================
var DB_PATH = process.env.VERCEL === '1' ? '/tmp/db_data.json' : path.join(__dirname, 'db_data.json');
var inMemoryDB = {};

function loadDB() {
    try {
        if (fs.existsSync(DB_PATH)) {
            var raw = fs.readFileSync(DB_PATH, 'utf8');
            inMemoryDB = JSON.parse(raw);
        }
    } catch(e) {
        console.error('DB load error:', e.message);
        inMemoryDB = {};
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(inMemoryDB, null, 2), 'utf8');
    } catch(e) {
        console.error('DB save error:', e.message);
    }
}

loadDB();

function readDB(n) { if (!inMemoryDB[n]) inMemoryDB[n] = []; return inMemoryDB[n]; }
function writeDB(n, d) { inMemoryDB[n] = d; saveDB(); }
function genId() { return crypto.randomBytes(16).toString('hex'); }
function hashPw(p) { return crypto.createHash('sha256').update(p).digest('hex'); }

// ========================================
// AUTH MIDDLEWARE
// ========================================
function auth(req, res, next) {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token' } });
    const token = h.split(' ')[1];
    const sessions = readDB('sessions');
    const s = sessions.find(x => x.token === token && !x.revoked);
    if (!s) return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
    const users = readDB('users');
    const u = users.find(x => x.id === s.userId);
    if (!u) return res.status(401).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    req.user = u;
    req.session = s;
    next();
}

function adminAuth(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    next();
}

// ========================================
// AUTH ROUTES
// ========================================
app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Name, email, password required' } });
    const users = readDB('users');
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(400).json({ success: false, error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });
    const u = { id: genId(), name, email: email.toLowerCase(), password: hashPw(password), role: 'user', status: 'pending', plan: 'free', dailyLimit: 5, createdAt: new Date().toISOString() };
    users.push(u);
    writeDB('users', users);
    res.json({ success: true, data: { id: u.id, name: u.name, email: u.email, status: u.status, message: 'Registration successful. Waiting for admin approval.' } });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Email and password required' } });
    const users = readDB('users');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mazzvall.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@Secure123!';
    
    if (email === adminEmail && password === adminPassword) {
        let admin = users.find(u => u.email === adminEmail);
        if (!admin) {
            admin = { id: 'admin_001', name: 'Admin', email: adminEmail, password: hashPw(password), role: 'admin', status: 'approved', plan: 'premium', dailyLimit: -1, createdAt: new Date().toISOString() };
            users.push(admin);
            writeDB('users', users);
        }
        const token = genId();
        const sessions = readDB('sessions');
        sessions.push({ token, userId: admin.id, createdAt: new Date().toISOString() });
        writeDB('sessions', sessions);
        return res.json({ success: true, data: { token, user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, status: admin.status, plan: admin.plan } } });
    }

    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== hashPw(password)) return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });

    const token = genId();
    const sessions = readDB('sessions');
    sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
    writeDB('sessions', sessions);
    res.json({ success: true, data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, plan: user.plan } } });
});

app.post('/api/auth/logout', auth, (req, res) => {
    const sessions = readDB('sessions');
    const idx = sessions.findIndex(s => s.token === req.session.token);
    if (idx !== -1) { sessions[idx].revoked = true; writeDB('sessions', sessions); }
    res.json({ success: true, data: { message: 'Logged out' } });
});

app.get('/api/auth/me', auth, (req, res) => {
    const u = req.user;
    res.json({ success: true, data: { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, plan: u.plan, dailyLimit: u.dailyLimit, createdAt: u.createdAt } });
});

// ========================================
// CONVERSATION ROUTES
// ========================================
app.get('/api/conversations', auth, (req, res) => {
    const q = (req.query.q || '').toLowerCase();
    let list = readDB('conversations').filter(c => c.userId === req.user.id);
    if (q) list = list.filter(c => (c.title || '').toLowerCase().includes(q));
    list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({ success: true, data: list.map(c => ({ id: c.id, title: c.title, model: c.model, createdAt: c.createdAt, updatedAt: c.updatedAt })) });
});

app.post('/api/conversations', auth, (req, res) => {
    const { title, model } = req.body;
    const c = { id: genId(), userId: req.user.id, title: title || 'New Chat', model: model || 'chatgpt', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const convs = readDB('conversations');
    convs.push(c);
    writeDB('conversations', convs);
    res.json({ success: true, data: c });
});

app.get('/api/conversations/:id', auth, (req, res) => {
    const c = readDB('conversations').find(x => x.id === req.params.id && x.userId === req.user.id);
    if (!c) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
    const msgs = readDB('messages').filter(m => m.conversationId === c.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json({ success: true, data: { ...c, messages: msgs } });
});

app.patch('/api/conversations/:id', auth, (req, res) => {
    const convs = readDB('conversations');
    const idx = convs.findIndex(c => c.id === req.params.id && c.userId === req.user.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
    if (req.body.title) convs[idx].title = req.body.title;
    convs[idx].updatedAt = new Date().toISOString();
    writeDB('conversations', convs);
    res.json({ success: true, data: convs[idx] });
});

app.delete('/api/conversations/:id', auth, (req, res) => {
    const convs = readDB('conversations');
    const idx = convs.findIndex(c => c.id === req.params.id && c.userId === req.user.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
    const msgs = readDB('messages');
    writeDB('messages', msgs.filter(m => m.conversationId !== req.params.id));
    convs.splice(idx, 1);
    writeDB('conversations', convs);
    res.json({ success: true, data: { message: 'Deleted' } });
});

// ========================================
// CHAT
// ========================================
app.post('/api/chat', auth, async (req, res) => {
    const { conversation_id, message, model } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ success: false, error: { code: 'EMPTY', message: 'Message required' } });

    const today = new Date().toDateString();
    const usage = readDB('usage');
    const uUsage = usage.find(u => u.userId === req.user.id && u.date === today);
    const used = uUsage ? uUsage.count : 0;
    if (req.user.dailyLimit !== -1 && used >= req.user.dailyLimit) return res.status(429).json({ success: false, error: { code: 'LIMIT', message: 'Daily limit reached' } });

    let convs = readDB('conversations');
    let conv = convs.find(c => c.id === conversation_id && c.userId === req.user.id);
    if (!conv) {
        conv = { id: genId(), userId: req.user.id, title: message.substring(0, 50) + (message.length > 50 ? '...' : ''), model: model || 'chatgpt', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        convs.push(conv);
        writeDB('conversations', convs);
    }

    const msgs = readDB('messages');
    msgs.push({ id: genId(), conversationId: conv.id, role: 'user', content: message, createdAt: new Date().toISOString() });
    writeDB('messages', msgs);

    const selectedModel = model || conv.model || 'chatgpt';

    if (selectedModel === 'image') {
        try {
            const r = await fetch(`https://www.keyrafara.com/ai/image?prompt=${encodeURIComponent(message)}&model=flux`);
            const d = await r.json();
            let imgResp = d.url || d.image || d.data?.url || d.data?.image || '';
            if (!imgResp && d.result) {
                if (typeof d.result === 'string') imgResp = d.result;
                else if (d.result.url) imgResp = d.result.url;
                else if (d.result.image) imgResp = d.result.image;
            }
            const assistantMsg = { id: genId(), conversationId: conv.id, role: 'assistant', content: imgResp ? `![Generated Image](${imgResp})` : 'Image generation completed.', model: 'image', createdAt: new Date().toISOString() };
            msgs.push(assistantMsg);
            writeDB('messages', msgs);
            const ci = convs.findIndex(c => c.id === conv.id);
            if (ci !== -1) { convs[ci].updatedAt = new Date().toISOString(); writeDB('conversations', convs); }
            const ui = usage.findIndex(u => u.userId === req.user.id && u.date === today);
            if (ui !== -1) usage[ui].count++; else usage.push({ userId: req.user.id, date: today, count: 1 });
            writeDB('usage', usage);
            return res.json({ success: true, data: { message: assistantMsg, conversation: { id: conv.id, title: conv.title } } });
        } catch (e) {
            return res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: 'Image generation failed' } });
        }
    }

    const ENDPOINTS = { chatgpt: 'https://www.keyrafara.com/ai/chatgpt', gemini: 'https://www.keyrafara.com/ai/gemini', copilot: 'https://www.keyrafara.com/ai/copilot', apertus: 'https://www.keyrafara.com/ai/apertus', 'claude-opus': 'https://www.keyrafara.com/ai/claude-opus', mistral: 'https://www.keyrafara.com/ai/mistral', felo: 'https://www.keyrafara.com/ai/felo', turboseek: 'https://www.keyrafara.com/ai/turboseek' };
    const ep = ENDPOINTS[selectedModel];
    if (!ep) return res.status(400).json({ success: false, error: { code: 'INVALID_MODEL', message: 'Invalid model' } });

    try {
        const url = selectedModel === 'chatgpt' ? `${ep}?query=${encodeURIComponent(message)}&model=auto` : `${ep}?text=${encodeURIComponent(message)}`;
        const r = await fetch(url);
        const d = await r.json();
        let aiResp = '';
        if (typeof d.response === 'string') aiResp = d.response;
        else if (typeof d.answer === 'string') aiResp = d.answer;
        else if (typeof d.text === 'string') aiResp = d.text;
        else if (typeof d.message === 'string') aiResp = d.message;
        else if (typeof d.content === 'string') aiResp = d.content;
        else if (typeof d.result === 'string') aiResp = d.result;
        else if (d.result && typeof d.result === 'object') {
            if (typeof d.result.answer === 'string') aiResp = d.result.answer;
            else if (typeof d.result.response === 'string') aiResp = d.result.response;
            else if (typeof d.result.text === 'string') aiResp = d.result.text;
        }
        else if (d.choices && d.choices.length > 0) aiResp = d.choices[0].message?.content || d.choices[0].text || '';
        else if (typeof d === 'string') aiResp = d;
        else aiResp = 'I received your message. How can I help?';
        aiResp = aiResp.trim();
        if (!aiResp || aiResp.startsWith('{') || aiResp.startsWith('[')) aiResp = 'I received your message. How can I help?';

        const assistantMsg = { id: genId(), conversationId: conv.id, role: 'assistant', content: aiResp, model: selectedModel, createdAt: new Date().toISOString() };
        msgs.push(assistantMsg);
        writeDB('messages', msgs);
        const ci = convs.findIndex(c => c.id === conv.id);
        if (ci !== -1) { convs[ci].updatedAt = new Date().toISOString(); writeDB('conversations', convs); }
        const ui = usage.findIndex(u => u.userId === req.user.id && u.date === today);
        if (ui !== -1) usage[ui].count++; else usage.push({ userId: req.user.id, date: today, count: 1 });
        writeDB('usage', usage);
        res.json({ success: true, data: { message: assistantMsg, conversation: { id: conv.id, title: conv.title } } });
    } catch (e) {
        console.error('AI Error:', e);
        res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: 'Failed to get AI response' } });
    }
});

// ========================================
// TOOLS
// ========================================
app.get('/api/tools/cek-nomor', auth, async (req, res) => {
    try { const r = await fetch(`https://www.keyrafara.com/tools/cek-nomor?nomor=${encodeURIComponent(req.query.nomor)}`); const d = await r.json(); res.json({ success: true, data: d }); } catch (e) { res.status(500).json({ success: false, error: { code: 'TOOL_ERROR', message: 'Failed' } }); }
});

app.get('/api/tools/otp', auth, async (req, res) => {
    try { const r = await fetch(`https://www.keyrafara.com/tools/otp?type=${req.query.type || 'otps'}&limit=${req.query.limit || '20'}&country=${req.query.country || 'indonesia'}`); const d = await r.json(); res.json({ success: true, data: d }); } catch (e) { res.status(500).json({ success: false, error: { code: 'TOOL_ERROR', message: 'Failed' } }); }
});

app.get('/api/tools/ssweb', auth, async (req, res) => {
    try { const r = await fetch(`https://www.keyrafara.com/tools/ssweb?url=${encodeURIComponent(req.query.url)}`); const d = await r.json(); res.json({ success: true, data: d }); } catch (e) { res.status(500).json({ success: false, error: { code: 'TOOL_ERROR', message: 'Failed' } }); }
});

app.get('/api/tools/translate', auth, async (req, res) => {
    try { const r = await fetch(`https://www.keyrafara.com/tools/translate?text=${encodeURIComponent(req.query.text)}&to=${req.query.to || 'en'}&from=${req.query.from || 'auto'}`); const d = await r.json(); res.json({ success: true, data: d }); } catch (e) { res.status(500).json({ success: false, error: { code: 'TOOL_ERROR', message: 'Failed' } }); }
});

// ========================================
// DOWNLOADERS
// ========================================
app.get('/api/downloaders/:platform', auth, async (req, res) => {
    const EP = { instagram: 'https://www.keyrafara.com/downloaders/instagram', facebook: 'https://www.keyrafara.com/downloaders/facebook', tiktok: 'https://www.keyrafara.com/downloaders/tiktok', twitter: 'https://www.keyrafara.com/downloaders/twitter', youtube: 'https://www.keyrafara.com/downloaders/youtube', 'youtube-mp3': 'https://www.keyrafara.com/downloaders/youtube-mp3', spotify: 'https://www.keyrafara.com/downloaders/spotify', safefileku: 'https://www.keyrafara.com/downloaders/safefileku' };
    const ep = EP[req.params.platform];
    if (!ep) return res.status(400).json({ success: false, error: { code: 'INVALID_PLATFORM', message: 'Invalid platform' } });
    try { const r = await fetch(`${ep}?url=${encodeURIComponent(req.query.url)}`); const d = await r.json(); res.json({ success: true, data: d }); } catch (e) { res.status(500).json({ success: false, error: { code: 'DOWNLOAD_ERROR', message: 'Failed' } }); }
});

// ========================================
// IMAGE
// ========================================
app.get('/api/ai/image', auth, async (req, res) => {
    try { const r = await fetch(`https://www.keyrafara.com/ai/image?prompt=${encodeURIComponent(req.query.prompt)}&model=flux`); const d = await r.json(); res.json({ success: true, data: d }); } catch (e) { res.status(500).json({ success: false, error: { code: 'IMAGE_ERROR', message: 'Failed' } }); }
});

// ========================================
// SPEECH TO TEXT
// ========================================
app.post('/api/speech-to-text', auth, async (req, res) => {
    const { audio } = req.body;
    if (!audio) return res.status(400).json({ success: false, error: { code: 'MISSING_AUDIO', message: 'Audio data required' } });
    try {
        const r = await fetch('https://www.keyrafara.com/ai/speech-to-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio, language: 'id' })
        });
        const d = await r.json();
        res.json({ success: true, data: { text: d.text || d.transcript || d.result || '' } });
    } catch (e) {
        res.status(500).json({ success: false, error: { code: 'STT_ERROR', message: 'Speech recognition failed' } });
    }
});

// ========================================
// FILE UPLOAD (Base64)
// ========================================
app.post('/api/files/upload', auth, (req, res) => {
    const { file, name, type } = req.body;
    if (!file || !name) return res.status(400).json({ success: false, error: { code: 'MISSING_FILE', message: 'File data required' } });
    
    const maxSize = 10 * 1024 * 1024;
    const base64Length = file.length;
    const decodedSize = Math.ceil(base64Length * 3 / 4);
    if (decodedSize > maxSize) return res.status(400).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'File too large (max 10MB)' } });
    
    const blocked = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.com', '.scr', '.vbs', '.js'];
    const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
    if (blocked.includes(ext)) return res.status(400).json({ success: false, error: { code: 'BLOCKED', message: 'File type not allowed' } });
    
    const id = genId();
    const files = readDB('files');
    files.push({ id, userId: req.user.id, name, type: type || 'application/octet-stream', size: decodedSize, data: file, createdAt: new Date().toISOString() });
    writeDB('files', files);
    res.json({ success: true, data: { id, name, type, url: `data:${type};base64,${file}` } });
});

// ========================================
// PLANS
// ========================================
app.get('/api/plans', (req, res) => {
    res.json({ success: true, data: [
        { id: 'free', name: 'Free', price: 0, currency: 'IDR', dailyLimit: 5, features: ['chatgpt'], imageGen: false, tools: false, downloaders: false },
        { id: 'basic', name: 'Basic', price: 10000, currency: 'IDR', dailyLimit: 100, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: false, tools: true, downloaders: true },
        { id: 'pro', name: 'Pro', price: 20000, currency: 'IDR', dailyLimit: 500, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: true, tools: true, downloaders: true },
        { id: 'premium', name: 'Premium', price: 35000, currency: 'IDR', dailyLimit: -1, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: true, tools: true, downloaders: true },
        { id: 'reseller', name: 'Reseller', price: 50000, currency: 'IDR', dailyLimit: -1, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: true, tools: true, downloaders: true, maxUsers: 10 }
    ]});
});

// ========================================
// PAYMENT
// ========================================
app.post('/api/payment/create', auth, async (req, res) => {
    const { plan, name, email, password, description, discountCode } = req.body;
    const PLANS = { basic: { name: 'Basic', price: 10000 }, pro: { name: 'Pro', price: 20000 }, premium: { name: 'Premium', price: 35000 }, reseller: { name: 'Reseller', price: 50000 } };
    const pd = PLANS[plan];
    if (!pd) return res.status(400).json({ success: false, error: { code: 'INVALID_PLAN', message: 'Invalid plan' } });
    let amount = pd.price;
    if (discountCode) {
        const codes = readDB('discountCodes');
        const c = codes.find(x => x.code === discountCode.toUpperCase() && x.active);
        if (c) amount = c.type === 'percent' ? Math.floor(amount * (1 - c.discount / 100)) : Math.max(0, amount - c.discount);
    }
    try {
        const r = await fetch('https://api.buatqris.site', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ action: 'api_create_qris', account_id: process.env.QRIS_ACCOUNT_ID || '', secret_token: process.env.QRIS_SECRET_TOKEN || '', amount: amount.toString(), description: description || `Payment for ${pd.name}`, qris_method: 'qris_two', fee_by: 'user' }) });
        const d = await r.json();
        if (d.success && d.data) {
            const txns = readDB('transactions');
            txns.push({ id: d.data.transaction_id, userId: req.user.id, plan, name, email, password: password ? hashPw(password) : null, amount, status: 'pending', createdAt: new Date().toISOString() });
            writeDB('transactions', txns);
            res.json({ success: true, data: d.data });
        } else throw new Error(d.message || 'Failed');
    } catch (e) { res.status(500).json({ success: false, error: { code: 'PAYMENT_ERROR', message: 'Payment failed' } }); }
});

app.post('/api/payment/check', auth, async (req, res) => {
    try {
        const txns = readDB('transactions');
        const tx = txns.find(t => t.id === req.body.transaction_id && t.userId === req.user.id);
        if (!tx) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
        
        const r = await fetch('https://api.buatqris.site', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ action: 'api_check_status', account_id: process.env.QRIS_ACCOUNT_ID || '', secret_token: process.env.QRIS_SECRET_TOKEN || '', transaction_id: req.body.transaction_id }) });
        const d = await r.json();
        if (d.success && d.data) {
            if (d.data.status === 'success' && tx.status !== 'success') {
                tx.status = 'success';
                writeDB('transactions', txns);
                const users = readDB('users');
                let u = users.find(x => x.email === tx.email);
                if (!u && tx.password) {
                    u = { id: genId(), name: tx.name, email: tx.email, password: tx.password, role: 'user', status: 'approved', plan: tx.plan, dailyLimit: tx.plan === 'premium' || tx.plan === 'reseller' ? -1 : tx.plan === 'pro' ? 500 : 100, createdAt: new Date().toISOString() };
                    users.push(u);
                } else if (u) { u.status = 'approved'; u.plan = tx.plan; u.dailyLimit = tx.plan === 'premium' || tx.plan === 'reseller' ? -1 : tx.plan === 'pro' ? 500 : 100; }
                writeDB('users', users);
            }
            res.json({ success: true, data: d.data });
        } else throw new Error(d.message || 'Failed');
    } catch (e) { res.status(500).json({ success: false, error: { code: 'PAYMENT_ERROR', message: 'Check failed' } }); }
});

// ========================================
// DISCOUNTS
// ========================================
app.post('/api/discounts/apply', auth, (req, res) => {
    const { code, plan } = req.body;
    if (!code) return res.status(400).json({ success: false, error: { code: 'MISSING_CODE', message: 'Discount code required' } });
    const normalizedCode = code.toUpperCase().trim();
    if (!normalizedCode.startsWith('GOVAL-')) return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Code must start with GOVAL-' } });
    const codes = readDB('discountCodes');
    const c = codes.find(x => x.code === normalizedCode && x.active);
    if (!c) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invalid or expired code' } });
    const PRICES = { basic: 10000, pro: 20000, premium: 35000, reseller: 50000 };
    const p = PRICES[plan] || 0;
    const amt = c.type === 'percent' ? Math.floor(p * (c.discount / 100)) : Math.min(c.discount, p);
    res.json({ success: true, data: { code: c.code, discount: amt, type: c.type, value: c.discount } });
});

// ========================================
// ADMIN
// ========================================
app.get('/api/admin/users', auth, adminAuth, (req, res) => {
    res.json({ success: true, data: readDB('users').map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, plan: u.plan, dailyLimit: u.dailyLimit, createdAt: u.createdAt })) });
});

app.post('/api/admin/users/:id/approve', auth, adminAuth, (req, res) => {
    const users = readDB('users');
    const u = users.find(x => x.id === req.params.id);
    if (!u) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    u.status = 'approved';
    writeDB('users', users);
    res.json({ success: true, data: { message: 'Approved' } });
});

app.post('/api/admin/users/:id/reject', auth, adminAuth, (req, res) => {
    const users = readDB('users');
    const u = users.find(x => x.id === req.params.id);
    if (!u) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    u.status = 'rejected';
    writeDB('users', users);
    res.json({ success: true, data: { message: 'Rejected' } });
});

app.post('/api/admin/users/:id/suspend', auth, adminAuth, (req, res) => {
    const users = readDB('users');
    const u = users.find(x => x.id === req.params.id);
    if (!u) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    u.status = 'suspended';
    writeDB('users', users);
    res.json({ success: true, data: { message: 'Suspended' } });
});

app.get('/api/admin/discounts', auth, adminAuth, (req, res) => {
    res.json({ success: true, data: readDB('discountCodes') });
});

app.post('/api/admin/discounts', auth, adminAuth, (req, res) => {
    const { code, discount, type } = req.body;
    if (!code) return res.status(400).json({ success: false, error: { code: 'MISSING', message: 'Code required' } });
    const normalizedCode = code.toUpperCase().trim();
    if (!normalizedCode.startsWith('GOVAL-')) return res.status(400).json({ success: false, error: { code: 'INVALID', message: 'Code must start with GOVAL-' } });
    const codes = readDB('discountCodes');
    if (codes.find(c => c.code === normalizedCode)) return res.status(400).json({ success: false, error: { code: 'EXISTS', message: 'Code already exists' } });
    const discountValue = parseInt(discount);
    if (isNaN(discountValue) || discountValue <= 0) return res.status(400).json({ success: false, error: { code: 'INVALID', message: 'Invalid discount value' } });
    codes.push({ code: normalizedCode, discount: discountValue, type: type === 'fixed' ? 'fixed' : 'percent', active: true, createdAt: new Date().toISOString() });
    writeDB('discountCodes', codes);
    res.json({ success: true, data: { message: 'Created' } });
});

app.delete('/api/admin/discounts/:code', auth, adminAuth, (req, res) => {
    let codes = readDB('discountCodes');
    codes = codes.filter(c => c.code !== req.params.code.toUpperCase());
    writeDB('discountCodes', codes);
    res.json({ success: true, data: { message: 'Deleted' } });
});

app.patch('/api/admin/discounts/:code', auth, adminAuth, (req, res) => {
    const codes = readDB('discountCodes');
    const c = codes.find(x => x.code === req.params.code.toUpperCase());
    if (!c) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
    c.active = !c.active;
    writeDB('discountCodes', codes);
    res.json({ success: true, data: { message: c.active ? 'Activated' : 'Deactivated' } });
});

// ========================================
// CATCH-ALL: serve index.html for SPA routes
// ========================================
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
    const htmlFile = path.join(__dirname, req.path.endsWith('.html') ? req.path : req.path + '.html');
    if (fs.existsSync(htmlFile)) return res.sendFile(htmlFile);
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'Server error' } });
});

if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
