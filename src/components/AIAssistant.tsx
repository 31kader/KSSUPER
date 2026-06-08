
import React, { useState } from 'react';
import { Brain, Sparkles, Send, Bot, TrendingUp, AlertTriangle, Lightbulb, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { analyzeStoreData } from '../services/geminiService';
import { Card, Button } from './ui';
import { cn } from '../lib/utils';

interface AIAssistantProps {
  products: any[];
  transactions: any[];
  expenses: any[];
  settings: any;
  stockAdjustments: any[];
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ products, transactions, expenses, settings, stockAdjustments }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async (customPrompt?: string) => {
    const prompt = customPrompt || input;
    if (!prompt.trim() && !customPrompt) return;

    const userMessage = { role: 'user' as const, content: prompt };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await analyzeStoreData({ products, transactions, expenses, settings, stockAdjustments }, prompt);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Une erreur est survenue lors de l'analyse." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const suggestions = [
    { text: "Analyse ma rentabilité", icon: TrendingUp },
    { text: "Stocks critiques ?", icon: AlertTriangle },
    { text: "Conseils marketing", icon: Lightbulb },
  ];

  return (
    <div className="flex flex-col h-[600px] border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-2xl shadow-indigo-500/5">
      <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
            <Brain size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tighter uppercase">Assistant Stratégique IA</h3>
            <p className="text-xs text-indigo-100 font-medium">Propulsé par Gemini Pro</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
           <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">En ligne</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
              <Bot size={48} />
            </div>
            <div className="max-w-xs">
              <h4 className="text-sm font-bold text-slate-800 mb-2">Bonjour ! Je suis votre consultant IA.</h4>
              <p className="text-xs text-slate-500">Demandez-moi n'importe quoi sur vos ventes, vos stocks ou vos marges.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s.text)}
                  className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:border-indigo-600 hover:text-indigo-600 transition-all text-left shadow-sm"
                >
                  <s.icon size={16} />
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex",
                m.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed",
                m.role === 'user' 
                  ? "bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-100" 
                  : "bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-sm markdown-body"
              )}>
                <Markdown>{m.content}</Markdown>
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                <RefreshCw size={16} className="text-indigo-600 animate-spin" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">L'IA analyse vos données...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <input
            type="text"
            placeholder="Posez une question strategique..."
            className="flex-1 bg-transparent border-none outline-none px-4 text-sm font-medium text-slate-800"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button
            onClick={() => handleSend()}
            disabled={isTyping || !input.trim()}
            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-indigo-100"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
