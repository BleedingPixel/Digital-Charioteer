import { GoogleGenAI, Modality } from "@google/genai";
import { Message } from '../types';

// Removed global 'ai' instance to prevent stale API keys.
// The client is now instantiated inside each function to ensure it uses the latest process.env.API_KEY.

// System instructions for the persona
export const getSystemInstruction = (userName: string, sanskritEnabled: boolean) => `
You are Lord Krishna, acting as a "Sakha" (friend) to "${userName}".

**Protocol:**
1.  **Karma Yoga (Action Rule):**
    - If the problem is MATERIAL (job, money, exams):
      - **FORBIDDEN:** Passive prayer or "trust the process".
      - **REQUIRED:** Emphasize ACTION (Karma). Work is worship.
      - Metaphor: *"I drive the chariot, YOU fire the arrows."*

2.  **Divine Wit:**
    - If user is cynical/oversmart, be playful and teasing, not robotic.
    - Example: "Prove you are God" -> "I am proving I have the patience to talk to you."

3.  **Format:**
    - Conversational (2-3 sentences).
    - Mirror user's language.
    - **Shloka:** Only if providing a solution. ALWAYS Sanskrit (Devanagari) first, then simple meaning.
    - **Variety:** Avoid Ch 2.47. Use Ch 2.56, 3.8, 6.5, 11.33 etc.

**Context:** User is "${userName}".
`;

export const generateKrishnaResponse = async (
  history: Message[], 
  currentInput: string, 
  userName: string,
  sanskritEnabled: boolean
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-2.5-flash';
    
    // Convert app history to API history format
    // COST OPTIMIZATION: Reduced context from 10 to 6 messages to save input tokens
    const recentHistory = history.slice(-6).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const chat = ai.chats.create({
      model: model,
      history: recentHistory,
      config: {
        systemInstruction: getSystemInstruction(userName, sanskritEnabled),
        temperature: 1.1, // High temperature for personality/variety
      },
    });

    const result = await chat.sendMessage({ message: currentInput });
    return result.text || "My dear friend, I am listening. Please speak your heart again.";
  } catch (error) {
    console.error("Gemini Text Error:", error);
    return "My dear soul, a cloud has obscured my vision. Please share your heart with me again.";
  }
};

export const generateSpeech = async (text: string): Promise<AudioBuffer | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { 
              voiceName: 'Fenrir' 
            },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) return null;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const binaryString = atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
    return audioBuffer;

  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
};

export const getDailyShloka = async (): Promise<string> => {
    // A fallback library of diverse verses to prevent repetition if API fails or defaults
    const fallbacks = [
        "यदा यदा हि धर्मस्य ग्लानिर्भवति भारत।\nChapter 4.7\nWhenever there is a decline in righteousness, I manifest Myself.",
        "पत्रं पुष्पं फलं तोयं यो मे भक्त्या प्रयच्छति।\nChapter 9.26\nIf one offers Me with love and devotion a leaf, a flower, a fruit or water, I will accept it.",
        "क्रोधाद्भवति सम्मोह: सम्मोहात्स्मृतिविभ्रम:।\nChapter 2.63\nFrom anger comes delusion, and from delusion, bewilderment of memory.",
        "योगस्थ: कुरु कर्माणि सङ्गं त्यक्त्वा धनञ्जय।\nChapter 2.48\nPerform your duty equipoised, O Arjuna, abandoning all attachment to success or failure.",
        "न हि ज्ञानेन सदृशं पवित्रमिह विद्यते।\nChapter 4.38\nIn this world, there is nothing so sublime and pure as transcendental knowledge.",
        "अनन्याश्चिन्तयन्तो मां ये जनाः पर्युपासते।\nChapter 9.22\nBut those who always worship Me with exclusive devotion, meditating on My transcendental form—to them I carry what they lack, and I preserve what they have."
    ];

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        // Force variety by picking a random chapter for the context
        const chapters = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
        const randomChapter = chapters[Math.floor(Math.random() * chapters.length)];
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Provide a short, inspiring verse from the Bhagavad Gita, specifically from Chapter ${randomChapter}. 
            
            IMPORTANT: Do NOT use Chapter 2 Verse 47. Pick a verse about strength, peace, or wisdom.
            
            Format: [Sanskrit Devanagari Verse] \n\n [Chapter.Verse] \n\n [One sentence English meaning]. Keep it concise.`,
            config: {
                temperature: 0.7 // Lowered to ensure strict formatting
            }
        });
        
        const text = response.text || '';
        
        // VALIDATION:
        // 1. Must be reasonably long (>20 chars)
        // 2. Must contain Devanagari characters (Unicode range \u0900-\u097F)
        const hasDevanagari = /[\u0900-\u097F]/.test(text);

        if (text.length < 20 || !hasDevanagari) {
            console.warn("Generated shloka was malformed or missing Sanskrit. Using fallback.");
            return fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }

        return text;
    } catch (e) {
        console.error("Error fetching shloka:", e);
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
}