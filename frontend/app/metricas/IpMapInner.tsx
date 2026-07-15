"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = {
  lat: number;
  lon: number;
  city: string | null;
  country: string | null;
  count: number;
  risky: boolean;
};

export default function IpMapInner({ points }: { points: MapPoint[] }) {
  const center: [number, number] = points.length
    ? [points[0].lat, points[0].lon]
    : [20, 0];

  return (
    <MapContainer
      center={center}
      zoom={points.length ? 3 : 2}
      minZoom={1}
      scrollWheelZoom={false}
      worldCopyJump
      style={{ height: "100%", width: "100%", background: "#0a0a0a" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
        subdomains="abcd"
      />
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={[p.lat, p.lon]}
          // Radio ~ volumen de visitas (círculo = zona aproximada, no punto exacto).
          radius={Math.min(6 + Math.sqrt(p.count) * 3, 22)}
          pathOptions={{
            color: p.risky ? "#f59e0b" : "#10b981",
            fillColor: p.risky ? "#f59e0b" : "#10b981",
            fillOpacity: 0.35,
            weight: 1.5,
          }}
        >
          <Popup>
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>
              <strong>
                {[p.city, p.country].filter(Boolean).join(", ") || "Ubicación desconocida"}
              </strong>
              <br />
              {p.count} visita{p.count !== 1 ? "s" : ""}
              {p.risky ? " · ⚠️ VPN / datacenter" : ""}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
