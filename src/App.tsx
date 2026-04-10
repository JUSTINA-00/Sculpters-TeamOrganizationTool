import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  CheckSquare, 
  MessageSquare, 
  FileText, 
  Calendar, 
  Wifi, 
  WifiOff, 
  Plus, 
  Send, 
  ArrowLeft,
  MoreHorizontal,
  LogOut,
  Users,
  Key,
  ShieldCheck,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User as AppUser, Task, Message, Doc, Meeting, AppState, NodeStatus } from './types';
import { COLORS, USERS, INITIAL_TASKS, INITIAL_MESSAGES, INITIAL_DOCS, INITIAL_MEETINGS } from './constants';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  addDoc, 
  updateDoc,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';

// --- Components ---

const Avatar = ({ initials, color, size = 'md' }: { initials: string, color: string, size?: 'sm' | 'md' | 'lg', key?: React.Key }) => {
  const sizes = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm'
  };
  return (
    <div 
      className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
};

const Badge = ({ count }: { count: number }) => {
  if (count === 0) return null;
  return (
    <span className="ml-auto bg-[#534AB7] text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
      {count}
    </span>
  );
};

const SyncIndicator = ({ status }: { status: AppState['syncStatus'] }) => {
  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#FAEEDA] text-[#854F0B] text-xs font-medium">
        <span className="animate-spin">◌</span> syncing
      </div>
    );
  }
  if (status === 'offline') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#FEE2E2] text-[#A32D2D] text-xs font-medium">
        <span>●</span> offline
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#D1FAE5] text-[#1D9E75] text-xs font-medium">
      <span>●</span> synced
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [activeTab, setActiveTab] = useState<'tasks' | 'chat' | 'docs' | 'meetings' | 'team'>('tasks');
  const [appState, setAppState] = useState<AppState>({
    isOffline: false,
    queuedChanges: 0,
    syncStatus: 'synced',
    nodes: { A: 'alive', B: 'alive', C: 'dead' }
  });
  
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [docs, setDocs] = useState<Doc[]>(INITIAL_DOCS);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [conflictToast, setConflictToast] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // --- Auth & Data Fetching ---

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setUserProfile(snapshot.data());
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`));
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError(null);
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name });
      const profile = {
        uid: user.uid,
        email: user.email,
        displayName: name,
        role: 'pending',
        teamId: null
      };
      await setDoc(doc(db, 'users', user.uid), profile);
      setUserProfile(profile);
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleCreateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const teamName = formData.get('teamName') as string;
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      const teamId = Math.random().toString(36).substring(2, 15);
      const teamData = {
        id: teamId,
        name: teamName,
        joinCode,
        leaderId: user.uid,
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, 'teams', teamId), teamData);
      await updateDoc(doc(db, 'users', user.uid), {
        teamId,
        role: 'leader'
      });
      triggerSync();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'teams');
    }
  };

  const handleJoinTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const code = formData.get('joinCode') as string;
    
    try {
      const q = query(collection(db, 'teams'), where('joinCode', '==', code.toUpperCase()));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        alert('Invalid join code');
        return;
      }
      const team = querySnapshot.docs[0].data();
      await addDoc(collection(db, 'joinRequests'), {
        userId: user.uid,
        teamId: team.id,
        userName: user.displayName || user.email,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('Join request sent to team leader!');
      triggerSync();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'joinRequests');
    }
  };

  // --- Simulation Logic ---

  const triggerSync = useCallback(() => {
    if (appState.isOffline) {
      setAppState(prev => ({ ...prev, queuedChanges: prev.queuedChanges + 1 }));
      return;
    }
    setAppState(prev => ({ ...prev, syncStatus: 'syncing' }));
    setTimeout(() => {
      setAppState(prev => ({ ...prev, syncStatus: 'synced' }));
    }, 700);
  }, [appState.isOffline]);

  const toggleOffline = () => {
    if (appState.isOffline) {
      // Reconnect flow
      setAppState(prev => ({ ...prev, syncStatus: 'syncing' }));
      setTimeout(() => {
        setAppState(prev => ({ 
          ...prev, 
          isOffline: false, 
          syncStatus: 'synced',
          nodes: { ...prev.nodes, B: 'alive' }
        }));
        
        if (appState.queuedChanges > 0) {
          const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
          setConflictToast(`Conflict detected on "${randomTask.title}" — Alice's version accepted (last-write-wins)`);
          setAppState(prev => ({ ...prev, queuedChanges: 0 }));
        }
      }, 1200);
    } else {
      // Go offline
      setAppState(prev => ({ 
        ...prev, 
        isOffline: true, 
        syncStatus: 'offline',
        nodes: { ...prev.nodes, B: 'dead' }
      }));
    }
  };

  useEffect(() => {
    if (conflictToast) {
      const timer = setTimeout(() => setConflictToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [conflictToast]);

  // Random task editing simulation
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const randomTaskIndex = Math.floor(Math.random() * tasks.length);
        const randomUser = USERS[Math.floor(Math.random() * USERS.length)];
        
        setTasks(prev => prev.map((t, i) => 
          i === randomTaskIndex ? { ...t, editingBy: randomUser.initials } : t
        ));

        setTimeout(() => {
          setTasks(prev => prev.map((t, i) => 
            i === randomTaskIndex ? { ...t, editingBy: undefined } : t
          ));
        }, 3000 + Math.random() * 2000);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [tasks.length]);

  // --- Handlers ---

  const handleAddTask = (title: string, tag: Task['tag']) => {
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      completed: false,
      tag
    };
    setTasks(prev => [...prev, newTask]);
    triggerSync();
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    triggerSync();
  };

  const handleSendMessage = (text: string) => {
    const newMessage: Message = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: 'alice', // Current user
      text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMessage]);
    triggerSync();

    // Simulate reply
    setTimeout(() => {
      const reply: Message = {
        id: Math.random().toString(36).substr(2, 9),
        senderId: USERS[Math.floor(Math.random() * (USERS.length - 1)) + 1].id,
        text: "Got it, looking into it now!",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, reply]);
      triggerSync();
    }, 2000 + Math.random() * 1000);
  };

  const handleUpdateDoc = (id: string, content: string) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, content, updatedAt: 'Just now' } : d));
    triggerSync();
  };

  const incompleteTasksCount = tasks.filter(t => !t.completed).length;

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAFB]">
        <Loader2 className="animate-spin text-[#534AB7]" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAFB] p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-2xl border-subtle shadow-sm w-full max-w-md"
        >
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-[#534AB7] rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-2xl">S</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Sculptors</h1>
          </div>

          <h2 className="text-xl font-bold mb-2 text-center">
            {authMode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-gray-500 text-sm text-center mb-8">
            {authMode === 'login' ? 'Sign in to your distributed office' : 'Join the future of remote collaboration'}
          </p>

          <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="space-y-4">
            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name</label>
                <input 
                  name="name"
                  type="text" 
                  required
                  className="w-full px-4 py-2 rounded-xl border-subtle outline-none focus:border-[#534AB7] transition-colors"
                  placeholder="Alice Smith"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Email Address</label>
              <input 
                name="email"
                type="email" 
                required
                className="w-full px-4 py-2 rounded-xl border-subtle outline-none focus:border-[#534AB7] transition-colors"
                placeholder="alice@sculptors.io"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
              <input 
                name="password"
                type="password" 
                required
                className="w-full px-4 py-2 rounded-xl border-subtle outline-none focus:border-[#534AB7] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <div className="flex items-center gap-2 text-[#A32D2D] text-xs bg-red-50 p-3 rounded-lg">
                <AlertCircle size={14} />
                {authError}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-[#534AB7] text-white py-3 rounded-xl font-bold hover:bg-[#453d9c] transition-colors"
            >
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-sm text-[#534AB7] font-medium hover:underline"
            >
              {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F9FAFB]">
      {/* Header */}
      <header className="h-14 bg-white border-b border-subtle flex items-center px-6 shrink-0 z-20">
        <div className="flex items-center gap-2 mr-8">
          <div className="w-8 h-8 bg-[#534AB7] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <span className="font-bold text-lg tracking-tight">Sculptors</span>
        </div>

        <div className="flex items-center gap-2">
            {USERS.map(user => (
              <Avatar key={user.id} initials={user.initials} color={user.color} size="sm" />
            ))}
          <div className="ml-4">
            <SyncIndicator status={appState.syncStatus} />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <button 
            onClick={toggleOffline}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors border border-subtle ${
              appState.isOffline 
                ? 'bg-[#534AB7] text-white border-transparent' 
                : 'bg-white text-[#141414] hover:bg-gray-50'
            }`}
          >
            {appState.isOffline ? 'Reconnect' : 'Go offline'}
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-[#A32D2D] transition-colors"
            title="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[220px] bg-white border-r border-subtle flex flex-col shrink-0">
          <nav className="p-4 space-y-1">
            <NavItem 
              active={activeTab === 'tasks'} 
              onClick={() => setActiveTab('tasks')} 
              icon={<CheckSquare size={18} />} 
              label="Tasks" 
              badge={incompleteTasksCount}
            />
            <NavItem 
              active={activeTab === 'chat'} 
              onClick={() => setActiveTab('chat')} 
              icon={<MessageSquare size={18} />} 
              label="Team Chat" 
              badge={2}
            />
            <NavItem 
              active={activeTab === 'docs'} 
              onClick={() => setActiveTab('docs')} 
              icon={<FileText size={18} />} 
              label="Docs" 
            />
            <NavItem 
              active={activeTab === 'meetings'} 
              onClick={() => setActiveTab('meetings')} 
              icon={<Calendar size={18} />} 
              label="Meetings" 
            />
            <NavItem 
              active={activeTab === 'team'} 
              onClick={() => setActiveTab('team')} 
              icon={<Users size={18} />} 
              label="Team" 
            />
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

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {appState.isOffline && (
            <div className="bg-[#FAEEDA] text-[#854F0B] px-6 py-2 text-sm font-medium flex items-center justify-center border-b border-[#F5E1C0]">
              You're offline — {appState.queuedChanges} changes queued and will sync when reconnected
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
            <AnimatePresence mode="wait">
              {activeTab === 'tasks' && (
                <TasksPanel 
                  key="tasks" 
                  tasks={tasks} 
                  onToggle={toggleTask} 
                  onAdd={handleAddTask} 
                />
              )}
              {activeTab === 'chat' && (
                <ChatPanel 
                  key="chat" 
                  messages={messages} 
                  onSend={handleSendMessage} 
                  isTyping={isTyping}
                  onTypingChange={setIsTyping}
                />
              )}
              {activeTab === 'docs' && (
                <DocsPanel 
                  key="docs" 
                  docs={docs} 
                  activeDocId={activeDocId}
                  onDocClick={setActiveDocId}
                  onUpdate={handleUpdateDoc}
                  onBack={() => setActiveDocId(null)}
                />
              )}
              {activeTab === 'meetings' && (
                <MeetingsPanel 
                  key="meetings" 
                  meetings={INITIAL_MEETINGS} 
                />
              )}
              {activeTab === 'team' && (
                <TeamPanel 
                  key="team" 
                  userProfile={userProfile}
                  onCreateTeam={handleCreateTeam}
                  onJoinTeam={handleJoinTeam}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Conflict Toast */}
          <AnimatePresence>
            {conflictToast && (
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#141414] text-white px-4 py-3 rounded-lg text-sm shadow-xl flex items-center gap-3 z-50 min-w-[400px]"
              >
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

// --- Sub-components ---

function NavItem({ active, onClick, icon, label, badge }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active 
          ? 'bg-[#F3F4F6] text-[#534AB7]' 
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <span className={active ? 'text-[#534AB7]' : 'text-gray-400'}>{icon}</span>
      {label}
      {badge !== undefined && <Badge count={badge} />}
    </button>
  );
}

function NodeItem({ label, type, status }: { label: string, type: string, status: NodeStatus }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${status === 'alive' ? 'bg-[#1D9E75]' : 'bg-[#A32D2D]'}`} />
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <span className="text-[9px] text-gray-400 ml-auto uppercase tracking-tighter">{type}</span>
    </div>
  );
}

// --- Panels ---

function TasksPanel({ tasks, onToggle, onAdd }: { tasks: Task[], onToggle: (id: string) => void, onAdd: (title: string, tag: Task['tag']) => void, key?: React.Key }) {
  const [inputValue, setInputValue] = useState('');
  const [selectedTag, setSelectedTag] = useState<Task['tag']>('dev');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onAdd(inputValue, selectedTag);
    setInputValue('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-2xl mx-auto"
    >
      <h2 className="text-2xl font-bold mb-6">Tasks</h2>
      <div className="space-y-3 mb-8">
        {tasks.map(task => (
          <div 
            key={task.id} 
            className="bg-white border border-subtle p-4 rounded-xl flex items-center gap-4 group transition-all hover:border-[rgba(0,0,0,0.15)]"
          >
            <input 
              type="checkbox" 
              checked={task.completed} 
              onChange={() => onToggle(task.id)}
              className="w-5 h-5 rounded border-gray-300 text-[#534AB7] focus:ring-[#534AB7]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {task.title}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                  task.tag === 'design' ? 'bg-purple-100 text-purple-700' :
                  task.tag === 'dev' ? 'bg-teal-100 text-teal-700' :
                  task.tag === 'pm' ? 'bg-blue-100 text-blue-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {task.tag}
                </span>
              </div>
              {task.editingBy && (
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-400 font-medium">
                  <span className="text-[#534AB7]">{task.editingBy}</span> is editing
                  <span className="flex gap-0.5">
                    <span className="w-0.5 h-0.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-0.5 h-0.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-0.5 h-0.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-subtle p-2 rounded-xl flex items-center gap-2">
        <input 
          type="text" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 px-3 py-2 text-sm outline-none"
        />
        <select 
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value as Task['tag'])}
          className="text-xs font-bold uppercase bg-gray-50 border-none rounded px-2 py-1 outline-none"
        >
          <option value="design">Design</option>
          <option value="dev">Dev</option>
          <option value="pm">PM</option>
          <option value="bug">Bug</option>
        </select>
        <button 
          type="submit"
          className="bg-[#534AB7] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#453d9c] transition-colors"
        >
          Add
        </button>
      </form>
    </motion.div>
  );
}

function ChatPanel({ messages, onSend, isTyping, onTypingChange }: { messages: Message[], onSend: (text: string) => void, isTyping: boolean, onTypingChange: (val: boolean) => void, key?: React.Key }) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSend(inputValue);
    setInputValue('');
    onTypingChange(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (e.target.value.length > 0 && !isTyping) {
      onTypingChange(true);
      setTimeout(() => onTypingChange(false), 2000);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-3xl mx-auto h-full flex flex-col"
    >
      <h2 className="text-2xl font-bold mb-6">Team Chat</h2>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 pr-4 scrollbar-hide mb-6">
        {messages.map((msg, idx) => {
          const sender = USERS.find(u => u.id === msg.senderId) || USERS[0];
          const isMe = msg.senderId === 'alice';
          const showHeader = idx === 0 || messages[idx-1].senderId !== msg.senderId;

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {showHeader && (
                <div className="flex items-center gap-2 mb-1 px-1">
                  {!isMe && <Avatar initials={sender.initials} color={sender.color} size="sm" />}
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{sender.name}</span>
                  {isMe && <Avatar initials={sender.initials} color={sender.color} size="sm" />}
                </div>
              )}
              <div 
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMe 
                    ? 'bg-[#534AB7] text-white rounded-tr-none' 
                    : 'bg-white border border-subtle text-gray-900 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">You are typing</span>
            </div>
            <div className="bg-gray-100 px-4 py-2.5 rounded-2xl rounded-tl-none flex gap-1 items-center">
              <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-subtle p-2 rounded-xl flex items-center gap-2 shrink-0">
        <input 
          type="text" 
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 text-sm outline-none"
        />
        <button 
          type="submit"
          className="bg-[#534AB7] text-white p-2 rounded-lg hover:bg-[#453d9c] transition-colors"
        >
          <Send size={18} />
        </button>
      </form>
    </motion.div>
  );
}

function DocsPanel({ docs, activeDocId, onDocClick, onUpdate, onBack }: { docs: Doc[], activeDocId: string | null, onDocClick: (id: string) => void, onUpdate: (id: string, content: string) => void, onBack: () => void, key?: React.Key }) {
  const activeDoc = docs.find(d => d.id === activeDocId);

  if (activeDoc) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="max-w-4xl mx-auto h-full flex flex-col"
      >
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{activeDoc.emoji}</span>
              <h2 className="text-2xl font-bold">{activeDoc.name}</h2>
            </div>
            <p className="text-xs text-gray-500">Last updated {activeDoc.updatedAt}</p>
          </div>
          <div className="ml-auto flex -space-x-2">
            {activeDoc.editors.map(initials => {
              const user = USERS.find(u => u.initials === initials);
              return <Avatar key={initials} initials={initials} color={user?.color || '#ccc'} size="sm" />;
            })}
            <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-gray-400 z-10">
              +2
            </div>
          </div>
        </div>

        <textarea 
          value={activeDoc.content}
          onChange={(e) => onUpdate(activeDoc.id, e.target.value)}
          className="flex-1 bg-white border border-subtle rounded-2xl p-8 outline-none resize-none font-sans leading-relaxed text-gray-800 shadow-sm"
          placeholder="Start writing..."
        />
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-5xl mx-auto"
    >
      <h2 className="text-2xl font-bold mb-6">Documents</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.map(doc => (
          <button 
            key={doc.id}
            onClick={() => onDocClick(doc.id)}
            className="bg-white border border-subtle p-6 rounded-2xl text-left hover:border-[#534AB7] transition-all group"
          >
            <span className="text-3xl mb-4 block">{doc.emoji}</span>
            <h3 className="font-bold text-gray-900 mb-1 group-hover:text-[#534AB7]">{doc.name}</h3>
            <p className="text-xs text-gray-500 mb-4">Updated {doc.updatedAt}</p>
            <div className="flex -space-x-2">
              {doc.editors.map(initials => {
                const user = USERS.find(u => u.initials === initials);
                return <Avatar key={initials} initials={initials} color={user?.color || '#ccc'} size="sm" />;
              })}
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function MeetingsPanel({ meetings }: { meetings: Meeting[], key?: React.Key }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-4xl mx-auto"
    >
      <h2 className="text-2xl font-bold mb-6">Meetings</h2>
      <div className="space-y-4">
        {meetings.map(meeting => (
          <div key={meeting.id} className="bg-white border border-subtle rounded-2xl overflow-hidden flex">
            <div className="w-24 bg-gray-50 flex flex-col items-center justify-center border-r border-subtle p-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{meeting.date}</span>
              <span className="text-sm font-bold text-gray-900">{meeting.time.split(' ')[0]}</span>
              <span className="text-[10px] font-medium text-gray-500">{meeting.time.split(' ')[1]}</span>
            </div>
            <div className="flex-1 p-6 flex items-center gap-6">
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-1">{meeting.title}</h3>
                <p className="text-sm text-gray-500 mb-3">{meeting.description}</p>
                <div className="flex -space-x-2">
                  {meeting.attendees.map(initials => {
                    const user = USERS.find(u => u.initials === initials);
                    return <Avatar key={initials} initials={initials} color={user?.color || '#ccc'} size="sm" />;
                  })}
                </div>
              </div>
              <button className={`px-6 py-2 rounded-xl text-sm font-bold transition-colors ${
                meeting.type === 'join' 
                  ? 'bg-[#534AB7] text-white hover:bg-[#453d9c]' 
                  : 'bg-[#1D9E75] text-white hover:bg-[#168361]'
              }`}>
                {meeting.type === 'join' ? 'Join now' : 'RSVP'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function TeamPanel({ userProfile, onCreateTeam, onJoinTeam }: { userProfile: any, onCreateTeam: (e: any) => void, onJoinTeam: (e: any) => void, key?: React.Key }) {
  const [team, setTeam] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    if (userProfile?.teamId) {
      const unsubTeam = onSnapshot(doc(db, 'teams', userProfile.teamId), (snapshot) => {
        setTeam(snapshot.data());
      });
      
      if (userProfile.role === 'leader') {
        const q = query(collection(db, 'joinRequests'), where('teamId', '==', userProfile.teamId), where('status', '==', 'pending'));
        const unsubRequests = onSnapshot(q, (snapshot) => {
          setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => { unsubTeam(); unsubRequests(); };
      }
      return () => unsubTeam();
    }
  }, [userProfile]);

  const handleRequest = async (requestId: string, userId: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'joinRequests', requestId), { status });
      if (status === 'approved') {
        await updateDoc(doc(db, 'users', userId), {
          teamId: userProfile.teamId,
          role: 'member'
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'joinRequests');
    }
  };

  if (!userProfile?.teamId) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto space-y-8"
      >
        <div className="bg-white p-8 rounded-2xl border-subtle shadow-sm">
          <h2 className="text-xl font-bold mb-2">Create a Team</h2>
          <p className="text-gray-500 text-sm mb-6">Start a new distributed office and invite your colleagues.</p>
          <form onSubmit={onCreateTeam} className="flex gap-2">
            <input 
              name="teamName"
              type="text" 
              required
              placeholder="Team Name (e.g. Design Ops)"
              className="flex-1 px-4 py-2 rounded-xl border-subtle outline-none focus:border-[#534AB7]"
            />
            <button type="submit" className="bg-[#534AB7] text-white px-6 py-2 rounded-xl font-bold hover:bg-[#453d9c]">
              Create
            </button>
          </form>
        </div>

        <div className="bg-white p-8 rounded-2xl border-subtle shadow-sm">
          <h2 className="text-xl font-bold mb-2">Join a Team</h2>
          <p className="text-gray-500 text-sm mb-6">Enter a 6-digit join code provided by your team leader.</p>
          <form onSubmit={onJoinTeam} className="flex gap-2">
            <input 
              name="joinCode"
              type="text" 
              required
              maxLength={6}
              placeholder="JOIN CODE"
              className="flex-1 px-4 py-2 rounded-xl border-subtle outline-none focus:border-[#534AB7] uppercase font-mono tracking-widest"
            />
            <button type="submit" className="bg-[#1D9E75] text-white px-6 py-2 rounded-xl font-bold hover:bg-[#168361]">
              Join
            </button>
          </form>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="bg-white p-8 rounded-2xl border-subtle shadow-sm flex items-center gap-6">
        <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center text-3xl">
          🏢
        </div>
        <div>
          <h2 className="text-2xl font-bold">{team?.name || 'Loading...'}</h2>
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <Key size={12} />
              Join Code: <span className="text-[#534AB7] font-mono">{team?.joinCode}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <ShieldCheck size={12} />
              Role: <span className="text-[#1D9E75]">{userProfile.role}</span>
            </div>
          </div>
        </div>
      </div>

      {userProfile.role === 'leader' && requests.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Pending Join Requests</h3>
          <div className="grid gap-3">
            {requests.map(req => (
              <div key={req.id} className="bg-white p-4 rounded-xl border-subtle flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar initials={req.userName.substring(0, 2).toUpperCase()} color="#534AB7" size="sm" />
                  <div>
                    <p className="font-bold text-sm">{req.userName}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Wants to join your team</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleRequest(req.id, req.userId, 'approved')}
                    className="bg-[#1D9E75] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[#168361]"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleRequest(req.id, req.userId, 'rejected')}
                    className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

