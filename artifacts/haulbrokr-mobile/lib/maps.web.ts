import React from "react";
import { View, Text, StyleSheet } from "react-native";

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type MapType = "standard" | "satellite" | "hybrid" | "terrain" | "none" | "mutedStandard";

function MapView({ children, style, initialRegion, onRegionChange }: {
  children?: React.ReactNode;
  style?: any;
  initialRegion?: Region;
  onRegionChange?: (r: Region) => void;
  [key: string]: any;
}) {
  return React.createElement(
    View,
    { style: [webStyles.map, style] },
    React.createElement(
      View,
      { style: webStyles.placeholder },
      React.createElement(Text, { style: webStyles.label }, "Map — open in Expo Go to see live map"),
    ),
    children,
  );
}

export function Marker(_props: any) { return null; }
export function Circle(_props: any) { return null; }

const webStyles = StyleSheet.create({
  map:         { flex: 1, backgroundColor: "#0f172a", overflow: "hidden" },
  placeholder: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  label:       { color: "#4b6080", fontSize: 13, fontFamily: "Inter_500Medium" },
});

export default MapView;
