import React, { useState, useEffect, useRef } from 'react';
import { Plus, ArrowLeft, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Doc, TeamMember, UserProfile } from '../../types';
import { DOC_EMOJIS } from '../../constants';
import { Avatar } from '../ui/Avatar';
import { formatRelative } from '../../utils/helpers';

interface DocsPanelProps {
  docs: Doc[];
  members: TeamMember[];
  currentUser: UserProfile;
  onUpdate: (id: string, content: string) => void;
  onCreate: (name: string, emoji: string) => void;
  onDelete: (id: string) => void;
}

export function DocsPanel({ docs, members, currentUser, onUpdate, onCreate, onDelete }: DocsPanelProps) {
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [localContent, setLocalContent] = useState('');
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocEmoji, setNewDocEmoji] = useState(DOC_EMOJIS[0]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getMember = (uid: string) => members.find(m => m.uid === uid);
  const activeDoc = docs.find(d => d.id === activeDocId);

  useEffect(() => {
    if (activeDoc) setLocalContent(activeDoc.content);
  }, [activeDocId]);

  const handleContentChange = (val: string) => {
    setLocalContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { if (activeDocId) onUpdate(activeDocId, val); }, 800);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;
    onCreate(newDocName.trim(), newDocEmoji);
    setNewDocName(''); setShowNewDoc(false);
  };

  if (activeDoc) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setActiveDocId(null)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <span className="text-2xl">{activeDoc.emoji}</span>
        <h2 className="text-xl font-bold flex-1">{activeDoc.name}</h2>
        <span className="text-xs text-gray-400">Saved {formatRelative(activeDoc.updatedAt)}</span>
        <div className="flex -space-x-2">
          {activeDoc.editors.slice(0, 4).map(uid => {
            const m = getMember(uid);
            return m ? <Avatar key={uid} initials={m.initials} color={m.color} size="sm" /> : null;
          })}
        </div>
        {(activeDoc.createdBy === currentUser.uid || currentUser.role === 'leader') && (
          <button onClick={() => { onDelete(activeDoc.id); setActiveDocId(null); }} className="p-2 text-gray-300 hover:text-[#A32D2D]">
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <textarea value={localContent} onChange={e => handleContentChange(e.target.value)}
        className="flex-1 bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-8 outline-none resize-none leading-relaxed text-gray-800 shadow-sm"
        placeholder="Start writing… changes are saved automatically." />
    </motion.div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Documents</h2>
        <button onClick={() => setShowNewDoc(true)} className="flex items-center gap-1.5 bg-[#534AB7] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#453d9c]">
          <Plus size={14} /> New Doc
        </button>
      </div>

      {showNewDoc && (
        <form onSubmit={handleCreate} className="bg-white border border-[rgba(0,0,0,0.08)] p-4 rounded-xl mb-6 flex items-center gap-3">
          <select value={newDocEmoji} onChange={e => setNewDocEmoji(e.target.value)} className="text-2xl bg-gray-50 border-none rounded-lg p-2 outline-none">
            {DOC_EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
          </select>
          <input value={newDocName} onChange={e => setNewDocName(e.target.value)} placeholder="Document name…" autoFocus
            className="flex-1 px-3 py-2 text-sm outline-none border border-[rgba(0,0,0,0.08)] rounded-lg" />
          <button type="submit" className="bg-[#534AB7] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#453d9c]">Create</button>
          <button type="button" onClick={() => setShowNewDoc(false)} className="p-2 text-gray-400 hover:text-gray-700"><X size={16} /></button>
        </form>
      )}

      {docs.length === 0 && !showNewDoc && (
        <div className="text-center py-16 text-gray-400 text-sm">No documents yet. Create one!</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.map(d => (
          <button key={d.id} onClick={() => setActiveDocId(d.id)}
            className="bg-white border border-[rgba(0,0,0,0.08)] p-6 rounded-2xl text-left hover:border-[#534AB7] transition-all group">
            <span className="text-3xl mb-4 block">{d.emoji}</span>
            <h3 className="font-bold text-gray-900 mb-1 group-hover:text-[#534AB7]">{d.name}</h3>
            <p className="text-xs text-gray-500 mb-4">Updated {formatRelative(d.updatedAt)}</p>
            {d.content && (
              <p className="text-xs text-gray-400 mb-4 line-clamp-2">{d.content.slice(0, 100)}{d.content.length > 100 ? '…' : ''}</p>
            )}
            <div className="flex -space-x-2">
              {d.editors.slice(0, 4).map(uid => {
                const m = getMember(uid);
                return m ? <Avatar key={uid} initials={m.initials} color={m.color} size="sm" /> : null;
              })}
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}