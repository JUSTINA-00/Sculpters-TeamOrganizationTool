import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  doc, getDoc, onSnapshot, collection, query,
  where, orderBy, updateDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import {
  UserProfile, Task, Message, Doc, Meeting, Team,
  TeamMember, TeamEntry, TeamMembership, UserSettings, AppState,
} from '../types';
import { DEFAULT_SETTINGS, getInitials, pickColor } from '../utils/helpers';

export function useAppData() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [teamEntries, setTeamEntries] = useState<TeamEntry[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [membership, setMembership] = useState<TeamMembership | null>(null); // current team role
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
      if (!fbUser) {
        setProfile(null); setTeam(null); setLoading(false); return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        if (snap.exists()) {
          const p = snap.data() as UserProfile;
          // Backfill missing initials/color
          if (!p.initials || !p.color) {
            const initials = p.initials || getInitials(p.displayName || fbUser.email || 'U');
            const color = p.color || pickColor(fbUser.uid);
            await updateDoc(doc(db, 'users', fbUser.uid), { initials, color });
            p.initials = initials;
            p.color = color;
          }
          setProfile(p);
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

  // Live-sync profile (identity only, no role/teamId)
  useEffect(() => {
    if (!firebaseUser) return;
    return onSnapshot(doc(db, 'users', firebaseUser.uid), snap => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    });
  }, [firebaseUser]);

  // ── Team entries — sourced from teamMembers ────────────────────────────────
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, 'teamMembers'),
      where('userId', '==', firebaseUser.uid),
    );
    return onSnapshot(q, async snap => {
      const memberships = snap.docs.map(d => d.data() as TeamMembership);
      const entries: TeamEntry[] = [];
      for (const m of memberships) {
        const tSnap = await getDoc(doc(db, 'teams', m.teamId));
        if (tSnap.exists()) {
          const t = tSnap.data() as Team;
          entries.push({
            teamId: m.teamId,
            teamName: t.name,
            role: m.role,
            joinedAt: m.joinedAt,
          });
        }
      }
      setTeamEntries(entries);

      // Auto-select first team if none active
      setActiveTeamId(prev => {
        if (prev) return prev; // keep existing selection
        return entries.length > 0 ? entries[0].teamId : null;
      });
    });
  }, [firebaseUser]);

  // ── Current membership (role for active team) ─────────────────────────────
  useEffect(() => {
    if (!firebaseUser || !activeTeamId) { setMembership(null); return; }
    return onSnapshot(
      doc(db, 'teamMembers', `${activeTeamId}_${firebaseUser.uid}`),
      snap => setMembership(snap.exists() ? (snap.data() as TeamMembership) : null),
    );
  }, [firebaseUser, activeTeamId]);

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

  // Members — sourced from teamMembers collection, joined with users
  useEffect(() => {
    if (!activeTeamId) return;
    const q = query(
      collection(db, 'teamMembers'),
      where('teamId', '==', activeTeamId),
    );
    return onSnapshot(q, async snap => {
      const memberships = snap.docs.map(d => d.data() as TeamMembership);
      const memberList: TeamMember[] = [];
      for (const m of memberships) {
        const uSnap = await getDoc(doc(db, 'users', m.userId));
        if (uSnap.exists()) {
          const u = uSnap.data() as UserProfile;
          memberList.push({
            uid: u.uid,
            displayName: u.displayName,
            email: u.email,
            initials: u.initials,
            color: u.color,
          });
        }
      }
      setMembers(memberList);
    });
  }, [activeTeamId]);

  // Tasks, messages, docs, meetings — gated on approved membership
  const isApproved = !!membership; // membership doc exists = approved

  useEffect(() => {
    if (!activeTeamId || !isApproved) return;
    const q = query(collection(db, 'tasks'), where('teamId', '==', activeTeamId), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))));
  }, [activeTeamId, isApproved]);

  useEffect(() => {
    if (!activeTeamId || !isApproved) return;
    const q = query(collection(db, 'messages'), where('teamId', '==', activeTeamId), orderBy('timestamp', 'asc'));
    return onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      setUnreadMessages(msgs.filter(m => m.timestamp > lastSeenMessage.current && m.senderId !== firebaseUser?.uid).length);
    });
  }, [activeTeamId, isApproved, firebaseUser?.uid]);

  useEffect(() => {
    if (!activeTeamId || !isApproved) return;
    const q = query(collection(db, 'docs'), where('teamId', '==', activeTeamId), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, snap => setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Doc))));
  }, [activeTeamId, isApproved]);

  useEffect(() => {
    if (!activeTeamId || !isApproved) return;
    const q = query(collection(db, 'meetings'), where('teamId', '==', activeTeamId), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => setMeetings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Meeting))));
  }, [activeTeamId, isApproved]);

  return {
    firebaseUser, profile, setProfile,
    teamEntries, activeTeamId, setActiveTeamId,
    membership, // expose this so App.tsx can pass it to TeamPanel
    team, members,
    loading, userSettings, setUserSettings,
    tasks, messages, docs, meetings,
    appState, setAppState,
    unreadMessages, setUnreadMessages,
    alertTeamIds, setAlertTeamIds,
    lastSeenMessage, lastSeenPerTeam,
  };
}