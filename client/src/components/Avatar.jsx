import { useState } from 'react';
import { photoUrl } from '../lib/api.js';

// Dark text on light player colors (gold, sky, orange) so initials stay readable
function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1c1b22' : '#fff';
}

export default function Avatar({ player, size = 40, ring = true }) {
  const [broken, setBroken] = useState(false);
  const src = photoUrl(player);
  const color = player?.color || '#6b6a75';
  const name = player?.name || player?.playerName || '?';
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: color, color: textOn(color), fontSize: size * 0.4, '--ring': ring ? color : 'transparent' }}
      title={name}
    >
      {src && !broken
        ? <img src={src} alt={name} onError={() => setBroken(true)} />
        : <span aria-hidden="true">{initials}</span>}
    </span>
  );
}
