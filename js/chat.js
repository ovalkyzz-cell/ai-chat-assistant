/* ========================================
   Chat Logic - Mazval GPT AI
   ======================================== */
const ChatState = { chats: [], currentChatId: null, currentModel: 'chatgpt', isGenerating: false, currentView: 'chats', currentTool: null, currentDownloader: null, abortController: null };
const PRICING_PLANS = { free: { dailyLimit: 5, features: ['chatgpt'], imageGen: false, tools: false, downloaders: false }, basic: { dailyLimit: 100, features: ['chatgpt','gemini','copilot','apertus','claude-opus','mistral','felo','turboseek'], imageGen: false, tools: true, downloaders: true }, pro: { dailyLimit: 500, features: ['chatgpt','gemini','copilot','apertus','claude-opus','mistral','felo','turboseek'], imageGen: true, tools: true, downloaders: true }, premium: { dailyLimit: -1, features: ['chatgpt','gemini','copilot','apertus','claude-opus','mistral','felo','turboseek'], imageGen: true, tools: true, downloaders: true }, reseller: { dailyLimit: -1, features: ['chatgpt','gemini','copilot','apertus','claude-opus','mistral','felo','turboseek'], imageGen: true, tools: true, downloaders: true } };
let el = {};

function cacheElements() {
    el = {
        sidebar: document.getElementById('sidebar'), sidebarOverlay: document.getElementById('sidebarOverlay'),
        sidebarToggle: document.getElementById('sidebarToggle'), newChatBtn: document.getElementById('newChatBtn'),
        chatList: document.getElementById('chatList'), chatContainer: document.getElementById('chatContainer'),
        welcomeScreen: document.getElementById('welcomeScreen'), messagesContainer: document.getElementById('messagesContainer'),
        messageInput: document.getElementById('messageInput'), sendBtn: document.getElementById('sendBtn'),
        modelSelect: document.getElementById('modelSelect'), userName: document.getElementById('userName'),
        logoutBtn: document.getElementById('logoutBtn'), inputArea: document.getElementById('inputArea'),
        chatsPanel: document.getElementById('chatsPanel'), toolsPanel: document.getElementById('toolsPanel'),
        downloadersPanel: document.getElementById('downloadersPanel'), toolInterface: document.getElementById('toolInterface'),
        toolTitle: document.getElementById('toolTitle'), toolContent: document.getElementById('toolContent'),
        toolResult: document.getElementById('toolResult'), backToChat: document.getElementById('backToChat'),
        modelSelector: document.getElementById('modelSelector'), modelCurrent: document.getElementById('modelCurrent'),
        modelDropdown: document.getElementById('modelDropdown'),
        historySearch: document.getElementById('historySearch'),
        micBtn: document.getElementById('micBtn'), attachBtn: document.getElementById('attachBtn'),
        fileInput: document.getElementById('fileInput'), attachmentPreview: document.getElementById('attachmentPreview'),
        settingsPanel: document.getElementById('settingsPanel'), helpPanel: document.getElementById('helpPanel'),
        profilePanel: document.getElementById('profilePanel'), adminLink: document.getElementById('adminLink'),
        stopBtn: document.getElementById('stopBtn')
    };
}

function getUser() { try { return JSON.parse(localStorage.getItem('mazval_user')); } catch { return null; } }
function getUserPlan() { const u = getUser(); if (!u) return 'free'; if (u.role === 'admin') return 'premium'; return u.plan || 'free'; }
function getPlanLimits(p) { return PRICING_PLANS[p] || PRICING_PLANS.free; }

// ========================================
// INIT
// ========================================
function init() {
    cacheElements();
    const user = getUser();
    if (!user) { window.location.href = 'login.html'; return; }
    if (el.userName) el.userName.textContent = user.name || user.email.split('@')[0];
    if (el.adminLink) el.adminLink.style.display = user.role === 'admin' ? '' : 'none';
    setupEventListeners();
    setupSidebarNav();
    setupModelSelector();
    setupTools();
    setupDownloaders();
    loadConversations();
    setupVoice();
    setupFileUpload();
}

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
    if (el.sidebarToggle) el.sidebarToggle.addEventListener('click', toggleSidebar);
    if (el.sidebarOverlay) el.sidebarOverlay.addEventListener('click', closeSidebar);
    if (el.newChatBtn) el.newChatBtn.addEventListener('click', () => { showChatView(); createNewChat(); });
    if (el.messageInput) { el.messageInput.addEventListener('input', handleInputChange); el.messageInput.addEventListener('keydown', handleKeyDown); }
    if (el.sendBtn) el.sendBtn.addEventListener('click', sendMessage);
    if (el.backToChat) el.backToChat.addEventListener('click', showChatView);
    if (el.logoutBtn) el.logoutBtn.addEventListener('click', handleLogout);
    if (el.historySearch) el.historySearch.addEventListener('input', (e) => loadConversations(e.target.value));
    document.querySelectorAll('.suggestion-card').forEach(c => c.addEventListener('click', () => { if (el.messageInput) { el.messageInput.value = c.dataset.prompt; handleInputChange(); sendMessage(); } }));
    document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            closeSidebar();
            const page = link.dataset.page;
            if (page === 'pricing') window.location.href = 'pricing.html';
            else if (page === 'admin') window.location.href = 'admin.html';
            else if (page === 'settings') showPanel('settings');
            else if (page === 'help') showPanel('help');
        });
    });
}

// ========================================
// SIDEBAR NAV
// ========================================
function setupSidebarNav() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const t = tab.dataset.tab;
            document.querySelectorAll('.nav-tab').forEach(x => x.classList.remove('active'));
            tab.classList.add('active');
            hideAllPanels();
            if (t === 'chats') { el.chatsPanel?.classList.remove('hidden'); ChatState.currentView = 'chats'; }
            else if (t === 'tools') { el.toolsPanel?.classList.remove('hidden'); ChatState.currentView = 'tools'; }
            else if (t === 'downloaders') { el.downloadersPanel?.classList.remove('hidden'); ChatState.currentView = 'downloaders'; }
        });
    });
}
function hideAllPanels() { el.chatsPanel?.classList.add('hidden'); el.toolsPanel?.classList.add('hidden'); el.downloadersPanel?.classList.add('hidden'); }
function toggleSidebar() {
    if (!el.sidebar) return;
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        el.sidebar.classList.toggle('active');
        el.sidebarOverlay?.classList.toggle('active');
    } else {
        el.sidebar.classList.toggle('collapsed');
    }
}
function closeSidebar() {
    if (!el.sidebar) return;
    el.sidebar.classList.remove('active');
    el.sidebar.classList.remove('collapsed');
    el.sidebarOverlay?.classList.remove('active');
}

function showPanel(p) { showChatView(); }

// ========================================
// MODEL SELECTOR
// ========================================
function setupModelSelector() {
    if (!el.modelCurrent || !el.modelDropdown) return;
    el.modelCurrent.addEventListener('click', (e) => { e.stopPropagation(); el.modelDropdown.classList.toggle('active'); });
    document.addEventListener('click', () => el.modelDropdown?.classList.remove('active'));
    el.modelDropdown.addEventListener('click', (e) => e.stopPropagation());
    document.querySelectorAll('.model-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const m = opt.dataset.model;
            ChatState.currentModel = m;
            el.modelCurrent.querySelector('.model-name').textContent = opt.querySelector('.model-name').textContent;
            el.modelDropdown.classList.remove('active');
            document.querySelectorAll('.model-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        });
    });
}

// ========================================
// TOOLS & DOWNLOADERS
// ========================================
function setupTools() { document.querySelectorAll('.tool-item[data-tool]').forEach(i => i.addEventListener('click', () => openTool(i.dataset.tool))); }
function setupDownloaders() { document.querySelectorAll('.tool-item[data-downloader]').forEach(i => i.addEventListener('click', () => openDownloader(i.dataset.downloader))); }

function openTool(tool) {
    ChatState.currentTool = tool;
    const titles = { 'cek-nomor': 'Cek Nomor', 'otp': 'OTP Generator', 'ssweb': 'Screenshot Web', 'translate': 'Translate' };
    if (el.toolTitle) el.toolTitle.textContent = titles[tool] || tool;
    if (el.toolContent) {
        const forms = {
            'cek-nomor': '<div class="tool-form"><input type="text" id="toolInput1" placeholder="Nomor telepon (contoh: 08123456789)" class="tool-input"><button onclick="executeTool()" class="tool-submit-btn">Cek</button></div>',
            'otp': '<div class="tool-form"><select id="toolInput1" class="tool-select"><option value="otps">OTP</option><option value="sms">SMS</option></select><input type="number" id="toolInput2" placeholder="Jumlah" value="10" class="tool-input"><button onclick="executeTool()" class="tool-submit-btn">Generate</button></div>',
            'ssweb': '<div class="tool-form"><input type="text" id="toolInput1" placeholder="URL website" class="tool-input"><button onclick="executeTool()" class="tool-submit-btn">Screenshot</button></div>',
            'translate': '<div class="tool-form"><textarea id="toolInput1" placeholder="Teks yang akan diterjemahkan" class="tool-textarea"></textarea><select id="toolInput2" class="tool-select"><option value="en">English</option><option value="id">Indonesia</option><option value="ja">Japanese</option><option value="ko">Korean</option><option value="ar">Arabic</option></select><button onclick="executeTool()" class="tool-submit-btn">Translate</button></div>'
        };
        el.toolContent.innerHTML = forms[tool] || '<p>Tool not available</p>';
    }
    if (el.toolResult) el.toolResult.innerHTML = '';
    if (el.toolInterface) el.toolInterface.classList.remove('hidden');
    if (el.chatContainer) el.chatContainer.style.display = 'none';
}

function openDownloader(platform) {
    ChatState.currentDownloader = platform;
    const titles = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', twitter: 'Twitter', youtube: 'YouTube', 'youtube-mp3': 'YouTube MP3', spotify: 'Spotify', safefileku: 'SafeFileKu' };
    if (el.toolTitle) el.toolTitle.textContent = (titles[platform] || platform) + ' Downloader';
    if (el.toolContent) el.toolContent.innerHTML = '<div class="tool-form"><input type="text" id="toolInput1" placeholder="Paste URL here" class="tool-input"><button onclick="executeDownloader()" class="tool-submit-btn">Download</button></div>';
    if (el.toolResult) el.toolResult.innerHTML = '';
    if (el.toolInterface) el.toolInterface.classList.remove('hidden');
    if (el.chatContainer) el.chatContainer.style.display = 'none';
}

async function executeTool() {
    const v1 = document.getElementById('toolInput1')?.value;
    if (!v1) return showToast('Fill in the required field', 'error');
    if (el.toolResult) el.toolResult.innerHTML = '<div class="tool-loading"><i class="fas fa-spinner fa-spin"></i> Processing...</div>';
    try {
        let data;
        switch (ChatState.currentTool) {
            case 'cek-nomor': data = await API.cekNomor(v1); break;
            case 'otp': data = await API.generateOTP(v1, document.getElementById('toolInput2')?.value || '10', 'indonesia'); break;
            case 'ssweb': data = await API.screenshotWeb(v1); break;
            case 'translate': data = await API.translate(v1, document.getElementById('toolInput2')?.value || 'en', 'auto'); break;
        }
        if (el.toolResult) el.toolResult.innerHTML = '<div class="tool-result-content"><pre>' + escHtml(JSON.stringify(data?.data || data, null, 2)) + '</pre></div>';
    } catch (e) { if (el.toolResult) el.toolResult.innerHTML = '<div class="tool-error">Error: ' + escHtml(e?.error?.message || 'Failed') + '</div>'; }
}

async function executeDownloader() {
    const url = document.getElementById('toolInput1')?.value;
    if (!url) return showToast('Paste a URL first', 'error');
    if (el.toolResult) el.toolResult.innerHTML = '<div class="tool-loading"><i class="fas fa-spinner fa-spin"></i> Downloading...</div>';
    try {
        const data = await API.download(ChatState.currentDownloader, url);
        if (el.toolResult) el.toolResult.innerHTML = '<div class="tool-result-content"><pre>' + escHtml(JSON.stringify(data?.data || data, null, 2)) + '</pre></div>';
    } catch (e) { if (el.toolResult) el.toolResult.innerHTML = '<div class="tool-error">Error: ' + escHtml(e?.error?.message || 'Failed') + '</div>'; }
}

// ========================================
// CONVERSATIONS
// ========================================
async function loadConversations(q) {
    if (!el.chatList) return;
    try {
        const data = await API.getConversations(q);
        ChatState.chats = data.data || [];
        renderChatList();
    } catch (e) { console.error('Load conversations failed:', e); }
}

function renderChatList() {
    if (!el.chatList) return;
    if (!ChatState.chats.length) { el.chatList.innerHTML = '<div class="empty-history"><i class="fas fa-comments"></i><p>No conversations yet</p></div>'; return; }
    el.chatList.innerHTML = ChatState.chats.map(c => `
        <div class="chat-item ${c.id === ChatState.currentChatId ? 'active' : ''}" data-id="${c.id}">
            <div class="chat-item-content">
                <i class="fas fa-message chat-item-icon"></i>
                <span class="chat-item-title">${escHtml(c.title || 'New Chat')}</span>
            </div>
            <div class="chat-item-actions">
                <button class="chat-item-btn rename-btn" data-id="${c.id}" title="Rename"><i class="fas fa-pen"></i></button>
                <button class="chat-item-btn delete-btn" data-id="${c.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');

    el.chatList.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.chat-item-btn')) return;
            openConversation(item.dataset.id);
        });
    });
    el.chatList.querySelectorAll('.rename-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); renameConversation(btn.dataset.id); });
    });
    el.chatList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); deleteConversation(btn.dataset.id); });
    });
}

async function createNewChat() {
    try {
        const data = await API.createConversation('New Chat', ChatState.currentModel);
        ChatState.currentChatId = data.data.id;
        await loadConversations();
        showChatView();
        if (el.messagesContainer) el.messagesContainer.innerHTML = '';
        if (el.welcomeScreen) el.welcomeScreen.style.display = '';
        if (el.inputArea) el.inputArea.style.display = '';
        if (el.messageInput) el.messageInput.focus();
    } catch (e) { showToast('Failed to create chat', 'error'); }
}

async function openConversation(id) {
    try {
        const data = await API.getConversation(id);
        ChatState.currentChatId = id;
        showChatView();
        renderMessages(data.data.messages || []);
        if (el.welcomeScreen) el.welcomeScreen.style.display = 'none';
        closeSidebar();
        renderChatList();
    } catch (e) { showToast('Failed to load conversation', 'error'); }
}

async function renameConversation(id) {
    const chat = ChatState.chats.find(c => c.id === id);
    const newTitle = prompt('Rename conversation:', chat?.title || '');
    if (!newTitle || newTitle === chat?.title) return;
    try {
        await API.updateConversation(id, newTitle);
        await loadConversations();
        showToast('Renamed', 'success');
    } catch (e) { showToast('Failed to rename', 'error'); }
}

async function deleteConversation(id) {
    if (!confirm('Delete this conversation?')) return;
    try {
        await API.deleteConversation(id);
        if (ChatState.currentChatId === id) { ChatState.currentChatId = null; showWelcome(); }
        await loadConversations();
        showToast('Deleted', 'success');
    } catch (e) { showToast('Failed to delete', 'error'); }
}

// ========================================
// MESSAGES
// ========================================
function renderMessages(msgs) {
    if (!el.messagesContainer) return;
    el.messagesContainer.innerHTML = '';
    msgs.forEach(m => appendMessage(m.role, m.content, m.model, m.id));
    scrollToBottom();
}

function appendMessage(role, content, model, id) {
    if (!el.messagesContainer) return;
    if (el.welcomeScreen) el.welcomeScreen.style.display = 'none';
    const div = document.createElement('div');
    div.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
    div.dataset.id = id || '';

    const avatar = role === 'user' ? '<div class="message-avatar user-avatar"><i class="fas fa-user"></i></div>' : '<div class="message-avatar ai-avatar"><img src="https://j.top4top.io/p_3903uecld0.png" alt="AI"></div>';

    let actions = '';
    if (role === 'assistant') {
        actions = `<div class="message-actions">
            <button class="msg-action-btn copy-btn" data-msg="${escHtml(content)}" title="Copy"><i class="fas fa-copy"></i></button>
        </div>`;
    }

    div.innerHTML = `${avatar}<div class="message-body"><div class="message-content">${renderMarkdown(content)}</div>${actions}</div>`;
    el.messagesContainer.appendChild(div);

    div.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(btn.dataset.msg).then(() => {
                btn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = btn.dataset.msg;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                btn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
            });
        });
    });
}

function renderMarkdown(text) {
    if (!text) return '';
    let html = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^\- (.+)$/gm, '<li>$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            const safeUrl = /^(https?:\/\/|data:)/i.test(src) ? src : '';
            return safeUrl ? `<img src="${safeUrl}" alt="${alt}" class="msg-image" style="max-width:100%;border-radius:8px;margin:8px 0">` : '';
        })
        .replace(/\n/g, '<br>');
    return html;
}

function scrollToBottom() { if (el.messagesContainer) el.messagesContainer.scrollTop = el.messagesContainer.scrollHeight; }

// ========================================
// SEND MESSAGE
// ========================================
async function sendMessage() {
    const msg = el.messageInput?.value?.trim();
    if (!msg || ChatState.isGenerating) return;

    if (!ChatState.currentChatId) {
        try {
            const data = await API.createConversation(msg.substring(0, 50), ChatState.currentModel);
            ChatState.currentChatId = data.data.id;
            await loadConversations();
        } catch (e) { showToast('Failed to create chat', 'error'); return; }
    }

    el.messageInput.value = '';
    handleInputChange();
    appendMessage('user', msg);
    scrollToBottom();

    ChatState.isGenerating = true;
    showGeneratingState();

    try {
        const data = await API.sendMessage(ChatState.currentChatId, msg, ChatState.currentModel);
        ChatState.isGenerating = false;
        hideGeneratingState();
        if (data.data?.message) {
            appendMessage('assistant', data.data.message.content, data.data.message.model, data.data.message.id);
            scrollToBottom();
        }
        if (data.data?.conversation?.title) {
            const idx = ChatState.chats.findIndex(c => c.id === ChatState.currentChatId);
            if (idx !== -1) ChatState.chats[idx].title = data.data.conversation.title;
            renderChatList();
        }
    } catch (e) {
        ChatState.isGenerating = false;
        hideGeneratingState();
        appendMessage('assistant', '⚠️ Error: ' + (e?.error?.message || 'Failed to get response. Please try again.'));
        scrollToBottom();
    }
}

function showGeneratingState() {
    if (el.sendBtn) el.sendBtn.style.display = 'none';
    if (el.stopBtn) { el.stopBtn.style.display = ''; el.stopBtn.onclick = stopGeneration; }
    const typing = document.createElement('div');
    typing.className = 'message ai-message typing-indicator';
    typing.id = 'typingIndicator';
    typing.innerHTML = '<div class="message-avatar ai-avatar"><img src="https://j.top4top.io/p_3903uecld0.png" alt="AI"></div><div class="message-body"><div class="message-content"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div></div>';
    el.messagesContainer?.appendChild(typing);
    scrollToBottom();
}

function hideGeneratingState() {
    if (el.sendBtn) el.sendBtn.style.display = '';
    if (el.stopBtn) el.stopBtn.style.display = 'none';
    document.getElementById('typingIndicator')?.remove();
}

function stopGeneration() {
    if (ChatState.abortController) ChatState.abortController.abort();
    ChatState.isGenerating = false;
    hideGeneratingState();
}

function showChatView() {
    if (el.chatContainer) el.chatContainer.style.display = '';
    if (el.toolInterface) el.toolInterface.classList.add('hidden');
    if (el.inputArea) el.inputArea.style.display = '';
}

function showWelcome() {
    if (el.welcomeScreen) el.welcomeScreen.style.display = '';
    if (el.messagesContainer) el.messagesContainer.innerHTML = '';
    if (el.inputArea) el.inputArea.style.display = '';
}

// ========================================
// INPUT HANDLERS
// ========================================
function handleInputChange() {
    if (!el.messageInput || !el.sendBtn) return;
    const hasText = el.messageInput.value.trim().length > 0;
    el.sendBtn.disabled = !hasText;
    el.messageInput.style.height = 'auto';
    el.messageInput.style.height = Math.min(el.messageInput.scrollHeight, 200) + 'px';
}

function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

// ========================================
// VOICE
// ========================================
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingTimer = null;
let recordingSeconds = 0;

function setupVoice() {
    if (!el.micBtn) return;
    el.micBtn.addEventListener('click', toggleRecording);
}

async function toggleRecording() {
    if (isRecording) { stopRecording(); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = () => processAudio();
        mediaRecorder.start();
        isRecording = true;
        recordingSeconds = 0;
        el.micBtn?.classList.add('recording');
        const indicator = document.getElementById('recordingIndicator');
        if (indicator) indicator.classList.add('active');
        recordingTimer = setInterval(() => {
            recordingSeconds++;
            const timerEl = document.getElementById('recordingTimer');
            if (timerEl) timerEl.textContent = formatTime(recordingSeconds);
        }, 1000);
    } catch (e) { showToast('Microphone permission denied', 'error'); }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    isRecording = false;
    el.micBtn?.classList.remove('recording');
    const indicator = document.getElementById('recordingIndicator');
    if (indicator) indicator.classList.remove('active');
    clearInterval(recordingTimer);
    if (mediaRecorder?.stream) mediaRecorder.stream.getTracks().forEach(t => t.stop());
}

function cancelRecording() {
    audioChunks = [];
    stopRecording();
}

async function processAudio() {
    if (!audioChunks.length || audioChunks.every(c => c.size === 0)) {
        showToast('No audio recorded', 'warning');
        return;
    }
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    if (blob.size === 0) {
        showToast('No audio recorded', 'warning');
        return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        try {
            const data = await API.speechToText(base64);
            if (data.data?.text) {
                el.messageInput.value = data.data.text;
                handleInputChange();
                showToast('Transcription complete', 'success');
            } else { showToast('No speech detected', 'warning'); }
        } catch (e) { showToast('Speech recognition failed', 'error'); }
    };
    reader.readAsDataURL(blob);
}

function formatTime(s) { const m = Math.floor(s / 60); return `${m}:${(s % 60).toString().padStart(2, '0')}`; }

// ========================================
// FILE UPLOAD
// ========================================
function setupFileUpload() {
    if (el.attachBtn) el.attachBtn.addEventListener('click', () => el.fileInput?.click());
    if (el.fileInput) el.fileInput.addEventListener('change', handleFileSelect);
}

async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('File too large (max 10MB)', 'error'); return; }
    if (el.attachmentPreview) {
        el.attachmentPreview.innerHTML = `
            <div class="attachment-item">
                <i class="fas ${file.type.startsWith('image/') ? 'fa-image' : 'fa-file'}"></i>
                <span>${escHtml(file.name)} (${(file.size / 1024).toFixed(1)}KB)</span>
                <button onclick="removeAttachment()" class="remove-attachment"><i class="fas fa-times"></i></button>
            </div>`;
        el.attachmentPreview.style.display = '';
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        try { await API.uploadFile(base64, file.name, file.type); } catch (e) { console.error('Upload failed:', e); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function removeAttachment() {
    if (el.attachmentPreview) { el.attachmentPreview.innerHTML = ''; el.attachmentPreview.style.display = 'none'; }
}

// ========================================
// LOGOUT
// ========================================
async function handleLogout() {
    try { await API.logout(); } catch {}
    localStorage.removeItem('mazval_user');
    localStorage.removeItem('mazval_token');
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', init);
