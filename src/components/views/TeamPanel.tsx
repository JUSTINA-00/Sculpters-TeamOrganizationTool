import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, Key, UserCheck, Clock, Bell, Check, X } from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { UserProfile, Team, TeamMember, TeamMembership, JoinRequest } from '../../types';
import { Avatar } from '../ui/Avatar';
import { getInitials, pickColor } from '../../utils/helpers';

interface TeamPanelProps {
  profile: UserProfile;
  membership: TeamMembership | null; // role lives here now, not on profile
  team: Team | null;
  members: TeamMember[];
  onApprove: (requestId: string, userId: string) => void;
  onReject: (requestId: string, userId: string) => void;
}

export function TeamPanel({ profile, membership, team, members, onApprove, onReject }: TeamPanelProps) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [copied, setCopied] = useState(false);

  const isLeaderRole = membership?.role === 'leader';
  const isPending = !membership; // no teamMembers doc yet = still pending

  useEffect(() => {
    if (!team || !isLeaderRole) return;
    const q = query(
      collection(db, 'joinRequests'),
      where('teamId', '==', team.id),
      where('status', '==', 'pending'),
    );
    return onSnapshot(q, snap =>
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest)))
    );
  }, [team, isLeaderRole]);

  const copyCode = () => {
    if (!team?.joinCode) return;
    navigator.clipboard.writeText(team.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Pending state (no membership doc yet) ────────────────────────────────
  if (isPending) return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div className="bg-white p-8 rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm text-center">
        <div className="w-16 h-16 bg-[#FAEEDA] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Clock size={28} className="text-[#854F0B]" />
        </div>
        <h2 className="text-xl font-bold mb-2">Awaiting Approval</h2>
        <p className="text-gray-500 text-sm mb-4">
          Your join request has been sent. Watch the bell icon for your notification.
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-[#854F0B] bg-[#FAEEDA] px-4 py-2 rounded-full w-fit mx-auto font-medium">
          <Bell size={12} /> Watch the bell icon above for approval
        </div>
      </div>

      {team && (
        <div className="bg-white p-5 rounded-2xl border border-[rgba(0,0,0,0.08)] flex items-center gap-4">
          <div className="w-12 h-12 bg-[#F3F4F6] rounded-xl flex items-center justify-center text-2xl">🏢</div>
          <div>
            <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-0.5">Applied to</p>
            <p className="font-bold">{team.name}</p>
          </div>
        </div>
      )}
    </motion.div>
  );

  // ── Main panel ───────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      {/* Team header */}
      <div className="bg-white p-8 rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm">
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center text-3xl shrink-0">🏢</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{team?.name || 'Loading…'}</h2>
            <div className="flex items-center gap-4 mt-1 mb-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <ShieldCheck size={12} />
                Role: <span className="text-[#1D9E75] capitalize">{membership?.role ?? '—'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <Users size={12} /> {members.length} member{members.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Join code — leader only */}
            {isLeaderRole && team && (
              <div className="bg-[#F8F7FF] border border-[#E0DEFF] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Key size={14} className="text-[#534AB7]" />
                  <span className="text-xs font-bold text-[#534AB7] uppercase tracking-wider">Team Join Code</span>
                  <span className="ml-auto text-[10px] text-gray-400">Share with people you want to invite</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-white border-2 border-dashed border-[#C4BFFE] rounded-xl px-6 py-4 text-center">
                    <span className="text-3xl font-mono font-black tracking-[0.3em] text-[#534AB7]">
                      {team.joinCode}
                    </span>
                  </div>
                  <button
                    onClick={copyCode}
                    className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl text-sm font-bold transition-all shrink-0
                      ${copied ? 'bg-[#1D9E75] text-white' : 'bg-white border border-[rgba(0,0,0,0.1)] text-gray-700 hover:bg-gray-50'}`}
                  >
                    {copied ? <Check size={18} /> : <Key size={18} />}
                    <span className="text-[11px]">{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-3 text-center">
                  This code stays here until you navigate away — no timer.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending join requests — leader only */}
      {isLeaderRole && requests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <UserCheck size={14} /> Pending Join Requests ({requests.length})
          </h3>
          {requests.map(req => (
            <div
              key={req.id}
              className="bg-white p-4 rounded-xl border border-[rgba(0,0,0,0.08)] flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Avatar initials={getInitials(req.userName)} color={pickColor(req.userId)} size="md" />
                <div>
                  <p className="font-bold text-sm">{req.userName}</p>
                  <p className="text-[10px] text-gray-400">{req.userEmail}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onApprove(req.id, req.userId)}
                  className="bg-[#1D9E75] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-[#168361] flex items-center gap-1"
                >
                  <Check size={12} /> Approve
                </button>
                <button
                  onClick={() => onReject(req.id, req.userId)}
                  className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 flex items-center gap-1"
                >
                  <X size={12} /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Members list */}
      <div>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users size={14} /> Team Members ({members.length})
        </h3>

        {members.length === 0 ? (
          <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl py-12 text-center text-gray-400 text-sm">
            No members yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...members]
              .sort((a, b) => {
                if (a.uid === team?.leaderId) return -1;
                if (b.uid === team?.leaderId) return 1;
                return a.displayName.localeCompare(b.displayName);
              })
              .map(member => {
                const memberIsLeader = member.uid === team?.leaderId;
                const isMe = member.uid === profile.uid;
                return (
                  <div
                    key={member.uid}
                    className={`bg-white p-4 rounded-xl border flex items-center gap-4 transition-all
                      ${memberIsLeader ? 'border-[#534AB7]/30 bg-[#F8F7FF]' : 'border-[rgba(0,0,0,0.08)]'}`}
                  >
                    <Avatar initials={member.initials} color={member.color} size="lg" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm truncate">{member.displayName}</p>
                        {memberIsLeader && (
                          <span className="text-[9px] bg-[#534AB7] text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                            Leader
                          </span>
                        )}
                        {isMe && (
                          <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{member.email}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </motion.div>
  );
}