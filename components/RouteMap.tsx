'use client';

import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { Fragment, useEffect } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { plottedPoints, type LatLngTuple } from '@/lib/geo';
import type { Route } from '@/lib/types';

const originIcon = L.divIcon({
  className: '',
  html: '<span class="ghost-pin ghost-pin-origin"></span>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const destinationIcon = L.divIcon({
  className: '',
  html: '<span class="ghost-pin"></span>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

type RouteMapProps = {
  routes: Route[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function MapViewport({ routes, selectedId }: Pick<RouteMapProps, 'routes' | 'selectedId'>) {
  const map = useMap();

  useEffect(() => {
    // Leaflet measures its container on mount; a tick later it knows its real size.
    const timer = window.setTimeout(() => map.invalidateSize(), 150);
    return () => window.clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    const selected = routes.find((route) => route.id === selectedId);
    const selectedPoints = selected ? plottedPoints(selected) : null;

    if (selectedPoints) {
      const bounds = L.latLngBounds([selectedPoints.origin, selectedPoints.destination]);
      map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 8, duration: 0.8 });
      return;
    }

    const points: LatLngTuple[] = routes
      .map((route) => plottedPoints(route))
      .filter((points): points is NonNullable<typeof points> => points !== null)
      .flatMap((points) => [points.origin, points.destination]);

    if (points.length === 0) return;

    if (points.length === 1) {
      map.flyTo(points[0], 6, { duration: 0.8 });
      return;
    }

    map.flyToBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 6, duration: 0.8 });
  }, [map, routes, selectedId]);

  return null;
}

export default function RouteMap({ routes, selectedId, onSelect }: RouteMapProps) {
  return (
    <MapContainer
      center={[24, 8]}
      zoom={2}
      minZoom={2}
      scrollWheelZoom
      worldCopyJump
      zoomControl
      className="h-full w-full"
    >
      <TileLayer url={TILES} attribution={ATTRIBUTION} subdomains="abcd" maxZoom={20} />
      <MapViewport routes={routes} selectedId={selectedId} />

      {routes.map((route) => {
        const points = plottedPoints(route);
        if (!points) return null;

        const isSelected = route.id === selectedId;

        return (
          <Fragment key={route.id}>
            <Polyline
              positions={[points.origin, points.destination]}
              pathOptions={{
                color: isSelected ? '#c4b5fd' : '#a78bfa',
                weight: isSelected ? 3 : 2,
                opacity: isSelected ? 0.95 : 0.6,
                dashArray: '6 8',
                lineCap: 'round',
              }}
            />
            <Marker position={points.origin} icon={originIcon} eventHandlers={{ click: () => onSelect(route.id) }}>
              <Popup>
                <strong className="text-ghost-spirit">Origin</strong>
                <br />
                {route.origin}
              </Popup>
            </Marker>
            <Marker
              position={points.destination}
              icon={destinationIcon}
              eventHandlers={{ click: () => onSelect(route.id) }}
            >
              <Popup>
                <strong className="text-ghost-haze">Destination</strong>
                <br />
                {route.destination}
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
