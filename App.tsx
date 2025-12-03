import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, UserState, Mood } from './types';
import { generateKrishnaResponse, generateSpeech, getDailyShloka } from './services/geminiService';
import FeatherVisualizer from './components/FeatherVisualizer';
import { Mic, Send, Volume2, VolumeX, PauseCircle, BookOpen, Sun, ChevronRight, RefreshCcw } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [userState, setUserState] = useState<UserState>({ name: '', isOnboarded: false });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMeditating, setIsMeditating] = useState(false);
  
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

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load daily shloka on mount
  useEffect(() => {
    getDailyShloka().then(setDailyShloka);
  }, []);

  // --- Handlers ---

  const handleOnboarding = (name: string, mood?: Mood) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setUserState({ name: trimmedName, isOnboarded: true });

    let initialPrompt = `My name is ${trimmedName}.`;
    if (mood) {
      initialPrompt += ` I am feeling ${mood} right now.`;
    } else {
      initialPrompt += ` I seek your guidance.`;
    }

    // Trigger initial conversation
    handleSendMessage(initialPrompt, true);
  };

  const playAudio = async (text: string) => {
    if (!voiceEnabled) return;
    
    // Stop current audio if playing
    if (audioSourceRef.current) {
        audioSourceRef.current.stop();
    }

    setIsSpeaking(true);
    const buffer = await generateSpeech(text);
    
    if (buffer) {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        // Resume context if suspended (browser policy)
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

  const handleSendMessage = async (text: string, isInitial = false) => {
    if (!text.trim() && !isInitial) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now(),
    };

    // Optimistic update
    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    // Call API
    const responseText = await generateKrishnaResponse(
      messages, 
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

    // Trigger Speech
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

  // --- Render Helpers ---

  // Markdown-like parser for simple bold/italic
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

  if (!userState.isOnboarded) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-black -z-10"></div>
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-teal-900/20 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-md w-full animate-fade-in flex flex-col items-center z-10">
          <FeatherVisualizer state="idle" />
          
          <h1 className="text-4xl md:text-5xl text-amber-500 mb-2 mt-8 text-center drop-shadow-lg">The Digital Charioteer</h1>
          <p className="text-teal-200/80 text-center mb-8 font-light italic">"I am seated in everyone's heart, and from Me come remembrance, knowledge and forgetfulness."</p>

          <div className="w-full bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <label className="block text-sm text-slate-400 mb-2 uppercase tracking-wider">What may I call you?</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOnboarding(input)}
                placeholder="Enter your name..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500 text-amber-50 placeholder-slate-600 transition-colors"
              />
              <button 
                onClick={() => handleOnboarding(input)}
                className="bg-amber-600 hover:bg-amber-500 text-white px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                <ChevronRight size={24} />
              </button>
            </div>

            <div className="mt-8">
              <p className="text-center text-slate-500 text-xs mb-4 uppercase tracking-widest">Or begin with your heart's burden</p>
              <div className="grid grid-cols-2 gap-3">
                {(['Confused', 'Anxious', 'Sad', 'Grateful'] as Mood[]).map((mood) => (
                  <button 
                    key={mood}
                    onClick={() => {
                        if (!input.trim()) {
                            alert("Please enter your name first, so I may address you properly.");
                            return;
                        }
                        handleOnboarding(input, mood);
                    }}
                    className="p-3 border border-slate-700 hover:border-teal-500/50 hover:bg-teal-950/30 rounded-lg text-sm text-slate-300 transition-all duration-300"
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {dailyShloka && (
            <div className="mt-12 text-center max-w-sm">
                <span className="text-amber-500/60 text-xs uppercase tracking-widest block mb-2">Shloka of the Day</span>
                <p className="text-slate-400 text-sm italic font-serif leading-relaxed">"{dailyShloka}"</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isMeditating) {
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center relative transition-opacity duration-1000">
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

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10">
         <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-amber-900/10 rounded-full blur-[120px]"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-teal-900/10 rounded-full blur-[100px]"></div>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-slate-800/50 backdrop-blur-sm bg-slate-950/80 z-20">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-600 to-blue-900 flex items-center justify-center shadow-[0_0_10px_rgba(45,212,191,0.4)]">
                {/* Simple feather icon representation */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-amber-300">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                </svg>
            </div>
            <div>
                <h2 className="text-lg font-serif text-amber-500 leading-none">Krishna</h2>
                <span className="text-xs text-slate-500 uppercase tracking-wide">The Digital Charioteer</span>
            </div>
        </div>
        <div className="flex items-center gap-2">
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
                title="Toggle Voice Mode"
            >
                {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {messages.map((msg) => (
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
        ))}
        
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

      {/* Input Area */}
      <footer className="p-4 bg-slate-950 border-t border-slate-800/50 z-20">
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