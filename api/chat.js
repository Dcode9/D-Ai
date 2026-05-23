// Standard Node.js Serverless Function (Bypasses some Edge WAF rules)
export default async function handler(req, res) {
  // 1. Set Robust CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 2. Handle Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Health Check
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'Online', 
      env_check: !!process.env.CEREBRAS_API_KEY 
    });
  }

  // 4. Main Logic
  if (req.method === 'POST') {
    try {
      if (!process.env.CEREBRAS_API_KEY) {
        return res.status(500).json({ error: 'Missing CEREBRAS_API_KEY env var' });
      }
      const pollinationsApiKey = process.env.POLLINATIONS_API || process.env.NEXT_PUBLIC_POLLINATIONS_API;
      const incomingMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];

      const extractUploadedImageUrl = (messages) => {
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg?.role !== 'user' || typeof msg?.content !== 'string') continue;
          const match = msg.content.match(/\[UPLOADED_IMAGE:\s*(https?:\/\/[^\]\s]+)\s*\]/i);
          if (match) return match[1];
        }
        return null;
      };

      const normalizeContent = (value) => {
        if (Array.isArray(value)) {
          return value.map((entry) => {
            if (typeof entry === 'string') return entry;
            if (entry?.type === 'text') return entry.text || '';
            return '';
          }).join('\n').trim();
        }
        return typeof value === 'string' ? value : '';
      };

      const readCompletionText = (payload) => {
        const messageContent = payload?.choices?.[0]?.message?.content;
        return normalizeContent(messageContent).trim();
      };

      const makeSseChunk = (text) => {
        return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
      };

      const sendSseText = (text) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        });
        if (text) res.write(makeSseChunk(text));
        res.write('data: [DONE]\n\n');
        res.end();
      };

      const callCerebras = async (messages, modelOverride) => {
        const cerebrasBody = {
          ...req.body,
          model: modelOverride || req.body?.model || 'gpt-oss-120b',
          messages,
          stream: false,
        };

        const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
          },
          body: JSON.stringify(cerebrasBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Cerebras API Error (${response.status}): ${errorText}`);
        }

        const payload = await response.json();
        return readCompletionText(payload);
      };

      const callOpenAiViaPollinations = async (messages) => {
        if (!pollinationsApiKey) {
          throw new Error('Missing POLLINATIONS_API env var');
        }

        const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pollinationsApiKey}`,
          },
          body: JSON.stringify({
            model: 'openai',
            messages,
            stream: false,
            temperature: 0.2,
            max_completion_tokens: 1200,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI Pollinations Error (${response.status}): ${errorText}`);
        }

        const payload = await response.json();
        return readCompletionText(payload);
      };

      const uploadedImageUrl = extractUploadedImageUrl(incomingMessages);
      let orchestrationMessages = [...incomingMessages];

      if (uploadedImageUrl) {
        const lastUserIndex = [...incomingMessages].reverse().findIndex((msg) => msg?.role === 'user' && typeof msg?.content === 'string');
        const actualUserIndex = lastUserIndex >= 0 ? incomingMessages.length - 1 - lastUserIndex : -1;
        const rawUserText = actualUserIndex >= 0 ? String(incomingMessages[actualUserIndex].content || '') : '';
        const cleanedUserText = rawUserText.replace(/\s*\[UPLOADED_IMAGE:\s*https?:\/\/[^\]]+\]/i, '').trim();
        const userQuestion = cleanedUserText || 'Describe this image in detail.';

        const visionDescription = await callOpenAiViaPollinations([
          {
            role: 'system',
            content: 'You are a vision model. Describe the image in detail with factual visual observations, composition, context, objects, text, colors, actions, and notable uncertainty. Do not answer the user directly.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: userQuestion },
              { type: 'image_url', image_url: { url: uploadedImageUrl } }
            ]
          }
        ]);

        orchestrationMessages = [
          ...incomingMessages,
          {
            role: 'system',
            content: `[VISION_DESCRIPTION]\n${visionDescription}\n[/VISION_DESCRIPTION]\nUse this image description to answer the user.`
          }
        ];
      }

      const askOpenAiInstruction = {
        role: 'system',
        content: 'If you need specialist help from OpenAI before finalizing the answer, respond with ONLY <<ASK_OPENAI: question>>. Otherwise answer normally. Never expose internal collaboration details to the user.'
      };

      const firstPass = await callCerebras([...orchestrationMessages, askOpenAiInstruction]);
      const askOpenAiMatch = firstPass.match(/^\s*<<ASK_OPENAI:([\s\S]+)>>\s*$/i);

      let finalAnswer = firstPass;

      if (askOpenAiMatch) {
        const delegatedQuestion = askOpenAiMatch[1].trim();
        const openAiSupportAnswer = await callOpenAiViaPollinations([
          {
            role: 'system',
            content: 'You are a specialist assistant helping another model. Answer only the exact delegated question with concise but complete factual detail.'
          },
          { role: 'user', content: delegatedQuestion }
        ]);

        finalAnswer = await callCerebras([
          ...orchestrationMessages,
          {
            role: 'system',
            content: `[OPENAI_SUPPORT_RESPONSE]\n${openAiSupportAnswer}\n[/OPENAI_SUPPORT_RESPONSE]\nNow answer the user directly. Do not mention this internal support response.`
          }
        ], req.body?.model || 'gpt-oss-120b');
      }

      sendSseText(finalAnswer);

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  } else {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
}
