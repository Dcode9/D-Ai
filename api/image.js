import { initializeApp } from 'firebase/app';
import {
  getGenerativeModel,
  getAI,
  HarmBlockThreshold,
  HarmCategory,
} from 'firebase/ai';

// VertexAI Backend class for Firebase AI SDK
class VertexAIBackend {
  constructor(options) {
    this.location = options.location || 'global';
  }
}

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { prompt, width, height, seed, model, image } = await req.json();

    const apiKey = process.env.VERTEX_API;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Configuration Error: VERTEX_API key is missing." }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const finalPrompt = prompt && prompt.trim() ? prompt : "abstract art";

    // Initialize Firebase with minimal config
    const firebaseApp = initializeApp({
      apiKey: apiKey,
    });

    // Configure generation settings
    const generationConfig = {
      temperature: 1,
      topP: 0.95,
      maxOutputTokens: 32768,
      responseMimeType: "",
    };

    // Configure safety settings (all OFF as per requirements)
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.OFF,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.OFF,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.OFF,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.OFF,
      },
    ];

    // Initialize AI with VertexAI backend
    const ai = getAI(firebaseApp, {
      backend: new VertexAIBackend({ location: "global" })
    });

    // Get the generative model
    const aiModel = getGenerativeModel(ai, {
      model: model || "gemini-2.5-flash-image",
      generationConfig,
      safetySettings,
    });

    // Start a chat session
    const chat = aiModel.startChat();

    // Prepare content for image generation
    let content = [finalPrompt];

    // If source image is provided, include it for editing
    if (image) {
      content = [
        { text: finalPrompt },
        { image: image }
      ];
    }

    // Send message to generate image
    const result = await chat.sendMessage(content);

    // Get the response
    const response = result.response;
    const generatedContent = response.text();

    // For now, return the text response
    // Note: Actual image generation would require proper handling of the response
    // which may contain image URLs or base64 data depending on Vertex AI's response format

    return new Response(JSON.stringify({
      success: true,
      content: generatedContent,
      prompt: finalPrompt
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Vertex AI Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
