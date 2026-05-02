import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Task, TeamMember, UserProfile, TaskTag } from '../../types';
import { TAG_STYLES } from '../../constants';
import { Avatar } from '../ui/Avatar';
import { formatRelative } from '../../utils/helpers';

interface TasksPanelProps {
  tasks: Task[];
  members: TeamMember[];
  currentUser: UserProfile;
  isLeader: boolean;        // ← add this
  onToggle: (task: Task) => void;
  onAdd: (title: string, tag: TaskTag, assignedTo: string | null) => void;
  onDelete: (id: string) => void;
  onAssign: (taskId: string, assignedTo: string | null) => void;
}

export function TasksPanel({ tasks, members, currentUser, isLeader, onToggle, onAdd, onDelete, onAssign }: TasksPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [selectedTag, setSelectedTag] = useState<TaskTag>('dev');
  const [assignedTo, setAssignedTo] = useState('');
  const [filterTag, setFilterTag] = useState<TaskTag | 'all'>('all');
  const [filterAssignee, setFilterAssignee] = useState('all');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onAdd(inputValue.trim(), selectedTag, assignedTo || null);
    setInputValue(''); setAssignedTo('');
  };

  const getMember = (uid: string) => members.find(m => m.uid === uid);

  const filtered = tasks.filter(t => {
    if (filterTag !== 'all' && t.tag !== filterTag) return false;
    if (filterAssignee !== 'all') {
      if (filterAssignee === 'unassigned' && t.assignedTo !== null) return false;
      if (filterAssignee !== 'unassigned' && t.assignedTo !== filterAssignee) return false;
    }
    return true;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <span className="text-sm text-gray-400">{tasks.filter(t => !t.completed).length} remaining</span>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={filterTag} onChange={e => setFilterTag(e.target.value as TaskTag | 'all')}
          className="text-xs font-bold bg-white border border-[rgba(0,0,0,0.1)] rounded-lg px-3 py-1.5 outline-none">
          <option value="all">All tags</option>
          <option value="design">Design</option>
          <option value="dev">Dev</option>
          <option value="pm">PM</option>
          <option value="bug">Bug</option>
        </select>
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
          className="text-xs font-bold bg-white border border-[rgba(0,0,0,0.1)] rounded-lg px-3 py-1.5 outline-none">
          <option value="all">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {members.map(m => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
        </select>
      </div>

      <div className="space-y-3 mb-8">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No tasks match your filters.</div>
        )}
        {[...filtered.filter(t => !t.completed), ...filtered.filter(t => t.completed)].map(task => {
          const creator = getMember(task.createdBy);
          const assignee = task.assignedTo ? getMember(task.assignedTo) : null;
          return (
            <div key={task.id} className="bg-white border border-[rgba(0,0,0,0.08)] p-4 rounded-xl flex items-center gap-4 group hover:border-[rgba(0,0,0,0.15)] transition-all">
              <input type="checkbox" checked={task.completed} onChange={() => onToggle(task)}
                className="w-5 h-5 rounded border-gray-300 text-[#534AB7] focus:ring-[#534AB7] shrink-0 cursor-pointer" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{task.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${TAG_STYLES[task.tag]}`}>{task.tag}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {creator && (
                    <div className="flex items-center gap-1.5">
                      <Avatar initials={creator.initials} color={creator.color} size="sm" />
                      <span className="text-[10px] text-gray-400">{creator.displayName} · {formatRelative(task.createdAt)}</span>
                    </div>
                  )}
                  {assignee && (
                    <div className="flex items-center gap-1 text-[10px] text-[#534AB7] font-medium">
                      <span>→</span>
                      <Avatar initials={assignee.initials} color={assignee.color} size="sm" />
                      <span>{assignee.displayName}</span>
                    </div>
                  )}
                </div>
              </div>
              {(isLeader || task.createdBy === currentUser.uid) && members.length > 0 && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <select value={task.assignedTo || ''} onChange={e => onAssign(task.id, e.target.value || null)}
                    className="text-[10px] bg-gray-50 border border-[rgba(0,0,0,0.1)] rounded px-2 py-1 outline-none cursor-pointer max-w-[100px]">
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
                  </select>
                </div>
              )}
              {(task.createdBy === currentUser.uid || isLeader) && (
                <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-[#A32D2D] transition-all shrink-0">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-[rgba(0,0,0,0.08)] p-2 rounded-xl flex items-center gap-2 flex-wrap">
        <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)}
          placeholder="Add a new task…" className="flex-1 min-w-[180px] px-3 py-2 text-sm outline-none" />
        <select value={selectedTag} onChange={e => setSelectedTag(e.target.value as TaskTag)}
          className="text-xs font-bold uppercase bg-gray-50 border-none rounded px-2 py-1 outline-none">
          <option value="design">Design</option>
          <option value="dev">Dev</option>
          <option value="pm">PM</option>
          <option value="bug">Bug</option>
        </select>
        {members.length > 0 && (
          <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
            className="text-xs bg-gray-50 border-none rounded px-2 py-1 outline-none">
            <option value="">Unassigned</option>
            {members.map(m => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
          </select>
        )}
        <button type="submit" className="bg-[#534AB7] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#453d9c] flex items-center gap-1">
          <Plus size={14} /> Add
        </button>
      </form>
    </motion.div>
  );
}