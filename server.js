const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-login.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════╗
    ║                                              ║
    ║   🤖 AI Chat Assistant Server               ║
    ║                                              ║
    ║   Server running at:                         ║
    ║   http://localhost:${PORT}                      ║
    ║                                              ║
    ║   Pages:                                     ║
    ║   • Chat:      http://localhost:${PORT}          ║
    ║   • Login:     http://localhost:${PORT}/login    ║
    ║   • Register:  http://localhost:${PORT}/register ║
    ║   • Admin:     http://localhost:${PORT}/admin    ║
    ║                                              ║
    ║   Admin Credentials:                         ║
    ║   • Access Key: ADMIN@MAZZVALL2024           ║
    ║   • Email: admin@mazzvall.com                ║
    ║   • Password: Admin@Secure123!               ║
    ║                                              ║
    ║   © Created Mazz-Vall                        ║
    ║                                              ║
    ╚══════════════════════════════════════════════╝
    `);
});
