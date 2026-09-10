/* ========================================
   Chat System - Mazval GPT AI
   Professional Chat Implementation
   ======================================== */

const Models = {
    chatgpt: { name: 'ChatGPT', icon: 'fa-comment-dots' },
    gemini: { name: 'Gemini', icon: 'fa-brain' },
    copilot: { name: 'Copilot', icon: 'fa-compass' },
    apertus: { name: 'Apertus', icon: 'fa-globe' },
    'claude-opus': { name: 'Claude Opus', icon: 'fa-crown' },
    mistral: { name: 'Mistral', icon: 'fa-wind' },
    felo: { name: 'Felo', icon: 'fa-search' },
    turboseek: { name: 'TurboSeek', icon: 'fa-bolt' },
    image: { name: 'AI Image', icon: 'fa-image' }
};

const State = {
    chats: [],
    currentChatId: null,
    currentModel: 'chatgpt',
    isGenerating: false,
    currentView: 'chats',
    currentTool: null,
    currentDownloader: null
};

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

let UI = {};

function cacheElements() {
    UI = {
        sidebar: $('sidebar'),
        sidebarOverlay: $('sidebarOverlay'),
        sidebarToggle: $('sidebarToggle'),
        newChatBtn: $('newChatBtn'),
        chatList: $('chatList'),
        chatContainer: $('chatContainer'),
        welcomeScreen: $('welcomeScreen'),
        messagesContainer: $('messagesContainer'),
        messageInput: $('messageInput'),
        sendBtn: $('sendBtn'),
        stopBtn: $('stopBtn'),
        userName: $('userName'),
        logoutBtn: $('logoutBtn'),
        inputArea: $('inputArea'),
        chatsPanel: $('chatsPanel'),
        toolsPanel: $('toolsPanel'),
        downloadersPanel: $('downloadersPanel'),
        toolInterface: $('toolInterface'),
        toolTitle: $('toolTitle'),
        toolContent: $('toolContent'),
        toolResult: $('toolResult'),
        backToChat: $('backToChat'),
        modelSelector: $('modelSelector'),
        modelCurrent: $('modelCurrent'),
        modelDropdown: $('modelDropdown'),
        historySearch: $('historySearch'),
        micBtn: $('micBtn'),
        attachBtn: $('attachBtn'),
        fileInput: $('fileInput'),
        attachmentPreview: $('attachmentPreview'),
        adminLink: $('adminLink'),
        recordingIndicator: $('recordingIndicator'),
        recordingTimer: $('recordingTimer')
    };
}

function getUser() {
    try { return JSON.parse(localStorage.getItem('mazval_user')); } catch { return null; }
}

/* ========================================
   INIT
   ======================================== */
function init() {
    cacheElements();
    const user = getUser();
    if (!user) { window.location.href = 'login.html'; return; }
    if (UI.userName) UI.userName.textContent = user.name || user.email.split('@')[0];
    if (UI.adminLink) UI.adminLink.style.display = user.role === 'admin' ? '' : 'none';
    bindEvents();
    loadConversations();
}

/* ========================================
   EVENTS
   ======================================== */
function bindEvents() {
    if (UI.sidebarToggle) UI.sidebarToggle.addEventListener('click', toggleSidebar);
    if (UI.sidebarOverlay) UI.sidebarOverlay.addEventListener('click', closeSidebar);
    if (UI.newChatBtn) UI.newChatBtn.addEventListener('click', () => { showChatView(); createNewChat(); });
    if (UI.messageInput) {
        UI.messageInput.addEventListener('input', autoResize);
        UI.messageInput.addEventListener('keydown', onInputKey);
    }
    if (UI.sendBtn) UI.sendBtn.addEventListener('click', send);
    if (UI.stopBtn) UI.stopBtn.addEventListener('click', stopGenerate);
    if (UI.backToChat) UI.backToChat.addEventListener('click', showChatView);
    if (UI.logoutBtn) UI.logoutBtn.addEventListener('click', logout);
    if (UI.historySearch) UI.historySearch.addEventListener('input', (e) => loadConversations(e.target.value));
    if (UI.micBtn) UI.micBtn.addEventListener('click', toggleRecording);
    if (UI.attachBtn) UI.attachBtn.addEventListener('click', () => UI.fileInput?.click());
    if (UI.fileInput) UI.fileInput.addEventListener('change', handleFile);

    $$('.suggestion-card').forEach(c => c.addEventListener('click', () => {
        if (UI.messageInput) {
            UI.messageInput.value = c.dataset.prompt;
            autoResize();
            send();
        }
    }));

    $$('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.tab;
            UI.chatsPanel?.classList.toggle('hidden', target !== 'chats');
            UI.toolsPanel?.classList.toggle('hidden', target !== 'tools');
            UI.downloadersPanel?.classList.toggle('hidden', target !== 'downloaders');
            State.currentView = target;
        });
    });

    $$('.tool-item[data-tool]').forEach(i => i.addEventListener('click', () => openTool(i.dataset.tool)));
    $$('.tool-item[data-downloader]').forEach(i => i.addEventListener('click', () => openDownloader(i.dataset.downloader)));

    if (UI.modelCurrent) {
        UI.modelCurrent.addEventListener('click', (e) => {
            e.stopPropagation();
            UI.modelDropdown?.classList.toggle('active');
            UI.modelSelector?.classList.toggle('open');
        });
    }
    document.addEventListener('click', () => {
        UI.modelDropdown?.classList.remove('active');
        UI.modelSelector?.classList.remove('open');
    });
    if (UI.modelDropdown) UI.modelDropdown.addEventListener('click', (e) => e.stopPropagation());

    $$('.model-option').forEach(opt => {
        opt.addEventListener('click', () => {
            State.currentModel = opt.dataset.model;
            const name = opt.querySelector('.model-name')?.textContent || opt.dataset.model;
            if (UI.modelCurrent) UI.modelCurrent.querySelector('.model-name').textContent = name;
            UI.modelDropdown?.classList.remove('active');
            UI.modelSelector?.classList.remove('open');
            $$('.model-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
        });
    });

    $$('.sidebar-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            closeSidebar();
            const page = link.dataset.page;
            if (page === 'pricing') window.location.href = 'pricing.html';
            else if (page === 'admin') window.location.href = 'admin.html';
        });
    });
}

/* ========================================
   SIDEBAR
   ======================================== */
function toggleSidebar() {
    if (!UI.sidebar) return;
    if (window.innerWidth <= 768) {
        UI.sidebar.classList.toggle('active');
        UI.sidebarOverlay?.classList.toggle('active');
    } else {
        UI.sidebar.classList.toggle('collapsed');
    }
}

function closeSidebar() {
    UI.sidebar?.classList.remove('active', 'collapsed');
    UI.sidebarOverlay?.classList.remove('active');
}

/* ========================================
   INPUT
   ======================================== */
function autoResize() {
    if (!UI.messageInput) return;
    UI.messageInput.style.height = 'auto';
    UI.messageInput.style.height = Math.min(UI.messageInput.scrollHeight, 200) + 'px';
}

function onInputKey(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        send();
    }
}

/* ========================================
   CONVERSATIONS
   ======================================== */
async function loadConversations(q) {
    if (!UI.chatList) return;
    try {
        const res = await API.getConversations(q);
        State.chats = res.data || [];
        renderChatList();
    } catch (e) {
        console.error('Load conversations:', e);
    }
}

function renderChatList() {
    if (!UI.chatList) return;
    if (!State.chats.length) {
        UI.chatList.innerHTML = '<div class="empty-history"><i class="fas fa-comments"></i><p>No conversations yet</p></div>';
        return;
    }
    UI.chatList.innerHTML = State.chats.map(c => `
        <div class="chat-item ${c.id === State.currentChatId ? 'active' : ''}" data-id="${c.id}">
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

    UI.chatList.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.chat-item-btn')) return;
            openConversation(item.dataset.id);
        });
    });
    UI.chatList.querySelectorAll('.rename-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); renameChat(btn.dataset.id); });
    });
    UI.chatList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); deleteChat(btn.dataset.id); });
    });
}

async function createNewChat() {
    try {
        const res = await API.createConversation('New Chat', State.currentModel);
        State.currentChatId = res.data.id;
        await loadConversations();
        showChatView();
        if (UI.messagesContainer) UI.messagesContainer.innerHTML = '';
        if (UI.welcomeScreen) UI.welcomeScreen.style.display = '';
        if (UI.messageInput) UI.messageInput.focus();
    } catch (e) {
        showToast('Gagal membuat chat baru', 'error');
    }
}

async function openConversation(id) {
    try {
        const res = await API.getConversation(id);
        State.currentChatId = id;
        showChatView();
        renderMessages(res.data.messages || []);
        if (UI.welcomeScreen) UI.welcomeScreen.style.display = 'none';
        closeSidebar();
        renderChatList();
    } catch (e) {
        showToast('Gagal membuka percakapan', 'error');
    }
}

async function renameChat(id) {
    const chat = State.chats.find(c => c.id === id);
    const newTitle = prompt('Rename conversation:', chat?.title || '');
    if (!newTitle || newTitle === chat?.title) return;
    try {
        await API.updateConversation(id, newTitle);
        await loadConversations();
        showToast('Berhasil direname', 'success');
    } catch (e) {
        showToast('Gagal rename', 'error');
    }
}

async function deleteChat(id) {
    if (!confirm('Hapus percakapan ini?')) return;
    try {
        await API.deleteConversation(id);
        if (State.currentChatId === id) { State.currentChatId = null; showWelcome(); }
        await loadConversations();
        showToast('Berhasil dihapus', 'success');
    } catch (e) {
        showToast('Gagal menghapus', 'error');
    }
}

/* ========================================
   MESSAGES
   ======================================== */
function renderMessages(msgs) {
    if (!UI.messagesContainer) return;
    UI.messagesContainer.innerHTML = '';
    msgs.forEach(m => addMessage(m.role, m.content, m.model, m.id));
    scrollBottom();
}

function addMessage(role, content, model, id) {
    if (!UI.messagesContainer) return;
    if (UI.welcomeScreen) UI.welcomeScreen.style.display = 'none';

    const div = document.createElement('div');
    div.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;
    if (id) div.dataset.id = id;

    const avatarHtml = role === 'user'
        ? '<div class="message-avatar user-avatar"><i class="fas fa-user"></i></div>'
        : '<div class="message-avatar ai-avatar"><img src="https://j.top4top.io/p_3903uecld0.png" alt="AI"></div>';

    const actionsHtml = role === 'assistant'
        ? `<div class="message-actions"><button class="msg-action-btn copy-btn" title="Copy"><i class="fas fa-copy"></i></button></div>`
        : '';

    div.innerHTML = `${avatarHtml}<div class="message-body"><div class="message-content">${renderMd(content)}</div>${actionsHtml}</div>`;
    UI.messagesContainer.appendChild(div);

    const copyBtn = div.querySelector('.copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(content).then(() => {
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
            }).catch(() => fallbackCopy(content, copyBtn));
        });
    }
}

function fallbackCopy(text, btn) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    btn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
}

function renderMd(text) {
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
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, src) => {
            const safe = /^(https?:\/\/|data:)/i.test(src) ? src : '';
            return safe ? `<img src="${safe}" alt="${alt}" class="msg-image">` : '';
        })
        .replace(/\n/g, '<br>');
    return html;
}

function scrollBottom() {
    if (UI.messagesContainer) UI.messagesContainer.scrollTop = UI.messagesContainer.scrollHeight;
}

/* ========================================
   SEND MESSAGE
   ======================================== */
async function send() {
    if (State.isGenerating) return;
    const msg = UI.messageInput?.value?.trim();
    if (!msg) return;

    const userMsg = msg;
    UI.messageInput.value = '';
    autoResize();

    if (!State.currentChatId) {
        try {
            const res = await API.createConversation(userMsg.substring(0, 50), State.currentModel);
            State.currentChatId = res.data.id;
            await loadConversations();
        } catch (e) {
            showToast('Gagal membuat chat', 'error');
            UI.messageInput.value = userMsg;
            autoResize();
            return;
        }
    }

    addMessage('user', userMsg);
    scrollBottom();

    State.isGenerating = true;
    showLoading();

    try {
        const res = await API.sendMessage(State.currentChatId, userMsg, State.currentModel);
        State.isGenerating = false;
        hideLoading();

        if (res.success && res.data?.message) {
            addMessage('assistant', res.data.message.content, res.data.message.model, res.data.message.id);
            scrollBottom();
        } else {
            addMessage('assistant', 'Maaf, terjadi kesalahan. Silakan coba lagi.');
            scrollBottom();
        }

        if (res.data?.conversation?.title) {
            const idx = State.chats.findIndex(c => c.id === State.currentChatId);
            if (idx !== -1) State.chats[idx].title = res.data.conversation.title;
            renderChatList();
        }
    } catch (e) {
        console.error('Send error:', e);
        State.isGenerating = false;
        hideLoading();
        const errMsg = e?.error?.message || 'Gagal mengirim pesan. Coba lagi.';
        addMessage('assistant', '⚠️ ' + errMsg);
        scrollBottom();
    }
}

function showLoading() {
    if (UI.sendBtn) UI.sendBtn.style.display = 'none';
    if (UI.stopBtn) UI.stopBtn.style.display = '';
    const el = document.createElement('div');
    el.className = 'message ai-message typing-indicator';
    el.id = 'typingIndicator';
    el.innerHTML = '<div class="message-avatar ai-avatar"><img src="https://j.top4top.io/p_3903uecld0.png" alt="AI"></div><div class="message-body"><div class="message-content"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div></div>';
    UI.messagesContainer?.appendChild(el);
    scrollBottom();
}

function hideLoading() {
    if (UI.sendBtn) UI.sendBtn.style.display = '';
    if (UI.stopBtn) UI.stopBtn.style.display = 'none';
    $('typingIndicator')?.remove();
}

function stopGenerate() {
    State.isGenerating = false;
    hideLoading();
}

/* ========================================
   VIEWS
   ======================================== */
function showChatView() {
    if (UI.chatContainer) UI.chatContainer.style.display = '';
    if (UI.toolInterface) UI.toolInterface.classList.add('hidden');
    if (UI.inputArea) UI.inputArea.style.display = '';
}

function showWelcome() {
    if (UI.welcomeScreen) UI.welcomeScreen.style.display = '';
    if (UI.messagesContainer) UI.messagesContainer.innerHTML = '';
    if (UI.inputArea) UI.inputArea.style.display = '';
}

/* ========================================
   TOOLS
   ======================================== */
function openTool(tool) {
    State.currentTool = tool;
    State.currentDownloader = null;
    const titles = { 'cek-nomor': 'Cek Nomor', 'otp': 'OTP Generator', 'ssweb': 'Screenshot Web', 'translate': 'Translate' };
    if (UI.toolTitle) UI.toolTitle.textContent = titles[tool] || tool;
    if (UI.toolContent) {
        const forms = {
            'cek-nomor': '<div class="tool-form"><input type="text" id="toolInput1" placeholder="Nomor telepon (contoh: 08123456789)" class="tool-input"><button onclick="runTool()" class="tool-submit-btn">Cek</button></div>',
            'otp': '<div class="tool-form"><select id="toolInput1" class="tool-select"><option value="otps">OTP</option><option value="sms">SMS</option></select><input type="number" id="toolInput2" placeholder="Jumlah" value="10" class="tool-input"><button onclick="runTool()" class="tool-submit-btn">Generate</button></div>',
            'ssweb': '<div class="tool-form"><input type="text" id="toolInput1" placeholder="URL website" class="tool-input"><button onclick="runTool()" class="tool-submit-btn">Screenshot</button></div>',
            'translate': '<div class="tool-form"><textarea id="toolInput1" placeholder="Teks yang akan diterjemahkan" class="tool-textarea"></textarea><select id="toolInput2" class="tool-select"><option value="en">English</option><option value="id">Indonesia</option><option value="ja">Japanese</option><option value="ko">Korean</option><option value="ar">Arabic</option></select><button onclick="runTool()" class="tool-submit-btn">Translate</button></div>'
        };
        UI.toolContent.innerHTML = forms[tool] || '<p>Tool not available</p>';
    }
    if (UI.toolResult) UI.toolResult.innerHTML = '';
    if (UI.toolInterface) UI.toolInterface.classList.remove('hidden');
    if (UI.chatContainer) UI.chatContainer.style.display = 'none';
    if (UI.inputArea) UI.inputArea.style.display = 'none';
}

function openDownloader(platform) {
    State.currentDownloader = platform;
    State.currentTool = null;
    const titles = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', twitter: 'Twitter', youtube: 'YouTube', 'youtube-mp3': 'YouTube MP3', spotify: 'Spotify', safefileku: 'SafeFileKu' };
    if (UI.toolTitle) UI.toolTitle.textContent = (titles[platform] || platform) + ' Downloader';
    if (UI.toolContent) UI.toolContent.innerHTML = '<div class="tool-form"><input type="text" id="toolInput1" placeholder="Paste URL here" class="tool-input"><button onclick="runDownloader()" class="tool-submit-btn">Download</button></div>';
    if (UI.toolResult) UI.toolResult.innerHTML = '';
    if (UI.toolInterface) UI.toolInterface.classList.remove('hidden');
    if (UI.chatContainer) UI.chatContainer.style.display = 'none';
    if (UI.inputArea) UI.inputArea.style.display = 'none';
}

async function runTool() {
    const v1 = $('toolInput1')?.value;
    if (!v1) return showToast('Isi field yang diperlukan', 'error');
    if (UI.toolResult) UI.toolResult.innerHTML = '<div class="tool-loading"><i class="fas fa-spinner fa-spin"></i> Processing...</div>';
    try {
        let data;
        switch (State.currentTool) {
            case 'cek-nomor': data = await API.cekNomor(v1); break;
            case 'otp': data = await API.generateOTP(v1, $('toolInput2')?.value || '10', 'indonesia'); break;
            case 'ssweb': data = await API.screenshotWeb(v1); break;
            case 'translate': data = await API.translate(v1, $('toolInput2')?.value || 'en', 'auto'); break;
        }
        if (UI.toolResult) UI.toolResult.innerHTML = '<div class="tool-result-content"><pre>' + escHtml(JSON.stringify(data?.data || data, null, 2)) + '</pre></div>';
    } catch (e) {
        if (UI.toolResult) UI.toolResult.innerHTML = '<div class="tool-error">Error: ' + escHtml(e?.error?.message || 'Gagal') + '</div>';
    }
}

async function runDownloader() {
    const url = $('toolInput1')?.value;
    if (!url) return showToast('Paste URL dulu', 'error');
    if (UI.toolResult) UI.toolResult.innerHTML = '<div class="tool-loading"><i class="fas fa-spinner fa-spin"></i> Downloading...</div>';
    try {
        const data = await API.download(State.currentDownloader, url);
        if (UI.toolResult) UI.toolResult.innerHTML = '<div class="tool-result-content"><pre>' + escHtml(JSON.stringify(data?.data || data, null, 2)) + '</pre></div>';
    } catch (e) {
        if (UI.toolResult) UI.toolResult.innerHTML = '<div class="tool-error">Error: ' + escHtml(e?.error?.message || 'Gagal') + '</div>';
    }
}

/* ========================================
   VOICE
   ======================================== */
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingTimer = null;
let recordingSeconds = 0;

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
        UI.micBtn?.classList.add('recording');
        UI.recordingIndicator?.classList.add('active');
        recordingTimer = setInterval(() => {
            recordingSeconds++;
            if (UI.recordingTimer) UI.recordingTimer.textContent = formatTime(recordingSeconds);
        }, 1000);
    } catch (e) {
        showToast('Izin mikrofon ditolak', 'error');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    isRecording = false;
    UI.micBtn?.classList.remove('recording');
    UI.recordingIndicator?.classList.remove('active');
    clearInterval(recordingTimer);
    if (mediaRecorder?.stream) mediaRecorder.stream.getTracks().forEach(t => t.stop());
}

function cancelRecording() {
    audioChunks = [];
    stopRecording();
}

async function processAudio() {
    if (!audioChunks.length || audioChunks.every(c => c.size === 0)) {
        showToast('Tidak ada audio', 'warning');
        return;
    }
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    if (blob.size === 0) { showToast('Tidak ada audio', 'warning'); return; }
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64 = reader.result.split(',')[1];
        try {
            const data = await API.speechToText(base64);
            if (data.data?.text) {
                UI.messageInput.value = data.data.text;
                autoResize();
                showToast('Transkripsi selesai', 'success');
            } else {
                showToast('Tidak ada suara terdeteksi', 'warning');
            }
        } catch (e) {
            showToast('Gagal mengenali suara', 'error');
        }
    };
    reader.readAsDataURL(blob);
}

function formatTime(s) {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

/* ========================================
   FILE UPLOAD
   ======================================== */
async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('File terlalu besar (max 10MB)', 'error'); return; }
    if (UI.attachmentPreview) {
        UI.attachmentPreview.innerHTML = `<div class="attachment-item"><i class="fas ${file.type.startsWith('image/') ? 'fa-image' : 'fa-file'}"></i><span>${escHtml(file.name)} (${(file.size / 1024).toFixed(1)}KB)</span><button onclick="removeAttachment()" class="remove-attachment"><i class="fas fa-times"></i></button></div>`;
        UI.attachmentPreview.style.display = '';
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
    if (UI.attachmentPreview) { UI.attachmentPreview.innerHTML = ''; UI.attachmentPreview.style.display = 'none'; }
}

/* ========================================
   LOGOUT
   ======================================== */
async function logout() {
    try { await API.logout(); } catch {}
    localStorage.removeItem('mazval_user');
    localStorage.removeItem('mazval_token');
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', init);
