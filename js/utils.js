function showToast(msg, type) {
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    t.innerHTML = '<i class="fas ' + (icons[type] || 'fa-info-circle') + '"></i><span>' + msg + '</span>';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

function escHtml(t) {
    if (!t) return '';
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}
