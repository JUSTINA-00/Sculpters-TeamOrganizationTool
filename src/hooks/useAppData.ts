import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  doc, getDoc, onSnapshot, collection, query,
  where, orderBy, getDocs
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  UserProfile, Task, Message, Doc, Meeting, Team,
  TeamMember, TeamEntry, UserSettings, AppState, AppNotification
} from '../types';
import { DEFAULT_SETTINGS } from '../utils/helpers';

export function useAppData() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [teamEntries, setTeamEntries] = useState<TeamEntry[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [appState, setAppState] = useState<AppState>({
    isOffline: false, queuedChanges: 0, syncStatus: 'synced',
    nodes: { A: 'alive', B: 'alive', C: 'dead' },
  });
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [alertTeamIds, setAlertTeamIds] = useState<string[]>([]);
  const lastSeenMessage = useRef<number>(Date.now());
  const alertUnsubs = useRef<Record<string, () => void>>({});
  const lastSeenPerTeam = useRef<Record<string, number>>({});

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    return onAuthStateChanged(auth, async fbUser => {
      setFirebaseUser(fbUser);
      if (!fbUser) { setProfile(null); setTeam(null); setLoading(false); return; }
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (snap.exists()) {
          const p = snap.data() as UserProfile;
          setProfile(p);
          if (p.teamId) setActiveTeamId(p.teamId);
        }
        const sSnap = await getDoc(doc(db, 'userSettings', fbUser.uid));
        if (sSnap.exists()) setUserSettings(sSnap.data() as UserSettings);
      } catch (err) {
        console.error('Error loading user data:', err);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    return onSnapshot(doc(db, 'users', firebaseUser.uid), snap => {
      if (snap.exists()) {
        const p = snap.data() as UserProfile;
        setProfile(p);
        if (p.teamId) setActiveTeamId(p.teamId);
      }
    });
  }, [firebaseUser]);

  // ── Team entries ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, 'joinRequests'), where('userId', '==', firebaseUser.uid), where('status', '==', 'approved'));
    return onSnapshot(q, async snap => {
      const teamIds = snap.docs.map(d => d.data().teamId as string);
      if (profile?.teamId && !teamIds.includes(profile.teamId)) teamIds.push(profile.teamId);
      const entries: TeamEntry[] = [];
      for (const tid of teamIds) {
        const tSnap = await getDoc(doc(db, 'teams', tid));
        if (tSnap.exists()) {
          const t = tSnap.data() as Team;
          entries.push({
            teamId: tid, teamName: t.name,
            role: t.leaderId === firebaseUser.uid ? 'leader' : 'member',
            joinedAt: t.createdAt,
          });
        }
      }
      setTeamEntries(entries);
    });
  }, [firebaseUser, profile?.teamId]);

  // ── Alert watchers for non-active teams ───────────────────────────────────
  useEffect(() => {
    if (!firebaseUser) return;
    const otherIds = teamEntries.map(e => e.teamId).filter(id => id !== activeTeamId);
    Object.keys(alertUnsubs.current).forEach(tid => {
      if (!otherIds.includes(tid)) { alertUnsubs.current[tid](); delete alertUnsubs.current[tid]; }
    });
    for (const tid of otherIds) {
      if (alertUnsubs.current[tid]) continue;
      if (!lastSeenPerTeam.current[tid]) lastSeenPerTeam.current[tid] = Date.now();
      const q = query(collection(db, 'messages'), where('teamId', '==', tid), orderBy('timestamp', 'desc'));
      const unsub = onSnapshot(q, snap => {
        if (!snap.empty) {
          const latest = snap.docs[0].data().timestamp as number;
          if (latest > (lastSeenPerTeam.current[tid] || 0)) {
            setAlertTeamIds(prev => prev.includes(tid) ? prev : [...prev, tid]);
          }
        }
      });
      alertUnsubs.current[tid] = unsub;
    }
  }, [teamEntries, activeTeamId, firebaseUser]);

  // ── Active team data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTeamId) { setTeam(null); setMembers([]); return; }
    return onSnapshot(doc(db, 'teams', activeTeamId), snap => {
      if (snap.exists()) setTeam(snap.data() as Team);
    });
  }, [activeTeamId]);

  useEffect(() => {
    if (!activeTeamId) return;
    const q = query(collection(db, 'users'), where('teamId', '==', activeTeamId), where('role', 'in', ['leader', 'member']));
    return onSnapshot(q, snap => setMembers(snap.docs.map(d => d.data() as TeamMember)));
  }, [activeTeamId]);

  useEffect(() => {
    if (!activeTeamId || profile?.role === 'pending') return;
    const q = query(collection(db, 'tasks'), where('teamId', '==', activeTeamId), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))));
  }, [activeTeamId, profile?.role]);

  useEffect(() => {
    if (!activeTeamId || profile?.role === 'pending') return;
    const q = query(collection(db, 'messages'), where('teamId', '==', activeTeamId), orderBy('timestamp', 'asc'));
    return onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      setUnreadMessages(msgs.filter(m => m.timestamp > lastSeenMessage.current && m.senderId !== firebaseUser?.uid).length);
    });
  }, [activeTeamId, profile?.role, firebaseUser?.uid]);

  useEffect(() => {
    if (!activeTeamId || profile?.role === 'pending') return;
    const q = query(collection(db, 'docs'), where('teamId', '==', activeTeamId), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, snap => setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Doc))));
  }, [activeTeamId, profile?.role]);

  useEffect(() => {
    if (!activeTeamId || profile?.role === 'pending') return;
    const q = query(collection(db, 'meetings'), where('teamId', '==', activeTeamId), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => setMeetings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Meeting))));
  }, [activeTeamId, profile?.role]);

  return {
    firebaseUser, profile, setProfile,
    teamEntries, activeTeamId, setActiveTeamId,
    team, members,
    loading, userSettings, setUserSettings,
    tasks, messages, docs, meetings,
    appState, setAppState,
    unreadMessages, setUnreadMessages,
    alertTeamIds, setAlertTeamIds,
    lastSeenMessage, lastSeenPerTeam,
  };
}