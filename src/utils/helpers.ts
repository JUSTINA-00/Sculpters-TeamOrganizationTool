import { AVATAR_COLORS } from '../constants';
import { UserSettings } from '../types';

/**
 * Generates up to two initials from a display name.
 * Example: "John Doe" -> "JD"
 */
export function getInitials(name: string): string {
  if (!name) return '??';
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Deterministically picks a color from the constant palette based on a UID string.
 */
export function pickColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Formats a timestamp into a 2-digit time string (e.g., "10:30 AM").
 */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Returns a human-readable relative time string.
 */
export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

/**
 * Initial state for new users or fallback preferences.
 */
export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'light',
  accentColor: '#534AB7',
  emailNotifications: true,
  soundNotifications: false,
  compactMode: false,
  showOnlineStatus: true,
};