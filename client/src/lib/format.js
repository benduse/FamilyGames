const dateTime = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});
const dateOnly = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const longDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

export const fmtDateTime = (iso) => dateTime.format(new Date(iso));
export const fmtDate = (iso) => dateOnly.format(new Date(iso));
export const fmtToday = () => longDate.format(new Date());

export const PLAYER_COLORS = [
  { hex: '#3D3BBF', name: 'Indigo' },
  { hex: '#E5484D', name: 'Coral' },
  { hex: '#1A9E5C', name: 'Green' },
  { hex: '#F5B700', name: 'Gold' },
  { hex: '#0EA5E9', name: 'Sky' },
  { hex: '#D946EF', name: 'Magenta' },
  { hex: '#F97316', name: 'Orange' },
  { hex: '#14B8A6', name: 'Teal' },
];

export const winnerText = (winners) => {
  if (!winners?.length) return 'No winner';
  if (winners.length === 1) return `${winners[0].name} won`;
  return `Tie: ${winners.map((w) => w.name).join(' & ')}`;
};
