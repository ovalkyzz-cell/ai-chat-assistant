/* ========================================
   Chat Logic - Mazval GPT AI
   Uses API Client for all requests
   ======================================== */

// Chat State
const ChatState = {
    chats: [],
    currentChatId: null,
    currentModel: 'chatgpt',
    isGenerating: false,
    currentView: 'chats',
    currentTool: null,
    currentDownloader: null,
    abortController: null
};

// Plan limits
const PRICING_PLANS = {
    free: { dailyLimit: 5, features: ['chatgpt'], imageGen: false, tools: false, downloaders: false },
    basic: { dailyLimit: 100, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: false, tools: true, downloaders: true },
    pro: { dailyLimit: 500, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: true, tools: true, downloaders: true },
    premium: { dailyLimit: -1, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: true, tools: true, downloaders: true },
    reseller: { dailyLimit: -1, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: true, tools: true, downloaders: true }
};

// DOM Elements
let elements = {};

function cacheElements() {
    elements = {
        sidebar: document.getElementById('sidebar'),
        sidebarOverlay: document.getElementById('sidebarOverlay'),
        sidebarToggle: document.getElementById('sidebarToggle'),
        newChatBtn: document.getElementById('newChatBtn'),
        chatList: document.getElementById('chatList'),
        chatContainer: document.getElementById('chatContainer'),
        welcomeScreen: document.getElementById('welcomeScreen'),
        messagesContainer: document.getElementById('messagesContainer'),
        messageInput: document.getElementById('messageInput'),
        sendBtn: document.getElementById('sendBtn'),
        modelSelect: document.getElementById('modelSelect'),
        userName: document.getElementById('userName'),
        logoutBtn: document.getElementById('logoutBtn'),
        userInfo: document.getElementById('userInfo'),
        inputArea: document.getElementById('inputArea'),
        chatsPanel: document.getElementById('chatsPanel'),
        toolsPanel: document.getElementById('toolsPanel'),
        downloadersPanel: document.getElementById('downloadersPanel'),
        toolInterface: document.getElementById('toolInterface'),
        toolTitle: document.getElementById('toolTitle'),
        toolContent: document.getElementById('toolContent'),
        toolResult: document.getElementById('toolResult'),
        backToChat: document.getElementById('backToChat'),
        toolModal: document.getElementById('toolModal'),
        resultModal: document.getElementById('resultModal')
    };
}

// Get Current User
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('mazval_user'));
    } catch {
        return null;
    }
}

// Get Current User's Plan
function getCurrentUserPlan() {
    const user = getCurrentUser();
    if (!user) return 'free';
    if (user.role === 'admin') return 'premium';
    return user.plan || 'free';
}

// Get Plan Limits
function getPlanLimits(plan) {
    return PRICING_PLANS[plan] || PRICING_PLANS.free;
}

// Check Daily Limit
function checkDailyLimit() {
    const plan = getCurrentUserPlan();
    const limits = getPlanLimits(plan);
    if (limits.dailyLimit === -1) return true;
    
    const today = new Date().toDateString();
    const usage = JSON.parse(localStorage.getItem('dailyUsage') || '{}');
    const todayCount = usage[today] || 0;
    return todayCount < limits.dailyLimit;
}

// Increment Daily Usage
function incrementDailyUsage() {
    const today = new Date().toDateString();
    const usage = JSON.parse(localStorage.getItem('dailyUsage') || '{}');
    usage[today] = (usage[today] || 0) + 1;
    
    Object.keys(usage).forEach(date => {
        if (date !== today) delete usage[date];
    });
    
    localStorage.setItem('dailyUsage', JSON.stringify(usage));
}

// Check Model Access
function hasModelAccess(model) {
    const plan = getCurrentUserPlan();
    const limits = getPlanLimits(plan);
    if (plan === 'free') return model === 'chatgpt';
    return limits.features.includes(model);
}

// Check Feature Access
function hasFeatureAccess(feature) {
    const plan = getCurrentUserPlan();
    const limits = getPlanLimits(plan);
    switch (feature) {
        case 'image': return limits.imageGen;
        case 'tools': return limits.tools;
        case 'downloaders': return limits.downloaders;
        default: return false;
    }
}

// Initialize
function init() {
    cacheElements();
    
    // Check auth
    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    // Update UI
    if (elements.userName) {
        elements.userName.textContent = user.name || user.email.split('@')[0];
    }
    
    setupEventListeners();
    setupSidebarNav();
    setupTools();
    setupDownloaders();
    loadConversations();
    setupModelSelector();
}

// Setup Event Listeners
function setupEventListeners() {
    if (elements.sidebarToggle) {
        elements.sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    if (elements.newChatBtn) {
        elements.newChatBtn.addEventListener('click', () => {
            showChatView();
            createNewChat();
        });
    }
    
    if (elements.messageInput) {
        elements.messageInput.addEventListener('input', handleInputChange);
        elements.messageInput.addEventListener('keydown', handleKeyDown);
    }
    
    if (elements.sendBtn) {
        elements.sendBtn.addEventListener('click', sendMessage);
    }
    
    if (elements.backToChat) {
        elements.backToChat.addEventListener('click', showChatView);
    }
    
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Suggestion cards
    document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            const prompt = card.dataset.prompt;
            if (elements.messageInput) {
                elements.messageInput.value = prompt;
                handleInputChange();
                sendMessage();
            }
        });
    });
}

// Setup Sidebar Navigation
function setupSidebarNav() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            hideAllPanels();
            switch (tabName) {
                case 'chats':
                    elements.chatsPanel?.classList.remove('hidden');
                    ChatState.currentView = 'chats';
                    break;
                case 'tools':
                    elements.toolsPanel?.classList.remove('hidden');
                    ChatState.currentView = 'tools';
                    break;
                case 'downloaders':
                    elements.downloadersPanel?.classList.remove('hidden');
                    ChatState.currentView = 'downloaders';
                    break;
            }
        });
    });
}

function hideAllPanels() {
    elements.chatsPanel?.classList.add('hidden');
    elements.toolsPanel?.classList.add('hidden');
    elements.downloadersPanel?.classList.add('hidden');
}

// Setup Tools
function setupTools() {
    document.querySelectorAll('.tool-item[data-tool]').forEach(item => {
        item.addEventListener('click', () => openTool(item.dataset.tool));
    });
}

// Setup Downloaders
function setupDownloaders() {
    document.querySelectorAll('.tool-item[data-downloader]').forEach(item => {
        item.addEventListener('click', () => openDownloader(item.dataset.downloader));
    });
}

// Toggle Sidebar
function toggleSidebar() {
    elements.sidebar?.classList.toggle('collapsed');
    elements.sidebarOverlay?.classList.toggle('active');
}

function closeSidebar() {
    elements.sidebar?.classList.add('collapsed');
    elements.sidebarOverlay?.classList.remove('active');
}

// Show Chat View
function showChatView() {
    elements.welcomeScreen?.classList.remove('hidden');
    elements.messagesContainer?.classList.add('hidden');
    elements.toolInterface?.classList.add('hidden');
    elements.inputArea?.classList.remove('hidden');
    ChatState.currentTool = null;
    ChatState.currentDownloader = null;
}

// Load Conversations from API
async function loadConversations() {
    try {
        const data = await API.getConversations();
        if (data.success) {
            ChatState.chats = data.data;
            renderChatList();
        }
    } catch (error) {
        console.error('Failed to load conversations:', error);
    }
}

// Render Chat List
function renderChatList() {
    if (!elements.chatList) return;
    elements.chatList.innerHTML = '';
    
    ChatState.chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${chat.id === ChatState.currentChatId ? 'active' : ''}`;
        chatItem.innerHTML = `
            <i class="fas fa-message chat-item-icon"></i>
            <span class="chat-item-text">${escapeHtml(chat.title)}</span>
            <button class="chat-item-delete" data-id="${chat.id}">
                <i class="fas fa-trash"></i>
            </button>
        `;
        
        chatItem.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-item-delete')) {
                loadChat(chat.id);
            }
        });
        
        chatItem.querySelector('.chat-item-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });
        
        elements.chatList.appendChild(chatItem);
    });
}

// Create New Chat
async function createNewChat() {
    try {
        const data = await API.createConversation('New Chat', ChatState.currentModel);
        if (data.success) {
            ChatState.currentChatId = data.data.id;
            ChatState.chats.unshift(data.data);
            renderChatList();
            showWelcomeScreen();
        }
    } catch (error) {
        console.error('Failed to create conversation:', error);
    }
}

// Load Chat
async function loadChat(chatId) {
    try {
        const data = await API.getConversation(chatId);
        if (data.success) {
            ChatState.currentChatId = chatId;
            renderChatList();
            showChatView();
            renderMessages(data.data.messages);
            hideWelcomeScreen();
        }
    } catch (error) {
        console.error('Failed to load conversation:', error);
    }
}

// Delete Chat
async function deleteChat(chatId) {
    try {
        await API.deleteConversation(chatId);
        ChatState.chats = ChatState.chats.filter(c => c.id !== chatId);
        if (ChatState.currentChatId === chatId) {
            ChatState.currentChatId = null;
            showWelcomeScreen();
        }
        renderChatList();
    } catch (error) {
        console.error('Failed to delete conversation:', error);
    }
}

// Show/Hide Welcome Screen
function showWelcomeScreen() {
    elements.welcomeScreen?.classList.remove('hidden');
    elements.messagesContainer?.classList.add('hidden');
}

function hideWelcomeScreen() {
    elements.welcomeScreen?.classList.add('hidden');
    elements.messagesContainer?.classList.remove('hidden');
}

// Handle Input Change
function handleInputChange() {
    const input = elements.messageInput;
    if (!input) return;
    
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
    
    const hasText = input.value.trim().length > 0;
    elements.sendBtn.disabled = !hasText || ChatState.isGenerating;
}

// Handle Key Down
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// Send Message
async function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message || ChatState.isGenerating) return;
    
    // Check daily limit
    if (!checkDailyLimit()) {
        showError('Daily message limit reached. Please upgrade your plan.');
        return;
    }
    
    // Check model access
    if (!hasModelAccess(ChatState.currentModel)) {
        showError(`You don't have access to ${ChatState.currentModel}. Please upgrade your plan.`);
        return;
    }
    
    // Create new chat if none exists
    if (!ChatState.currentChatId) {
        await createNewChat();
    }
    
    // Add user message to UI
    const userMessage = {
        role: 'user',
        content: message,
        createdAt: new Date().toISOString()
    };
    
    hideWelcomeScreen();
    appendMessage(userMessage);
    
    // Clear input
    elements.messageInput.value = '';
    handleInputChange();
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        ChatState.isGenerating = true;
        elements.sendBtn.disabled = true;
        
        // Send to API
        const data = await API.sendMessage(ChatState.currentChatId, message, ChatState.currentModel);
        
        hideTypingIndicator();
        
        if (data.success) {
            // Add AI message to UI
            appendMessage(data.data.message);
            
            // Update conversation title if needed
            if (data.data.conversation) {
                const chatIndex = ChatState.chats.findIndex(c => c.id === data.data.conversation.id);
                if (chatIndex !== -1) {
                    ChatState.chats[chatIndex].title = data.data.conversation.title;
                    renderChatList();
                }
            }
            
            // Increment usage
            incrementDailyUsage();
        }
    } catch (error) {
        hideTypingIndicator();
        console.error('Chat error:', error);
        showError(error.error?.message || 'Failed to get response. Please try again.');
    } finally {
        ChatState.isGenerating = false;
        elements.sendBtn.disabled = false;
    }
}

// Append Message
function appendMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`;
    
    const avatarIcon = message.role === 'user' ? 'fa-user' : 'fa-robot';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas ${avatarIcon}"></i>
        </div>
        <div class="message-content">
            <div class="message-text">${formatMessage(message.content)}</div>
        </div>
    `;
    
    elements.messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    
    // Apply syntax highlighting
    messageDiv.querySelectorAll('pre code').forEach(block => {
        if (typeof hljs !== 'undefined') hljs.highlightElement(block);
    });
    
    // Add copy functionality
    messageDiv.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', handleCopyCode);
    });
}

// Render Messages
function renderMessages(messages) {
    elements.messagesContainer.innerHTML = '';
    messages.forEach(msg => appendMessage(msg));
}

// Format Message
function formatMessage(text) {
    if (!text) return '';
    
    let formatted = escapeHtml(text);
    
    // Code blocks
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'plaintext';
        return `<div class="code-block"><div class="code-header"><span class="language">${language}</span><button class="copy-btn"><i class="fas fa-copy"></i><span>Copy</span></button></div><pre><code class="language-${language}">${code.trim()}</code></pre></div>`;
    });
    
    formatted = formatted.replace(/```\n?([\s\S]*?)```/g, (match, code) => {
        return `<div class="code-block"><div class="code-header"><span class="language">plaintext</span><button class="copy-btn"><i class="fas fa-copy"></i><span>Copy</span></button></div><pre><code class="language-plaintext">${code.trim()}</code></pre></div>`;
    });
    
    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Headers
    formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    // Links
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle Copy Code
function handleCopyCode(e) {
    const btn = e.currentTarget;
    const codeBlock = btn.closest('.code-block');
    const code = codeBlock.querySelector('code').textContent;
    
    navigator.clipboard.writeText(code).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '<i class="fas fa-check"></i><span>Copied!</span>';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<i class="fas fa-copy"></i><span>Copy</span>';
        }, 2000);
    });
}

// Typing Indicator
function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message assistant-message';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="message-avatar"><i class="fas fa-robot"></i></div>
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    elements.messagesContainer.appendChild(indicator);
    scrollToBottom();
}

function hideTypingIndicator() {
    document.getElementById('typingIndicator')?.remove();
}

// Show Error
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i><span>${message}</span>`;
    elements.messagesContainer.appendChild(errorDiv);
    scrollToBottom();
    setTimeout(() => errorDiv.remove(), 5000);
}

// Scroll to Bottom
function scrollToBottom() {
    if (elements.chatContainer) {
        elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
    }
}

// Logout
async function handleLogout(e) {
    e.preventDefault();
    try {
        await API.logout();
    } catch (error) {
        console.error('Logout error:', error);
    }
    localStorage.removeItem('mazval_user');
    localStorage.removeItem('mazval_token');
    window.location.href = 'login.html';
}

// ========================================
// Tools Functions
// ========================================

function openTool(toolName) {
    ChatState.currentTool = toolName;
    ChatState.currentDownloader = null;
    
    elements.welcomeScreen?.classList.add('hidden');
    elements.messagesContainer?.classList.add('hidden');
    elements.inputArea?.classList.add('hidden');
    elements.toolInterface?.classList.remove('hidden');
    
    const toolTitles = {
        'cek-nomor': 'Cek Nomor Telepon',
        'otp': 'OTP Generator',
        'ssweb': 'Screenshot Website',
        'translate': 'Translate Text'
    };
    elements.toolTitle.textContent = toolTitles[toolName] || 'Tool';
    
    renderToolForm(toolName);
}

function renderToolForm(toolName) {
    let formHTML = '';
    
    switch (toolName) {
        case 'cek-nomor':
            formHTML = `
                <div class="tool-content">
                    <h3><i class="fas fa-phone-alt"></i> Cek Nomor Telepon</h3>
                    <p style="color: var(--text-muted); margin-bottom: 16px;">Masukkan nomor telepon untuk mengecek informasinya.</p>
                    <div class="tool-form">
                        <div class="form-group">
                            <label>Nomor Telepon</label>
                            <input type="text" id="cekNomorInput" placeholder="Contoh: 081234567890">
                        </div>
                        <button class="tool-execute-btn" onclick="executeCekNomor()">
                            <i class="fas fa-search"></i> Cek Nomor
                        </button>
                    </div>
                </div>
            `;
            break;
        case 'otp':
            formHTML = `
                <div class="tool-content">
                    <h3><i class="fas fa-key"></i> OTP Generator</h3>
                    <p style="color: var(--text-muted); margin-bottom: 16px;">Generate OTP untuk berbagai keperluan.</p>
                    <div class="tool-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Tipe OTP</label>
                                <select id="otpType">
                                    <option value="otps">OTPS (Alphabet)</option>
                                    <option value="numbers">Numbers Only</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Jumlah</label>
                                <input type="number" id="otpLimit" value="20" min="1" max="100">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Negara</label>
                            <select id="otpCountry">
                                <option value="indonesia">Indonesia</option>
                                <option value="us">United States</option>
                                <option value="uk">United Kingdom</option>
                            </select>
                        </div>
                        <button class="tool-execute-btn" onclick="executeOTP()">
                            <i class="fas fa-random"></i> Generate OTP
                        </button>
                    </div>
                </div>
            `;
            break;
        case 'ssweb':
            formHTML = `
                <div class="tool-content">
                    <h3><i class="fas fa-camera"></i> Screenshot Website</h3>
                    <p style="color: var(--text-muted); margin-bottom: 16px;">Ambil screenshot dari website.</p>
                    <div class="tool-form">
                        <div class="form-group">
                            <label>URL Website</label>
                            <input type="url" id="sswebUrl" placeholder="https://example.com">
                        </div>
                        <button class="tool-execute-btn" onclick="executeSSWeb()">
                            <i class="fas fa-camera"></i> Screenshot
                        </button>
                    </div>
                </div>
            `;
            break;
        case 'translate':
            formHTML = `
                <div class="tool-content">
                    <h3><i class="fas fa-language"></i> Translate Text</h3>
                    <p style="color: var(--text-muted); margin-bottom: 16px;">Terjemahkan teks ke bahasa lain.</p>
                    <div class="tool-form">
                        <div class="form-group">
                            <label>Teks</label>
                            <textarea id="translateText" rows="3" placeholder="Masukkan teks yang akan diterjemahkan"></textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Dari Bahasa</label>
                                <select id="translateFrom">
                                    <option value="auto">Auto Detect</option>
                                    <option value="id">Indonesia</option>
                                    <option value="en">English</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Ke Bahasa</label>
                                <select id="translateTo">
                                    <option value="en">English</option>
                                    <option value="id">Indonesia</option>
                                </select>
                            </div>
                        </div>
                        <button class="tool-execute-btn" onclick="executeTranslate()">
                            <i class="fas fa-language"></i> Translate
                        </button>
                    </div>
                </div>
            `;
            break;
    }
    
    elements.toolContent.innerHTML = formHTML;
    elements.toolResult.innerHTML = '';
}

// Execute Tools
async function executeCekNomor() {
    const nomor = document.getElementById('cekNomorInput')?.value.trim();
    if (!nomor) { alert('Masukkan nomor telepon!'); return; }
    
    showToolLoading();
    try {
        const data = await API.cekNomor(nomor);
        displayToolResult(data.data, 'Cek Nomor');
    } catch (error) {
        showToolError(error.error?.message || 'Gagal mengecek nomor');
    }
}

async function executeOTP() {
    const type = document.getElementById('otpType')?.value || 'otps';
    const limit = document.getElementById('otpLimit')?.value || '20';
    const country = document.getElementById('otpCountry')?.value || 'indonesia';
    
    showToolLoading();
    try {
        const data = await API.generateOTP(type, limit, country);
        displayToolResult(data.data, 'OTP Generator');
    } catch (error) {
        showToolError(error.error?.message || 'Gagal generate OTP');
    }
}

async function executeSSWeb() {
    const url = document.getElementById('sswebUrl')?.value.trim();
    if (!url) { alert('Masukkan URL website!'); return; }
    
    showToolLoading();
    try {
        const data = await API.screenshotWeb(url);
        displayToolResult(data.data, 'Screenshot');
    } catch (error) {
        showToolError(error.error?.message || 'Gagal screenshot');
    }
}

async function executeTranslate() {
    const text = document.getElementById('translateText')?.value.trim();
    const from = document.getElementById('translateFrom')?.value || 'auto';
    const to = document.getElementById('translateTo')?.value || 'en';
    
    if (!text) { alert('Masukkan teks!'); return; }
    
    showToolLoading();
    try {
        const data = await API.translate(text, to, from);
        displayToolResult(data.data, 'Translate');
    } catch (error) {
        showToolError(error.error?.message || 'Gagal translate');
    }
}

function showToolLoading() {
    elements.toolResult.innerHTML = `
        <div class="tool-result">
            <div class="loading-overlay" style="position: relative; min-height: 100px;">
                <div class="spinner"></div>
                <span class="loading-text">Processing...</span>
            </div>
        </div>
    `;
}

function showToolError(message) {
    elements.toolResult.innerHTML = `
        <div class="tool-result">
            <div class="tool-result-header">
                <h3><i class="fas fa-exclamation-circle" style="color: var(--danger);"></i> Error</h3>
            </div>
            <div class="tool-result-content">
                <p>${message}</p>
            </div>
        </div>
    `;
}

function displayToolResult(data, title) {
    let contentHTML = '';
    
    if (data.url) {
        contentHTML = `<div class="media-preview"><img src="${data.url}" alt="${title}" onerror="this.parentElement.innerHTML='<p>Failed to load</p>'"></div>`;
    } else if (data.translation || data.translated || data.result) {
        contentHTML = `<p style="font-size: 1.1rem; line-height: 1.6;">${data.translation || data.translated || data.result}</p>`;
    } else if (Array.isArray(data) || data.otp || data.otps || data.numbers) {
        const otps = data.otp || data.otps || data.numbers || data;
        if (Array.isArray(otps)) {
            contentHTML = `<div class="otp-grid">${otps.map(otp => `<div class="otp-item" onclick="navigator.clipboard.writeText('${otp}')">${otp}</div>`).join('')}</div>`;
        }
    } else if (data.nomor || data.number) {
        contentHTML = `<div class="info-card"><p><strong>Nomor:</strong> ${data.nomor || data.number}</p><p><strong>Operator:</strong> ${data.operator || '-'}</p></div>`;
    } else {
        contentHTML = `<pre style="white-space: pre-wrap;">${JSON.stringify(data, null, 2)}</pre>`;
    }
    
    elements.toolResult.innerHTML = `
        <div class="tool-result">
            <div class="tool-result-header">
                <h3><i class="fas fa-check-circle"></i> ${title} Result</h3>
            </div>
            <div class="tool-result-content">${contentHTML}</div>
        </div>
    `;
}

// ========================================
// Downloaders Functions
// ========================================

function openDownloader(downloaderName) {
    ChatState.currentDownloader = downloaderName;
    ChatState.currentTool = null;
    
    elements.welcomeScreen?.classList.add('hidden');
    elements.messagesContainer?.classList.add('hidden');
    elements.inputArea?.classList.add('hidden');
    elements.toolInterface?.classList.remove('hidden');
    
    const downloaderTitles = {
        'instagram': 'Instagram Downloader',
        'facebook': 'Facebook Downloader',
        'tiktok': 'TikTok Downloader',
        'twitter': 'Twitter/X Downloader',
        'youtube': 'YouTube Downloader',
        'youtube-mp3': 'YouTube MP3 Downloader',
        'spotify': 'Spotify Downloader',
        'safefileku': 'SafeFileKu Downloader'
    };
    elements.toolTitle.textContent = downloaderTitles[downloaderName] || 'Downloader';
    
    const icons = {
        'instagram': 'fab fa-instagram',
        'facebook': 'fab fa-facebook',
        'tiktok': 'fab fa-tiktok',
        'twitter': 'fab fa-twitter',
        'youtube': 'fab fa-youtube',
        'youtube-mp3': 'fas fa-music',
        'spotify': 'fab fa-spotify',
        'safefileku': 'fas fa-file-download'
    };
    
    elements.toolContent.innerHTML = `
        <div class="tool-content">
            <h3><i class="${icons[downloaderName]}"></i> ${downloaderTitles[downloaderName]}</h3>
            <p style="color: var(--text-muted); margin-bottom: 16px;">Masukkan URL yang ingin didownload.</p>
            <div class="tool-form">
                <div class="form-group">
                    <label>URL</label>
                    <input type="url" id="downloaderUrl" placeholder="Masukkan URL...">
                </div>
                <button class="tool-execute-btn" onclick="executeDownloader()">
                    <i class="fas fa-download"></i> Download
                </button>
            </div>
        </div>
    `;
    elements.toolResult.innerHTML = '';
}

async function executeDownloader() {
    const url = document.getElementById('downloaderUrl')?.value.trim();
    if (!url) { alert('Masukkan URL!'); return; }
    
    showToolLoading();
    try {
        const data = await API.download(ChatState.currentDownloader, url);
        displayToolResult(data.data, 'Download');
    } catch (error) {
        showToolError(error.error?.message || 'Gagal download');
    }
}

// ========================================
// Custom Model Selector
// ========================================

function setupModelSelector() {
    const selector = document.getElementById('modelSelector');
    const current = document.getElementById('modelCurrent');
    const dropdown = document.getElementById('modelDropdown');
    const options = document.querySelectorAll('.model-option');
    const hiddenSelect = document.getElementById('modelSelect');
    
    if (!selector || !current || !dropdown) return;
    
    current.addEventListener('click', (e) => {
        e.stopPropagation();
        selector.classList.toggle('open');
    });
    
    document.addEventListener('click', (e) => {
        if (!selector.contains(e.target)) {
            selector.classList.remove('open');
        }
    });
    
    options.forEach(option => {
        option.addEventListener('click', () => {
            const model = option.dataset.model;
            const name = option.querySelector('span:last-child').textContent;
            const icon = option.querySelector('.model-icon i').className;
            
            options.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            
            current.querySelector('.model-name').textContent = name;
            current.querySelector('.model-icon i').className = icon;
            
            if (hiddenSelect) {
                hiddenSelect.value = model;
                hiddenSelect.dispatchEvent(new Event('change'));
            }
            
            ChatState.currentModel = model;
            selector.classList.remove('open');
        });
    });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', init);
