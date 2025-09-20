// Use dotenv to load environment variables from a .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { GoogleGenAI } = require("@google/genai");

// --- CONFIGURATION ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL; // e.g., https://d-ai-omega.vercel.app/api/auth/google/callback
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const app = express();
const ai = new GoogleGenAI(GEMINI_API_KEY);

// --- MIDDLEWARE SETUP ---
const allowedOrigins = [
    'https://ai.dverse.fun',
    'https://dverse.fun',
    'https://games.dverse.fun',
    'https://d-ai-omega.vercel.app' 
];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser(COOKIE_SECRET)); 
app.use(passport.initialize());

// --- PASSPORT (GOOGLE OAUTH) SETUP ---
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL
  },
  (accessToken, refreshToken, profile, done) => {
    const user = {
      id: profile.id,
      name: profile.displayName,
      email: profile.emails[0].value,
      avatarUrl: profile.photos[0].value,
    };
    return done(null, user);
  }
));

// --- API ROOT ---
app.get('/', (req, res) => {
    res.status(200).json({ message: "D'Ai Backend is running." });
});


// --- AUTHENTICATION ROUTES ---
// CRITICAL FIX: The path is now '/login', not '/api/login'
app.get('/login', (req, res, next) => {
    const { redirect_url } = req.query;
    if (redirect_url) {
        res.cookie('authRedirectUrl', redirect_url, {
            signed: true,
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
            maxAge: 5 * 60 * 1000 // 5 minutes expiry
        });
    }
    passport.authenticate('google', { 
        scope: ['profile', 'email']
    })(req, res, next);
});

// CRITICAL FIX: The path is now '/auth/google/callback'
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: 'https://dverse.fun?auth_failed=true', session: false }),
  (req, res) => {
    const user = req.user;
    const finalRedirect = req.signedCookies.authRedirectUrl || 'https://ai.dverse.fun';
    res.clearCookie('authRedirectUrl');

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('dverseSessionToken', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        domain: '.dverse.fun',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
    
    res.redirect(finalRedirect);
  }
);

// --- SECURE API ROUTES ---
const verifyToken = (req, res, next) => {
    const token = req.cookies.dverseSessionToken;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.clearCookie('dverseSessionToken', { domain: '.dverse.fun', path: '/' });
            return res.status(403).json({ error: "Forbidden: Invalid Token" });
        }
        req.user = user;
        next();
    });
};

// CRITICAL FIX: The path is now '/user'
app.get('/user', verifyToken, (req, res) => {
    res.json({
        name: req.user.name,
        email: req.user.email,
        avatarUrl: req.user.avatarUrl
    });
});

// CRITICAL FIX: The path is now '/generate'
app.post('/generate', verifyToken, async (req, res) => {
    try {
        const { modelId, modelType, chatHistory } = req.body;
        const model = ai.getGenerativeModel({ model: modelId });
        
        let result;
        const lastUserPrompt = chatHistory[chatHistory.length - 1];

        if (modelType === 'image') {
            const imageParts = lastUserPrompt.parts.filter(p => p.inlineData);
            const textParts = lastUserPrompt.parts.filter(p => p.text);
            const prompt = [textParts[0].text, ...imageParts];
            result = await model.generateContent(prompt);
        } else {
             result = await model.generateContentStream({ contents: chatHistory });
        }
        
        res.status(200).json(result.response.candidates[0].content);

    } catch (error) {
        console.error("Error in /generate:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to generate content from Gemini API." });
    }
});

// --- CATCH-ALL 404 HANDLER ---
app.use((req, res, next) => {
    res.status(404).json({ error: 'Not Found' });
});


// Vercel handles the server listening part, so we just export the app
module.exports = app;

