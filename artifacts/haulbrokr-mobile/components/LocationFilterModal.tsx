import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState, useMemo, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

const RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const;

const ALL_CITIES = [
  "Dallas, TX",
  "Fort Worth, TX",
  "Houston, TX",
  "Austin, TX",
  "San Antonio, TX",
  "Plano, TX",
  "Irving, TX",
  "Garland, TX",
  "Lubbock, TX",
  "El Paso, TX",
  "Arlington, TX",
  "Corpus Christi, TX",
  "McKinney, TX",
  "Frisco, TX",
  "Killeen, TX",
  "Beaumont, TX",
  "Pasadena, TX",
  "Mesquite, TX",
  "Carrollton, TX",
  "Midland, TX",
  "Waco, TX",
  "Odessa, TX",
  "Abilene, TX",
  "Laredo, TX",
  "Amarillo, TX",
  "Denton, TX",
  "Brownsville, TX",
  "Pearland, TX",
  "Tyler, TX",
  "Round Rock, TX",
  "Grand Prairie, TX",
  "League City, TX",
  "Sugar Land, TX",
  "Richardson, TX",
  "Allen, TX",
  "Edinburg, TX",
  "Lewisville, TX",
  "College Station, TX",
  "Lansing, TX",
  "Flower Mound, TX",
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Phoenix, AZ",
  "Philadelphia, PA",
  "San Antonio, TX",
  "San Diego, CA",
  "Jacksonville, FL",
  "San Jose, CA",
  "Indianapolis, IN",
  "Columbus, OH",
  "Charlotte, NC",
  "Denver, CO",
  "Seattle, WA",
  "Nashville, TN",
  "Baltimore, MD",
  "Louisville, KY",
  "Portland, OR",
  "Oklahoma City, OK",
  "Las Vegas, NV",
  "Milwaukee, WI",
  "Albuquerque, NM",
  "Tucson, AZ",
  "Fresno, CA",
  "Sacramento, CA",
  "Mesa, AZ",
  "Kansas City, MO",
  "Atlanta, GA",
  "Omaha, NE",
  "Colorado Springs, CO",
  "Raleigh, NC",
  "Long Beach, CA",
  "Virginia Beach, VA",
  "Minneapolis, MN",
  "Tampa, FL",
  "New Orleans, LA",
  "Orlando, FL",
  "Baton Rouge, LA",
  "Bakersfield, CA",
  "Honolulu, HI",
  "Anaheim, CA",
  "Aurora, CO",
  "Santa Ana, CA",
  "Corpus Christi, TX",
  "Riverside, CA",
  "St. Louis, MO",
  "Pittsburgh, PA",
  "Anchorage, AK",
  "Stockton, CA",
  "Cincinnati, OH",
  "St. Paul, MN",
  "Greensboro, NC",
  "Toledo, OH",
  "Newark, NJ",
  "Plano, TX",
  "Henderson, NV",
  "Lincoln, NE",
  "Buffalo, NY",
  "Fort Wayne, IN",
  "Jersey City, NJ",
  "Chula Vista, CA",
  "Orlando, FL",
  "St. Petersburg, FL",
  "Norfolk, VA",
  "Chandler, AZ",
  "Laredo, TX",
  "Madison, WI",
  "Durham, NC",
  "Lubbock, TX",
  "Winston–Salem, NC",
  "Garland, TX",
  "Glendale, AZ",
  "Hialeah, FL",
  "Reno, NV",
  "Boise, ID",
  "Spokane, WA",
  "Scottsdale, AZ",
  "Little Rock, AR",
  "Des Moines, IA",
  "Memphis, TN",
];

const QUICK_CITIES = [
  "Dallas, TX",
  "Fort Worth, TX",
  "Houston, TX",
  "Austin, TX",
  "San Antonio, TX",
  "Plano, TX",
  "Irving, TX",
  "Frisco, TX",
  "McKinney, TX",
  "Arlington, TX",
];

interface Props {
  visible: boolean;
  currentLocation: string;
  currentRadius: number;
  onApply: (location: string, radius: number) => void;
  onClose: () => void;
}

export function LocationFilterModal({
  visible,
  currentLocation,
  currentRadius,
  onApply,
  onClose,
}: Props) {
  const colors = useColors();
  const [location, setLocation] = useState(currentLocation);
  const [radius, setRadius] = useState(currentRadius);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    if (visible) {
      setLocation(currentLocation);
      setRadius(currentRadius);
    }
  }, [visible]);

  const suggestions = useMemo(() => {
    const q = location.trim().toLowerCase();
    if (q.length < 2) return [];
    const seen = new Set<string>();
    return ALL_CITIES.filter((c) => {
      if (c.toLowerCase().includes(q) && c !== location && !seen.has(c)) {
        seen.add(c);
        return true;
      }
      return false;
    }).slice(0, 7);
  }, [location]);

  const showSuggestions = inputFocused && suggestions.length > 0;

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onApply(location.trim() || currentLocation, radius);
  };

  const pickCity = (city: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocation(city);
    setInputFocused(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kav}
        >
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text
                style={[
                  styles.title,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                Location & Distance
              </Text>
              <Pressable
                onPress={onClose}
                style={[
                  styles.closeBtn,
                  { backgroundColor: colors.background },
                ]}
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Location Input */}
              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  SEARCH LOCATION
                </Text>
                <View
                  style={[
                    styles.inputRow,
                    {
                      backgroundColor: colors.background,
                      borderColor: inputFocused
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                >
                  <Feather name="map-pin" size={16} color={colors.primary} />
                  <TextInput
                    value={location}
                    onChangeText={(t) => {
                      setLocation(t);
                      setInputFocused(true);
                    }}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setTimeout(() => setInputFocused(false), 150)}
                    placeholder="City, State (e.g. Dallas, TX)"
                    placeholderTextColor={colors.mutedForeground}
                    style={[
                      styles.input,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                    returnKeyType="done"
                    onSubmitEditing={() => setInputFocused(false)}
                    autoCapitalize="words"
                  />
                  {location.length > 0 && (
                    <Pressable
                      onPress={() => {
                        setLocation("");
                        setInputFocused(true);
                      }}
                    >
                      <Feather
                        name="x-circle"
                        size={16}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  )}
                </View>

                {/* Autocomplete dropdown */}
                {showSuggestions && (
                  <Animated.View
                    entering={FadeInDown.duration(150)}
                    exiting={FadeOutUp.duration(100)}
                    style={[
                      styles.dropdown,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {suggestions.map((city, idx) => (
                      <Pressable
                        key={city}
                        onPress={() => pickCity(city)}
                        style={[
                          styles.suggestionRow,
                          idx < suggestions.length - 1 && {
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                          },
                        ]}
                      >
                        <Feather
                          name="map-pin"
                          size={13}
                          color={colors.mutedForeground}
                        />
                        <Text
                          style={[
                            styles.suggestionText,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_400Regular",
                            },
                          ]}
                        >
                          {city}
                        </Text>
                      </Pressable>
                    ))}
                  </Animated.View>
                )}

                {/* Quick city chips */}
                {!showSuggestions && (
                  <View style={styles.cityChips}>
                    {QUICK_CITIES.map((city) => (
                      <Pressable
                        key={city}
                        onPress={() => pickCity(city)}
                        style={[
                          styles.cityChip,
                          {
                            backgroundColor:
                              location === city
                                ? colors.primary + "18"
                                : colors.background,
                            borderColor:
                              location === city
                                ? colors.primary
                                : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cityChipText,
                            {
                              color:
                                location === city
                                  ? colors.primary
                                  : colors.foreground,
                              fontFamily:
                                location === city
                                  ? "Inter_600SemiBold"
                                  : "Inter_400Regular",
                            },
                          ]}
                        >
                          {city}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Radius */}
              <View
                style={[
                  styles.section,
                  styles.sectionBorder,
                  { borderTopColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.sectionLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  SEARCH RADIUS
                </Text>
                <View style={styles.radiusRow}>
                  {RADIUS_OPTIONS.map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setRadius(r);
                      }}
                      style={[
                        styles.radiusBtn,
                        {
                          backgroundColor:
                            radius === r ? colors.primary : colors.background,
                          borderColor:
                            radius === r ? colors.primary : colors.border,
                          flex: 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.radiusBtnNum,
                          {
                            color:
                              radius === r
                                ? colors.primaryForeground
                                : colors.foreground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {r}
                      </Text>
                      <Text
                        style={[
                          styles.radiusBtnUnit,
                          {
                            color:
                              radius === r
                                ? colors.primaryForeground + "cc"
                                : colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        mi
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text
                  style={[
                    styles.radiusHint,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  Showing jobs within {radius} miles of{" "}
                  {location || currentLocation}
                </Text>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              <Pressable
                onPress={onClose}
                style={[
                  styles.cancelBtn,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cancelText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleApply}
                style={[
                  styles.applyBtn,
                  { backgroundColor: colors.primary, flex: 1 },
                ]}
              >
                <Feather
                  name="check"
                  size={16}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.applyText,
                    {
                      color: colors.primaryForeground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  Apply
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  kav: { justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 17 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  sectionBorder: { borderTopWidth: 1, marginTop: 8 },
  sectionLabel: { fontSize: 11, letterSpacing: 1.2, marginBottom: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  input: { flex: 1, fontSize: 15, padding: 0 },
  dropdown: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 14,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  suggestionText: { fontSize: 14, flex: 1 },
  cityChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  cityChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  cityChipText: { fontSize: 13 },
  radiusRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  radiusBtn: {
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 1,
  },
  radiusBtnNum: { fontSize: 16 },
  radiusBtnUnit: { fontSize: 11 },
  radiusHint: { fontSize: 12, marginBottom: 8 },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelText: { fontSize: 15 },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  applyText: { fontSize: 15 },
});
