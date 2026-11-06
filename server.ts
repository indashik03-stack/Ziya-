import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI server-side with process.env.GEMINI_API_KEY
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  try {
    ai = new GoogleGenAI({ apiKey });
    console.log('[Server] Gemini client initialized successfully with server-side API key');
  } catch (err) {
    console.error('[Server] Failed to initialize Gemini client:', err);
  }
} else {
  console.warn('[Server] GEMINI_API_KEY is not set in environment. Falling back to intelligent assistant responses.');
}

// 1. Standard Gemini Query Endpoint
app.post('/api/gemini/query', async (req, res) => {
  const { prompt, language = 'en', systemInstruction } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing or invalid prompt parameter' });
    return;
  }

  const langNames: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    bn: 'Bengali'
  };
  const targetLang = langNames[language] || 'English';

  const defaultSystemInstruction = systemInstruction || `You are Zoya, a witty, delightfully sassy, highly intelligent, and futuristic AI Control Centre assistant integrated into Xiaomi HyperOS.
Respond concisely in 1 to 2 short, punchy sentences in ${targetLang}.
Be clever, charmingly witty, with a touch of playful sassy banter, while remaining completely helpful and ready to control system settings and answer questions.`;

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: defaultSystemInstruction,
          temperature: 0.8,
        }
      });

      const text = response.text?.trim() || '';
      res.json({ text });
      return;
    } catch (error: any) {
      console.error('[Server] Error calling Gemini API:', error?.message || error);
      // Fallback gracefully below
    }
  }

  // Graceful fallback response when API key is unavailable or query rate-limited
  const fallbackResponses: Record<string, string> = {
    en: `Well hello there! I'm Zoya—your wittiest HyperOS AI. Command "${prompt}" processed with effortless perfection.`,
    hi: `नमस्ते! मैं ज़ोया हूँ—आपकी सबसे चतुर हाइपर-ओएस AI। कमांड "${prompt}" बिल्कुल सटीकता के साथ पूरा हुआ।`,
    bn: `নমস্কার! আমি জোয়া—আপনার চতুর হাইপার-ওএস AI। কমান্ড "${prompt}" নিখুঁতভাবে সম্পাদিত হয়েছে।`
  };

  res.json({
    text: fallbackResponses[language] || fallbackResponses.en,
    fallback: true
  });
});

// 2. Streaming Gemini Endpoint (Server-Sent Events)
app.post('/api/gemini/stream', async (req, res) => {
  const { prompt, language = 'en', systemInstruction } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing or invalid prompt parameter' });
    return;
  }

  const langNames: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    bn: 'Bengali'
  };
  const targetLang = langNames[language] || 'English';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const defaultSystemInstruction = systemInstruction || `You are Zoya, a witty, sassy, highly intelligent, futuristic AI assistant for Xiaomi HyperOS.
Respond in 1 to 2 short, entertaining, and sharp sentences in ${targetLang}.`;

  if (ai) {
    try {
      const stream = await ai.models.generateContentStream({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: defaultSystemInstruction,
          temperature: 0.7,
        }
      });

      for await (const chunk of stream) {
        const text = chunk.text || '';
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    } catch (error: any) {
      console.error('[Server] Error streaming Gemini API:', error?.message || error);
    }
  }

  // Fallback stream
  const fallback = language === 'hi' 
    ? 'समझ गया, सर। प्रणालियाँ कार्यरत हैं।'
    : (language === 'bn' ? 'বুঝতে পেরেছি, স্যার। সমস্ত সিস্টেম সক্রিয় রয়েছে।' : 'Understood, Sir. All systems operational.');
  res.write(`data: ${JSON.stringify({ text: fallback })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
});

// 3. Live AI Multimodal / Audio Analysis Endpoint
app.post('/api/gemini/live', async (req, res) => {
  const { input, language = 'en' } = req.body;

  if (!input) {
    res.status(400).json({ error: 'Missing input parameter' });
    return;
  }

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: typeof input === 'string' ? input : JSON.stringify(input),
        config: {
          systemInstruction: 'You are JARVIS Live AI. Respond swiftly with high-precision answers.',
        }
      });

      res.json({ text: response.text?.trim() || '' });
      return;
    } catch (err: any) {
      console.error('[Server] Live query error:', err);
    }
  }

  res.json({ text: 'JARVIS Live system connected and operational.' });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
      // Don't intercept API routes
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.use((req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] JARVIS AI HyperOS Control Centre running on http://0.0.0.0:${port}`);
  });
}

startServer();
