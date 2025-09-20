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
const COOKIE_SECRET = process.env.COOKIE_SECRET; // CRITICAL: This is now used for signing cookies
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
// Initialize cookie-parser with a secret for signed cookies
app.use(cookieParser(COOKIE_SECRET)); 
app.use(passport.initialize());

// --- PASSPORT (GOOGLE OAUTH) SETUP ---
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL
  },
  (accessToken, refreshToken, profile, done) => {
    // In a real app, you would find or create a user in your database here.
    const user = {
      id: profile.id,
      name: profile.displayName,
      email: profile.emails[0].value,
      avatarUrl: profile.photos[0].value,
    };
    return done(null, user);
  }
));

// --- AUTHENTICATION ROUTES ---
// This is the endpoint your "Sign In" button will link to.
app.get('/api/login', (req, res, next) => {
    const { redirect_url } = req.query;
    console.log(`[LOGIN] Received login request. Redirect URL is: ${redirect_url}`);

    if (redirect_url) {
        // CRITICAL FIX: Set a short-lived, signed cookie to remember the redirect URL.
        // This is more reliable than using the 'state' parameter across domains.
        res.cookie('authRedirectUrl', redirect_url, {
            signed: true,
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
            maxAge: 5 * 60 * 1000 // 5 minutes expiry
        });
        console.log(`[LOGIN] Set authRedirectUrl cookie.`);
    }
    
    passport.authenticate('google', { 
        scope: ['profile', 'email']
    })(req, res, next);
});

// This is the endpoint Google will send the user back to.
app.get('/api/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: 'https://dverse.fun?auth_failed=true', session: false }),
  (req, res) => {
    const user = req.user;
    console.log(`[CALLBACK] User authenticated: ${user.email}`);

    // CRITICAL FIX: Read the redirect URL from the secure, signed cookie.
    const finalRedirect = req.signedCookies.authRedirectUrl || 'https://ai.dverse.fun';
    console.log(`[CALLBACK] Redirecting to: ${finalRedirect}`);

    // Clear the temporary redirect cookie as it's no longer needed.
    res.clearCookie('authRedirectUrl');

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl }, JWT_SECRET, { expiresIn: '7d' });

    // This is the CRITICAL part for sharing the login across subdomains.
    res.cookie('dverseSessionToken', token, {
        httpOnly: true,
        secure: true, // Only sent over HTTPS
        sameSite: 'Lax', // Good security practice
        domain: '.dverse.fun', // The leading dot is key!
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    console.log(`[CALLBACK] Set dverseSessionToken cookie for domain .dverse.fun`);
    
    res.redirect(finalRedirect);
  }
);

// --- SECURE API ROUTES ---
const verifyToken = (req, res, next) => {
    const token = req.cookies.dverseSessionToken;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // If the token is bad, clear the cookie
            res.clearCookie('dverseSessionToken', { domain: '.dverse.fun', path: '/' });
            return res.status(403).json({ error: "Forbidden: Invalid Token" });
        }
        req.user = user;
        next();
    });
};

app.get('/api/user', verifyToken, (req, res) => {
    // We just return the user data that was already stored in the token.
    res.json({
        name: req.user.name,
        email: req.user.email,
        avatarUrl: req.user.avatarUrl
    });
});

app.post('/api/generate', verifyToken, async (req, res) => {
    try {
        const { modelId, modelType, chatHistory } = req.body;
        const model = ai.getGenerativeModel({ model: modelId });
        
        let result;
        const lastUserPrompt = chatHistory[chatHistory.length - 1];

        if (modelType === 'image') {
            result = await model.generateContent({ parts: lastUserPrompt.parts });
        } else {
             result = await model.generateContent({ contents: chatHistory });
        }
        
        // Ensure we send back a structured response Vercel can handle
        res.status(200).json(result.response.candidates[0].content);

    } catch (error) {
        console.error("Error in /api/generate:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to generate content from Gemini API." });
    }
});

// Vercel handles the server listening part, so we just export the app
module.exports = app;

