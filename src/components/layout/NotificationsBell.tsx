import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { AppNotification } from '../../types';
import { formatRelative } from '../../utils/helpers';

export function NotificationsBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification))));
  }, [userId]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    for (const n of notifications.filter(n => !n.read))
      await updateDoc(doc(db, 'notifications', n.id), { read: true });
  };

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) markAllRead();
  };

  const typeIcon = (t: AppNotification['type']) =>
    t === 'approval' ? <Check size={12} className="text-[#1D9E75]" /> :
    t === 'rejection' ? <X size={12} className="text-[#A32D2D]" /> :
    <Bell size={12} className="text-[#534AB7]" />;

  const typeBg = (t: AppNotification['type']) =>
    t === 'approval' ? 'bg-green-50 border-green-100' :
    t === 'rejection' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100';

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleOpen} className="relative p-2 text-gray-400 hover:text-gray-700 transition-colors">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-[#A32D2D] text-white text-[9px] rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.15 }}
            className="absolute right-0 top-10 w-80 bg-white border border-[rgba(0,0,0,0.1)] rounded-2xl shadow-lg z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
              <span className="font-bold text-sm text-gray-800">Notifications</span>
              {notifications.length > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-[#534AB7] hover:underline">Mark all read</button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0
                ? <div className="text-center py-10 text-gray-400 text-sm">No notifications yet</div>
                : notifications.map(n => (
                  <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-[rgba(0,0,0,0.04)] ${!n.read ? 'bg-[#F8F7FF]' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${typeBg(n.type)}`}>
                      {typeIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-snug">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{formatRelative(n.createdAt)}</p>
                    </div>
                    {!n.read && <div className="w-2 h-2 bg-[#534AB7] rounded-full shrink-0 mt-1.5" />}
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}