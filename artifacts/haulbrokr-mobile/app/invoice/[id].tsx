import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { ACCENT } from "@/constants/theme";
import { useLiveJobs, useLiveRequests } from "@/hooks/useLiveApi";
import {
  liveJobToViewJob,
  liveRequestToViewJob,
  type LiveJob,
  type LiveRequest,
} from "@/lib/liveJob";

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { jobs, profile } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Resolve live data the same way the job detail screen does: `req-N` ids are
  // customer-posted requests, numeric ids are live jobs; fall back to demo data.
  const isRequestId = typeof id === "string" && id.startsWith("req-");
  const requestNumericId = isRequestId ? parseInt(id.slice(4), 10) : null;
  const numericId = !isRequestId && id ? parseInt(id, 10) : null;
  const { data: liveJobsRaw } = useLiveJobs();
  const { data: liveRequestsRaw } = useLiveRequests({
    mine: true,
    enabled: isRequestId,
  });

  const liveJob =
    numericId != null && Array.isArray(liveJobsRaw)
      ? (liveJobsRaw as LiveJob[]).find((j) => j.id === numericId)
      : undefined;
  const liveRequest =
    requestNumericId != null && Array.isArray(liveRequestsRaw)
      ? (liveRequestsRaw as LiveRequest[]).find(
          (r) => r.id === requestNumericId,
        )
      : undefined;
  const isLiveJob = !!liveJob;
  const job = liveJob
    ? liveJobToViewJob(liveJob)
    : liveRequest
      ? liveRequestToViewJob(liveRequest)
      : jobs.find((j) => j.id === id);
  if (!job) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
              paddingTop: topPad + 12,
            },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Invoice
          </Text>
          <View style={styles.shareBtn} />
        </View>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Feather
            name="file-text"
            size={40}
            color={colors.mutedForeground}
            style={{ marginBottom: 12 }}
          />
          <Text
            style={{
              color: colors.foreground,
              fontFamily: "Inter_600SemiBold",
              fontSize: 17,
              marginBottom: 6,
            }}
          >
            Invoice Not Found
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              textAlign: "center",
              paddingHorizontal: 32,
              marginBottom: 24,
            }}
          >
            This invoice may no longer be available or the link is invalid.
          </Text>
          <Pressable
            onPress={() => router.replace("/(tabs)/jobs")}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 10,
            }}
          >
            <Text
              style={{
                color: colors.primaryForeground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
              }}
            >
              Browse All Loads
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Live jobs carry real, server-computed amounts (in dollars): totalAmount is
  // the provider work value, platformFeeAmount is the 15% broker fee, and
  // customerTotalAmount is the gross the customer is billed. Demo jobs keep the
  // legacy estimate (rate × hours × trucks with a 3% deduction).
  const rawHours = isLiveJob ? (liveJob!.totalHours as number | null) : null;
  const hoursWorked =
    rawHours ?? (job.checkInTime && job.checkOutTime ? 9.65 : 8);
  let subtotal: number;
  let feeLabel: string;
  let feeAmount: number;
  let feeIsDeduction: boolean;
  let total: number;
  if (isLiveJob) {
    const rawBase = liveJob!.totalAmount as number | null;
    const rawFee = liveJob!.platformFeeAmount as number | null;
    const rawCustomer = liveJob!.customerTotalAmount as number | null;
    subtotal =
      rawBase ?? Math.round(job.budgetPerHour * hoursWorked * job.trucksNeeded);
    feeAmount = rawFee ?? Math.round(subtotal * 0.15);
    total = rawCustomer ?? subtotal + feeAmount;
    feeLabel = "Broker Fee (15%)";
    feeIsDeduction = false;
  } else {
    subtotal = Math.round(job.budgetPerHour * hoursWorked * job.trucksNeeded);
    feeAmount = Math.round(subtotal * 0.03);
    total = subtotal - feeAmount;
    feeLabel = "Platform Fee (3%)";
    feeIsDeduction = true;
  }
  const invoiceNum = `INV-${new Date().getFullYear()}-${job.id.padStart(4, "0")}`;
  const issueDate = job.checkOutTime
    ? job.scheduledDate
    : new Date().toISOString().split("T")[0];

  const totalTicketWeight = (job.loadTickets ?? []).reduce((acc, t) => {
    const w = parseFloat(t.weight?.replace(" tons", "") ?? "0");
    return acc + (isNaN(w) ? 0 : w);
  }, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: topPad + 12,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          Invoice
        </Text>
        <Pressable
          onPress={() =>
            Alert.alert(
              "Share Invoice",
              "Invoice PDF will be sent to your email and can be shared via the share sheet.",
            )
          }
          style={[styles.shareBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="share" size={16} color={colors.primaryForeground} />
          <Text
            style={[
              styles.shareBtnText,
              {
                color: colors.primaryForeground,
                fontFamily: "Inter_600SemiBold",
              },
            ]}
          >
            Share
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Invoice document */}
        <View
          style={[
            styles.invoice,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {/* Letterhead */}
          <View
            style={[styles.letterhead, { backgroundColor: colors.primary }]}
          >
            <View>
              <Text
                style={[
                  styles.brandName,
                  {
                    color: colors.primaryForeground,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                HaulBrokr
              </Text>
              <Text
                style={[
                  styles.brandTagline,
                  {
                    color: colors.primaryForeground + "cc",
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                Professional Hauling Network
              </Text>
            </View>
            <View
              style={[
                styles.paidStamp,
                { borderColor: colors.primaryForeground + "60" },
              ]}
            >
              <Text
                style={[
                  styles.paidText,
                  {
                    color: colors.primaryForeground,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                {job.status === "completed" ? "PAID" : "PENDING"}
              </Text>
            </View>
          </View>

          {/* Invoice meta */}
          <View
            style={[styles.invoiceMeta, { borderBottomColor: colors.border }]}
          >
            <View style={{ gap: 4 }}>
              <Text
                style={[
                  styles.metaLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                INVOICE NUMBER
              </Text>
              <Text
                style={[
                  styles.metaValue,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                {invoiceNum}
              </Text>
            </View>
            <View style={{ gap: 4, alignItems: "flex-end" }}>
              <Text
                style={[
                  styles.metaLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                ISSUE DATE
              </Text>
              <Text
                style={[
                  styles.metaValue,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                {issueDate}
              </Text>
            </View>
          </View>

          {/* Bill to / Bill from */}
          <View
            style={[styles.partiesRow, { borderBottomColor: colors.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.partyLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                CUSTOMER
              </Text>
              <Text
                style={[
                  styles.partyName,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                {job.postedBy}
              </Text>
              <Text
                style={[
                  styles.partySub,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {job.pickupAddress.split(",").slice(-2).join(",").trim()}
              </Text>
            </View>
            <View
              style={[
                styles.partiesDivider,
                { backgroundColor: colors.border },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.partyLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                PROVIDER
              </Text>
              {job.providerCompany ? (
                <>
                  <Text
                    style={[
                      styles.partyName,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {job.providerCompany}
                  </Text>
                  <Text
                    style={[
                      styles.partySub,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    Dallas, TX
                  </Text>
                </>
              ) : (
                <>
                  <Text
                    style={[
                      styles.partyName,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                        fontStyle: "italic",
                      },
                    ]}
                  >
                    Pending Assignment
                  </Text>
                  <Text
                    style={[
                      styles.partySub,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    Awaiting bid acceptance
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Job details */}
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              JOB DETAILS
            </Text>
            <InvoiceRow
              label="Project"
              value={job.projectName}
              colors={colors}
            />
            <InvoiceRow label="Material" value={job.material} colors={colors} />
            {job.quantity > 0 && (
              <InvoiceRow
                label="Quantity"
                value={`${job.quantity.toLocaleString()} ${job.quantityUnit}`}
                colors={colors}
              />
            )}
            <InvoiceRow
              label="Trucks"
              value={`${job.trucksNeeded} truck${job.trucksNeeded !== 1 ? "s" : ""}`}
              colors={colors}
            />
            <InvoiceRow
              label="Date"
              value={job.scheduledDate}
              colors={colors}
            />
            {job.checkInTime && (
              <InvoiceRow
                label="Check-In"
                value={job.checkInTime}
                colors={colors}
              />
            )}
            {job.checkOutTime && (
              <InvoiceRow
                label="Check-Out"
                value={job.checkOutTime}
                colors={colors}
              />
            )}
            {totalTicketWeight > 0 && (
              <InvoiceRow
                label="Total Weight"
                value={`${totalTicketWeight.toFixed(1)} tons verified`}
                colors={colors}
                highlight
              />
            )}
          </View>

          {/* Load tickets summary */}
          {(job.loadTickets?.length ?? 0) > 0 && (
            <View
              style={[styles.section, { borderBottomColor: colors.border }]}
            >
              <Text
                style={[
                  styles.sectionTitle,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                LOAD TICKETS
              </Text>
              {job.loadTickets!.map((t) => (
                <View key={t.id} style={styles.ticketRow}>
                  <Text
                    style={[
                      styles.ticketNum,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    Load #{t.loadNumber}
                  </Text>
                  <Text
                    style={[
                      styles.ticketTime,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {t.timestamp}
                  </Text>
                  <Text
                    style={[
                      styles.ticketWeight,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {t.weight ?? "—"}
                  </Text>
                  {t.hasPhoto && (
                    <Feather name="image" size={12} color={ACCENT.blue} />
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Billing breakdown */}
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              BILLING
            </Text>
            <View style={styles.lineItem}>
              <Text
                style={[
                  styles.lineLabel,
                  { color: colors.foreground, fontFamily: "Inter_400Regular" },
                ]}
              >
                Hauling Service ({job.trucksNeeded} truck
                {job.trucksNeeded !== 1 ? "s" : ""} × ${job.budgetPerHour}/hr ×{" "}
                {hoursWorked}h)
              </Text>
              <Text
                style={[
                  styles.lineValue,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                ${subtotal.toLocaleString()}
              </Text>
            </View>
            <View style={styles.lineItem}>
              <Text
                style={[
                  styles.lineLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {feeLabel}
              </Text>
              <Text
                style={[
                  styles.lineValue,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {feeIsDeduction ? "-" : "+"}${feeAmount.toLocaleString()}
              </Text>
            </View>
            <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
              <Text
                style={[
                  styles.totalLabel,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                TOTAL
              </Text>
              <Text
                style={[
                  styles.totalValue,
                  { color: colors.primary, fontFamily: "Inter_700Bold" },
                ]}
              >
                ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View
            style={[
              styles.invoiceFooter,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Text
              style={[
                styles.footerText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              HaulBrokr Platform • support@haulbrokr.com • haulbrokr.com
            </Text>
            <Text
              style={[
                styles.footerText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              Questions? Contact us within 30 days of invoice date.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function InvoiceRow({
  label,
  value,
  colors,
  highlight,
}: {
  label: string;
  value: string;
  colors: any;
  highlight?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text
        style={[
          styles.infoLabel,
          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.infoValue,
          {
            color: highlight ? ACCENT.green : colors.foreground,
            fontFamily: highlight ? "Inter_700Bold" : "Inter_500Medium",
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
  },
  headerTitle: { flex: 1, fontSize: 20 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareBtnText: { fontSize: 14 },
  content: { padding: 16 },
  invoice: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  letterhead: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandName: { fontSize: 22 },
  brandTagline: { fontSize: 12, marginTop: 2 },
  paidStamp: {
    borderWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  paidText: { fontSize: 14, letterSpacing: 1 },
  invoiceMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  metaLabel: { fontSize: 10, letterSpacing: 0.8 },
  metaValue: { fontSize: 15 },
  partiesRow: {
    flexDirection: "row",
    padding: 16,
    gap: 16,
    borderBottomWidth: 1,
  },
  partiesDivider: { width: 1 },
  partyLabel: { fontSize: 10, letterSpacing: 0.8, marginBottom: 4 },
  partyName: { fontSize: 14 },
  partySub: { fontSize: 12, marginTop: 2 },
  section: { padding: 16, borderBottomWidth: 1, gap: 10 },
  sectionTitle: { fontSize: 10, letterSpacing: 0.8, marginBottom: 4 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  infoLabel: { fontSize: 13, flex: 1 },
  infoValue: { fontSize: 13, textAlign: "right" },
  ticketRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ticketNum: { fontSize: 12, flex: 1 },
  ticketTime: { fontSize: 12 },
  ticketWeight: { fontSize: 13 },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  lineLabel: { fontSize: 13, flex: 1, lineHeight: 18 },
  lineValue: { fontSize: 14 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: { fontSize: 14, letterSpacing: 0.5 },
  totalValue: { fontSize: 24 },
  invoiceFooter: { padding: 14, borderTopWidth: 1, gap: 4 },
  footerText: { fontSize: 11, textAlign: "center" },
});
