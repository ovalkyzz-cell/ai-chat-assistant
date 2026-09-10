(function() {
    var user = null;
    try { user = JSON.parse(localStorage.getItem('mazval_user')); } catch(e) {}
    if (!user) { window.location.href = 'login.html'; return; }
    if (user.status !== 'approved' && user.role !== 'admin') { window.location.href = 'login.html'; return; }

    var State = { chats: [], chatId: null, model: 'chatgpt', generating: false, tool: null, downloader: null };

    function $(id) { return document.getElementById(id); }
    function $$(sel) { return document.querySelectorAll(sel); }

    var UI = {};
    function cache() {
        UI = {
            sidebar: $('sidebar'), sidebarOverlay: $('sidebarOverlay'), sidebarToggle: $('sidebarToggle'),
            newChatBtn: $('newChatBtn'), chatList: $('chatList'), chatContainer: $('chatContainer'),
            welcome: $('welcomeScreen'), msgs: $('messagesContainer'), input: $('messageInput'),
            sendBtn: $('sendBtn'), stopBtn: $('stopBtn'), userName: $('userName'), logoutBtn: $('logoutBtn'),
            inputArea: $('inputArea'), chatsPanel: $('chatsPanel'), toolsPanel: $('toolsPanel'),
            downloadersPanel: $('downloadersPanel'), toolInterface: $('toolInterface'),
            toolTitle: $('toolTitle'), toolContent: $('toolContent'), toolResult: $('toolResult'),
            backToChat: $('backToChat'), modelSelector: $('modelSelector'), modelCurrent: $('modelCurrent'),
            modelDropdown: $('modelDropdown'), historySearch: $('historySearch'),
            micBtn: $('micBtn'), attachBtn: $('attachBtn'), fileInput: $('fileInput'),
            attachPreview: $('attachmentPreview'), adminLink: $('adminLink'),
            recIndicator: $('recordingIndicator'), recTimer: $('recordingTimer')
        };
    }

    function scrollBottom() { if (UI.msgs) UI.msgs.scrollTop = UI.msgs.scrollHeight; }

    function autoResize() {
        if (!UI.input) return;
        UI.input.style.height = 'auto';
        UI.input.style.height = Math.min(UI.input.scrollHeight, 200) + 'px';
    }

    function showChatView() {
        if (UI.chatContainer) UI.chatContainer.style.display = '';
        if (UI.toolInterface) UI.toolInterface.classList.add('hidden');
        if (UI.inputArea) UI.inputArea.style.display = '';
    }

    function showWelcome() {
        if (UI.welcome) UI.welcome.style.display = '';
        if (UI.msgs) UI.msgs.innerHTML = '';
        if (UI.inputArea) UI.inputArea.style.display = '';
    }

    function showLoading() {
        if (UI.sendBtn) UI.sendBtn.style.display = 'none';
        if (UI.stopBtn) UI.stopBtn.style.display = '';
        var el = document.createElement('div');
        el.className = 'message ai-message typing-indicator';
        el.id = 'typingIndicator';
        el.innerHTML = '<div class="message-avatar ai-avatar"><img src="https://j.top4top.io/p_3903uecld0.png" alt="AI"></div><div class="message-body"><div class="message-content"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div></div>';
        if (UI.msgs) { UI.msgs.appendChild(el); scrollBottom(); }
    }

    function hideLoading() {
        if (UI.sendBtn) UI.sendBtn.style.display = '';
        if (UI.stopBtn) UI.stopBtn.style.display = 'none';
        var el = document.getElementById('typingIndicator');
        if (el) el.remove();
    }

    function renderMd(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^\- (.+)$/gm, '<li>$1</li>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(m, alt, src) {
                return /^(https?:\/\/|data:)/i.test(src) ? '<img src="' + src + '" alt="' + alt + '" class="msg-image">' : '';
            })
            .replace(/\n/g, '<br>');
    }

    function addMessage(role, content) {
        if (!UI.msgs) return;
        if (UI.welcome) UI.welcome.style.display = 'none';
        var div = document.createElement('div');
        div.className = 'message ' + (role === 'user' ? 'user-message' : 'ai-message');
        var avatar = role === 'user'
            ? '<div class="message-avatar user-avatar"><i class="fas fa-user"></i></div>'
            : '<div class="message-avatar ai-avatar"><img src="https://j.top4top.io/p_3903uecld0.png" alt="AI"></div>';
        var actions = role === 'assistant'
            ? '<div class="message-actions"><button class="msg-action-btn copy-btn" title="Copy"><i class="fas fa-copy"></i></button></div>'
            : '';
        div.innerHTML = avatar + '<div class="message-body"><div class="message-content">' + renderMd(content) + '</div>' + actions + '</div>';
        UI.msgs.appendChild(div);
        var btn = div.querySelector('.copy-btn');
        if (btn) {
            btn.addEventListener('click', function() {
                navigator.clipboard.writeText(content).then(function() {
                    btn.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(function() { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
                }).catch(function() {
                    var ta = document.createElement('textarea');
                    ta.value = content; ta.style.position = 'fixed'; ta.style.opacity = '0';
                    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
                    btn.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(function() { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
                });
            });
        }
    }

    function renderChatList() {
        if (!UI.chatList) return;
        if (!State.chats.length) {
            UI.chatList.innerHTML = '<div class="empty-history"><i class="fas fa-comments"></i><p>No conversations yet</p></div>';
            return;
        }
        UI.chatList.innerHTML = State.chats.map(function(c) {
            return '<div class="chat-item ' + (c.id === State.chatId ? 'active' : '') + '" data-id="' + c.id + '">' +
                '<div class="chat-item-content"><i class="fas fa-message chat-item-icon"></i>' +
                '<span class="chat-item-title">' + escHtml(c.title || 'New Chat') + '</span></div>' +
                '<div class="chat-item-actions">' +
                '<button class="chat-item-btn rename-btn" data-id="' + c.id + '" title="Rename"><i class="fas fa-pen"></i></button>' +
                '<button class="chat-item-btn delete-btn" data-id="' + c.id + '" title="Delete"><i class="fas fa-trash"></i></button>' +
                '</div></div>';
        }).join('');

        UI.chatList.querySelectorAll('.chat-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.chat-item-btn')) return;
                openConversation(item.dataset.id);
            });
        });
        UI.chatList.querySelectorAll('.rename-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) { e.stopPropagation(); renameChat(btn.dataset.id); });
        });
        UI.chatList.querySelectorAll('.delete-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) { e.stopPropagation(); deleteChat(btn.dataset.id); });
        });
    }

    function loadConversations(q) {
        if (!UI.chatList) return;
        API.getConversations(q).then(function(res) {
            State.chats = res.data || [];
            renderChatList();
        }).catch(function(e) { console.error('Load conversations:', e); });
    }

    function createNewChat() {
        API.createConversation('New Chat', State.model).then(function(res) {
            State.chatId = res.data.id;
            loadConversations();
            showChatView();
            if (UI.msgs) UI.msgs.innerHTML = '';
            if (UI.welcome) UI.welcome.style.display = '';
            if (UI.input) UI.input.focus();
        }).catch(function() { showToast('Gagal membuat chat', 'error'); });
    }

    function openConversation(id) {
        API.getConversation(id).then(function(res) {
            State.chatId = id;
            showChatView();
            if (UI.msgs) UI.msgs.innerHTML = '';
            var msgs = res.data.messages || [];
            msgs.forEach(function(m) { addMessage(m.role, m.content); });
            scrollBottom();
            if (UI.welcome) UI.welcome.style.display = 'none';
            closeSidebar();
            renderChatList();
        }).catch(function() { showToast('Gagal membuka percakapan', 'error'); });
    }

    function renameChat(id) {
        var chat = State.chats.find(function(c) { return c.id === id; });
        var newTitle = prompt('Rename conversation:', chat ? chat.title : '');
        if (!newTitle) return;
        API.updateConversation(id, newTitle).then(function() {
            loadConversations();
            showToast('Berhasil direname', 'success');
        }).catch(function() { showToast('Gagal rename', 'error'); });
    }

    function deleteChat(id) {
        if (!confirm('Hapus percakapan ini?')) return;
        API.deleteConversation(id).then(function() {
            if (State.chatId === id) { State.chatId = null; showWelcome(); }
            loadConversations();
            showToast('Berhasil dihapus', 'success');
        }).catch(function() { showToast('Gagal menghapus', 'error'); });
    }

    function send() {
        if (State.generating) return;
        var msg = UI.input ? UI.input.value.trim() : '';
        if (!msg) return;

        var userMsg = msg;
        UI.input.value = '';
        autoResize();

        if (!State.chatId) {
            API.createConversation(userMsg.substring(0, 50), State.model).then(function(res) {
                State.chatId = res.data.id;
                loadConversations();
                doSend(userMsg);
            }).catch(function() {
                showToast('Gagal membuat chat', 'error');
                UI.input.value = userMsg;
                autoResize();
            });
        } else {
            doSend(userMsg);
        }
    }

    function doSend(userMsg) {
        addMessage('user', userMsg);
        scrollBottom();
        State.generating = true;
        showLoading();

        API.sendMessage(State.chatId, userMsg, State.model).then(function(res) {
            State.generating = false;
            hideLoading();
            if (res.success && res.data && res.data.message) {
                addMessage('assistant', res.data.message.content);
                scrollBottom();
            } else {
                addMessage('assistant', 'Maaf, terjadi kesalahan. Silakan coba lagi.');
                scrollBottom();
            }
            if (res.data && res.data.conversation && res.data.conversation.title) {
                var idx = State.chats.findIndex(function(c) { return c.id === State.chatId; });
                if (idx !== -1) State.chats[idx].title = res.data.conversation.title;
                renderChatList();
            }
        }).catch(function(e) {
            console.error('Send error:', e);
            State.generating = false;
            hideLoading();
            var errMsg = (e && e.error && e.error.message) ? e.error.message : 'Gagal mengirim pesan.';
            addMessage('assistant', '⚠️ ' + errMsg);
            scrollBottom();
        });
    }

    function stopGenerate() {
        State.generating = false;
        hideLoading();
    }

    function openTool(tool) {
        State.tool = tool;
        State.downloader = null;
        var titles = { 'cek-nomor': 'Cek Nomor', 'otp': 'OTP Generator', 'ssweb': 'Screenshot Web', 'translate': 'Translate' };
        if (UI.toolTitle) UI.toolTitle.textContent = titles[tool] || tool;
        if (UI.toolContent) {
            var forms = {
                'cek-nomor': '<div class="tool-form"><input type="text" id="toolInput1" placeholder="Nomor telepon" class="tool-input"><button onclick="window._runTool()" class="tool-submit-btn">Cek</button></div>',
                'otp': '<div class="tool-form"><select id="toolInput1" class="tool-select"><option value="otps">OTP</option><option value="sms">SMS</option></select><input type="number" id="toolInput2" placeholder="Jumlah" value="10" class="tool-input"><button onclick="window._runTool()" class="tool-submit-btn">Generate</button></div>',
                'ssweb': '<div class="tool-form"><input type="text" id="toolInput1" placeholder="URL website" class="tool-input"><button onclick="window._runTool()" class="tool-submit-btn">Screenshot</button></div>',
                'translate': '<div class="tool-form"><textarea id="toolInput1" placeholder="Teks yang akan diterjemahkan" class="tool-textarea"></textarea><select id="toolInput2" class="tool-select"><option value="en">English</option><option value="id">Indonesia</option><option value="ja">Japanese</option><option value="ko">Korean</option><option value="ar">Arabic</option></select><button onclick="window._runTool()" class="tool-submit-btn">Translate</button></div>'
            };
            UI.toolContent.innerHTML = forms[tool] || '<p>Tool not available</p>';
        }
        if (UI.toolResult) UI.toolResult.innerHTML = '';
        if (UI.toolInterface) UI.toolInterface.classList.remove('hidden');
        if (UI.chatContainer) UI.chatContainer.style.display = 'none';
        if (UI.inputArea) UI.inputArea.style.display = 'none';
    }

    function runTool() {
        var v1 = document.getElementById('toolInput1') ? document.getElementById('toolInput1').value : '';
        if (!v1) return showToast('Isi field yang diperlukan', 'error');
        if (UI.toolResult) UI.toolResult.innerHTML = '<div class="tool-loading"><i class="fas fa-spinner fa-spin"></i> Processing...</div>';
        var promise;
        switch (State.tool) {
            case 'cek-nomor': promise = API.cekNomor(v1); break;
            case 'otp': promise = API.generateOTP(v1, (document.getElementById('toolInput2') ? document.getElementById('toolInput2').value : '10'), 'indonesia'); break;
            case 'ssweb': promise = API.screenshotWeb(v1); break;
            case 'translate': promise = API.translate(v1, (document.getElementById('toolInput2') ? document.getElementById('toolInput2').value : 'en'), 'auto'); break;
        }
        if (promise) {
            promise.then(function(data) {
                if (UI.toolResult) UI.toolResult.innerHTML = '<div class="tool-result-content"><pre>' + escHtml(JSON.stringify(data.data || data, null, 2)) + '</pre></div>';
            }).catch(function(e) {
                if (UI.toolResult) UI.toolResult.innerHTML = '<div class="tool-error">Error: ' + escHtml((e && e.error && e.error.message) || 'Gagal') + '</div>';
            });
        }
    }

    function openDownloader(platform) {
        State.downloader = platform;
        State.tool = null;
        var titles = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', twitter: 'Twitter', youtube: 'YouTube', 'youtube-mp3': 'YouTube MP3', spotify: 'Spotify', safefileku: 'SafeFileKu' };
        if (UI.toolTitle) UI.toolTitle.textContent = (titles[platform] || platform) + ' Downloader';
        if (UI.toolContent) UI.toolContent.innerHTML = '<div class="tool-form"><input type="text" id="toolInput1" placeholder="Paste URL here" class="tool-input"><button onclick="window._runDownloader()" class="tool-submit-btn">Download</button></div>';
        if (UI.toolResult) UI.toolResult.innerHTML = '';
        if (UI.toolInterface) UI.toolInterface.classList.remove('hidden');
        if (UI.chatContainer) UI.chatContainer.style.display = 'none';
        if (UI.inputArea) UI.inputArea.style.display = 'none';
    }

    function runDownloader() {
        var url = document.getElementById('toolInput1') ? document.getElementById('toolInput1').value : '';
        if (!url) return showToast('Paste URL dulu', 'error');
        if (UI.toolResult) UI.toolResult.innerHTML = '<div class="tool-loading"><i class="fas fa-spinner fa-spin"></i> Downloading...</div>';
        API.download(State.downloader, url).then(function(data) {
            if (UI.toolResult) UI.toolResult.innerHTML = '<div class="tool-result-content"><pre>' + escHtml(JSON.stringify(data.data || data, null, 2)) + '</pre></div>';
        }).catch(function(e) {
            if (UI.toolResult) UI.toolResult.innerHTML = '<div class="tool-error">Error: ' + escHtml((e && e.error && e.error.message) || 'Gagal') + '</div>';
        });
    }

    window._runTool = runTool;
    window._runDownloader = runDownloader;

    var mediaRecorder = null, audioChunks = [], isRecording = false, recTimer = null, recSeconds = 0;

    function toggleRecording() {
        if (isRecording) { stopRecording(); return; }
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = function(e) { audioChunks.push(e.data); };
            mediaRecorder.onstop = function() {
                if (!audioChunks.length) { showToast('Tidak ada audio', 'warning'); return; }
                var blob = new Blob(audioChunks, { type: 'audio/webm' });
                var reader = new FileReader();
                reader.onloadend = function() {
                    var base64 = reader.result.split(',')[1];
                    API.speechToText(base64).then(function(data) {
                        if (data.data && data.data.text) {
                            UI.input.value = data.data.text;
                            autoResize();
                            showToast('Transkripsi selesai', 'success');
                        } else { showToast('Tidak ada suara terdeteksi', 'warning'); }
                    }).catch(function() { showToast('Gagal mengenali suara', 'error'); });
                };
                reader.readAsDataURL(blob);
            };
            mediaRecorder.start();
            isRecording = true;
            recSeconds = 0;
            if (UI.micBtn) UI.micBtn.classList.add('recording');
            if (UI.recIndicator) UI.recIndicator.classList.add('active');
            recTimer = setInterval(function() {
                recSeconds++;
                var m = Math.floor(recSeconds / 60);
                var s = recSeconds % 60;
                if (UI.recTimer) UI.recTimer.textContent = m + ':' + (s < 10 ? '0' : '') + s;
            }, 1000);
        }).catch(function() { showToast('Izin mikrofon ditolak', 'error'); });
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
        isRecording = false;
        if (UI.micBtn) UI.micBtn.classList.remove('recording');
        if (UI.recIndicator) UI.recIndicator.classList.remove('active');
        clearInterval(recTimer);
        if (mediaRecorder && mediaRecorder.stream) mediaRecorder.stream.getTracks().forEach(function(t) { t.stop(); });
    }

    window.cancelRecording = function() { audioChunks = []; stopRecording(); };

    function handleFile(e) {
        var file = e.target.files ? e.target.files[0] : null;
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) { showToast('File terlalu besar (max 10MB)', 'error'); return; }
        if (UI.attachPreview) {
            UI.attachPreview.innerHTML = '<div class="attachment-item"><i class="fas ' + (file.type.startsWith('image/') ? 'fa-image' : 'fa-file') + '"></i><span>' + escHtml(file.name) + '</span><button onclick="window._removeAttach()" class="remove-attachment"><i class="fas fa-times"></i></button></div>';
            UI.attachPreview.style.display = '';
        }
        var reader = new FileReader();
        reader.onloadend = function() {
            var base64 = reader.result.split(',')[1];
            API.uploadFile(base64, file.name, file.type).catch(function() {});
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    window._removeAttach = function() { if (UI.attachPreview) { UI.attachPreview.innerHTML = ''; UI.attachPreview.style.display = 'none'; } };

    function closeSidebar() {
        if (UI.sidebar) UI.sidebar.classList.remove('active', 'collapsed');
        if (UI.sidebarOverlay) UI.sidebarOverlay.classList.remove('active');
    }

    function toggleSidebar() {
        if (!UI.sidebar) return;
        if (window.innerWidth <= 768) {
            UI.sidebar.classList.toggle('active');
            if (UI.sidebarOverlay) UI.sidebarOverlay.classList.toggle('active');
        } else {
            UI.sidebar.classList.toggle('collapsed');
        }
    }

    function logout() {
        API.logout().then(function() {
            localStorage.removeItem('mazval_user');
            localStorage.removeItem('mazval_token');
            window.location.href = 'login.html';
        }).catch(function() {
            localStorage.removeItem('mazval_user');
            localStorage.removeItem('mazval_token');
            window.location.href = 'login.html';
        });
    }

    cache();
    if (UI.userName) UI.userName.textContent = user.name || user.email.split('@')[0];
    if (UI.adminLink) UI.adminLink.style.display = user.role === 'admin' ? '' : 'none';

    if (UI.sidebarToggle) UI.sidebarToggle.addEventListener('click', toggleSidebar);
    if (UI.sidebarOverlay) UI.sidebarOverlay.addEventListener('click', closeSidebar);
    if (UI.newChatBtn) UI.newChatBtn.addEventListener('click', function() { showChatView(); createNewChat(); });
    if (UI.input) {
        UI.input.addEventListener('input', autoResize);
        UI.input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
            }
        });
    }
    if (UI.sendBtn) UI.sendBtn.addEventListener('click', function(e) { e.preventDefault(); send(); });
    if (UI.stopBtn) UI.stopBtn.addEventListener('click', stopGenerate);
    if (UI.backToChat) UI.backToChat.addEventListener('click', showChatView);
    if (UI.logoutBtn) UI.logoutBtn.addEventListener('click', logout);
    if (UI.historySearch) UI.historySearch.addEventListener('input', function(e) { loadConversations(e.target.value); });
    if (UI.micBtn) UI.micBtn.addEventListener('click', toggleRecording);
    if (UI.attachBtn) UI.attachBtn.addEventListener('click', function() { if (UI.fileInput) UI.fileInput.click(); });
    if (UI.fileInput) UI.fileInput.addEventListener('change', handleFile);

    $$('.suggestion-card').forEach(function(c) {
        c.addEventListener('click', function() {
            if (UI.input) { UI.input.value = c.dataset.prompt; autoResize(); send(); }
        });
    });

    $$('.nav-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            $$('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
            tab.classList.add('active');
            var target = tab.dataset.tab;
            if (UI.chatsPanel) UI.chatsPanel.classList.toggle('hidden', target !== 'chats');
            if (UI.toolsPanel) UI.toolsPanel.classList.toggle('hidden', target !== 'tools');
            if (UI.downloadersPanel) UI.downloadersPanel.classList.toggle('hidden', target !== 'downloaders');
        });
    });

    $$('.tool-item[data-tool]').forEach(function(i) { i.addEventListener('click', function() { openTool(i.dataset.tool); }); });
    $$('.tool-item[data-downloader]').forEach(function(i) { i.addEventListener('click', function() { openDownloader(i.dataset.downloader); }); });

    if (UI.modelCurrent) {
        UI.modelCurrent.addEventListener('click', function(e) {
            e.stopPropagation();
            if (UI.modelDropdown) UI.modelDropdown.classList.toggle('active');
            if (UI.modelSelector) UI.modelSelector.classList.toggle('open');
        });
    }
    document.addEventListener('click', function() {
        if (UI.modelDropdown) UI.modelDropdown.classList.remove('active');
        if (UI.modelSelector) UI.modelSelector.classList.remove('open');
    });
    if (UI.modelDropdown) UI.modelDropdown.addEventListener('click', function(e) { e.stopPropagation(); });

    $$('.model-option').forEach(function(opt) {
        opt.addEventListener('click', function() {
            State.model = opt.dataset.model;
            var name = opt.querySelector('.model-name') ? opt.querySelector('.model-name').textContent : opt.dataset.model;
            if (UI.modelCurrent) { var mn = UI.modelCurrent.querySelector('.model-name'); if (mn) mn.textContent = name; }
            if (UI.modelDropdown) UI.modelDropdown.classList.remove('active');
            if (UI.modelSelector) UI.modelSelector.classList.remove('open');
            $$('.model-option').forEach(function(o) { o.classList.remove('active'); });
            opt.classList.add('active');
        });
    });

    loadConversations();
})();
