/** Never infer a vessel voyage from a nomination sequence or business SN/OT. */
export function formatVesselVoyageNumber(value: string | null | undefined): string {
  return value?.trim() || 'TBC';
}
