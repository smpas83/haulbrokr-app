import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useDumpSites, type DumpSite } from "@/hooks/useLiveApi";

type SiteType = "dump" | "delivery";

interface Site {
  id: string;
  name: string;
  city: string;
  state: string;
  category: "landfill" | "transfer_station" | "recycling" | "quarry" | "supplier";
  materials: string[];
  phone: string;
}

const DUMP_SITES: Site[] = [
  // Texas
  { id: "d1", name: "McCommas Bluff Landfill", city: "Dallas", state: "TX", category: "landfill", materials: ["C&D Debris", "MSW", "Inert Fill"], phone: "(214) 670-0977" },
  { id: "d2", name: "Mesquite Landfill", city: "Mesquite", state: "TX", category: "landfill", materials: ["C&D Debris", "Inert Fill"], phone: "(972) 216-6800" },
  { id: "d3", name: "Alliance Transfer Station", city: "Fort Worth", state: "TX", category: "transfer_station", materials: ["C&D", "MSW", "Green Waste"], phone: "(817) 232-7800" },
  { id: "d4", name: "Tessman Road Landfill", city: "San Antonio", state: "TX", category: "landfill", materials: ["C&D Debris", "MSW"], phone: "(210) 648-3100" },
  { id: "d5", name: "Blue Ridge Landfill", city: "Houston", state: "TX", category: "landfill", materials: ["MSW", "C&D Debris", "Sludge"], phone: "(281) 457-3800" },
  { id: "d6", name: "Austin Community Landfill", city: "Austin", state: "TX", category: "landfill", materials: ["MSW", "C&D", "Green Waste"], phone: "(512) 854-9913" },
  { id: "d7", name: "WM - Skyline Landfill", city: "Ferris", state: "TX", category: "landfill", materials: ["MSW", "C&D", "Inert Fill"], phone: "(972) 842-5700" },
  // California
  { id: "d8", name: "Sunshine Canyon Landfill", city: "Sylmar", state: "CA", category: "landfill", materials: ["MSW", "C&D", "Green Waste"], phone: "(818) 367-4900" },
  { id: "d9", name: "Puente Hills Landfill", city: "Whittier", state: "CA", category: "landfill", materials: ["MSW", "C&D Debris"], phone: "(562) 699-7300" },
  { id: "d10", name: "Newby Island Landfill", city: "San Jose", state: "CA", category: "landfill", materials: ["MSW", "Green Waste"], phone: "(408) 262-1401" },
  { id: "d11", name: "Keller Canyon Landfill", city: "Pittsburg", state: "CA", category: "landfill", materials: ["MSW", "C&D Debris"], phone: "(925) 439-0400" },
  { id: "d12", name: "Miramar Landfill", city: "San Diego", state: "CA", category: "landfill", materials: ["MSW", "C&D", "Green Waste"], phone: "(858) 492-5010" },
  // Florida
  { id: "d13", name: "New River Solid Waste Association", city: "Live Oak", state: "FL", category: "landfill", materials: ["MSW", "C&D Debris"], phone: "(386) 776-8200" },
  { id: "d14", name: "Okeechobee Landfill", city: "Okeechobee", state: "FL", category: "landfill", materials: ["MSW", "C&D", "Inert Fill"], phone: "(863) 763-7764" },
  { id: "d15", name: "Southeast Volusia Transfer Station", city: "Edgewater", state: "FL", category: "transfer_station", materials: ["MSW", "Recycling"], phone: "(386) 424-2400" },
  { id: "d16", name: "Palm Beach Solid Waste Authority", city: "West Palm Beach", state: "FL", category: "landfill", materials: ["MSW", "C&D", "Ash"], phone: "(561) 697-2700" },
  // New York
  { id: "d17", name: "High Acres Landfill", city: "Perinton", state: "NY", category: "landfill", materials: ["MSW", "C&D"], phone: "(585) 223-3060" },
  { id: "d18", name: "Seneca Meadows Landfill", city: "Waterloo", state: "NY", category: "landfill", materials: ["MSW", "Industrial"], phone: "(315) 539-9813" },
  { id: "d19", name: "Brookhaven Landfill", city: "Brookhaven", state: "NY", category: "landfill", materials: ["C&D Debris", "Ash"], phone: "(631) 286-0333" },
  // Illinois
  { id: "d20", name: "Countryside Landfill", city: "Grayslake", state: "IL", category: "landfill", materials: ["MSW", "C&D"], phone: "(847) 548-9700" },
  { id: "d21", name: "Prairie View Landfill", city: "Ottawa", state: "IL", category: "landfill", materials: ["MSW", "C&D", "Industrial"], phone: "(815) 434-3131" },
  // Georgia
  { id: "d22", name: "Cherokee Run Landfill", city: "Conyers", state: "GA", category: "landfill", materials: ["MSW", "C&D Debris"], phone: "(770) 388-7960" },
  { id: "d23", name: "Waste Management - Pine Ridge", city: "Valdosta", state: "GA", category: "landfill", materials: ["MSW", "C&D"], phone: "(229) 259-0101" },
  // Arizona
  { id: "d24", name: "Rio Salado Landfill", city: "Phoenix", state: "AZ", category: "landfill", materials: ["MSW", "C&D", "Inert Fill"], phone: "(602) 252-8523" },
  { id: "d25", name: "Butterfield Station Landfill", city: "Eloy", state: "AZ", category: "landfill", materials: ["MSW", "C&D", "Industrial"], phone: "(520) 836-7600" },
  // Colorado
  { id: "d26", name: "Larimer County Landfill", city: "Fort Collins", state: "CO", category: "landfill", materials: ["MSW", "C&D", "Green Waste"], phone: "(970) 498-5760" },
  { id: "d27", name: "Arapahoe County Landfill", city: "Aurora", state: "CO", category: "landfill", materials: ["MSW", "C&D"], phone: "(303) 690-6821" },
  // North Carolina
  { id: "d28", name: "South Wake Landfill", city: "Apex", state: "NC", category: "landfill", materials: ["MSW", "C&D"], phone: "(919) 856-6149" },
  { id: "d29", name: "Charlotte RENA Transfer Station", city: "Charlotte", state: "NC", category: "transfer_station", materials: ["MSW", "Recycling"], phone: "(704) 432-0000" },
];

const DELIVERY_SITES: Site[] = [
  // Texas
  { id: "s1", name: "Big Tex Quarry", city: "Terrell", state: "TX", category: "quarry", materials: ["Rock", "Gravel", "Crushed Stone", "Base Material"], phone: "(972) 563-1200" },
  { id: "s2", name: "Martin Marietta - DFW", city: "Irving", state: "TX", category: "quarry", materials: ["Limestone", "Gravel", "Sand", "Aggregates"], phone: "(972) 790-8100" },
  { id: "s3", name: "Vulcan Materials - Houston", city: "Houston", state: "TX", category: "quarry", materials: ["Crushed Stone", "Sand", "Gravel", "Aggregates"], phone: "(713) 983-4700" },
  { id: "s4", name: "Rio Grande Sand Co.", city: "Waco", state: "TX", category: "supplier", materials: ["Sand", "Fill Dirt", "Topsoil"], phone: "(254) 752-6500" },
  { id: "s5", name: "Texas Concrete Materials", city: "San Antonio", state: "TX", category: "supplier", materials: ["Recycled Concrete", "Base Rock", "Gravel"], phone: "(210) 648-4000" },
  { id: "s6", name: "Austin Sand & Gravel", city: "Austin", state: "TX", category: "supplier", materials: ["Sand", "Gravel", "Fill Dirt", "Topsoil"], phone: "(512) 282-3800" },
  // California
  { id: "s7", name: "Vulcan Materials - Azusa Quarry", city: "Azusa", state: "CA", category: "quarry", materials: ["Crushed Rock", "Sand", "Gravel", "Aggregates"], phone: "(626) 969-3361" },
  { id: "s8", name: "CalPortland - Redding Plant", city: "Redding", state: "CA", category: "supplier", materials: ["Aggregates", "Concrete", "Sand", "Gravel"], phone: "(530) 241-2950" },
  { id: "s9", name: "Granite Construction - San Jose", city: "San Jose", state: "CA", category: "quarry", materials: ["Rock", "Sand", "Gravel", "Base"], phone: "(408) 929-1000" },
  // Florida
  { id: "s10", name: "Florida Rock Industries - Tampa", city: "Tampa", state: "FL", category: "quarry", materials: ["Limestone", "Sand", "Aggregates"], phone: "(813) 621-1166" },
  { id: "s11", name: "Vulcan Materials - Fort Lauderdale", city: "Fort Lauderdale", state: "FL", category: "quarry", materials: ["Crushed Rock", "Aggregates", "Fill"], phone: "(954) 772-1770" },
  // New York
  { id: "s12", name: "LaFarge - Ravena Plant", city: "Ravena", state: "NY", category: "quarry", materials: ["Limestone", "Aggregates", "Crushed Stone"], phone: "(518) 756-2011" },
  { id: "s13", name: "Callanan Industries", city: "Albany", state: "NY", category: "quarry", materials: ["Crushed Stone", "Sand", "Gravel", "Asphalt Millings"], phone: "(518) 272-1821" },
  // Illinois
  { id: "s14", name: "Vulcan Materials - Thornton Quarry", city: "Thornton", state: "IL", category: "quarry", materials: ["Dolomite", "Sand", "Gravel", "Aggregates"], phone: "(708) 877-2500" },
  { id: "s15", name: "Martin Marietta - Chicago", city: "Chicago", state: "IL", category: "supplier", materials: ["Limestone", "Sand", "Gravel", "Base Rock"], phone: "(312) 644-7800" },
  // Georgia
  { id: "s16", name: "Vulcan Materials - Atlanta", city: "Atlanta", state: "GA", category: "quarry", materials: ["Granite", "Crushed Stone", "Sand", "Gravel"], phone: "(404) 221-1800" },
  { id: "s17", name: "Martin Marietta - Augusta", city: "Augusta", state: "GA", category: "quarry", materials: ["Aggregates", "Granite", "Base Rock"], phone: "(706) 790-8700" },
  // Arizona
  { id: "s18", name: "Salt River Materials Group", city: "Scottsdale", state: "AZ", category: "supplier", materials: ["Sand", "Gravel", "Rock", "Decorative Stone"], phone: "(480) 850-0072" },
  { id: "s19", name: "Arizona Rock Products", city: "Chandler", state: "AZ", category: "quarry", materials: ["Rock", "Gravel", "Fill Dirt", "Base Material"], phone: "(480) 963-7777" },
  // Colorado
  { id: "s20", name: "Aggregate Industries - Denver", city: "Denver", state: "CO", category: "quarry", materials: ["Aggregates", "Sand", "Gravel", "Asphalt"], phone: "(303) 693-8100" },
  // North Carolina
  { id: "s21", name: "Vulcan Materials - Charlotte", city: "Charlotte", state: "NC", category: "quarry", materials: ["Granite", "Sand", "Aggregates", "Base"], phone: "(704) 525-5404" },
  { id: "s22", name: "Martin Marietta - Raleigh", city: "Raleigh", state: "NC", category: "quarry", materials: ["Granite", "Gravel", "Sand", "Base Material"], phone: "(919) 781-4750" },
  // Ohio
  { id: "s23", name: "Vulcan Materials - Columbus", city: "Columbus", state: "OH", category: "quarry", materials: ["Limestone", "Aggregates", "Sand", "Gravel"], phone: "(614) 882-3161" },
  { id: "s24", name: "Hanson Aggregates - Cleveland", city: "Cleveland", state: "OH", category: "quarry", materials: ["Limestone", "Dolomite", "Sand", "Gravel"], phone: "(216) 429-9400" },
  // Pennsylvania
  { id: "s25", name: "Eureka Stone Quarry", city: "Chalfont", state: "PA", category: "quarry", materials: ["Crushed Stone", "Gravel", "Sand", "Base"], phone: "(215) 822-4900" },
  { id: "s26", name: "Lehigh Hanson - Pittsburgh", city: "Pittsburgh", state: "PA", category: "quarry", materials: ["Limestone", "Aggregates", "Gravel"], phone: "(412) 788-8500" },
];

const DUMP_TYPE_LABELS: Record<string, string> = {
  landfill: "Landfill",
  transfer_station: "Transfer Station",
  recycling_center: "Recycling",
  construction_debris: "Construction Debris",
  hazardous_waste: "Hazardous",
  compost: "Compost",
};

const CATEGORY_COLORS: Record<string, string> = {
  landfill: "#2563eb",
  transfer_station: "#7c3aed",
  recycling: "#16a34a",
  quarry: "#d97706",
  supplier: "#0891b2",
};

const CATEGORY_LABELS: Record<string, string> = {
  landfill: "Landfill",
  transfer_station: "Transfer Station",
  recycling: "Recycling",
  quarry: "Quarry",
  supplier: "Supplier",
};

function apiSiteToView(site: DumpSite): Site {
  const category = site.type in CATEGORY_LABELS ? site.type as Site["category"] : "landfill";
  return {
    id: `api-${site.id}`,
    name: site.name,
    city: site.city,
    state: site.state,
    category,
    materials: [DUMP_TYPE_LABELS[site.type] ?? site.type],
    phone: site.phone ?? "",
  };
}

export default function DumpSitesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [siteType, setSiteType] = useState<SiteType>("dump");
  const [search, setSearch] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { data: apiDumpSites, isLoading: loadingDumpSites } = useDumpSites();

  const dumpSitesFromApi = useMemo(
    () => (Array.isArray(apiDumpSites) ? apiDumpSites.map(apiSiteToView) : []),
    [apiDumpSites],
  );

  const sites = siteType === "dump" ? dumpSitesFromApi : DELIVERY_SITES;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sites;
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.state.toLowerCase().includes(q) ||
        s.materials.some((m) => m.toLowerCase().includes(q))
    );
  }, [sites, search]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: topPad + 12 },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Site Locator
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Segment + Search */}
      <View style={[styles.controls, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {/* Segment */}
        <View style={[styles.segment, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(["dump", "delivery"] as SiteType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => { setSiteType(t); setSearch(""); }}
              style={[styles.segTab, t === siteType && { backgroundColor: colors.primary }]}
            >
              <Feather
                name={t === "dump" ? "trash-2" : "truck"}
                size={14}
                color={t === siteType ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text style={{ fontSize: 13, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", color: t === siteType ? colors.primaryForeground : colors.foreground }}>
                {t === "dump" ? "Dump Sites" : "Material Sites"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
            placeholder={siteType === "dump" ? "City, state, or material..." : "City, state, or material..."}
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        <Text style={[styles.count, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {siteType === "dump" && loadingDumpSites
            ? "Loading dump sites…"
            : `${filtered.length} site${filtered.length !== 1 ? "s" : ""} found`}
        </Text>
      </View>

      {/* List */}
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <SiteCard site={item} colors={colors} />}
        ListEmptyComponent={
          siteType === "dump" && loadingDumpSites ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Loading sites from HaulBrokr…
              </Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather name="map-pin" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                No sites found for "{search}"
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

function SiteCard({ site, colors }: { site: Site; colors: ReturnType<typeof useColors> }) {
  const catColor = CATEGORY_COLORS[site.category] ?? colors.primary;
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <Text style={[styles.siteName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {site.name}
          </Text>
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text style={[styles.location, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {site.city}, {site.state}
            </Text>
          </View>
        </View>
        <View style={[styles.catBadge, { backgroundColor: catColor + "20" }]}>
          <Text style={[styles.catText, { color: catColor, fontFamily: "Inter_600SemiBold" }]}>
            {CATEGORY_LABELS[site.category]}
          </Text>
        </View>
      </View>

      <View style={styles.materials}>
        {site.materials.slice(0, 4).map((m) => (
          <View key={m} style={[styles.materialChip, { backgroundColor: colors.muted }]}>
            <Text style={[styles.materialText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {m}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Feather name="phone" size={13} color={colors.mutedForeground} />
        <Text style={[styles.phone, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {site.phone}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "700" as const, flex: 1, textAlign: "center" },
  controls: { paddingHorizontal: 16, paddingVertical: 14, gap: 10, borderBottomWidth: 1 },
  segment: { flexDirection: "row", borderWidth: 1, padding: 3 },
  segTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontSize: 14, height: "100%" },
  count: { fontSize: 12 },
  card: { borderWidth: 1, padding: 14, marginBottom: 10, gap: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  cardLeft: { flex: 1, gap: 4 },
  siteName: { fontSize: 15, fontWeight: "600" as const },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  location: { fontSize: 13 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 4 },
  catText: { fontSize: 10, fontWeight: "600" as const, letterSpacing: 0.4, textTransform: "uppercase" },
  materials: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  materialChip: { paddingHorizontal: 8, paddingVertical: 3 },
  materialText: { fontSize: 12 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, paddingTop: 10 },
  phone: { fontSize: 13 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14 },
});
