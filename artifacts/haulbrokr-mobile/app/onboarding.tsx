import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCreateProfile } from "@/hooks/useLiveApi";
import { useApp, type Role } from "@/context/AppContext";

const EQUIPMENT_TYPES: { value: string; label: string }[] = [
  { value: "standard", label: "Standard Dump" },
  { value: "super_10", label: "Super 10" },
  { value: "end_dump", label: "End Dump" },
  { value: "belly_dump", label: "Belly Dump" },
  { value: "side_dump", label: "Side Dump" },
  { value: "bottom_dump", label: "Bottom Dump" },
  { value: "transfer", label: "Transfer" },
  { value: "articulated", label: "Articulated" },
  { value: "dump_truck", label: "Dump Truck" },
  { value: "lowboy", label: "Lowboy" },
  { value: "water_truck", label: "Water Truck" },
  { value: "excavator", label: "Excavator" },
  { value: "dozer", label: "Dozer" },
  { value: "skid_steer", label: "Skid Steer" },
];

const ROLES: {
  id: Role;
  title: string;
  sub: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  {
    id: "customer",
    title: "Customer",
    sub: "I hire dump trucks",
    icon: "briefcase",
  },
  { id: "provider", title: "Provider", sub: "I operate trucks", icon: "truck" },
  {
    id: "supervisor",
    title: "Supervisor",
    sub: "I manage a job site",
    icon: "clipboard",
  },
  { id: "driver", title: "Driver", sub: "I drive for a company", icon: "user" },
];

export default function OnboardingScreen() {
  const [role, setRole] = useState<Role | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  // Carrier / provider details
  const [dba, setDba] = useState("");
  const [website, setWebsite] = useState("");
  const [mcNumber, setMcNumber] = useState("");
  const [capacityTons, setCapacityTons] = useState("");
  const [capacityYards, setCapacityYards] = useState("");
  const [countiesServed, setCountiesServed] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [minimumHours, setMinimumHours] = useState("");
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>([]);

  // Customer billing details
  const [billingEinLast4, setBillingEinLast4] = useState("");
  const [apContactName, setApContactName] = useState("");
  const [apEmail, setApEmail] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");

  const createProfile = useCreateProfile();
  const { profile, setProfile } = useApp();

  const needsInvite = role === "driver" || role === "supervisor";
  const isProvider = role === "provider";
  const isCustomer = role === "customer";
  const ownerCompanyLabel =
    role === "provider"
      ? "Trucking company name *"
      : "Construction company name *";
  const num = (s: string) => (s.trim() ? Number(s) : undefined);

  const handleSubmit = async () => {
    if (!role) {
      Alert.alert("Select a role", "Choose how you'll use HaulBrokr.");
      return;
    }
    if (needsInvite) {
      if (!inviteCode.trim()) {
        Alert.alert(
          "Invite code required",
          "Enter the code your manager shared with you.",
        );
        return;
      }
    } else {
      if (!companyName.trim()) {
        Alert.alert("Company name required", "Please enter your company name.");
        return;
      }
    }

    // Update local demo state immediately so screens reflect the role
    setProfile({
      ...profile,
      role,
      company: needsInvite ? "Joining team…" : companyName.trim(),
      orgName: needsInvite ? undefined : companyName.trim(),
      orgInviteCode: needsInvite ? undefined : profile.orgInviteCode,
      phone: phone.trim() || profile.phone,
    });

    try {
      await createProfile.mutateAsync({
        role,
        companyName: needsInvite
          ? "Pending team assignment"
          : companyName.trim(),
        phone: phone.trim() || undefined,
        inviteCode: needsInvite ? inviteCode.trim().toUpperCase() : undefined,
        ...(isProvider
          ? {
              dba: dba.trim() || undefined,
              website: website.trim() || undefined,
              mcNumber: mcNumber.trim() || undefined,
              capacityTons: num(capacityTons),
              capacityYards: num(capacityYards),
              countiesServed: countiesServed.trim() || undefined,
              hourlyRate: num(hourlyRate),
              minimumHours: num(minimumHours),
              equipmentTypes: equipmentTypes.length
                ? equipmentTypes.join(",")
                : undefined,
            }
          : {}),
        ...(isCustomer
          ? {
              billingEinLast4: billingEinLast4.trim() || undefined,
              apContactName: apContactName.trim() || undefined,
              apEmail: apEmail.trim() || undefined,
              paymentTerms: paymentTerms.trim() || undefined,
            }
          : {}),
      });
      router.replace("/" as any);
    } catch (err: any) {
      const msg: string = err?.message ?? String(err ?? "");
      // Distinguish auth/network from real validation failures.
      const isAuthOrNetwork =
        /unauthor|401|403|network|fetch|failed to fetch|ecconnref|timeout/i.test(
          msg,
        );
      if (needsInvite && !isAuthOrNetwork) {
        // Real backend rejected the invite code — surface it and stop.
        Alert.alert(
          "Couldn't join team",
          msg ||
            "That invite code didn't match an organization. Double-check with your manager and try again.",
        );
        return;
      }
      // Auth/network unavailable in demo preview — continue with local demo state.
      if (!isAuthOrNetwork) {
        Alert.alert(
          "Saved locally",
          msg ||
            "We saved your setup on this device. Some features will sync once you're signed in.",
        );
      }
      router.replace("/" as any);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoRow}>
            <Image
              source={require("../assets/images/haulbrokr-logo.png")}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Set up your account</Text>
          <Text style={styles.subtitle}>Tell us how you'll use HaulBrokr</Text>

          <View style={styles.labelRow}>
            <Text style={styles.label}>I am a...</Text>
            {role && (
              <Pressable
                onPress={() => {
                  setRole(null);
                  setCompanyName("");
                  setInviteCode("");
                }}
                hitSlop={10}
              >
                <Text style={styles.changeLink}>← Change role</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.roleGrid}>
            {ROLES.map((r) => {
              const active = role === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setRole(r.id)}
                  style={[styles.roleCard, active && styles.roleCardActive]}
                >
                  <Feather
                    name={r.icon}
                    size={22}
                    color={active ? "#1e2235" : "#8ba0b8"}
                  />
                  <Text
                    style={[styles.roleTitle, active && styles.roleTitleActive]}
                  >
                    {r.title}
                  </Text>
                  <Text
                    style={[styles.roleSub, active && styles.roleSubActive]}
                  >
                    {r.sub}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {needsInvite ? (
            <>
              <Text style={styles.label}>Team invite code *</Text>
              <View style={styles.inputRow}>
                <Feather
                  name="key"
                  size={15}
                  color="#8ba0b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 4K7P2X"
                  placeholderTextColor="#4a5568"
                  value={inviteCode}
                  onChangeText={(t) => setInviteCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={10}
                />
              </View>
              <Text style={styles.helperText}>
                {role === "driver"
                  ? "Ask your trucking company manager for the code shown in their Team screen."
                  : "Ask your construction company manager for the code shown in their Team screen."}
              </Text>
            </>
          ) : role ? (
            <>
              <Text style={styles.label}>{ownerCompanyLabel}</Text>
              <View style={styles.inputRow}>
                <Feather
                  name="briefcase"
                  size={15}
                  color="#8ba0b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder={
                    role === "provider"
                      ? "e.g. MW Hauling LLC"
                      : "e.g. Apex Construction LLC"
                  }
                  placeholderTextColor="#4a5568"
                  value={companyName}
                  onChangeText={setCompanyName}
                />
              </View>
              <Text style={styles.helperText}>
                You'll get an invite code to share with your team.
              </Text>
            </>
          ) : null}

          {isProvider && (
            <>
              <Text style={styles.sectionLabel}>Carrier details</Text>

              <Text style={styles.label}>DBA (optional)</Text>
              <View style={styles.inputRow}>
                <Feather
                  name="tag"
                  size={15}
                  color="#8ba0b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Doing-business-as name"
                  placeholderTextColor="#4a5568"
                  value={dba}
                  onChangeText={setDba}
                />
              </View>

              <Text style={styles.label}>Website (optional)</Text>
              <View style={styles.inputRow}>
                <Feather
                  name="globe"
                  size={15}
                  color="#8ba0b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="https://"
                  placeholderTextColor="#4a5568"
                  value={website}
                  onChangeText={setWebsite}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              <Text style={styles.label}>MC number (optional)</Text>
              <View style={styles.inputRow}>
                <Feather
                  name="hash"
                  size={15}
                  color="#8ba0b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="MC-123456"
                  placeholderTextColor="#4a5568"
                  value={mcNumber}
                  onChangeText={setMcNumber}
                />
              </View>

              <View style={styles.row2}>
                <View style={styles.col}>
                  <Text style={styles.label}>Capacity (tons)</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder="20"
                      placeholderTextColor="#4a5568"
                      value={capacityTons}
                      onChangeText={setCapacityTons}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Capacity (yards)</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder="16"
                      placeholderTextColor="#4a5568"
                      value={capacityYards}
                      onChangeText={setCapacityYards}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.label}>Counties served (optional)</Text>
              <View style={styles.inputRow}>
                <Feather
                  name="map-pin"
                  size={15}
                  color="#8ba0b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Cook, DuPage, Will"
                  placeholderTextColor="#4a5568"
                  value={countiesServed}
                  onChangeText={setCountiesServed}
                />
              </View>

              <View style={styles.row2}>
                <View style={styles.col}>
                  <Text style={styles.label}>Hourly rate ($)</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder="125"
                      placeholderTextColor="#4a5568"
                      value={hourlyRate}
                      onChangeText={setHourlyRate}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Minimum hours</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder="4"
                      placeholderTextColor="#4a5568"
                      value={minimumHours}
                      onChangeText={setMinimumHours}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.label}>Equipment operated</Text>
              <View style={styles.equipGrid}>
                {EQUIPMENT_TYPES.map((eq) => {
                  const active = equipmentTypes.includes(eq.value);
                  return (
                    <Pressable
                      key={eq.value}
                      onPress={() =>
                        setEquipmentTypes((prev) =>
                          prev.includes(eq.value)
                            ? prev.filter((v) => v !== eq.value)
                            : [...prev, eq.value],
                        )
                      }
                      style={[
                        styles.equipChip,
                        active && styles.equipChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.equipChipText,
                          active && styles.equipChipTextActive,
                        ]}
                      >
                        {eq.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.helperText}>
                Select every truck and machine type you run.
              </Text>
            </>
          )}

          {isCustomer && (
            <>
              <Text style={styles.sectionLabel}>Billing details</Text>

              <Text style={styles.label}>EIN (last 4, optional)</Text>
              <View style={styles.inputRow}>
                <Feather
                  name="credit-card"
                  size={15}
                  color="#8ba0b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="1234"
                  placeholderTextColor="#4a5568"
                  value={billingEinLast4}
                  onChangeText={setBillingEinLast4}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>

              <Text style={styles.label}>A/P contact name (optional)</Text>
              <View style={styles.inputRow}>
                <Feather
                  name="user"
                  size={15}
                  color="#8ba0b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Accounts payable contact"
                  placeholderTextColor="#4a5568"
                  value={apContactName}
                  onChangeText={setApContactName}
                />
              </View>

              <Text style={styles.label}>A/P email (optional)</Text>
              <View style={styles.inputRow}>
                <Feather
                  name="mail"
                  size={15}
                  color="#8ba0b8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="ap@company.com"
                  placeholderTextColor="#4a5568"
                  value={apEmail}
                  onChangeText={setApEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <Text style={styles.label}>
                Preferred payment terms (optional)
              </Text>
              <View style={styles.termsRow}>
                {["due_on_receipt", "net_15", "net_30"].map((t) => {
                  const active = paymentTerms === t;
                  const lbl =
                    t === "due_on_receipt"
                      ? "Due on receipt"
                      : t === "net_15"
                        ? "Net 15"
                        : "Net 30";
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setPaymentTerms(active ? "" : t)}
                      style={[styles.termChip, active && styles.termChipActive]}
                    >
                      <Text
                        style={[
                          styles.termChipText,
                          active && styles.termChipTextActive,
                        ]}
                      >
                        {lbl}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.helperText}>
                Net terms require credit approval, which you can apply for after
                signup.
              </Text>
            </>
          )}

          <Text style={[styles.label, { marginTop: 6 }]}>Phone (optional)</Text>
          <View style={styles.inputRow}>
            <Feather
              name="phone"
              size={15}
              color="#8ba0b8"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="(555) 000-0000"
              placeholderTextColor="#4a5568"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <Pressable
            style={[styles.btn, createProfile.isPending && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={createProfile.isPending}
          >
            {createProfile.isPending ? (
              <ActivityIndicator color="#1e2235" />
            ) : (
              <Text style={styles.btnText}>
                {needsInvite ? "Join Team →" : "Get Started →"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#1e2235" },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  logoRow: { alignItems: "center", marginBottom: 16 },
  logoImg: { width: "70%", height: 72 },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#f0f6ff",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#8ba0b8",
    textAlign: "center",
    marginBottom: 28,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#8ba0b8",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#e9a600",
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  row2: { flexDirection: "row", gap: 10 },
  col: { flex: 1 },
  equipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  equipChip: {
    borderWidth: 1.5,
    borderColor: "#3a4565",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: "#2a3352",
  },
  equipChipActive: { borderColor: "#e9a600", backgroundColor: "#e9a600" },
  equipChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#8ba0b8",
  },
  equipChipTextActive: { color: "#1e2235" },
  termsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  termChip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#3a4565",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#2a3352",
  },
  termChipActive: { borderColor: "#e9a600", backgroundColor: "#e9a600" },
  termChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#8ba0b8",
  },
  termChipTextActive: { color: "#1e2235" },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  changeLink: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#e9a600",
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  roleCard: {
    width: "48%",
    borderWidth: 1.5,
    borderColor: "#3a4565",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2a3352",
  },
  roleCardActive: { borderColor: "#e9a600", backgroundColor: "#e9a600" },
  roleTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#f0f6ff" },
  roleTitleActive: { color: "#1e2235" },
  roleSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#8ba0b8",
    textAlign: "center",
  },
  roleSubActive: { color: "#1e223580" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a3352",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3a4565",
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    height: 48,
    color: "#f0f6ff",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  helperText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#8ba0b8",
    marginBottom: 14,
    marginLeft: 4,
  },
  btn: {
    backgroundColor: "#e9a600",
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#1e2235", fontFamily: "Inter_700Bold", fontSize: 16 },
});
