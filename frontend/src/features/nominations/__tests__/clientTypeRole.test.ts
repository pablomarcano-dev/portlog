import { describe, expect, it } from 'vitest';
import { clientDirectoryIdField, clientTypeToDirectory } from '../clientTypeRole';

describe('clientTypeToDirectory', () => {
  it.each([
    ['Charterer', 'charterer'],
    ['Disponent Owner', 'owner'],
    ['Head Owner', 'owner'],
    ['Commercial Operator', 'operator'],
    ['Technical Operator', 'operator'],
    ['Shipper', 'shipper'],
  ] as const)('feeds %s from the %s master-data group', (type, directory) => {
    expect(clientTypeToDirectory(type)).toBe(directory);
  });

  it('leaves custom rows free-form', () => {
    expect(clientTypeToDirectory('Receivers')).toBeUndefined();
  });

  it.each([
    ['charterer', 'chartererId'],
    ['owner', 'ownerId'],
    ['operator', 'operatorId'],
    ['shipper', 'shipperId'],
  ] as const)('stores %s selections in %s', (directory, idField) => {
    expect(clientDirectoryIdField(directory)).toBe(idField);
  });

  it('does not assign a directory id field to manual rows', () => {
    expect(clientDirectoryIdField(undefined)).toBeUndefined();
  });
});
