export type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  initials: string;
  color: string;
  role: 'leader' | 'member' | 'pending';
  teamId: string | null;
  createdAt?: number;
};

export type TaskTag = 'design' | 'dev' | 'pm' | 'bug';

export type Task = {
  id: string;
  title: string;
  completed: boolean;
  tag: TaskTag;
  assignedTo: string | null; // uid
  createdBy: string; // uid
  teamId: string;
  createdAt: number;
  updatedAt: number;
};

export type Message = {
  id: string;
  senderId: string; // uid
  senderName: string;
  senderInitials: string;
  senderColor: string;
  text: string;
  teamId: string;
  timestamp: number;
};

export type Doc = {
  id: string;
  name: string;
  emoji: string;
  content: string;
  teamId: string;
  createdBy: string; // uid
  editors: string[]; // uids
  updatedAt: number;
  createdAt: number;
};

export type Meeting = {
  id: string;
  title: string;
  description: string;
  time: string;
  date: string;
  teamId: string;
  createdBy: string; // uid
  attendees: string[]; // uids
  rsvps: string[]; // uids who confirmed
  createdAt: number;
};

export type TeamMember = UserProfile;

export type Team = {
  id: string;
  name: string;
  joinCode: string;
  leaderId: string;
  createdAt: number;
};

export type JoinRequest = {
  id: string;
  userId: string;
  teamId: string;
  userName: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
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