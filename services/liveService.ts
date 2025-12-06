import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { getSystemInstruction } from './geminiService';

// Audio Helper Functions
function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: bytesToBase64(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export class LiveSession {
  private inputAudioContext: AudioContext;
  private outputAudioContext: AudioContext;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private outputNode: GainNode;
  private nextStartTime = 0;
  private sessionPromise: Promise<any> | null = null;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private isConnected = false;

  public onVisualizerUpdate: (state: 'listening' | 'speaking' | 'idle') => void;

  constructor(onVisualizerUpdate: (state: 'listening' | 'speaking' | 'idle') => void) {
    this.onVisualizerUpdate = onVisualizerUpdate;
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    this.outputNode = this.outputAudioContext.createGain();
    this.outputNode.connect(this.outputAudioContext.destination);
  }

  async connect(userName: string, sanskritEnabled: boolean) {
    if (this.isConnected) return;
    
    try {
        console.log("Starting Live Session...");
        // Re-initialize AI client here to ensure we get the latest API Key
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Request Mic Permission
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Initialize Session
        this.sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: () => {
              console.log("Live Session Connected");
              this.isConnected = true;
              this.onVisualizerUpdate('listening');
              this.setupAudioInput(stream);
            },
            onmessage: async (message: LiveServerMessage) => {
              // Handle interruptions
              const interrupted = message.serverContent?.interrupted;
              if (interrupted) {
                this.stopAudioPlayback();
                this.nextStartTime = 0;
                return;
              }

              // Handle Audio Output
              const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (base64Audio) {
                this.onVisualizerUpdate('speaking');
                this.queueAudioOutput(base64Audio);
              }
              
              // Detect turn completion (Model finished generation)
              if (message.serverContent?.turnComplete) {
                 setTimeout(() => {
                     if (this.activeSources.size === 0) {
                         this.onVisualizerUpdate('listening');
                     }
                 }, 500);
              }
            },
            onclose: () => {
              console.log("Live Session Closed");
              this.isConnected = false;
              this.onVisualizerUpdate('idle');
            },
            onerror: (err) => {
              console.error("Live API Error:", err);
              this.onVisualizerUpdate('idle');
            }
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
            },
            systemInstruction: getSystemInstruction(userName, sanskritEnabled),
          },
        });
    } catch (error) {
        console.error("Failed to connect live session:", error);
        this.onVisualizerUpdate('idle');
    }
  }

  private setupAudioInput(stream: MediaStream) {
    if (this.inputAudioContext.state === 'suspended') {
      this.inputAudioContext.resume();
    }
    
    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    this.scriptProcessor.onaudioprocess = (e) => {
      if (!this.isConnected) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createBlob(inputData);
      
      if (this.sessionPromise) {
        this.sessionPromise.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
        });
      }
    };

    this.inputSource.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.inputAudioContext.destination);
  }

  private async queueAudioOutput(base64Audio: string) {
    if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume();
    }

    const audioBytes = base64ToBytes(base64Audio);
    
    // Decode PCM (16-bit little endian, 24kHz)
    const dataInt16 = new Int16Array(audioBytes.buffer);
    const buffer = this.outputAudioContext.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }

    const source = this.outputAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputNode);
    
    source.onended = () => {
        this.activeSources.delete(source);
        if (this.activeSources.size === 0) {
            this.onVisualizerUpdate('listening');
        }
    };

    // Schedule playback
    this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
    
    this.activeSources.add(source);
  }

  private stopAudioPlayback() {
    this.activeSources.forEach(source => source.stop());
    this.activeSources.clear();
  }

  async disconnect() {
    this.isConnected = false;
    this.stopAudioPlayback();
    
    if (this.scriptProcessor && this.inputSource) {
        this.inputSource.disconnect();
        this.scriptProcessor.disconnect();
    }
    
    // Close Media Stream Tracks
    if (this.inputSource) {
        (this.inputSource.mediaStream as MediaStream).getTracks().forEach(track => track.stop());
    }

    // Ideally: (await this.sessionPromise).close();
    if (this.sessionPromise) {
        this.sessionPromise.then(session => {
            // session.close() if available in type definition, otherwise just drop
        });
    }
    
    this.onVisualizerUpdate('idle');
  }
}