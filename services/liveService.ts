import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { getSystemInstruction } from './geminiService';

// --- Audio Helper Functions ---

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

/**
 * Resamples input audio from any sample rate to 16kHz and converts to Int16 PCM.
 * @param input Float32Array of audio data from the browser
 * @param inputSampleRate The native sample rate of the microphone (e.g., 44100, 48000)
 * @returns Int16Array at 16000Hz
 */
function downsampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
    const targetSampleRate = 16000;
    
    if (inputSampleRate === targetSampleRate) {
        // No resampling needed, just convert float to int16
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
             let s = Math.max(-1, Math.min(1, input[i]));
             output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return output;
    }

    const ratio = inputSampleRate / targetSampleRate;
    const newLength = Math.round(input.length / ratio);
    const output = new Int16Array(newLength);

    for (let i = 0; i < newLength; i++) {
        const offset = i * ratio;
        const index = Math.floor(offset);
        const decimal = offset - index;
        
        // Linear interpolation for smoother audio
        const v1 = input[index] || 0;
        const v2 = input[index + 1] || v1; // Fallback to v1 if at end
        let val = (v1 * (1 - decimal) + v2 * decimal);
        
        // Clamp and Scale to Int16
        val = Math.max(-1, Math.min(1, val));
        output[i] = val < 0 ? val * 0x8000 : val * 0x7FFF;
    }
    return output;
}

function createAudioData(int16Data: Int16Array): { data: string; mimeType: string } {
    return {
        data: bytesToBase64(new Uint8Array(int16Data.buffer)),
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
  
  // VAD State
  private isModelSpeaking = false;
  private silenceTimer: any = null;

  public onVisualizerUpdate: (state: 'user_active' | 'model_speaking' | 'idle') => void;
  public onError: (error: string) => void;

  constructor(
      onVisualizerUpdate: (state: 'user_active' | 'model_speaking' | 'idle') => void,
      onError: (error: string) => void
  ) {
    this.onVisualizerUpdate = onVisualizerUpdate;
    this.onError = onError;
    
    // Use browser default sample rate for input to avoid hardware issues
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Output at 24kHz (common for Gemini TTS models)
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    this.outputNode = this.outputAudioContext.createGain();
    this.outputNode.connect(this.outputAudioContext.destination);
  }

  async connect(userName: string, sanskritEnabled: boolean) {
    if (this.isConnected) return;
    
    if (!process.env.API_KEY) {
        this.onError("API Key is missing. Please ensure billing is enabled.");
        return;
    }

    try {
        console.log(`Starting Live Session. Input Rate: ${this.inputAudioContext.sampleRate}Hz`);
        
        // Ensure AudioContexts are running (important for some browsers)
        await this.resumeContexts();

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Request Mic Permission - Let browser decide settings
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                autoGainControl: true,
                noiseSuppression: true
            } 
        });
        
        // Initialize Session
        this.sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: () => {
              console.log("Live Session Connected");
              this.isConnected = true;
              this.onVisualizerUpdate('idle');
              this.setupAudioInput(stream);
            },
            onmessage: async (message: LiveServerMessage) => {
              // Handle interruptions
              const interrupted = message.serverContent?.interrupted;
              if (interrupted) {
                console.log("Interrupted by user");
                this.stopAudioPlayback();
                this.isModelSpeaking = false;
                this.nextStartTime = 0;
                return;
              }

              // Handle Audio Output
              const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (base64Audio) {
                if (!this.isModelSpeaking) {
                     this.isModelSpeaking = true;
                     this.onVisualizerUpdate('model_speaking');
                }
                this.queueAudioOutput(base64Audio);
              }
              
              const turnComplete = message.serverContent?.turnComplete;
              if (turnComplete) {
                  // The model is done generating for this turn
                  // We rely on the audio queue to finish playing to set state back to idle
              }
            },
            onclose: () => {
              console.log("Live Session Closed");
              this.isConnected = false;
              this.onVisualizerUpdate('idle');
            },
            onerror: (err) => {
              console.error("Live API Error:", err);
              this.isConnected = false;
              this.onVisualizerUpdate('idle');
              const msg = err instanceof Error ? err.message : String(err);
              this.onError(`Live Connection Error: ${msg}`);
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
        this.onError("Failed to access microphone or connect. Please check permissions.");
    }
  }

  private async resumeContexts() {
      if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();
      if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();
  }

  private setupAudioInput(stream: MediaStream) {
    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    
    // ScriptProcessorNode (deprecated but effective for raw access)
    // 2048 buffer size = ~46ms latency at 44.1k, ~42ms at 48k. Good balance.
    this.scriptProcessor = this.inputAudioContext.createScriptProcessor(2048, 1, 1);
    
    this.scriptProcessor.onaudioprocess = (e) => {
      if (!this.isConnected) return;
      
      const inputData = e.inputBuffer.getChannelData(0);

      // --- Voice Activity Detection (VAD) ---
      if (!this.isModelSpeaking) {
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          const threshold = 0.005; // Lower threshold to catch soft speech

          // Debug log (uncomment if needed)
          // console.log(`RMS: ${rms.toFixed(4)}`);

          if (rms > threshold) {
              if (this.silenceTimer) {
                  clearTimeout(this.silenceTimer);
                  this.silenceTimer = null;
              }
              this.onVisualizerUpdate('user_active');
          } else {
              if (!this.silenceTimer) {
                  this.silenceTimer = setTimeout(() => {
                      this.onVisualizerUpdate('idle');
                      this.silenceTimer = null;
                  }, 500); // 500ms silence before returning to idle
              }
          }
      }

      // --- Resample & Send Data ---
      // We must resample to 16kHz for the API
      const pcm16k = downsampleTo16k(inputData, this.inputAudioContext.sampleRate);
      const blobData = createAudioData(pcm16k);

      if (this.sessionPromise) {
        this.sessionPromise.then((session) => {
            try {
                session.sendRealtimeInput({ media: blobData });
            } catch (e) {
                console.error("Error sending input:", e);
            }
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
            this.isModelSpeaking = false;
            // Short delay to see if more audio packets arrive
            setTimeout(() => {
                if (!this.isModelSpeaking && this.isConnected) {
                    this.onVisualizerUpdate('idle');
                }
            }, 300);
        }
    };

    const currentTime = this.outputAudioContext.currentTime;
    // Ensure we schedule in the future
    if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
    }
    
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
    
    this.activeSources.add(source);
  }

  private stopAudioPlayback() {
    this.activeSources.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    this.activeSources.clear();
  }

  async disconnect() {
    this.isConnected = false;
    this.stopAudioPlayback();
    this.isModelSpeaking = false;
    
    // Clean up nodes
    if (this.inputSource) {
        try {
            this.inputSource.disconnect();
            (this.inputSource.mediaStream as MediaStream).getTracks().forEach(track => track.stop());
        } catch (e) { console.error("Error closing input source:", e); }
        this.inputSource = null;
    }

    if (this.scriptProcessor) {
        try { this.scriptProcessor.disconnect(); } catch (e) {}
        this.scriptProcessor = null;
    }

    // Close contexts to release hardware
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
        try { await this.inputAudioContext.close(); } catch(e) {}
    }
    
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
         try { await this.outputAudioContext.close(); } catch(e) {}
    }

    this.sessionPromise = null;
    this.onVisualizerUpdate('idle');
  }
}
