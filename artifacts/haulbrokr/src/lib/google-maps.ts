declare global {
  interface Window {
    google?: any;
    __haulbrokrWebMapInit?: () => void;
  }
}

export function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not set"));
  return new Promise((resolve, reject) => {
    window.__haulbrokrWebMapInit = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=__haulbrokrWebMapInit`;
    s.async = true;
    s.onerror = () => reject(new Error("Google Maps script failed"));
    document.head.appendChild(s);
  });
}

export const MAP_DARK_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1c2333" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1628" }] },
];
