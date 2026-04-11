import React, { useState } from 'react';
import { Plus, Check, Clock, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Meeting, TeamMember, UserProfile } from '../../types';
import { Avatar } from '../ui/Avatar';

interface MeetingsPanelProps {
  meetings: Meeting[];
  members: TeamMember[];
  currentUser: UserProfile;
  onCreate: (data: { title: string; description: string; time: string; date: string }) => void;
  onRsvp: (meeting: Meeting) => void;
  onDelete: (id: string) => void;
}

export function MeetingsPanel({ meetings, members, currentUser, onCreate, onRsvp, onDelete }: MeetingsPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', time: '', date: '' });

  const getMember = (uid: string) => members.find(m => m.uid === uid);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.time || !form.date) return;
    onCreate(form);
    setForm({ title: '', description: '', time: '', date: '' });
    setShowForm(false);
  };

  const sorted = [...meetings].sort((a, b) =>
    new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Meetings</h2>
        <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1.5 bg-[#534AB7] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#453d9c]">
          <Plus size={14} /> Schedule
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-[rgba(0,0,0,0.08)] p-6 rounded-2xl mb-6 space-y-4">
          <h3 className="font-bold text-gray-800">New Meeting</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="meeting-title" className="block text-xs font-bold text-gray-400 uppercase mb-1">Title</label>
              <input id="meeting-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Weekly Standup"
                className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] text-sm" />
            </div>
            <div className="col-span-2">
              <label htmlFor="meeting-desc" className="block text-xs font-bold text-gray-400 uppercase mb-1">Description</label>
              <input id="meeting-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What's this about?"
                className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] text-sm" />
            </div>
            <div>
              <label htmlFor="meeting-date" className="block text-xs font-bold text-gray-400 uppercase mb-1">Date</label>
              <input id="meeting-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required
                className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] text-sm" />
            </div>
            <div>
              <label htmlFor="meeting-time" className="block text-xs font-bold text-gray-400 uppercase mb-1">Time</label>
              <input id="meeting-time" type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} required
                className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-[#534AB7] text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-[#453d9c]">Schedule</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">Cancel</button>
          </div>
        </form>
      )}

      {meetings.length === 0 && !showForm && (
        <div className="text-center py-16 text-gray-400 text-sm">No meetings scheduled. Create one!</div>
      )}

      <div className="space-y-4">
        {sorted.map(meeting => {
          const hasRsvp = meeting.rsvps.includes(currentUser.uid);
          const creator = getMember(meeting.createdBy);
          const isPast = new Date(`${meeting.date}T${meeting.time}`).getTime() < Date.now();
          return (
            <div key={meeting.id} className={`bg-white border rounded-2xl overflow-hidden flex ${isPast ? 'opacity-60 border-[rgba(0,0,0,0.05)]' : 'border-[rgba(0,0,0,0.08)]'}`}>
              <div className="w-28 bg-gray-50 flex flex-col items-center justify-center border-r border-[rgba(0,0,0,0.05)] p-4 shrink-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">{meeting.date}</span>
                <span className="text-sm font-bold text-gray-900 mt-1">{meeting.time}</span>
                {isPast && <span className="text-[9px] text-gray-400 mt-1 uppercase font-bold">Past</span>}
              </div>
              <div className="flex-1 p-5 flex items-center gap-6">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 mb-0.5">{meeting.title}</h3>
                  {meeting.description && <p className="text-sm text-gray-500 mb-3">{meeting.description}</p>}
                  <div className="flex items-center gap-3">
                    {creator && <span className="text-[10px] text-gray-400">by {creator.displayName}</span>}
                    <div className="flex -space-x-2">
                      {meeting.rsvps.slice(0, 5).map(uid => {
                        const m = getMember(uid);
                        return m ? <Avatar key={uid} initials={m.initials} color={m.color} size="sm" /> : null;
                      })}
                    </div>
                    {meeting.rsvps.length > 0 && <span className="text-xs text-gray-400">{meeting.rsvps.length} attending</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isPast && (
                    <button onClick={() => onRsvp(meeting)}
                      className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 ${hasRsvp ? 'bg-[#1D9E75] text-white hover:bg-[#168361]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {hasRsvp ? <><Check size={14} /> Attending</> : <><Clock size={14} /> RSVP</>}
                    </button>
                  )}
                  {(meeting.createdBy === currentUser.uid || currentUser.role === 'leader') && (
                    <button onClick={() => onDelete(meeting.id)} className="p-2 text-gray-300 hover:text-[#A32D2D]">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}