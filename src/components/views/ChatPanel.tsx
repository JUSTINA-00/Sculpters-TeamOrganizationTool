import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { motion } from 'motion/react';
import { Message, UserProfile } from '../../types';
import { Avatar } from '../ui/Avatar';

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface ChatPanelProps {
  messages: Message[];
  currentUser: UserProfile;
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, currentUser, onSend }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    if (!inputValue.trim()) return;
    onSend(inputValue.trim());
    setInputValue('');
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); send(); };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="max-w-3xl mx-auto h-[calc(100vh-10rem)] flex flex-col">
      <h2 className="text-2xl font-bold mb-6">Team Chat</h2>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide mb-4">
        {messages.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">No messages yet. Start the conversation!</div>
        )}
        {messages.map((msg, idx) => {
          const isMe = msg.senderId === currentUser.uid;
          const showHeader = idx === 0 || messages[idx - 1].senderId !== msg.senderId;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {showHeader && (
                <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <Avatar initials={msg.senderInitials} color={msg.senderColor} size="sm" />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{msg.senderName}</span>
                  <span className="text-[9px] text-gray-300">{formatTime(msg.timestamp)}</span>
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${isMe
                ? 'bg-[#534AB7] text-white rounded-tr-none'
                : 'bg-white border border-[rgba(0,0,0,0.08)] text-gray-900 rounded-tl-none'}`}>
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSubmit} className="bg-white border border-[rgba(0,0,0,0.08)] p-2 rounded-xl flex items-center gap-2 shrink-0">
        <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send)" className="flex-1 px-3 py-2 text-sm outline-none" />
        <button type="submit" className="bg-[#534AB7] text-white p-2 rounded-lg hover:bg-[#453d9c]">
          <Send size={18} />
        </button>
      </form>
    </motion.div>
  );
}