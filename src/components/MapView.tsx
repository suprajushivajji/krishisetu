"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface MapViewProps {
  center: [number, number]; // [lat, lng]
  zoom?: number;
  userLocation?: [number, number]; // [lat, lng] for "YOU" marker
  markers?: Array<{
    lat: number;
    lng: number;
    title: string;
    description?: string;
    isVerified?: boolean;
    price?: number;
    onClick?: () => void;
    type?: "buyer" | "mandi";
  }>;
  maptilerKey?: string;
}

export function MapView({
  center,
  zoom = 11,
  userLocation,
  markers = [],
  maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || "",
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    // Dynamically import Leaflet on client-side
    import("leaflet").then((L) => {
      // Fix default Leaflet icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const container = mapContainerRef.current;
      if (!container) return;

      if (!mapInstanceRef.current) {
        const map = L.map(container).setView(center, zoom);

        // Tile layer from MapTiler raster or standard OSM fallback
        const tileUrl = maptilerKey
          ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${maptilerKey}`
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

        L.tileLayer(tileUrl, {
          attribution:
            '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.setView(center, zoom);
      }

      const map = mapInstanceRef.current;

      // Clear existing markers (except tile layers)
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
          map.removeLayer(layer);
        }
      });

      // Add "YOU" Farm Marker (use userLocation if provided, otherwise center)
      const youLocation = userLocation || center;
      const farmIcon = L.divIcon({
        className: "custom-farm-pin",
        html: `<div style="background:#174a35; color:#d6eb65; border:3px solid #fff; border-radius:50%; width:34px; height:34px; display:grid; place-items:center; font-weight:bold; font-size:11px; box-shadow:0 4px 10px rgba(0,0,0,0.3);">YOU</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      L.marker(youLocation, { icon: farmIcon })
        .addTo(map)
        .bindPopup("<b>Your Farm / Search Location</b><br/>GPS & Benchmark Origin")
        .openPopup();

      // Add Buyer and Mandi Markers
      markers.forEach((m) => {
        const isMandi = m.type === "mandi";
        const markerColor = isMandi ? "#cf9478" : m.isVerified ? "#2f7d4a" : "#e9a23b";
        
        const markerPin = L.divIcon({
          className: isMandi ? "custom-mandi-pin" : "custom-buyer-pin",
          html: `<div style="background:${markerColor}; color:#fff; border:2px solid #fff; border-radius:50%; width:32px; height:32px; display:grid; place-items:center; font-weight:bold; font-size:11px; box-shadow:0 4px 10px rgba(0,0,0,0.25);">${isMandi ? "M" : "₹"}${m.price || 34}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([m.lat, m.lng], { icon: markerPin }).addTo(map);
        marker.bindPopup(`
          <div style="font-family:'DM Sans',sans-serif; min-width:140px;">
            <strong style="color:#174a35; font-size:13px; display:block;">${m.title}</strong>
            <span style="color:#6b7d70; font-size:11px;">${m.description || ""}</span>
            <div style="margin-top:6px; font-weight:bold; color:${isMandi ? "#cf9478" : "#2f7d4a"};">${isMandi ? "Mandi Price" : "Buying at"} ₹${m.price || 34}/kg</div>
          </div>
        `);

        if (m.onClick) {
          marker.on("click", m.onClick);
        }
      });
    });

    return () => {
      // Map instance preserved across re-renders
    };
  }, [center, zoom, markers, maptilerKey]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "440px",
        borderRadius: "12px",
        zIndex: 1,
      }}
    />
  );
}
