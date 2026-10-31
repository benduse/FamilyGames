// Dice logo used in the header, auth screens and 404 page
export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--primary)" />
      <circle cx="10" cy="10" r="2.6" fill="#fff" />
      <circle cx="16" cy="16" r="2.6" fill="var(--accent)" />
      <circle cx="22" cy="22" r="2.6" fill="#fff" />
    </svg>
  );
}
