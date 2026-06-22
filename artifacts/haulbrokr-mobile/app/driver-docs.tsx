import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, Stack } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useApp, type Role } from "@/context/AppContext";
import {
  useDriverDocs,
  useUpsertDriverDoc,
  useDeleteDriverDoc,
  useUploadFile,
  type RemoteDriverDoc,
} from "@/hooks/useLiveApi";

type DocStatus = "missing" | "uploaded" | "verified" | "rejected";

// UI doc id (left) ↔ backend doc_type (right)
const DOC_TYPE_MAP = {
  drivers_license_front: "dl_front",
  drivers_license_back: "dl_back",
  cdl_front: "cdl_front",
  cdl_back: "cdl_back",
  medical_card: "dot_medical_card",
  drug_test: "drug_test",
  mvr: "mvr",
  ssn_card: "ssn_card",
  w9: "w9",
  coi: "coi",
  dot_authority: "dot_authority",
  background_check: "background_check",
  twic: "twic",
  // Carrier (provider company) documents
  business_license: "business_license",
  mc_authority: "mc_authority",
  vehicle_registration: "vehicle_registration",
  equipment_list: "equipment_list",
  signed_carrier_agreement: "signed_carrier_agreement",
  voided_check: "voided_check",
  ach_authorization: "ach_authorization",
  safety_rating: "safety_rating",
  bond: "bond",
  // Customer documents
  po_template: "po_template",
  tax_exempt_certificate: "tax_exempt_certificate",
} as const;

type DocId = keyof typeof DOC_TYPE_MAP;

type DocSpec = {
  id: DocId;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  required: boolean;
  expires?: boolean;
  roles: Role[];
};

const DOC_SPECS: DocSpec[] = [
  // ── Driver hiring packet ───────────────────────────────────────────────
  { id: "drivers_license_front", label: "Driver's License — Front", description: "Photo ID, front side", icon: "credit-card", required: true, expires: true, roles: ["driver"] },
  { id: "drivers_license_back", label: "Driver's License — Back", description: "Photo ID, back side", icon: "credit-card", required: true, expires: true, roles: ["driver"] },
  { id: "cdl_front", label: "CDL — Front", description: "Commercial Driver's License, front", icon: "truck", required: true, expires: true, roles: ["driver"] },
  { id: "cdl_back", label: "CDL — Back", description: "CDL endorsements, back", icon: "truck", required: true, expires: true, roles: ["driver"] },
  { id: "medical_card", label: "DOT Medical Card", description: "Medical Examiner's Certificate", icon: "activity", required: true, expires: true, roles: ["driver"] },
  { id: "drug_test", label: "Drug & Alcohol Test", description: "Most recent DOT drug screen result", icon: "alert-circle", required: true, roles: ["driver"] },
  { id: "mvr", label: "MVR (Driving Record)", description: "Motor Vehicle Record — last 3 yrs", icon: "list", required: true, roles: ["driver"] },
  { id: "ssn_card", label: "Social Security Card", description: "For payroll & I-9 verification", icon: "user", required: true, roles: ["driver"] },
  { id: "background_check", label: "Background Check Consent", description: "Signed authorization form", icon: "check-square", required: true, roles: ["driver"] },
  { id: "twic", label: "TWIC Card", description: "Optional — port / secure-site access", icon: "key", required: false, expires: true, roles: ["driver"] },
  // ── Carrier (provider company) documents ───────────────────────────────
  { id: "business_license", label: "Business License", description: "State / city business registration", icon: "briefcase", required: true, roles: ["provider"] },
  { id: "mc_authority", label: "MC Authority", description: "FMCSA operating authority letter", icon: "award", required: true, roles: ["provider"] },
  { id: "vehicle_registration", label: "Vehicle Registration", description: "Registration for trucks in your fleet", icon: "file-text", required: true, expires: true, roles: ["provider"] },
  { id: "equipment_list", label: "Equipment List", description: "Itemized list of trucks & machines", icon: "list", required: true, roles: ["provider"] },
  { id: "signed_carrier_agreement", label: "Signed Carrier Agreement", description: "HaulBrokr carrier contract", icon: "edit-3", required: true, roles: ["provider"] },
  { id: "coi", label: "Certificate of Insurance (COI)", description: "Auto liability & cargo proof", icon: "shield", required: true, expires: true, roles: ["driver", "provider"] },
  { id: "w9", label: "W-9 Tax Form", description: "Signed W-9 for payments", icon: "file-text", required: true, roles: ["driver", "provider"] },
  { id: "dot_authority", label: "DOT Authority Letter", description: "USDOT / MC authority on file", icon: "award", required: false, roles: ["driver", "provider"] },
  { id: "voided_check", label: "Voided Check", description: "For ACH payout setup", icon: "credit-card", required: true, roles: ["provider"] },
  { id: "ach_authorization", label: "ACH Authorization", description: "Signed direct-deposit authorization", icon: "edit-3", required: false, roles: ["provider"] },
  { id: "safety_rating", label: "Safety Rating", description: "FMCSA safety rating documentation", icon: "shield", required: false, roles: ["provider"] },
  { id: "bond", label: "Surety Bond", description: "Broker / carrier bond, if applicable", icon: "lock", required: false, roles: ["provider"] },
  // ── Customer documents ─────────────────────────────────────────────────
  { id: "po_template", label: "PO Template", description: "Your purchase-order template", icon: "file-text", required: false, roles: ["customer"] },
  { id: "tax_exempt_certificate", label: "Tax-Exempt Certificate", description: "Resale / exemption certificate, if applicable", icon: "percent", required: false, roles: ["customer"] },
];

type DocRecord = {
  status: DocStatus;
  uri?: string;          // remote serving URL
  filename?: string;
  uploadedAt?: string;
  number?: string;
  expiry?: string;       // ISO yyyy-mm-dd (entered as MM/DD/YYYY in UI)
};

const NUM_FIELDS: Partial<Record<DocId, { label: string; placeholder: string }>> = {
  drivers_license_front: { label: "License #", placeholder: "DL number" },
  cdl_front: { label: "CDL #", placeholder: "CDL number" },
  medical_card: { label: "Cert #", placeholder: "Med cert number" },
  coi: { label: "Policy #", placeholder: "Policy number" },
  twic: { label: "TWIC #", placeholder: "TWIC number" },
};

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

function emptyState(): Record<DocId, DocRecord> {
  return Object.fromEntries(
    DOC_SPECS.map((d) => [d.id, { status: "missing" as DocStatus }]),
  ) as Record<DocId, DocRecord>;
}

function backendToUi(rows: RemoteDriverDoc[]): Record<DocId, DocRecord> {
  const out = emptyState();
  const reverse: Record<string, DocId> = {};
  for (const [uiId, beType] of Object.entries(DOC_TYPE_MAP)) reverse[beType] = uiId as DocId;
  for (const row of rows) {
    const uiId = reverse[row.docType];
    if (!uiId) continue;
    out[uiId] = {
      status: row.status,
      uri: row.objectPath ? `${API_BASE}/storage${row.objectPath}` : undefined,
      filename: row.fileName ?? undefined,
      uploadedAt: row.uploadedAt ?? undefined,
      number: row.docNumber ?? undefined,
      expiry: row.expiry ? new Date(row.expiry).toLocaleDateString("en-US") : undefined,
    };
  }
  return out;
}

function parseExpiryToISO(value: string): string | null {
  // Accept MM/DD/YYYY → ISO. Returns null if unparseable.
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function DriverDocsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const remote = useDriverDocs();
  const upsert = useUpsertDriverDoc();
  const del = useDeleteDriverDoc();
  const upload = useUploadFile();

  const [docs, setDocs] = useState<Record<DocId, DocRecord>>(() => emptyState());
  const [busyId, setBusyId] = useState<DocId | null>(null);
  const [openId, setOpenId] = useState<DocId | null>(null);
  // Track field keys the user has locally edited so a background refetch
  // doesn't clobber an in-flight typed value (e.g. License #).
  const dirtyRef = useRef<Set<string>>(new Set());

  // Merge remote → local. Preserves locally-edited text fields until they're
  // saved (onBlur clears their dirty flag).
  useEffect(() => {
    if (!remote.data) return;
    const next = backendToUi(remote.data);
    setDocs((prev) => {
      const merged: Record<DocId, DocRecord> = { ...next };
      for (const key of dirtyRef.current) {
        const [id, field] = key.split(":") as [DocId, "number" | "expiry"];
        if (merged[id]) merged[id] = { ...merged[id], [field]: prev[id]?.[field] };
      }
      return merged;
    });
  }, [remote.data]);

  const handlePick = async (docId: DocId, source: "camera" | "library") => {
    setBusyId(docId);
    try {
      const result = source === "camera"
        ? await (async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) { Alert.alert("Camera blocked", "Enable camera access in Settings to take a photo."); return null; }
            return ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.8 });
          })()
        : await (async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) { Alert.alert("Photos blocked", "Enable photo library access in Settings."); return null; }
            return ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.8 });
          })();
      if (!result || result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      // 1. Upload bytes to GCS via presigned URL, finalize server-side.
      const filename = asset.fileName ?? `${docId}.jpg`;
      const mimeType = asset.mimeType ?? "image/jpeg";
      const { objectPath, storageToken } = await upload.mutateAsync({ uri: asset.uri, name: filename, mimeType });

      // 2. Record metadata on the server.
      await upsert.mutateAsync({
        docType: DOC_TYPE_MAP[docId],
        objectPath,
        storageToken,
        fileName: filename,
        mimeType,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message ?? "Could not attach file.");
    } finally {
      setBusyId(null);
    }
  };

  const handleField = (docId: DocId, key: "number" | "expiry", value: string) => {
    dirtyRef.current.add(`${docId}:${key}`);
    setDocs((prev) => ({ ...prev, [docId]: { ...prev[docId], [key]: value } }));
  };

  const commitField = (docId: DocId, key: "number" | "expiry", value: string) => {
    if (key === "expiry") {
      const iso = value ? parseExpiryToISO(value) : null;
      if (value && !iso) {
        Alert.alert("Date format", "Please enter the expiration as MM/DD/YYYY.");
        return;
      }
      upsert.mutate(
        { docType: DOC_TYPE_MAP[docId], expiry: iso },
        { onSuccess: () => dirtyRef.current.delete(`${docId}:expiry`) },
      );
    } else {
      upsert.mutate(
        { docType: DOC_TYPE_MAP[docId], docNumber: value || null },
        { onSuccess: () => dirtyRef.current.delete(`${docId}:number`) },
      );
    }
  };

  const handleRemove = (docId: DocId) => {
    Alert.alert("Remove document", "Delete this uploaded file?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await del.mutateAsync(DOC_TYPE_MAP[docId]);
          setOpenId(null);
        } catch (err: any) {
          Alert.alert("Delete failed", err?.message ?? "Could not delete.");
        }
      }},
    ]);
  };

  const role = (profile.role ?? "driver") as Role;
  const roleSpecs = useMemo(() => DOC_SPECS.filter((d) => d.roles.includes(role)), [role]);
  const requiredSpecs = useMemo(() => roleSpecs.filter((d) => d.required), [roleSpecs]);
  const optionalSpecs = useMemo(() => roleSpecs.filter((d) => !d.required), [roleSpecs]);
  const required = requiredSpecs;
  const requiredCompleted = required.filter((d) => docs[d.id].status !== "missing").length;
  const pct = required.length ? Math.round((requiredCompleted / required.length) * 100) : 100;
  const allRequired = requiredCompleted === required.length;
  const topPad = Platform.OS === "web" ? 16 : insets.top + 4;

  const headerCopy =
    role === "provider"
      ? { title: "Company Documents", subtitle: "Carrier compliance & payout paperwork on file", packet: "Carrier packet", section: "REQUIRED TO ONBOARD" }
      : role === "customer"
        ? { title: "Billing Documents", subtitle: "Optional paperwork to speed up invoicing", packet: "Billing packet", section: "DOCUMENTS" }
        : { title: "Driver Documents", subtitle: "Everything you need on file to get hired and start hauling", packet: "Hiring packet", section: "REQUIRED FOR HIRING" };

  if (remote.isLoading) {
    return (
      <View style={[styles.loadingRoot, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{headerCopy.title}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {headerCopy.subtitle}
            </Text>
          </View>
        </View>

        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: allRequired ? "#16a34a40" : colors.border }]}>
          <View style={styles.progressHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.progressTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {allRequired ? `${headerCopy.packet} complete` : headerCopy.packet}
              </Text>
              <Text style={[styles.progressSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {requiredCompleted} of {required.length} required documents
              </Text>
            </View>
            <Text style={[styles.progressPct, { color: allRequired ? "#16a34a" : colors.primary, fontFamily: "Inter_700Bold" }]}>{pct}%</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { backgroundColor: allRequired ? "#16a34a" : colors.primary, width: `${pct}%` as any }]} />
          </View>
        </View>

        <View style={[styles.banner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" }]}>
          <Feather name="cloud" size={14} color={colors.primary} />
          <Text style={[styles.bannerText, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
            Uploads sync securely to your dispatcher for review.
          </Text>
        </View>

        {requiredSpecs.length > 0 && (
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{headerCopy.section}</Text>
        )}
        {requiredSpecs.map((spec) => (
          <DocRow
            key={spec.id}
            spec={spec}
            record={docs[spec.id]}
            colors={colors}
            isOpen={openId === spec.id}
            isBusy={busyId === spec.id}
            onToggle={() => setOpenId(openId === spec.id ? null : spec.id)}
            onPick={(src) => handlePick(spec.id, src)}
            onField={(k, v) => handleField(spec.id, k, v)}
            onCommit={(k, v) => commitField(spec.id, k, v)}
            onRemove={() => handleRemove(spec.id)}
          />
        ))}

        {optionalSpecs.length > 0 && (
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", marginTop: 24 }]}>OPTIONAL</Text>
        )}
        {optionalSpecs.map((spec) => (
          <DocRow
            key={spec.id}
            spec={spec}
            record={docs[spec.id]}
            colors={colors}
            isOpen={openId === spec.id}
            isBusy={busyId === spec.id}
            onToggle={() => setOpenId(openId === spec.id ? null : spec.id)}
            onPick={(src) => handlePick(spec.id, src)}
            onField={(k, v) => handleField(spec.id, k, v)}
            onCommit={(k, v) => commitField(spec.id, k, v)}
            onRemove={() => handleRemove(spec.id)}
          />
        ))}

        <Text style={[styles.footnote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Documents you upload here are visible to your dispatcher and the customer site supervisor for active jobs. Keep expirations current to stay eligible for work.
        </Text>
      </ScrollView>
    </>
  );
}

function DocRow({
  spec, record, colors, isOpen, isBusy, onToggle, onPick, onField, onCommit, onRemove,
}: {
  spec: DocSpec;
  record: DocRecord;
  colors: any;
  isOpen: boolean;
  isBusy: boolean;
  onToggle: () => void;
  onPick: (src: "camera" | "library") => void;
  onField: (k: "number" | "expiry", v: string) => void;
  onCommit: (k: "number" | "expiry", v: string) => void;
  onRemove: () => void;
}) {
  const status = record.status;
  const statusColor =
    status === "verified" ? "#16a34a" :
    status === "uploaded" ? colors.primary :
    status === "rejected" ? "#ef4444" :
    colors.mutedForeground;
  const statusLabel =
    status === "verified" ? "Verified" :
    status === "uploaded" ? "Pending review" :
    status === "rejected" ? "Rejected" :
    "Missing";
  const numField = NUM_FIELDS[spec.id];

  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(); }}
      style={[styles.docCard, { backgroundColor: colors.card, borderColor: status === "missing" && spec.required ? "#ef444430" : colors.border }]}
    >
      <View style={styles.docHeader}>
        <View style={[styles.docIcon, { backgroundColor: statusColor + "18" }]}>
          <Feather name={spec.icon} size={18} color={statusColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.docLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>{spec.label}</Text>
          <Text style={[styles.docDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{spec.description}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
          <Text style={[styles.statusText, { color: statusColor, fontFamily: "Inter_600SemiBold" }]}>{statusLabel}</Text>
        </View>
      </View>

      {isOpen && (
        <View style={[styles.docBody, { borderTopColor: colors.border }]}>
          {record.uri ? (
            <View style={[styles.previewBox, { borderColor: colors.border }]}>
              <Image source={{ uri: record.uri }} style={styles.previewImg} resizeMode="cover" />
              <View style={styles.previewMeta}>
                <Text numberOfLines={1} style={[styles.previewName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {record.filename ?? "Uploaded file"}
                </Text>
                {record.uploadedAt && (
                  <Text style={[styles.previewDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    Uploaded {new Date(record.uploadedAt).toLocaleString()}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <Text style={[styles.emptyHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              No file uploaded yet. Take a photo or pick from your library.
            </Text>
          )}

          {(numField || spec.expires) && (
            <View style={styles.fieldRow}>
              {numField && (
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{numField.label}</Text>
                  <TextInput
                    value={record.number ?? ""}
                    onChangeText={(t) => onField("number", t)}
                    onBlur={() => onCommit("number", record.number ?? "")}
                    placeholder={numField.placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, fontFamily: "Inter_400Regular" }]}
                  />
                </View>
              )}
              {spec.expires && (
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>Expires</Text>
                  <TextInput
                    value={record.expiry ?? ""}
                    onChangeText={(t) => onField("expiry", t)}
                    onBlur={() => onCommit("expiry", record.expiry ?? "")}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, fontFamily: "Inter_400Regular" }]}
                  />
                </View>
              )}
            </View>
          )}

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => onPick("camera")}
              disabled={isBusy}
              style={[styles.actionBtn, { backgroundColor: colors.primary, opacity: isBusy ? 0.6 : 1 }]}
            >
              {isBusy ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <>
                <Feather name="camera" size={14} color={colors.primaryForeground} />
                <Text style={[styles.actionText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>Take Photo</Text>
              </>}
            </Pressable>
            <Pressable
              onPress={() => onPick("library")}
              disabled={isBusy}
              style={[styles.actionBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, opacity: isBusy ? 0.6 : 1 }]}
            >
              <Feather name="image" size={14} color={colors.foreground} />
              <Text style={[styles.actionText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Upload File</Text>
            </Pressable>
            {record.uri && (
              <Pressable
                onPress={onRemove}
                style={[styles.actionBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: "#ef444450", flex: 0, paddingHorizontal: 12 }]}
              >
                <Feather name="trash-2" size={14} color="#ef4444" />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loadingRoot: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20 },
  subtitle: { fontSize: 12, marginTop: 2 },
  progressCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10, marginBottom: 12 },
  progressHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressTitle: { fontSize: 14 },
  progressSub: { fontSize: 12, marginTop: 2 },
  progressPct: { fontSize: 20 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 16,
  },
  bannerText: { fontSize: 12, flex: 1 },
  sectionLabel: { fontSize: 11, letterSpacing: 1.2, marginBottom: 10 },
  docCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  docHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  docIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  docLabel: { fontSize: 14 },
  docDesc: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, letterSpacing: 0.4 },
  docBody: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, gap: 12 },
  previewBox: {
    flexDirection: "row", borderWidth: 1, borderRadius: 10, overflow: "hidden",
    alignItems: "center", gap: 12,
  },
  previewImg: { width: 64, height: 64 },
  previewMeta: { flex: 1, paddingRight: 10, gap: 2 },
  previewName: { fontSize: 13 },
  previewDate: { fontSize: 11 },
  emptyHint: { fontSize: 12 },
  fieldRow: { flexDirection: "row", gap: 10 },
  fieldLabel: { fontSize: 11, marginBottom: 4, letterSpacing: 0.3 },
  fieldInput: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13,
  },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 8,
  },
  actionText: { fontSize: 13 },
  footnote: { fontSize: 11, textAlign: "center", marginTop: 16, lineHeight: 16 },
});
