import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import L, { type LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { HistoryPosition } from '@portlog/schemas';

interface VesselHistoryMapProps {
  positions: HistoryPosition[];
  vesselName?: string;
}

function FitBounds({ positions }: { positions: LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, positions]);
  return null;
}

export function VesselHistoryMap({ positions, vesselName }: VesselHistoryMapProps) {
  const sorted = useMemo(
    () => [...positions].sort((a, b) => a.last_position_epoch - b.last_position_epoch),
    [positions],
  );

  const coords = useMemo<LatLngTuple[]>(() => sorted.map((p) => [p.lat, p.lon]), [sorted]);

  // Detect clusters of stationary positions (potential port stops)
  const stops = useMemo(() => {
    const result: { position: HistoryPosition; startIdx: number; endIdx: number }[] = [];
    let i = 0;
    while (i < sorted.length) {
      const cur = sorted[i];
      if (cur && cur.speed < 0.5) {
        const start = i;
        while (i < sorted.length && (sorted[i]?.speed ?? 1) < 0.5) i++;
        const end = i - 1;
        if (end > start) {
          const mid = sorted[Math.floor((start + end) / 2)];
          if (mid) result.push({ position: mid, startIdx: start, endIdx: end });
        }
      } else {
        i++;
      }
    }
    return result;
  }, [sorted]);

  if (coords.length === 0) return null;

  const center = coords[Math.floor(coords.length / 2)]!;
  const latest = sorted[sorted.length - 1]!;

  return (
    <div style={{ height: 420, borderRadius: 8, overflow: 'hidden', border: '1px solid #dee2e6' }}>
      <MapContainer
        center={center}
        zoom={5}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds positions={coords} />

        <Polyline positions={coords} color="#228be6" weight={2} opacity={0.7} />

        {stops.map((stop, i) => (
          <CircleMarker
            key={`stop-${i}`}
            center={[stop.position.lat, stop.position.lon]}
            radius={7}
            fillColor="#fd7e14"
            fillOpacity={0.9}
            color="#e8590c"
            weight={2}
          >
            <Popup>
              <div style={{ fontSize: 12 }}>
                <strong>Parada detectada</strong>
                <br />
                Estado: {stop.position.navigation_status || '—'}
                <br />
                Destino: {stop.position.destination || '—'}
                <br />
                Desde: {sorted[stop.startIdx]?.last_position_UTC}
                <br />
                Hasta: {sorted[stop.endIdx]?.last_position_UTC}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        <CircleMarker
          center={[latest.lat, latest.lon]}
          radius={8}
          fillColor="#2f9e44"
          fillOpacity={1}
          color="#2b8a3e"
          weight={2}
        >
          <Popup>
            <div style={{ fontSize: 12 }}>
              <strong>{vesselName ?? 'Última posición'}</strong>
              <br />
              Velocidad: {latest.speed} kn
              <br />
              Rumbo: {latest.course}°
              <br />
              Estado: {latest.navigation_status || '—'}
              <br />
              {latest.last_position_UTC}
            </div>
          </Popup>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
