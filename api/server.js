// Use dotenv to load environment variables from a .env file
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
// Use a port from environment variables or default to 3000
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(cors()); // Allow requests from your frontend
app.use(express.json({ limit: '10mb' })); // Allow the server to understand JSON, with a higher limit for images

// This is the main endpoint your frontend will call
app.post('/api/chat', async (req, res) => {
    // Extract the necessary data from the frontend's request
    const { modelId, modelType, chatHistory, apiKey } = req.body;

    const SECURE_API_KEY = apiKey;
    
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${SECURE_API_KEY}`;

    let payload;

    // Construct the correct payload based on the model type
    if (modelType === 'image') {
        // For image models, which are not multi-turn, we send only the last user message.
        const lastUserMessage = chatHistory[chatHistory.length - 1];
        payload = {
            contents: [{ role: "user", parts: lastUserMessage.parts }],
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
        };
    } else {
        // For text models, we send the entire conversation history.
        payload = { contents: chatHistory };
    }

    try {
        // Forward the request to the official Gemini API
        const response = await axios.post(API_URL, payload);
        // Send the response from Gemini back to your frontend
        res.json(response.data);
    } catch (error) {
        console.error('Error calling Gemini API:', error.response ? error.response.data : error.message);
        // Send a detailed error message back to the frontend
        res.status(error.response?.status || 500).json({ 
            message: "Failed to get response from Gemini API.",
            error: error.response?.data?.error || "Unknown server error."
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`D'Ai backend server is running on http://localhost:${PORT}`);
});

