import {
  formatNominationNoticeSubject,
  nominationCreateSubjectOverride,
  type NominationNoticeSubjectParts,
} from '../notice-subject.js';

const parts: NominationNoticeSubjectParts = {
  referenceNo: 'GLP7705642',
  vesselName: 'CECH',
  terminalName: 'PDVSA EL PALITO TERMINAL',
  businessReference: 'SN3140/26/PBO',
};

describe('nomination notice subject', () => {
  it('uses the requested order and TBC when the vessel has not supplied a voyage', () => {
    expect(formatNominationNoticeSubject(parts)).toBe(
      'GLP7705642 CECH VOY. TBC - CALLING TO PDVSA EL PALITO TERMINAL SN3140/26/PBO',
    );
  });

  it('keeps the reference, actual vessel voyage and supplied business number distinct', () => {
    expect(formatNominationNoticeSubject({ ...parts, vesselVoyageNumber: '005-26' })).toBe(
      'GLP7705642 CECH VOY. 005-26 - CALLING TO PDVSA EL PALITO TERMINAL SN3140/26/PBO',
    );
  });

  it.each([null, undefined, '', '   '])(
    'omits absent reference %s without an extra delimiter',
    (referenceNo) => {
      expect(formatNominationNoticeSubject({ ...parts, referenceNo })).toBe(
        'CECH VOY. TBC - CALLING TO PDVSA EL PALITO TERMINAL SN3140/26/PBO',
      );
    },
  );

  it('preserves punctuation and an already resolved OT format without allocating or renumbering', () => {
    expect(
      formatNominationNoticeSubject({
        referenceNo: ' CP-8891 ',
        vesselName: " M/T ALFA-1 & SHIP'S ",
        vesselVoyageNumber: ' 005-A ',
        terminalName: ' Terminal (East) ',
        businessReference: ' OT/0031/2026/PLC ',
      }),
    ).toBe("CP-8891 M/T ALFA-1 & SHIP'S VOY. 005-A - CALLING TO Terminal (East) OT/0031/2026/PLC");
  });

  it('does not invent a number for a create preview before its correlative is assigned', () => {
    const preview = formatNominationNoticeSubject({ ...parts, businessReference: undefined });
    expect(preview).toBe('GLP7705642 CECH VOY. TBC - CALLING TO PDVSA EL PALITO TERMINAL');
    expect(nominationCreateSubjectOverride(preview, preview)).toBeUndefined();
  });

  it('preserves manually edited subjects as create overrides', () => {
    const preview = formatNominationNoticeSubject(parts);
    const manual = 'Customer-specific wording / keep exactly';
    expect(nominationCreateSubjectOverride(manual, preview)).toBe(manual);
    expect(nominationCreateSubjectOverride(undefined, preview)).toBeUndefined();
  });
});
