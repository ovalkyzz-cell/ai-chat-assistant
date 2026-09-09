/* ========================================
   AI Chat Assistant - Main Chat Logic
   ======================================== */

// API Endpoints
const API_ENDPOINTS = {
    // AI Models
    chatgpt: 'https://www.keyrafara.com/ai/chatgpt',
    gemini: 'https://www.keyrafara.com/ai/gemini',
    copilot: 'https://www.keyrafara.com/ai/copilot',
    apertus: 'https://www.keyrafara.com/ai/apertus',
    'claude-opus': 'https://www.keyrafara.com/ai/claude-opus',
    mistral: 'https://www.keyrafara.com/ai/mistral',
    felo: 'https://www.keyrafara.com/ai/felo',
    turboseek: 'https://www.keyrafara.com/ai/turboseek',
    image: 'https://www.keyrafara.com/ai/image'
};

// Tools Endpoints
const TOOLS_ENDPOINTS = {
    'cek-nomor': 'https://www.keyrafara.com/tools/cek-nomor',
    otp: 'https://www.keyrafara.com/tools/otp',
    ssweb: 'https://www.keyrafara.com/tools/ssweb',
    translate: 'https://www.keyrafara.com/tools/translate'
};

// Downloader Endpoints
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

// Chat State
const ChatState = {
    chats: [],
    currentChatId: null,
    currentModel: 'chatgpt',
    isGenerating: false,
    currentView: 'chats', // chats, tools, downloaders
    currentTool: null,
    currentDownloader: null
};

// ========================================
// Subscription & Rate Limiting
// ========================================

// Pricing Plans Configuration (loaded from localStorage or default)
const PRICING_PLANS = {
    free: { dailyLimit: 5, features: ['chatgpt'], imageGen: false, tools: false, downloaders: false },
    basic: { dailyLimit: 100, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: false, tools: true, downloaders: true },
    pro: { dailyLimit: 500, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: true, tools: true, downloaders: true },
    premium: { dailyLimit: -1, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: true, tools: true, downloaders: true },
    reseller: { dailyLimit: -1, features: ['chatgpt', 'gemini', 'copilot', 'apertus', 'claude-opus', 'mistral', 'felo', 'turboseek'], imageGen: true, tools: true, downloaders: true }
};

// Get Current User's Plan
function getCurrentUserPlan() {
    const currentUser = JSON.parse(localStorage.getItem('mazval_user'));
    if (!currentUser) return 'free';
    
    // Admin has full access
    if (currentUser.role === 'admin') return 'premium';
    
    return currentUser.plan || 'free';
}

// Get Plan Limits
function getPlanLimits(plan) {
    // Load admin-configured pricing if available
    const savedPricing = localStorage.getItem('pricingConfig');
    if (savedPricing) {
        const config = JSON.parse(savedPricing);
        if (config[plan]) {
            return {
                dailyLimit: config[plan].dailyLimit,
                features: PRICING_PLANS[plan]?.features || [],
                imageGen: PRICING_PLANS[plan]?.imageGen || false,
                tools: PRICING_PLANS[plan]?.tools || false,
                downloaders: PRICING_PLANS[plan]?.downloaders || false
            };
        }
    }
    return PRICING_PLANS[plan] || PRICING_PLANS.free;
}

// Check Daily Message Limit
function checkDailyLimit() {
    const plan = getCurrentUserPlan();
    const limits = getPlanLimits(plan);
    
    // Unlimited for premium and reseller
    if (limits.dailyLimit === -1) return true;
    
    // Get today's message count
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
    
    // Clean up old entries
    Object.keys(usage).forEach(date => {
        if (date !== today) {
            delete usage[date];
        }
    });
    
    localStorage.setItem('dailyUsage', JSON.stringify(usage));
}

// Get Daily Usage Info
function getDailyUsageInfo() {
    const plan = getCurrentUserPlan();
    const limits = getPlanLimits(plan);
    const today = new Date().toDateString();
    const usage = JSON.parse(localStorage.getItem('dailyUsage') || '{}');
    const used = usage[today] || 0;
    const limit = limits.dailyLimit;
    
    return { used, limit, plan, isUnlimited: limit === -1 };
}

// Check if User Has Feature Access
function hasFeatureAccess(feature) {
    const plan = getCurrentUserPlan();
    const limits = getPlanLimits(plan);
    
    switch (feature) {
        case 'image':
            return limits.imageGen;
        case 'tools':
            return limits.tools;
        case 'downloaders':
            return limits.downloaders;
        case 'models':
            return limits.features;
        default:
            return false;
    }
}

// Check Model Access
function hasModelAccess(model) {
    const plan = getCurrentUserPlan();
    const limits = getPlanLimits(plan);
    
    // Free plan only has chatgpt
    if (plan === 'free') {
        return model === 'chatgpt';
    }
    
    return limits.features.includes(model);
}

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

// Initialize App
function init() {
    cacheElements();
    loadUserData();
    loadChats();
    setupEventListeners();
    setupSidebarNav();
    setupTools();
    setupDownloaders();
    autoResizeTextarea();
}

// Load User Data
function loadUserData() {
    const currentUser = JSON.parse(localStorage.getItem('mazval_user'));
    if (currentUser && elements.userName) {
        elements.userName.textContent = currentUser.name || currentUser.email.split('@')[0];
    }
}

// Load Chats from localStorage
function loadChats() {
    const savedChats = localStorage.getItem('chats');
    if (savedChats) {
        ChatState.chats = JSON.parse(savedChats);
    }
    renderChatList();
}

// Save Chats to localStorage
function saveChats() {
    localStorage.setItem('chats', JSON.stringify(ChatState.chats));
}

// Setup Event Listeners
function setupEventListeners() {
    // Sidebar Toggle
    if (elements.sidebarToggle) {
        elements.sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // Sidebar Overlay
    if (elements.sidebarOverlay) {
        elements.sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // New Chat
    if (elements.newChatBtn) {
        elements.newChatBtn.addEventListener('click', () => {
            showChatView();
            createNewChat();
        });
    }

    // Message Input
    if (elements.messageInput) {
        elements.messageInput.addEventListener('input', handleInputChange);
        elements.messageInput.addEventListener('keydown', handleKeyDown);
    }

    // Send Button
    if (elements.sendBtn) {
        elements.sendBtn.addEventListener('click', sendMessage);
    }

    // Model Select
    if (elements.modelSelect) {
        elements.modelSelect.addEventListener('change', handleModelChange);
    }

    // Custom Model Selector Dropdown
    setupModelSelector();

    // Suggestion Cards
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

    // Back to Chat
    if (elements.backToChat) {
        elements.backToChat.addEventListener('click', showChatView);
    }

    // Modal Close Buttons
    document.getElementById('closeToolModal')?.addEventListener('click', closeToolModal);
    document.getElementById('cancelToolModal')?.addEventListener('click', closeToolModal);
    document.getElementById('closeResultModal')?.addEventListener('click', closeResultModal);

    // Execute Tool Button
    document.getElementById('executeTool')?.addEventListener('click', executeCurrentTool);

    // Logout
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', handleLogout);
    }
}

// Setup Sidebar Navigation
function setupSidebarNav() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // Update active tab
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding panel
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

// Hide All Panels
function hideAllPanels() {
    elements.chatsPanel?.classList.add('hidden');
    elements.toolsPanel?.classList.add('hidden');
    elements.downloadersPanel?.classList.add('hidden');
}

// Setup Tools
function setupTools() {
    document.querySelectorAll('.tool-item[data-tool]').forEach(item => {
        item.addEventListener('click', () => {
            const toolName = item.dataset.tool;
            openTool(toolName);
        });
    });
}

// Setup Downloaders
function setupDownloaders() {
    document.querySelectorAll('.tool-item[data-downloader]').forEach(item => {
        item.addEventListener('click', () => {
            const downloaderName = item.dataset.downloader;
            openDownloader(downloaderName);
        });
    });
}

// Toggle Sidebar
function toggleSidebar() {
    elements.sidebar.classList.toggle('collapsed');
    elements.sidebarOverlay?.classList.toggle('active');
}

// Close Sidebar (mobile)
function closeSidebar() {
    elements.sidebar.classList.add('collapsed');
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

// Create New Chat
function createNewChat() {
    const chatId = Date.now().toString();
    const newChat = {
        id: chatId,
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString(),
        model: ChatState.currentModel
    };

    ChatState.chats.unshift(newChat);
    ChatState.currentChatId = chatId;
    saveChats();
    renderChatList();
    showWelcomeScreen();
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

        const deleteBtn = chatItem.querySelector('.chat-item-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });

        elements.chatList.appendChild(chatItem);
    });
}

// Load Chat
function loadChat(chatId) {
    ChatState.currentChatId = chatId;
    const chat = ChatState.chats.find(c => c.id === chatId);
    
    if (chat) {
        renderChatList();
        showChatView();
        renderMessages(chat.messages);
        hideWelcomeScreen();
    }
}

// Delete Chat
function deleteChat(chatId) {
    ChatState.chats = ChatState.chats.filter(c => c.id !== chatId);
    
    if (ChatState.currentChatId === chatId) {
        ChatState.currentChatId = null;
        showWelcomeScreen();
    }
    
    saveChats();
    renderChatList();
}

// Show Welcome Screen
function showWelcomeScreen() {
    elements.welcomeScreen?.classList.remove('hidden');
    elements.messagesContainer?.classList.add('hidden');
}

// Hide Welcome Screen
function hideWelcomeScreen() {
    elements.welcomeScreen?.classList.add('hidden');
    elements.messagesContainer?.classList.remove('hidden');
}

// Handle Input Change
function handleInputChange() {
    const input = elements.messageInput;
    if (!input) return;

    // Auto resize
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';

    // Enable/disable send button
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

// Handle Model Change
function handleModelChange(e) {
    ChatState.currentModel = e.target.value;
}

// Send Message
async function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message || ChatState.isGenerating) return;

    // Check daily limit
    if (!checkDailyLimit()) {
        const usageInfo = getDailyUsageInfo();
        showError(`Daily message limit reached! You've used ${usageInfo.used}/${usageInfo.limit} messages today. Please upgrade your plan.`);
        return;
    }

    // Check model access
    if (!hasModelAccess(ChatState.currentModel)) {
        showError(`You don't have access to ${ChatState.currentModel}. Please upgrade your plan.`);
        return;
    }

    // Check image generation access
    if (ChatState.currentModel === 'image' && !hasFeatureAccess('image')) {
        showError('Image generation is only available for Pro and Premium plans. Please upgrade your plan.');
        return;
    }

    // Create new chat if none exists
    if (!ChatState.currentChatId) {
        createNewChat();
    }

    // Add user message
    const userMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
    };

    const currentChat = ChatState.chats.find(c => c.id === ChatState.currentChatId);
    if (currentChat) {
        currentChat.messages.push(userMessage);
        
        // Update chat title from first message
        if (currentChat.messages.length === 1) {
            currentChat.title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
            renderChatList();
        }
    }

    // Render user message
    hideWelcomeScreen();
    appendMessage(userMessage);
    
    // Clear input
    elements.messageInput.value = '';
    handleInputChange();

    // Show typing indicator
    showTypingIndicator();

    // Get AI response
    try {
        ChatState.isGenerating = true;
        elements.sendBtn.disabled = true;

        const response = await getAIResponse(message);
        
        // Increment daily usage
        incrementDailyUsage();
        
        // Hide typing indicator
        hideTypingIndicator();

        // Add AI message
        const aiMessage = {
            role: 'assistant',
            content: response.text || response,
            timestamp: new Date().toISOString(),
            model: ChatState.currentModel,
            isImage: response.isImage || false,
            imageUrl: response.imageUrl || null
        };

        if (currentChat) {
            currentChat.messages.push(aiMessage);
            saveChats();
        }

        // Render AI message
        appendMessage(aiMessage);

    } catch (error) {
        hideTypingIndicator();
        showError('Failed to get response. Please try again.');
        console.error('AI Response Error:', error);
    } finally {
        ChatState.isGenerating = false;
        elements.sendBtn.disabled = false;
    }
}

// Get AI Response from API
async function getAIResponse(query) {
    const model = ChatState.currentModel;
    const endpoint = API_ENDPOINTS[model];

    if (!endpoint) {
        throw new Error('Invalid model selected');
    }

    let url;
    if (model === 'chatgpt') {
        url = `${endpoint}?query=${encodeURIComponent(query)}&model=auto`;
    } else if (model === 'image') {
        // Image generation
        url = `${endpoint}?prompt=${encodeURIComponent(query)}&model=flux`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        
        // Handle image response
        if (data.url) {
            return { text: `Generated image for: "${query}"`, isImage: true, imageUrl: data.url };
        }
        if (data.image) {
            return { text: `Generated image for: "${query}"`, isImage: true, imageUrl: data.image };
        }
        return { text: 'Failed to generate image', isImage: false };
    } else {
        url = `${endpoint}?text=${encodeURIComponent(query)}`;
    }

    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract natural text from API response
    let text = '';
    
    // Try to get the most natural response text
    if (data.response && typeof data.response === 'string') {
        text = data.response;
    } else if (data.answer && typeof data.answer === 'string') {
        text = data.answer;
    } else if (data.text && typeof data.text === 'string') {
        text = data.text;
    } else if (data.message && typeof data.message === 'string') {
        text = data.message;
    } else if (data.content && typeof data.content === 'string') {
        text = data.content;
    } else if (data.result && typeof data.result === 'string') {
        text = data.result;
    } else if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
        // Handle OpenAI-style responses
        text = data.choices[0].message?.content || data.choices[0].text || '';
    } else if (data.candidates && Array.isArray(data.candidates) && data.candidates.length > 0) {
        // Handle Gemini-style responses
        text = data.candidates[0].content?.parts?.[0]?.text || '';
    } else if (typeof data === 'string') {
        text = data;
    } else if (typeof data === 'object') {
        // If it's an object, try to find the first string value that looks like a response
        const stringValues = Object.values(data).filter(v => typeof v === 'string' && v.length > 5);
        if (stringValues.length > 0) {
            text = stringValues[0];
        } else {
            // Last resort: try to extract any meaningful text
            text = 'I received your message but couldn\'t generate a proper response. Please try again.';
        }
    }
    
    // Clean up the response text
    text = text.trim();
    
    // If text is still empty or looks like JSON, provide a fallback
    if (!text || text.startsWith('{') || text.startsWith('[')) {
        text = 'I received your message. How can I help you further?';
    }
    
    return { text, isImage: false };
}

// Append Message to Container
function appendMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`;

    const avatarIcon = message.role === 'user' ? 'fa-user' : 'fa-robot';
    
    let contentHTML = '';
    
    // Check if it's an image message
    if (message.isImage && message.imageUrl) {
        contentHTML = `
            <div class="message-text">${formatMessage(message.content)}</div>
            <div class="media-preview">
                <img src="${message.imageUrl}" alt="Generated Image" onerror="this.parentElement.innerHTML='<p>Failed to load image</p>'">
            </div>
        `;
    } else {
        contentHTML = `<div class="message-text">${formatMessage(message.content)}</div>`;
    }
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas ${avatarIcon}"></i>
        </div>
        <div class="message-content">
            ${contentHTML}
        </div>
    `;

    elements.messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    scrollToBottom();

    // Apply syntax highlighting to code blocks
    messageDiv.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
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

// Format Message (Simple Markdown)
function formatMessage(text) {
    if (!text) return '';

    // Escape HTML first
    let formatted = escapeHtml(text);

    // Code blocks with language
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang || 'plaintext';
        return `
            <div class="code-block">
                <div class="code-header">
                    <span class="language">${language}</span>
                    <button class="copy-btn">
                        <i class="fas fa-copy"></i>
                        <span>Copy</span>
                    </button>
                </div>
                <pre><code class="language-${language}">${code.trim()}</code></pre>
            </div>
        `;
    });

    // Code blocks without language
    formatted = formatted.replace(/```\n?([\s\S]*?)```/g, (match, code) => {
        return `
            <div class="code-block">
                <div class="code-header">
                    <span class="language">plaintext</span>
                    <button class="copy-btn">
                        <i class="fas fa-copy"></i>
                        <span>Copy</span>
                    </button>
                </div>
                <pre><code class="language-plaintext">${code.trim()}</code></pre>
            </div>
        `;
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

    // Horizontal rule
    formatted = formatted.replace(/^---$/gm, '<hr>');

    // Blockquotes
    formatted = formatted.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // Unordered lists
    formatted = formatted.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Ordered lists
    formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Links
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    // Clean up multiple line breaks
    formatted = formatted.replace(/(<br>){3,}/g, '<br><br>');

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

// Show Typing Indicator
function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message assistant-message';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-robot"></i>
        </div>
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

// Hide Typing Indicator
function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Show Error
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
    `;
    elements.messagesContainer.appendChild(errorDiv);
    scrollToBottom();

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Scroll to Bottom
function scrollToBottom() {
    if (elements.chatContainer) {
        elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
    }
}

// Auto Resize Textarea
function autoResizeTextarea() {
    if (elements.messageInput) {
        elements.messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        });
    }
}

// Handle Logout
function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem('mazval_user');
    window.location.href = 'login.html';
}

/* ========================================
   Tools Functions
   ======================================== */

// Open Tool
function openTool(toolName) {
    ChatState.currentTool = toolName;
    ChatState.currentDownloader = null;
    
    // Hide other views
    elements.welcomeScreen?.classList.add('hidden');
    elements.messagesContainer?.classList.add('hidden');
    elements.inputArea?.classList.add('hidden');
    elements.toolInterface?.classList.remove('hidden');
    
    // Set tool title
    const toolTitles = {
        'cek-nomor': 'Cek Nomor Telepon',
        'otp': 'OTP Generator',
        'ssweb': 'Screenshot Website',
        'translate': 'Translate Text'
    };
    elements.toolTitle.textContent = toolTitles[toolName] || 'Tool';
    
    // Render tool form
    renderToolForm(toolName);
}

// Render Tool Form
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
                                    <option value="ja">Japanese</option>
                                    <option value="ko">Korean</option>
                                    <option value="ar">Arabic</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Ke Bahasa</label>
                                <select id="translateTo">
                                    <option value="en">English</option>
                                    <option value="id">Indonesia</option>
                                    <option value="ja">Japanese</option>
                                    <option value="ko">Korean</option>
                                    <option value="ar">Arabic</option>
                                    <option value="zh">Chinese</option>
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

// Execute Cek Nomor
async function executeCekNomor() {
    const nomor = document.getElementById('cekNomorInput')?.value.trim();
    if (!nomor) {
        alert('Masukkan nomor telepon!');
        return;
    }
    
    const url = `${TOOLS_ENDPOINTS['cek-nomor']}?nomor=${encodeURIComponent(nomor)}`;
    await executeToolAPI(url, 'Cek Nomor');
}

// Execute OTP
async function executeOTP() {
    const type = document.getElementById('otpType')?.value || 'otps';
    const limit = document.getElementById('otpLimit')?.value || '20';
    const country = document.getElementById('otpCountry')?.value || 'indonesia';
    
    const url = `${TOOLS_ENDPOINTS.otp}?type=${type}&limit=${limit}&country=${country}`;
    await executeToolAPI(url, 'OTP Generator');
}

// Execute SS Web
async function executeSSWeb() {
    const url = document.getElementById('sswebUrl')?.value.trim();
    if (!url) {
        alert('Masukkan URL website!');
        return;
    }
    
    const apiUrl = `${TOOLS_ENDPOINTS.ssweb}?url=${encodeURIComponent(url)}`;
    await executeToolAPI(apiUrl, 'Screenshot Website');
}

// Execute Translate
async function executeTranslate() {
    const text = document.getElementById('translateText')?.value.trim();
    const from = document.getElementById('translateFrom')?.value || 'auto';
    const to = document.getElementById('translateTo')?.value || 'en';
    
    if (!text) {
        alert('Masukkan teks yang akan diterjemahkan!');
        return;
    }
    
    const url = `${TOOLS_ENDPOINTS.translate}?text=${encodeURIComponent(text)}&to=${to}&from=${from}`;
    await executeToolAPI(url, 'Translate');
}

// Execute Tool API
async function executeToolAPI(url, title) {
    elements.toolResult.innerHTML = `
        <div class="tool-result">
            <div class="loading-overlay" style="position: relative; min-height: 100px;">
                <div class="spinner"></div>
                <span class="loading-text">Processing...</span>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const data = await response.json();
        displayToolResult(data, title);
    } catch (error) {
        elements.toolResult.innerHTML = `
            <div class="tool-result">
                <div class="tool-result-header">
                    <h3><i class="fas fa-exclamation-circle" style="color: var(--danger);"></i> Error</h3>
                </div>
                <div class="tool-result-content">
                    <p>Gagal mengambil data. Silakan coba lagi.</p>
                    <p style="color: var(--danger); font-size: 0.8rem;">${error.message}</p>
                </div>
            </div>
        `;
    }
}

// Display Tool Result
function displayToolResult(data, title) {
    let contentHTML = '';
    
    // Check if data has image URL
    if (data.url && (data.url.endsWith('.jpg') || data.url.endsWith('.png') || data.url.endsWith('.jpeg') || data.url.endsWith('.webp'))) {
        contentHTML = `
            <div class="media-preview">
                <img src="${data.url}" alt="${title}" onerror="this.parentElement.innerHTML='<p>Failed to load image</p>'">
            </div>
        `;
    }
    // Check if data has video URL
    else if (data.url && (data.url.endsWith('.mp4') || data.url.endsWith('.webm'))) {
        contentHTML = `
            <div class="media-preview">
                <video controls>
                    <source src="${data.url}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>
        `;
    }
    // Check for array of OTPs
    else if (Array.isArray(data) || data.otp || data.otps || data.numbers) {
        const otps = data.otp || data.otps || data.numbers || data;
        if (Array.isArray(otps)) {
            contentHTML = `
                <div class="otp-grid">
                    ${otps.map(otp => `
                        <div class="otp-item" onclick="copyOTP(this, '${otp}')">${otp}</div>
                    `).join('')}
                </div>
                <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 12px;">Klik untuk copy</p>
            `;
        }
    }
    // Check for phone info
    else if (data.nomor || data.number || data.phone) {
        const phoneInfo = data;
        contentHTML = `
            <div class="info-card">
                <div class="info-row"><span class="info-label">Nomor:</span> <span class="info-value">${phoneInfo.nomor || phoneInfo.number || phoneInfo.phone || '-'}</span></div>
                <div class="info-row"><span class="info-label">Operator:</span> <span class="info-value">${phoneInfo.operator || phoneInfo.carrier || '-'}</span></div>
                <div class="info-row"><span class="info-label">Negara:</span> <span class="info-value">${phoneInfo.country || phoneInfo.negara || '-'}</span></div>
                <div class="info-row"><span class="info-label">Status:</span> <span class="info-value">${phoneInfo.status || 'Valid'}</span></div>
            </div>
        `;
    }
    // Check for translation result
    else if (data.translation || data.translated || data.result) {
        const translatedText = data.translation || data.translated || data.result;
        contentHTML = `
            <div class="translation-result">
                <p style="font-size: 1.1rem; line-height: 1.6;">${translatedText}</p>
            </div>
        `;
    }
    // Check for screenshot URL
    else if (data.screenshot || data.image || data.result?.url) {
        const imgUrl = data.screenshot || data.image || data.result?.url;
        contentHTML = `
            <div class="media-preview">
                <img src="${imgUrl}" alt="Screenshot" onerror="this.parentElement.innerHTML='<p>Failed to load screenshot</p>'">
            </div>
        `;
    }
    // Default: show user-friendly message instead of raw JSON
    else {
        // Try to find any meaningful text in the data
        let friendlyText = '';
        if (typeof data === 'object') {
            const values = Object.values(data).filter(v => typeof v === 'string' && v.length > 3);
            if (values.length > 0) {
                friendlyText = values.join('\n');
            }
        }
        
        if (friendlyText) {
            contentHTML = `<p style="white-space: pre-wrap;">${escapeHtml(friendlyText)}</p>`;
        } else {
            contentHTML = `<p>Data received successfully. Check the result below.</p>`;
        }
    }
    
    elements.toolResult.innerHTML = `
        <div class="tool-result">
            <div class="tool-result-header">
                <h3><i class="fas fa-check-circle"></i> ${title} Result</h3>
            </div>
            <div class="tool-result-content">
                ${contentHTML}
            </div>
        </div>
    `;
}

// Copy OTP
function copyOTP(element, otp) {
    navigator.clipboard.writeText(otp).then(() => {
        element.classList.add('copied');
        setTimeout(() => element.classList.remove('copied'), 1000);
    });
}

/* ========================================
   Downloaders Functions
   ======================================== */

// Open Downloader
function openDownloader(downloaderName) {
    ChatState.currentDownloader = downloaderName;
    ChatState.currentTool = null;
    
    // Hide other views
    elements.welcomeScreen?.classList.add('hidden');
    elements.messagesContainer?.classList.add('hidden');
    elements.inputArea?.classList.add('hidden');
    elements.toolInterface?.classList.remove('hidden');
    
    // Set tool title
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
    
    // Render downloader form
    renderDownloaderForm(downloaderName);
}

// Render Downloader Form
function renderDownloaderForm(downloaderName) {
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
    
    const descriptions = {
        'instagram': 'Download video/reel dari Instagram',
        'facebook': 'Download video dari Facebook',
        'tiktok': 'Download video dari TikTok',
        'twitter': 'Download video/gambar dari Twitter/X',
        'youtube': 'Download video dari YouTube',
        'youtube-mp3': 'Download audio dari YouTube sebagai MP3',
        'spotify': 'Download dari Spotify',
        'safefileku': 'Download dari SafeFileKu'
    };
    
    elements.toolContent.innerHTML = `
        <div class="tool-content">
            <h3><i class="${icons[downloaderName]}"></i> ${descriptions[downloaderName]}</h3>
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

// Execute Downloader
async function executeDownloader() {
    const url = document.getElementById('downloaderUrl')?.value.trim();
    if (!url) {
        alert('Masukkan URL!');
        return;
    }
    
    const downloaderName = ChatState.currentDownloader;
    const endpoint = DOWNLOADER_ENDPOINTS[downloaderName];
    
    if (!endpoint) {
        alert('Invalid downloader!');
        return;
    }
    
    elements.toolResult.innerHTML = `
        <div class="tool-result">
            <div class="loading-overlay" style="position: relative; min-height: 100px;">
                <div class="spinner"></div>
                <span class="loading-text">Downloading...</span>
            </div>
        </div>
    `;
    
    try {
        const apiUrl = `${endpoint}?url=${encodeURIComponent(url)}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const data = await response.json();
        displayDownloaderResult(data, downloaderName);
    } catch (error) {
        elements.toolResult.innerHTML = `
            <div class="tool-result">
                <div class="tool-result-header">
                    <h3><i class="fas fa-exclamation-circle" style="color: var(--danger);"></i> Error</h3>
                </div>
                <div class="tool-result-content">
                    <p>Gagal mendownload. Silakan coba lagi.</p>
                    <p style="color: var(--danger); font-size: 0.8rem;">${error.message}</p>
                </div>
            </div>
        `;
    }
}

// Display Downloader Result
function displayDownloaderResult(data, downloaderName) {
    let contentHTML = '';
    
    // Handle different response structures
    const mediaUrl = data.url || data.download_url || data.video || data.image || 
                     data.result?.url || data.result?.download_url || 
                     data.data?.url || data.data?.download_url;
    
    const title = data.title || data.name || 'Downloaded Content';
    const thumbnail = data.thumbnail || data.image;
    
    // Video result
    if (mediaUrl && (mediaUrl.includes('.mp4') || mediaUrl.includes('video') || downloaderName.includes('youtube') || downloaderName === 'tiktok' || downloaderName === 'facebook' || downloaderName === 'twitter')) {
        contentHTML = `
            ${thumbnail ? `<div class="media-preview"><img src="${thumbnail}" alt="Thumbnail"></div>` : ''}
            <div class="media-preview">
                <video controls>
                    <source src="${mediaUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>
            <p style="margin: 12px 0; color: var(--text-primary);">${escapeHtml(title)}</p>
            <a href="${mediaUrl}" target="_blank" class="download-btn">
                <i class="fas fa-download"></i> Download Video
            </a>
        `;
    }
    // Audio result (YouTube MP3, Spotify)
    else if (mediaUrl && (downloaderName === 'youtube-mp3' || downloaderName === 'spotify')) {
        contentHTML = `
            ${thumbnail ? `<div class="media-preview"><img src="${thumbnail}" alt="Thumbnail"></div>` : ''}
            <div class="media-preview" style="padding: 20px; text-align: center;">
                <i class="fas fa-music" style="font-size: 3rem; color: var(--accent-primary); margin-bottom: 16px;"></i>
                <audio controls style="width: 100%;">
                    <source src="${mediaUrl}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
            </div>
            <p style="margin: 12px 0; color: var(--text-primary);">${escapeHtml(title)}</p>
            <a href="${mediaUrl}" target="_blank" class="download-btn">
                <i class="fas fa-download"></i> Download Audio
            </a>
        `;
    }
    // Image result (Instagram)
    else if (mediaUrl && (mediaUrl.includes('.jpg') || mediaUrl.includes('.png') || mediaUrl.includes('.jpeg') || downloaderName === 'instagram')) {
        contentHTML = `
            <div class="media-preview">
                <img src="${mediaUrl}" alt="Downloaded Image" onerror="this.parentElement.innerHTML='<p>Failed to load image</p>'">
            </div>
            <p style="margin: 12px 0; color: var(--text-primary);">${escapeHtml(title)}</p>
            <a href="${mediaUrl}" target="_blank" class="download-btn">
                <i class="fas fa-download"></i> Download Image
            </a>
        `;
    }
    // Multiple results
    else if (data.result && Array.isArray(data.result)) {
        contentHTML = data.result.map((item, index) => {
            const itemUrl = item.url || item.download_url;
            return `
                <div style="margin-bottom: 16px; padding: 16px; background: var(--bg-tertiary); border-radius: var(--radius-md);">
                    <p style="color: var(--text-primary); margin-bottom: 8px;">${item.quality || item.label || `Option ${index + 1}`}</p>
                    <a href="${itemUrl}" target="_blank" class="download-btn">
                        <i class="fas fa-download"></i> Download
                    </a>
                </div>
            `;
        }).join('');
    }
    // Default: show user-friendly message with download link
    else {
        // Try to find any URL in the data
        const jsonStr = JSON.stringify(data, null, 2);
        const urlMatches = jsonStr.match(/https?:\/\/[^\s"']+/g);
        
        if (urlMatches && urlMatches.length > 0) {
            contentHTML = `
                <p style="margin-bottom: 16px; color: var(--text-primary);">Download ready! Click the button below:</p>
                ${urlMatches.map((url, index) => `
                    <div style="margin-bottom: 12px;">
                        <a href="${url}" target="_blank" class="download-btn">
                            <i class="fas fa-download"></i> Download ${urlMatches.length > 1 ? `Option ${index + 1}` : ''}
                        </a>
                    </div>
                `).join('')}
            `;
        } else {
            contentHTML = `
                <p style="color: var(--text-primary);">Content processed successfully.</p>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 8px;">If no download appeared, the URL might be invalid or unsupported.</p>
            `;
        }
    }
    
    elements.toolResult.innerHTML = `
        <div class="tool-result">
            <div class="tool-result-header">
                <h3><i class="fas fa-check-circle"></i> Download Result</h3>
            </div>
            <div class="tool-result-content">
                ${contentHTML}
            </div>
        </div>
    `;
}

/* ========================================
   Modal Functions
   ======================================== */

function closeToolModal() {
    elements.toolModal?.classList.remove('active');
}

function closeResultModal() {
    elements.resultModal?.classList.remove('active');
}

/* ========================================
   Custom Model Selector
   ======================================== */

function setupModelSelector() {
    const selector = document.getElementById('modelSelector');
    const current = document.getElementById('modelCurrent');
    const dropdown = document.getElementById('modelDropdown');
    const options = document.querySelectorAll('.model-option');
    const hiddenSelect = document.getElementById('modelSelect');

    if (!selector || !current || !dropdown) return;

    // Toggle dropdown
    current.addEventListener('click', (e) => {
        e.stopPropagation();
        selector.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!selector.contains(e.target)) {
            selector.classList.remove('open');
        }
    });

    // Option click
    options.forEach(option => {
        option.addEventListener('click', () => {
            const model = option.dataset.model;
            const name = option.querySelector('span:last-child').textContent;
            const icon = option.querySelector('.model-icon i').className;

            // Update active state
            options.forEach(o => o.classList.remove('active'));
            option.classList.add('active');

            // Update current display
            current.querySelector('.model-name').textContent = name;
            current.querySelector('.model-icon i').className = icon;

            // Update hidden select
            if (hiddenSelect) {
                hiddenSelect.value = model;
                hiddenSelect.dispatchEvent(new Event('change'));
            }

            // Update state
            ChatState.currentModel = model;

            // Close dropdown
            selector.classList.remove('open');
        });
    });

    // Keyboard navigation
    current.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selector.classList.toggle('open');
        }
        if (e.key === 'Escape') {
            selector.classList.remove('open');
        }
    });
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', init);
