import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, ArrowLeft, Trash2, X, Link2, Image } from 'lucide-react';
import { motion } from 'motion/react';
import { Doc, TeamMember, UserProfile } from '../../types';
import { DOC_EMOJIS } from '../../constants';
import { Avatar } from '../ui/Avatar';
import { formatRelative } from '../../utils/helpers';

interface DocsPanelProps {
  docs: Doc[];
  members: TeamMember[];
  currentUser: UserProfile;
  isLeader: boolean;        // ← add this
  onUpdate: (id: string, content: string) => void;
  onCreate: (name: string, emoji: string) => void;
  onDelete: (id: string) => void;
}

// ── Toolbar button ────────────────────────────────────────────────────────────
function TbBtn({
  onClick, title, children,
}: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className="px-2 py-1 rounded-md text-sm text-gray-600 hover:bg-[#f0eeff] hover:text-[#534AB7] transition-colors"
    >
      {children}
    </button>
  );
}

// ── Link popup ────────────────────────────────────────────────────────────────
function LinkPopup({ onInsert, onClose }: { onInsert: (url: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState('');
  return (
    <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-[rgba(83,74,183,0.25)] rounded-xl shadow-lg p-3 flex gap-2 items-center">
      <input
        autoFocus
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onInsert(url)}
        placeholder="https://example.com"
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#534AB7] w-56"
      />
      <button
        onMouseDown={e => { e.preventDefault(); onInsert(url); }}
        className="bg-[#534AB7] text-white text-sm px-3 py-1.5 rounded-lg font-semibold hover:bg-[#453d9c]"
      >Insert</button>
      <button onMouseDown={e => { e.preventDefault(); onClose(); }} className="p-1.5 text-gray-400 hover:text-gray-700"><X size={14} /></button>
    </div>
  );
}

// ── Image popup ───────────────────────────────────────────────────────────────
function ImagePopup({ onInsert, onClose }: { onInsert: (src: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => e.target?.result && onInsert(e.target.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-[rgba(83,74,183,0.25)] rounded-xl shadow-lg p-4 w-72 flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Insert Image</p>

      {/* Upload */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) handleFile(f); }}
        className="border-2 border-dashed border-[#c5bfee] rounded-lg p-4 text-center text-xs text-gray-400 cursor-pointer hover:border-[#534AB7] hover:bg-[#f5f3ff] hover:text-[#534AB7] transition-all"
      >
        📁 Upload or drag & drop
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

      {/* URL */}
      <p className="text-xs text-center text-gray-400">— or paste a URL —</p>
      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onInsert(url)}
        placeholder="https://example.com/image.jpg"
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#534AB7]"
      />

      <div className="flex gap-2">
        <button
          onMouseDown={e => { e.preventDefault(); if (url.trim()) onInsert(url.trim()); }}
          className="flex-1 bg-[#534AB7] text-white text-sm py-1.5 rounded-lg font-semibold hover:bg-[#453d9c]"
        >Insert</button>
        <button onMouseDown={e => { e.preventDefault(); onClose(); }} className="flex-1 bg-gray-100 text-gray-600 text-sm py-1.5 rounded-lg hover:bg-gray-200">Cancel</button>
      </div>
    </div>
  );
}

// ── Rich editor ───────────────────────────────────────────────────────────────
function RichEditor({ initialContent, onChange }: { initialContent: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialContent) {
      editorRef.current.innerHTML = initialContent;
    }
  }, []);

  const saveRange = useCallback(() => {
    const sel = window.getSelection();
    if (sel?.rangeCount) savedRange.current = sel.getRangeAt(0).cloneRange();
  }, []);

  const restoreRange = useCallback(() => {
    const r = savedRange.current;
    if (!r) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  }, []);

  const fmt = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  }, []);

  const handleInput = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onChange(editorRef.current?.innerHTML ?? '');
    }, 800);
  };

  // Paste image from clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => insertImage(ev.target?.result as string);
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const insertLink = (url: string) => {
    if (!url.trim()) return;
    restoreRange();
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      document.execCommand('createLink', false, url);
      editorRef.current?.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
    } else {
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = url;
      savedRange.current?.insertNode(a);
    }
    setShowLink(false);
    onChange(editorRef.current?.innerHTML ?? '');
  };

  const insertImage = (src: string) => {
    restoreRange();
    editorRef.current?.focus();
    const img = document.createElement('img');
    img.src = src;
    img.className = 'max-w-full rounded-xl my-2 block';
    img.style.maxHeight = '400px';
    const r = savedRange.current;
    if (r) { r.collapse(false); r.insertNode(img); }
    else editorRef.current?.appendChild(img);
    setShowImage(false);
    onChange(editorRef.current?.innerHTML ?? '');
  };

  const openLink = () => { saveRange(); setShowImage(false); setShowLink(v => !v); };
  const openImage = () => { saveRange(); setShowLink(false); setShowImage(v => !v); };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="relative flex items-center gap-0.5 flex-wrap px-4 py-1.5 border-b border-[rgba(0,0,0,0.06)] bg-gray-50/70 rounded-t-2xl">
        <TbBtn onClick={() => fmt('bold')} title="Bold"><b>B</b></TbBtn>
        <TbBtn onClick={() => fmt('italic')} title="Italic"><i>I</i></TbBtn>
        <TbBtn onClick={() => fmt('underline')} title="Underline"><u>U</u></TbBtn>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <TbBtn onClick={() => fmt('formatBlock', '<h2>')} title="Heading 2">H2</TbBtn>
        <TbBtn onClick={() => fmt('formatBlock', '<h3>')} title="Heading 3">H3</TbBtn>
        <TbBtn onClick={() => fmt('formatBlock', '<p>')} title="Paragraph">¶</TbBtn>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <TbBtn onClick={() => fmt('insertUnorderedList')} title="Bullet list">• List</TbBtn>
        <TbBtn onClick={() => fmt('insertOrderedList')} title="Numbered list">1. List</TbBtn>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <TbBtn onClick={openLink} title="Insert link"><Link2 size={14} className="inline" /> Link</TbBtn>
        <TbBtn onClick={openImage} title="Insert image"><Image size={14} className="inline" /> Image</TbBtn>

        {showLink && <LinkPopup onInsert={insertLink} onClose={() => setShowLink(false)} />}
        {showImage && <ImagePopup onInsert={insertImage} onClose={() => setShowImage(false)} />}
      </div>

      {/* Content area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onMouseUp={saveRange}
        onKeyUp={saveRange}
        onPaste={handlePaste}
        data-placeholder="Start writing…"
        className="flex-1 overflow-y-auto px-8 py-6 outline-none text-gray-800 leading-relaxed
          prose prose-sm max-w-none
          [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-300
          [&_a]:text-[#534AB7] [&_a]:underline
          [&_img]:rounded-xl [&_img]:my-2 [&_img]:max-w-full [&_img]:block
          [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
          [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
          [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      />
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function DocsPanel({ docs, members, currentUser, isLeader, onUpdate, onCreate, onDelete }: DocsPanelProps) {
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocEmoji, setNewDocEmoji] = useState(DOC_EMOJIS[0]);

  const getMember = (uid: string) => members.find(m => m.uid === uid);
  const activeDoc = docs.find(d => d.id === activeDocId);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;
    onCreate(newDocName.trim(), newDocEmoji);
    setNewDocName(''); setShowNewDoc(false);
  };

  // ── Doc editor view ──
  if (activeDoc) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => setActiveDocId(null)}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
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
        {(activeDoc.createdBy === currentUser.uid || isLeader) && (
          <button onClick={() => { onDelete(activeDoc.id); setActiveDocId(null); }}
            className="p-2 text-gray-300 hover:text-[#A32D2D]">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Rich editor card */}
      <div className="flex-1 flex flex-col bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl shadow-sm overflow-hidden">
        <RichEditor
          initialContent={activeDoc.content}
          onChange={html => onUpdate(activeDoc.id, html)}
        />
      </div>
    </motion.div>
  );

  // ── Doc list view ──
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Documents</h2>
        <button onClick={() => setShowNewDoc(true)}
          className="flex items-center gap-1.5 bg-[#534AB7] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#453d9c]">
          <Plus size={14} /> New Doc
        </button>
      </div>

      {showNewDoc && (
        <form onSubmit={handleCreate}
          className="bg-white border border-[rgba(0,0,0,0.08)] p-4 rounded-xl mb-6 flex items-center gap-3">
          <select value={newDocEmoji} onChange={e => setNewDocEmoji(e.target.value)}
            className="text-2xl bg-gray-50 border-none rounded-lg p-2 outline-none">
            {DOC_EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
          </select>
          <input value={newDocName} onChange={e => setNewDocName(e.target.value)}
            placeholder="Document name…" autoFocus
            className="flex-1 px-3 py-2 text-sm outline-none border border-[rgba(0,0,0,0.08)] rounded-lg" />
          <button type="submit"
            className="bg-[#534AB7] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#453d9c]">Create</button>
          <button type="button" onClick={() => setShowNewDoc(false)}
            className="p-2 text-gray-400 hover:text-gray-700"><X size={16} /></button>
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
              // Strip HTML tags for the preview snippet
              <p className="text-xs text-gray-400 mb-4 line-clamp-2">
                {d.content.replace(/<[^>]+>/g, ' ').slice(0, 120)}
              </p>
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