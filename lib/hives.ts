export type Hive = { key: string; name: string; channel: number; field: number };
export type Point = { t: number; v: number };

export const HIVES: Hive[] = [
  { key: 'rot', name: 'Rotes Volk', channel: 1647964, field: 4 },
  { key: 'gelb', name: 'Gelbes Volk', channel: 1705928, field: 4 },
  { key: 'schnecke', name: 'Schnecken-Volk', channel: 2038308, field: 3 },
  { key: 'ameisenbaer', name: 'Ameisenbär-Volk', channel: 2038308, field: 1 }
];

export async function fetchThingSpeak(hive: Hive, results = 800): Promise<Point[]> {
  const url = 'https://api.thingspeak.com/channels/' + hive.channel + '/fields/' + hive.field + '.json?results=' + results;
  const response = await fetch(url);
  if (!response.ok) throw new Error('ThingSpeak ' + response.status);
  const body = await response.json() as { feeds?: Array<Record<string, string>> };
  return (body.feeds || [])
    .map(feed => ({ t: new Date(feed.created_at).getTime(), v: Number(feed['field' + hive.field]) }))
    .filter(point => Number.isFinite(point.t) && Number.isFinite(point.v))
    .sort((a,b) => a.t-b.t);
}
