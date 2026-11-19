import { zodResolver as createResolver } from '@hookform/resolvers/zod';
import type { FieldValues } from 'react-hook-form';
import type { ZodType } from 'zod';

/** Existing forms hold parsed domain values; schemas may accept wider raw input. */
export function zodResolver<T extends FieldValues>(schema: ZodType<T, unknown>) {
  // Narrowing the accepted input to the form model is safe: the schema accepts
  // unknown input, and validation/coercion still produces the declared T.
  return createResolver(schema as ZodType<T, T>);
}
