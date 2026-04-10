import { User, Task, Message, Doc, Meeting } from './types';

export const COLORS = {
  primary: '#534AB7',
  success: '#1D9E75',
  warning: '#854F0B',
  warningBg: '#FAEEDA',
  danger: '#A32D2D',
  gray: '#F3F4F6',
  border: 'rgba(0,0,0,0.1)',
};

export const USERS: User[] = [
  { id: 'alice', name: 'Alice', initials: 'AL', color: '#534AB7' },
  { id: 'ben', name: 'Ben', initials: 'BN', color: '#1D9E75' },
  { id: 'cara', name: 'Cara', initials: 'CR', color: '#854F0B' },
];

export const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Refactor sync engine', completed: false, tag: 'dev' },
  { id: '2', title: 'Design system audit', completed: true, tag: 'design' },
  { id: '3', title: 'Fix node heartbeat bug', completed: false, tag: 'bug' },
  { id: '4', title: 'Prepare Q3 roadmap', completed: false, tag: 'pm' },
];

export const INITIAL_MESSAGES: Message[] = [
  { id: '1', senderId: 'ben', text: 'Hey team, how is the sync logic coming along?', timestamp: Date.now() - 3600000 },
  { id: '2', senderId: 'cara', text: 'Almost done, just testing the conflict resolution.', timestamp: Date.now() - 3000000 },
];

export const INITIAL_DOCS: Doc[] = [
  { id: '1', name: 'Architecture Specs', emoji: '🏗️', updatedAt: '2h ago', content: 'Distributed systems overview...', editors: ['AL', 'BN'] },
  { id: '2', name: 'Team Handbook', emoji: '📖', updatedAt: '5h ago', content: 'Welcome to Sculptors!', editors: ['CR'] },
  { id: '3', name: 'Sync Protocol', emoji: '📡', updatedAt: '1d ago', content: 'LWW (Last Write Wins) strategy...', editors: ['AL'] },
];

export const INITIAL_MEETINGS: Meeting[] = [
  { id: '1', title: 'Daily Standup', description: 'Quick sync on blockers', time: '09:00 AM', date: 'Today', attendees: ['AL', 'BN', 'CR'], type: 'join' },
  { id: '2', title: 'Design Review', description: 'Reviewing the new dashboard', time: '02:00 PM', date: 'Today', attendees: ['AL', 'CR'], type: 'rsvp' },
  { id: '3', title: 'Backend Sync', description: 'Node replication strategy', time: '11:00 AM', date: 'Tomorrow', attendees: ['BN', 'CR'], type: 'rsvp' },
  { id: '4', title: 'Product Demo', description: 'Showcasing Sculptors to stakeholders', time: '04:00 PM', date: 'Friday', attendees: ['AL', 'BN', 'CR'], type: 'rsvp' },
];
