export interface BranchEmailLists {
  emails?: string[] | null;
  contactEmails?: string[] | null;
  centralEmails?: string[] | null;
}

/** Distinct, non-blank addresses, preserving the first spelling and order. */
export function dedupeEmails(addresses: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of addresses) {
    const address = raw.trim();
    if (address === '') continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(address);
  }

  return result;
}

/** Append every email list exposed by Branch to an outbound Cc field. */
export function appendBranchCc(cc: string[] | null | undefined, branch?: BranchEmailLists | null) {
  return dedupeEmails([
    ...(cc ?? []),
    ...(branch?.emails ?? []),
    ...(branch?.contactEmails ?? []),
    ...(branch?.centralEmails ?? []),
  ]);
}
