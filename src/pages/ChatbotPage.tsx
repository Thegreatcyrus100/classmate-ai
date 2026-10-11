import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  RotateCcw,
  User,
  GraduationCap,
  BookOpen,
  Calculator,
  Languages,
  Award,
  Zap,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Headphones,
  Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type ChatbotRole =
  | 'study_buddy'
  | 'professor'
  | 'math_solver'
  | 'language_tutor'
  | 'exam_coach';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

// Clean markdown text for natural speech synthesis
function cleanMarkdownForSpeech(text: string): string {
  return text
    .replace(/[*_#`~>]/g, '') // Remove formatting characters
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to anchor text
    .replace(/```[\s\S]*?```/g, 'Code block omitted for reading.') // Replace code blocks
    .replace(/\s+/g, ' ')
    .trim();
}

export const ChatbotPage: React.FC = () => {
  const { studentProfile } = useAuth();

  const [role, setRole] = useState<ChatbotRole>('study_buddy');
  const [speed, setSpeed] = useState<'general' | 'fast'>('general');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content: `Hi ${
        studentProfile?.fullName || 'student'
      }! I'm your **ClassMate Gemini Chatbot** with full voice chat support. You can type or tap the microphone to speak your question! Choose my role above (Study Buddy, Professor, Math Solver, Bilingual Filipino/Cebuano, or Exam Coach).`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Voice Chat States
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false); // Hands-Free Voice Chat Mode
  const [micError, setMicError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const voiceModeRef = useRef(voiceMode);
  voiceModeRef.current = voiceMode;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Initialize Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = role === 'language_tutor' ? 'fil-PH' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setInput(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition event notice:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setMicError('Microphone permission was denied. Please allow mic access in your browser.');
        } else if (event.error !== 'no-speech') {
          setMicError(`Microphone notice: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [role]);

  // Text-To-Speech Reader
  const speakMessage = useCallback((id: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech Synthesis is not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();

    if (speakingMessageId === id) {
      setSpeakingMessageId(null);
      return;
    }

    const cleanText = cleanMarkdownForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick best voice if available
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const preferred = voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google'))
      );
      if (preferred) utterance.voice = preferred;
    }

    utterance.onstart = () => {
      setSpeakingMessageId(id);
    };

    utterance.onend = () => {
      setSpeakingMessageId(null);
      // If Hands-Free Voice Mode is active, listen for next student input!
      if (voiceModeRef.current && recognitionRef.current) {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.warn('Auto-restart voice recognition notice:', e);
          }
        }, 600);
      }
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis notice:', e);
      setSpeakingMessageId(null);
    };

    window.speechSynthesis.speak(utterance);
  }, [speakingMessageId]);

  const stopAllSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  };

  // Toggle Microphone
  const toggleListening = () => {
    if (!speechSupported) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    // If currently speaking, stop it so mic doesn't pick it up
    stopAllSpeech();

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setMicError(null);
      try {
        if (role === 'language_tutor') {
          recognitionRef.current.lang = 'fil-PH';
        } else {
          recognitionRef.current.lang = 'en-US';
        }
        recognitionRef.current?.start();
      } catch (err: any) {
        console.warn('Recognition start notice:', err);
      }
    }
  };

  const rolesConfig: Record<
    ChatbotRole,
    { label: string; icon: any; description: string; welcomeNote: string }
  > = {
    study_buddy: {
      label: 'Study Buddy',
      icon: Sparkles,
      description: 'Friendly, simple analogies & encouragement',
      welcomeNote: 'Switched to **Alex (Study Buddy)**! What concept can I make easy for you today?',
    },
    professor: {
      label: 'Professor',
      icon: GraduationCap,
      description: 'Academic, formal & collegiate structure',
      welcomeNote: 'You are now consulting **Professor Maxwell**. State your academic question or topic.',
    },
    math_solver: {
      label: 'Math & STEM Solver',
      icon: Calculator,
      description: 'Step-by-step derivations & equations',
      welcomeNote: 'I am **Dr. Euler**. Send me any formula, problem, or algorithm to solve step-by-step.',
    },
    language_tutor: {
      label: 'Tagalog & Bisaya Tutor',
      icon: Languages,
      description: 'Filipino, Tagalog & Cebuano explanations',
      welcomeNote: 'Kumusta! Ako si **Bayani**. Pwede kitang turuan sa Tagalog, Filipino, o Cebuano/Bisaya gamit ang voice chat. Unsay matabang nako nimo karon?',
    },
    exam_coach: {
      label: 'Exam Coach',
      icon: Award,
      description: 'Mnemonics, high-yield traps & recall',
      welcomeNote: 'Ready to study for examinations with **Coach Rivera**! Let us test your active recall with voice chat.',
    },
  };

  const handleRoleChange = (newRole: ChatbotRole) => {
    setRole(newRole);
    setMessages((prev) => [
      ...prev,
      {
        id: `role_${Date.now()}`,
        role: 'model',
        content: rolesConfig[newRole].welcomeNote,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || input).trim();
    if (!prompt || loading) return;

    if (!textToSend) setInput('');

    // Stop recording if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          prompt,
          role,
          speed,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to get chatbot response');
      }

      const data = await res.json();

      const modelMsgId = `m_${Date.now()}`;
      const modelMsg: ChatMessage = {
        id: modelMsgId,
        role: 'model',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, modelMsg]);

      // If voice mode is active, automatically speak the AI reply aloud!
      if (voiceModeRef.current) {
        setTimeout(() => {
          speakMessage(modelMsgId, data.reply);
        }, 200);
      }
    } catch (err: any) {
      console.error('Chatbot error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'model',
          content: 'I ran into a connection error with Gemini. Please try again in a moment.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm('Clear conversation history and start a fresh study session?')) {
      stopAllSpeech();
      setMessages([
        {
          id: `fresh_${Date.now()}`,
          role: 'model',
          content: 'Session cleared. What topic or assignment are we working on now?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  const quickPrompts = [
    'Explain Big-O Notation with a fun analogy',
    'I-explain ang photosynthesis sa Tagalog',
    'Unsaon pagsulbad ani nga math formula?',
    'Give me a mnemonic to memorize cranial nerves',
    'Test me with a 3-question pop quiz on database normalization',
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4 flex flex-col h-[calc(100vh-8rem)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              ClassMate AI Chatbot
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Voice & Multimodal
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Interactive multi-turn academic tutor with microphone input and speech playback
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Hands-Free Voice Chat Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !voiceMode;
              setVoiceMode(next);
              if (!next) {
                stopAllSpeech();
                if (isListening) recognitionRef.current?.stop();
              } else {
                toggleListening();
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
              voiceMode
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700 shadow-md shadow-emerald-900/30 ring-1 ring-emerald-500'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850'
            }`}
            title="Toggle Hands-Free Spoken Conversation Mode"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>{voiceMode ? 'Voice Mode Active' : 'Hands-Free Voice'}</span>
          </button>

          {/* Speed Toggle */}
          <button
            type="button"
            onClick={() => setSpeed(speed === 'general' ? 'fast' : 'general')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
              speed === 'fast'
                ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
            title="Toggle between Fast and Deep reasoning"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{speed === 'fast' ? 'Fast' : 'Deep'}</span>
          </button>

          {/* Reset Session */}
          <button
            type="button"
            onClick={handleClearHistory}
            className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
            title="Start new conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Voice Chat Notice Banner if Voice Mode is active */}
      {voiceMode && (
        <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-emerald-200 text-xs flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>
              <strong>Hands-Free Voice Chat Enabled:</strong> Tap the mic or speak anytime. The AI speaks its responses back aloud to you.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setVoiceMode(false)}
            className="text-[11px] underline text-emerald-400 hover:text-emerald-300"
          >
            Turn Off
          </button>
        </div>
      )}

      {/* Mic permission or notice */}
      {micError && (
        <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center justify-between gap-2 shrink-0">
          <span>{micError}</span>
          <button
            type="button"
            onClick={() => setMicError(null)}
            className="text-[11px] underline text-rose-400 hover:text-rose-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Role Selector Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 text-xs">
        {(Object.keys(rolesConfig) as ChatbotRole[]).map((rKey) => {
          const cfg = rolesConfig[rKey];
          const Icon = cfg.icon;
          const isActive = role === rKey;
          return (
            <button
              key={rKey}
              onClick={() => handleRoleChange(rKey)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-[#0B132B] hover:bg-slate-850 text-slate-400 border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Chat Thread Container */}
      <div className="flex-1 min-h-0 rounded-2xl bg-[#0B132B] border border-slate-800 flex flex-col overflow-hidden">
        {/* Messages Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'model' && (
                <div className="w-7 h-7 rounded-xl bg-indigo-600/30 text-indigo-300 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className="space-y-1 max-w-xl group relative">
                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-sm relative ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                  } ${speakingMessageId === msg.id ? 'ring-2 ring-indigo-400' : ''}`}
                >
                  {msg.content}

                  {/* Read Aloud Button for AI responses */}
                  {msg.role === 'model' && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => speakMessage(msg.id, msg.content)}
                        className={`text-[11px] font-medium flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                          speakingMessageId === msg.id
                            ? 'bg-indigo-600 text-white animate-pulse'
                            : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800'
                        }`}
                        title={speakingMessageId === msg.id ? 'Stop reading' : 'Read aloud with voice'}
                      >
                        {speakingMessageId === msg.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5" />
                            <span>Stop Speaking</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Listen to Answer</span>
                          </>
                        )}
                      </button>

                      {speakingMessageId === msg.id && (
                        <div className="flex items-center gap-1 text-[10px] text-indigo-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce delay-100" />
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce delay-200" />
                          <span className="ml-1">Speaking aloud...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div
                  className={`text-[10px] text-slate-500 px-1 ${
                    msg.role === 'user' ? 'text-right' : 'text-left'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-xl bg-indigo-600/30 text-indigo-300 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-indigo-300 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
                <span>Thinking & answering...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/40 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0">Try:</span>
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(qp)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 text-[11px] shrink-0 transition-colors cursor-pointer"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Voice Listening Active Indicator Banner */}
        {isListening && (
          <div className="px-4 py-2 bg-indigo-950/60 border-t border-indigo-800/60 text-indigo-200 text-xs flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span className="font-medium">
                Listening to your voice... Speak clearly into your microphone!
              </span>
            </div>
            <button
              type="button"
              onClick={toggleListening}
              className="px-2 py-1 rounded bg-indigo-800 hover:bg-indigo-700 text-white text-[11px] font-semibold"
            >
              Stop Mic
            </button>
          </div>
        )}

        {/* Input Bar with Voice Microphone and Send */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/80 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Microphone Voice Button */}
            <button
              type="button"
              onClick={toggleListening}
              title={isListening ? 'Click to stop listening' : 'Click to speak via voice chat'}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-rose-600 text-white border-rose-500 animate-pulse shadow-lg shadow-rose-600/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border-slate-700 hover:text-white'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening
                  ? 'Listening to speech...'
                  : `Ask ${rolesConfig[role].label} or tap mic to talk...`
              }
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:border-indigo-500 focus:outline-none"
            />

            {/* Global Stop Audio Button if currently reading */}
            {speakingMessageId && (
              <button
                type="button"
                onClick={stopAllSpeech}
                title="Stop reading aloud"
                className="p-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-colors shrink-0 cursor-pointer"
              >
                <VolumeX className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
