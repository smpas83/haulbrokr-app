import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapType =
  | "standard"
  | "satellite"
  | "hybrid"
  | "terrain"
  | "none"
  | "mutedStandard";

type LatLng = { latitude: number; longitude: number };

declare global {
  interface Window {
    google?: any;
    __haulbrokrMapsInit?: () => void;
  }
}

let mapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;

  const key =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY;

  mapsScriptPromise = new Promise((resolve, reject) => {
    if (!key) {
      reject(new Error("GOOGLE_MAPS_API_KEY not configured"));
      return;
    }
    window.__haulbrokrMapsInit = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__haulbrokrMapsInit`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return mapsScriptPromise;
}

function regionToZoom(latitudeDelta: number): number {
  return Math.round(Math.log(360 / latitudeDelta) / Math.LN2);
}

function MapView({
  children,
  style,
  initialRegion,
  mapType = "standard",
  customMapStyle,
  onRegionChange,
  onRegionChangeComplete,
}: {
  children?: React.ReactNode;
  style?: any;
  initialRegion?: Region;
  mapType?: MapType;
  customMapStyle?: object[];
  onRegionChange?: (r: Region) => void;
  onRegionChangeComplete?: (r: Region) => void;
  [key: string]: any;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circlesRef = useRef<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.maps) return;
        const center = initialRegion ?? {
          latitude: 39.8283,
          longitude: -98.5795,
          latitudeDelta: 35,
          longitudeDelta: 35,
        };
        mapRef.current = new window.google.maps.Map(containerRef.current, {
          center: { lat: center.latitude, lng: center.longitude },
          zoom: regionToZoom(center.latitudeDelta),
          mapTypeId:
            mapType === "satellite"
              ? "satellite"
              : mapType === "hybrid"
                ? "hybrid"
                : "roadmap",
          styles: customMapStyle,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        mapRef.current.addListener("idle", () => {
          const c = mapRef.current.getCenter();
          const b = mapRef.current.getBounds();
          if (!c || !b) return;
          const ne = b.getNorthEast();
          const sw = b.getSouthWest();
          const region: Region = {
            latitude: c.lat(),
            longitude: c.lng(),
            latitudeDelta: ne.lat() - sw.lat(),
            longitudeDelta: ne.lng() - sw.lng(),
          };
          onRegionChange?.(region);
          onRegionChangeComplete?.(region);
        });
        setReady(true);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Map failed to load"),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return;
    markersRef.current.forEach((m) => m.setMap(null));
    circlesRef.current.forEach((c) => c.setMap(null));
    markersRef.current = [];
    circlesRef.current = [];

    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === Marker) {
        const { coordinate, pinColor, title, description } =
          child.props as MarkerProps;
        if (!coordinate) return;
        const marker = new window.google.maps.Marker({
          map: mapRef.current,
          position: { lat: coordinate.latitude, lng: coordinate.longitude },
          title: title ?? description,
          icon: pinColor
            ? {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: pinColor,
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              }
            : undefined,
        });
        markersRef.current.push(marker);
      }
      if (child.type === Circle) {
        const { center, radius, fillColor, strokeColor, strokeWidth } =
          child.props as CircleProps;
        const circle = new window.google.maps.Circle({
          map: mapRef.current,
          center: { lat: center.latitude, lng: center.longitude },
          radius,
          fillColor: fillColor ?? "rgba(245,158,11,0.13)",
          fillOpacity: 0.4,
          strokeColor: strokeColor ?? "rgba(245,158,11,0.40)",
          strokeWeight: strokeWidth ?? 1.5,
        });
        circlesRef.current.push(circle);
      }
    });
  }, [children, ready]);

  if (error) {
    return React.createElement(
      View,
      { style: [webStyles.map, style] },
      React.createElement(
        View,
        { style: webStyles.placeholder },
        React.createElement(
          Text,
          { style: webStyles.label },
          `Map unavailable: ${error}`,
        ),
        React.createElement(
          Text,
          { style: webStyles.sub },
          "Set GOOGLE_MAPS_API_KEY in EAS secrets for web maps.",
        ),
      ),
    );
  }

  return React.createElement(
    View,
    { style: [webStyles.map, style] },
    React.createElement("div", {
      ref: containerRef,
      style: { width: "100%", height: "100%", minHeight: 280 },
    }),
  );
}

type MarkerProps = {
  coordinate: LatLng;
  pinColor?: string;
  title?: string;
  description?: string;
  onPress?: () => void;
};

export function Marker(_props: MarkerProps) {
  return null;
}

type CircleProps = {
  center: LatLng;
  radius: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
};

export function Circle(_props: CircleProps) {
  return null;
}

const webStyles = StyleSheet.create({
  map: { flex: 1, backgroundColor: "#0f172a", overflow: "hidden" },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  label: {
    color: "#93c5fd",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  sub: {
    color: "#4b6080",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
  },
});

export default MapView;
