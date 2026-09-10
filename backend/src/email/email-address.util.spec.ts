import { appendBranchCc, dedupeEmails } from './email-address.util.js';

describe('email address helpers', () => {
  it('deduplicates addresses case-insensitively and preserves the first spelling', () => {
    expect(
      dedupeEmails([' Ops@Example.com ', 'ops@example.com', '', 'master@example.com']),
    ).toEqual(['Ops@Example.com', 'master@example.com']);
  });

  it('copies every branch email list without duplicating existing recipients', () => {
    expect(
      appendBranchCc(['EXISTING@example.com'], {
        emails: ['ops@example.com'],
        contactEmails: ['manager@example.com'],
        centralEmails: ['existing@example.com', 'hq@example.com'],
      }),
    ).toEqual(['EXISTING@example.com', 'ops@example.com', 'manager@example.com', 'hq@example.com']);
  });
});
