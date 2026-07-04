import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Platform, Pressable, RefreshControl, ScrollView, StyleSheet,
  Switch, Text, View,
} from "react-native";
import MapView, { Circle, Marker, Region, MapType } from "@/lib/maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn, FadeInDown, FadeInUp, FadeOut,
} from "react-native-reanimated";

import { LocationFilterModal } from "@/components/LocationFilterModal";
import { STATUS_COLOR } from "@/constants/theme";
import { useApp } from "@/context/AppContext";
import type { Job } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useLiveJobs, useLiveRequests, useMarketplaceMap } from "@/hooks/useLiveApi";
import { useJobCoordinates } from "@/hooks/useJobCoordinates";
import { liveJobToViewJob, liveRequestToViewJob, type LiveJob, type LiveRequest } from "@/lib/liveJob";
import {
  coordFromMarketplace,
  coordFromTruck,
  marketplaceLoadToJob,
  type MarketplaceTruck,
} from "@/lib/marketplaceMap";
import { useFindMyLocation } from "@/hooks/useFindMyLocation";
import { distanceMiles } from "@/lib/geocode";

// Nationwide view when marketplace data loads
const US_REGION: Region = {
  latitude: 39.8283,
  longitude: -98.5795,
  latitudeDelta: 35,
  longitudeDelta: 35,
};

const OPEN_STATUSES = new Set(["open", "bidding", "bid_received"]);

const TRUCK_PIN_COLOR: Record<MarketplaceTruck["status"], string> = {
  available: "#16a34a",
  assigned: "#3b82f6",
  en_route: "#e9a600",
  offline: "#6b7280",
};

// ── Dark map style ────────────────────────────────────────────────────
const DARK_MAP_STYLE = [
  { elementType: "geometry",            stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill",    stylers: [{ color: "#6b7280" }] },
  { elementType: "labels.text.stroke",  stylers: [{ color: "#0f172a" }] },
  { featureType: "administrative",      elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
  { featureType: "road",                elementType: "geometry",        stylers: [{ color: "#1c2333" }] },
  { featureType: "road",                elementType: "geometry.stroke", stylers: [{ color: "#0a1020" }] },
  { featureType: "road.highway",        elementType: "geometry",        stylers: [{ color: "#1e3a54" }] },
  { featureType: "road.highway",        elementType: "geometry.stroke", stylers: [{ color: "#0f172a" }] },
  { featureType: "road.highway",        elementType: "labels.text.fill",stylers: [{ color: "#4b6080" }] },
  { featureType: "water",               elementType: "geometry",        stylers: [{ color: "#0a1628" }] },
  { featureType: "water",               elementType: "labels.text.fill",stylers: [{ color: "#1e3a54" }] },
  { featureType: "poi",                 stylers: [{ visibility: "off" }] },
  { featureType: "transit",             stylers: [{ visibility: "off" }] },
  { featureType: "landscape",           elementType: "geometry",        stylers: [{ color: "#111827" }] },
];

// ── Map type options ──────────────────────────────────────────────────
const MAP_TYPES: { type: MapType; label: string; icon: string }[] = [
  { type: "standard",  label: "Map",      icon: "map"    },
  { type: "satellite", label: "Satellite", icon: "globe"  },
  { type: "hybrid",    label: "Hybrid",    icon: "layers" },
];

// ── Helpers ───────────────────────────────────────────────────────────
function isInRegion(
  coord: { latitude: number; longitude: number },
  region: Region,
): boolean {
  const latMin = region.latitude - region.latitudeDelta / 2;
  const latMax = region.latitude + region.latitudeDelta / 2;
  const lonMin = region.longitude - region.longitudeDelta / 2;
  const lonMax = region.longitude + region.longitudeDelta / 2;
  return (
    coord.latitude >= latMin && coord.latitude <= latMax &&
    coord.longitude >= lonMin && coord.longitude <= lonMax
  );
}

type FilterType = "all" | "open" | "nearby";

// ── Screen ────────────────────────────────────────────────────────────
export default function MapScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { profile, isOnline, setIsOnline,
          userLocation, setUserLocation, searchRadius, setSearchRadius } = useApp();
  const isProvider = profile.role === "provider";

  const { data: liveJobsRaw, refetch: refetchJobs, isFetching: fetchingJobs } = useLiveJobs();
  const {
    data: liveRequestsRaw,
    refetch: refetchRequests,
    isFetching: fetchingRequests,
  } = useLiveRequests({ mine: true, enabled: !isProvider });
  const {
    data: liveOpenRequestsRaw,
    refetch: refetchOpenRequests,
    isFetching: fetchingOpenRequests,
  } = useLiveRequests({ mine: false, enabled: isProvider });

  const { data: marketplace, refetch: refetchMarketplace, isFetching: fetchingMarketplace } = useMarketplaceMap();
  const {
    coords: gpsCoords,
    error: gpsError,
    following: gpsFollowing,
    locating: gpsLocating,
    findLocation: findMyLocation,
    recenter: recenterGps,
    stopFollowing: stopGpsFollowing,
  } = useFindMyLocation();

  const jobs = useMemo<Job[]>(() => {
    if (marketplace?.loads?.length) {
      return marketplace.loads.map(marketplaceLoadToJob);
    }
    const fromJobs = Array.isArray(liveJobsRaw)
      ? (liveJobsRaw as LiveJob[]).map(liveJobToViewJob)
      : [];
    if (isProvider) {
      const fromOpenRequests = Array.isArray(liveOpenRequestsRaw)
        ? (liveOpenRequestsRaw as LiveRequest[])
            .filter((r) => OPEN_STATUSES.has(r.status))
            .map(liveRequestToViewJob)
        : [];
      return [...fromOpenRequests, ...fromJobs];
    }
    const fromRequests = Array.isArray(liveRequestsRaw)
      ? (liveRequestsRaw as LiveRequest[])
          .filter((r) => OPEN_STATUSES.has(r.status))
          .map(liveRequestToViewJob)
      : [];
    return [...fromRequests, ...fromJobs];
  }, [marketplace, liveJobsRaw, liveRequestsRaw, liveOpenRequestsRaw, isProvider]);

  const trucks = marketplace?.trucks ?? [];
  const heatZones = marketplace?.heatZones?.length
    ? marketplace.heatZones.map((z) => ({ latitude: z.latitude, longitude: z.longitude, radius: z.radius }))
    : [];

  const { coordsByJobId, loading: geocoding } = useJobCoordinates(
    marketplace?.loads?.length ? [] : jobs,
  );

  const getCoord = useCallback((job: Job) => {
    if (marketplace?.loads?.length) {
      const load = marketplace.loads.find((l) => l.id === job.id);
      if (load) return coordFromMarketplace(load);
    }
    return coordsByJobId[job.id] ?? null;
  }, [coordsByJobId, marketplace]);

  const [selectedPin,      setSelectedPin]      = useState<string | null>(null);
  const [activeFilter,     setActiveFilter]      = useState<FilterType>("all");
  const [showSurge,        setShowSurge]         = useState(true);
  const [showLocationModal,setShowLocationModal] = useState(false);
  const [isFullscreen,     setIsFullscreen]      = useState(false);
  const [mapType,          setMapType]           = useState<MapType>("standard");
  // Committed visible region (updated by "Search this area")
  const [visibleRegion,    setVisibleRegion]     = useState<Region>(US_REGION);
  // Pending region while dragging — triggers the search button
  const [pendingRegion,    setPendingRegion]     = useState<Region | null>(null);
  const [showSearchHere,   setShowSearchHere]    = useState(false);
  const [refreshing,       setRefreshing]        = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchJobs(), refetchRequests(), refetchOpenRequests(), refetchMarketplace()]);
      setVisibleRegion(pendingRegion ?? US_REGION);
      setPendingRegion(null);
      setShowSearchHere(false);
      setSelectedPin(null);
    } finally {
      setRefreshing(false);
    }
  }, [pendingRegion, refetchJobs, refetchRequests, refetchOpenRequests, refetchMarketplace]);

  const centerOnUser = useCallback(async (follow = false) => {
    const found = await findMyLocation({ follow });
    if (found && mapRef.current) {
      const region = {
        latitude: found.latitude,
        longitude: found.longitude,
        latitudeDelta: 0.35,
        longitudeDelta: 0.35,
      };
      mapRef.current.animateToRegion(region, 600);
      setVisibleRegion(region);
    }
  }, [findMyLocation]);

  useEffect(() => {
    if (!gpsFollowing || !gpsCoords || !mapRef.current) return;
    mapRef.current.animateToRegion({
      latitude: gpsCoords.latitude,
      longitude: gpsCoords.longitude,
      latitudeDelta: visibleRegion.latitudeDelta,
      longitudeDelta: visibleRegion.longitudeDelta,
    }, 400);
  }, [gpsCoords, gpsFollowing, visibleRegion.latitudeDelta, visibleRegion.longitudeDelta]);

  const mapRef = useRef<MapView>(null);
  const didFitRef = useRef(false);
  // Prevent the initial map animation from triggering "Search this area"
  const mapReadyRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => { mapReadyRef.current = true; }, 700);
    return () => clearTimeout(t);
  }, []);

  // Pan to the first geocoded job once live data loads.
  useEffect(() => {
    if (didFitRef.current || jobs.length === 0) return;
    const coord = jobs.map((j) => getCoord(j)).find(Boolean);
    if (!coord || !mapRef.current) return;
    didFitRef.current = true;
    const region = {
      latitude: coord.latitude,
      longitude: coord.longitude,
      latitudeDelta: 0.45,
      longitudeDelta: 0.45,
    };
    mapRef.current.animateToRegion(region, 600);
    setVisibleRegion(region);
  }, [coordsByJobId, jobs, getCoord]);

  const cycleMapType = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMapType((cur) => {
      const idx = MAP_TYPES.findIndex((m) => m.type === cur);
      return MAP_TYPES[(idx + 1) % MAP_TYPES.length].type;
    });
  }, []);

  const topPad     = Platform.OS === "web" ? 67 : insets.top;
  const openCount  = jobs.filter((j) => j.status === "open" || j.status === "bidding").length;
  const isSurge    = openCount >= 3;
  const isLoading  = fetchingJobs || fetchingRequests || fetchingOpenRequests || fetchingMarketplace || geocoding;

  // Jobs that match the active filter type
  const typeFiltered = jobs.filter((j) => {
    if (activeFilter === "open") return OPEN_STATUSES.has(j.status);
    if (activeFilter === "nearby") {
      const coord = getCoord(j);
      if (!coord) return false;
      return distanceMiles(coord, { latitude: US_REGION.latitude, longitude: US_REGION.longitude }) < searchRadius;
    }
    return j.status !== "completed" && j.status !== "cancelled";
  });

  // Jobs whose pin falls inside the current committed region
  const visibleJobs = typeFiltered.filter((j) => {
    const coord = getCoord(j);
    return coord ? isInRegion(coord, visibleRegion) : false;
  });

  const selectedJob = selectedPin ? jobs.find((j) => j.id === selectedPin) : null;

  // Called continuously while dragging — only show the button, don't commit region yet
  const handleRegionChange = useCallback((_region: Region) => {
    if (!mapReadyRef.current) return;
    setShowSearchHere(true);
  }, []);

  // Called once when the map finishes moving — capture the final settled position
  const handleRegionChangeComplete = useCallback((region: Region) => {
    if (!mapReadyRef.current) return;
    setPendingRegion(region);
  }, []);

  // "Search this area" pressed — commit region, update list
  const commitSearch = useCallback(() => {
    if (pendingRegion) {
      setVisibleRegion(pendingRegion);
      setPendingRegion(null);
      setSelectedPin(null);
    }
    setShowSearchHere(false);
  }, [pendingRegion]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── Header ────────────────────────────────────────────────── */}
      {!isFullscreen && (
        <View style={[styles.header, {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          paddingTop: topPad + 12,
        }]}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowLocationModal(true);
            }}>
              <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Job Map
              </Text>
              <View style={styles.subtitleRow}>
                <Feather name="map-pin" size={12} color={colors.primary} />
                <Text style={[styles.subtitle, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                  {userLocation}
                </Text>
                <Feather name="chevron-down" size={12} color={colors.primary} />
              </View>
            </Pressable>

            {isProvider && (
              <View style={[styles.onlinePill, {
                backgroundColor: isOnline ? "#16a34a18" : colors.card,
                borderColor:     isOnline ? "#16a34a40" : colors.border,
              }]}>
                <View style={[styles.onlineDot, { backgroundColor: isOnline ? "#16a34a" : "#6b7280" }]} />
                <Text style={[styles.onlinePillText, {
                  color:      isOnline ? "#16a34a" : colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                }]}>
                  {isOnline ? "Online" : "Offline"}
                </Text>
                <Switch
                  value={isOnline}
                  onValueChange={(v) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setIsOnline(v);
                  }}
                  trackColor={{ false: colors.border, true: "#16a34a" }}
                  thumbColor="#ffffff"
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </View>
            )}
          </View>

          {/* Filter chips */}
          <View style={styles.chips}>
            {(["all", "open", "nearby"] as FilterType[]).map((f) => (
              <Pressable
                key={f}
                onPress={() => {
                  if (f === "nearby") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowLocationModal(true);
                  }
                  setActiveFilter(f);
                }}
                style={[styles.chip, {
                  backgroundColor: activeFilter === f ? colors.primary : colors.card,
                  borderColor:     activeFilter === f ? colors.primary : colors.border,
                }]}
              >
                {f === "nearby" && (
                  <Feather
                    name="navigation"
                    size={11}
                    color={activeFilter === f ? colors.primaryForeground : colors.mutedForeground}
                  />
                )}
                <Text style={[styles.chipText, {
                  color:      activeFilter === f ? colors.primaryForeground : colors.foreground,
                  fontFamily: "Inter_500Medium",
                }]}>
                  {f === "all" ? "All Active" : f === "open" ? "Open" : `< ${searchRadius} mi`}
                </Text>
              </Pressable>
            ))}

            <View style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.chipText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {visibleJobs.length} in view
              </Text>
            </View>

            {isSurge && (
              <Pressable
                onPress={() => setShowSurge((v) => !v)}
                style={[styles.chip, {
                  backgroundColor: showSurge ? "#b4530920" : colors.card,
                  borderColor:     showSurge ? "#f59e0b60" : colors.border,
                }]}
              >
                <Text style={{ fontSize: 11 }}>🔥</Text>
                <Text style={[styles.chipText, {
                  color:      showSurge ? "#b45309" : colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                }]}>Surge</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* ── Surge banner ──────────────────────────────────────────── */}
      {!isFullscreen && isSurge && showSurge && heatZones.length > 0 && (
        <Animated.View entering={FadeInDown.duration(300)}>
          <View style={[styles.surgeBanner, {
            backgroundColor:   "#78350f",
            borderBottomColor: "#f59e0b30",
          }]}>
            <Text style={styles.surgeEmoji}>🔥</Text>
            <Text style={[styles.surgeText, { fontFamily: "Inter_700Bold" }]}>
              HIGH DEMAND — {openCount} open loads • Rates 15–20% above avg
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── Live Map ──────────────────────────────────────────────── */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={US_REGION}
          mapType={mapType}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
          onRegionChange={handleRegionChange}
          onRegionChangeComplete={handleRegionChangeComplete}
          customMapStyle={mapType === "standard" ? DARK_MAP_STYLE : []}
          userInterfaceStyle="dark"
        >
          {/* Truck markers */}
          {trucks.map((truck) => {
            const coord = coordFromTruck(truck);
            const pinColor = TRUCK_PIN_COLOR[truck.status] ?? "#16a34a";
            return (
              <Marker
                key={`truck-${truck.id}`}
                coordinate={coord}
                pinColor={pinColor}
                title={truck.label}
                description={`${truck.ownerCompany} · ${truck.status}`}
              />
            );
          })}

          {/* Job markers */}
          {typeFiltered.map((job) => {
            const coord = getCoord(job);
            if (!coord) return null;
            const pinColor = STATUS_COLOR[job.status] ?? colors.primary;
            return (
              <Marker
                key={job.id}
                coordinate={coord}
                pinColor={pinColor}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedPin((prev) => (prev === job.id ? null : job.id));
                }}
              />
            );
          })}

          {/* Surge heat circles */}
          {showSurge && isSurge && heatZones.map((zone, i) => (
            <React.Fragment key={i}>
              <Circle
                center={{ latitude: zone.latitude, longitude: zone.longitude }}
                radius={zone.radius}
                fillColor="rgba(245,158,11,0.13)"
                strokeColor="rgba(245,158,11,0.40)"
                strokeWidth={1.5}
              />
              <Circle
                center={{ latitude: zone.latitude, longitude: zone.longitude }}
                radius={zone.radius * 0.42}
                fillColor="rgba(245,158,11,0.07)"
                strokeColor="transparent"
                strokeWidth={0}
              />
            </React.Fragment>
          ))}
        </MapView>

        {/* ── "Search this area" button (Yelp-style) ─────────────── */}
        {showSearchHere && (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(150)}
            style={styles.searchAreaWrapper}
          >
            <Pressable
              onPress={commitSearch}
              style={[styles.searchAreaBtn, {
                backgroundColor: colors.background,
                borderColor:     colors.border,
              }]}
            >
              <Feather name="search" size={13} color={colors.primary} />
              <Text style={[styles.searchAreaText, {
                color:      colors.foreground,
                fontFamily: "Inter_600SemiBold",
              }]}>
                Search this area
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Map type toggle (Standard → Satellite → Hybrid) ────── */}
        <Pressable
          onPress={cycleMapType}
          style={[styles.mapTypeBtn, { backgroundColor: "#0a1628cc", borderColor: "#ffffff20" }]}
        >
          <Feather
            name={MAP_TYPES.find((m) => m.type === mapType)?.icon as any ?? "map"}
            size={13}
            color="#ffffff"
          />
          <Text style={[styles.mapTypeBtnText, { color: "#ffffff", fontFamily: "Inter_600SemiBold" }]}>
            {MAP_TYPES.find((m) => m.type === mapType)?.label}
          </Text>
        </Pressable>

        {/* ── Find My Location ───────────────────────────────────── */}
        <View style={styles.gpsControls}>
          {gpsFollowing && gpsCoords && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                void recenterGps();
              }}
              style={[styles.gpsBtn, { backgroundColor: "#0a1628cc", borderColor: "#ffffff20" }]}
            >
              {gpsLocating ? (
                <Feather name="loader" size={16} color="#ffffff" />
              ) : (
                <Feather name="crosshair" size={16} color="#ffffff" />
              )}
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (gpsFollowing) {
                stopGpsFollowing();
                return;
              }
              void centerOnUser(true);
            }}
            style={[styles.gpsBtn, {
              backgroundColor: gpsFollowing ? colors.primary : "#0a1628cc",
              borderColor: gpsFollowing ? colors.primary : "#ffffff20",
            }]}
          >
            {gpsLocating ? (
              <Feather name="loader" size={16} color="#ffffff" />
            ) : (
              <Feather name="navigation" size={16} color="#ffffff" />
            )}
          </Pressable>
        </View>

        {gpsError && (
          <View style={[styles.gpsErrorBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.gpsErrorText, { color: "#ef4444", fontFamily: "Inter_500Medium" }]} numberOfLines={2}>
              {gpsError}
            </Text>
            <Pressable onPress={() => void centerOnUser(gpsFollowing)}>
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* ── Fullscreen toggle ───────────────────────────────────── */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setIsFullscreen((v) => !v);
          }}
          style={[styles.fullscreenBtn, { backgroundColor: "#0a162890" }]}
        >
          <Feather name={isFullscreen ? "minimize-2" : "maximize-2"} size={16} color="#ffffff" />
        </Pressable>

        {/* ── Legend ─────────────────────────────────────────────── */}
        <View style={[styles.legend, { backgroundColor: "#0a162890" }]}>
          {[
            { color: "#e9a600", label: "Open"    },
            { color: "#3b82f6", label: "Bidding" },
            { color: "#16a34a", label: "Active"  },
            { color: "#22c55e", label: "Trucks"  },
          ].map((l) => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={[styles.legendText, { color: "#ffffff99" }]}>{l.label}</Text>
            </View>
          ))}
          {showSurge && isSurge && (
            <View style={styles.legendItem}>
              <Text style={{ fontSize: 10 }}>🔥</Text>
              <Text style={[styles.legendText, { color: "#fbbf24" }]}>Surge</Text>
            </View>
          )}
        </View>

        {/* ── Fullscreen overlay controls ────────────────────────── */}
        {isFullscreen && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={[styles.fullscreenOverlay, { paddingTop: topPad + 8 }]}
          >
            <Pressable
              onPress={() => setShowLocationModal(true)}
              style={[styles.fullscreenLocBtn, {
                backgroundColor: "#0a1628cc",
                borderColor:     "#ffffff20",
              }]}
            >
              <Feather name="map-pin" size={13} color={colors.primary} />
              <Text style={[styles.fullscreenLocText, { color: "#ffffff", fontFamily: "Inter_600SemiBold" }]}>
                {userLocation}
              </Text>
              <Feather name="chevron-down" size={13} color={colors.primary} />
            </Pressable>
            <View style={styles.fullscreenChips}>
              {(["all", "open", "nearby"] as FilterType[]).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => {
                    if (f === "nearby") setShowLocationModal(true);
                    setActiveFilter(f);
                  }}
                  style={[styles.fullscreenChip, {
                    backgroundColor: activeFilter === f ? colors.primary : "#0a1628cc",
                    borderColor:     activeFilter === f ? colors.primary : "#ffffff20",
                  }]}
                >
                  <Text style={[styles.chipText, {
                    color:      activeFilter === f ? colors.primaryForeground : "#ffffffcc",
                    fontFamily: "Inter_500Medium",
                  }]}>
                    {f === "all" ? "All" : f === "open" ? "Open" : `< ${searchRadius} mi`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}
      </View>

      {/* ── Bottom sheet ──────────────────────────────────────────── */}
      {!isFullscreen && (
        <View style={[styles.bottomSheet, {
          backgroundColor: colors.background,
          borderTopColor:  colors.border,
        }]}>
          {selectedJob ? (
            // ── Selected job card ──────────────────────────────────
            <Animated.View entering={FadeInUp.duration(250)} style={{ flex: 1 }}>
              <View style={styles.selectedJobHeader}>
                <Text style={[styles.selectedJobTitle, {
                  color:      colors.foreground,
                  fontFamily: "Inter_700Bold",
                }]}>
                  {selectedJob.projectName}
                </Text>
                <Pressable onPress={() => setSelectedPin(null)}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <View style={styles.selectedJobDetails}>
                <DetailPill icon="layers"     label={selectedJob.material}                colors={colors} />
                <DetailPill icon="dollar-sign" label={`$${selectedJob.budgetPerHour}/hr`} highlight colors={colors} />
                <DetailPill icon="map-pin"    label={`${selectedJob.distanceToStart} mi away`} colors={colors} />
                <DetailPill icon="truck"      label={`${selectedJob.trucksNeeded} trucks`}     colors={colors} />
              </View>
              <View style={styles.selectedJobRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectedJobSub, {
                    color:      colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  }]} numberOfLines={1}>
                    {selectedJob.pickupAddress}
                  </Text>
                  <Text style={[styles.selectedJobSub, {
                    color:      colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  }]} numberOfLines={1}>
                    → {selectedJob.deliveryAddress}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/job/${selectedJob.id}`);
                  }}
                  style={[styles.viewBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.viewBtnText, {
                    color:      colors.primaryForeground,
                    fontFamily: "Inter_700Bold",
                  }]}>
                    {isProvider ? "Bid Now" : "View"}
                  </Text>
                  <Feather name="arrow-right" size={14} color={colors.primaryForeground} />
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            // ── Job list (updates when map moves) ──────────────────
            <ScrollView
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#e9a600"
                  colors={["#e9a600"]}
                />
              }
            >
              <Text style={[styles.listTitle, {
                color:      colors.mutedForeground,
                fontFamily: "Inter_600SemiBold",
              }]}>
                {visibleJobs.length} JOBS IN VIEW
              </Text>
              {isLoading ? (
                <View style={styles.emptyState}>
                  <Feather name="loader" size={28} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  }]}>
                    Loading jobs on map…
                  </Text>
                </View>
              ) : visibleJobs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="map" size={28} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, {
                    color:      colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  }]}>
                    {jobs.length === 0 ? "No open loads right now" : "No jobs in this area"}
                  </Text>
                  <Text style={[styles.emptySub, {
                    color:      colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  }]}>
                    {jobs.length === 0
                      ? "No loads available in your area yet. Post a load from the Loads tab or check back soon."
                      : "Pan the map to the pickup location and tap \"Search this area\""}
                  </Text>
                </View>
              ) : (
                visibleJobs.slice(0, 6).map((job, idx) => (
                  <Animated.View key={job.id} entering={FadeInDown.delay(idx * 40).springify()}>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push(`/job/${job.id}`);
                      }}
                      style={[styles.listItem, { borderColor: colors.border }]}
                    >
                      <View style={[styles.listDot, {
                        backgroundColor: STATUS_COLOR[job.status] ?? colors.primary,
                      }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.listItemTitle, {
                          color:      colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                        }]} numberOfLines={1}>
                          {job.projectName}
                        </Text>
                        <Text style={[styles.listItemSub, {
                          color:      colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        }]}>
                          {job.material} • {job.distanceToStart} mi • {job.scheduledDate}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.listItemRate, {
                          color:      colors.primary,
                          fontFamily: "Inter_700Bold",
                        }]}>
                          ${job.budgetPerHour}/hr
                        </Text>
                        <Text style={[styles.listItemBids, {
                          color:      colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        }]}>
                          {job.bidsCount} bids
                        </Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                ))
              )}
              <View style={{ height: insets.bottom + 8 }} />
            </ScrollView>
          )}
        </View>
      )}

      {/* ── Location modal ────────────────────────────────────────── */}
      <LocationFilterModal
        visible={showLocationModal}
        currentLocation={userLocation}
        currentRadius={searchRadius}
        onApply={(loc, rad) => {
          setUserLocation(loc);
          setSearchRadius(rad);
          setShowLocationModal(false);
        }}
        onClose={() => setShowLocationModal(false)}
      />

      {/* ── Provider Online bar ────────────────────────────────────── */}
      {isProvider && (
        <View style={[styles.onlineBar, {
          backgroundColor: isOnline ? "#16a34a" : "#1c2333",
          bottom:          insets.bottom + 60,
        }]}>
          <View style={styles.onlineBarLeft}>
            <View style={[styles.onlineBarDot, {
              backgroundColor: isOnline ? "#ffffff80" : "#6b7280",
            }]} />
            <Text style={[styles.onlineBarText, {
              color:      "#ffffff",
              fontFamily: "Inter_700Bold",
            }]}>
              {isOnline ? "You are Online" : "You are Offline"}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={(v) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setIsOnline(v);
            }}
            trackColor={{ false: "#374151", true: "#15803d" }}
            thumbColor="#ffffff"
          />
        </View>
      )}
    </View>
  );
}

// ── Detail pill ───────────────────────────────────────────────────────
function DetailPill({
  icon, label, highlight, colors,
}: {
  icon: string; label: string; highlight?: boolean; colors: any;
}) {
  return (
    <View style={[styles.detailPill, {
      backgroundColor: highlight ? colors.primary + "18" : colors.card,
      borderColor:     highlight ? colors.primary + "40" : colors.border,
    }]}>
      <Feather
        name={icon as any}
        size={12}
        color={highlight ? colors.primary : colors.mutedForeground}
      />
      <Text style={[styles.detailPillText, {
        color:      highlight ? colors.primary : colors.foreground,
        fontFamily: "Inter_500Medium",
      }]}>
        {label}
      </Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1 },

  // Header
  header:       { borderBottomWidth: 1, paddingHorizontal: 16, paddingBottom: 12 },
  headerRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title:        { fontSize: 24, fontWeight: "700" as const },
  subtitleRow:  { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  subtitle:     { fontSize: 13 },
  onlinePill:   { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  onlineDot:    { width: 8, height: 8, borderRadius: 4 },
  onlinePillText: { fontSize: 13 },

  // Filter chips
  chips:        { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip:         { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipText:     { fontSize: 12 },

  // Surge banner
  surgeBanner:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  surgeEmoji:   { fontSize: 16 },
  surgeText:    { fontSize: 12, color: "#fbbf24", letterSpacing: 0.3 },

  // Map
  mapContainer: { flex: 1, position: "relative" },

  // "Search this area" button
  searchAreaWrapper: {
    position: "absolute", top: 14, left: 0, right: 0,
    alignItems: "center", zIndex: 30,
  },
  searchAreaBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 24, borderWidth: 1,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  searchAreaText: { fontSize: 13 },

  // Map overlay buttons
  mapTypeBtn:       { position: "absolute", bottom: 14, left: 14, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 8, borderWidth: 1, zIndex: 30 },
  mapTypeBtnText:   { fontSize: 12 },
  gpsControls:      { position: "absolute", bottom: 62, right: 14, gap: 8, zIndex: 30 },
  gpsBtn:           { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  gpsErrorBanner:   { position: "absolute", bottom: 118, left: 14, right: 14, zIndex: 30, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  gpsErrorText:     { flex: 1, fontSize: 12 },
  fullscreenBtn:    { position: "absolute", bottom: 14, right: 14, width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", zIndex: 30 },

  // Legend
  legend:       { position: "absolute", top: 10, right: 10, flexDirection: "row", gap: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  legendItem:   { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot:    { width: 8, height: 8, borderRadius: 4 },
  legendText:   { fontSize: 10 },

  // Fullscreen overlay
  fullscreenOverlay:  { position: "absolute", top: 0, left: 0, right: 0, zIndex: 25, paddingHorizontal: 14, gap: 8 },
  fullscreenLocBtn:   { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  fullscreenLocText:  { fontSize: 13 },
  fullscreenChips:    { flexDirection: "row", gap: 8 },
  fullscreenChip:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },

  // Bottom sheet
  bottomSheet:       { height: 215, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 14 },
  listTitle:         { fontSize: 11, letterSpacing: 0.8, marginBottom: 10 },
  listItem:          { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1 },
  listDot:           { width: 10, height: 10, borderRadius: 5 },
  listItemTitle:     { fontSize: 14, marginBottom: 2 },
  listItemSub:       { fontSize: 12 },
  listItemRate:      { fontSize: 14 },
  listItemBids:      { fontSize: 11 },

  // Empty state
  emptyState:  { alignItems: "center", paddingTop: 20, gap: 6 },
  emptyTitle:  { fontSize: 14 },
  emptySub:    { fontSize: 12, textAlign: "center" },

  // Selected job card
  selectedJobHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  selectedJobTitle:   { fontSize: 16, flex: 1, marginRight: 8 },
  selectedJobDetails: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  selectedJobRow:     { flexDirection: "row", alignItems: "center", gap: 12 },
  selectedJobSub:     { fontSize: 12, marginBottom: 2 },
  viewBtn:            { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  viewBtnText:        { fontSize: 14 },
  detailPill:         { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  detailPillText:     { fontSize: 12 },

  // Provider online bar
  onlineBar:     { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  onlineBarLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  onlineBarDot:  { width: 8, height: 8, borderRadius: 4 },
  onlineBarText: { fontSize: 14 },
});
