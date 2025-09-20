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
// These are read from your Vercel Environment Variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL; // e.g., https://ai.dverse.fun/api/auth/google/callback
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const app = express();
const ai = new GoogleGenAI(GEMINI_API_KEY);

// --- MIDDLEWARE SETUP ---
// CRITICAL FIX: Ensure your live domains are listed here for CORS
const allowedOrigins = [
    'https://ai.dverse.fun',    // Your chatbot app
    'https://dverse.fun',      // Your main portal
    'https://games.dverse.fun' // Your games portal
];
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
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
    passReqToCallback: true // Allows us to access the request object
  },
  (req, accessToken, refreshToken, profile, done) => {
    // In a real app, you'd find or create a user in your database here
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
// CRITICAL FIX #1: Using the 'state' parameter to pass the redirect_url
app.get('/login', (req, res) => {
    const { redirect_url } = req.query;
    // We encode the final destination URL into a 'state' parameter.
    // Google will hold onto this and give it back to us after login.
    const state = redirect_url ? Buffer.from(JSON.stringify({ redirect_url })).toString('base64') : undefined;
    
    const authenticator = passport.authenticate('google', { 
        scope: ['profile', 'email'],
        state: state 
    });
    authenticator(req, res);
});

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: 'https://dverse.fun', session: false }), // We don't need server sessions
  (req, res) => {
    const user = req.user;
    
    // CRITICAL FIX #1 (continued): We get the 'state' back from Google and decode it.
    let finalRedirect = 'https://dverse.fun'; // Default fallback
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

    // CRITICAL FIX #2: Setting a domain-wide cookie
    res.cookie('dverseSessionToken', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        domain: '.dverse.fun', // The leading dot makes it accessible to all subdomains
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.redirect(finalRedirect);
  }
);

// --- SECURE API ROUTES ---
const verifyToken = (req, res, next) => {
    const token = req.cookies.dverseSessionToken;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Forbidden" });
        req.user = user;
        next();
    });
};

app.get('/api/user', verifyToken, (req, res) => {
    res.json({
        name: req.user.name,
        email: req.user.email,
        avatarUrl: req.user.avatarUrl
    });
});

app.post('/api/generate', verifyToken, async (req, res) => {
    try {
        const { modelId, chatHistory } = req.body;
        const model = ai.getGenerativeModel({ model: modelId });
        
        const lastUserPrompt = chatHistory[chatHistory.length - 1];
        const result = await model.generateContent(lastUserPrompt);
        
        res.json(result.response.candidates[0].content);
    } catch (error) {
        console.error("Error in /api/generate:", error.message);
        res.status(500).json({ error: "Failed to generate content from Gemini API." });
    }
});

// Vercel handles the server listening part, so we just export the app
module.exports = app;

