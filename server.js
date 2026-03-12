// ========================================
// SPARK — Production Server (Fixed)
// ========================================
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const http = require('http');
const { Server } = require('socket.io');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const crypto = require('crypto');
const db = require('./db');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '763153801999-pggubb51vqlli45492dop5pkmdu1fdvc.apps.googleusercontent.com');
console.log('✅ Modules loaded');


// ========================================
// OTP Storage
// ========================================
const otpStore = new Map();
const OTP_EXPIRY_MS = 10 * 60 * 1000;

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

setInterval(() => {
    const now = Date.now();
    for (const [email, data] of otpStore.entries()) {
        if (now > data.expiresAt) otpStore.delete(email);
    }
}, 5 * 60 * 1000);

// ========================================
// Email Setup
// ========================================
const OTP_HTML = (otp) => `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;color:#fff;">
        <h1 style="text-align:center;color:#D4AF37;">SPARK ✨</h1>
        <p style="text-align:center;color:#ccc;">Your verification code is:</p>
        <div style="text-align:center;font-size:36px;font-weight:bold;letter-spacing:8px;color:#D4AF37;background:#050505;padding:20px;border-radius:12px;margin:20px 0;border:1px solid rgba(212,175,55,0.3);">
            ${otp}
        </div>
        <p style="text-align:center;color:#888;font-size:14px;">This code expires in 10 minutes.<br>If you didn't request this, please ignore this email.</p>
    </div>
`;

// ========================================
// Email Sending — NO DEV BYPASS
// OTP verification is the ONLY thing that ensures
// users are real NITK students. It must always work.
// ========================================

function checkEmailConfig() {
    const providers = [];
    const missing = [];

    if (process.env.RESEND_API_KEY?.trim()) providers.push('Resend');
    else missing.push('RESEND_API_KEY');

    if (process.env.BREVO_API_KEY?.trim()) providers.push('Brevo');
    else missing.push('BREVO_API_KEY');

    if (process.env.MAILJET_API_KEY?.trim() && process.env.MAILJET_SECRET_KEY?.trim()) {
        providers.push('Mailjet');
    } else {
        if (!process.env.MAILJET_API_KEY?.trim()) missing.push('MAILJET_API_KEY');
        if (!process.env.MAILJET_SECRET_KEY?.trim()) missing.push('MAILJET_SECRET_KEY');
    }

    if (process.env.SENDGRID_API_KEY?.trim()) providers.push('SendGrid');
    else missing.push('SENDGRID_API_KEY');

    if (process.env.SMTP_EMAIL?.trim() && process.env.SMTP_PASSWORD?.trim()) {
        providers.push('Gmail SMTP');
    } else {
        if (!process.env.SMTP_EMAIL?.trim()) missing.push('SMTP_EMAIL');
        if (!process.env.SMTP_PASSWORD?.trim()) missing.push('SMTP_PASSWORD');
    }

    if (providers.length === 0) {
        console.error('');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ FATAL: No email provider configured!');
        console.error('');
        console.error('SPARK REQUIRES email to verify NITK students.');
        console.error('Missing variables: ' + missing.join(', '));
        console.error('');
        console.error('Option 1 — Gmail SMTP (easiest):');
        console.error('  Set in .env:');
        console.error('     SMTP_EMAIL=your@gmail.com');
        console.error('     SMTP_PASSWORD=xxxx xxxx xxxx xxxx');
        console.error('');
        console.error('Option 2 — API Providers (SendGrid, Resend, Brevo, etc.):');
        console.error('  Set the corresponding API keys in .env');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('');
        // NOTE: In production, we exit. In dev, we might want to just warn, 
        // but since OTP is critical, we keep it strict.
        process.exit(1);
    }
    console.log(`📧 Detected Email Providers: ${providers.join(', ')}`);
}

async function sendOTPEmail(toEmail, otp) {
    const smtpEmail = (process.env.SMTP_EMAIL || '').trim();
    const displayEmail = (process.env.SENDER_DISPLAY_EMAIL || smtpEmail || 'noreply@aura.app').trim();
    const displayName = 'SPARK';
    const subject = '🔐 SPARK — Your Verification Code';
    const html = OTP_HTML(otp);

    const errors = [];

    // --- 1. Gmail SMTP (Now Primary) ---
    if (smtpEmail && process.env.SMTP_PASSWORD?.trim()) {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: smtpEmail,
                pass: process.env.SMTP_PASSWORD.trim()
            },
            // Render specific tweaks for connections
            pool: true,
            maxConnections: 1,
            maxMessages: 10,
            tls: { rejectUnauthorized: false },
            family: 4,
            connectionTimeout: 20000,
            greetingTimeout: 20000,
            socketTimeout: 20000
        });

        try {
            const info = await transporter.sendMail({
                from: `"${displayName}" <${smtpEmail}>`,
                replyTo: `"${displayName}" <${displayEmail}>`,
                to: toEmail,
                subject: subject,
                html: html,
                headers: { 'X-Mailer': 'SPARK App' }
            });

            console.log(`✅ [Gmail SMTP] OTP sent to ${toEmail} (msgId: ${info.messageId})`);
            return;
        } catch (smtpErr) {
            console.error(`❌ [Gmail SMTP] Failed to send to ${toEmail}:`, smtpErr.message);
            errors.push(`SMTP Error: ${smtpErr.message}`);
        } finally {
            transporter.close();
        }
    }

    // --- 2. Resend API ---
    if (process.env.RESEND_API_KEY?.trim()) {
        try {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: `${displayName} <${displayEmail}>`,
                    to: [toEmail],
                    subject: subject,
                    html: html
                })
            });
            if (res.ok) {
                console.log(`✅ [Resend] OTP sent to ${toEmail}`);
                return;
            }
            const errText = await res.text();
            console.error(`❌ [Resend] HTTP ${res.status}: ${errText}`);
            errors.push(`Resend: ${res.status} ${errText}`);
        } catch (e) {
            console.error('❌ [Resend] Exception:', e.message);
            errors.push(`Resend Error: ${e.message}`);
        }
    }

    // --- 3. Brevo (Sendinblue) API ---
    if (process.env.BREVO_API_KEY?.trim()) {
        try {
            const res = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'api-key': process.env.BREVO_API_KEY.trim(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sender: { name: displayName, email: displayEmail },
                    to: [{ email: toEmail }],
                    subject: subject,
                    htmlContent: html
                })
            });
            if (res.ok) {
                console.log(`✅ [Brevo] OTP sent to ${toEmail}`);
                return;
            }
            const errText = await res.text();
            console.error(`❌ [Brevo] HTTP ${res.status}: ${errText}`);
            errors.push(`Brevo: ${res.status} ${errText}`);
        } catch (e) {
            console.error('❌ [Brevo] Exception:', e.message);
            errors.push(`Brevo Error: ${e.message}`);
        }
    }

    // --- 4. Mailjet API ---
    if (process.env.MAILJET_API_KEY?.trim() && process.env.MAILJET_SECRET_KEY?.trim()) {
        try {
            const auth = Buffer.from(`${process.env.MAILJET_API_KEY.trim()}:${process.env.MAILJET_SECRET_KEY.trim()}`).toString('base64');
            const res = await fetch('https://api.mailjet.com/v3.1/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    Messages: [{
                        From: { Email: displayEmail, Name: displayName },
                        To: [{ Email: toEmail }],
                        Subject: subject,
                        HTMLPart: html
                    }]
                })
            });
            if (res.ok) {
                console.log(`✅ [Mailjet] OTP sent to ${toEmail}`);
                return;
            }
            const errText = await res.text();
            console.error(`❌ [Mailjet] HTTP ${res.status}: ${errText}`);
            errors.push(`Mailjet: ${res.status} ${errText}`);
        } catch (e) {
            console.error('❌ [Mailjet] Exception:', e.message);
            errors.push(`Mailjet Error: ${e.message}`);
        }
    }

    // --- 5. SendGrid API ---
    if (process.env.SENDGRID_API_KEY?.trim()) {
        try {
            const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.SENDGRID_API_KEY.trim()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    personalizations: [{ to: [{ email: toEmail }] }],
                    from: { email: displayEmail, name: displayName },
                    reply_to: { email: displayEmail, name: displayName },
                    subject: subject,
                    content: [{ type: 'text/html', value: html }]
                })
            });
            if (res.ok) {
                console.log(`✅ [SendGrid] OTP sent to ${toEmail}`);
                return;
            }
            const errText = await res.text();
            console.error(`❌ [SendGrid] HTTP ${res.status}: ${errText}`);
            errors.push(`SendGrid: ${res.status} ${errText}`);
        } catch (e) {
            console.error('❌ [SendGrid] Exception:', e.message);
            errors.push(`SendGrid Error: ${e.message}`);
        }
    }

    // Final failure check
    const errorMsg = 'All email delivery attempts failed. Please contact support.';
    console.error(errorMsg, errors);
    throw new Error(`${errorMsg} Details: ${errors.join(' | ')}`);
}


// ========================================
// Server & Socket Setup
// ========================================
const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const JWT_SECRET = process.env.JWT_SECRET || 'spark_dev_secret_2025_safe';

const onlineUsers = new Set();

io.on('connection', (socket) => {
    socket.on('register', (userId) => {
        if (userId) {
            socket.userId = userId.toString();
            socket.join(socket.userId);
            onlineUsers.add(socket.userId);
            io.emit('online_status', { userId: socket.userId, online: true });
        }
    });

    socket.on('disconnect', () => {
        if (socket.userId) {
            onlineUsers.delete(socket.userId);
            io.emit('online_status', { userId: socket.userId, online: false });
        }
    });

    socket.on('typing_start', ({ toUserId }) => {
        if (!socket.userId) return;
        io.to(toUserId.toString()).emit('typing_start', { fromUserId: socket.userId });
    });

    socket.on('typing_stop', ({ toUserId }) => {
        if (!socket.userId) return;
        io.to(toUserId.toString()).emit('typing_stop', { fromUserId: socket.userId });
    });

    socket.on('message_read', ({ messageId, fromUserId }) => {
        if (!socket.userId) return;
        // Notify the sender that their message was read
        io.to(fromUserId.toString()).emit('message_read', { messageId, readerId: socket.userId });
    });
});

// ========================================
// Middleware
// ========================================
app.use(cors());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// FORCE HEADERS AFTER HELMET (Double Lock)
app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
    next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Debug logger
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        if (req.method === 'POST') console.log('Body keys:', Object.keys(req.body));
    }
    next();
});

// Serve React build with proper caching for static assets
const spaRoot = path.join(__dirname, 'client', 'dist');
if (!fs.existsSync(spaRoot) && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  React build directory not found. Please run "npm run build" in the client folder.');
}
app.use(express.static(spaRoot, {
    etag: true,
    setHeaders: (res, filePath) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
        res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
        if (filePath.match(/\.[a-f0-9]{8}\.(js|css)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('index.html')) {
            // Never cache index.html so updates are immediate
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else {
            // Short cache for other static files
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Only disable caching for API endpoints, not static files
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 2000, message: { error: 'Too many requests' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Too many auth attempts' } });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many OTP requests.' } });
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// ========================================
// File Storage
// ========================================
let storage;
const useCloudinary = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

if (useCloudinary) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    storage = new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'spark-photos',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
            public_id: (req, file) => {
                const hash = crypto.createHash('sha256')
                    .update(`${req.user.id}-${Date.now()}-${file.originalname}`)
                    .digest('hex');
                return `img_${hash.substring(0, 16)}`;
            },
            transformation: (req, file) => {
                if (file.format === 'pdf') return [];
                return [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }];
            }
        }
    });
    console.log('📸 Using Cloudinary for SPARK photo storage');
} else {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            const hash = crypto.createHash('sha256')
                .update(`${req.user.id}-${Date.now()}-${file.originalname}`)
                .digest('hex');
            cb(null, `${hash.substring(0, 20)}${path.extname(file.originalname)}`);
        }
    });
    console.log('⚠️  Using local disk for image storage');
}

const fileFilter = (req, file, cb) => {
    const allowedImage = /jpeg|jpg|png|webp|gif/;
    const allowedDocs = /pdf/;
    const allowedAudio = /webm|mp4|ogg|wav|mpeg|mp3/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

    if (file.fieldname === 'audio' && (allowedAudio.test(ext) || file.mimetype.startsWith('audio/'))) {
        cb(null, true);
    } else if (allowedImage.test(ext) || (file.mimetype && file.mimetype.startsWith('image/'))) {
        cb(null, true);
    } else if (allowedDocs.test(ext) || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: (process.env.MAX_UPLOAD_SIZE || 10) * 1024 * 1024 },
    fileFilter
});

// Audio uses disk even in cloudinary mode (voice messages)
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const hash = crypto.createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex');
        cb(null, `voice-${hash.substring(0, 16)}.webm`);
    }
});

// Chat messages: use disk storage as temp, then manually upload to Cloudinary
const msgDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || (file.mimetype.startsWith('audio/') ? '.webm' : '.jpg');
        const hash = crypto.createHash('sha256').update(`${Date.now()}-${file.originalname}`).digest('hex');
        cb(null, `${file.fieldname}-${hash.substring(0, 16)}${ext}`);
    }
});
const uploadMsg = multer({
    storage: msgDiskStorage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, true)
});

// ========================================
// Auth Middleware
// ========================================
const lastActiveCache = new Map();

async function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const payload = jwt.verify(header.split(' ')[1], JWT_SECRET);
        const user = await db.queryOne('SELECT * FROM users WHERE id = ? AND is_active = 1', [payload.userId]);
        if (!user) return res.status(401).json({ error: 'User not found' });
        req.user = user;
        next();

        // Efficiently update last active status (debounce 5 mins)
        const now = Date.now();
        const lastUpdate = lastActiveCache.get(user.id) || 0;
        if (now - lastUpdate > 5 * 60 * 1000) {
            lastActiveCache.set(user.id, now);
            db.run('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]).catch(() => { });
        }
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

async function sanitizeUser(u) {
    const { password, ...safe } = u;
    try { safe.interests = typeof safe.interests === 'string' ? JSON.parse(safe.interests || '[]') : (safe.interests || []); } catch { safe.interests = []; }
    try { safe.green_flags = typeof safe.green_flags === 'string' ? JSON.parse(safe.green_flags || '[]') : (safe.green_flags || []); } catch { safe.green_flags = []; }
    try { safe.red_flags = typeof safe.red_flags === 'string' ? JSON.parse(safe.red_flags || '[]') : (safe.red_flags || []); } catch { safe.red_flags = []; }
    // Attach user photos
    try {
        safe.photos = await db.query('SELECT id, photo_url, caption, is_primary, position FROM user_photos WHERE user_id = ? ORDER BY is_primary DESC, position ASC', [safe.id]);
    } catch { safe.photos = []; }
    // Attach profile prompts
    try {
        safe.prompts = await db.query('SELECT id, question, answer FROM profile_prompts WHERE user_id = ? ORDER BY position ASC', [safe.id]);
    } catch { safe.prompts = []; }
    return safe;
}

// ========================================
// AUTH ROUTES
// ========================================

app.post('/api/auth/send-otp', otpLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });
        const normalizedEmail = email.toLowerCase().trim();
        const existing = await db.queryOne('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
        if (existing) return res.status(409).json({ error: 'Email already registered. Please login.' });

        let otp = generateOTP();
        if (process.env.NODE_ENV !== 'production' && normalizedEmail.startsWith('test')) {
            otp = '123456';
        }
        otpStore.set(normalizedEmail, { otp, expiresAt: Date.now() + OTP_EXPIRY_MS, verified: false });

        if (process.env.NODE_ENV !== 'production') {
            console.log(`\n[DEV SECURITY] 🚀 OTP for ${normalizedEmail}: ${otp}\n`);
        }

        // Skip SMTP sequence for test accounts to prevent 20s connection timeouts and hanging UI
        if (process.env.NODE_ENV !== 'production' && normalizedEmail.startsWith('test')) {
            return res.json({ success: true, message: "Test mode active: OTP logged to console." });
        }

        try {
            await sendOTPEmail(normalizedEmail, otp);
        } catch (mailErr) {
            // OTP send failed — remove it from store so user must retry cleanly
            otpStore.delete(normalizedEmail);
            console.error("❌ OTP email failed:", mailErr.message);
            return res.status(500).json({
                error: mailErr.message || "Failed to send verification email. Please try again."
            });
        }
        res.json({ success: true, message: "OTP sent to your NITK email! Check your inbox (and spam folder)." });
    } catch (e) {
        console.error('Send OTP error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/verify-otp', (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });
        const normalizedEmail = email.toLowerCase().trim();
        const stored = otpStore.get(normalizedEmail);
        if (!stored) return res.status(400).json({ error: 'No OTP found. Request a new one.' });
        if (Date.now() > stored.expiresAt) { otpStore.delete(normalizedEmail); return res.status(400).json({ error: 'OTP expired. Request a new one.' }); }
        if (stored.otp !== otp.trim()) return res.status(400).json({ error: 'Incorrect OTP. Try again.' });
        stored.verified = true;
        otpStore.set(normalizedEmail, stored);
        res.json({ success: true, message: 'Email verified!' });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, age, gender, branch, year, bio, show_me, interests, green_flags, red_flags } = req.body;
        if (!name || !email || !password || !age || !gender || !branch || !year)
            return res.status(400).json({ error: 'All fields are required' });

        const normalizedEmail = email.toLowerCase().trim();

        const otpData = otpStore.get(normalizedEmail);
        const isProd = process.env.NODE_ENV === 'production';
        const isTestEmail = normalizedEmail.startsWith('test');

        if ((isProd || !isTestEmail) && (!otpData || !otpData.verified))
            return res.status(403).json({ error: 'Email not verified. Verify OTP first.' });




        if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
        if (age < 18 || age > 35) return res.status(400).json({ error: 'Must be 18+ years old' });

        const existing = await db.queryOne('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
        if (existing) return res.status(409).json({ error: 'Email already registered' });

        const hash = bcrypt.hashSync(password, 10);

        // Extract Institute from email domain
        const domain = normalizedEmail.split('@')[1] || '';
        let institute = domain.split('.')[0].toUpperCase();
        if (domain === 'nitk.edu.in') institute = 'NITK Surathkal';
        else if (domain.includes('.edu')) institute = institute + ' University';
        else institute = domain || 'Global SPARK';

        const result = await db.run(
            `INSERT INTO users (name, email, password, age, gender, institute, branch, year, bio, show_me, interests, green_flags, red_flags, is_verified)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, normalizedEmail, hash, age, gender, institute, branch, year,
                bio || "Hey there! I'm on SPARK ✨",
                show_me || 'all',
                JSON.stringify(interests || []),
                JSON.stringify(green_flags || []),
                JSON.stringify(red_flags || []),
                0
            ]
        );

        otpStore.delete(normalizedEmail);
        const token = jwt.sign({ userId: result.lastId }, JWT_SECRET, { expiresIn: '30d' });
        const user = await db.queryOne('SELECT * FROM users WHERE id = ?', [result.lastId]);
        res.status(201).json({ token, user: await sanitizeUser(user) });
    } catch (e) {
        console.error('Register error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
        const user = await db.queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
        if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid email or password' });
        if (user.is_active === 0) {
            await db.run('UPDATE users SET is_active = 1 WHERE id = ?', [user.id]);
            user.is_active = 1;
        }
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: await sanitizeUser(user) });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// PASSWORD RESET FLOW
// ========================================
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email required' });

        const normalizedEmail = email.toLowerCase().trim();
        const user = await db.queryOne('SELECT id, name FROM users WHERE email = ?', [normalizedEmail]);

        // Always return success to prevent email enumeration attacks
        if (!user) return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await db.run(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
            [resetToken, tokenExpiry.toISOString(), user.id]
        );

        const resetUrl = `${process.env.CLIENT_URL || 'https://nitknot.online'}/reset-password/${resetToken}`;

        const smtpEmail = (process.env.SMTP_EMAIL || '').trim();
        if (smtpEmail && process.env.SMTP_PASSWORD?.trim()) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: smtpEmail, pass: process.env.SMTP_PASSWORD.trim() }
            });
            await transporter.sendMail({
                from: `"SPARK" <${smtpEmail}>`,
                to: normalizedEmail,
                subject: '🔐 SPARK — Password Reset Request',
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a2e;border-radius:16px;color:#fff;">
                        <h1 style="text-align:center;color:#D4AF37;">SPARK ✨</h1>
                        <p>Hi ${user.name},</p>
                        <p>Someone requested a password reset for your SPARK account. Click the button below to set a new password:</p>
                        <div style="text-align:center;margin:32px 0;">
                            <a href="${resetUrl}" style="background:linear-gradient(135deg, #8B5CF6, #EC4899);color:white;padding:16px 32px;text-decoration:none;border-radius:30px;font-weight:bold;display:inline-block;">Reset Password</a>
                        </div>
                        <p style="color:#888;font-size:12px;text-align:center;">This link expires in 1 hour.<br>If you didn't request this, safely ignore this email.</p>
                    </div>
                `
            });
        }
        res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    } catch (e) {
        console.error('Forgot password error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required' });
        if (newPassword.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

        const user = await db.queryOne('SELECT id, reset_token_expires FROM users WHERE reset_token = ?', [token]);

        if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

        const expiry = new Date(user.reset_token_expires);
        if (Date.now() > expiry.getTime()) {
            return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
        }

        const hash = bcrypt.hashSync(newPassword, 10);
        await db.run(
            'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
            [hash, user.id]
        );

        res.json({ success: true, message: 'Password successfully reset' });
    } catch (e) {
        console.error('Reset password error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Change password (must verify current password first)
app.post('/api/auth/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
        if (newPassword.length < 4) return res.status(400).json({ error: 'New password must be at least 4 characters' });

        if (!bcrypt.compareSync(currentPassword, req.user.password)) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hash = bcrypt.hashSync(newPassword, 10);
        await db.run('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);
        res.json({ success: true, message: 'Password changed successfully' });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    // Session is handled client-side via JWT, but we provide this endpoint
    // for future server-side session invalidation support.
    res.json({ success: true, message: 'Logged out successfully' });
});

app.post('/api/auth/google', async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) return res.status(400).json({ error: 'Missing credential' });

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: [
                process.env.GOOGLE_CLIENT_ID,
                '763153801999-pggubb51vqlli45492dop5pkmdu1fdvc.apps.googleusercontent.com'
            ].filter(Boolean),
        });
        const payload = ticket.getPayload();
        const email = payload.email.toLowerCase().trim();
        const name = payload.name;
        const photo = payload.picture;

        let user = await db.queryOne('SELECT * FROM users WHERE email = ?', [email]);

        if (!user) {
            const dummyPassword = crypto.randomBytes(16).toString('hex');
            const hash = bcrypt.hashSync(dummyPassword, 10);

            const domain = email.split('@')[1] || '';
            let institute = domain.split('.')[0].toUpperCase();
            if (domain === 'nitk.edu.in') institute = 'NITK Surathkal';
            else if (domain.includes('.edu')) institute = institute + ' University';
            else institute = domain || 'Global Aura';

            const result = await db.run(
                `INSERT INTO users (name, email, password, age, gender, institute, branch, year, bio, show_me, interests, green_flags, red_flags, is_verified, photo, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    name, email, hash, 18, 'Other', institute, 'Unknown', '1st Year',
                    "Hey there! I joined Aura via Google ✨",
                    'all', JSON.stringify([]), JSON.stringify([]), JSON.stringify([]),
                    1 /* Verified via Google */, photo, 1
                ]
            );
            user = await db.queryOne('SELECT * FROM users WHERE id = ?', [result.lastId]);
        } else {
            if (user.is_active === 0) {
                await db.run('UPDATE users SET is_active = 1 WHERE id = ?', [user.id]);
                user.is_active = 1;
            }
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: await sanitizeUser(user) });
    } catch (e) {
        console.error('Google Auth Error:', e.message);
        res.status(500).json({ error: 'Failed to authenticate with Google. Ensure origin is authorized.' });
    }
});

// ========================================
// ACCOUNT MANAGEMENT ROUTES
// ========================================

app.post('/api/account/deactivate', authenticate, async (req, res) => {
    try {
        await db.run('UPDATE users SET is_active = 0 WHERE id = ?', [req.user.id]);
        res.json({ success: true, message: 'Account deactivated' });
    } catch (e) {
        console.error('Deactivate account error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/account', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        await db.run('DELETE FROM messages WHERE sender_id = ? OR match_id IN (SELECT id FROM matches WHERE user1_id = ? OR user2_id = ?)', [userId, userId, userId]);
        await db.run('DELETE FROM matches WHERE user1_id = ? OR user2_id = ?', [userId, userId]);
        await db.run('DELETE FROM swipes WHERE user_id = ? OR target_id = ?', [userId, userId]);
        await db.run('DELETE FROM reports WHERE reporter_id = ? OR reported_id = ?', [userId, userId]);
        await db.run('DELETE FROM user_photos WHERE user_id = ?', [userId]);
        try { await db.run('DELETE FROM message_reactions WHERE user_id = ?', [userId]); } catch { }
        try { await db.run('DELETE FROM profile_prompts WHERE user_id = ?', [userId]); } catch { }
        try { await db.run('DELETE FROM anonymous_questions WHERE sender_id = ? OR receiver_id = ?', [userId, userId]); } catch { }
        try { await db.run('DELETE FROM premium_requests WHERE user_id = ?', [userId]); } catch { }

        await db.run('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ success: true, message: 'Account deleted' });
    } catch (e) {
        console.error('Delete account error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/account/incognito', authenticate, async (req, res) => {
    try {
        const { is_snoozed } = req.body;
        await db.run('UPDATE users SET is_snoozed = ? WHERE id = ?', [is_snoozed ? 1 : 0, req.user.id]);
        res.json({ success: true, is_snoozed: is_snoozed ? 1 : 0 });
    } catch (e) {
        console.error('Incognito error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Reports against the current user (so they know why they were reported)
app.get('/api/reports/me', authenticate, async (req, res) => {
    try {
        const reports = await db.query(
            'SELECT reason, details, created_at FROM reports WHERE reported_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json({ reports, count: reports.length });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
    res.json({ user: await sanitizeUser(req.user) });
});

// ========================================
// PROFILE ROUTES
// ========================================

// Update GPS Location
app.put('/api/profile/location', authenticate, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        if (latitude === undefined || longitude === undefined) return res.status(400).json({ error: 'Coordinates required' });
        await db.run('UPDATE users SET latitude = ?, longitude = ? WHERE id = ?', [latitude, longitude, req.user.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/profile', authenticate, async (req, res) => {
    try {
        const { name, bio, pickup_line, branch, year, show_me, interests, green_flags, red_flags } = req.body;
        await db.run(
            `UPDATE users SET name=COALESCE(?,name), bio=COALESCE(?,bio), pickup_line=COALESCE(?,pickup_line),
             branch=COALESCE(?,branch), year=COALESCE(?,year), show_me=COALESCE(?,show_me),
             interests=COALESCE(?,interests), green_flags=COALESCE(?,green_flags), red_flags=COALESCE(?,red_flags)
             WHERE id=?`,
            [
                name || null, bio !== undefined ? bio : null, pickup_line !== undefined ? pickup_line : null,
                branch || null, year || null, show_me || null,
                interests ? JSON.stringify(interests) : null,
                green_flags ? JSON.stringify(green_flags) : null,
                red_flags ? JSON.stringify(red_flags) : null,
                req.user.id
            ]
        );
        const updated = await db.queryOne('SELECT * FROM users WHERE id = ?', [req.user.id]);
        res.json({ user: await sanitizeUser(updated) });
    } catch (e) {
        console.error('Update profile error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Upload ID Card for verification
app.post('/api/profile/id-card', authenticate, (req, res, next) => {
    // Force local disk storage for IDs in development for better control and PDF reliability
    if (process.env.NODE_ENV === 'development') {
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        const storage = multer.diskStorage({
            destination: (req, file, cb) => cb(null, uploadsDir),
            filename: (req, file, cb) => cb(null, `id-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`)
        });
        const uploadLocal = multer({ storage, fileFilter });
        return uploadLocal.single('photo')(req, res, next);
    }
    upload.single('photo')(req, res, next);
}, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'ID card file is required' });

        // Use relative path for local, Cloudinary path for production
        const photoUrl = (req.file.path && req.file.path.startsWith('http'))
            ? req.file.path
            : `/uploads/${req.file.filename}`;

        await db.run('UPDATE users SET id_card_url = ?, verification_status = \'pending\' WHERE id = ?', [photoUrl, req.user.id]);
        res.json({ success: true, id_card_url: photoUrl });
    } catch (e) {
        console.error('ID Upload Error:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Upload a profile photo (max 4 per user)
app.post('/api/profile/photo', authenticate, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        // Check existing photo count
        const countRow = await db.queryOne('SELECT COUNT(*) as c FROM user_photos WHERE user_id = ?', [req.user.id]);
        if (countRow && countRow.c >= 4) return res.status(400).json({ error: 'Maximum 4 photos allowed. Delete one first.' });

        const photoUrl = req.file.path && req.file.path.startsWith('http') ? req.file.path : `/uploads/${req.file.filename}`;

        // If no photos yet, make this the primary and set as user's main photo
        const isFirst = !countRow || countRow.c === 0;
        const position = countRow ? countRow.c : 0;

        await db.run(
            'INSERT INTO user_photos (user_id, photo_url, is_primary, position) VALUES (?, ?, ?, ?)',
            [req.user.id, photoUrl, isFirst ? 1 : 0, position]
        );

        if (isFirst) {
            await db.run('UPDATE users SET photo = ? WHERE id = ?', [photoUrl, req.user.id]);
        }

        const photos = await db.query('SELECT id, photo_url, caption, is_primary, position FROM user_photos WHERE user_id = ? ORDER BY is_primary DESC, position ASC', [req.user.id]);
        res.json({ photo: photoUrl, photos });
    } catch (e) {
        console.error('Upload error:', e);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Delete a photo
app.delete('/api/profile/photo/:photoId', authenticate, async (req, res) => {
    try {
        const photoId = parseInt(req.params.photoId);
        const photo = await db.queryOne('SELECT * FROM user_photos WHERE id = ? AND user_id = ?', [photoId, req.user.id]);
        if (!photo) return res.status(404).json({ error: 'Photo not found' });

        // Delete from Cloudinary if applicable
        if (useCloudinary && photo.photo_url && photo.photo_url.includes('cloudinary')) {
            try {
                const publicId = photo.photo_url.split('/').slice(-2).join('/').split('.')[0];
                await cloudinary.uploader.destroy(publicId);
            } catch (cloudErr) { console.error('Cloudinary delete error:', cloudErr.message); }
        } else if (photo.photo_url && photo.photo_url.startsWith('/uploads/')) {
            // Delete from local disk
            const filePath = path.join(__dirname, photo.photo_url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        await db.run('DELETE FROM user_photos WHERE id = ?', [photoId]);

        // If deleted photo was primary, promote the next one
        if (photo.is_primary) {
            const nextPhoto = await db.queryOne('SELECT * FROM user_photos WHERE user_id = ? ORDER BY position ASC LIMIT 1', [req.user.id]);
            if (nextPhoto) {
                await db.run('UPDATE user_photos SET is_primary = 1 WHERE id = ?', [nextPhoto.id]);
                await db.run('UPDATE users SET photo = ? WHERE id = ?', [nextPhoto.photo_url, req.user.id]);
            } else {
                await db.run("UPDATE users SET photo = '' WHERE id = ?", [req.user.id]);
            }
        }

        const photos = await db.query('SELECT id, photo_url, caption, is_primary, position FROM user_photos WHERE user_id = ? ORDER BY is_primary DESC, position ASC', [req.user.id]);
        res.json({ success: true, photos });
    } catch (e) {
        console.error('Delete photo error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Set a photo as primary
app.put('/api/profile/photo/:photoId/primary', authenticate, async (req, res) => {
    try {
        const photoId = parseInt(req.params.photoId);
        const photo = await db.queryOne('SELECT * FROM user_photos WHERE id = ? AND user_id = ?', [photoId, req.user.id]);
        if (!photo) return res.status(404).json({ error: 'Photo not found' });

        // Unset all primaries, then set the chosen one
        await db.run('UPDATE user_photos SET is_primary = 0 WHERE user_id = ?', [req.user.id]);
        await db.run('UPDATE user_photos SET is_primary = 1 WHERE id = ?', [photoId]);
        await db.run('UPDATE users SET photo = ? WHERE id = ?', [photo.photo_url, req.user.id]);

        const photos = await db.query('SELECT id, photo_url, caption, is_primary, position FROM user_photos WHERE user_id = ? ORDER BY is_primary DESC, position ASC', [req.user.id]);
        res.json({ success: true, photos, photo: photo.photo_url });
    } catch (e) {
        console.error('Set primary error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user photos
app.get('/api/profile/photos', authenticate, async (req, res) => {
    try {
        const photos = await db.query('SELECT id, photo_url, caption, is_primary, position FROM user_photos WHERE user_id = ? ORDER BY is_primary DESC, position ASC', [req.user.id]);
        res.json({ photos });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update photo caption
app.patch('/api/profile/photo/:photoId/caption', authenticate, async (req, res) => {
    try {
        const photoId = parseInt(req.params.photoId);
        const { caption } = req.body;
        const photo = await db.queryOne('SELECT * FROM user_photos WHERE id = ? AND user_id = ?', [photoId, req.user.id]);
        if (!photo) return res.status(404).json({ error: 'Photo not found' });
        await db.run('UPDATE user_photos SET caption = ? WHERE id = ?', [caption || '', photoId]);
        const photos = await db.query('SELECT id, photo_url, caption, is_primary, position FROM user_photos WHERE user_id = ? ORDER BY is_primary DESC, position ASC', [req.user.id]);
        res.json({ success: true, photos });
    } catch (e) {
        console.error('Caption update error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get another user's public profile by ID
app.get('/api/users/:id/profile', authenticate, async (req, res) => {
    try {
        const targetId = parseInt(req.params.id);
        if (!targetId || isNaN(targetId)) return res.status(400).json({ error: 'Invalid user ID' });
        const user = await db.queryOne('SELECT * FROM users WHERE id = ? AND is_active = 1', [targetId]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const safeUser = await sanitizeUser(user);
        // Calculate shared interests
        const myInterests = req.user.interests ? JSON.parse(req.user.interests) : [];
        const shared = safeUser.interests.filter(i => myInterests.includes(i));
        safeUser.shared_interests = shared;
        safeUser.match_percent = myInterests.length > 0
            ? Math.min(99, Math.round((shared.length / Math.max(myInterests.length, 1)) * 100 + 40))
            : Math.floor(60 + Math.random() * 30);
        res.json({ user: safeUser });
    } catch (e) {
        console.error('Get user profile error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// DISCOVER ROUTES
// ========================================

app.get('/api/discover', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const showMe = req.user.show_me;
        let genderFilter = '';
        if (showMe === 'male') genderFilter = "AND u.gender = 'male'";
        else if (showMe === 'female') genderFilter = "AND u.gender = 'female'";

        // Campus filters from query params
        const { branch, year, local, lat, lon } = req.query;
        let campusFilter = '';
        const extraParams = [];
        if (branch && branch !== 'all') { campusFilter += ' AND u.branch = ?'; extraParams.push(branch); }
        if (year && year !== 'all') { campusFilter += ' AND u.year = ?'; extraParams.push(year); }
        if (local === 'true') { campusFilter += ' AND u.institute = ?'; extraParams.push(req.user.institute || 'NITK Surathkal'); }

        let distanceSelect = '';
        let distanceOrder = '';
        const distanceParams = [];

        if (lat && lon) {
            // Simplified distance for both SQLite and Postgres (ordering only)
            distanceSelect = `, ((u.latitude - ?)*(u.latitude - ?) + (u.longitude - ?)*(u.longitude - ?)) AS distance_sq`;
            distanceParams.push(parseFloat(lat), parseFloat(lat), parseFloat(lon), parseFloat(lon));
            distanceOrder = 'CASE WHEN u.latitude IS NULL THEN 1 ELSE 0 END, distance_sq ASC, ';
        }

        const randomFn = 'RANDOM()';

        const profiles = await db.query(
            `SELECT u.* ${distanceSelect} FROM users u
             WHERE u.id != ?
               AND u.is_active = 1
               AND (u.is_snoozed = 0 OR u.is_snoozed IS NULL)
               AND u.id NOT IN (SELECT target_id FROM swipes WHERE user_id = ?)
               AND u.id NOT IN (
                 SELECT CASE WHEN user1_id = ? THEN user2_id ELSE user1_id END
                 FROM matches WHERE user1_id = ? OR user2_id = ?
               )
               ${genderFilter}
               ${campusFilter}
             ORDER BY ${distanceOrder} u.is_verified DESC, ${randomFn}
             LIMIT 20`,
            [...distanceParams, userId, userId, userId, userId, userId, ...extraParams]
        );

        const userInterests = req.user.interests ? JSON.parse(req.user.interests) : [];
        const result = await Promise.all(profiles.map(async (p) => {
            const s = await sanitizeUser(p);
            const shared = s.interests.filter(i => userInterests.includes(i));

            // Aura Compatibility Algorithm
            let baseScore = 20; // baseline connection
            baseScore += (shared.length * 8); // +8 per shared interest

            // Institute & Academic Alignment
            if (p.institute && p.institute === req.user.institute) baseScore += 30; // Massive boost for same college
            if (p.branch && p.branch === req.user.branch) baseScore += 12; // +12 for same branch
            if (p.year && p.year === req.user.year) baseScore += 8; // +8 for same year

            // Cap at 99%, add random noise for profiles with no data
            s.match_percent = userInterests.length > 0
                ? Math.min(99, Math.round(baseScore))
                : Math.floor(60 + Math.random() * 30);

            s.shared_interests = shared;
            // Attach profile prompts
            try { s.prompts = await db.query('SELECT id, question, answer FROM profile_prompts WHERE user_id = ? ORDER BY position ASC', [s.id]); } catch { s.prompts = []; }
            return s;
        }));

        res.json({ profiles: result });
    } catch (e) {
        console.error('Discover error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/swipe', authenticate, async (req, res) => {
    try {
        const { target_id, action } = req.body;
        if (!target_id || !['like', 'pass', 'super_like'].includes(action))
            return res.status(400).json({ error: 'Invalid request' });

        const userId = req.user.id;
        const targetId = parseInt(target_id);
        const isSuperLike = action === 'super_like';
        const dbAction = isSuperLike ? 'like' : action;

        // Check if target exists
        const targetUser = await db.queryOne('SELECT id, name, photo FROM users WHERE id = ?', [targetId]);
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        const existing = await db.queryOne('SELECT id FROM swipes WHERE user_id = ? AND target_id = ?', [userId, targetId]);
        if (existing) return res.json({ success: false, message: 'Already swiped' });

        await db.run(
            'INSERT INTO swipes (user_id, target_id, action, is_super_like) VALUES (?, ?, ?, ?)',
            [userId, targetId, dbAction, isSuperLike ? 1 : 0]
        );

        let isMatch = false;
        let matchId = null;
        let matchedUser = null;

        if (dbAction === 'like') {
            const otherSwipe = await db.queryOne(
                "SELECT * FROM swipes WHERE user_id = ? AND target_id = ? AND action = 'like'",
                [targetId, userId]
            );

            if (otherSwipe) {
                isMatch = true;
                const u1 = Math.min(userId, targetId);
                const u2 = Math.max(userId, targetId);
                const result = await db.run('INSERT INTO matches (user1_id, user2_id) VALUES (?, ?)', [u1, u2]);
                matchId = result.lastId;
                matchedUser = await db.queryOne('SELECT id, name, photo, branch, year, bio FROM users WHERE id = ?', [targetId]);
                const matchedUserSafe = await sanitizeUser({ ...matchedUser, password: '' });

                // Notify both users via socket with full data
                io.to(userId.toString()).emit('match_found', {
                    match_id: matchId,
                    user: matchedUserSafe
                });
                io.to(targetId.toString()).emit('match_found', {
                    match_id: matchId,
                    user: sanitizeUser({ ...req.user, password: '' })
                });
            } else if (isSuperLike) {
                io.to(targetId.toString()).emit('super_like_received', {
                    fromUserId: userId,
                    name: req.user.name,
                    photo: req.user.photo
                });
            }
        }

        res.json({
            success: true,
            match: isMatch,
            match_id: matchId,
            matched_user: matchedUser ? await sanitizeUser({ ...matchedUser, password: '' }) : null
        });
    } catch (e) {
        console.error('Swipe error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// LIKES ROUTES
// ========================================

app.get('/api/likes/received', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const likes = await db.query(
            `SELECT u.*, s.is_super_like, s.created_at as liked_at
             FROM swipes s
             JOIN users u ON s.user_id = u.id
             WHERE s.target_id = ?
             AND s.action = 'like'
             AND u.is_active = 1
             AND s.user_id NOT IN (
               SELECT CASE WHEN user1_id = ? THEN user2_id ELSE user1_id END
               FROM matches WHERE user1_id = ? OR user2_id = ?
             )
             ORDER BY s.is_super_like DESC, s.created_at DESC`,
            [userId, userId, userId, userId]
        );
        const result = [];
        for (const p of likes) {
            const s = await sanitizeUser(p);
            result.push({ ...s, is_super_like: p.is_super_like === 1 });
        }
        res.json(result);
    } catch (e) {
        console.error('Likes error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// MATCHES ROUTES
// ========================================

app.get('/api/matches', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const matches = await db.query(
            `SELECT m.id as match_id, m.created_at as matched_at,
                CASE WHEN m.user1_id = ? THEN u2.id ELSE u1.id END as user_id,
                CASE WHEN m.user1_id = ? THEN u2.name ELSE u1.name END as name,
                CASE WHEN m.user1_id = ? THEN u2.photo ELSE u1.photo END as photo,
                CASE WHEN m.user1_id = ? THEN u2.branch ELSE u1.branch END as branch,
                CASE WHEN m.user1_id = ? THEN u2.year ELSE u1.year END as year,
                CASE WHEN m.user1_id = ? THEN u2.bio ELSE u1.bio END as bio,
                CASE WHEN m.user1_id = ? THEN u2.age ELSE u1.age END as age,
                CASE WHEN m.user1_id = ? THEN u2.interests ELSE u1.interests END as interests,
                CASE WHEN m.user1_id = ? THEN u2.green_flags ELSE u1.green_flags END as green_flags,
                CASE WHEN m.user1_id = ? THEN u2.red_flags ELSE u1.red_flags END as red_flags,
                CASE WHEN m.user1_id = ? THEN u2.gender ELSE u1.gender END as gender
             FROM matches m
             JOIN users u1 ON m.user1_id = u1.id
             JOIN users u2 ON m.user2_id = u2.id
             WHERE (m.user1_id = ? OR m.user2_id = ?)`,
            [userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId, userId]
        );

        const result = [];
        for (const m of matches) {
            try {
                const lastMsg = await db.queryOne(
                    'SELECT text, image_url, voice_url, created_at, sender_id FROM messages WHERE match_id = ? ORDER BY created_at DESC LIMIT 1',
                    [m.match_id]
                );
                const unreadCount = await db.queryOne(
                    "SELECT COUNT(*) as c FROM messages WHERE match_id = ? AND sender_id != ? AND is_read = 0",
                    [m.match_id, userId]
                );
                // Determine preview text for last message
                let lastMsgPreview = null;
                if (lastMsg) {
                    if (lastMsg.text) lastMsgPreview = lastMsg.text;
                    else if (lastMsg.voice_url) lastMsgPreview = '🎤 Voice message';
                    else if (lastMsg.image_url) lastMsgPreview = '📷 Photo';
                }
                result.push({
                    ...m,
                    last_message: lastMsgPreview,
                    last_message_time: lastMsg ? lastMsg.created_at : null,
                    last_message_mine: lastMsg ? lastMsg.sender_id === userId : false,
                    unread_count: unreadCount ? unreadCount.c : 0,
                    interests: m.interests ? (typeof m.interests === 'string' ? JSON.parse(m.interests) : m.interests) : [],
                    green_flags: m.green_flags ? (typeof m.green_flags === 'string' ? JSON.parse(m.green_flags) : m.green_flags) : [],
                    red_flags: m.red_flags ? (typeof m.red_flags === 'string' ? JSON.parse(m.red_flags) : m.red_flags) : [],
                });
            } catch (err) {
                console.error('Error processing match:', m.match_id, err);
                result.push({ ...m, interests: [], green_flags: [], red_flags: [], unread_count: 0 });
            }
        }

        result.sort((a, b) => {
            const timeA = new Date(a.last_message_time || a.matched_at).getTime();
            const timeB = new Date(b.last_message_time || b.matched_at).getTime();
            return timeB - timeA;
        });

        res.json({ matches: result });
    } catch (e) {
        console.error('Matches error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/matches/:id', authenticate, async (req, res) => {
    try {
        const matchId = parseInt(req.params.id);
        const userId = req.user.id;
        const match = await db.queryOne('SELECT id FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)', [matchId, userId, userId]);
        if (!match) return res.status(404).json({ error: 'Match not found' });
        await db.run('DELETE FROM messages WHERE match_id = ?', [matchId]);
        await db.run('DELETE FROM matches WHERE id = ?', [matchId]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// MESSAGES ROUTES
// ========================================

app.get('/api/messages/:matchId', authenticate, async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId);
        const userId = req.user.id;
        const match = await db.queryOne('SELECT * FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)', [matchId, userId, userId]);
        if (!match) return res.status(403).json({ error: 'Not your match' });

        const messages = await db.query(
            `SELECT m.*, u.name as sender_name, u.photo as sender_photo,
                    rm.text as reply_to_text,
                    ru.name as reply_to_sender
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             LEFT JOIN messages rm ON m.reply_to_id = rm.id
             LEFT JOIN users ru ON rm.sender_id = ru.id
             WHERE m.match_id = ?
             ORDER BY m.created_at ASC`,
            [matchId]
        );

        res.json({ messages, match });
    } catch (e) {
        console.error('Messages error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/messages/:matchId', authenticate,
    uploadMsg.fields([{ name: 'image', maxCount: 1 }, { name: 'audio', maxCount: 1 }]),
    async (req, res) => {
        try {
            const matchId = parseInt(req.params.matchId);
            const userId = req.user.id;
            const { text, replyToId } = req.body;

            const imageFile = req.files && req.files['image'] ? req.files['image'][0] : null;
            const audioFile = req.files && req.files['audio'] ? req.files['audio'][0] : null;

            let imageUrl = null, voiceUrl = null;
            if (imageFile) {
                // If Cloudinary, upload image; otherwise serve locally
                if (useCloudinary) {
                    try {
                        const result = await cloudinary.uploader.upload(imageFile.path, {
                            folder: 'aura-chat',
                            public_id: `msg-img-${crypto.randomBytes(12).toString('hex')}`,
                            transformation: [{ width: 1200, quality: 'auto' }]
                        });
                        imageUrl = result.secure_url;
                        fs.unlink(imageFile.path, () => { });
                    } catch { imageUrl = `/uploads/${imageFile.filename}`; }
                } else {
                    imageUrl = `/uploads/${imageFile.filename}`;
                }
            }
            if (audioFile) {
                if (useCloudinary) {
                    try {
                        const result = await cloudinary.uploader.upload(audioFile.path, {
                            folder: 'aura-voice',
                            public_id: `msg-audio-${crypto.randomBytes(12).toString('hex')}`,
                            resource_type: 'video', // Cloudinary uses 'video' for audio files
                            format: 'webm'
                        });
                        voiceUrl = result.secure_url;
                        fs.unlink(audioFile.path, () => { });
                    } catch (err) {
                        console.error('Cloudinary audio upload failed:', err);
                        voiceUrl = `/uploads/${audioFile.filename}`;
                    }
                } else {
                    voiceUrl = `/uploads/${audioFile.filename}`;
                }
            }

            const msgText = (text || '').trim();
            if (!msgText && !imageUrl && !voiceUrl)
                return res.status(400).json({ error: 'Message cannot be empty' });

            if (msgText.length > 2000)
                return res.status(400).json({ error: 'Message too long (max 2000 chars)' });

            const match = await db.queryOne('SELECT * FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)', [matchId, userId, userId]);
            if (!match) return res.status(403).json({ error: 'Not your match' });

            const result = await db.run(
                'INSERT INTO messages (match_id, sender_id, text, reply_to_id, image_url, voice_url) VALUES (?, ?, ?, ?, ?, ?)',
                [matchId, userId, msgText, replyToId ? parseInt(replyToId) : null, imageUrl, voiceUrl]
            );

            const message = await db.queryOne(
                `SELECT m.*, u.name as sender_name, u.photo as sender_photo,
                        rm.text as reply_to_text, ru.name as reply_to_sender
                 FROM messages m
                 JOIN users u ON m.sender_id = u.id
                 LEFT JOIN messages rm ON m.reply_to_id = rm.id
                 LEFT JOIN users ru ON rm.sender_id = ru.id
                 WHERE m.id = ?`,
                [result.lastId]
            );

            const otherId = match.user1_id === userId ? match.user2_id : match.user1_id;
            io.to(otherId.toString()).emit('new_message', message);
            io.to(userId.toString()).emit('message_sent', message);

            res.status(201).json({ message });
        } catch (e) {
            console.error('Send message error:', e);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

app.delete('/api/messages/:id', authenticate, async (req, res) => {
    try {
        const msgId = parseInt(req.params.id);
        const userId = req.user.id;
        const result = await db.run('DELETE FROM messages WHERE id = ? AND sender_id = ?', [msgId, userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Message not found or not yours' });

        // Notify others in match
        const msg = await db.queryOne('SELECT match_id FROM messages WHERE id = ?', [msgId]);
        if (msg) {
            io.emit('message_deleted', { messageId: msgId, matchId: msg.match_id });
        }

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/messages/:matchId/read', authenticate, async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId);
        const userId = req.user.id;
        const result = await db.run(
            'UPDATE messages SET is_read = 1 WHERE match_id = ? AND sender_id != ? AND is_read = 0',
            [matchId, userId]
        );
        if (result.changes > 0) {
            const match = await db.queryOne('SELECT * FROM matches WHERE id = ?', [matchId]);
            if (match) {
                const otherId = match.user1_id === userId ? match.user2_id : match.user1_id;
                io.to(otherId.toString()).emit('messages_read', { matchId, readBy: userId });
            }
        }
        res.json({ success: true, changes: result.changes });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// ACCOUNT SETTINGS & GHOST MODE
// ========================================

app.put('/api/account/incognito', authenticate, async (req, res) => {
    try {
        const { is_snoozed } = req.body;
        const snoozedVal = is_snoozed ? 1 : 0;
        await db.run('UPDATE users SET is_snoozed = ? WHERE id = ?', [snoozedVal, req.user.id]);
        res.json({ message: 'Ghost mode updated', is_snoozed: snoozedVal });
    } catch (e) {
        console.error('Ghost mode error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// REPORT & BLOCK
// ========================================

app.post('/api/report', authenticate, async (req, res) => {
    try {
        const { reported_id, reason, details } = req.body;
        if (!reported_id || !reason) return res.status(400).json({ error: 'Missing fields' });
        await db.run('INSERT INTO reports (reporter_id, reported_id, reason, details) VALUES (?, ?, ?, ?)',
            [req.user.id, reported_id, reason, details || '']);

        // AUTO-BLOCK: Automatically unmatch and block swiping between these two
        await db.run('DELETE FROM matches WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
            [req.user.id, reported_id, reported_id, req.user.id]);

        // Add a "pass" swipe if none exists so they don't see each other in discover
        const existingSwipe = await db.queryOne('SELECT id FROM swipes WHERE user_id = ? AND target_id = ?', [req.user.id, reported_id]);
        if (!existingSwipe) {
            await db.run('INSERT INTO swipes (user_id, target_id, action) VALUES (?, ?, ?)', [req.user.id, reported_id, 'pass']);
        } else {
            await db.run('UPDATE swipes SET action = \'pass\' WHERE user_id = ? AND target_id = ?', [req.user.id, reported_id]);
        }

        // Auto-suspend: if 3+ unique reporters, deactivate the user
        const reportCount = await db.queryOne(
            'SELECT COUNT(DISTINCT reporter_id) as c FROM reports WHERE reported_id = ?',
            [reported_id]
        );
        if (reportCount && reportCount.c >= 3) {
            await db.run('UPDATE users SET is_active = 0 WHERE id = ?', [reported_id]);
            console.log(`⚠️ Auto-suspended user ${reported_id} (${reportCount.c} unique reports)`);
        }

        res.json({ success: true, message: 'User reported and blocked. We\'ll review it soon.' });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// ANONYMOUS QUESTIONS
// ========================================

// Send an anonymous question to a user
app.post('/api/anonymous-question', authenticate, async (req, res) => {
    try {
        const { receiver_id, question } = req.body;
        if (!receiver_id || !question || !question.trim())
            return res.status(400).json({ error: 'Question is required' });
        if (question.trim().length > 300)
            return res.status(400).json({ error: 'Question too long (max 300 chars)' });
        if (receiver_id === req.user.id)
            return res.status(400).json({ error: 'Cannot ask yourself a question' });

        // Limit: max 3 unanswered questions per sender per receiver
        const existing = await db.queryOne(
            'SELECT COUNT(*) as c FROM anonymous_questions WHERE sender_id = ? AND receiver_id = ? AND answer IS NULL',
            [req.user.id, receiver_id]
        );
        if (existing && existing.c >= 3)
            return res.status(400).json({ error: 'You already have 3 pending questions for this person' });

        await db.run(
            'INSERT INTO anonymous_questions (sender_id, receiver_id, question) VALUES (?, ?, ?)',
            [req.user.id, receiver_id, question.trim()]
        );

        res.json({ success: true, message: 'Question sent anonymously! 🕵️' });
    } catch (e) {
        console.error('Anon question error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get answered questions for a specific user's profile (public - visible to anyone viewing profile)
app.get('/api/anonymous-questions/profile/:userId', authenticate, async (req, res) => {
    try {
        const questions = await db.query(
            `SELECT id, question, answer, created_at FROM anonymous_questions
             WHERE receiver_id = ? AND answer IS NOT NULL
             ORDER BY created_at DESC LIMIT 10`,
            [req.params.userId]
        );
        res.json({ questions });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get questions I've received (for my own profile management)
app.get('/api/anonymous-questions/received', authenticate, async (req, res) => {
    try {
        const questions = await db.query(
            `SELECT id, question, answer, is_read, created_at FROM anonymous_questions
             WHERE receiver_id = ?
             ORDER BY answer IS NULL DESC, created_at DESC`,
            [req.user.id]
        );
        // Mark unread as read
        await db.run(
            'UPDATE anonymous_questions SET is_read = 1 WHERE receiver_id = ? AND is_read = 0',
            [req.user.id]
        );
        res.json({ questions });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get questions I've sent (to see answers)
app.get('/api/anonymous-questions/sent', authenticate, async (req, res) => {
    try {
        const questions = await db.query(
            `SELECT aq.id, aq.question, aq.answer, aq.created_at, u.name as receiver_name
             FROM anonymous_questions aq
             JOIN users u ON aq.receiver_id = u.id
             WHERE aq.sender_id = ?
             ORDER BY aq.created_at DESC`,
            [req.user.id]
        );
        res.json({ questions });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Answer a question I've received
app.put('/api/anonymous-questions/:id/answer', authenticate, async (req, res) => {
    try {
        const { answer } = req.body;
        if (!answer || !answer.trim())
            return res.status(400).json({ error: 'Answer is required' });
        if (answer.trim().length > 500)
            return res.status(400).json({ error: 'Answer too long (max 500 chars)' });

        const question = await db.queryOne(
            'SELECT * FROM anonymous_questions WHERE id = ? AND receiver_id = ?',
            [req.params.id, req.user.id]
        );
        if (!question) return res.status(404).json({ error: 'Question not found' });

        await db.run(
            'UPDATE anonymous_questions SET answer = ? WHERE id = ?',
            [answer.trim(), req.params.id]
        );
        res.json({ success: true, message: 'Answer posted! 💬' });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete a question I've received
app.delete('/api/anonymous-questions/:id', authenticate, async (req, res) => {
    try {
        const question = await db.queryOne(
            'SELECT * FROM anonymous_questions WHERE id = ? AND receiver_id = ?',
            [req.params.id, req.user.id]
        );
        if (!question) return res.status(404).json({ error: 'Question not found' });

        await db.run('DELETE FROM anonymous_questions WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// ADMIN SYSTEM
// ========================================

const isAdmin = (req, res, next) => {
    const MASTER_ADMIN = 'sankalpbeerappa.253it002@nitk.edu.in';
    if (req.user && req.user.is_admin === 1 && req.user.email === MASTER_ADMIN) {
        next();
    } else {
        console.warn(`🛑 Unauthorized Admin Attempt: ${req.user?.email} tried to access ${req.path}`);
        res.status(403).json({ error: 'Access Denied: Restricted Admin Control' });
    }
};

// 2FA / Vault Unlock for Admin
app.post('/api/admin/unlock', authenticate, isAdmin, async (req, res) => {
    try {
        const { masterPassword } = req.body;
        const correct = process.env.ADMIN_MASTER_PASSWORD;
        if (!correct) return res.status(500).json({ error: 'System error: Master Key not configured on server.' });

        if (masterPassword === correct) {
            res.json({ success: true, message: 'Vault Unlocked' });
        } else {
            res.status(401).json({ error: 'Invalid Master Password' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin Dashboard - Get all reports and pending verifications
app.get('/api/admin/dashboard', authenticate, isAdmin, async (req, res) => {
    try {
        const reports = await db.query(`
            SELECT r.*, u1.name as reporter_name, u2.name as reported_name 
            FROM reports r
            JOIN users u1 ON r.reporter_id = u1.id
            JOIN users u2 ON r.reported_id = u2.id
            ORDER BY r.created_at DESC
        `);

        const pendingVerifications = await db.query(`
            SELECT id, name, branch, year, id_card_url, verification_status 
            FROM users 
            WHERE (id_card_url IS NOT NULL AND verification_status = 'pending')
               OR verification_status = 'unverified'
            ORDER BY created_at ASC
        `);

        const stats = await db.queryOne(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM users WHERE is_verified = 1) as verified_users,
                (SELECT COUNT(*) FROM reports) as total_reports
        `);

        res.json({ reports, pendingVerifications, stats });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Update User Verification Status
app.put('/api/admin/users/:id/verify', authenticate, isAdmin, async (req, res) => {
    try {
        const { status } = req.body; // 'verified' or 'rejected'
        await db.run('UPDATE users SET verification_status = ?, is_verified = ? WHERE id = ?',
            [status, status === 'verified' ? 1 : 0, req.params.id]);
        res.json({ success: true, status });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Ban User
app.put('/api/admin/users/:id/ban', authenticate, isAdmin, async (req, res) => {
    try {
        await db.run('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'User banned' });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Dismiss a report (false flag / resolved)
app.delete('/api/admin/reports/:id/dismiss', authenticate, isAdmin, async (req, res) => {
    try {
        await db.run('DELETE FROM reports WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Report dismissed' });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Change Master Password
app.put('/api/admin/change-master-password', authenticate, isAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const correct = process.env.ADMIN_MASTER_PASSWORD;
        if (!correct) return res.status(500).json({ error: 'Master Key not configured.' });

        if (currentPassword !== correct) {
            return res.status(401).json({ error: 'Current Master Key is incorrect' });
        }
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'New key must be at least 8 characters' });
        }

        // Update in-memory for immediate effect
        process.env.ADMIN_MASTER_PASSWORD = newPassword;

        // Persist to .env file on disk
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf-8');
            if (envContent.includes('ADMIN_MASTER_PASSWORD=')) {
                envContent = envContent.replace(
                    /ADMIN_MASTER_PASSWORD=.*/,
                    `ADMIN_MASTER_PASSWORD=${newPassword}`
                );
            } else {
                envContent += `\nADMIN_MASTER_PASSWORD=${newPassword}\n`;
            }
            fs.writeFileSync(envPath, envContent, 'utf-8');
        }

        res.json({ success: true, message: 'Master Key rotated successfully' });
    } catch (e) {
        console.error('Change master password error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Make someone an admin (You can use this to promote your own account via DB first)
app.put('/api/admin/promote/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await db.run('UPDATE users SET is_admin = 1 WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Broadcast announcement to all users
app.post('/api/admin/broadcast', authenticate, isAdmin, async (req, res) => {
    try {
        const { title, message, type } = req.body; // type: info, warning, success
        if (!title || !message) return res.status(400).json({ error: 'Title and message required' });

        io.emit('admin_announcement', {
            title,
            message,
            type: type || 'info',
            timestamp: new Date()
        });

        res.json({ success: true, message: 'Broadcast sent successfully' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to send broadcast' });
    }
});

// ========================================
// STATS
// ========================================

app.get('/api/stats', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const matchRow = await db.queryOne('SELECT COUNT(*) as c FROM matches WHERE user1_id = ? OR user2_id = ?', [userId, userId]);
        const likesRow = await db.queryOne("SELECT COUNT(*) as c FROM swipes WHERE user_id = ? AND action = 'like'", [userId]);
        const receivedRow = await db.queryOne("SELECT COUNT(*) as c FROM swipes WHERE target_id = ? AND action = 'like'", [userId]);
        res.json({
            matches: matchRow ? matchRow.c : 0,
            likes_given: likesRow ? likesRow.c : 0,
            likes_received: receivedRow ? receivedRow.c : 0
        });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// ACCOUNT MANAGEMENT
// ========================================

app.post('/api/account/deactivate', authenticate, async (req, res) => {
    try {
        await db.run('UPDATE users SET is_active = 0 WHERE id = ?', [req.user.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/account', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        await db.run('DELETE FROM swipes WHERE user_id = ? OR target_id = ?', [userId, userId]);
        const userMatches = await db.query('SELECT id FROM matches WHERE user1_id = ? OR user2_id = ?', [userId, userId]);
        const matchIds = userMatches.map(m => m.id);
        if (matchIds.length > 0) {
            const ph = matchIds.map(() => '?').join(',');
            await db.run(`DELETE FROM messages WHERE match_id IN (${ph})`, matchIds);
            await db.run(`DELETE FROM matches WHERE id IN (${ph})`, matchIds);
        }
        await db.run('DELETE FROM reports WHERE reporter_id = ? OR reported_id = ?', [userId, userId]);
        await db.run('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// ONLINE STATUS
// ========================================

// Get public profile of any user (for viewing match profiles)
app.get('/api/user/:id', authenticate, async (req, res) => {
    try {
        const profile = await db.queryOne(
            'SELECT id, name, age, gender, branch, year, bio, photo, interests, green_flags, red_flags, is_verified FROM users WHERE id = ? AND is_active = 1',
            [req.params.id]
        );
        if (!profile) return res.status(404).json({ error: 'User not found' });
        profile.interests = profile.interests ? JSON.parse(profile.interests) : [];
        profile.green_flags = profile.green_flags ? JSON.parse(profile.green_flags) : [];
        profile.red_flags = profile.red_flags ? JSON.parse(profile.red_flags) : [];
        res.json(profile);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/users/:id/online', authenticate, (req, res) => {
    res.json({ online: onlineUsers.has(req.params.id) });
});

// ========================================
// SNOOZE / GHOST MODE
// ========================================

app.post('/api/profile/snooze', authenticate, async (req, res) => {
    try {
        const { enabled, hours } = req.body;
        if (enabled) {
            const until = hours ? new Date(Date.now() + hours * 3600000).toISOString() : null;
            await db.run('UPDATE users SET is_snoozed = 1, snooze_until = ? WHERE id = ?', [until, req.user.id]);
            res.json({ success: true, message: `Snooze mode on${hours ? ` for ${hours}h` : ''}. Your profile is hidden.` });
        } else {
            await db.run('UPDATE users SET is_snoozed = 0, snooze_until = NULL WHERE id = ?', [req.user.id]);
            res.json({ success: true, message: 'Welcome back! You are visible again.' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// MESSAGE REACTIONS (Instagram-style)
// ========================================

app.post('/api/messages/:messageId/react', authenticate, async (req, res) => {
    try {
        const messageId = parseInt(req.params.messageId);
        const { reaction } = req.body;
        const emoji = reaction || '❤️';

        // Check if already reacted
        const existing = await db.queryOne('SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ?', [messageId, req.user.id]);
        if (existing) {
            // Toggle off
            await db.run('DELETE FROM message_reactions WHERE id = ?', [existing.id]);
            res.json({ success: true, removed: true });
        } else {
            await db.run('INSERT INTO message_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)', [messageId, req.user.id, emoji]);
            // Notify the message sender via socket
            const msg = await db.queryOne('SELECT sender_id, match_id FROM messages WHERE id = ?', [messageId]);
            if (msg && msg.sender_id !== req.user.id) {
                io.to(msg.sender_id.toString()).emit('message_reaction', {
                    message_id: messageId,
                    match_id: msg.match_id,
                    reaction: emoji,
                    from: req.user.name
                });
            }
            res.json({ success: true, removed: false, reaction: emoji });
        }
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/messages/:messageId/reactions', authenticate, async (req, res) => {
    try {
        const reactions = await db.query(
            'SELECT mr.reaction, mr.user_id, u.name FROM message_reactions mr JOIN users u ON mr.user_id = u.id WHERE mr.message_id = ?',
            [parseInt(req.params.messageId)]
        );
        res.json({ reactions });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// PROFILE PROMPTS
// ========================================

app.get('/api/profile/prompts', authenticate, async (req, res) => {
    try {
        const prompts = await db.query('SELECT id, question, answer, position FROM profile_prompts WHERE user_id = ? ORDER BY position ASC', [req.user.id]);
        res.json({ prompts });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/profile/prompts', authenticate, async (req, res) => {
    try {
        const { question, answer } = req.body;
        if (!question || !answer) return res.status(400).json({ error: 'Question and answer required' });

        // Max 3 prompts per user
        const countRow = await db.queryOne('SELECT COUNT(*) as c FROM profile_prompts WHERE user_id = ?', [req.user.id]);
        if (countRow && countRow.c >= 3) return res.status(400).json({ error: 'Maximum 3 prompts allowed. Delete one first.' });

        const position = countRow ? countRow.c : 0;
        await db.run('INSERT INTO profile_prompts (user_id, question, answer, position) VALUES (?, ?, ?, ?)',
            [req.user.id, question, answer, position]);

        const prompts = await db.query('SELECT id, question, answer, position FROM profile_prompts WHERE user_id = ? ORDER BY position ASC', [req.user.id]);
        res.json({ success: true, prompts });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/profile/prompts/:id', authenticate, async (req, res) => {
    try {
        const promptId = parseInt(req.params.id);
        await db.run('DELETE FROM profile_prompts WHERE id = ? AND user_id = ?', [promptId, req.user.id]);
        const prompts = await db.query('SELECT id, question, answer, position FROM profile_prompts WHERE user_id = ? ORDER BY position ASC', [req.user.id]);
        res.json({ success: true, prompts });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// SPOTIFY PROFILE INFO
// ========================================

app.put('/api/profile/spotify', authenticate, async (req, res) => {
    try {
        const { artist, song } = req.body;
        await db.run('UPDATE users SET spotify_artist = ?, spotify_song = ? WHERE id = ?',
            [artist || '', song || '', req.user.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// PREMIUM PAYMENT SYSTEM
// ========================================

// --- User Routes ---

// Check premium status
app.get('/api/premium/status', authenticate, async (req, res) => {
    try {
        const user = await db.queryOne('SELECT is_premium, premium_until FROM users WHERE id = ?', [req.user.id]);
        // Check if premium has expired
        if (user && user.is_premium === 1 && user.premium_until) {
            const expiry = new Date(user.premium_until);
            if (expiry < new Date()) {
                // Premium expired — downgrade
                await db.run('UPDATE users SET is_premium = 0, premium_until = NULL WHERE id = ?', [req.user.id]);
                return res.json({ is_premium: 0, premium_until: null });
            }
        }
        res.json({
            is_premium: user?.is_premium || 0,
            premium_until: user?.premium_until || null
        });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get active payment methods (for users to see QR codes)
app.get('/api/premium/methods', authenticate, async (req, res) => {
    try {
        const methods = await db.query('SELECT id, label, type, qr_image_url, upi_id FROM payment_methods WHERE is_active = 1 ORDER BY id DESC');
        res.json({ methods });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Submit premium payment request
app.post('/api/premium/subscribe', authenticate, upload.single('screenshot'), async (req, res) => {
    try {
        const { transaction_id, payment_method_id, amount } = req.body;
        if (!transaction_id) return res.status(400).json({ error: 'Transaction ID is required' });

        // Check if user already has a pending request
        const existing = await db.queryOne(
            "SELECT id FROM premium_requests WHERE user_id = ? AND status = 'pending'",
            [req.user.id]
        );
        if (existing) return res.status(400).json({ error: 'You already have a pending premium request. Please wait for admin review.' });

        // Handle screenshot upload
        let screenshotUrl = null;
        if (req.file) {
            screenshotUrl = req.file.path || req.file.secure_url || req.file.url || `/uploads/${req.file.filename}`;
        }

        await db.run(
            'INSERT INTO premium_requests (user_id, payment_method_id, transaction_id, screenshot_url, amount) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, payment_method_id || null, transaction_id, screenshotUrl, amount || '49']
        );

        res.json({ success: true, message: 'Payment submitted! Admin will review within 24 hours.' });
    } catch (e) {
        console.error('Premium subscribe error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user's premium requests history
app.get('/api/premium/requests', authenticate, async (req, res) => {
    try {
        const requests = await db.query(
            'SELECT id, transaction_id, amount, status, admin_note, created_at, reviewed_at FROM premium_requests WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json({ requests });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// --- Admin Routes ---

// Get all payment methods (active + inactive)
app.get('/api/admin/payment-methods', authenticate, isAdmin, async (req, res) => {
    try {
        const methods = await db.query('SELECT * FROM payment_methods ORDER BY id DESC');
        res.json({ methods });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Add a new payment method
app.post('/api/admin/payment-methods', authenticate, isAdmin, upload.single('qr_image'), async (req, res) => {
    try {
        const { label, type, upi_id } = req.body;
        if (!label) return res.status(400).json({ error: 'Label is required' });

        let qrImageUrl = null;
        if (req.file) {
            qrImageUrl = req.file.path || req.file.secure_url || req.file.url || `/uploads/${req.file.filename}`;
        }

        await db.run(
            'INSERT INTO payment_methods (label, type, qr_image_url, upi_id) VALUES (?, ?, ?, ?)',
            [label, type || 'qr', qrImageUrl, upi_id || null]
        );

        const methods = await db.query('SELECT * FROM payment_methods ORDER BY id DESC');
        res.json({ success: true, methods });
    } catch (e) {
        console.error('Add payment method error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Toggle payment method active/inactive
app.put('/api/admin/payment-methods/:id/toggle', authenticate, isAdmin, async (req, res) => {
    try {
        const method = await db.queryOne('SELECT is_active FROM payment_methods WHERE id = ?', [parseInt(req.params.id)]);
        if (!method) return res.status(404).json({ error: 'Payment method not found' });
        await db.run('UPDATE payment_methods SET is_active = ? WHERE id = ?', [method.is_active === 1 ? 0 : 1, parseInt(req.params.id)]);
        const methods = await db.query('SELECT * FROM payment_methods ORDER BY id DESC');
        res.json({ success: true, methods });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete payment method
app.delete('/api/admin/payment-methods/:id', authenticate, isAdmin, async (req, res) => {
    try {
        await db.run('DELETE FROM payment_methods WHERE id = ?', [parseInt(req.params.id)]);
        const methods = await db.query('SELECT * FROM payment_methods ORDER BY id DESC');
        res.json({ success: true, methods });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all premium requests (admin)
app.get('/api/admin/premium-requests', authenticate, isAdmin, async (req, res) => {
    try {
        const requests = await db.query(
            `SELECT pr.*, u.name as user_name, u.email as user_email, u.branch as user_branch
             FROM premium_requests pr
             JOIN users u ON pr.user_id = u.id
             ORDER BY CASE WHEN pr.status = 'pending' THEN 0 ELSE 1 END, pr.created_at DESC`
        );
        res.json({ requests });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Approve premium request
app.put('/api/admin/premium-requests/:id/approve', authenticate, isAdmin, async (req, res) => {
    try {
        const request = await db.queryOne('SELECT * FROM premium_requests WHERE id = ?', [parseInt(req.params.id)]);
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

        // Set premium for 30 days from now
        const premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        await db.run('UPDATE premium_requests SET status = ?, admin_note = ?, reviewed_at = ? WHERE id = ?',
            ['approved', req.body.note || 'Approved', new Date().toISOString(), parseInt(req.params.id)]);

        await db.run('UPDATE users SET is_premium = 1, premium_until = ? WHERE id = ?',
            [premiumUntil, request.user_id]);

        res.json({ success: true, message: 'User upgraded to premium!' });
    } catch (e) {
        console.error('Approve premium error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// Reject premium request
app.put('/api/admin/premium-requests/:id/reject', authenticate, isAdmin, async (req, res) => {
    try {
        const request = await db.queryOne('SELECT * FROM premium_requests WHERE id = ?', [parseInt(req.params.id)]);
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

        await db.run('UPDATE premium_requests SET status = ?, admin_note = ?, reviewed_at = ? WHERE id = ?',
            ['rejected', req.body.note || 'Rejected', new Date().toISOString(), parseInt(req.params.id)]);

        res.json({ success: true, message: 'Request rejected' });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ========================================
// MATCH EXPIRATION (48h auto-cleanup)
// ========================================

// Run every hour: expire matches with no messages after 48h
setInterval(async () => {
    try {
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        // Find matches older than 48h with zero messages
        const expiredMatches = await db.query(
            `SELECT m.id FROM matches m
             WHERE m.created_at < ?
               AND NOT EXISTS (SELECT 1 FROM messages msg WHERE msg.match_id = m.id)`,
            [cutoff]
        );
        for (const match of expiredMatches) {
            await db.run('DELETE FROM matches WHERE id = ?', [match.id]);
        }
        if (expiredMatches.length > 0) {
            console.log(`🕐 Expired ${expiredMatches.length} idle matches (48h no messages)`);
        }
    } catch (e) {
        // Silently ignore — timer will retry
    }
}, 60 * 60 * 1000); // Every hour

// Auto un-snooze users whose snooze expired
setInterval(async () => {
    try {
        const now = new Date().toISOString();
        await db.run('UPDATE users SET is_snoozed = 0, snooze_until = NULL WHERE is_snoozed = 1 AND snooze_until IS NOT NULL AND snooze_until < ?', [now]);
    } catch (e) { /* ignore */ }
}, 5 * 60 * 1000); // Every 5 minutes

// Global error handler
app.use((err, req, res, next) => {
    console.error('--- GLOBAL ERROR ---');
    console.error(err);
    res.status(500).json({ error: 'Server error: ' + err.message });
});

// ========================================
// SPA fallback
// ========================================
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(spaRoot, 'index.html'));
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// ========================================
// Graceful Shutdown
// ========================================
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received. Shutting down gracefully...');
    // Save sql.js DB before exit
    try { if (typeof saveSqlJsDb === 'function') saveSqlJsDb(); } catch (e) { /* ignore */ }
    server.close(() => { process.exit(0); });
});

process.on('SIGINT', () => {
    console.log('📴 SIGINT received. Shutting down...');
    try { if (typeof saveSqlJsDb === 'function') saveSqlJsDb(); } catch (e) { /* ignore */ }
    server.close(() => { process.exit(0); });
});

// ========================================
// Start
// ========================================
async function start() {
    checkEmailConfig();
    await db.initTables();

    // Ensure main developer account has admin privileges in production
    try {
        await db.run('UPDATE users SET is_admin = 1 WHERE email = ?', ['sankalpbeerappa.253it002@nitk.edu.in']);
        console.log('🛡️ Admin status verified for main operator');
    } catch (e) {
        console.error('Failed to set admin status:', e.message);
    }

    // Seed default payment method if none exist
    try {
        const existingMethods = await db.query('SELECT id FROM payment_methods LIMIT 1');
        if (!existingMethods || existingMethods.length === 0) {
            await db.run(
                'INSERT INTO payment_methods (label, type, upi_id, is_active) VALUES (?, ?, ?, ?)',
                ['UPI Payment', 'upi', 'sankalpbeerappa@oksbi', 1]
            );
            console.log('💳 Default UPI payment method seeded');
        }
    } catch (e) {
        console.error('Payment seed error:', e.message);
    }

    server.listen(PORT, () => {
        console.log(`\n🚀 Aura running at http://localhost:${PORT}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
}

start().catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
});
