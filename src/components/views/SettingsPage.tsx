import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, User as UserIcon, Palette, Bell, Lock, ChevronRight, Sun, Moon, Globe, Loader2, LogOut, AlertCircle, Check } from 'lucide-react';
import { UserProfile, UserSettings } from '../../types';
import {signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'; 
import { auth } from '../../firebase';// Adjust this path to your firebase config
import { getInitials, formatRelative, pickColor } from '../../utils/helpers';
import { Avatar } from '../ui/Avatar';
import { Toggle } from '../ui/Toggle';

interface SettingsPageProps {
  profile: UserProfile;
  settings: UserSettings;
  onSave: (updated: Partial<UserSettings>, displayName?: string) => Promise<void>;
  onClose: () => void;
}

export function SettingsPage({ profile, settings, onSave, onClose }: SettingsPageProps) {
  const [local, setLocal] = useState<UserSettings>(settings);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [section, setSection] = useState<'profile' | 'appearance' | 'notifications' | 'security'>('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const accentOptions = ['#534AB7', '#1D9E75', '#2563EB', '#7C3AED', '#DB2777', '#D97706', '#DC2626', '#059669'];

  const handleSave = async () => {
    setSaving(true);
    await onSave(local, displayName);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault(); setPwError(null);
    if (pw.next !== pw.confirm) { setPwError("New passwords don't match."); return; }
    if (pw.next.length < 6) { setPwError('Password must be at least 6 characters.'); return; }
    try {
      const user = auth.currentUser!;
      const cred = EmailAuthProvider.credential(user.email!, pw.current);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, pw.next);
      setPwSuccess(true); setPw({ current: '', next: '', confirm: '' });
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err: any) { setPwError(err.message || 'Failed to update password.'); }
  };

  const navItems = [
    { key: 'profile' as const, icon: <UserIcon size={15} />, label: 'Profile' },
    { key: 'appearance' as const, icon: <Palette size={15} />, label: 'Appearance' },
    { key: 'notifications' as const, icon: <Bell size={15} />, label: 'Notifications' },
    { key: 'security' as const, icon: <Lock size={15} />, label: 'Security' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-3xl mx-auto">
      {/* Settings header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
          <p className="text-xs text-gray-400">Manage your account preferences</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-sm flex overflow-hidden" style={{ minHeight: '520px' }}>
        {/* Sidebar */}
        <div className="w-52 bg-white border-r border-[rgba(0,0,0,0.08)] flex flex-col shrink-0">
          <div className="p-5 border-b border-[rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3">
              <Avatar initials={getInitials(profile.displayName)} color={profile.color} size="md" />
              <div className="min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate">{profile.displayName}</p>
                <p className="text-[10px] text-gray-400 truncate">{profile.email}</p>
              </div>
            </div>
          </div>
          <nav className="p-3 space-y-1 flex-1">
            {navItems.map(item => (
              <button key={item.key} onClick={() => setSection(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left
                  ${section === item.key ? 'bg-[#F3F4F6] text-[#534AB7]' : 'text-gray-600 hover:bg-gray-50'}`}>
                <span className={section === item.key ? 'text-[#534AB7]' : 'text-gray-400'}>{item.icon}</span>
                {item.label}
                {section === item.key && <ChevronRight size={13} className="ml-auto text-[#534AB7]" />}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {section === 'profile' && (
            <div className="space-y-6">
              <div><h3 className="text-lg font-bold mb-1">Profile</h3><p className="text-sm text-gray-500">Your public identity across all teams.</p></div>
              <div className="flex items-center gap-5 p-5 bg-white rounded-2xl border border-[rgba(0,0,0,0.08)]">
                <Avatar initials={getInitials(displayName || profile.displayName)} color={profile.color} size="xl" />
                <div>
                  <p className="font-bold">{displayName || profile.displayName}</p>
                  <p className="text-sm text-gray-400">{profile.email}</p>
                  <p className="text-xs text-gray-400 mt-1">Avatar color is auto-assigned and unique to you.</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Display Name</label>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">Email</label>
                  <input value={profile.email} disabled
                    className="w-full px-4 py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
                  <p className="text-[11px] text-gray-400 mt-1">Email cannot be changed.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Toggle value={local.showOnlineStatus} onChange={() => setLocal(l => ({ ...l, showOnlineStatus: !l.showOnlineStatus }))} />
                  <span className="text-sm text-gray-700">Show online status to teammates</span>
                </div>
              </div>
              <button onClick={handleSave} disabled={saving}
                className="bg-[#534AB7] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#453d9c] transition-colors disabled:opacity-60 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saved ? '✓ Saved!' : 'Save Changes'}
              </button>
            </div>
          )}

          {section === 'appearance' && (
            <div className="space-y-6">
              <div><h3 className="text-lg font-bold mb-1">Appearance</h3><p className="text-sm text-gray-500">Customize how Sculptors looks for you.</p></div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Theme</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['light', 'system', 'dark'] as const).map(t => (
                    <button key={t} onClick={() => setLocal(l => ({ ...l, theme: t }))}
                      className={`p-4 rounded-xl border-2 text-sm font-medium flex flex-col items-center gap-2 transition-all
                        ${local.theme === t ? 'border-[#534AB7] bg-[#F8F7FF] text-[#534AB7]' : 'border-[rgba(0,0,0,0.08)] bg-white text-gray-600 hover:border-gray-300'}`}>
                      {t === 'light' ? <Sun size={20} /> : t === 'dark' ? <Moon size={20} /> : <Globe size={20} />}
                      <span className="capitalize">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Accent Color</label>
                <div className="flex gap-3 flex-wrap">
                  {accentOptions.map(color => (
                    <button key={color} onClick={() => setLocal(l => ({ ...l, accentColor: color }))}
                      className={`w-9 h-9 rounded-full transition-all ${local.accentColor === color ? 'ring-2 ring-offset-2 ring-gray-700 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Toggle value={local.compactMode} onChange={() => setLocal(l => ({ ...l, compactMode: !l.compactMode }))} />
                <div>
                  <span className="text-sm font-medium text-gray-700">Compact mode</span>
                  <p className="text-[11px] text-gray-400">Reduce spacing throughout the interface</p>
                </div>
              </div>
              <button onClick={handleSave} disabled={saving}
                className="bg-[#534AB7] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#453d9c] transition-colors disabled:opacity-60 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saved ? '✓ Saved!' : 'Save Changes'}
              </button>
            </div>
          )}

          {section === 'notifications' && (
            <div className="space-y-6">
              <div><h3 className="text-lg font-bold mb-1">Notifications</h3><p className="text-sm text-gray-500">Control how and when you're notified.</p></div>
              <div className="space-y-4 bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] p-5">
                {[
                  { key: 'emailNotifications', label: 'Email notifications', desc: 'Receive updates via email' },
                  { key: 'soundNotifications', label: 'Sound alerts', desc: 'Play a sound on new messages' },
                ].map(item => (
                  <label key={item.key} className="flex items-center justify-between cursor-pointer py-1">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{item.label}</p>
                      <p className="text-[11px] text-gray-400">{item.desc}</p>
                    </div>
                    <Toggle value={!!local[item.key as keyof UserSettings]}
                      onChange={() => setLocal(l => ({ ...l, [item.key]: !l[item.key as keyof UserSettings] }))} />
                  </label>
                ))}
              </div>
              <button onClick={handleSave} disabled={saving}
                className="bg-[#534AB7] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#453d9c] transition-colors disabled:opacity-60 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saved ? '✓ Saved!' : 'Save Changes'}
              </button>
            </div>
          )}

          {section === 'security' && (
            <div className="space-y-6">
              <div><h3 className="text-lg font-bold mb-1">Security</h3><p className="text-sm text-gray-500">Manage your password and account security.</p></div>
              <form onSubmit={handlePasswordChange} className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] p-6 space-y-4">
                <h4 className="font-bold text-gray-800 text-sm">Change Password</h4>
                {[{ key: 'current', label: 'Current Password' }, { key: 'next', label: 'New Password' }, { key: 'confirm', label: 'Confirm New Password' }].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5">{f.label}</label>
                    <input type="password" value={pw[f.key as keyof typeof pw]}
                      onChange={e => setPw(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-[rgba(0,0,0,0.1)] outline-none focus:border-[#534AB7] text-sm" />
                  </div>
                ))}
                {pwError && <div className="flex items-center gap-2 text-[#A32D2D] text-xs bg-red-50 p-3 rounded-lg"><AlertCircle size={14} /> {pwError}</div>}
                {pwSuccess && <div className="flex items-center gap-2 text-[#1D9E75] text-xs bg-green-50 p-3 rounded-lg"><Check size={14} /> Password updated!</div>}
                <button type="submit" className="bg-[#534AB7] text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-[#453d9c]">Update Password</button>
              </form>
              <div className="bg-red-50 rounded-2xl border border-red-100 p-6">
                <h4 className="font-bold text-[#A32D2D] text-sm mb-1">Danger Zone</h4>
                <p className="text-xs text-gray-500 mb-4">These actions are permanent and cannot be undone.</p>
                <button onClick={() => signOut(auth)}
                  className="flex items-center gap-2 text-sm font-bold text-[#A32D2D] bg-white border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50">
                  <LogOut size={14} /> Sign Out of All Devices
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}