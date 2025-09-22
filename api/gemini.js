// api/gemini.js
import { GoogleGenAI, Modality } from "@google/genai";

let ai;
try {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable is not set.");
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} catch (e) {
    console.error("Failed to initialize GoogleGenAI:", e.message);
}

// In-memory session storage for chat history
const chatSessions = new Map();

function getChatSession(sessionId) {
    if (!chatSessions.has(sessionId)) {
        if (!ai) throw new Error("AI not initialized.");
        const TEXT_MODEL_INSTRUCTION = `You are D'Ai, a helpful text-only assistant made by Dhairya Shah. You CANNOT create images. If a user asks you to draw or create an image, politely decline and tell them to use the "D'Ai - Paint" model instead.`;
        chatSessions.set(sessionId, ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction: TEXT_MODEL_INSTRUCTION },
        }));
    }
    return chatSessions.get(sessionId);
}


function _processResponseParts(parts) {
    if (!parts || parts.length === 0) return [];
    
    return parts.map(part => {
        if (part.inlineData) {
            const { mimeType, data } = part.inlineData;
            return { imageData: `data:${mimeType};base64,${data}` };
        }
        
        if (part.text != null) {
             if (typeof part.text === 'string') {
                 return { text: part.text };
             } else if (typeof part.text === 'object') {
                 try {
                    const jsonString = JSON.stringify(part.text, null, 2);
                    return { text: `\`\`\`json\n${jsonString}\n\`\`\`` };
                 } catch (e) {
                     return { text: '[Unsupported content: Could not format object]' };
                 }
             }
        }
        return null; 
    }).filter(p => p !== null);
}


export default async function handler(req, res) {
    if (!ai) {
        return res.status(500).json({ error: "AI service is not initialized. Check server logs for details." });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { action, payload } = req.body;

        if (!action || !payload) {
             return res.status(400).json({ error: 'Missing action or payload' });
        }

        switch (action) {
            case 'sendMessage': {
                const { message, sessionId } = payload;
                const chat = getChatSession(sessionId);
                const response = await chat.sendMessage({ message });

                // Use the recommended `response.text` for robust text extraction
                const responseText = response.text;
                
                if (!responseText) {
                     const finishReason = response.candidates?.[0]?.finishReason;
                     if (finishReason && finishReason !== 'STOP') {
                         return res.json({ parts: [{ text: `The response was stopped prematurely. Reason: ${finishReason}` }]});
                     }
                     return res.json({ parts: [{ text: "I received a response, but it was empty." }]});
                }
                
                // The frontend expects a `parts` array, so we wrap the text response
                const messageParts = [{ text: responseText }];
                return res.status(200).json({ parts: messageParts });
            }

            case 'nanoBanana': {
                const { prompt, image } = payload;
                const modelParts = [];

                if (image) {
                    const base64Data = image.data.split(',')[1];
                    modelParts.push({ inlineData: { data: base64Data, mimeType: image.mimeType } });
                }
                if (prompt) {
                    modelParts.push({ text: prompt });
                }

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-image-preview',
                    contents: { parts: modelParts },
                    config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
                });
                
                const parts = response.candidates?.[0]?.content?.parts;
                const messageParts = _processResponseParts(parts);

                if (messageParts.length === 0) {
                    const finishReason = response.candidates?.[0]?.finishReason;
                    if (finishReason && finishReason !== 'STOP') {
                        return res.json({ parts: [{ text: `Nano Banana stopped prematurely. Reason: ${finishReason}` }] });
                    }
                    return res.json({ parts: [{ text: "Nano Banana returned an empty response." }]});
                }
                return res.status(200).json({ parts: messageParts });
            }

            case 'clearChat': {
                const { sessionId } = payload;
                if (chatSessions.has(sessionId)) {
                    chatSessions.delete(sessionId);
                }
                return res.status(200).json({ message: 'Chat history cleared' });
            }

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}
