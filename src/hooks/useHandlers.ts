import { useCallback } from 'react';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile, updatePassword,
  EmailAuthProvider, reauthenticateWithCredential, User as FirebaseUser
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, collection, query, where, addDoc,
  updateDoc, deleteDoc, getDocs
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Task, Meeting, Doc, Team, UserSettings, TaskTag } from '../types';
import { getInitials, pickColor } from '../utils/helpers';

interface HandlersInput {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  activeTeamId: string | null;
  team: Team | null;
  docs: Doc[];
  userSettings: UserSettings;
  setUserSettings: (s: UserSettings) => void;
  setActiveTeamId: (id: string) => void;
  setShowNewTeamPanel: (v: boolean) => void;
  triggerSync: () => void;
}

export function useHandlers({
  firebaseUser, profile, activeTeamId, team, docs,
  userSettings, setUserSettings,
  setActiveTeamId, setShowNewTeamPanel, triggerSync,
}: HandlersInput) {

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await signInWithEmailAndPassword(auth, fd.get('email') as string, fd.get('password') as string);
  };

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string, password = fd.get('password') as string, name = fd.get('name') as string;
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: name });
    // Identity only — no role or teamId
    const newProfile: UserProfile = {
      uid: user.uid, email, displayName: name, initials: getInitials(name),
      color: pickColor(user.uid), createdAt: Date.now(),
    };
    await setDoc(doc(db, 'users', user.uid), newProfile);
  };

  const handleLogout = () => signOut(auth);

  // ── Settings ──────────────────────────────────────────────────────────────
  const handleSaveSettings = async (updated: Partial<UserSettings>, displayName?: string) => {
    if (!firebaseUser) return;
    const merged = { ...userSettings, ...updated };
    setUserSettings(merged);
    await setDoc(doc(db, 'userSettings', firebaseUser.uid), merged);
    if (displayName && displayName !== profile?.displayName) {
      await updateProfile(firebaseUser, { displayName });
      await updateDoc(doc(db, 'users', firebaseUser.uid), { displayName, initials: getInitials(displayName) });
    }
  };

  // ── Teams ─────────────────────────────────────────────────────────────────
  const handleCreateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!firebaseUser || !profile) return;
    const fd = new FormData(e.currentTarget);
    const teamName = fd.get('teamName') as string;
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const teamRef = doc(collection(db, 'teams'));
    try {
      const teamData: Team = {
        id: teamRef.id, name: teamName, joinCode,
        leaderId: firebaseUser.uid, createdAt: Date.now(),
      };
      // Write team and membership together
      await Promise.all([
        setDoc(teamRef, teamData),
        setDoc(doc(db, 'teamMembers', `${teamRef.id}_${firebaseUser.uid}`), {
          teamId: teamRef.id, userId: firebaseUser.uid,
          role: 'leader', joinedAt: Date.now(),
        }),
      ]);

      setActiveTeamId(teamRef.id);
      setShowNewTeamPanel(false);
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
      if (snap.empty) { alert('Invalid join code.'); return; }
      const foundTeam = snap.docs[0].data() as Team;

      const existingQ = query(
        collection(db, 'joinRequests'),
        where('userId', '==', firebaseUser.uid),
        where('teamId', '==', foundTeam.id),
        where('status', '==', 'pending'),
      );
      if (!(await getDocs(existingQ)).empty) { alert('You already have a pending request.'); return; }

      // Approval status lives only in joinRequests
      await addDoc(collection(db, 'joinRequests'), {
        userId: firebaseUser.uid, teamId: foundTeam.id,
        userName: profile.displayName, userEmail: profile.email,
        status: 'pending', createdAt: Date.now(),
      });

      setActiveTeamId(foundTeam.id);
      setShowNewTeamPanel(false);
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.WRITE, 'joinRequests'); }
  };

  const handleApproveRequest = async (requestId: string, userId: string) => {
    if (!activeTeamId || !team) return;
    try {
      await updateDoc(doc(db, 'joinRequests', requestId), { status: 'approved' });

      // Role written to teamMembers, not users
      await setDoc(doc(db, 'teamMembers', `${activeTeamId}_${userId}`), {
        teamId: activeTeamId, userId, role: 'member', joinedAt: Date.now(),
      });

      await addDoc(collection(db, 'notifications'), {
        userId,
        message: `Your request to join "${team.name}" has been approved! You now have full access.`,
        read: false, type: 'approval', createdAt: Date.now(),
      });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, `joinRequests/${requestId}`); }
  };

  const handleRejectRequest = async (requestId: string, userId: string) => {
    if (!team) return;
    try {
      await updateDoc(doc(db, 'joinRequests', requestId), { status: 'rejected' });

      await addDoc(collection(db, 'notifications'), {
        userId,
        message: `Your request to join "${team.name}" was declined.`,
        read: false, type: 'rejection', createdAt: Date.now(),
      });
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, `joinRequests/${requestId}`); }
  };

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const handleAddTask = async (title: string, tag: TaskTag, assignedTo: string | null) => {
    if (!activeTeamId || !firebaseUser) return;
    const now = Date.now();
    try {
      await addDoc(collection(db, 'tasks'), {
        title, tag, completed: false, assignedTo,
        createdBy: firebaseUser.uid, teamId: activeTeamId,
        createdAt: now, updatedAt: now,
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

  const handleAssignTask = async (taskId: string, assignedTo: string | null) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { assignedTo, updatedAt: Date.now() });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`); }
  };

  // ── Messages ──────────────────────────────────────────────────────────────
  const handleSendMessage = async (text: string) => {
    if (!activeTeamId || !firebaseUser || !profile) return;
    const initials = profile.initials || getInitials(profile.displayName || firebaseUser.email || 'U');
    const color = profile.color || pickColor(firebaseUser.uid);
    const displayName = profile.displayName || firebaseUser.email || 'Unknown';
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: firebaseUser.uid, senderName: displayName,
        senderInitials: initials, senderColor: color,
        text, teamId: activeTeamId, timestamp: Date.now(),
      });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'messages'); }
  };

  // ── Docs ──────────────────────────────────────────────────────────────────
  const handleCreateDoc = async (name: string, emoji: string) => {
    if (!activeTeamId || !firebaseUser) return;
    const now = Date.now();
    try {
      await addDoc(collection(db, 'docs'), {
        name, emoji, content: '', teamId: activeTeamId,
        createdBy: firebaseUser.uid, editors: [firebaseUser.uid],
        createdAt: now, updatedAt: now,
      });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'docs'); }
  };

  const handleUpdateDoc = async (docId: string, content: string) => {
    if (!firebaseUser) return;
    try {
      const currentDoc = docs.find(d => d.id === docId);
      const editors = Array.from(new Set([...(currentDoc?.editors || []), firebaseUser.uid]));
      await updateDoc(doc(db, 'docs', docId), { content, updatedAt: Date.now(), editors });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.UPDATE, `docs/${docId}`); }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'docs', docId));
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.DELETE, `docs/${docId}`); }
  };

  // ── Meetings ──────────────────────────────────────────────────────────────
  const handleCreateMeeting = async (data: { title: string; description: string; time: string; date: string }) => {
    if (!activeTeamId || !firebaseUser) return;
    try {
      await addDoc(collection(db, 'meetings'), {
        ...data, teamId: activeTeamId, createdBy: firebaseUser.uid,
        attendees: [firebaseUser.uid], rsvps: [firebaseUser.uid], createdAt: Date.now(),
      });
      triggerSync();
    } catch (err) { handleFirestoreError(err, OperationType.CREATE, 'meetings'); }
  };

  const handleRsvpMeeting = async (meeting: Meeting) => {
    if (!firebaseUser) return;
    const updatedRsvps = meeting.rsvps.includes(firebaseUser.uid)
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

  return {
    handleLogin, handleSignup, handleLogout,
    handleSaveSettings,
    handleCreateTeam, handleJoinTeam,
    handleApproveRequest, handleRejectRequest,
    handleAddTask, handleToggleTask, handleDeleteTask, handleAssignTask,
    handleSendMessage,
    handleCreateDoc, handleUpdateDoc, handleDeleteDoc,
    handleCreateMeeting, handleRsvpMeeting, handleDeleteMeeting,
  };
}