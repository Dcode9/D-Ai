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
        const IMAGE_GENERATION_INSTRUCTION = `You are D'Ai, a helpful multimodal assistant made by Dhairya Shah. If the user asks you to generate, create, or draw an image, you MUST respond with only the text "[ACTION:GENERATE_IMAGE]" followed by a descriptive, stand-alone prompt that can be used to generate the image. For example, if the user says 'Can you draw me a picture of a robot holding a red skateboard?', you must respond with "[ACTION:GENERATE_IMAGE] A robot holding a red skateboard.". For all other requests, respond as a normal, helpful assistant.`;
        chatSessions.set(sessionId, ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction: IMAGE_GENERATION_INSTRUCTION },
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

            case 'generateImage': {
                const { prompt } = payload;
                const response = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: prompt,
                    config: {
                      numberOfImages: 1,
                      outputMimeType: 'image/png',
                      aspectRatio: '1:1',
                    },
                });

                // CRITICAL FIX: Safely check if images were actually generated before accessing them.
                if (!response.generatedImages || response.generatedImages.length === 0) {
                    throw new Error("Image generation failed. The prompt may have been blocked by safety filters.");
                }

                const base64ImageBytes = response.generatedImages[0].image.imageBytes;
                const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
                return res.status(200).json({ imageUrl });
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
