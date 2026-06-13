import React, { useState, useEffect, useRef } from 'react';
import client from '../api/client';

export const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Restore chat history from sessionStorage on mount
  useEffect(() => {
    const savedHistory = sessionStorage.getItem('cf_chat_history');
    if (savedHistory) {
      try {
        setMessages(JSON.parse(savedHistory));
      } catch (err) {
        console.error('Failed to parse saved chat history:', err);
      }
    } else {
      // Default welcome message
      setMessages([
        {
          role: 'assistant',
          content: 'Hello! I am your AI academic assistant. You can ask me any questions regarding your courses, exam preparation, homework, assignments, or university academic processes. How can I help you today?',
        },
      ]);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll to bottom and save to sessionStorage whenever messages update
  useEffect(() => {
    scrollToBottom();
    if (messages.length > 0) {
      sessionStorage.setItem('cf_chat_history', JSON.stringify(messages));
    }
  }, [messages]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || text.length > 500 || loading) return;

    const userMessage = { role: 'user', content: text };
    
    // Optimistically add user's message to list and clear input box
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    // Limit history to the last 10 messages for conversational context
    const historySlice = messages.slice(-10).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const response = await client.post('/chat/message', {
        message: text,
        history: historySlice,
      });

      const replyText = response.data?.reply || 'Error: Empty assistant response';
      
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: replyText },
      ]);
    } catch (err) {
      console.error('Chat request failed:', err.message);
      // Append inline fallback message as required by Task 42
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Assistant temporarily unavailable. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charsRemaining = 500 - inputValue.length;

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col justify-between pb-20 md:pb-0">
      {/* Header */}
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Academic chatbot</h1>
          <p className="text-sm text-slate-400 mt-1">
            Ask questions about study topics, assignments, exams, or campus rules.
          </p>
        </div>
        <button
          onClick={() => {
            const confirmClear = window.confirm('Clear your chat history?');
            if (confirmClear) {
              setMessages([
                {
                  role: 'assistant',
                  content: 'Welcome! How can I assist you with your academic schedule or homework today?',
                },
              ]);
              sessionStorage.removeItem('cf_chat_history');
            }
          }}
          className="text-xs font-semibold text-rose-400 hover:text-rose-300 border border-rose-900/60 bg-rose-950/20 px-3 py-1.5 rounded-xl hover:bg-rose-900/40 transition-colors"
        >
          Clear Chat
        </button>
      </div>

      {/* Message List Panel */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 pr-2 select-text">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed border shadow-lg ${
                msg.role === 'user'
                  ? 'bg-indigo-600 border-indigo-500 text-white rounded-tr-none'
                  : msg.content.includes('temporarily unavailable')
                  ? 'bg-rose-950/40 border-rose-800/80 text-rose-200 rounded-tl-none'
                  : 'bg-slate-900/70 border-slate-800 text-slate-150 rounded-tl-none'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl rounded-tl-none p-4 max-w-[80%] flex items-center gap-1.5">
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input panel (Task 42) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2 relative mt-4">
        <textarea
          rows="2"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none text-sm pr-12"
          placeholder="Type your academic question here... (Press Enter to send)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
        />

        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-slate-500">
            Assists with: Course details, exams, research, assignments
          </span>
          <div className="flex items-center gap-3">
            {/* Live Character Counter */}
            <span
              className={`font-semibold tracking-wider ${
                charsRemaining < 50 ? 'text-rose-500 animate-pulse' : 'text-slate-500'
              }`}
            >
              {charsRemaining} / 500
            </span>
            <button
              onClick={handleSend}
              disabled={loading || !inputValue.trim() || inputValue.length > 500}
              className="glass-btn-primary py-2 px-4 text-xs font-bold"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
