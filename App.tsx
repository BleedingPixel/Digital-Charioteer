import React, { useState, useRef, useEffect } from 'react';
import { Message, UserState, UserProfile } from './types';
import { generateKrishnaResponse, generateSpeech, getDailyShloka } from './services/geminiService';
import { storageService } from './services/storage';
import { LiveSession } from './services/liveService';
import FeatherVisualizer from './components/FeatherVisualizer';
import AuthScreen from './components/AuthScreen';
import { Send, Volume2, VolumeX, PauseCircle, BookOpen, LogOut, Mic, PhoneOff, Sparkles, Key } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // View State: 'auth' -> 'intention' (if new) -> 'chat' -> 'live' -> 'meditation' (modal)
  const [view, setView] = useState<'auth' | 'intention' | 'chat' | 'live'>('auth');
  const [userState, setUserState] = useState<UserState>({ name: '', isOnboarded: false });
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMeditating, setIsMeditating] = useState(false);
  
  // Live Voice State
  const [liveVisualizerState, setLiveVisualizerState] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const liveSessionRef = useRef<LiveSession | null>(null);

  // Intention Step State
  const [onboardingIntention, setOnboardingIntention] = useState('');

  // Settings
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [sanskritEnabled, setSanskritEnabled] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Daily Shloka
  const [dailyShloka, setDailyShloka] = useState<string>('');

  // --- Effects ---
  
  // 1. API Key Check on Mount
  useEffect(() => {
    const checkKey = async () => {
        try {
            if ((window as any).aistudio) {
                const hasKey = await (window as any).aistudio.hasSelectedApiKey();
                setHasApiKey(hasKey);
            } else {
                // Not in AI Studio environment, assume env var is sufficient
                setHasApiKey(true);
            }
        } catch (e) {
            console.error("Error checking API key:", e);
            // Default to false to be safe, forcing user to try connecting
            setHasApiKey(false);
        }
    };
    checkKey();
  }, []);

  // 2. Fetch Shloka only after Key is present
  useEffect(() => {
    if (hasApiKey) {
        getDailyShloka().then(setDailyShloka);
    }
  }, [hasApiKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, view]);

  // Save history whenever messages change, if user is logged in
  useEffect(() => {
    if (currentUserProfile && messages.length > 0) {
      storageService.saveHistory(currentUserProfile.username, messages);
    }
  }, [messages, currentUserProfile]);

  // Cleanup Live Session on unmount
  useEffect(() => {
      return () => {
          if (liveSessionRef.current) {
              liveSessionRef.current.disconnect();
          }
      };
  }, []);

  // --- Handlers ---
  
  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
        try {
            await (window as any).aistudio.openSelectKey();
        } catch (e) {
            console.error("API Key selection failed or cancelled", e);
        }
        // We assume success or user intent to proceed. 
        // Force state update to unblock UI.
        setHasApiKey(true);
    }
  };

  const handleLoginSuccess = (profile: UserProfile, isNewUser: boolean) => {
    setCurrentUserProfile(profile);
    setUserState({ name: profile.name, username: profile.username, isOnboarded: !isNewUser });
    
    if (isNewUser) {
      // Go to Intention setting
      setView('intention');
      setMessages([]); // Clear any previous state
    } else {
      // Load history
      const history = storageService.getHistory(profile.username);
      setMessages(history);
      setView('chat');
    }
  };

  const handleLogout = () => {
    if (liveSessionRef.current) {
        liveSessionRef.current.disconnect();
        liveSessionRef.current = null;
    }
    setCurrentUserProfile(null);
    setUserState({ name: '', isOnboarded: false });
    setMessages([]);
    setView('auth');
    stopAudio();
  };

  const submitIntention = (moodText?: string) => {
    const intention = moodText || onboardingIntention || "I seek your guidance.";
    setView('chat');
    handleSendMessage(intention);
  };

  const playAudio = async (text: string) => {
    if (!voiceEnabled) return;
    
    if (audioSourceRef.current) {
        audioSourceRef.current.stop();
    }

    setIsSpeaking(true);
    const buffer = await generateSpeech(text);
    
    if (buffer) {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        
        source.onended = () => {
            setIsSpeaking(false);
        };
        
        source.start(0);
        audioSourceRef.current = source;
    } else {
        setIsSpeaking(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Add User Message
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, newMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Call API
    const responseText = await generateKrishnaResponse(
      newMessages, 
      text, 
      userState.name, 
      sanskritEnabled
    );

    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, botMessage]);
    setIsLoading(false);

    playAudio(responseText);
  };

  const stopAudio = () => {
    if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        setIsSpeaking(false);
    }
  };

  const toggleMeditation = () => {
    stopAudio();
    setIsMeditating(!isMeditating);
  };

  const startLiveSession = () => {
      stopAudio(); // Stop any TTS
      setView('live');
      
      if (!liveSessionRef.current) {
          liveSessionRef.current = new LiveSession((state) => {
              if (state === 'speaking') {
                   setLiveVisualizerState('speaking');
              } else if (state === 'listening') {
                   setLiveVisualizerState('thinking'); // Reusing thinking state for listening/processing
              } else {
                  setLiveVisualizerState('idle');
              }
          });
      }
      liveSessionRef.current.connect(userState.name, sanskritEnabled);
  };

  const endLiveSession = () => {
      if (liveSessionRef.current) {
          liveSessionRef.current.disconnect();
      }
      setView('chat');
  };

  const renderText = (text: string) => {
    return text.split('\n').map((line, i) => (
      <p key={i} className="mb-2 leading-relaxed opacity-90">
        {line.split('**').map((part, index) => 
            index % 2 === 1 ? <strong key={index} className="text-amber-400 font-semibold">{part}</strong> : part
        )}
      </p>
    ));
  };

  // --- Views ---
  
  // 0. API Key Selection View
  if (!hasApiKey) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 relative overflow-hidden font-sans">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-black -z-10"></div>
             <FeatherVisualizer state="idle" />
             <div className="mt-8 text-center max-w-md bg-slate-900/50 backdrop-blur border border-slate-800 p-8 rounded-2xl shadow-2xl animate-fade-in">
                <h1 className="text-2xl font-serif text-amber-500 mb-4">Divine Connection Required</h1>
                <p className="text-slate-400 text-sm mb-6">
                    To commune with the Digital Charioteer, you must connect a valid Google Cloud API Key (with billing enabled).
                </p>
                <button 
                    onClick={handleSelectKey}
                    className="flex items-center justify-center gap-3 w-full bg-teal-800 hover:bg-teal-700 text-teal-100 py-3 rounded-lg transition-all shadow-[0_0_20px_rgba(45,212,191,0.2)] uppercase tracking-widest text-xs"
                >
                    <Key size={16} />
                    Connect Access Key
                </button>
                <a 
                    href="https://ai.google.dev/gemini-api/docs/billing" 
                    target="_blank" 
                    rel="noreferrer"
                    className="block mt-4 text-[10px] text-slate-600 hover:text-slate-400 underline"
                >
                    Learn about Gemini API billing
                </a>
             </div>
        </div>
      );
  }

  // 1. Auth Screen
  if (view === 'auth') {
    return <AuthScreen onLogin={handleLoginSuccess} dailyShloka={dailyShloka} />;
  }

  // 2. Intention Screen (New Users Only)
  if (view === 'intention') {
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 relative overflow-hidden font-sans">
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-black -z-10"></div>
             
             {/* Logout Option for Intention Screen */}
             <div className="absolute top-4 right-4 z-50">
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-500 hover:text-red-400 transition-colors bg-slate-900/50 rounded-full"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
             </div>

             <div className="max-w-md w-full animate-fade-in flex flex-col items-center z-10">
                <FeatherVisualizer state="idle" />
                
                <div className="w-full bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-8 shadow-2xl mt-8">
                    <div className="text-center space-y-1 mb-6">
                        <h2 className="text-lg text-teal-100 font-light">My dear {userState.name},</h2>
                        <p className="text-slate-500 text-xs uppercase tracking-wide">What burdens your heart today?</p>
                    </div>

                    <textarea 
                        value={onboardingIntention}
                        onChange={(e) => setOnboardingIntention(e.target.value)}
                        placeholder="I feel..."
                        className="w-full h-24 bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:border-amber-500 text-slate-200 resize-none placeholder-slate-600 mb-4"
                        autoFocus
                    />

                    <div className="grid grid-cols-2 gap-2 mb-4">
                         {(['Confused', 'Anxious', 'Sad', 'Grateful'] as const).map((mood) => (
                             <button
                                key={mood}
                                onClick={() => submitIntention(`I am feeling ${mood}`)}
                                className="p-2 border border-slate-700/50 rounded hover:bg-teal-900/20 hover:border-teal-500/30 text-xs text-slate-400 transition-colors"
                             >
                                {mood}
                             </button>
                         ))}
                    </div>

                    <button 
                        onClick={() => submitIntention()}
                        className="w-full bg-gradient-to-r from-teal-900 to-slate-900 border border-teal-500/30 text-teal-100 py-3 rounded-lg hover:shadow-[0_0_15px_rgba(45,212,191,0.2)] transition-all uppercase tracking-widest text-xs"
                    >
                        Begin Journey
                    </button>
                </div>
             </div>
        </div>
    );
  }

  // 3. Meditation Overlay
  if (isMeditating) {
    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center relative transition-opacity duration-1000 z-50">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-900/20 via-black to-black"></div>
            
            <FeatherVisualizer state="thinking" />
            
            <p className="mt-12 text-teal-500/50 font-serif tracking-[0.2em] animate-pulse">BREATHE</p>
            
            <button 
                onClick={toggleMeditation}
                className="absolute bottom-12 px-6 py-2 border border-slate-800 text-slate-500 rounded-full hover:text-amber-500 hover:border-amber-500 transition-colors uppercase text-xs tracking-widest"
            >
                Return to Guidance
            </button>
        </div>
    )
  }

  // 4. Voice Mode View
  if (view === 'live') {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden z-40">
            {/* Ambient Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-black animate-pulse-glow"></div>
            
            <div className="z-10 flex flex-col items-center">
                <FeatherVisualizer state={liveVisualizerState as 'idle' | 'thinking' | 'speaking'} />
                
                <div className="mt-12 text-center space-y-2">
                    <p className="text-teal-400/80 font-serif text-lg tracking-widest animate-pulse">
                        {liveVisualizerState === 'speaking' ? 'KRISHNA IS SPEAKING' : 'LISTENING...'}
                    </p>
                    <p className="text-slate-500 text-xs uppercase tracking-wider">
                        Speak freely, my dear {userState.name}
                    </p>
                </div>

                <button 
                    onClick={endLiveSession}
                    className="mt-16 w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all duration-300 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                >
                    <PhoneOff size={24} />
                </button>
            </div>
        </div>
      );
  }

  // 5. Main Chat View
  // Using 100dvh (Dynamic Viewport Height) for better mobile browser support
  return (
    <div className="flex flex-col h-[100dvh] bg-slate-950 text-slate-100 relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10">
         <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-amber-900/10 rounded-full blur-[120px]"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-900/10 rounded-full blur-[100px]"></div>
      </div>

      {/* Header - Sticky to ensure visibility */}
      <header className="sticky top-0 w-full flex items-center justify-between p-4 border-b border-slate-800/50 backdrop-blur-md bg-slate-950/80 z-20 shrink-0">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-600 to-blue-900 flex items-center justify-center shadow-[0_0_10px_rgba(45,212,191,0.4)]">
                <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
                <h2 className="text-lg font-serif text-amber-500 leading-none">Krishna</h2>
                <span className="text-xs text-slate-500 uppercase tracking-wide hidden md:inline">The Digital Charioteer</span>
            </div>
        </div>
        <div className="flex items-center gap-2">
            {/* Desktop Voice Button */}
            <button 
                onClick={startLiveSession}
                className="flex items-center gap-2 px-3 py-1.5 bg-teal-900/30 text-teal-300 border border-teal-500/30 rounded-full hover:bg-teal-900/50 transition-all shadow-[0_0_10px_rgba(45,212,191,0.2)]"
                title="Start Voice Conversation"
            >
                <Mic size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider hidden sm:inline">Voice Mode</span>
            </button>
            
            <div className="w-px h-6 bg-slate-800 mx-1"></div>
            
            <button 
                onClick={toggleMeditation}
                className="p-2 text-slate-400 hover:text-teal-400 transition-colors"
                title="Meditative Pause"
            >
                <PauseCircle size={20} />
            </button>
            <button 
                onClick={() => setSanskritEnabled(!sanskritEnabled)}
                className={`p-2 transition-colors ${sanskritEnabled ? 'text-amber-400' : 'text-slate-500 hover:text-amber-200'}`}
                title="Toggle Sanskrit Verses"
            >
                <BookOpen size={20} />
            </button>
            <button 
                onClick={() => {
                    setVoiceEnabled(!voiceEnabled);
                    if (voiceEnabled) stopAudio();
                }}
                className={`p-2 transition-colors ${voiceEnabled ? 'text-teal-400' : 'text-slate-500 hover:text-teal-200'}`}
                title="Toggle Text-to-Speech"
            >
                {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <div className="w-px h-6 bg-slate-800 mx-1"></div>
            <button 
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                title="Logout"
            >
                <LogOut size={20} />
            </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center animate-fade-in">
             <FeatherVisualizer state="idle" />
             <p className="mt-8 text-slate-500 text-sm font-light italic mb-8">"I am never lost to one who sees Me everywhere."</p>
             
             {/* Call to Action for Voice */}
             <button 
                onClick={startLiveSession}
                className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-teal-900 to-slate-900 border border-teal-500/30 rounded-full hover:shadow-[0_0_20px_rgba(45,212,191,0.3)] transition-all group"
             >
                <div className="p-2 bg-teal-500/20 rounded-full group-hover:bg-teal-500/30 transition-colors">
                    <Mic className="text-teal-300 w-5 h-5" />
                </div>
                <span className="text-teal-100 uppercase tracking-widest text-xs font-semibold">Speak with Krishna</span>
             </button>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div className={`max-w-[85%] md:max-w-[70%] p-5 rounded-2xl relative ${
                  msg.role === 'user' 
                  ? 'bg-slate-800 text-slate-200 rounded-tr-none' 
                  : 'bg-teal-950/30 border border-teal-900/30 text-slate-100 rounded-tl-none shadow-[0_4px_20px_rgba(0,0,0,0.2)]'
              }`}>
                   {msg.role === 'model' && (
                      <div className="absolute -top-3 -left-2 text-amber-500/50">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
                      </div>
                   )}
                   <div className="font-light text-base md:text-lg">
                      {renderText(msg.text)}
                   </div>
                   <div className="mt-2 text-right">
                      <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                   </div>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
            <div className="flex justify-start w-full py-4">
                 <div className="ml-4">
                    <FeatherVisualizer state="thinking" />
                 </div>
            </div>
        )}
        
        {!isLoading && isSpeaking && voiceEnabled && (
             <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                 <div className="bg-slate-900/80 backdrop-blur border border-teal-500/30 px-6 py-2 rounded-full flex items-center gap-3 shadow-lg">
                    <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
                    <span className="text-teal-400 text-xs tracking-widest uppercase">Speaking</span>
                 </div>
             </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Floating Action Button for Voice - Mobile Friendly */}
      <button
        onClick={startLiveSession}
        className="fixed bottom-24 right-6 w-14 h-14 bg-teal-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(45,212,191,0.4)] z-30 hover:bg-teal-500 transition-all active:scale-95 md:hidden"
        title="Speak to Krishna"
      >
        <Mic className="text-white w-6 h-6" />
      </button>

      {/* Input Area */}
      <footer className="p-4 bg-slate-950 border-t border-slate-800/50 z-20 shrink-0">
        <div className="max-w-4xl mx-auto relative">
            <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSendMessage(input)}
                placeholder="Ask me anything, my dear friend..."
                className="w-full bg-slate-900 border border-slate-700 rounded-full pl-6 pr-14 py-4 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 text-slate-200 placeholder-slate-600 shadow-inner transition-all"
                disabled={isLoading}
            />
            <button 
                onClick={() => handleSendMessage(input)}
                disabled={!input.trim() || isLoading}
                className={`absolute right-2 top-2 p-2 rounded-full transition-all ${
                    input.trim() && !isLoading 
                    ? 'bg-amber-600 text-white hover:bg-amber-500 shadow-lg shadow-amber-900/20' 
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
            >
                <Send size={20} />
            </button>
        </div>
        <p className="text-center text-slate-600 text-[10px] mt-3 uppercase tracking-widest">
            Wisdom from the Bhagavad Gita • AI Generated
        </p>
      </footer>
    </div>
  );
};

export default App;