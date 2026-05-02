import React, { useState, useCallback } from 'react';
import {
  CheckSquare, MessageSquare, FileText, Calendar,
  LogOut, Users, AlertCircle, Loader2, X, Home,
  Settings, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { useAppData } from './hooks/useAppData';
import { useHandlers } from './hooks/useHandlers';
import { AuthScreen } from './components/auth/AuthScreen';
import { NotificationsBell } from './components/layout/NotificationsBell';
import { HomePanel } from './components/views/HomePanel';
import { SettingsPage } from './components/views/SettingsPage';
import { TasksPanel } from './components/views/TasksPanel';
import { ChatPanel } from './components/views/ChatPanel';
import { DocsPanel } from './components/views/DocsPanel';
import { MeetingsPanel } from './components/views/MeetingsPanel';
import { TeamPanel } from './components/views/TeamPanel';
import { Avatar } from './components/ui/Avatar';
import { TeamSwitcher } from './components/layout/TeamSwitcher';
import { NavItem } from './components/layout/NavItem';
import { SyncIndicator, NodeItem } from './components/ui/StatusIndicators';
import { AppState } from './types';

type ActiveTab = 'home' | 'tasks' | 'chat' | 'docs' | 'meetings' | 'team' | 'settings';

export default function App() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [showNewTeamPanel, setShowNewTeamPanel] = useState(false);

  const data = useAppData();
  const {
    firebaseUser, profile, loading,
    teamEntries, activeTeamId, setActiveTeamId,membership,
    team, members,
    userSettings, setUserSettings,
    tasks, messages, docs, meetings,
    appState, setAppState,
    unreadMessages, setUnreadMessages,
    alertTeamIds, setAlertTeamIds,
    lastSeenMessage, lastSeenPerTeam,
  } = data;

  const triggerSync = useCallback(() => {
    setAppState((p: AppState) => ({ ...p, syncStatus: 'syncing' }));
    setTimeout(() => setAppState((p: AppState) => ({ ...p, syncStatus: 'synced' })), 700);
  }, [setAppState]);

  const handlers = useHandlers({
    firebaseUser, profile, activeTeamId, team, docs,
    userSettings, setUserSettings,
    setActiveTeamId, setShowNewTeamPanel, triggerSync,
  });

  // ── Tab change ─────────────────────────────────────────────────────────────
  const isPending = !!activeTeamId && !membership;

  const handleTabChange = (tab: ActiveTab) => {
    if (tab === 'chat') { lastSeenMessage.current = Date.now(); setUnreadMessages(0); }
    setActiveTab(tab);
  };

  // ── Switch team ────────────────────────────────────────────────────────────
  const handleSwitchTeam = (teamId: string) => {
    setActiveTeamId(teamId);
    setActiveTab('home');
    setUnreadMessages(0);
    lastSeenMessage.current = Date.now();
    lastSeenPerTeam.current[teamId] = Date.now();
    setAlertTeamIds(prev => prev.filter(id => id !== teamId));
    setShowNewTeamPanel(false);
  };

  // ── Loading / Auth guards ─────────────────────────────────────────────────
  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#F9FAFB]">
      <Loader2 className="animate-spin text-[#534AB7]" size={32} />
    </div>
  );

  if (!firebaseUser || !profile) return (
    <AuthScreen
      mode={authMode}
      onLogin={handlers.handleLogin}
      onSignup={handlers.handleSignup}
      onToggleMode={() => setAuthMode(m => m === 'login' ? 'signup' : 'login')}
    />
  );

  const incompleteCount = tasks.filter(t => !t.completed).length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F9FAFB]">

      {/* Header */}
      <header className="h-14 bg-white border-b border-[rgba(0,0,0,0.08)] flex items-center px-4 shrink-0 z-20 gap-4">
        <button onClick={() => handleTabChange('home')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 bg-[#F3F4F6] rounded-lg flex items-center justify-center text-sm shrink-0">🏢</div>
          <span className="font-bold text-base tracking-tight text-gray-900">{team ? team.name : 'Sculptors'}</span>
          {team && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider
              ${membership?.role === 'leader' ? 'bg-[#534AB7] text-white' : 'bg-gray-100 text-gray-500'}`}>
              {membership?.role ?? 'pending'}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          {members.slice(0, 5).map(m => <Avatar key={m.uid} initials={m.initials} color={m.color} size="sm" />)}
          {members.length > 5 && (
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-500">
              +{members.length - 5}
            </div>
          )}
          <div className="ml-3"><SyncIndicator status={appState.syncStatus} /></div>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <NotificationsBell userId={firebaseUser.uid} />
          <button
            onClick={() => handleTabChange('settings')}
            className={`p-2 transition-colors ${activeTab === 'settings' ? 'text-[#534AB7]' : 'text-gray-400 hover:text-gray-700'}`}
          >
            <Settings size={18} />
          </button>
          <div className="flex items-center gap-2 ml-2 pl-3 border-l border-[rgba(0,0,0,0.08)]">
            <Avatar initials={profile.initials} color={profile.color} size="sm" />
            <span className="text-sm font-medium text-gray-700 hidden sm:block">{profile.displayName}</span>
          </div>
          <button onClick={() => signOut(auth)} className="p-2 text-gray-400 hover:text-[#A32D2D] transition-colors ml-1" title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Team switcher */}
        <TeamSwitcher
          entries={teamEntries} activeTeamId={activeTeamId}
          alertTeamIds={alertTeamIds}
          onSwitch={handleSwitchTeam} onNewTeam={() => setShowNewTeamPanel(true)}
        />

        {/* Sidebar nav */}
        <aside className="w-[196px] bg-white border-r border-[rgba(0,0,0,0.08)] flex flex-col shrink-0">
          <nav className="p-3 space-y-1 pt-4">
            <div className="px-3 mb-3">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate">
                {team ? team.name : 'No Team Selected'}
              </p>
            </div>
            <NavItem active={activeTab === 'home'} onClick={() => handleTabChange('home')} icon={<Home size={17} />} label="Home" />
            <NavItem active={activeTab === 'tasks'} onClick={() => handleTabChange('tasks')} icon={<CheckSquare size={17} />} label="Tasks" badge={incompleteCount} />
            <NavItem active={activeTab === 'chat'} onClick={() => handleTabChange('chat')} icon={<MessageSquare size={17} />} label="Chat" badge={unreadMessages} />
            <NavItem active={activeTab === 'docs'} onClick={() => handleTabChange('docs')} icon={<FileText size={17} />} label="Docs" />
            <NavItem active={activeTab === 'meetings'} onClick={() => handleTabChange('meetings')} icon={<Calendar size={17} />} label="Meetings" />
            <NavItem active={activeTab === 'team'} onClick={() => handleTabChange('team')} icon={<Users size={17} />} label="Team" />
            <div className="pt-2 border-t border-[rgba(0,0,0,0.05)] mt-2">
              <NavItem active={activeTab === 'settings'} onClick={() => handleTabChange('settings')} icon={<Settings size={17} />} label="Settings" />
            </div>
          </nav>

          {isPending && (
            <div className="mx-3 mt-1 p-3 bg-[#FAEEDA] rounded-xl text-[10px] text-[#854F0B] font-medium leading-snug">
              <Clock size={10} className="inline mr-1" />Awaiting approval. Limited access.
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!activeTeamId && !showNewTeamPanel && (
            <div className="bg-[#FAEEDA] text-[#854F0B] px-6 py-2 text-sm font-medium flex items-center justify-center gap-2 border-b border-[#F5E1C0]">
              <AlertCircle size={14} /> You're not in a team.{' '}
              <button onClick={() => setShowNewTeamPanel(true)} className="underline font-bold">Create or join one</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
            <AnimatePresence mode="wait">

              {showNewTeamPanel && (
                <motion.div key="new-team" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="max-w-2xl mx-auto space-y-8">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Join or Create a Team</h2>
                    {activeTeamId && (
                      <button onClick={() => setShowNewTeamPanel(false)} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
                        <X size={14} /> Cancel
                      </button>
                    )}
                  </div>
                  <div className="bg-white p-8 rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm">
                    <h3 className="text-lg font-bold mb-2">Create a New Team</h3>
                    <p className="text-gray-500 text-sm mb-6">Start a new workspace and invite your colleagues.</p>
                    <form onSubmit={handlers.handleCreateTeam} className="flex gap-2">
                      <input name="teamName" type="text" required placeholder="Team Name"
                        className="flex-1 px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] text-sm" />
                      <button type="submit" className="bg-[#534AB7] text-white px-6 py-2 rounded-xl font-bold hover:bg-[#453d9c]">Create</button>
                    </form>
                  </div>
                  <div className="bg-white p-8 rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm">
                    <h3 className="text-lg font-bold mb-2">Join a Team</h3>
                    <p className="text-gray-500 text-sm mb-6">Enter the 6-character join code from your team leader.</p>
                    <form onSubmit={handlers.handleJoinTeam} className="flex gap-2">
                      <input name="joinCode" type="text" required maxLength={6} placeholder="JOIN CODE"
                        className="flex-1 px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] uppercase font-mono tracking-widest text-sm" />
                      <button type="submit" className="bg-[#1D9E75] text-white px-6 py-2 rounded-xl font-bold hover:bg-[#168361]">Join</button>
                    </form>
                  </div>
                </motion.div>
              )}

              {!showNewTeamPanel && activeTab === 'home' && (
                <HomePanel key={`home-${activeTeamId}`}
                  team={team} profile={profile} members={members}
                  tasks={tasks} messages={messages} docs={docs} meetings={meetings} isLeader={membership?.role === 'leader'}
                  onTabChange={tab => handleTabChange(tab as ActiveTab)}
                />
              )}
              {!showNewTeamPanel && activeTab === 'settings' && (
                <SettingsPage key="settings"
                  profile={profile} settings={userSettings}
                  onSave={handlers.handleSaveSettings}
                  onClose={() => setActiveTab('home')}
                />
              )}
              {!showNewTeamPanel && activeTab === 'tasks' && !isPending && (
                <TasksPanel
                  key={`tasks-${activeTeamId}`}
                  tasks={tasks}
                  members={members}
                  currentUser={profile}
                  isLeader={membership?.role === 'leader'}   // ← add this
                  onToggle={handlers.handleToggleTask}
                  onAdd={handlers.handleAddTask}
                  onDelete={handlers.handleDeleteTask}
                  onAssign={handlers.handleAssignTask}
                />
              )}
              {!showNewTeamPanel && activeTab === 'chat' && !isPending && (
                <ChatPanel key={`chat-${activeTeamId}`}
                  messages={messages} currentUser={profile}
                  onSend={handlers.handleSendMessage}
                />
              )}
              {!showNewTeamPanel && activeTab === 'docs' && !isPending && (
                <DocsPanel key={`docs-${activeTeamId}`}
                  docs={docs} members={members} currentUser={profile} isLeader={membership?.role === 'leader'}
                  onUpdate={handlers.handleUpdateDoc} onCreate={handlers.handleCreateDoc}
                  onDelete={handlers.handleDeleteDoc}
                />
              )}
              {!showNewTeamPanel && activeTab === 'meetings' && !isPending && (
                <MeetingsPanel
                  key={`meetings-${activeTeamId}`}
                  meetings={meetings}
                  members={members}
                  currentUser={profile}
                  isLeader={membership?.role === 'leader'}   // ← add this
                  onCreate={handlers.handleCreateMeeting}
                  onRsvp={handlers.handleRsvpMeeting}
                  onDelete={handlers.handleDeleteMeeting}
                />
              )}
              {!showNewTeamPanel && activeTab === 'team' && (
                <TeamPanel key={`team-${activeTeamId}`}
                  profile={profile} membership={membership} team={team} members={members}
                  onApprove={handlers.handleApproveRequest} onReject={handlers.handleRejectRequest}
                />
              )}
              {!showNewTeamPanel && isPending && activeTab !== 'team' && activeTab !== 'home' && activeTab !== 'settings' && (
                <motion.div key="pending-guard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="max-w-md mx-auto mt-20 text-center">
                  <div className="w-16 h-16 bg-[#FAEEDA] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Clock size={28} className="text-[#854F0B]" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
                  <p className="text-gray-500 text-sm mb-4">Full access unlocks once your leader approves your request.</p>
                  <button onClick={() => setActiveTab('team')} className="bg-[#534AB7] text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-[#453d9c]">
                    View Team Status
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}