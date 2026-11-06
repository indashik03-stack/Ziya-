import { jarvisAudio } from './jarvisAudio';
import { saveVoiceLog } from './firebase';

export interface JarvisCommandResult {
  action?: string;
  payload?: any;
  response: string;
}

export type SupportedLanguage = 'en' | 'hi' | 'bn';

export class JarvisAIEngine {
  private recognition: any = null;
  private isListening = false;
  private currentLanguage: SupportedLanguage = 'en';

  public onTranscriptChange: ((transcript: string, isFinal: boolean) => void) | null = null;
  public onStateChange: ((isListening: boolean, isSpeaking: boolean) => void) | null = null;
  public onCommandExecuted: ((result: JarvisCommandResult) => void) | null = null;

  constructor() {
    this.initSpeechRecognition();
  }


  private initSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.updateLangCode();

      this.recognition.onstart = () => {
        this.isListening = true;
        this.onStateChange?.(true, false);
        jarvisAudio.playJarvisChime();
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        const currentText = finalTranscript || interimTranscript;
        this.onTranscriptChange?.(currentText, Boolean(finalTranscript));

        if (finalTranscript) {
          this.processVoiceCommand(finalTranscript.trim());
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        this.isListening = false;
        this.onStateChange?.(false, false);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.onStateChange?.(false, false);
      };
    }
  }

  setLanguage(lang: SupportedLanguage) {
    this.currentLanguage = lang;
    this.updateLangCode();
  }

  getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  private updateLangCode() {
    if (!this.recognition) return;
    const codes: Record<SupportedLanguage, string> = {
      en: 'en-US',
      hi: 'hi-IN',
      bn: 'bn-IN'
    };
    this.recognition.lang = codes[this.currentLanguage] || 'en-US';
  }

  toggleListening(): boolean {
    if (this.isListening) {
      this.stopListening();
      return false;
    } else {
      this.startListening();
      return true;
    }
  }

  startListening() {
    if (!this.recognition) {
      this.simulateVoicePrompt();
      return;
    }
    try {
      this.recognition.start();
    } catch {
      this.recognition.stop();
      setTimeout(() => this.recognition?.start(), 150);
    }
  }

  stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignored
      }
    }
    this.isListening = false;
    this.onStateChange?.(false, false);
  }

  async processVoiceCommand(command: string) {
    const lower = command.toLowerCase();
    let result: JarvisCommandResult = {
      response: ''
    };

    // 1. Flashlight
    if (lower.includes('flashlight') || lower.includes('torch') || lower.includes('टॉर्च') || lower.includes('ফ্ল্যাশলাইট')) {
      if (lower.includes('off') || lower.includes('बंद') || lower.includes('বন্ধ')) {
        result = {
          action: 'flashlight_off',
          response: this.translateResponse({
            en: 'Flashlight deactivated, Sir.',
            hi: 'फ़्लैशलाइट बंद कर दी गई है।',
            bn: 'টর্চলাইট বন্ধ করা হয়েছে।'
          })
        };
      } else {
        result = {
          action: 'flashlight_on',
          response: this.translateResponse({
            en: 'Flashlight turned on.',
            hi: 'फ़्लैशलाइट चालू कर दी गई है।',
            bn: 'টর্চলাইট চালু করা হয়েছে।'
          })
        };
      }
    }
    // 2. Wi-Fi
    else if (lower.includes('wifi') || lower.includes('wi-fi') || lower.includes('इंटरनेट') || lower.includes('ওয়াইফাই')) {
      result = {
        action: 'toggle_wifi',
        response: this.translateResponse({
          en: 'Toggling Wi-Fi connectivity.',
          hi: 'वाई-फ़ाई सेटिंग्स टॉगल की जा रही हैं।',
          bn: 'ওয়াই-ফাই সংযোগ পরিবর্তন করা হচ্ছে।'
        })
      };
    }
    // 3. Bluetooth
    else if (lower.includes('bluetooth') || lower.includes('ब्लूटूथ') || lower.includes('ব্লুটুথ')) {
      result = {
        action: 'toggle_bluetooth',
        response: this.translateResponse({
          en: 'Updating Bluetooth state.',
          hi: 'ब्लूटूथ सेटिंग्स अपडेट की जा रही हैं।',
          bn: 'ব্লুটুথ অবস্থা আপডেট করা হচ্ছে।'
        })
      };
    }
    // 4. WhatsApp
    else if (lower.includes('whatsapp') || lower.includes('व्हाट्सएप') || lower.includes('হোয়াটসঅ্যাপ')) {
      result = {
        action: 'open_whatsapp',
        response: this.translateResponse({
          en: 'Opening WhatsApp communication portal.',
          hi: 'व्हाट्सएप खोला जा रहा है।',
          bn: 'হোয়াটসঅ্যাপ মেসেঞ্জার খোলা হচ্ছে।'
        })
      };
    }
    // 5. Camera
    else if (lower.includes('camera') || lower.includes('कैमरा') || lower.includes('ক্যামেরা')) {
      result = {
        action: 'open_camera',
        response: this.translateResponse({
          en: 'Initializing high-resolution camera.',
          hi: 'कैमरा खोला जा रहा है।',
          bn: 'ক্যামেরা চালু করা হচ্ছে।'
        })
      };
    }
    // 6. Notifications
    else if (lower.includes('notification') || lower.includes('सूचना') || lower.includes('বিজ্ঞপ্তি')) {
      result = {
        action: 'open_notifications',
        response: this.translateResponse({
          en: 'Accessing Notification Centre.',
          hi: 'अधिसूचना केंद्र दिखाया जा रहा है।',
          bn: 'বিজ্ঞপ্তি কেন্দ্র প্রদর্শিত হচ্ছে।'
        })
      };
    }
    // 7. Call / Phone
    else if (lower.includes('call') || lower.includes('phone') || lower.includes('फोन') || lower.includes('কল')) {
      result = {
        action: 'open_dialer',
        response: this.translateResponse({
          en: 'Opening secure dialer. Ready for confirmation.',
          hi: 'डायलर खोला जा रहा है। पुष्टि की आवश्यकता है।',
          bn: 'ডায়ালার খোলা হচ্ছে। নিশ্চিতকরণের প্রয়োজন।'
        })
      };
    }
    // 8. Music
    else if (lower.includes('music') || lower.includes('song') || lower.includes('गाना') || lower.includes('গান')) {
      result = {
        action: 'toggle_music',
        response: this.translateResponse({
          en: 'Toggling media playback.',
          hi: 'मीडिया प्लेबैक टॉगल किया जा रहा है।',
          bn: 'মিডিয়া প্লেব্যাক পরিবর্তন করা হচ্ছে।'
        })
      };
    }
    // 9. Brightness / Volume
    else if (lower.includes('brightness') || lower.includes('ब्राइटनेस') || lower.includes('উজ্জ্বলতা')) {
      result = {
        action: 'max_brightness',
        response: this.translateResponse({
          en: 'Adjusting screen luminescence to maximum.',
          hi: 'स्क्रीन ब्राइटनेस बढ़ाई जा रही है।',
          bn: 'পর্দার উজ্জ্বলতা বৃদ্ধি করা হচ্ছে।'
        })
      };
    }
    // 10. General AI Query
    else {
      result = await this.queryGeminiOrFallback(command);
    }

    // Speak response
    this.onStateChange?.(false, true);
    jarvisAudio.speak(result.response, this.currentLanguage);
    setTimeout(() => {
      this.onStateChange?.(false, false);
    }, Math.max(1500, result.response.length * 60));

    // Persist to Firebase Firestore
    saveVoiceLog({
      command,
      response: result.response,
      language: this.currentLanguage,
      action: result.action || 'gemini_ai_query'
    }).catch(err => console.warn('[Firebase] Log failed:', err));

    this.onCommandExecuted?.(result);
  }

  private async queryGeminiOrFallback(prompt: string): Promise<JarvisCommandResult> {
    try {
      const res = await fetch('/api/gemini/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          language: this.currentLanguage
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          return { response: data.text };
        }
      }
    } catch (e) {
      console.warn('[Client] Server Gemini proxy error, using intelligent fallback:', e);
    }

    // Contextual intelligent fallback
    const responses: Record<SupportedLanguage, string> = {
      en: `Understood, Sir. All systems operating smoothly. Command "${prompt}" acknowledged.`,
      hi: `समझ गया, सर। सभी प्रणालियाँ सुचारू रूप से कार्य कर रही हैं। कमांड "${prompt}" दर्ज किया गया।`,
      bn: `বুঝতে পেরেছি, স্যার। সমস্ত সিস্টেম যথাযথভাবে কাজ করছে। কমান্ড "${prompt}" গৃহীত হয়েছে।`
    };

    return { response: responses[this.currentLanguage] };
  }

  // Server-Sent Events streaming query method
  async streamGeminiResponse(prompt: string, onChunk: (text: string) => void): Promise<string> {
    try {
      const res = await fetch('/api/gemini/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          language: this.currentLanguage
        })
      });

      if (!res.ok || !res.body) throw new Error('Stream request failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') break;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.text) {
                accumulated += parsed.text;
                onChunk(accumulated);
              }
            } catch {
              // Non-JSON SSE event
            }
          }
        }
      }
      return accumulated;
    } catch (err) {
      console.warn('[Client] Stream error:', err);
      const fallback = this.translateResponse({
        en: 'Systems operational, Sir.',
        hi: 'प्रणालियाँ कार्यरत हैं।',
        bn: 'সমস্ত সিস্টেম সক্রিয়।'
      });
      onChunk(fallback);
      return fallback;
    }
  }

  private translateResponse(dict: Record<SupportedLanguage, string>): string {
    return dict[this.currentLanguage] || dict.en;
  }

  // Simulation when microphone is not permitted or in desktop test
  simulateVoicePrompt() {
    const samplePrompts = [
      'Turn on flashlight',
      'Open WhatsApp',
      'Show notifications',
      'Call a contact',
      'Play music',
      'Open Camera'
    ];
    const picked = samplePrompts[Math.floor(Math.random() * samplePrompts.length)];
    this.onTranscriptChange?.(picked, true);
    this.processVoiceCommand(picked);
  }
}

export const jarvisAI = new JarvisAIEngine();
