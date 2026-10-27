import { captainRouting, messageOverride, uniqueEnvelope } from './nomination-routing';
describe('nomination routing helpers', () => {
  it('retains vessel inbox fallback for unlinked historical nominations', () => {
    expect(
      captainRouting({
        master: 'Historical Name',
        shipParticular: { emails: [' bridge@example.test ', 'BRIDGE@example.test'] },
      }),
    ).toEqual({
      captainName: 'Historical Name',
      captainEmails: ['bridge@example.test'],
      captainSource: 'vessel',
    });
    expect(captainRouting({}).captainEmails).toEqual([]);
  });
  it('does not reuse another slot override', () => {
    const group = { id: 'one', name: 'One', members: [] };
    expect(messageOverride({ firstMessageGroup: group }, 1)).toBe(group);
    expect(messageOverride({ firstMessageGroup: group }, 2)).toBeNull();
  });
  it('deduplicates across the envelope in To, CC, BCC order', () => {
    expect(
      uniqueEnvelope(
        [' to@example.test ', 'TO@example.test'],
        ['To@example.test', 'copy@example.test'],
        ['COPY@example.test', 'hidden@example.test'],
      ),
    ).toEqual({
      toAddresses: ['to@example.test'],
      ccAddresses: ['copy@example.test'],
      bccAddresses: ['hidden@example.test'],
    });
  });
});
