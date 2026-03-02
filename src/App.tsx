/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Send, 
  Terminal, 
  Cpu, 
  Settings, 
  Search, 
  Volume2, 
  Activity,
  Command as CommandIcon,
  Clock
} from 'lucide-react';
import Markdown from 'react-markdown';
import { aura } from './services/auraService';

interface LogEntry {
  id: string;
  type: 'system' | 'user' | 'aura';
  content: string;
  timestamp: Date;
}

export default function App() {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [auraState, setAuraState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleCommand(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    // Initial Greeting
    addLog('system', 'AURA Core initialized. Awaiting commands.');

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (type: LogEntry['type'], content: string) => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content,
      timestamp: new Date()
    }]);
  };

  const pcmToWav = (base64Pcm: string, sampleRate: number = 24000): string => {
    const binaryString = window.atob(base64Pcm);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    // RIFF identifier
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + len, true); // file length
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // fmt chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // length of fmt chunk
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample

    // data chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, len, true); // data length

    const blob = new Blob([wavHeader, bytes], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  };

  const handleCommand = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    setInput('');
    setIsProcessing(true);
    setAuraState('thinking');
    addLog('user', text);

    try {
      const response = await aura.processCommand(text);
      
      // Handle Function Calls
      const functionCalls = response.functionCalls;
      if (functionCalls) {
        for (const call of functionCalls) {
          addLog('system', `Executing: ${call.name}(${JSON.stringify(call.args)})`);
          // Simulate a small delay for "system action"
          await new Promise(r => setTimeout(r, 800));
          addLog('system', `Action ${call.name} completed successfully.`);
        }
      }

      const auraText = response.text || "Command processed, sir.";
      addLog('aura', auraText);

      // Speak back
      setAuraState('speaking');
      const audioResponse = await aura.speak(auraText);
      if (audioResponse) {
        const { data, mimeType } = audioResponse;
        let audioUrl: string;

        if (mimeType.includes('pcm')) {
          // Extract sample rate from mimeType if present, e.g., "audio/pcm;rate=24000"
          const rateMatch = mimeType.match(/rate=(\d+)/);
          const rate = rateMatch ? parseInt(rateMatch[1]) : 24000;
          audioUrl = pcmToWav(data, rate);
        } else {
          audioUrl = `data:${mimeType};base64,${data}`;
        }

        const audio = new Audio(audioUrl);
        audio.onended = () => {
          setAuraState('idle');
          if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          setAuraState('idle');
        };
        await audio.play();
      } else {
        setAuraState('idle');
      }

    } catch (error) {
      console.error(error);
      addLog('system', 'Error: Neural link interrupted.');
      setAuraState('idle');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      setAuraState('listening');
      recognitionRef.current?.start();
    }
  };

  return (
    <div className="relative h-screen w-screen flex flex-col items-center justify-center p-4 md:p-8 font-sans">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-20">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-cyan-400/80">System Online</span>
          </div>
          <h1 className="text-2xl font-display italic font-black tracking-tighter text-white/90">AURA</h1>
        </div>
        
        <div className="flex gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Local Time</span>
            <span className="text-xl font-mono text-white/80">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Core Load</span>
            <span className="text-xl font-mono text-white/80">12.4%</span>
          </div>
        </div>
      </div>

      {/* Main Interface */}
      <main className="relative z-10 w-full max-w-6xl h-full flex flex-col md:flex-row gap-6 mt-16">
        
        {/* Left Panel: System Logs */}
        <div className="flex-1 flex flex-col gap-4 h-full overflow-hidden">
          <div className="aura-glass rounded-2xl p-6 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-4">
              <Terminal size={16} className="text-cyan-400" />
              <span className="text-xs uppercase tracking-widest font-mono text-white/60">Neural Log</span>
            </div>
            
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide"
            >
              <AnimatePresence initial={false}>
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex flex-col ${
                      log.type === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-mono text-white/30">
                        {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`text-[9px] uppercase tracking-widest font-bold ${
                        log.type === 'system' ? 'text-cyan-400' : 
                        log.type === 'aura' ? 'text-purple-400' : 'text-white/60'
                      }`}>
                        {log.type}
                      </span>
                    </div>
                    <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                      log.type === 'user' 
                        ? 'bg-white/5 text-white/90 rounded-tr-none' 
                        : log.type === 'aura'
                        ? 'bg-purple-500/10 text-purple-100 rounded-tl-none border border-purple-500/20'
                        : 'bg-cyan-500/5 text-cyan-100/80 rounded-tl-none border border-cyan-500/10 font-mono text-xs'
                    }`}>
                      <Markdown>{log.content}</Markdown>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Input Area */}
          <div className="aura-glass rounded-2xl p-4 flex items-center gap-4">
            <button 
              onClick={toggleListening}
              className={`p-4 rounded-xl transition-all duration-300 ${
                isListening 
                  ? 'bg-red-500/20 text-red-400 aura-glow' 
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCommand(input)}
              placeholder="Awaiting command..."
              className="flex-1 bg-transparent border-none outline-none text-white/90 placeholder:text-white/20 font-mono text-sm"
            />
            <button 
              onClick={() => handleCommand(input)}
              disabled={isProcessing || !input.trim()}
              className="p-4 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 transition-all"
            >
              <Send size={20} />
            </button>
          </div>
        </div>

        {/* Right Panel: Visualizer & Stats */}
        <div className="w-full md:w-80 flex flex-col gap-6">
          {/* AURA Core */}
          <div className="aura-glass rounded-2xl p-8 flex flex-col items-center justify-center aspect-square relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5" />
            
            {/* Animated Rings */}
            <div className="relative w-48 h-48 flex items-center justify-center">
              <div className="absolute inset-0 border border-cyan-500/20 rounded-full aura-ring" />
              <div className="absolute inset-4 border border-purple-500/20 rounded-full aura-ring [animation-delay:1s]" />
              <div className="absolute inset-8 border border-white/10 rounded-full aura-ring [animation-delay:2s]" />
              
              {/* Core */}
              <motion.div 
                animate={{
                  scale: auraState === 'thinking' ? [1, 1.1, 1] : 1,
                  rotate: auraState === 'speaking' ? 360 : 0,
                }}
                transition={{
                  duration: auraState === 'thinking' ? 0.5 : 10,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className={`w-24 h-24 rounded-full flex items-center justify-center relative z-10 transition-all duration-500 ${
                  auraState === 'listening' ? 'bg-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.4)]' :
                  auraState === 'thinking' ? 'bg-cyan-500/20 shadow-[0_0_40px_rgba(6,182,212,0.4)]' :
                  auraState === 'speaking' ? 'bg-purple-500/20 shadow-[0_0_40px_rgba(168,85,247,0.4)]' :
                  'bg-white/5 shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                }`}
              >
                <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${
                  auraState === 'listening' ? 'border-red-400' :
                  auraState === 'thinking' ? 'border-cyan-400' :
                  auraState === 'speaking' ? 'border-purple-400' :
                  'border-white/20'
                }`}>
                  <Activity size={32} className={
                    auraState === 'listening' ? 'text-red-400' :
                    auraState === 'thinking' ? 'text-cyan-400' :
                    auraState === 'speaking' ? 'text-purple-400' :
                    'text-white/40'
                  } />
                </div>
              </motion.div>
            </div>

            <div className="mt-8 text-center">
              <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-white/40">Status</span>
              <p className={`text-sm font-mono mt-1 uppercase tracking-widest ${
                auraState === 'listening' ? 'text-red-400' :
                auraState === 'thinking' ? 'text-cyan-400' :
                auraState === 'speaking' ? 'text-purple-400' :
                'text-white/60'
              }`}>
                {auraState}
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="aura-glass rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu size={14} className="text-white/40" />
                <span className="text-[10px] uppercase tracking-widest text-white/40">Neural Link</span>
              </div>
              <span className="text-[10px] font-mono text-cyan-400">Stable</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 size={14} className="text-white/40" />
                <span className="text-[10px] uppercase tracking-widest text-white/40">Voice Output</span>
              </div>
              <span className="text-[10px] font-mono text-cyan-400">Zephyr v2.5</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CommandIcon size={14} className="text-white/40" />
                <span className="text-[10px] uppercase tracking-widest text-white/40">OS Bridge</span>
              </div>
              <span className="text-[10px] font-mono text-purple-400">Simulated</span>
            </div>
          </div>

          {/* Shortcuts */}
          <div className="flex-1 aura-glass rounded-2xl p-6">
            <span className="text-[10px] uppercase tracking-widest text-white/40 mb-4 block">Quick Commands</span>
            <div className="space-y-2">
              {[
                "Open Spotify",
                "Check system status",
                "Search for 'Project AURA'",
                "Set volume to 80%"
              ].map((cmd, i) => (
                <button 
                  key={i}
                  onClick={() => handleCommand(cmd)}
                  className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-white/60 transition-colors flex items-center gap-2"
                >
                  <div className="w-1 h-1 rounded-full bg-cyan-400" />
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Decoration */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 text-white/10 z-20">
        <div className="h-[1px] w-24 bg-current" />
        <span className="text-[8px] uppercase tracking-[0.5em]">AURA Advanced User Responsive Assistant</span>
        <div className="h-[1px] w-24 bg-current" />
      </div>
    </div>
  );
}
