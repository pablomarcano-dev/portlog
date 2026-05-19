import { createFileRoute } from '@tanstack/react-router';
import { PortVesselFinder } from '../../../features/vessels/components/PortVesselFinder';

export const Route = createFileRoute('/_protected/vessels/')({
  component: VesselsPage,
});

function VesselsPage() {
  return <PortVesselFinder />;
}
