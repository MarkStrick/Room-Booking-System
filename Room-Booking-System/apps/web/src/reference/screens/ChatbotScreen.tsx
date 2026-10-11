import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AppHeader } from '../components/PhoneFrame';
import { Send, Bot, User as UserIcon, Sparkles } from 'lucide-react';
import { useAsyncAction } from '../useAsyncAction';

export function ChatbotScreen() {
  const { chatMessages, sendChatMessage } = useApp();
  const [input, setInput] = useState('');
  const {busy:isTyping,error,perform}=useAsyncAction();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    const text=input.trim();
    void perform(()=>sendChatMessage(text),()=>setInput(''));
  };

  const quickActions = [
    'จะจองห้องยังไง?',
    'กฎการจองคืออะไร?',
    'ห้องไหนรองรับคนเยอะสุด?',
    'เช็คสถานะยังไง?',
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <AppHeader showBack={false} title="ผู้ช่วยมข." />

      {/* Bot info bar */}
      <div className="px-4 py-3 bg-gradient-to-r from-kku-red to-kku-red-dark shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center backdrop-blur-sm">
            <Bot size={22} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">ผู้ช่วยจองห้องประชุม</p>
            <p className="text-white/70 text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> ออนไลน์
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 space-y-3">
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 animate-slide-up ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.sender === 'bot' ? 'bg-kku-red' : 'bg-gray-300'
            }`}>
              {msg.sender === 'bot' ? <Bot size={16} className="text-white" /> : <UserIcon size={16} className="text-gray-600" />}
            </div>
            <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
              msg.sender === 'bot'
                ? 'bg-white text-gray-800 rounded-tl-md border border-gray-100'
                : 'bg-kku-red text-white rounded-tr-md'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-2 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-kku-red flex items-center justify-center shrink-0">
              <Bot size={16} className="text-white" />
            </div>
            <div className="px-4 py-3 bg-white rounded-2xl rounded-tl-md border border-gray-100">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      {chatMessages.length <= 1 && (
        <div className="px-4 pb-2 shrink-0">
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Sparkles size={14} /> คำถามแนะนำ</p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((q) => (
              <button
                key={q}
                onClick={() => { setInput(q); }}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:border-kku-red hover:text-kku-red transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-gray-100 shrink-0">
        {error && <p role="alert" className="text-sm text-red-600 mb-2">{error}</p>}
        <div className="flex items-center gap-2">
          <input
            value={input}
            aria-label="ข้อความถึงผู้ช่วย"
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="พิมพ์ข้อความ..."
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-kku-red focus:bg-white transition-colors"
          />
          <button
            onClick={handleSend}
            aria-label="ส่งข้อความ"
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 rounded-full bg-kku-red text-white flex items-center justify-center shrink-0 hover:bg-kku-red-dark disabled:opacity-40 transition-colors active:scale-95"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
