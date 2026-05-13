interface PortItem {
  id: string;
  name: string;
  abbreviation?: string | null;
}

export type PortMatchResult =
  | { status: 'match'; port: PortItem }
  | { status: 'none' }
  | { status: 'multiple' };

export function matchPortByName(ports: PortItem[], aisPortName: string | null): PortMatchResult {
  if (!aisPortName) return { status: 'none' };
  const needle = aisPortName.toLowerCase().trim();
  const matches = ports.filter(
    (p) => p.name.toLowerCase().includes(needle) || p.abbreviation?.toLowerCase() === needle,
  );
  if (matches.length === 1) return { status: 'match', port: matches[0]! };
  if (matches.length === 0) return { status: 'none' };
  return { status: 'multiple' };
}
