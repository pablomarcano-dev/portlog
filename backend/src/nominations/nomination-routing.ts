import { dedupeEmails } from '../email/email-address.util.js';
export const ROUTING_GROUP_SELECT = {
  id: true,
  name: true,
  members: {
    orderBy: { order: 'asc' as const },
    select: { id: true, email: true, displayName: true, order: true },
  },
} as const;
export const NOMINATION_ROUTING_SELECT = {
  masterContact: { select: { id: true, name: true, emails: true } },
  firstMessageGroup: { select: ROUTING_GROUP_SELECT },
  secondMessageGroup: { select: ROUTING_GROUP_SELECT },
  thirdMessageGroup: { select: ROUTING_GROUP_SELECT },
  alwaysCopyGroup: { select: ROUTING_GROUP_SELECT },
} as const;
export type RoutingGroup = {
  id: string;
  name: string;
  members: { email: string; displayName?: string | null }[];
};
export type NominationRouting = {
  master?: string | null;
  masterContact?: { name: string; emails: string[] } | null;
  shipParticular?: { emails?: string[]; name?: string } | null;
  firstMessageGroup?: RoutingGroup | null;
  secondMessageGroup?: RoutingGroup | null;
  thirdMessageGroup?: RoutingGroup | null;
  alwaysCopyGroup?: RoutingGroup | null;
};
export function captainRouting(nomination: NominationRouting) {
  const personal = dedupeEmails(nomination.masterContact?.emails ?? []);
  const vessel = dedupeEmails(nomination.shipParticular?.emails ?? []);
  return {
    captainEmails: personal.length ? personal : vessel,
    captainName: nomination.masterContact?.name ?? nomination.master ?? '',
    captainSource: personal.length
      ? ('contact' as const)
      : vessel.length
        ? ('vessel' as const)
        : ('none' as const),
  };
}
export function messageOverride(nomination: NominationRouting, order: number) {
  return (
    [nomination.firstMessageGroup, nomination.secondMessageGroup, nomination.thirdMessageGroup][
      order - 1
    ] ?? null
  );
}
export function alwaysCopyEmails(nomination: NominationRouting) {
  return dedupeEmails(nomination.alwaysCopyGroup?.members.map((member) => member.email) ?? []);
}
export function uniqueEnvelope(to: string[], cc: string[], bcc: string[]) {
  const toAddresses = dedupeEmails(to);
  const used = new Set(toAddresses.map((email) => email.toLowerCase()));
  const ccAddresses = dedupeEmails(cc).filter((email) => !used.has(email.toLowerCase()));
  ccAddresses.forEach((email) => used.add(email.toLowerCase()));
  return {
    toAddresses,
    ccAddresses,
    bccAddresses: dedupeEmails(bcc).filter((email) => !used.has(email.toLowerCase())),
  };
}
