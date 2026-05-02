import React from 'react';
import { motion } from 'motion/react';
import { 
  CheckSquare, 
  Check, 
  FileText, 
  Users, 
  Calendar, 
  MessageSquare 
} from 'lucide-react';
import { 
  Team, 
  UserProfile, 
  TeamMember, 
  Task, 
  Message, 
  Doc, 
  Meeting 
} from '../../types';
import { TAG_STYLES } from '../../constants';
import { formatRelative } from '../../utils/helpers';
import { Avatar } from '../ui/Avatar';

interface HomePanelProps {
  team: Team | null;
  profile: UserProfile;
  members: TeamMember[];
  tasks: Task[];
  messages: Message[];
  docs: Doc[];
  meetings: Meeting[];
  isLeader: boolean;        // ← add this
  onTabChange: (tab: 'tasks' | 'chat' | 'docs' | 'meetings' | 'team') => void;
}

export function HomePanel({ 
  team, 
  profile, 
  members, 
  tasks, 
  messages, 
  docs, 
  meetings,
  isLeader,                 // ← add this
  onTabChange 
}: HomePanelProps) {
  const completedTasks = tasks.filter(t => t.completed).length;
  const openTasks = tasks.filter(t => !t.completed).length;
  
  const recentMessages = [...messages]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 3);
    
  const upcomingMeetings = meetings
    .filter(m => new Date(`${m.date}T${m.time}`).getTime() > Date.now())
    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime())
    .slice(0, 2);
    
  const myTasks = tasks.filter(t => t.assignedTo === profile.uid && !t.completed);

  const statCards = [
    { label: 'Open Tasks', value: openTasks, icon: <CheckSquare size={16} />, color: 'text-[#534AB7]', bg: 'bg-[#F8F7FF]', tab: 'tasks' as const },
    { label: 'Completed', value: completedTasks, icon: <Check size={16} />, color: 'text-[#1D9E75]', bg: 'bg-[#F0FDF9]', tab: 'tasks' as const },
    { label: 'Docs', value: docs.length, icon: <FileText size={16} />, color: 'text-[#2563EB]', bg: 'bg-blue-50', tab: 'docs' as const },
    { label: 'Members', value: members.length, icon: <Users size={16} />, color: 'text-[#854F0B]', bg: 'bg-[#FAEEDA]', tab: 'team' as const },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }} 
      className="max-w-4xl mx-auto space-y-8"
    >
      {/* Team hero card */}
      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] p-8 shadow-sm">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center text-3xl shrink-0">🏢</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 truncate">{team?.name ?? 'No Team'}</h1>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider
                ${isLeader ? 'bg-[#534AB7] text-white' : 'bg-gray-100 text-gray-500'}`}>
                {isLeader ? 'leader' : 'member'}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">Your active workspace</p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {members.slice(0, 6).map(m => (
                <div key={m.uid} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-2.5 py-1 border border-[rgba(0,0,0,0.06)]">
                  <Avatar initials={m.initials} color={m.color} size="sm" />
                  <span className="text-xs text-gray-600 font-medium">{m.displayName}</span>
                  {m.uid === team?.leaderId && <span className="text-[9px] text-[#534AB7] font-bold">★</span>}
                </div>
              ))}
              {members.length > 6 && (
                <button onClick={() => onTabChange('team')} className="text-xs text-[#534AB7] font-medium hover:underline">
                  +{members.length - 6} more
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(s => (
          <button 
            key={s.label} 
            onClick={() => onTabChange(s.tab)}
            className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] p-5 text-left hover:border-[#534AB7]/30 hover:shadow-sm transition-all group"
          >
            <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3 ${s.color} group-hover:scale-110 transition-transform`}>
              {s.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* My Tasks */}
        <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <CheckSquare size={15} className="text-[#534AB7]" /> Assigned to me
            </h3>
            <button onClick={() => onTabChange('tasks')} className="text-xs text-[#534AB7] hover:underline">View all</button>
          </div>
          {myTasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No tasks assigned to you 🎉</p>
          ) : (
            <div className="space-y-2">
              {myTasks.slice(0, 4).map(t => (
                <div key={t.id} className="flex items-center gap-3 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#534AB7] shrink-0" />
                  <span className="text-sm text-gray-700 flex-1 truncate">{t.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${TAG_STYLES[t.tag]}`}>
                    {t.tag}
                  </span>
                </div>
              ))}
              {myTasks.length > 4 && <p className="text-xs text-gray-400 pt-1">+{myTasks.length - 4} more</p>}
            </div>
          )}
        </div>

        {/* Upcoming meetings */}
        <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Calendar size={15} className="text-[#1D9E75]" /> Upcoming
            </h3>
            <button onClick={() => onTabChange('meetings')} className="text-xs text-[#534AB7] hover:underline">View all</button>
          </div>
          {upcomingMeetings.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No upcoming meetings</p>
          ) : (
            <div className="space-y-3">
              {upcomingMeetings.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-white border border-[rgba(0,0,0,0.08)] rounded-xl flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-gray-400 uppercase">{m.date.slice(5)}</span>
                    <span className="text-xs font-bold text-gray-700">{m.time}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                    <p className="text-[10px] text-gray-400">{m.rsvps.length} attending</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent chat */}
        <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] p-6 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare size={15} className="text-[#2563EB]" /> Recent Chat
            </h3>
            <button onClick={() => onTabChange('chat')} className="text-xs text-[#534AB7] hover:underline">Open chat</button>
          </div>
          {recentMessages.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No messages yet — start the conversation!</p>
          ) : (
            <div className="space-y-3">
              {recentMessages.map(msg => (
                <div key={msg.id} className="flex items-start gap-3">
                  <Avatar initials={msg.senderInitials} color={msg.senderColor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-gray-700">{msg.senderName}</span>
                      <span className="text-[9px] text-gray-400">{formatRelative(msg.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}