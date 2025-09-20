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
app.use(cookieParser());
app.use(passport.initialize());

// --- PASSPORT (GOOGLE OAUTH) SETUP ---
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL,
    passReqToCallback: true
  },
  (req, accessToken, refreshToken, profile, done) => {
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
    // We safely encode the final destination URL into the 'state' parameter.
    const state = redirect_url ? Buffer.from(JSON.stringify({ redirect_url })).toString('base64') : undefined;
    
    const authenticator = passport.authenticate('google', { 
        scope: ['profile', 'email'],
        state: state 
    });
    authenticator(req, res, next);
});

// This is the endpoint Google will send the user back to.
app.get('/api/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: 'https://dverse.fun?auth_failed=true', session: false }),
  (req, res) => {
    const user = req.user;
    
    // Default redirect location if something goes wrong.
    let finalRedirect = 'https://ai.dverse.fun'; 
    if (req.query.state) {
        try {
            const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString('utf8'));
            if (state.redirect_url) {
                finalRedirect = state.redirect_url;
            }
        } catch (e) {
            console.error("Failed to parse state:", e);
        }
    }

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
    
    res.redirect(finalRedirect);
  }
);

// --- SECURE API ROUTES ---
const verifyToken = (req, res, next) => {
    const token = req.cookies.dverseSessionToken;
    if (!token) return res.status(41).json({ error: "Unauthorized" });

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
        name: req.user.name, // CRITICAL FIX: Was req.user.aname
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
            result = await model.generateContent({ parts: lastUserPro

