import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Send, Image as ImageIcon, Trash2, Bot, User, AlertCircle, RefreshCw } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  imageUrl?: string;
  modelUsed?: string;
  timestamp: string;
}

export const AIDoubtSolver: React.FC = () => {
  const { studentToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('exam_ai_doubt_chat') || localStorage.getItem('apex_ai_doubt_chat');
    return saved ? JSON.parse(saved) : [
      {
        id: 'msg_welcome',
        sender: 'ai',
        text: 'Hello! I am your AI Competitive Doubt Assistant powered by advanced reasoning. Ask any question in Math, Reasoning, GK, Current Affairs, English, or Computer. You can also upload a question image or diagram for step-by-step solutions.',
        modelUsed: 'Google Gemini Flash',
        timestamp: new Date().toISOString()
      }
    ];
  });

  const [input, setInput] = useState('');
  const [subject, setSubject] = useState('Math');
  const [aiModel, setAiModel] = useState<string>('gemini-flash-latest');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem('exam_ai_doubt_chat', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setError('Image must be under 8MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !imagePreview) || loading) return;

    const userText = input.trim();
    const currentImg = imagePreview;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: userText,
      imageUrl: currentImg || undefined,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setImagePreview(null);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/doubt-solve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`
        },
        body: JSON.stringify({
          questionText: userText,
          subject,
          imageBase64: currentImg,
          aiModel
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to solve doubt');

      const modelDisplayName = aiModel === 'chatgpt-4o'
        ? 'ChatGPT-4o Updated'
        : aiModel === 'chatgpt-4o-mini'
        ? 'ChatGPT-4o Mini'
        : aiModel === 'chatgpt-o1'
        ? 'ChatGPT o1 (STEM)'
        : aiModel === 'gemini-2.5-pro'
        ? 'Gemini 2.5 Pro'
        : 'Gemini 2.5 Flash';

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: data.solution,
        modelUsed: modelDisplayName,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      setError(err.message || 'AI service error');
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Clear entire AI doubt conversation history?')) {
      const initial: ChatMessage[] = [
        {
          id: `msg_welcome_${Date.now()}`,
          sender: 'ai',
          text: 'Conversation cleared. Type a problem statement or upload a diagram to solve.',
          modelUsed: 'ChatGPT-4o Updated',
          timestamp: new Date().toISOString()
        }
      ];
      setMessages(initial);
      localStorage.removeItem('exam_ai_doubt_chat');
      localStorage.removeItem('apex_ai_doubt_chat');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">AI Instant Doubt Solver</h2>
              <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.2 rounded-full font-mono">
                Updated Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Step-by-step formulas, shortcuts & concept explanations</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* AI Model Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-xs">
            <span className="text-[10px] uppercase font-bold text-indigo-400">Model:</span>
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="gemini-flash-latest">Google Gemini Flash (Recommended)</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (High-Speed)</option>
              <option value="gemini-3.8-flash">Gemini 3.8 Flash (Comprehensive)</option>
              <option value="chatgpt-4o">ChatGPT-4o (Reasoning)</option>
              <option value="chatgpt-o1">ChatGPT o1 (Multi-Step Logic)</option>
            </select>
          </div>

          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="Math">Math</option>
            <option value="Reasoning">Reasoning</option>
            <option value="GK">GK</option>
            <option value="Current Affairs">Current Affairs</option>
            <option value="English">English</option>
            <option value="Computer">Computer</option>
          </select>

          <button
            onClick={handleClearChat}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.sender === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-indigo-400 border border-slate-700'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div
              className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-slate-950/80 border border-slate-800 text-slate-200 rounded-tl-none'
              }`}
            >
              {msg.sender === 'ai' && msg.modelUsed && (
                <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-slate-800/80 text-[10px] font-mono text-indigo-400">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>Powered by {msg.modelUsed}</span>
                </div>
              )}
              {msg.imageUrl && (
                <div className="mb-3 rounded-lg overflow-hidden border border-slate-700/50 max-w-sm">
                  <img src={msg.imageUrl} alt="Uploaded doubt" className="max-h-48 object-contain" />
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.text}</div>
              <span className="block text-[10px] text-slate-400 mt-2 text-right">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-800 text-indigo-400 border border-slate-700 flex items-center justify-center">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing formula, deriving steps and competitive pro-tips...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3">
        {error && (
          <div className="p-2.5 bg-red-950/40 border border-red-900/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {imagePreview && (
          <div className="relative inline-block border border-slate-700 rounded-lg p-1 bg-slate-950">
            <img src={imagePreview} alt="Preview" className="h-16 rounded object-contain" />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5 shadow-md"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center justify-center transition-colors"
            title="Upload Question Diagram / Screenshot"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your competitive exam doubt or question..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />

          <button
            type="submit"
            disabled={(!input.trim() && !imagePreview) || loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white p-2.5 rounded-xl transition-colors shrink-0"
            title="Send Doubt"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
