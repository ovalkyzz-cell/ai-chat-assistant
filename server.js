const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname)));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ========================================
// DATABASE (JSON File-based)
// ========================================
const DB_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

function readDB(name) {
    const file = path.join(DB_DIR, `${name}.json`);
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeDB(name, data) {
    fs.writeFileSync(path.join(DB_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

function generateId() {
    return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// ========================================
// AUTH MIDDLEWARE
// ========================================
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token provided' } });
    }
    
    const token = authHeader.split(' ')[1];
    const sessions = readDB('sessions');
    const session = sessions.find(s => s.token === token && !s.revoked);
    
    if (!session) {
        return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
    }
    
    const users = readDB('users');
    const user = users.find(u => u.id === session.userId);
    
    if (!user) {
        return res.status(401).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }
    
    if (user.status !== 'approved') {
        return res.status(403).json({ success: false, error: { code: 'ACCOUNT_NOT_APPROVED', message: 'Account not approved' } });
    }
    
    req.user = user;
    req.session = session;
    next();
}

function adminMiddleware(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    }
    next();
}

// ========================================
// AUTH ROUTES
// ========================================

// Register
app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Name, email, and password are required' } });
    }
    
    const users = readDB('users');
    
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(400).json({ success: false, error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });
    }
    
    const newUser = {
        id: generateId(),
        name,
        email: email.toLowerCase(),
        password: hashPassword(password),
        role: 'user',
        status: 'pending',
        plan: 'free',
        dailyLimit: 5,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    writeDB('users', users);
    
    res.json({
        success: true,
        data: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            status: newUser.status,
            message: 'Registration successful. Waiting for admin approval.'
        }
    });
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Email and password are required' } });
    }
    
    const users = readDB('users');
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    // Admin hardcoded login
    if (email === 'admin@mazzvall.com' && password === 'Admin@Secure123!') {
        let adminUser = users.find(u => u.email === 'admin@mazzvall.com');
        if (!adminUser) {
            adminUser = {
                id: 'admin_001',
                name: 'Admin',
                email: 'admin@mazzvall.com',
                password: hashPassword(password),
                role: 'admin',
                status: 'approved',
                plan: 'premium',
                dailyLimit: -1,
                createdAt: new Date().toISOString()
            };
            users.push(adminUser);
            writeDB('users', users);
        }
        
        const token = generateId();
        const sessions = readDB('sessions');
        sessions.push({ token, userId: adminUser.id, createdAt: new Date().toISOString() });
        writeDB('sessions', sessions);
        
        return res.json({
            success: true,
            data: {
                token,
                user: { id: adminUser.id, name: adminUser.name, email: adminUser.email, role: adminUser.role, status: adminUser.status, plan: adminUser.plan }
            }
        });
    }
    
    if (!user || user.password !== hashPassword(password)) {
        return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    
    if (user.status !== 'approved') {
        return res.status(403).json({ success: false, error: { code: 'ACCOUNT_NOT_APPROVED', message: 'Account pending approval or rejected' } });
    }
    
    const token = generateId();
    const sessions = readDB('sessions');
    sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
    writeDB('sessions', sessions);
    
    res.json({
        success: true,
        data: {
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, plan: user.plan }
        }
    });
});

// Logout
app.post('/api/auth/logout', authMiddleware, (req, res) => {
    const sessions = readDB('sessions');
    const sessionIndex = sessions.findIndex(s => s.token === req.session.token);
    if (sessionIndex !== -1) {
        sessions[sessionIndex].revoked = true;
        writeDB('sessions', sessions);
    }
    res.json({ success: true, data: { message: 'Logged out successfully' } });
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({
        success: true,
        data: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            status: req.user.status,
            plan: req.user.plan,
            dailyLimit: req.user.dailyLimit,
            createdAt: req.user.createdAt
        }
    });
});

// ========================================
// CONVERSATION ROUTES
// ========================================

// Get all conversations
app.get('/api/conversations', authMiddleware, (req, res) => {
    const conversations = readDB('conversations');
    const userConversations = conversations
        .filter(c => c.userId === req.user.id)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .map(c => ({ id: c.id, title: c.title, model: c.model, createdAt: c.createdAt, updatedAt: c.updatedAt }));
    
    res.json({ success: true, data: userConversations });
});

// Create new conversation
app.post('/api/conversations', authMiddleware, (req, res) => {
    const { title, model } = req.body;
    
    const conversations = readDB('conversations');
    const newConversation = {
        id: generateId(),
        userId: req.user.id,
        title: title || 'New Chat',
        model: model || 'chatgpt',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    conversations.push(newConversation);
    writeDB('conversations', conversations);
    
    res.json({ success: true, data: newConversation });
});

// Get single conversation with messages
app.get('/api/conversations/:id', authMiddleware, (req, res) => {
    const conversations = readDB('conversations');
    const conversation = conversations.find(c => c.id === req.params.id && c.userId === req.user.id);
    
    if (!conversation) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
    }
    
    const messages = readDB('messages');
    const conversationMessages = messages
        .filter(m => m.conversationId === conversation.id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    res.json({ success: true, data: { ...conversation, messages: conversationMessages } });
});

// Update conversation
app.patch('/api/conversations/:id', authMiddleware, (req, res) => {
    const { title } = req.body;
    const conversations = readDB('conversations');
    const index = conversations.findIndex(c => c.id === req.params.id && c.userId === req.user.id);
    
    if (index === -1) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
    }
    
    if (title) conversations[index].title = title;
    conversations[index].updatedAt = new Date().toISOString();
    writeDB('conversations', conversations);
    
    res.json({ success: true, data: conversations[index] });
});

// Delete conversation
app.delete('/api/conversations/:id', authMiddleware, (req, res) => {
    const conversations = readDB('conversations');
    const index = conversations.findIndex(c => c.id === req.params.id && c.userId === req.user.id);
    
    if (index === -1) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
    }
    
    // Delete messages
    const messages = readDB('messages');
    const filteredMessages = messages.filter(m => m.conversationId !== req.params.id);
    writeDB('messages', filteredMessages);
    
    // Delete conversation
    conversations.splice(index, 1);
    writeDB('conversations', conversations);
    
    res.json({ success: true, data: { message: 'Conversation deleted' } });
});

// ========================================
// CHAT ROUTES
// ========================================

// Send message and get AI response
app.post('/api/chat', authMiddleware, async (req, res) => {
    const { conversation_id, message, model } = req.body;
    
    if (!message || !message.trim()) {
        return res.status(400).json({ success: false, error: { code: 'EMPTY_MESSAGE', message: 'Message cannot be empty' } });
    }
    
    // Check daily limit
    const today = new Date().toDateString();
    const usage = readDB('usage');
    const userUsage = usage.find(u => u.userId === req.user.id && u.date === today);
    const usedMessages = userUsage ? userUsage.count : 0;
    
    if (req.user.dailyLimit !== -1 && usedMessages >= req.user.dailyLimit) {
        return res.status(429).json({ success: false, error: { code: 'DAILY_LIMIT', message: 'Daily message limit reached' } });
    }
    
    // Get or create conversation
    let conversations = readDB('conversations');
    let conversation = conversations.find(c => c.id === conversation_id && c.userId === req.user.id);
    
    if (!conversation) {
        conversation = {
            id: generateId(),
            userId: req.user.id,
            title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
            model: model || 'chatgpt',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        conversations.push(conversation);
        writeDB('conversations', conversations);
    }
    
    // Save user message
    const messages = readDB('messages');
    const userMessage = {
        id: generateId(),
        conversationId: conversation.id,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString()
    };
    messages.push(userMessage);
    writeDB('messages', messages);
    
    // Get conversation history for context
    const conversationMessages = messages
        .filter(m => m.conversationId === conversation.id)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }));
    
    // Call AI API
    try {
        const selectedModel = model || conversation.model || 'chatgpt';
        let aiResponse = '';
        
        // AI API endpoints
        const AI_ENDPOINTS = {
            chatgpt: 'https://www.keyrafara.com/ai/chatgpt',
            gemini: 'https://www.keyrafara.com/ai/gemini',
            copilot: 'https://www.keyrafara.com/ai/copilot',
            apertus: 'https://www.keyrafara.com/ai/apertus',
            'claude-opus': 'https://www.keyrafara.com/ai/claude-opus',
            mistral: 'https://www.keyrafara.com/ai/mistral',
            felo: 'https://www.keyrafara.com/ai/felo',
            turboseek: 'https://www.keyrafara.com/ai/turboseek'
        };
        
        const endpoint = AI_ENDPOINTS[selectedModel];
        if (!endpoint) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_MODEL', message: 'Invalid AI model selected' } });
        }
        
        let url;
        if (selectedModel === 'chatgpt') {
            url = `${endpoint}?query=${encodeURIComponent(message)}&model=auto`;
        } else {
            url = `${endpoint}?text=${encodeURIComponent(message)}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`AI API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Extract response text
        if (data.response && typeof data.response === 'string') {
            aiResponse = data.response;
        } else if (data.answer && typeof data.answer === 'string') {
            aiResponse = data.answer;
        } else if (data.text && typeof data.text === 'string') {
            aiResponse = data.text;
        } else if (data.message && typeof data.message === 'string') {
            aiResponse = data.message;
        } else if (data.content && typeof data.content === 'string') {
            aiResponse = data.content;
        } else if (data.result && typeof data.result === 'string') {
            aiResponse = data.result;
        } else if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
            aiResponse = data.choices[0].message?.content || data.choices[0].text || '';
        } else if (typeof data === 'string') {
            aiResponse = data;
        } else {
            aiResponse = 'I received your message. How can I help you further?';
        }
        
        aiResponse = aiResponse.trim();
        if (!aiResponse || aiResponse.startsWith('{') || aiResponse.startsWith('[')) {
            aiResponse = 'I received your message. How can I help you further?';
        }
        
        // Save AI message
        const assistantMessage = {
            id: generateId(),
            conversationId: conversation.id,
            role: 'assistant',
            content: aiResponse,
            model: selectedModel,
            createdAt: new Date().toISOString()
        };
        messages.push(assistantMessage);
        writeDB('messages', messages);
        
        // Update conversation
        const convIndex = conversations.findIndex(c => c.id === conversation.id);
        if (convIndex !== -1) {
            conversations[convIndex].updatedAt = new Date().toISOString();
            writeDB('conversations', conversations);
        }
        
        // Update usage
        const usageIndex = usage.findIndex(u => u.userId === req.user.id && u.date === today);
        if (usageIndex !== -1) {
            usage[usageIndex].count++;
        } else {
            usage.push({ userId: req.user.id, date: today, count: 1 });
        }
        writeDB('usage', usage);
        
        res.json({
            success: true,
            data: {
                message: assistantMessage,
                conversation: { id: conversation.id, title: conversation.title }
            }
        });
        
    } catch (error) {
        console.error('AI API Error:', error);
        res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: 'Failed to get AI response' } });
    }
});

// ========================================
// TOOLS ROUTES
// ========================================

// Cek Nomor
app.get('/api/tools/cek-nomor', authMiddleware, async (req, res) => {
    const { nomor } = req.query;
    if (!nomor) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'Phone number is required' } });
    }
    
    try {
        const response = await fetch(`https://www.keyrafara.com/tools/cek-nomor?nomor=${encodeURIComponent(nomor)}`);
        const data = await response.json();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'TOOL_ERROR', message: 'Failed to check number' } });
    }
});

// OTP Generator
app.get('/api/tools/otp', authMiddleware, async (req, res) => {
    const { type, limit, country } = req.query;
    
    try {
        const response = await fetch(`https://www.keyrafara.com/tools/otp?type=${type || 'otps'}&limit=${limit || '20'}&country=${country || 'indonesia'}`);
        const data = await response.json();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'TOOL_ERROR', message: 'Failed to generate OTP' } });
    }
});

// Screenshot Website
app.get('/api/tools/ssweb', authMiddleware, async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'URL is required' } });
    }
    
    try {
        const response = await fetch(`https://www.keyrafara.com/tools/ssweb?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'TOOL_ERROR', message: 'Failed to take screenshot' } });
    }
});

// Translate
app.get('/api/tools/translate', authMiddleware, async (req, res) => {
    const { text, to, from } = req.query;
    if (!text) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'Text is required' } });
    }
    
    try {
        const response = await fetch(`https://www.keyrafara.com/tools/translate?text=${encodeURIComponent(text)}&to=${to || 'en'}&from=${from || 'auto'}`);
        const data = await response.json();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'TOOL_ERROR', message: 'Failed to translate' } });
    }
});

// ========================================
// DOWNLOADER ROUTES
// ========================================

app.get('/api/downloaders/:platform', authMiddleware, async (req, res) => {
    const { platform } = req.params;
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'URL is required' } });
    }
    
    const DOWNLOADER_ENDPOINTS = {
        instagram: 'https://www.keyrafara.com/downloaders/instagram',
        facebook: 'https://www.keyrafara.com/downloaders/facebook',
        tiktok: 'https://www.keyrafara.com/downloaders/tiktok',
        twitter: 'https://www.keyrafara.com/downloaders/twitter',
        youtube: 'https://www.keyrafara.com/downloaders/youtube',
        'youtube-mp3': 'https://www.keyrafara.com/downloaders/youtube-mp3',
        spotify: 'https://www.keyrafara.com/downloaders/spotify',
        safefileku: 'https://www.keyrafara.com/downloaders/safefileku'
    };
    
    const endpoint = DOWNLOADER_ENDPOINTS[platform];
    if (!endpoint) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_PLATFORM', message: 'Invalid platform' } });
    }
    
    try {
        const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'DOWNLOAD_ERROR', message: 'Failed to download' } });
    }
});

// ========================================
// IMAGE GENERATION ROUTE
// ========================================

app.get('/api/ai/image', authMiddleware, async (req, res) => {
    const { prompt } = req.query;
    if (!prompt) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_PARAMS', message: 'Prompt is required' } });
    }
    
    try {
        const response = await fetch(`https://www.keyrafara.com/ai/image?prompt=${encodeURIComponent(prompt)}&model=flux`);
        const data = await response.json();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: { code: 'IMAGE_ERROR', message: 'Failed to generate image' } });
    }
});

// ========================================
// PRICING ROUTES
// ========================================

app.get('/api/plans', (req, res) => {
    const plans = [
        { id: 'free', name: 'Free', price: 0, currency: 'IDR', dailyLimit: 5, features: ['chatgpt'], imageGen: false, tools: false, downloaders: false },
        { id: 'basic', name: 'Basic', price: 10000, currency: 'IDR', dailyLimit: 100, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: false, tools: true, downloaders: true },
        { id: 'pro', name: 'Pro', price: 20000, currency: 'IDR', dailyLimit: 500, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: true, tools: true, downloaders: true },
        { id: 'premium', name: 'Premium', price: 35000, currency: 'IDR', dailyLimit: -1, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: true, tools: true, downloaders: true },
        { id: 'reseller', name: 'Reseller', price: 50000, currency: 'IDR', dailyLimit: -1, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: true, tools: true, downloaders: true, maxUsers: 10 }
    ];
    
    res.json({ success: true, data: plans });
});

// ========================================
// PAYMENT ROUTES
// ========================================

app.post('/api/payment/create', authMiddleware, async (req, res) => {
    const { plan, name, email, password, description, discountCode } = req.body;
    
    const PLAN_DETAILS = {
        basic: { name: 'Basic', price: 10000, dailyLimit: 100, duration: null },
        pro: { name: 'Pro', price: 20000, dailyLimit: 500, duration: 30 },
        premium: { name: 'Premium', price: 35000, dailyLimit: -1, duration: 30 },
        reseller: { name: 'Reseller', price: 50000, dailyLimit: -1, duration: 30, maxUsers: 10 }
    };
    
    const planDetails = PLAN_DETAILS[plan];
    if (!planDetails) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_PLAN', message: 'Invalid plan selected' } });
    }
    
    let amount = planDetails.price;
    
    // Apply discount
    if (discountCode) {
        const codes = readDB('discountCodes');
        const code = codes.find(c => c.code === discountCode.toUpperCase() && c.active);
        if (code) {
            if (code.type === 'percent') {
                amount = Math.floor(amount * (1 - code.discount / 100));
            } else {
                amount = Math.max(0, amount - code.discount);
            }
        }
    }
    
    // Create QRIS transaction
    const QRIS_CONFIG = {
        baseUrl: 'https://api.buatqris.site',
        accountId: process.env.QRIS_ACCOUNT_ID || '',
        secretToken: process.env.QRIS_SECRET_TOKEN || ''
    };
    
    try {
        const response = await fetch(QRIS_CONFIG.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'api_create_qris',
                account_id: QRIS_CONFIG.accountId,
                secret_token: QRIS_CONFIG.secretToken,
                amount: amount.toString(),
                description: description || `Payment for ${planDetails.name} Plan - AI Chat Assistant`,
                qris_method: 'qris_two',
                fee_by: 'user'
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.data) {
            // Save transaction
            const transactions = readDB('transactions');
            transactions.push({
                id: data.data.transaction_id,
                userId: req.user.id,
                plan,
                name,
                email,
                password: password ? hashPassword(password) : null,
                amount,
                status: 'pending',
                createdAt: new Date().toISOString()
            });
            writeDB('transactions', transactions);
            
            res.json({ success: true, data: data.data });
        } else {
            throw new Error(data.message || 'Failed to create transaction');
        }
    } catch (error) {
        console.error('Payment Error:', error);
        res.status(500).json({ success: false, error: { code: 'PAYMENT_ERROR', message: 'Failed to create payment' } });
    }
});

app.post('/api/payment/check', authMiddleware, async (req, res) => {
    const { transaction_id } = req.body;
    
    const QRIS_CONFIG = {
        baseUrl: 'https://api.buatqris.site',
        accountId: process.env.QRIS_ACCOUNT_ID || '',
        secretToken: process.env.QRIS_SECRET_TOKEN || ''
    };
    
    try {
        const response = await fetch(QRIS_CONFIG.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'api_check_status',
                account_id: QRIS_CONFIG.accountId,
                secret_token: QRIS_CONFIG.secretToken,
                transaction_id
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.data) {
            // If payment successful, activate user
            if (data.data.status === 'success') {
                const transactions = readDB('transactions');
                const transaction = transactions.find(t => t.id === transaction_id);
                
                if (transaction && transaction.status !== 'success') {
                    transaction.status = 'success';
                    writeDB('transactions', transactions);
                    
                    // Create or update user
                    const users = readDB('users');
                    let user = users.find(u => u.email === transaction.email);
                    
                    if (!user && transaction.password) {
                        user = {
                            id: generateId(),
                            name: transaction.name,
                            email: transaction.email,
                            password: transaction.password,
                            role: transaction.plan === 'reseller' ? 'reseller' : 'user',
                            status: 'approved',
                            plan: transaction.plan,
                            dailyLimit: transaction.plan === 'premium' || transaction.plan === 'reseller' ? -1 : (transaction.plan === 'pro' ? 500 : 100),
                            createdAt: new Date().toISOString()
                        };
                        users.push(user);
                    } else if (user) {
                        user.status = 'approved';
                        user.plan = transaction.plan;
                        user.dailyLimit = transaction.plan === 'premium' || transaction.plan === 'reseller' ? -1 : (transaction.plan === 'pro' ? 500 : 100);
                    }
                    
                    writeDB('users', users);
                }
            }
            
            res.json({ success: true, data: data.data });
        } else {
            throw new Error(data.message || 'Failed to check status');
        }
    } catch (error) {
        console.error('Payment Check Error:', error);
        res.status(500).json({ success: false, error: { code: 'PAYMENT_ERROR', message: 'Failed to check payment status' } });
    }
});

// ========================================
// DISCOUNT CODE ROUTES
// ========================================

app.get('/api/discounts', (req, res) => {
    const codes = readDB('discountCodes');
    res.json({ success: true, data: codes });
});

app.post('/api/discounts/apply', authMiddleware, (req, res) => {
    const { code, plan } = req.body;
    
    if (!code || !code.startsWith('GOVAL-')) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Code must start with GOVAL-' } });
    }
    
    const codes = readDB('discountCodes');
    const discountCode = codes.find(c => c.code === code.toUpperCase() && c.active);
    
    if (!discountCode) {
        return res.status(404).json({ success: false, error: { code: 'CODE_NOT_FOUND', message: 'Invalid or inactive discount code' } });
    }
    
    const PLAN_PRICES = { basic: 10000, pro: 20000, premium: 35000, reseller: 50000 };
    const planPrice = PLAN_PRICES[plan] || 0;
    
    let discountAmount = 0;
    if (discountCode.type === 'percent') {
        discountAmount = Math.floor(planPrice * (discountCode.discount / 100));
    } else {
        discountAmount = discountCode.discount;
    }
    
    res.json({
        success: true,
        data: {
            code: discountCode.code,
            discount: discountAmount,
            type: discountCode.type,
            value: discountCode.discount
        }
    });
});

// ========================================
// ADMIN ROUTES
// ========================================

// Get all users
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    const users = readDB('users');
    const sanitizedUsers = users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        plan: u.plan,
        dailyLimit: u.dailyLimit,
        createdAt: u.createdAt
    }));
    res.json({ success: true, data: sanitizedUsers });
});

// Approve user
app.post('/api/admin/users/:id/approve', authMiddleware, adminMiddleware, (req, res) => {
    const users = readDB('users');
    const user = users.find(u => u.id === req.params.id);
    
    if (!user) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    
    user.status = 'approved';
    user.approvedAt = new Date().toISOString();
    writeDB('users', users);
    
    res.json({ success: true, data: { message: 'User approved' } });
});

// Reject user
app.post('/api/admin/users/:id/reject', authMiddleware, adminMiddleware, (req, res) => {
    const users = readDB('users');
    const user = users.find(u => u.id === req.params.id);
    
    if (!user) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    
    user.status = 'rejected';
    writeDB('users', users);
    
    res.json({ success: true, data: { message: 'User rejected' } });
});

// Suspend user
app.post('/api/admin/users/:id/suspend', authMiddleware, adminMiddleware, (req, res) => {
    const users = readDB('users');
    const user = users.find(u => u.id === req.params.id);
    
    if (!user) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    
    user.status = 'suspended';
    writeDB('users', users);
    
    res.json({ success: true, data: { message: 'User suspended' } });
});

// Get discount codes
app.get('/api/admin/discounts', authMiddleware, adminMiddleware, (req, res) => {
    const codes = readDB('discountCodes');
    res.json({ success: true, data: codes });
});

// Create discount code
app.post('/api/admin/discounts', authMiddleware, adminMiddleware, (req, res) => {
    const { code, discount, type } = req.body;
    
    if (!code || !code.startsWith('GOVAL-')) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Code must start with GOVAL-' } });
    }
    
    const codes = readDB('discountCodes');
    if (codes.find(c => c.code === code.toUpperCase())) {
        return res.status(400).json({ success: false, error: { code: 'CODE_EXISTS', message: 'Code already exists' } });
    }
    
    codes.push({
        code: code.toUpperCase(),
        discount: parseInt(discount),
        type: type || 'percent',
        active: true,
        createdAt: new Date().toISOString()
    });
    writeDB('discountCodes', codes);
    
    res.json({ success: true, data: { message: 'Discount code created' } });
});

// Delete discount code
app.delete('/api/admin/discounts/:code', authMiddleware, adminMiddleware, (req, res) => {
    let codes = readDB('discountCodes');
    codes = codes.filter(c => c.code !== req.params.code.toUpperCase());
    writeDB('discountCodes', codes);
    res.json({ success: true, data: { message: 'Discount code deleted' } });
});

// Toggle discount code
app.patch('/api/admin/discounts/:code', authMiddleware, adminMiddleware, (req, res) => {
    const codes = readDB('discountCodes');
    const code = codes.find(c => c.code === req.params.code.toUpperCase());
    
    if (!code) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Code not found' } });
    }
    
    code.active = !code.active;
    writeDB('discountCodes', codes);
    
    res.json({ success: true, data: { message: `Code ${code.active ? 'activated' : 'deactivated'}` } });
});

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
