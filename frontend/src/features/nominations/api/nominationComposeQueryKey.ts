export function nominationComposeQueryKey(
  nominationId: string | undefined,
  actionType: string | undefined,
  senderId: string | undefined,
) {
  // Keep the nomination/compose prefix for existing draft invalidation.
  return ['nomination', nominationId, 'compose', actionType, { senderId }] as const;
}
