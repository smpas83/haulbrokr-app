import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker, Polyline } from "@/lib/maps";
import { mapColor } from "@workspace/design-tokens";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface TruckMarkerProps {
  coordinate: Coordinate;
  label?: string;
}

export function TruckMarker({ coordinate, label }: TruckMarkerProps) {
  return (
    <Marker coordinate={coordinate} pinColor={mapColor.truck}>
      {label ? <View style={[styles.label, { backgroundColor: mapColor.truck }]}><Text style={styles.labelText}>{label}</Text></View> : null}
    </Marker>
  );
}

export interface DriverMarkerProps {
  coordinate: Coordinate;
  label?: string;
}

export function DriverMarker({ coordinate, label }: DriverMarkerProps) {
  return (
    <Marker coordinate={coordinate} pinColor={mapColor.driver}>
      {label ? <View style={[styles.label, { backgroundColor: mapColor.driver }]}><Text style={styles.labelText}>{label}</Text></View> : null}
    </Marker>
  );
}

export interface JobMarkerProps {
  coordinate: Coordinate;
  label?: string;
}

export function JobMarker({ coordinate, label }: JobMarkerProps) {
  return (
    <Marker coordinate={coordinate} pinColor={mapColor.job}>
      {label ? <View style={[styles.label, { backgroundColor: mapColor.job }]}><Text style={styles.labelText}>{label}</Text></View> : null}
    </Marker>
  );
}

export interface RoutePolylineProps {
  coordinates: Coordinate[];
}

export function RoutePolyline({ coordinates }: RoutePolylineProps) {
  return (
    <Polyline
      coordinates={coordinates}
      strokeColor={mapColor.route}
      strokeWidth={3}
      lineDashPattern={[4, 4]}
    />
  );
}

export interface ETAOverlayProps {
  eta: string;
}

export function ETAOverlay({ eta }: ETAOverlayProps) {
  return (
    <View style={[styles.eta, { backgroundColor: mapColor.eta }]}>
      <Text style={styles.etaText}>ETA {eta}</Text>
    </View>
  );
}

export function FleetLayer({ children }: { children?: React.ReactNode }) {
  return <View style={styles.layer}>{children}</View>;
}

export function CustomerLayer({ children }: { children?: React.ReactNode }) {
  return <View style={styles.layer}>{children}</View>;
}

const styles = StyleSheet.create({
  label: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  labelText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  eta: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  etaText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});
