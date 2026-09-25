export type Hive = { key: string; name: string; channel: number; field: number; color: string };
export type Point = { t: number; v: number };
export const DAY = 86_400_000;
export const HIVES: Hive[] = [
  { key: 'rot', name: 'Rotes Volk', channel: 1647964, field: 4, color: '#df5b51' },
  { key: 'gelb', name: 'Gelbes Volk', channel: 1705928, field: 4, color: '#b78312' },
  { key: 'schnecke', name: 'Schnecken-Volk', channel: 2038308, field: 3, color: '#388575' },
  { key: 'ameisenbaer', name: 'Ameisenbär-Volk', channel: 2038308, field: 1, color: '#667ac5' }
];
export type Feed = Record<string, unknown>;
export function parsePoints(feeds: Feed[], field: number, now = Date.now()): Point[] {
  const unique = new Map<number, Point>();
  for (const feed of feeds) {
    const raw = feed['field' + field];
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    if (String(raw).trim() === '') continue;
    const t = Date.parse(String(feed.created_at));
    const v = Number(raw);
    // Keep plausible scale values, including real zero/negative calibration values.
    if (Number.isFinite(t) && t <= now + 300_000 && Number.isFinite(v) && v >= -100 && v <= 500)
      unique.set(t, { t, v });
  }
  return [...unique.values()].sort((a,b) => a.t-b.t);
}
export async function fetchWindow(channel: number, start: number, end: number, depth = 0): Promise<Feed[]> {
  const date = (t: number) => new Date(t).toISOString().slice(0,19).replace('T', ' ');
  const params = new URLSearchParams({start: date(start), end: date(end), results:'8000', timezone:'UTC'});
  const response = await fetch(`https://api.thingspeak.com/channels/${channel}/feeds.json?${params}`, { signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  if (!response.ok) throw new Error(`ThingSpeak HTTP ${response.status}`);
  const body = await response.json();
  if (!body || !Array.isArray(body.feeds) || Number(body.channel?.id) !== channel) throw new Error('Ungültige ThingSpeak-Antwort');
  if (body.feeds.length >= 8000) {
    if (depth >= 10 || end-start < 2000) throw new Error('ThingSpeak-Datenfenster zu dicht');
    const middle = Math.floor((start+end)/2000)*1000;
    return [...await fetchWindow(channel,start,middle,depth+1), ...await fetchWindow(channel,middle,end,depth+1)];
  }
  return body.feeds;
}
export async function fetchLive(channel:number): Promise<Feed[]> {
  // <=100 results bypass ThingSpeak's cached large-feed responses.
  const response = await fetch(`https://api.thingspeak.com/channels/${channel}/feeds.json?results=100`, { signal:AbortSignal.timeout(15_000), cache:'no-store' });
  if (!response.ok) throw new Error(`ThingSpeak HTTP ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body?.feeds) || Number(body.channel?.id)!==channel) throw new Error('Ungültige ThingSpeak-Antwort');
  return body.feeds;
}
