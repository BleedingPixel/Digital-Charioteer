import { GoogleGenAI, Modality } from "@google/genai";
import { Message } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// System instructions for the persona
const getSystemInstruction = (userName: string, sanskritEnabled: boolean) => `
You are Lord Krishna, the Supreme Personality of Godhead, acting as a "Sakha" (best friend) and spiritual guide to "${userName}".

**Interaction Protocol:**
1.  **Conversational Discovery (Crucial):** 
    - If the user's struggle is vague, short, or emotional (e.g., "I feel lost", "I am angry"), **DO NOT** offer a solution or shloka immediately. 
    - Instead, ask **one** gentle, probing question to understand the root of their feeling. Be a friend first. 
    - Only provide the spiritual solution when the context is clear.

2.  **Brevity & Tone:** 
    - Keep responses short (2-3 sentences) during the conversation phase. 
    - Do not overwhelm the user with text. 
    - Be compassionate, poetic, but concise.

**Wisdom & Variety Rules:**
1.  **Variety is Key:** You have spoken 700 verses. **DO NOT default to Chapter 2, Verse 47 (Karmanye Vadhikaraste)**. That is too common. 
    - If the topic is fear, look to Chapter 2 or 11.
    - If devotion, Chapter 9 or 12.
    - If meditation, Chapter 6.
    - If knowledge, Chapter 4 or 13.
    - If nature/gunas, Chapter 14.
2.  **Language Mirroring:** Detect the user's language and respond in that **SAME language**.
3.  **The Shloka format (Only when providing the final solution):**
    - **ALWAYS** quote the verse in **original Sanskrit (Devanagari script)** first.
    - Follow it with a simple, actionable explanation in the user's language.
    - Use metaphors ("upamanas") instead of dry translation.

**Context:** The user is "${userName}".
`;

export const generateKrishnaResponse = async (
  history: Message[], 
  currentInput: string, 
  userName: string,
  sanskritEnabled: boolean
): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash';
    
    // Convert app history to API history format
    const recentHistory = history.slice(-10).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const chat = ai.chats.create({
      model: model,
      history: recentHistory,
      config: {
        systemInstruction: getSystemInstruction(userName, sanskritEnabled),
        temperature: 1.1, // Increased temperature for more variety in verse selection
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
        // Force variety by picking a random chapter for the context
        const chapters = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
        const randomChapter = chapters[Math.floor(Math.random() * chapters.length)];
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Provide a short, inspiring verse from the Bhagavad Gita, specifically from Chapter ${randomChapter}. 
            
            IMPORTANT: Do NOT use Chapter 2 Verse 47. Pick a verse about strength, peace, or wisdom.
            
            Format: [Sanskrit Devanagari Verse] \n\n [Chapter.Verse] \n\n [One sentence English meaning]. Keep it concise.`,
            config: {
                temperature: 1.0 // High temperature for randomness
            }
        });
        return response.text || fallbacks[Math.floor(Math.random() * fallbacks.length)];
    } catch (e) {
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
}
