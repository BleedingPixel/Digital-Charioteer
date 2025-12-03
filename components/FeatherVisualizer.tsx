import React, { useEffect, useRef } from 'react';

interface FeatherVisualizerProps {
  state: 'idle' | 'thinking' | 'speaking';
}

const FeatherVisualizer: React.FC<FeatherVisualizerProps> = ({ state }) => {
  
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Glow Effects */}
        <div className={`absolute inset-0 rounded-full bg-teal-500/10 blur-3xl transition-all duration-1000 ${state === 'speaking' ? 'scale-125 opacity-70' : 'scale-100 opacity-30'}`}></div>
        <div className={`absolute inset-0 rounded-full bg-blue-600/10 blur-2xl transition-all duration-1000 ${state === 'thinking' ? 'scale-110 opacity-60' : 'scale-95 opacity-20'}`}></div>

        {/* The Feather Stylized Graphic (SVG) */}
        <svg 
            viewBox="0 0 100 200" 
            className={`w-40 h-80 drop-shadow-[0_0_15px_rgba(45,212,191,0.5)] transition-transform duration-1000 ${state === 'thinking' ? 'animate-pulse-glow' : ''}`}
            fill="none"
            strokeLinecap="round"
        >
            {/* Stem */}
            <path d="M50 180 Q 50 100 50 20" stroke="url(#featherGradient)" strokeWidth="2" className={state === 'speaking' ? 'animate-pulse' : ''}/>
            
            {/* Eye of the feather */}
            <ellipse cx="50" cy="50" rx="15" ry="20" fill="url(#eyeGradient)" />
            <ellipse cx="50" cy="50" rx="8" ry="12" fill="#1e3a8a" /> {/* Deep Blue */}
            <circle cx="50" cy="50" r="4" fill="#fbbf24" /> {/* Gold center */}

            {/* Barbs (Left) */}
            <path d="M50 60 Q 30 50 10 30" stroke="url(#featherGradient)" strokeWidth="1" className="opacity-80" />
            <path d="M50 70 Q 30 60 10 40" stroke="url(#featherGradient)" strokeWidth="1" className="opacity-75" />
            <path d="M50 80 Q 30 70 15 50" stroke="url(#featherGradient)" strokeWidth="1" className="opacity-70" />
            <path d="M50 90 Q 35 80 20 60" stroke="url(#featherGradient)" strokeWidth="1" className="opacity-65" />
            <path d="M50 100 Q 35 90 20 70" stroke="url(#featherGradient)" strokeWidth="1" className="opacity-60" />
            
            {/* Barbs (Right) */}
            <path d="M50 60 Q 70 50 90 30" stroke="url(#featherGradient)" strokeWidth="1" className="opacity-80" />
            <path d="M50 70 Q 70 60 90 40" stroke="url(#featherGradient)" strokeWidth="1" className="opacity-75" />
            <path d="M50 80 Q 70 70 85 50" stroke="url(#featherGradient)" strokeWidth="1" className="opacity-70" />
            <path d="M50 90 Q 65 80 80 60" stroke="url(#featherGradient)" strokeWidth="1" className="opacity-65" />
            <path d="M50 100 Q 65 90 80 70" stroke="url(#featherGradient)" strokeWidth="1" className="opacity-60" />

             {/* Flute/Audio Bars Animation (Only visible when speaking/thinking) */}
             {state !== 'idle' && (
                <g className="opacity-80">
                   <rect x="20" y="150" width="4" height="20" rx="2" fill="#fbbf24">
                        <animate attributeName="height" values="20;40;20" dur="1s" repeatCount="indefinite" begin="0s" />
                        <animate attributeName="y" values="150;130;150" dur="1s" repeatCount="indefinite" begin="0s" />
                   </rect>
                   <rect x="30" y="150" width="4" height="30" rx="2" fill="#2dd4bf">
                        <animate attributeName="height" values="30;10;30" dur="0.8s" repeatCount="indefinite" begin="0.1s" />
                        <animate attributeName="y" values="150;170;150" dur="0.8s" repeatCount="indefinite" begin="0.1s" />
                   </rect>
                    <rect x="40" y="150" width="4" height="25" rx="2" fill="#fbbf24">
                        <animate attributeName="height" values="25;45;25" dur="1.2s" repeatCount="indefinite" begin="0.2s" />
                        <animate attributeName="y" values="150;125;150" dur="1.2s" repeatCount="indefinite" begin="0.2s" />
                   </rect>
                   <rect x="60" y="150" width="4" height="20" rx="2" fill="#2dd4bf">
                        <animate attributeName="height" values="20;35;20" dur="0.9s" repeatCount="indefinite" begin="0.3s" />
                        <animate attributeName="y" values="150;135;150" dur="0.9s" repeatCount="indefinite" begin="0.3s" />
                   </rect>
                    <rect x="70" y="150" width="4" height="15" rx="2" fill="#fbbf24">
                        <animate attributeName="height" values="15;30;15" dur="1.1s" repeatCount="indefinite" begin="0.4s" />
                        <animate attributeName="y" values="150;135;150" dur="1.1s" repeatCount="indefinite" begin="0.4s" />
                   </rect>
                </g>
             )}

            <defs>
                <linearGradient id="featherGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0f766e" /> {/* Dark Teal */}
                    <stop offset="50%" stopColor="#2dd4bf" /> {/* Light Teal */}
                    <stop offset="100%" stopColor="#1e3a8a" /> {/* Royal Blue */}
                </linearGradient>
                <radialGradient id="eyeGradient" cx="50%" cy="50%" r="50%">
                     <stop offset="0%" stopColor="#2dd4bf" />
                     <stop offset="70%" stopColor="#0f766e" />
                     <stop offset="100%" stopColor="#fbbf24" /> {/* Gold Rim */}
                </radialGradient>
            </defs>
        </svg>
    </div>
  );
};

export default FeatherVisualizer;