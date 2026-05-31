import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { PortVesselFinder } from '../../../features/vessels/components/PortVesselFinder';

// These two params restore the essential view when navigating back from a
// vessel detail page. Filters (ETA, cargo, toggles) are intentionally omitted
// to keep the URL minimal — they reset on each visit.
export const VesselsSearchSchema = z.object({
  unlocode: z.string().optional(),
  terminal: z.string().optional(), // terminal_code of the selected terminal
});

export const Route = createFileRoute('/_protected/vessels/')({
  validateSearch: (search) => VesselsSearchSchema.parse(search),
  component: VesselsPage,
});

function VesselsPage() {
  return <PortVesselFinder />;
}
