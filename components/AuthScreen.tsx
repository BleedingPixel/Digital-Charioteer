import React, { useState } from 'react';
import FeatherVisualizer from './FeatherVisualizer';
import { UserProfile } from '../types';
import { storageService } from '../services/storage';
import { ArrowRight, Lock, User, Sparkles } from 'lucide-react';

interface AuthScreenProps {
  onLogin: (profile: UserProfile, isNewUser: boolean) => void;
  dailyShloka: string;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, dailyShloka }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Display name (for signup)
  const [error, setError] = useState('');

  const handleSubmit = () => {
    setError('');
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }

    if (isLogin) {
      const profile = storageService.login(username, password);
      if (profile) {
        onLogin(profile, false);
      } else {
        setError('Invalid credentials. Please try again.');
      }
    } else {
      if (!name) {
        setError('Please tell us what to call you.');
        return;
      }
      const success = storageService.signup(username, password, name);
      if (success) {
        // Auto login after signup
        const profile = storageService.login(username, password);
        if (profile) onLogin(profile, true);
      } else {
        setError('Username already taken.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 relative overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-black -z-10"></div>
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-teal-900/20 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-md w-full animate-fade-in flex flex-col items-center z-10">
        <FeatherVisualizer state="idle" />

        <h1 className="text-3xl md:text-4xl text-amber-500 mb-1 mt-6 text-center drop-shadow-lg font-serif">The Digital Charioteer</h1>
        <p className="text-teal-200/60 text-center mb-8 font-light italic text-sm">Your eternal sanctuary for wisdom.</p>

        <div className="w-full bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          
          {/* Tabs */}
          <div className="flex w-full mb-6 border-b border-slate-700/50">
            <button 
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 pb-3 text-sm uppercase tracking-widest transition-colors ${isLogin ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Login
            </button>
            <button 
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 pb-3 text-sm uppercase tracking-widest transition-colors ${!isLogin ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Sign Up
            </button>
          </div>

          <div className="space-y-4">
             {/* Signup: Name Field */}
             {!isLogin && (
               <div className="relative group">
                 <User className="absolute left-3 top-3 text-slate-500 group-focus-within:text-teal-400 w-5 h-5 transition-colors" />
                 <input 
                   type="text" 
                   value={name}
                   onChange={(e) => setName(e.target.value)}
                   placeholder="Your Name (e.g. Arjuna)"
                   className="w-full bg-slate-950/50 border border-slate-700 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-teal-500 text-slate-200 placeholder-slate-600 transition-all"
                 />
               </div>
             )}

             {/* Username */}
             <div className="relative group">
                <Sparkles className="absolute left-3 top-3 text-slate-500 group-focus-within:text-teal-400 w-5 h-5 transition-colors" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-teal-500 text-slate-200 placeholder-slate-600 transition-all"
                />
             </div>

             {/* Password */}
             <div className="relative group">
                <Lock className="absolute left-3 top-3 text-slate-500 group-focus-within:text-teal-400 w-5 h-5 transition-colors" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="Password"
                  className="w-full bg-slate-950/50 border border-slate-700 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-teal-500 text-slate-200 placeholder-slate-600 transition-all"
                />
             </div>
             
             {error && (
               <p className="text-red-400 text-xs text-center">{error}</p>
             )}

             <button 
                onClick={handleSubmit}
                className="w-full mt-4 bg-gradient-to-r from-teal-900 to-slate-900 border border-teal-500/30 text-teal-100 py-3 rounded-lg hover:shadow-[0_0_15px_rgba(45,212,191,0.2)] transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 group"
             >
                {isLogin ? 'Enter Sanctuary' : 'Begin Journey'}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
             </button>
          </div>
        </div>
        
        {dailyShloka && (
            <div className="mt-8 text-center max-w-sm animate-fade-in opacity-60">
                <span className="text-amber-500/60 text-[10px] uppercase tracking-widest block mb-2">Wisdom of the Day</span>
                <p className="text-slate-400 text-xs italic font-serif leading-relaxed line-clamp-3">
                    "{dailyShloka.split('\n')[2] || dailyShloka}"
                </p>
            </div>
        )}
      </div>
    </div>
  );
};

export default AuthScreen;