# Users Module

## Scope

Minimal users module providing safe read access to user records. Used internally by `AuthModule`.

`passwordHash` is NEVER returned by any method in this module. The only place `passwordHash` is read is inside `AuthService.validateUser()` for bcrypt comparison, and it is done via a dedicated `findHashByEmail` method that returns only `{ id, passwordHash }` — never surfaced to the API layer.

## API (Internal)

| Method                   | Return                         | Notes                               |
| ------------------------ | ------------------------------ | ----------------------------------- |
| `findByEmail(email)`     | `SafeUser \| null`             | No passwordHash                     |
| `findById(id)`           | `SafeUser \| null`             | No passwordHash                     |
| `findHashByEmail(email)` | `{ id, passwordHash } \| null` | Internal only — used by AuthService |

## Future

User CRUD (list, create, update, deactivate) will be added in a future story as `@Roles('ADM')` endpoints. The pattern established here (SafeUser type, SAFE_USER_SELECT const) will be reused.

## Module Log

### 2026-05-10 — Initial implementation (M1-S5 / POR-23)

- Created UsersService with findByEmail, findById, findHashByEmail
- UsersModule exports UsersService; imported by AuthModule
