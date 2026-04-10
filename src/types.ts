export type User = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

export type TaskTag = 'design' | 'dev' | 'pm' | 'bug';

export type Task = {
  id: string;
  title: string;
  completed: boolean;
  tag: TaskTag;
  editingBy?: string; // initials
};

export type Message = {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
};

export type Doc = {
  id: string;
  name: string;
  emoji: string;
  updatedAt: string;
  content: string;
  editors: string[]; // initials
};

export type Meeting = {
  id: string;
  title: string;
  description: string;
  time: string;
  date: string;
  attendees: string[]; // initials
  type: 'join' | 'rsvp';
};

export type NodeStatus = 'alive' | 'dead';

export type AppState = {
  isOffline: boolean;
  queuedChanges: number;
  syncStatus: 'synced' | 'syncing' | 'offline';
  nodes: {
    A: NodeStatus;
    B: NodeStatus;
    C: NodeStatus;
  };
};
