import { BadRequestException, ConflictException } from '@nestjs/common';
export const PHONE_SELECT = { kind: true, number: true, label: true, sortOrder: true } as const;
export const ADDRESS_SELECT = { purpose: true, text: true, label: true, sortOrder: true } as const;
export const COMMUNICATION_SELECT = {
  emails: true,
  phones: { orderBy: { sortOrder: 'asc' }, select: PHONE_SELECT },
  addresses: { orderBy: { sortOrder: 'asc' }, select: ADDRESS_SELECT },
} as const;
export function directoryError(error: unknown): never {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    if (error.code === 'P2003' || error.code === 'P2025')
      throw new BadRequestException(
        'A selected record no longer exists, or this record is still in use.',
      );
    if (error.code === 'P2002')
      throw new ConflictException('An address purpose or association is duplicated.');
  }
  throw error;
}
