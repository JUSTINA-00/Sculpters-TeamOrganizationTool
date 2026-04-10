import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckSquare, MessageSquare, FileText, Calendar,
  Plus, Send, ArrowLeft, LogOut, Users, Key,
  ShieldCheck, AlertCircle, Loader2, Trash2, X,
  Check, UserCheck, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserProfile, Task, Message, Doc, Meeting, Team,
  JoinRequest, AppState, NodeStatus, TaskTag, TeamMember
} from './types';
import { AVATAR_COLORS, TAG_STYLES, DOC_EMOJIS } from './constants';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, onSnapshot, collection, query,
  where, addDoc, updateDoc, deleteDoc, serverTimestamp,
  getDocs, orderBy, Timestamp
} from 'firebase/firestore';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function pickColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ─── Shared UI Components ────────────────────────────────────────────────────

const Avatar = ({ initials, color, size = 'md' }: { initials: string; color: string; size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = { sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-xs', lg: 'w-10 h-10 text-sm' };
  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}
      style={{ backgroundColor: color }}>
      {initials}
    </div>
  );
};

const Badge = ({ count }: { count: number }) => {
  if (count === 0) return null;
  return <span className="ml-auto bg-[#534AB7] text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{count}</span>;
};

const SyncIndicator = ({ status }: { status: AppState['syncStatus'] }) => {
  if (status === 'syncing') return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#FAEEDA] text-[#854F0B] text-xs font-medium">
      <span className="animate-spin">◌</span> syncing
    </div>
  );
  if (status === 'offline') return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#FEE2E2] text-[#A32D2D] text-xs font-medium">
      <span>●</span> offline
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#D1FAE5] text-[#1D9E75] text-xs font-medium">
      <span>●</span> synced
    </div>
  );
};

const NodeItem = ({ label, type, status }: { label: string; type: string; status: NodeStatus }) => (
  <div className="flex items-center gap-2">
    <div className={`w-2 h-2 rounded-full ${status === 'alive' ? 'bg-[#1D9E75]' : 'bg-[#A32D2D]'}`} />
    <span className="text-xs font-medium text-gray-700">{label}</span>
    <span className="text-[9px] text-gray-400 ml-auto uppercase tracking-tighter">{type}</span>
  </div>
);

const NavItem = ({ active, onClick, icon, label, badge }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number;
}) => (
  <button onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${active ? 'bg-[#F3F4F6] text-[#534AB7]' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
    <span className={active ? 'text-[#534AB7]' : 'text-gray-400'}>{icon}</span>
    {label}
    {badge !== undefined && <Badge count={badge} />}
  </button>
);

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'tasks' | 'chat' | 'docs' | 'meetings' | 'team'>('tasks');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const [appState, setAppState] = useState<AppState>({
    isOffline: false, queuedChanges: 0, syncStatus: 'synced',
    nodes: { A: 'alive', B: 'alive', C: 'dead' },
  });
  const [conflictToast, setConflictToast] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const lastSeenMessage = useRef<number>(Date.now());

  // ── Auth listener ────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) { setProfile(null); setTeam(null); setLoading(false); return; }
      const snap = await getDoc(doc(db, 'users', fbUser.uid));
      if (snap.exists()) setProfile(snap.data() as UserProfile);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Profile listener ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    });
    return unsub;
  }, [firebaseUser]);

  // ── Team listener ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile?.teamId) { setTeam(null); setMembers([]); return; }
    const unsub = onSnapshot(doc(db, 'teams', profile.teamId), (snap) => {
      if (snap.exists()) setTeam(snap.data() as Team);
    });
    return unsub;
  }, [profile?.teamId]);

  // ── Members listener ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile?.teamId) return;
    const q = query(collection(db, 'users'), where('teamId', '==', profile.teamId));
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map(d => d.data() as TeamMember));
    });
    return unsub;
  }, [profile?.teamId]);

  // ── Tasks listener ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile?.teamId) return;
    const q = query(
      collection(db, 'tasks'),
      where('teamId', '==', profile.teamId),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    });
    return unsub;
  }, [profile?.teamId]);

  // ── Messages listener ────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile?.teamId) return;
    const q = query(
      collection(db, 'messages'),
      where('teamId', '==', profile.teamId),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      if (activeTab !== 'chat') {
        const newCount = msgs.filter(m => m.timestamp > lastSeenMessage.current && m.senderId !== firebaseUser?.uid).length;
        setUnreadMessages(newCount);
      }
    });
    return unsub;
  }, [profile?.teamId, activeTab]);

  // ── Docs listener ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile?.teamId) return;
    const q = query(
      collection(db, 'docs'),
      where('teamId', '==', profile.teamId),
      orderBy('updatedAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Doc)));
    });
    return unsub;
  }, [profile?.teamId]);

  // ── Meetings listener ────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile?.teamId) return;
    const q = query(
      collection(db, 'meetings'),
      where('teamId', '==', profile.teamId),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMeetings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Meeting)));
    });
    return unsub;
  }, [profile?.teamId]);

  // Mark messages as read when opening chat
  useEffect(() => {
    if (activeTab === 'chat') {
      lastSeenMessage.current = Date.now();
      setUnreadMessages(0);
    }
  }, [activeTab]);

  // ── Sync helper ──────────────────────────────────────────────────────────

  const triggerSync = useCallback(() => {
    setAppState(prev => ({ ...prev, syncStatus: 'syncing' }));
    setTimeout(() => setAppState(prev => ({ ...prev, syncStatus: 'synced' })), 700);
  }, []);

  // ── Auth handlers ────────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null); setAuthLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await signInWithEmailAndPassword(auth, fd.get('email') as string, fd.get('password') as string);
    } catch (err: any) {
      setAuthError(err.message);
    } finally { setAuthLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null); setAuthLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const password = fd.get('password') as string;
    const name = fd.get('name') as string;
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name });
      const newProfile: UserProfile = {
        uid: user.uid, email, displayName: name,
        initials: getInitials(name),
        color: pickColor(user.uid),
        role: 'pending', teamId: null,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
    } catch (err: any) {
      setAuthError(err.message);
    } finally { setAuthLoading(false); }
  };

  const handleLogout = () => signOut(auth);

  // ── Team handlers ────────────────────────────────────────────────────────

  const handleCreateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firebaseUser || !profile) return;
    const fd = new FormData(e.currentTarget);
    const teamName = fd.get('teamName') as string;
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const teamId = doc(collection(db, 'teams')).id;
    try {
      const teamData: Team = { id: teamId, name: teamName, joinCode, leaderId: firebaseUser.uid, createdAt: Date.now() };
      await setDoc(doc(db, 'teams', teamId), teamData);
      await updateDoc(doc(db, 'users', firebaseUser.uid), { teamId, role: 'leader' });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'teams'); }
  };

  const handleJoinTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firebaseUser || !profile) return;
    const fd = new FormData(e.currentTarget);
    const code = (fd.get('joinCode') as string).toUpperCase();
    try {
      const q = query(collection(db, 'teams'), where('joinCode', '==', code));
      const snap = await getDocs(q);
      if (snap.empty) { alert('Invalid join code. Please check and try again.'); return; }
      const foundTeam = snap.docs[0].data() as Team;
      await addDoc(collection(db, 'joinRequests'), {
        userId: firebaseUser.uid, teamId: foundTeam.id,
        userName: profile.displayName, userEmail: profile.email,
        status: 'pending', createdAt: Date.now(),
      });
      alert('Join request sent! Wait for the team leader to approve.');
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'joinRequests'); }
  };

  const handleApproveRequest = async (requestId: string, userId: string) => {
    if (!profile?.teamId) return;
    try {
      await updateDoc(doc(db, 'joinRequests', requestId), { status: 'approved' });
      await updateDoc(doc(db, 'users', userId), { teamId: profile.teamId, role: 'member' });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, `joinRequests/${requestId}`); }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'joinRequests', requestId), { status: 'rejected' });
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, `joinRequests/${requestId}`); }
  };

  // ── Task handlers ────────────────────────────────────────────────────────

  const handleAddTask = async (title: string, tag: TaskTag) => {
    if (!profile?.teamId || !firebaseUser) return;
    const now = Date.now();
    try {
      await addDoc(collection(db, 'tasks'), {
        title, tag, completed: false,
        assignedTo: null, createdBy: firebaseUser.uid,
        teamId: profile.teamId, createdAt: now, updatedAt: now,
      });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'tasks'); }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), { completed: !task.completed, updatedAt: Date.now() });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`); }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`); }
  };

  // ── Message handlers ─────────────────────────────────────────────────────

  const handleSendMessage = async (text: string) => {
    if (!profile?.teamId || !firebaseUser || !profile) return;
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: firebaseUser.uid, senderName: profile.displayName,
        senderInitials: profile.initials, senderColor: profile.color,
        text, teamId: profile.teamId, timestamp: Date.now(),
      });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'messages'); }
  };

  // ── Doc handlers ─────────────────────────────────────────────────────────

  const handleCreateDoc = async (name: string, emoji: string) => {
    if (!profile?.teamId || !firebaseUser) return;
    const now = Date.now();
    try {
      await addDoc(collection(db, 'docs'), {
        name, emoji, content: '', teamId: profile.teamId,
        createdBy: firebaseUser.uid, editors: [firebaseUser.uid],
        createdAt: now, updatedAt: now,
      });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'docs'); }
  };

  const handleUpdateDoc = async (docId: string, content: string) => {
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, 'docs', docId), {
        content, updatedAt: Date.now(),
        editors: Array.from(new Set([...(docs.find(d => d.id === docId)?.editors || []), firebaseUser.uid])),
      });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, `docs/${docId}`); }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'docs', docId));
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.DELETE, `docs/${docId}`); }
  };

  // ── Meeting handlers ─────────────────────────────────────────────────────

  const handleCreateMeeting = async (data: { title: string; description: string; time: string; date: string }) => {
    if (!profile?.teamId || !firebaseUser) return;
    try {
      await addDoc(collection(db, 'meetings'), {
        ...data, teamId: profile.teamId, createdBy: firebaseUser.uid,
        attendees: [firebaseUser.uid], rsvps: [], createdAt: Date.now(),
      });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'meetings'); }
  };

  const handleRsvpMeeting = async (meeting: Meeting) => {
    if (!firebaseUser) return;
    const alreadyRsvp = meeting.rsvps.includes(firebaseUser.uid);
    const updatedRsvps = alreadyRsvp
      ? meeting.rsvps.filter(id => id !== firebaseUser.uid)
      : [...meeting.rsvps, firebaseUser.uid];
    try {
      await updateDoc(doc(db, 'meetings', meeting.id), { rsvps: updatedRsvps });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, `meetings/${meeting.id}`); }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      await deleteDoc(doc(db, 'meetings', meetingId));
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.DELETE, `meetings/${meetingId}`); }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAFB]">
      <Loader2 className="animate-spin text-[#534AB7]" size={32} />
    </div>
  );

  if (!firebaseUser || !profile) return (
    <AuthScreen
      mode={authMode} onLogin={handleLogin} onSignup={handleSignup}
      onToggleMode={() => setAuthMode(m => m === 'login' ? 'signup' : 'login')}
      error={authError} loading={authLoading}
    />
  );

  const incompleteCount = tasks.filter(t => !t.completed).length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F9FAFB]">
      {/* Header */}
      <header className="h-14 bg-white border-b border-[rgba(0,0,0,0.08)] flex items-center px-6 shrink-0 z-20">
        <div className="flex items-center gap-2 mr-8">
          <div className="w-8 h-8 bg-[#534AB7] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <span className="font-bold text-lg tracking-tight">Sculptors</span>
          {team && <span className="ml-2 text-xs text-gray-400 font-medium">/ {team.name}</span>}
        </div>

        <div className="flex items-center gap-2">
          {members.slice(0, 5).map(m => (
            <Avatar key={m.uid} initials={m.initials} color={m.color} size="sm" />
          ))}
          {members.length > 5 && (
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-500">
              +{members.length - 5}
            </div>
          )}
          <div className="ml-4"><SyncIndicator status={appState.syncStatus} /></div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Avatar initials={profile.initials} color={profile.color} size="sm" />
            <span className="text-sm font-medium text-gray-700">{profile.displayName}</span>
          </div>
          <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-[#A32D2D] transition-colors" title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[220px] bg-white border-r border-[rgba(0,0,0,0.08)] flex flex-col shrink-0">
          <nav className="p-4 space-y-1">
            <NavItem active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<CheckSquare size={18} />} label="Tasks" badge={incompleteCount} />
            <NavItem active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare size={18} />} label="Team Chat" badge={unreadMessages} />
            <NavItem active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} icon={<FileText size={18} />} label="Docs" />
            <NavItem active={activeTab === 'meetings'} onClick={() => setActiveTab('meetings')} icon={<Calendar size={18} />} label="Meetings" />
            <NavItem active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon={<Users size={18} />} label="Team" />
          </nav>

          <div className="mt-auto p-4 border-t border-[rgba(0,0,0,0.05)]">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Distributed nodes</h3>
            <div className="space-y-2">
              <NodeItem label="Node A" type="primary" status={appState.nodes.A} />
              <NodeItem label="Node B" type="replica" status={appState.nodes.B} />
              <NodeItem label="Node C" type="replica" status={appState.nodes.C} />
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {!profile.teamId && activeTab !== 'team' && (
            <div className="bg-[#FAEEDA] text-[#854F0B] px-6 py-2 text-sm font-medium flex items-center justify-center gap-2 border-b border-[#F5E1C0]">
              <AlertCircle size={14} />
              You're not in a team yet. Go to <button onClick={() => setActiveTab('team')} className="underline font-bold">Team</button> to create or join one.
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
            <AnimatePresence mode="wait">
              {activeTab === 'tasks' && (
                <TasksPanel key="tasks" tasks={tasks} members={members} currentUser={profile}
                  onToggle={handleToggleTask} onAdd={handleAddTask} onDelete={handleDeleteTask} />
              )}
              {activeTab === 'chat' && (
                <ChatPanel key="chat" messages={messages} currentUser={profile} onSend={handleSendMessage} />
              )}
              {activeTab === 'docs' && (
                <DocsPanel key="docs" docs={docs} members={members} currentUser={profile}
                  onUpdate={handleUpdateDoc} onCreate={handleCreateDoc} onDelete={handleDeleteDoc} />
              )}
              {activeTab === 'meetings' && (
                <MeetingsPanel key="meetings" meetings={meetings} members={members} currentUser={profile}
                  onCreate={handleCreateMeeting} onRsvp={handleRsvpMeeting} onDelete={handleDeleteMeeting} />
              )}
              {activeTab === 'team' && (
                <TeamPanel key="team" profile={profile} team={team} members={members}
                  onCreateTeam={handleCreateTeam} onJoinTeam={handleJoinTeam}
                  onApprove={handleApproveRequest} onReject={handleRejectRequest} />
              )}
            </AnimatePresence>
          </div>

          {/* Conflict Toast */}
          <AnimatePresence>
            {conflictToast && (
              <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#141414] text-white px-4 py-3 rounded-lg text-sm shadow-xl flex items-center gap-3 z-50 min-w-[400px]">
                <div className="w-2 h-2 rounded-full bg-[#A32D2D] animate-pulse" />
                {conflictToast}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// ─── Auth Screen ─────────────────────────────────────────────────────────────

function AuthScreen({ mode, onLogin, onSignup, onToggleMode, error, loading }: {
  mode: 'login' | 'signup';
  onLogin: (e: React.FormEvent<HTMLFormElement>) => void;
  onSignup: (e: React.FormEvent<HTMLFormElement>) => void;
  onToggleMode: () => void;
  error: string | null;
  loading: boolean;
}) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAFB] p-6">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-[#534AB7] rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sculptors</h1>
        </div>
        <h2 className="text-xl font-bold mb-2 text-center">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="text-gray-500 text-sm text-center mb-8">
          {mode === 'login' ? 'Sign in to your distributed office' : 'Join the future of remote collaboration'}
        </p>
        <form onSubmit={mode === 'login' ? onLogin : onSignup} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name</label>
              <input name="name" type="text" required placeholder="Alex Smith"
                className="w-full px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] transition-colors" />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email Address</label>
            <input name="email" type="email" required placeholder="you@example.com"
              className="w-full px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
            <input name="password" type="password" required placeholder="••••••••" minLength={6}
              className="w-full px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] transition-colors" />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-[#A32D2D] text-xs bg-red-50 p-3 rounded-lg">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full bg-[#534AB7] text-white py-3 rounded-xl font-bold hover:bg-[#453d9c] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <button onClick={onToggleMode} className="text-sm text-[#534AB7] font-medium hover:underline">
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Tasks Panel ─────────────────────────────────────────────────────────────

function TasksPanel({ tasks, members, currentUser, onToggle, onAdd, onDelete }: {
  tasks: Task[]; members: TeamMember[]; currentUser: UserProfile;
  onToggle: (task: Task) => void; onAdd: (title: string, tag: TaskTag) => void;
  onDelete: (id: string) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const [selectedTag, setSelectedTag] = useState<TaskTag>('dev');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onAdd(inputValue.trim(), selectedTag);
    setInputValue('');
  };

  const getMember = (uid: string) => members.find(m => m.uid === uid);

  const incomplete = tasks.filter(t => !t.completed);
  const complete = tasks.filter(t => t.completed);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <span className="text-sm text-gray-400">{incomplete.length} remaining</span>
      </div>

      <div className="space-y-3 mb-8">
        {tasks.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No tasks yet. Add one below!</div>
        )}
        {[...incomplete, ...complete].map(task => {
          const creator = getMember(task.createdBy);
          return (
            <div key={task.id}
              className="bg-white border border-[rgba(0,0,0,0.08)] p-4 rounded-xl flex items-center gap-4 group transition-all hover:border-[rgba(0,0,0,0.15)]">
              <input type="checkbox" checked={task.completed} onChange={() => onToggle(task)}
                className="w-5 h-5 rounded border-gray-300 text-[#534AB7] focus:ring-[#534AB7] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {task.title}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${TAG_STYLES[task.tag]}`}>
                    {task.tag}
                  </span>
                </div>
                {creator && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Avatar initials={creator.initials} color={creator.color} size="sm" />
                    <span className="text-[10px] text-gray-400">{creator.displayName} · {formatRelative(task.createdAt)}</span>
                  </div>
                )}
              </div>
              {(task.createdBy === currentUser.uid || currentUser.role === 'leader') && (
                <button onClick={() => onDelete(task.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-[#A32D2D] transition-all shrink-0">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-[rgba(0,0,0,0.08)] p-2 rounded-xl flex items-center gap-2">
        <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)}
          placeholder="Add a new task..." className="flex-1 px-3 py-2 text-sm outline-none" />
        <select value={selectedTag} onChange={e => setSelectedTag(e.target.value as TaskTag)}
          className="text-xs font-bold uppercase bg-gray-50 border-none rounded px-2 py-1 outline-none">
          <option value="design">Design</option>
          <option value="dev">Dev</option>
          <option value="pm">PM</option>
          <option value="bug">Bug</option>
        </select>
        <button type="submit" className="bg-[#534AB7] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#453d9c] transition-colors flex items-center gap-1">
          <Plus size={14} /> Add
        </button>
      </form>
    </motion.div>
  );
}

// ─── Chat Panel ──────────────────────────────────────────────────────────────

function ChatPanel({ messages, currentUser, onSend }: {
  messages: Message[]; currentUser: UserProfile; onSend: (text: string) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSend(inputValue.trim());
    setInputValue('');
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
        <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)}
          placeholder="Type a message..." className="flex-1 px-3 py-2 text-sm outline-none" />
        <button type="submit" className="bg-[#534AB7] text-white p-2 rounded-lg hover:bg-[#453d9c] transition-colors">
          <Send size={18} />
        </button>
      </form>
    </motion.div>
  );
}

// ─── Docs Panel ──────────────────────────────────────────────────────────────

function DocsPanel({ docs, members, currentUser, onUpdate, onCreate, onDelete }: {
  docs: Doc[]; members: TeamMember[]; currentUser: UserProfile;
  onUpdate: (id: string, content: string) => void;
  onCreate: (name: string, emoji: string) => void;
  onDelete: (id: string) => void;
}) {
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [localContent, setLocalContent] = useState('');
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocEmoji, setNewDocEmoji] = useState(DOC_EMOJIS[0]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeDoc = docs.find(d => d.id === activeDocId);

  useEffect(() => {
    if (activeDoc) setLocalContent(activeDoc.content);
  }, [activeDocId]);

  const handleContentChange = (val: string) => {
    setLocalContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (activeDocId) onUpdate(activeDocId, val);
    }, 800);
  };

  const getMember = (uid: string) => members.find(m => m.uid === uid);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;
    onCreate(newDocName.trim(), newDocEmoji);
    setNewDocName(''); setNewDocEmoji(DOC_EMOJIS[0]); setShowNewDoc(false);
  };

  if (activeDoc) {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
        className="max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setActiveDocId(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{activeDoc.emoji}</span>
              <h2 className="text-2xl font-bold">{activeDoc.name}</h2>
            </div>
            <p className="text-xs text-gray-500">Last updated {formatRelative(activeDoc.updatedAt)}</p>
          </div>
          <div className="flex -space-x-2">
            {activeDoc.editors.slice(0, 4).map(uid => {
              const m = getMember(uid);
              return m ? <Avatar key={uid} initials={m.initials} color={m.color} size="sm" /> : null;
            })}
          </div>
          {(activeDoc.createdBy === currentUser.uid || currentUser.role === 'leader') && (
            <button onClick={() => { onDelete(activeDoc.id); setActiveDocId(null); }}
              className="p-2 text-gray-300 hover:text-[#A32D2D] transition-colors"><Trash2 size={16} /></button>
          )}
        </div>
        <textarea value={localContent} onChange={e => handleContentChange(e.target.value)}
          className="flex-1 bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl p-8 outline-none resize-none font-sans leading-relaxed text-gray-800 shadow-sm"
          placeholder="Start writing..." />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Documents</h2>
        <button onClick={() => setShowNewDoc(true)}
          className="flex items-center gap-1.5 bg-[#534AB7] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#453d9c] transition-colors">
          <Plus size={14} /> New Doc
        </button>
      </div>

      {showNewDoc && (
        <form onSubmit={handleCreate} className="bg-white border border-[rgba(0,0,0,0.08)] p-4 rounded-xl mb-6 flex items-center gap-3">
          <select value={newDocEmoji} onChange={e => setNewDocEmoji(e.target.value)}
            className="text-2xl bg-gray-50 border-none rounded-lg p-2 outline-none">
            {DOC_EMOJIS.map(em => <option key={em} value={em}>{em}</option>)}
          </select>
          <input value={newDocName} onChange={e => setNewDocName(e.target.value)} placeholder="Document name..."
            className="flex-1 px-3 py-2 text-sm outline-none border border-[rgba(0,0,0,0.08)] rounded-lg" autoFocus />
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

// ─── Meetings Panel ───────────────────────────────────────────────────────────

function MeetingsPanel({ meetings, members, currentUser, onCreate, onRsvp, onDelete }: {
  meetings: Meeting[]; members: TeamMember[]; currentUser: UserProfile;
  onCreate: (data: { title: string; description: string; time: string; date: string }) => void;
  onRsvp: (meeting: Meeting) => void;
  onDelete: (id: string) => void;
}) {
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

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Meetings</h2>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-1.5 bg-[#534AB7] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#453d9c] transition-colors">
          <Plus size={14} /> Schedule
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-[rgba(0,0,0,0.08)] p-6 rounded-2xl mb-6 space-y-4">
          <h3 className="font-bold text-gray-800">New Meeting</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
                placeholder="Weekly Standup" className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What's this meeting about?" className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required
                className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Time</label>
              <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} required
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
        {meetings.map(meeting => {
          const hasRsvp = meeting.rsvps.includes(currentUser.uid);
          const creator = getMember(meeting.createdBy);
          return (
            <div key={meeting.id} className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden flex">
              <div className="w-24 bg-gray-50 flex flex-col items-center justify-center border-r border-[rgba(0,0,0,0.05)] p-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{meeting.date}</span>
                <span className="text-sm font-bold text-gray-900">{meeting.time}</span>
              </div>
              <div className="flex-1 p-5 flex items-center gap-6">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 mb-0.5">{meeting.title}</h3>
                  {meeting.description && <p className="text-sm text-gray-500 mb-3">{meeting.description}</p>}
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {meeting.rsvps.slice(0, 5).map(uid => {
                        const m = getMember(uid);
                        return m ? <Avatar key={uid} initials={m.initials} color={m.color} size="sm" /> : null;
                      })}
                    </div>
                    {meeting.rsvps.length > 0 && (
                      <span className="text-xs text-gray-400">{meeting.rsvps.length} attending</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onRsvp(meeting)}
                    className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5 ${hasRsvp ? 'bg-[#1D9E75] text-white hover:bg-[#168361]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {hasRsvp ? <><Check size={14} /> Attending</> : <><Clock size={14} /> RSVP</>}
                  </button>
                  {(meeting.createdBy === currentUser.uid || currentUser.role === 'leader') && (
                    <button onClick={() => onDelete(meeting.id)} className="p-2 text-gray-300 hover:text-[#A32D2D] transition-colors">
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

// ─── Team Panel ───────────────────────────────────────────────────────────────

function TeamPanel({ profile, team, members, onCreateTeam, onJoinTeam, onApprove, onReject }: {
  profile: UserProfile; team: Team | null; members: TeamMember[];
  onCreateTeam: (e: React.FormEvent<HTMLFormElement>) => void;
  onJoinTeam: (e: React.FormEvent<HTMLFormElement>) => void;
  onApprove: (requestId: string, userId: string) => void;
  onReject: (requestId: string) => void;
}) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!team || profile.role !== 'leader') return;
    const q = query(collection(db, 'joinRequests'), where('teamId', '==', team.id), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest)));
    });
    return unsub;
  }, [team, profile.role]);

  const copyCode = () => {
    if (team?.joinCode) {
      navigator.clipboard.writeText(team.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!profile.teamId) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-8">
        <div className="bg-white p-8 rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm">
          <h2 className="text-xl font-bold mb-2">Create a Team</h2>
          <p className="text-gray-500 text-sm mb-6">Start a new distributed office and invite your colleagues.</p>
          <form onSubmit={onCreateTeam} className="flex gap-2">
            <input name="teamName" type="text" required placeholder="Team Name"
              className="flex-1 px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] text-sm" />
            <button type="submit" className="bg-[#534AB7] text-white px-6 py-2 rounded-xl font-bold hover:bg-[#453d9c]">Create</button>
          </form>
        </div>
        <div className="bg-white p-8 rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm">
          <h2 className="text-xl font-bold mb-2">Join a Team</h2>
          <p className="text-gray-500 text-sm mb-6">Enter a 6-character join code provided by your team leader.</p>
          <form onSubmit={onJoinTeam} className="flex gap-2">
            <input name="joinCode" type="text" required maxLength={6} placeholder="JOIN CODE"
              className="flex-1 px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] uppercase font-mono tracking-widest text-sm" />
            <button type="submit" className="bg-[#1D9E75] text-white px-6 py-2 rounded-xl font-bold hover:bg-[#168361]">Join</button>
          </form>
        </div>
      </motion.div>
    );
  }

  if (profile.role === 'pending') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <div className="bg-white p-8 rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm text-center">
          <div className="w-16 h-16 bg-[#FAEEDA] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock size={28} className="text-[#854F0B]" />
          </div>
          <h2 className="text-xl font-bold mb-2">Awaiting Approval</h2>
          <p className="text-gray-500 text-sm">Your join request has been sent to the team leader. You'll get access once they approve it.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8">
      {/* Team Header */}
      <div className="bg-white p-8 rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm flex items-center gap-6">
        <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center text-3xl">🏢</div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{team?.name || 'Loading...'}</h2>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <ShieldCheck size={12} />
              Role: <span className="text-[#1D9E75]">{profile.role}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <Users size={12} />
              {members.length} member{members.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        {profile.role === 'leader' && team && (
          <button onClick={copyCode}
            className="flex items-center gap-2 border border-[rgba(0,0,0,0.1)] px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors">
            <Key size={14} />
            {copied ? 'Copied!' : team.joinCode}
          </button>
        )}
      </div>

      {/* Pending Requests (leader only) */}
      {profile.role === 'leader' && requests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <UserCheck size={14} /> Pending Join Requests ({requests.length})
          </h3>
          {requests.map(req => (
            <div key={req.id} className="bg-white p-4 rounded-xl border border-[rgba(0,0,0,0.08)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar initials={getInitials(req.userName)} color={pickColor(req.userId)} size="md" />
                <div>
                  <p className="font-bold text-sm">{req.userName}</p>
                  <p className="text-[10px] text-gray-400">{req.userEmail}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onApprove(req.id, req.userId)}
                  className="bg-[#1D9E75] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[#168361] flex items-center gap-1">
                  <Check size={12} /> Approve
                </button>
                <button onClick={() => onReject(req.id)}
                  className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 flex items-center gap-1">
                  <X size={12} /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Members List */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Team Members</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {members.map(member => (
            <div key={member.uid} className="bg-white p-4 rounded-xl border border-[rgba(0,0,0,0.08)] flex items-center gap-4">
              <Avatar initials={member.initials} color={member.color} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm">{member.displayName}</p>
                  {member.uid === team?.leaderId && (
                    <span className="text-[9px] bg-[#534AB7] text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Leader</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{member.email}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
