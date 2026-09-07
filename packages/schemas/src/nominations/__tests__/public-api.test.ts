import {
  PublicNominationListQuerySchema,
  PublicNominationListResponseSchema,
} from '../public-api.js';

describe('public nominations API schemas', () => {
  it('applies safe pagination and sorting defaults', () => {
    expect(PublicNominationListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 25,
      sort: '-updatedAt',
    });
  });

  it('rejects unsupported sort fields and oversized pages', () => {
    expect(PublicNominationListQuerySchema.safeParse({ sort: 'subject' }).success).toBe(false);
    expect(PublicNominationListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it('accepts an empty first page response', () => {
    expect(
      PublicNominationListResponseSchema.parse({
        data: [],
        pagination: {
          page: 1,
          pageSize: 25,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
    ).toBeDefined();
  });
});
