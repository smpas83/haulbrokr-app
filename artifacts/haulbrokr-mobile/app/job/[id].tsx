import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as ExpoLinking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { StatusBadge } from "@/components/StatusBadge";
import {
  RefreshingIndicator,
  isRefreshingPillVisible,
} from "@/components/RefreshingIndicator";
import { LastUpdated } from "@/components/LastUpdated";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useDriverLocationPing } from "@/hooks/useDriverTracking";
import { TYPE_COLOR, ACCENT } from "@/constants/theme";
import {
  useJobEvidence,
  useSubmitEvidence,
  useLiveJobs,
  useLiveRequests,
  useChargeJob,
  useReleaseJobPayment,
  useCreateJobCheckoutSession,
  useVerifyJobCheckout,
  useMyProfile,
  usePayoutStatus,
  useCreateBid,
  useUpdateRequest,
  useDeleteRequest,
  useUpdateJob,
  useTickets,
  useCreateTicket,
  useTicketClockIn,
  useTicketClockOut,
  useJobMessages,
  useSendJobMessage,
  useJobRating,
  useSubmitJobRating,
} from "@/hooks/useLiveApi";
import {
  liveJobToViewJob,
  liveRequestToViewJob,
  type LiveJob,
  type LiveRequest,
} from "@/lib/liveJob";

// Cancellation fee: 15% of estimated one-day earnings
function calcCancelFee(budgetPerHour: number) {
  return Math.round(budgetPerHour * 8 * 0.15);
}

const CANCEL_REASONS = [
  "Customer Request",
  "Scheduling Conflict",
  "Wrong Location Info",
  "Emergency",
  "Found Better Rate",
  "Other",
];

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    jobs,
    profile,
    placeBid,
    acceptBid,
    checkIn,
    checkOut,
    cancelJob,
    sendMessage,
    rateJob,
    updateJobStatus,
    addLoadTicket,
    fileDispute,
    ticketClockIn,
    ticketClockOut,
    generateTicketQR,
  } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // A `req-N` id is a customer-posted load request that hasn't become a job yet.
  const isRequestId = typeof id === "string" && id.startsWith("req-");
  const requestNumericId = isRequestId ? parseInt(id.slice(4), 10) : null;
  const numericId = !isRequestId && id ? parseInt(id, 10) : null;
  const evidenceQuery = useJobEvidence(numericId);
  const submitEvidence = useSubmitEvidence();
  const {
    data: liveJobsRaw,
    isFetching: fetchingJobs,
    isLoading: loadingJobs,
    dataUpdatedAt: jobsUpdatedAt,
  } = useLiveJobs();
  const {
    data: liveRequestsRaw,
    isFetching: fetchingRequests,
    dataUpdatedAt: requestsUpdatedAt,
  } = useLiveRequests({ mine: true, enabled: isRequestId });
  const { data: payoutStatusData, isFetching: fetchingPayout } =
    usePayoutStatus();
  const createBid = useCreateBid();
  const updateRequest = useUpdateRequest();
  const deleteRequest = useDeleteRequest();
  const updateJob = useUpdateJob();

  const [photoUrl, setPhotoUrl] = useState("");
  const [photoCaption, setPhotoCaption] = useState("");
  const [siteNotes, setSiteNotes] = useState("");
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidRate, setBidRate] = useState("");
  const [bidTrucks, setBidTrucks] = useState("1");
  const [bidMessage, setBidMessage] = useState("");
  const [canStart, setCanStart] = useState(true);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showBidsList, setShowBidsList] = useState(false);

  const [chatText, setChatText] = useState("");
  const [hoverRating, setHoverRating] = useState(0);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeText, setDisputeText] = useState("");

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
  const isProvider = profile.role === "provider";
  const isDriverRole = profile.role === "provider" || profile.role === "driver";
  const trackActive =
    isLiveJob &&
    isDriverRole &&
    ["accepted", "active", "in_progress"].includes(job?.status ?? "");
  useDriverLocationPing(numericId, trackActive);

  // Freshness of the live data feeding this screen — the most recent successful
  // refetch across the live job / request queries. Used by the LastUpdated label.
  const lastUpdated = Math.max(jobsUpdatedAt, requestsUpdatedAt) || undefined;

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
            Job Detail
          </Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.center}>
          <Feather
            name="alert-circle"
            size={40}
            color={colors.mutedForeground}
            style={{ marginBottom: 12 }}
          />
          <Text
            style={[
              {
                color: colors.foreground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 17,
                marginBottom: 6,
              },
            ]}
          >
            Job Not Found
          </Text>
          <Text
            style={[
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                textAlign: "center",
                paddingHorizontal: 32,
                marginBottom: 24,
              },
            ]}
          >
            This job may have been removed or the link is no longer valid.
          </Text>
          <Pressable
            onPress={() => router.replace("/(tabs)/jobs")}
            style={[
              {
                backgroundColor: colors.primary,
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 10,
              },
            ]}
          >
            <Text
              style={[
                {
                  color: colors.primaryForeground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 15,
                },
              ]}
            >
              Browse All Loads
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const typeColor = TYPE_COLOR[job.projectType] ?? colors.primary;
  const ticketTotalWeight = (job.loadTickets ?? []).reduce(
    (acc, t) => acc + parseFloat(t.weight?.replace(" tons", "") ?? "0"),
    0,
  );
  const canCheckIn =
    isProvider &&
    (job.status === "accepted" || job.status === "in_progress") &&
    !job.checkInTime;
  const canCheckOut =
    isProvider &&
    job.status === "in_progress" &&
    !!job.checkInTime &&
    !job.checkOutTime;
  const isActive = job.status === "accepted" || job.status === "in_progress";
  const isCancellable =
    job.status !== "completed" && job.status !== "cancelled";
  const hasProvider = !!job.providerPhone;

  // ── Bid submission ──────────────────────────────────────────────
  const payoutsEnabled = !!payoutStatusData?.payoutsEnabled;

  const submitBid = (rate: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const message =
      bidMessage || `Experienced team ready to haul ${job.material}.`;
    const trucksOffered = parseInt(bidTrucks) || 1;

    // Live customer request → persist the bid through the API. Demo loads keep
    // the local AppContext behaviour so the showcase still works offline.
    if (isRequestId && requestNumericId != null) {
      createBid.mutate(
        {
          requestId: requestNumericId,
          ratePerHour: rate,
          trucksOffered,
          message,
        },
        {
          onSuccess: () => {
            setShowBidForm(false);
            setBidRate("");
            setBidMessage("");
            Alert.alert(
              "Bid Submitted! 🎉",
              "The customer will review your bid and respond within 24 hours.",
            );
          },
          onError: (e) =>
            Alert.alert(
              "Couldn't submit bid",
              e instanceof Error ? e.message : "Please try again.",
            ),
        },
      );
      return;
    }

    placeBid(job.id, {
      providerName: profile.name,
      company: profile.company,
      ratePerHour: rate,
      trucksAvailable: trucksOffered,
      canStartImmediately: canStart,
      message,
    });
    setShowBidForm(false);
    setBidRate("");
    setBidMessage("");
    Alert.alert(
      "Bid Submitted! 🎉",
      "The customer will review your bid and respond within 24 hours.",
    );
  };

  const handleSubmitBid = () => {
    const rate = parseInt(bidRate);
    if (!rate || rate <= 0) {
      Alert.alert("Invalid Rate", "Please enter a valid hourly rate.");
      return;
    }
    // Warn if payouts aren't set up yet — completed jobs can't pay out until they are.
    if (payoutStatusData != null && !payoutsEnabled) {
      Alert.alert(
        "Payouts not enabled yet",
        "Payments from completed jobs can't be released until payouts are enabled. Set up your payout account with Stripe so you can receive money for this work.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Set Up Payouts",
            onPress: () => router.push("/(tabs)/account"),
          },
          {
            text: "Bid Anyway",
            style: "destructive",
            onPress: () => submitBid(rate),
          },
        ],
      );
      return;
    }
    submitBid(rate);
  };

  // ── Check-in / Check-out ────────────────────────────────────────
  const doCheckIn = () => {
    Alert.alert("Check In?", `Confirm check-in for ${job.projectName}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Check In",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          checkIn(job.id);
          updateJobStatus(job.id, "in_progress");
          Alert.alert("Checked In!", "Your check-in time has been recorded.");
        },
      },
    ]);
  };

  const handleCheckIn = () => {
    // Warn if payouts aren't set up yet — completed jobs can't pay out until they are.
    if (isProvider && payoutStatusData != null && !payoutsEnabled) {
      Alert.alert(
        "Payouts not enabled yet",
        "Payments from completed jobs can't be released until payouts are enabled. Set up your payout account with Stripe so you can receive money for this work.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Set Up Payouts",
            onPress: () => router.push("/(tabs)/account"),
          },
          { text: "Check In Anyway", style: "destructive", onPress: doCheckIn },
        ],
      );
      return;
    }
    doCheckIn();
  };

  const handleCheckOut = () => {
    Alert.alert(
      "Check Out?",
      "This records your end time. You can still mark the job complete from the tracking screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Check Out",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            checkOut(job.id);
          },
        },
      ],
    );
  };

  // ── Cancel ──────────────────────────────────────────────────────
  const handleCancel = () => {
    if (!cancelReason) {
      Alert.alert("Select a Reason", "Please choose a cancellation reason.");
      return;
    }
    Alert.alert(
      "Confirm Cancellation",
      isActive
        ? `A cancellation fee of $${calcCancelFee(job.budgetPerHour)} will be applied to your account.`
        : "This job will be marked as cancelled.",
      [
        { text: "Go Back", style: "cancel" },
        {
          text: "Cancel Job",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const done = (msg?: string) => {
              setShowCancelModal(false);
              Alert.alert(
                "Job Cancelled",
                msg ??
                  (isActive
                    ? `Cancellation fee of $${calcCancelFee(job.budgetPerHour)} will be deducted.`
                    : "Job has been cancelled."),
              );
            };
            const onErr = (e: unknown) =>
              Alert.alert(
                "Couldn't cancel",
                e instanceof Error ? e.message : "Please try again.",
              );

            // Live customer request that hasn't become a job yet → delete it.
            if (isRequestId && requestNumericId != null) {
              deleteRequest.mutate(requestNumericId, {
                onSuccess: () => done("Your load request has been removed."),
                onError: onErr,
              });
              return;
            }
            // Live job → mark the underlying request cancelled.
            if (isLiveJob && liveJob?.requestId != null) {
              updateRequest.mutate(
                { requestId: liveJob.requestId as number, status: "cancelled" },
                { onSuccess: () => done(), onError: onErr },
              );
              return;
            }
            cancelJob(job.id, cancelReason);
            done();
          },
        },
      ],
    );
  };

  // ── Contact ─────────────────────────────────────────────────────
  const handleCall = () => {
    if (!job.providerPhone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${job.providerPhone.replace(/\D/g, "")}`);
  };

  const handleText = () => {
    if (!job.providerPhone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`sms:${job.providerPhone.replace(/\D/g, "")}`);
  };

  // ── Chat ────────────────────────────────────────────────────────
  const handleSendMessage = () => {
    if (!chatText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(job.id, {
      from: isProvider ? "provider" : "customer",
      senderName: isProvider ? profile.company : profile.name,
      text: chatText.trim(),
      time: new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    });
    setChatText("");
  };

  // ── Rating ──────────────────────────────────────────────────────
  const handleRate = (stars: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rateJob(job.id, stars);
    Alert.alert(
      "Thanks for your rating!",
      "Your feedback helps the HaulBrokr community.",
    );
  };

  // ── Load Ticket ─────────────────────────────────────────────────
  const handleAddLoadTicket = () => {
    const loadNum = (job.loadTickets?.length ?? 0) + 1;
    const time = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addLoadTicket(job.id, {
      loadNumber: loadNum,
      timestamp: time,
      weight: `${(18 + Math.random() * 6).toFixed(1)} tons`,
      hasPhoto: false,
      status: "pending",
    });
    Alert.alert(
      "Load Ticket Added",
      `Load #${loadNum} created. Tap Clock In to start hauling.`,
    );
  };

  const handleTicketClockIn = (ticketId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ticketClockIn(job.id, ticketId);
  };
  const handleTicketClockOut = (ticketId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    ticketClockOut(job.id, ticketId);
  };
  const handleShowQR = (ticketId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    generateTicketQR(job.id, ticketId);
    router.push({
      pathname: "/ticket/qr" as any,
      params: { jobId: job.id, ticketId },
    });
  };

  // ── Dispute ──────────────────────────────────────────────────────
  const handleFileDispute = () => {
    if (!disputeText.trim()) {
      Alert.alert(
        "Describe the Issue",
        "Please describe the problem before submitting.",
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    fileDispute(job.id, disputeText.trim());
    setShowDisputeForm(false);
    Alert.alert(
      "Dispute Filed",
      "Our team will review and respond within 24 hours. Job ID: #" + job.id,
    );
  };

  // ── Repeat Job ───────────────────────────────────────────────────
  const handleRepeatJob = () => {
    Alert.alert(
      "Repeat This Job",
      `Create a new load request with the same details as "${job.projectName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Post Again",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
              "Job Re-posted! 🎉",
              "Your load request has been re-posted and is now accepting bids.",
            );
          },
        },
      ],
    );
  };

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
          numberOfLines={1}
        >
          {job.projectName}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Subtle refreshing pill while live job / payment status refetches in the
          background (e.g. the foreground refetch after reopening the app). */}
      <RefreshingIndicator
        visible={isRefreshingPillVisible({
          isFetching: fetchingJobs || fetchingRequests || fetchingPayout,
          isLoading: loadingJobs,
        })}
        topOffset={topPad + 56}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 130 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status + Project type */}
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <View style={styles.topRow}>
            <View
              style={[
                styles.typeBadge,
                {
                  backgroundColor: typeColor + "18",
                  borderColor: typeColor + "40",
                },
              ]}
            >
              <Text
                style={[
                  styles.typeText,
                  { color: typeColor, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {job.projectType}
              </Text>
            </View>
            <StatusBadge status={job.status as any} />
          </View>
          <Text
            style={[
              styles.material,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {job.material}
          </Text>
          <Text
            style={[
              styles.quantity,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {isLiveJob
              ? `${job.trucksNeeded} truck${job.trucksNeeded !== 1 ? "s" : ""} assigned`
              : `${job.quantity.toLocaleString()} ${job.quantityUnit} • ${job.trucksNeeded} truck${job.trucksNeeded !== 1 ? "s" : ""} needed`}
          </Text>
          {/* Freshness cue for live data — providers/customers sit on this screen
              during an active haul, so show how recently the status/payment
              numbers were refreshed. Only meaningful for live jobs/requests. */}
          {(isLiveJob || isRequestId) && (
            <LastUpdated timestamp={lastUpdated} style={{ marginTop: 4 }} />
          )}
        </Animated.View>

        {/* Rate card */}
        <Animated.View entering={FadeInDown.delay(40).springify()}>
          <View
            style={[
              styles.rateCard,
              {
                backgroundColor: colors.primary + "12",
                borderColor: colors.primary + "30",
              },
            ]}
          >
            <View style={styles.rateSection}>
              <Text
                style={[
                  styles.rateLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                Preferred Rate
              </Text>
              <Text
                style={[
                  styles.rateValue,
                  { color: colors.primary, fontFamily: "Inter_700Bold" },
                ]}
              >
                ${job.preferredRate}/hr
              </Text>
            </View>
            <View
              style={[styles.rateDivider, { backgroundColor: colors.border }]}
            />
            <View style={styles.rateSection}>
              <Text
                style={[
                  styles.rateLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                Budget
              </Text>
              <Text
                style={[
                  styles.rateValue,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                ${job.budgetPerHour}/hr
              </Text>
            </View>
            <View
              style={[styles.rateDivider, { backgroundColor: colors.border }]}
            />
            <View style={styles.rateSection}>
              <Text
                style={[
                  styles.rateLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {isLiveJob ? "Trucks" : "Bids"}
              </Text>
              <Text
                style={[
                  styles.rateValue,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                {isLiveJob ? job.trucksNeeded : job.bidsCount}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Provider contact card */}
        {hasProvider && isActive && (
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: ACCENT.green + "60",
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { color: ACCENT.green, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                ASSIGNED PROVIDER
              </Text>
              <View style={styles.providerRow}>
                <View
                  style={[
                    styles.providerAvatar,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.providerAvatarText,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {job.providerCompany
                      ?.split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={[
                      styles.providerName,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {job.providerCompany}
                  </Text>
                  <Text
                    style={[
                      styles.providerPhone,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {job.providerPhone}
                  </Text>
                </View>
                <View style={styles.contactBtns}>
                  <Pressable
                    onPress={handleCall}
                    style={[
                      styles.contactBtn,
                      { backgroundColor: ACCENT.green },
                    ]}
                  >
                    <Feather name="phone" size={14} color="#fff" />
                    <Text
                      style={[
                        styles.contactBtnText,
                        { color: "#fff", fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      Call
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleText}
                    style={[
                      styles.contactBtn,
                      { backgroundColor: ACCENT.blue },
                    ]}
                  >
                    <Feather name="message-square" size={14} color="#fff" />
                    <Text
                      style={[
                        styles.contactBtnText,
                        { color: "#fff", fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      Text
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Live tracking button */}
              {job.status === "in_progress" && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push(`/tracking/${job.id}`);
                  }}
                  style={[
                    styles.trackingBtn,
                    {
                      backgroundColor: ACCENT.green + "18",
                      borderColor: ACCENT.green + "40",
                    },
                  ]}
                >
                  <Feather name="map-pin" size={14} color={ACCENT.green} />
                  <Text
                    style={[
                      styles.trackingBtnText,
                      { color: ACCENT.green, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    View Live Tracking
                  </Text>
                  <Feather
                    name="chevron-right"
                    size={14}
                    color={ACCENT.green}
                  />
                </Pressable>
              )}
            </View>
          </Animated.View>
        )}

        {/* Legacy job-level TIME TRACKING removed — per-ticket Clock In/Out
            inside the LOAD TICKETS card replaces it. checkIn/checkOut still
            fire automatically off the first/last ticket clocks at the
            AppContext layer to preserve job.checkInTime / checkOutTime
            for invoices and historical jobs. */}

        {/* Route card */}
        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.cardTitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              ROUTE
            </Text>
            <View style={styles.routeRow}>
              <View style={styles.routeIndicator}>
                <View
                  style={[styles.routeDot, { backgroundColor: colors.primary }]}
                />
                <View
                  style={[styles.routeLine, { backgroundColor: colors.border }]}
                />
                <View
                  style={[styles.routeDot, { backgroundColor: ACCENT.green }]}
                />
              </View>
              <View style={styles.routeAddresses}>
                <View style={styles.routeAddr}>
                  <Text
                    style={[
                      styles.routeAddrLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    PICKUP
                  </Text>
                  <Text
                    style={[
                      styles.routeAddrText,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {job.pickupAddress}
                  </Text>
                  {!isLiveJob && (
                    <Text
                      style={[
                        styles.routeAddrDist,
                        {
                          color: colors.primary,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {job.distanceToStart} miles from you
                    </Text>
                  )}
                </View>
                <View style={styles.routeAddr}>
                  <Text
                    style={[
                      styles.routeAddrLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    DELIVERY
                  </Text>
                  <Text
                    style={[
                      styles.routeAddrText,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {job.deliveryAddress}
                  </Text>
                  {!isLiveJob && (
                    <Text
                      style={[
                        styles.routeAddrDist,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      {job.distanceToEnd} miles total
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Project details */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.cardTitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              PROJECT DETAILS
            </Text>
            <InfoRow
              icon="tag"
              label="Project"
              value={job.projectName}
              colors={colors}
            />
            <InfoRow
              icon="briefcase"
              label="Type"
              value={job.projectType}
              colors={colors}
            />
            <InfoRow
              icon="calendar"
              label="Start Date"
              value={job.scheduledDate}
              colors={colors}
            />
            <InfoRow
              icon="calendar"
              label="End Date"
              value={job.endDate}
              colors={colors}
            />
            <InfoRow
              icon="user"
              label="Posted by"
              value={job.postedBy}
              colors={colors}
            />
            <InfoRow
              icon="shield"
              label="Equipment"
              value={
                job.providerSupplies
                  ? "Provider supplies all"
                  : "Customer arranges"
              }
              colors={colors}
            />
            {job.notes && (
              <View
                style={[
                  styles.notes,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.notesLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  NOTES
                </Text>
                <Text
                  style={[
                    styles.notesText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {job.notes}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Bids (customer view) */}
        {!isProvider && job.bids.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).springify()}>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                BIDS RECEIVED ({job.bids.length})
              </Text>
              {job.bids.map((bid, idx) => (
                <View key={bid.id}>
                  <View style={styles.bidRow}>
                    <View
                      style={[
                        styles.bidAvatar,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.bidAvatarText,
                          {
                            color: colors.primaryForeground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {bid.providerName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={[
                          styles.bidName,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {bid.providerName}
                      </Text>
                      <Text
                        style={[
                          styles.bidCompany,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {bid.company} • {bid.trucksAvailable} truck
                        {bid.trucksAvailable !== 1 ? "s" : ""}
                      </Text>
                      {bid.message ? (
                        <Text
                          style={[
                            styles.bidMsg,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_400Regular",
                            },
                          ]}
                          numberOfLines={2}
                        >
                          "{bid.message}"
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text
                        style={[
                          styles.bidRate,
                          {
                            color: colors.primary,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        ${bid.ratePerHour}/hr
                      </Text>
                      {bid.canStartImmediately && (
                        <View
                          style={[
                            styles.immediateBadge,
                            { backgroundColor: ACCENT.green + "18" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.immediateText,
                              {
                                color: ACCENT.green,
                                fontFamily: "Inter_600SemiBold",
                              },
                            ]}
                          >
                            Immediate
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {idx < job.bids.length - 1 && (
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Chat / Messages */}
        {!isLiveJob && ((job.messages?.length ?? 0) > 0 || isActive) && (
          <Animated.View entering={FadeInDown.delay(130).springify()}>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                MESSAGES
              </Text>
              {(job.messages ?? []).map((msg) => {
                const isMe =
                  (isProvider && msg.from === "provider") ||
                  (!isProvider && msg.from === "customer");
                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.msgBubbleWrap,
                      { justifyContent: isMe ? "flex-end" : "flex-start" },
                    ]}
                  >
                    <View
                      style={[
                        styles.msgBubble,
                        {
                          backgroundColor: isMe
                            ? colors.primary
                            : colors.background,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      {!isMe && (
                        <Text
                          style={[
                            styles.msgSender,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {msg.senderName}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.msgText,
                          {
                            color: isMe
                              ? colors.primaryForeground
                              : colors.foreground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {msg.text}
                      </Text>
                      <Text
                        style={[
                          styles.msgTime,
                          {
                            color: isMe
                              ? colors.primaryForeground + "99"
                              : colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {msg.time}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {/* Message input */}
              <View
                style={[
                  styles.msgInputRow,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <TextInput
                  style={[
                    styles.msgInput,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.mutedForeground}
                  value={chatText}
                  onChangeText={setChatText}
                  multiline
                />
                <Pressable
                  onPress={handleSendMessage}
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor: chatText.trim()
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                >
                  <Feather
                    name="send"
                    size={16}
                    color={
                      chatText.trim()
                        ? colors.primaryForeground
                        : colors.mutedForeground
                    }
                  />
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Rating (completed jobs) */}
        {!isLiveJob && job.status === "completed" && (
          <Animated.View entering={FadeInDown.delay(140).springify()}>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                {job.myRating ? "YOUR RATING" : "RATE THIS JOB"}
              </Text>
              {job.myRating ? (
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Feather
                      key={s}
                      name="star"
                      size={24}
                      color={s <= job.myRating! ? "#f59e0b" : colors.border}
                    />
                  ))}
                  <Text
                    style={[
                      styles.ratingLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    You rated this {job.myRating}/5
                  </Text>
                </View>
              ) : (
                <View>
                  <Text
                    style={[
                      styles.ratingPrompt,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    How was your experience with this{" "}
                    {isProvider ? "customer" : "provider"}?
                  </Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => handleRate(s)}
                        onPressIn={() => setHoverRating(s)}
                        onPressOut={() => setHoverRating(0)}
                      >
                        <Feather
                          name="star"
                          size={36}
                          color={
                            s <= (hoverRating || 0) ? "#f59e0b" : colors.border
                          }
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Load Tickets */}
        {!isLiveJob &&
          (job.status === "in_progress" ||
            job.status === "accepted" ||
            job.status === "completed") && (
            <Animated.View entering={FadeInDown.delay(150).springify()}>
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.cardRow}>
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    LOAD TICKETS ({job.loadTickets?.length ?? 0})
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(profile.role === "customer" ||
                      profile.role === "supervisor") &&
                      (job.loadTickets?.length ?? 0) > 0 && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            );
                            router.push("/ticket/scan" as any);
                          }}
                          style={[
                            styles.ticketAddBtn,
                            {
                              backgroundColor: ACCENT.blue + "1a",
                              borderColor: ACCENT.blue + "55",
                            },
                          ]}
                        >
                          <Feather
                            name="maximize"
                            size={13}
                            color={ACCENT.blue}
                          />
                          <Text
                            style={[
                              styles.ticketAddText,
                              {
                                color: ACCENT.blue,
                                fontFamily: "Inter_600SemiBold",
                              },
                            ]}
                          >
                            Scan
                          </Text>
                        </Pressable>
                      )}
                    {job.status !== "completed" &&
                      (profile.role === "provider" ||
                        profile.role === "driver") && (
                        <Pressable
                          onPress={handleAddLoadTicket}
                          style={[
                            styles.ticketAddBtn,
                            {
                              backgroundColor: colors.primary + "18",
                              borderColor: colors.primary + "40",
                            },
                          ]}
                        >
                          <Feather
                            name="plus"
                            size={13}
                            color={colors.primary}
                          />
                          <Text
                            style={[
                              styles.ticketAddText,
                              {
                                color: colors.primary,
                                fontFamily: "Inter_600SemiBold",
                              },
                            ]}
                          >
                            Log Load
                          </Text>
                        </Pressable>
                      )}
                  </View>
                </View>
                {(job.loadTickets?.length ?? 0) === 0 ? (
                  <Text
                    style={[
                      styles.ticketEmpty,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    No load tickets yet. Tap "Log Load" after each trip.
                  </Text>
                ) : (
                  job.loadTickets!.map((t, idx) => {
                    const isVerified = !!t.verifiedAt;
                    const isCompleted = t.status === "completed" || isVerified;
                    const isInProgress =
                      t.status === "in_progress" ||
                      (!!t.clockedInAt && !t.clockedOutAt);
                    const isDriverSide =
                      profile.role === "provider" || profile.role === "driver";
                    const statusColor = isVerified
                      ? ACCENT.green
                      : isCompleted
                        ? ACCENT.blue
                        : isInProgress
                          ? colors.primary
                          : colors.mutedForeground;
                    const statusLabel = isVerified
                      ? "Verified"
                      : isCompleted
                        ? "Completed"
                        : isInProgress
                          ? "Hauling"
                          : "Pending";
                    return (
                      <View key={t.id}>
                        <View style={styles.ticketRow}>
                          <View
                            style={[
                              styles.ticketNum,
                              { backgroundColor: statusColor + "1f" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.ticketNumText,
                                {
                                  color: statusColor,
                                  fontFamily: "Inter_700Bold",
                                },
                              ]}
                            >
                              #{t.loadNumber}
                            </Text>
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <Text
                                style={[
                                  styles.ticketTime,
                                  {
                                    color: colors.foreground,
                                    fontFamily: "Inter_500Medium",
                                  },
                                ]}
                              >
                                {t.timestamp}
                              </Text>
                              <View
                                style={{
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  backgroundColor: statusColor + "1a",
                                  borderRadius: 4,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 9,
                                    color: statusColor,
                                    fontFamily: "Inter_700Bold",
                                    letterSpacing: 0.4,
                                  }}
                                >
                                  {statusLabel.toUpperCase()}
                                </Text>
                              </View>
                            </View>
                            {(t.clockedInAt || t.clockedOutAt) && (
                              <Text
                                style={[
                                  styles.ticketNote,
                                  {
                                    color: colors.mutedForeground,
                                    fontFamily: "Inter_400Regular",
                                  },
                                ]}
                              >
                                {t.clockedInAt ? `In ${t.clockedInAt}` : ""}
                                {t.clockedOutAt
                                  ? ` • Out ${t.clockedOutAt}`
                                  : ""}
                              </Text>
                            )}
                            {isVerified && (
                              <Text
                                style={[
                                  styles.ticketNote,
                                  {
                                    color: ACCENT.green,
                                    fontFamily: "Inter_500Medium",
                                  },
                                ]}
                              >
                                ✓ Verified {t.verifiedAt}
                                {t.verifiedBy ? ` by ${t.verifiedBy}` : ""}
                              </Text>
                            )}
                            {t.notes && (
                              <Text
                                style={[
                                  styles.ticketNote,
                                  {
                                    color: colors.mutedForeground,
                                    fontFamily: "Inter_400Regular",
                                  },
                                ]}
                              >
                                {t.notes}
                              </Text>
                            )}
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 4 }}>
                            {t.weight && (
                              <Text
                                style={[
                                  styles.ticketWeight,
                                  {
                                    color: colors.foreground,
                                    fontFamily: "Inter_700Bold",
                                  },
                                ]}
                              >
                                {t.weight}
                              </Text>
                            )}
                            {t.hasPhoto && (
                              <Feather
                                name="image"
                                size={13}
                                color={ACCENT.blue}
                              />
                            )}
                          </View>
                        </View>

                        {/* Per-ticket actions for driver/provider */}
                        {isDriverSide && !isVerified && (
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 8,
                              marginTop: 8,
                            }}
                          >
                            {!t.clockedInAt && (
                              <Pressable
                                onPress={() => handleTicketClockIn(t.id)}
                                style={[
                                  styles.ticketActionBtn,
                                  {
                                    backgroundColor: colors.primary,
                                    borderColor: colors.primary,
                                  },
                                ]}
                              >
                                <Feather
                                  name="play"
                                  size={12}
                                  color="#1e2235"
                                />
                                <Text
                                  style={[
                                    styles.ticketActionText,
                                    { color: "#1e2235" },
                                  ]}
                                >
                                  Clock In
                                </Text>
                              </Pressable>
                            )}
                            {t.clockedInAt && !t.clockedOutAt && (
                              <Pressable
                                onPress={() => handleTicketClockOut(t.id)}
                                style={[
                                  styles.ticketActionBtn,
                                  {
                                    backgroundColor: ACCENT.green,
                                    borderColor: ACCENT.green,
                                  },
                                ]}
                              >
                                <Feather name="check" size={12} color="#fff" />
                                <Text
                                  style={[
                                    styles.ticketActionText,
                                    { color: "#fff" },
                                  ]}
                                >
                                  Clock Out
                                </Text>
                              </Pressable>
                            )}
                            {t.clockedOutAt && (
                              <Pressable
                                onPress={() => handleShowQR(t.id)}
                                style={[
                                  styles.ticketActionBtn,
                                  {
                                    backgroundColor: ACCENT.blue + "22",
                                    borderColor: ACCENT.blue + "66",
                                  },
                                ]}
                              >
                                <Feather
                                  name="grid"
                                  size={12}
                                  color={ACCENT.blue}
                                />
                                <Text
                                  style={[
                                    styles.ticketActionText,
                                    { color: ACCENT.blue },
                                  ]}
                                >
                                  Show QR
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        )}

                        {idx < job.loadTickets!.length - 1 && (
                          <View
                            style={[
                              styles.divider,
                              { backgroundColor: colors.border, marginTop: 10 },
                            ]}
                          />
                        )}
                      </View>
                    );
                  })
                )}
                {/* Total weight */}
                {(job.loadTickets?.length ?? 0) > 0 && (
                  <View
                    style={[
                      styles.ticketTotal,
                      { borderTopColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ticketTotalLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      Total Weight Verified
                    </Text>
                    <Text
                      style={[
                        styles.ticketTotalValue,
                        { color: ACCENT.green, fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      {ticketTotalWeight.toFixed(1)} tons
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

        {/* Broker fee breakdown + payment (live) */}
        {job.status === "completed" && (
          <LivePaymentPanel numericId={numericId} isLiveJob={isLiveJob} />
        )}

        {/* Live chat / messages (real jobs) */}
        {isLiveJob && <LiveChatPanel numericId={numericId} />}

        {/* Live rating (completed real jobs) */}
        {isLiveJob && job.status === "completed" && (
          <LiveRatingPanel numericId={numericId} isProvider={isProvider} />
        )}

        {/* Live load tickets (real jobs) */}
        {isLiveJob &&
          (job.status === "in_progress" ||
            job.status === "accepted" ||
            job.status === "completed") && (
            <LiveTicketsPanel
              numericId={numericId}
              role={profile.role}
              status={job.status}
            />
          )}

        {/* Invoice + Dispute (completed) */}
        {!isLiveJob && job.status === "completed" && (
          <Animated.View entering={FadeInDown.delay(160).springify()}>
            {/* Invoice button */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/invoice/${job.id}`);
              }}
              style={[
                styles.invoiceBtn,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.invoiceBtnIcon,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Feather name="file-text" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.invoiceBtnTitle,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  View Invoice
                </Text>
                <Text
                  style={[
                    styles.invoiceBtnSub,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  Download or share your invoice PDF
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>

            {/* Dispute section */}
            {!job.disputeReason ? (
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  REPORT AN ISSUE
                </Text>
                {showDisputeForm ? (
                  <>
                    <Text
                      style={[
                        styles.disputePrompt,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      Describe the problem (short pay, missing loads, damage,
                      etc.)
                    </Text>
                    <TextInput
                      style={[
                        styles.disputeInput,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                          color: colors.foreground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                      placeholder="e.g. Only 3 loads were delivered but I was charged for 4..."
                      placeholderTextColor={colors.mutedForeground}
                      value={disputeText}
                      onChangeText={setDisputeText}
                      multiline
                      numberOfLines={4}
                    />
                    <View style={styles.bidFormBtns}>
                      <Pressable
                        onPress={() => setShowDisputeForm(false)}
                        style={[
                          styles.cancelBidBtn,
                          { borderColor: colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.cancelBidBtnText,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          Cancel
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={handleFileDispute}
                        style={[
                          styles.submitBidBtn,
                          { backgroundColor: ACCENT.red, flex: 1 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.submitBidText,
                            { color: "#fff", fontFamily: "Inter_700Bold" },
                          ]}
                        >
                          File Dispute
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowDisputeForm(true);
                    }}
                    style={[
                      styles.disputeOpenBtn,
                      {
                        borderColor: ACCENT.red + "40",
                        backgroundColor: ACCENT.red + "08",
                      },
                    ]}
                  >
                    <Feather name="alert-circle" size={16} color={ACCENT.red} />
                    <Text
                      style={[
                        styles.disputeOpenText,
                        { color: ACCENT.red, fontFamily: "Inter_600SemiBold" },
                      ]}
                    >
                      Report an Issue with This Job
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: ACCENT.red + "08",
                    borderColor: ACCENT.red + "30",
                  },
                ]}
              >
                <View style={styles.cardRow}>
                  <Feather name="alert-circle" size={16} color={ACCENT.red} />
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: ACCENT.red, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    DISPUTE FILED
                  </Text>
                </View>
                <Text
                  style={[
                    styles.disputeFiledText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {job.disputeReason}
                </Text>
                <Text
                  style={[
                    styles.disputeStatus,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  Under review — our team will respond within 24 hours.
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Delivery Evidence / Site Notes */}
        {(job.status === "in_progress" || job.status === "completed") && (
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.cardRow}>
                <Feather
                  name="camera"
                  size={15}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                      marginLeft: 6,
                    },
                  ]}
                >
                  PROOF OF DELIVERY
                </Text>
              </View>
              {isProvider && (
                <>
                  <Text
                    style={[
                      {
                        fontSize: 13,
                        lineHeight: 18,
                        fontFamily: "Inter_400Regular",
                      },
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Add a photo URL and site notes that the customer can see.
                  </Text>
                  {(evidenceQuery.data ?? []).map((ev: any) => (
                    <View
                      key={ev.id}
                      style={[
                        {
                          borderWidth: 1,
                          borderRadius: 8,
                          padding: 12,
                          gap: 4,
                        },
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                        },
                      ]}
                    >
                      {ev.photoUrl ? (
                        <Text
                          style={[
                            { fontSize: 12, fontFamily: "Inter_400Regular" },
                            { color: colors.primary },
                          ]}
                          numberOfLines={1}
                        >
                          📷 {ev.photoUrl}
                        </Text>
                      ) : null}
                      {ev.siteNotes ? (
                        <Text
                          style={[
                            {
                              fontSize: 13,
                              fontFamily: "Inter_400Regular",
                              lineHeight: 18,
                            },
                            { color: colors.foreground },
                          ]}
                        >
                          {ev.siteNotes}
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          { fontSize: 11, fontFamily: "Inter_400Regular" },
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {new Date(ev.uploadedAt).toLocaleString()}
                      </Text>
                    </View>
                  ))}
                  <View
                    style={[
                      {
                        borderWidth: 1,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      },
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <Feather
                      name="image"
                      size={14}
                      color={colors.mutedForeground}
                    />
                    <TextInput
                      style={[
                        {
                          flex: 1,
                          fontSize: 14,
                          fontFamily: "Inter_400Regular",
                        },
                        { color: colors.foreground },
                      ]}
                      placeholder="Photo URL (e.g. https://...)"
                      placeholderTextColor={colors.mutedForeground}
                      value={photoUrl}
                      onChangeText={setPhotoUrl}
                    />
                  </View>
                  <View
                    style={[
                      {
                        borderWidth: 1,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      },
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <Feather
                      name="tag"
                      size={14}
                      color={colors.mutedForeground}
                    />
                    <TextInput
                      style={[
                        {
                          flex: 1,
                          fontSize: 14,
                          fontFamily: "Inter_400Regular",
                        },
                        { color: colors.foreground },
                      ]}
                      placeholder="Photo caption (optional)"
                      placeholderTextColor={colors.mutedForeground}
                      value={photoCaption}
                      onChangeText={setPhotoCaption}
                    />
                  </View>
                  <TextInput
                    style={[
                      {
                        borderWidth: 1,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        fontSize: 14,
                        minHeight: 72,
                        fontFamily: "Inter_400Regular",
                      },
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        color: colors.foreground,
                      },
                    ]}
                    placeholder="Site notes — gate code, foreman contact, hazards, etc."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={3}
                    value={siteNotes}
                    onChangeText={setSiteNotes}
                  />
                  <Pressable
                    disabled={submitEvidence.isPending}
                    onPress={async () => {
                      if (!numericId) return;
                      if (!photoUrl.trim() && !siteNotes.trim()) {
                        Alert.alert(
                          "Add content",
                          "Enter a photo URL or site notes before submitting.",
                        );
                        return;
                      }
                      try {
                        await submitEvidence.mutateAsync({
                          jobId: numericId,
                          photoUrl: photoUrl.trim() || undefined,
                          photoCaption: photoCaption.trim() || undefined,
                          siteNotes: siteNotes.trim() || undefined,
                        });
                        Haptics.notificationAsync(
                          Haptics.NotificationFeedbackType.Success,
                        );
                        setPhotoUrl("");
                        setPhotoCaption("");
                        setSiteNotes("");
                        Alert.alert(
                          "Evidence Saved ✅",
                          "Proof of delivery submitted to the customer.",
                        );
                      } catch (err: any) {
                        Alert.alert(
                          "Error",
                          err?.message ?? "Could not submit evidence.",
                        );
                      }
                    }}
                    style={[
                      {
                        paddingVertical: 14,
                        borderRadius: 10,
                        alignItems: "center",
                      },
                      {
                        backgroundColor: colors.primary,
                        opacity: submitEvidence.isPending ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        { fontSize: 15, fontFamily: "Inter_700Bold" },
                        { color: colors.primaryForeground },
                      ]}
                    >
                      {submitEvidence.isPending
                        ? "Submitting..."
                        : "Submit Evidence"}
                    </Text>
                  </Pressable>
                </>
              )}
              {!isProvider && (
                <Text
                  style={[
                    {
                      fontSize: 13,
                      lineHeight: 18,
                      fontFamily: "Inter_400Regular",
                    },
                    { color: colors.mutedForeground },
                  ]}
                >
                  Delivery photos and site notes from the operator will appear
                  here once submitted.
                </Text>
              )}
            </View>
          </Animated.View>
        )}

        {/* Bid form (provider) */}
        {showBidForm && isProvider && (
          <Animated.View entering={FadeInDown.duration(300).springify()}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.primary + "50",
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { color: colors.primary, fontFamily: "Inter_700Bold" },
                ]}
              >
                SUBMIT YOUR BID
              </Text>
              <Text
                style={[
                  styles.bidFormSub,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                Customer's preferred rate: ${job.preferredRate}/hr
              </Text>
              {payoutStatusData != null && !payoutsEnabled && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push("/(tabs)/account");
                  }}
                  style={[
                    styles.payoutNotice,
                    {
                      backgroundColor: colors.primary + "12",
                      borderColor: colors.primary + "40",
                    },
                  ]}
                >
                  <Feather
                    name="alert-circle"
                    size={14}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.payoutNoticeText,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    Payouts aren't enabled yet. Payments from completed jobs
                    can't be released until you set up your payout account.
                  </Text>
                  <Feather
                    name="chevron-right"
                    size={14}
                    color={colors.primary}
                  />
                </Pressable>
              )}
              <View style={styles.bidFormRow}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.bidFormLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    YOUR RATE ($/hr)
                  </Text>
                  <TextInput
                    style={[
                      styles.bidFormInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.foreground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                    placeholder={`e.g. ${job.preferredRate}`}
                    placeholderTextColor={colors.mutedForeground}
                    value={bidRate}
                    onChangeText={setBidRate}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.bidFormLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    TRUCKS AVAILABLE
                  </Text>
                  <TextInput
                    style={[
                      styles.bidFormInput,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        color: colors.foreground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                    placeholder="e.g. 2"
                    placeholderTextColor={colors.mutedForeground}
                    value={bidTrucks}
                    onChangeText={setBidTrucks}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Text
                style={[
                  styles.bidFormLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                NOTE (optional)
              </Text>
              <TextInput
                style={[
                  styles.bidFormTextarea,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
                placeholder="Tell the customer about your experience..."
                placeholderTextColor={colors.mutedForeground}
                value={bidMessage}
                onChangeText={setBidMessage}
                multiline
                numberOfLines={3}
              />
              <Pressable
                onPress={() => setCanStart((v) => !v)}
                style={[styles.checkRow, { borderColor: colors.border }]}
              >
                <View
                  style={[
                    styles.check,
                    {
                      borderColor: canStart ? colors.primary : colors.border,
                      backgroundColor: canStart
                        ? colors.primary
                        : "transparent",
                    },
                  ]}
                >
                  {canStart && (
                    <Feather
                      name="check"
                      size={12}
                      color={colors.primaryForeground}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.checkLabel,
                    { color: colors.foreground, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  Can start immediately
                </Text>
              </Pressable>
              <View style={styles.bidFormBtns}>
                <Pressable
                  onPress={() => setShowBidForm(false)}
                  style={[styles.cancelBidBtn, { borderColor: colors.border }]}
                >
                  <Text
                    style={[
                      styles.cancelBidBtnText,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSubmitBid}
                  style={[
                    styles.submitBidBtn,
                    { backgroundColor: colors.primary, flex: 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.submitBidText,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    Submit Bid
                  </Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Bids list (customer) */}
        {showBidsList && !isProvider && (
          <Animated.View entering={FadeInDown.duration(300).springify()}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.primary + "50",
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <Text
                  style={[
                    styles.cardTitle,
                    { color: colors.primary, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {job.bidsCount} BID{job.bidsCount !== 1 ? "S" : ""} RECEIVED
                </Text>
                <Text
                  style={[
                    {
                      fontSize: 12,
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  Target ${job.preferredRate}/hr
                </Text>
              </View>
              <Text
                style={[
                  {
                    fontSize: 13,
                    lineHeight: 18,
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    marginBottom: 4,
                  },
                ]}
              >
                Compare rates, truck availability, and start time. Accepting a
                bid locks it in and notifies the provider.
              </Text>

              {job.bids.length === 0 ? (
                <View
                  style={{ paddingVertical: 20, alignItems: "center", gap: 6 }}
                >
                  <Feather
                    name="clock"
                    size={20}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[
                      {
                        fontSize: 13,
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    Bid details are still loading. Check back soon.
                  </Text>
                </View>
              ) : (
                job.bids.map((bid) => {
                  const vsPreferred = bid.ratePerHour - job.preferredRate;
                  const overBudget = bid.ratePerHour > job.budgetPerHour;
                  return (
                    <View
                      key={bid.id}
                      style={{
                        borderWidth: 1,
                        borderRadius: 10,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        padding: 12,
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 8,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              {
                                fontSize: 15,
                                color: colors.foreground,
                                fontFamily: "Inter_700Bold",
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {bid.company}
                          </Text>
                          <Text
                            style={[
                              {
                                fontSize: 12,
                                color: colors.mutedForeground,
                                fontFamily: "Inter_400Regular",
                                marginTop: 2,
                              },
                            ]}
                          >
                            {bid.providerName} • Submitted {bid.submittedAt}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text
                            style={[
                              {
                                fontSize: 18,
                                color: overBudget
                                  ? ACCENT.red
                                  : colors.foreground,
                                fontFamily: "Inter_700Bold",
                              },
                            ]}
                          >
                            ${bid.ratePerHour}/hr
                          </Text>
                          <Text
                            style={[
                              {
                                fontSize: 11,
                                fontFamily: "Inter_500Medium",
                                color:
                                  vsPreferred <= 0
                                    ? "#16a34a"
                                    : colors.mutedForeground,
                              },
                            ]}
                          >
                            {vsPreferred === 0
                              ? "At target"
                              : vsPreferred < 0
                                ? `$${Math.abs(vsPreferred)} under target`
                                : `$${vsPreferred} over target`}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 6,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: colors.card,
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                          }}
                        >
                          <Feather
                            name="truck"
                            size={11}
                            color={colors.mutedForeground}
                          />
                          <Text
                            style={[
                              {
                                fontSize: 11,
                                color: colors.foreground,
                                fontFamily: "Inter_500Medium",
                              },
                            ]}
                          >
                            {bid.trucksAvailable} truck
                            {bid.trucksAvailable !== 1 ? "s" : ""}
                          </Text>
                        </View>
                        {bid.canStartImmediately ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              backgroundColor: "#16a34a22",
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                            }}
                          >
                            <Feather name="zap" size={11} color="#16a34a" />
                            <Text
                              style={[
                                {
                                  fontSize: 11,
                                  color: "#16a34a",
                                  fontFamily: "Inter_600SemiBold",
                                },
                              ]}
                            >
                              Can start immediately
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              backgroundColor: colors.card,
                              borderRadius: 6,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                            }}
                          >
                            <Feather
                              name="calendar"
                              size={11}
                              color={colors.mutedForeground}
                            />
                            <Text
                              style={[
                                {
                                  fontSize: 11,
                                  color: colors.mutedForeground,
                                  fontFamily: "Inter_500Medium",
                                },
                              ]}
                            >
                              Scheduled start
                            </Text>
                          </View>
                        )}
                      </View>

                      {bid.message ? (
                        <Text
                          style={[
                            {
                              fontSize: 13,
                              lineHeight: 18,
                              color: colors.foreground,
                              fontFamily: "Inter_400Regular",
                            },
                          ]}
                        >
                          "{bid.message}"
                        </Text>
                      ) : null}

                      <Pressable
                        onPress={() => {
                          Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Warning,
                          );
                          Alert.alert(
                            "Accept this bid?",
                            `Hire ${bid.company} at $${bid.ratePerHour}/hr with ${bid.trucksAvailable} truck${bid.trucksAvailable !== 1 ? "s" : ""}. Other bids will be declined automatically.`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Accept Bid",
                                style: "default",
                                onPress: () => {
                                  acceptBid(job.id, bid.id);
                                  setShowBidsList(false);
                                  Haptics.notificationAsync(
                                    Haptics.NotificationFeedbackType.Success,
                                  );
                                  Alert.alert(
                                    "Bid Accepted ✅",
                                    `${bid.company} has been notified. The job is now active.`,
                                  );
                                },
                              },
                            ],
                          );
                        }}
                        style={{
                          backgroundColor: colors.primary,
                          paddingVertical: 11,
                          borderRadius: 8,
                          alignItems: "center",
                          flexDirection: "row",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <Feather
                          name="check"
                          size={15}
                          color={colors.primaryForeground}
                        />
                        <Text
                          style={[
                            {
                              fontSize: 14,
                              color: colors.primaryForeground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          Accept Bid
                        </Text>
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>
          </Animated.View>
        )}

        {/* Cancel modal */}
        {showCancelModal && (
          <Animated.View entering={FadeInDown.duration(250).springify()}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: ACCENT.red + "50",
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { color: ACCENT.red, fontFamily: "Inter_700Bold" },
                ]}
              >
                CANCEL JOB
              </Text>
              {isActive && (
                <View
                  style={[
                    styles.cancelFeeBox,
                    {
                      backgroundColor: ACCENT.red + "12",
                      borderColor: ACCENT.red + "30",
                    },
                  ]}
                >
                  <Feather name="alert-triangle" size={16} color={ACCENT.red} />
                  <Text
                    style={[
                      styles.cancelFeeText,
                      { color: ACCENT.red, fontFamily: "Inter_500Medium" },
                    ]}
                  >
                    Cancellation fee: ${calcCancelFee(job.budgetPerHour)} (15%
                    of estimated day earnings)
                  </Text>
                </View>
              )}
              <Text
                style={[
                  styles.bidFormLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                REASON FOR CANCELLATION
              </Text>
              {CANCEL_REASONS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setCancelReason(r)}
                  style={[
                    styles.reasonRow,
                    {
                      borderColor:
                        cancelReason === r ? ACCENT.red : colors.border,
                      backgroundColor:
                        cancelReason === r ? ACCENT.red + "10" : "transparent",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      {
                        borderColor:
                          cancelReason === r ? ACCENT.red : colors.border,
                      },
                    ]}
                  >
                    {cancelReason === r && (
                      <View
                        style={[
                          styles.radioInner,
                          { backgroundColor: ACCENT.red },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.reasonText,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {r}
                  </Text>
                </Pressable>
              ))}
              <View style={styles.bidFormBtns}>
                <Pressable
                  onPress={() => setShowCancelModal(false)}
                  style={[styles.cancelBidBtn, { borderColor: colors.border }]}
                >
                  <Text
                    style={[
                      styles.cancelBidBtnText,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    Go Back
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleCancel}
                  style={[
                    styles.submitBidBtn,
                    { backgroundColor: ACCENT.red, flex: 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.submitBidText,
                      { color: "#ffffff", fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Confirm Cancel
                  </Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Action bar — demo flows; hidden for live jobs (live actions live in the payment panel) */}
      {!isLiveJob && (
        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {isProvider ? (
            job.status === "open" || job.status === "bidding" ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowBidForm((v) => !v);
                }}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: showBidForm ? colors.card : colors.primary,
                    borderWidth: showBidForm ? 1 : 0,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Feather
                  name={showBidForm ? "x" : "send"}
                  size={18}
                  color={
                    showBidForm ? colors.foreground : colors.primaryForeground
                  }
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    {
                      color: showBidForm
                        ? colors.foreground
                        : colors.primaryForeground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  {showBidForm ? "Cancel" : "Place a Bid"}
                </Text>
              </Pressable>
            ) : job.status === "completed" ? (
              <View style={styles.customerActionRow}>
                <Pressable
                  onPress={() => router.push(`/invoice/${job.id}`)}
                  style={[
                    styles.actionBtn,
                    { backgroundColor: colors.primary, flex: 1 },
                  ]}
                >
                  <Feather
                    name="file-text"
                    size={18}
                    color={colors.primaryForeground}
                  />
                  <Text
                    style={[
                      styles.actionBtnText,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    View Invoice
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.actionBtnText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {job.status === "cancelled"
                    ? "Job Cancelled"
                    : "Not Open for Bids"}
                </Text>
              </View>
            )
          ) : job.status === "completed" ? (
            <View style={styles.customerActionRow}>
              <Pressable
                onPress={handleRepeatJob}
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.primary, flex: 1 },
                ]}
              >
                <Feather
                  name="repeat"
                  size={18}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    {
                      color: colors.primaryForeground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  Repeat This Job
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push(`/invoice/${job.id}`)}
                style={[
                  styles.cancelJobBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Feather name="file-text" size={20} color={colors.primary} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.customerActionRow}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowBidsList((v) => !v);
                }}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: showBidsList
                      ? colors.card
                      : colors.primary,
                    borderWidth: showBidsList ? 1 : 0,
                    borderColor: colors.border,
                    flex: 1,
                  },
                ]}
              >
                <Feather
                  name={showBidsList ? "x" : "list"}
                  size={18}
                  color={
                    showBidsList ? colors.foreground : colors.primaryForeground
                  }
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    {
                      color: showBidsList
                        ? colors.foreground
                        : colors.primaryForeground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  {showBidsList
                    ? "Hide Bids"
                    : `View ${job.bidsCount} Bid${job.bidsCount !== 1 ? "s" : ""}`}
                </Text>
              </Pressable>
              {isCancellable && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowCancelModal((v) => !v);
                  }}
                  style={[
                    styles.cancelJobBtn,
                    {
                      backgroundColor: showCancelModal
                        ? colors.card
                        : ACCENT.red + "12",
                      borderColor: ACCENT.red + "40",
                    },
                  ]}
                >
                  <Feather name="x-circle" size={18} color={ACCENT.red} />
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const PAY_LABEL: Record<string, string> = {
  unpaid: "Awaiting Payment",
  invoiced: "Invoiced (Net Terms)",
  paid: "Paid",
  released: "Paid Out to Provider",
  failed: "Payment Failed",
};

function LivePaymentPanel({
  numericId,
  isLiveJob,
}: {
  numericId: number | null;
  isLiveJob: boolean;
}) {
  const colors = useColors();
  const { data: liveJobs } = useLiveJobs();
  const { data: liveProfile } = useMyProfile();
  const { data: payoutStatusData } = usePayoutStatus();
  const charge = useChargeJob();
  const release = useReleaseJobPayment();
  const checkoutSession = useCreateJobCheckoutSession();
  const verifyCheckout = useVerifyJobCheckout();

  const liveJob =
    numericId != null && Array.isArray(liveJobs)
      ? liveJobs.find((j: any) => j.id === numericId)
      : undefined;

  if (!isLiveJob || !liveJob || liveJob.status !== "completed") {
    return (
      <Animated.View entering={FadeInDown.delay(150).springify()}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardRow}>
            <Feather
              name="file-text"
              size={15}
              color={colors.mutedForeground}
            />
            <Text
              style={[
                styles.cardTitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                  marginLeft: 6,
                },
              ]}
            >
              PAYMENT & BROKER FEE
            </Text>
          </View>
          <Text
            style={[
              {
                fontSize: 13,
                lineHeight: 19,
                marginTop: 8,
                fontFamily: "Inter_400Regular",
              },
              { color: colors.mutedForeground },
            ]}
          >
            Live payment isn't available for this sample job. Real charges and
            provider payouts are processed only for jobs created on the
            platform.
          </Text>
        </View>
      </Animated.View>
    );
  }

  const jobId: number = numericId as number;
  const fmt = (n: number | null | undefined) => `$${(n ?? 0).toLocaleString()}`;
  const status: string = liveJob.paymentStatus ?? "unpaid";
  const feeRate: number = liveJob.platformFeeRate ?? 0.15;
  const base: number = liveJob.providerNetAmount ?? liveJob.totalAmount ?? 0;
  const isCustomer = !!liveProfile && liveProfile.id === liveJob.customerId;
  const isProviderLive = !!liveProfile && liveProfile.id === liveJob.providerId;
  const payoutsEnabled = !!payoutStatusData?.payoutsEnabled;
  const pending = charge.isPending || release.isPending;

  const payColor =
    status === "released" || status === "paid"
      ? ACCENT.green
      : status === "invoiced"
        ? colors.primary
        : status === "failed"
          ? "#dc2626"
          : "#d97706";

  const onCharge = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    charge.mutate(jobId, {
      onSuccess: () =>
        Alert.alert(
          "Payment processed",
          "The broker fee was charged and the provider payout was transferred.",
        ),
      onError: (err: any) =>
        Alert.alert(
          "Payment failed",
          err?.message ?? "Unable to process payment.",
        ),
    });
  };

  const onRelease = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    release.mutate(jobId, {
      onSuccess: () =>
        Alert.alert(
          "Payout released",
          "The provider's net payout has been released.",
        ),
      onError: (err: any) =>
        Alert.alert(
          "Release failed",
          err?.message ?? "Unable to release payout.",
        ),
    });
  };

  // Additive Stripe-hosted Checkout path. We open it in an auth session that
  // auto-closes on the deep-link bounce-back, parse the session id off the
  // return URL, then verify synchronously (no webhooks). Idempotent on the
  // server, so a duplicate verify is harmless.
  const checkoutBusy = checkoutSession.isPending || verifyCheckout.isPending;
  const onCheckout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const returnTo = ExpoLinking.createURL("checkout-return");
    try {
      const { url } = await checkoutSession.mutateAsync({ jobId, returnTo });
      const result = await WebBrowser.openAuthSessionAsync(url, returnTo);
      if (result.type !== "success" || !result.url) {
        // Dismissed/cancelled — nothing charged, job stays payable.
        return;
      }
      const parsed = ExpoLinking.parse(result.url);
      const outcome = parsed.queryParams?.checkout;
      const sessionId = parsed.queryParams?.session_id;
      if (outcome === "cancel") {
        Alert.alert(
          "Checkout cancelled",
          "No payment was taken. You can try again whenever you're ready.",
        );
        return;
      }
      if (outcome === "done" && typeof sessionId === "string" && sessionId) {
        verifyCheckout.mutate(
          { jobId, sessionId },
          {
            onSuccess: () =>
              Alert.alert(
                "Payment received",
                "Your Checkout payment was confirmed and the provider has been paid.",
              ),
            onError: (err: any) =>
              Alert.alert(
                "Verification failed",
                err?.message ?? "We couldn't confirm the payment.",
              ),
          },
        );
      }
    } catch (err: any) {
      Alert.alert(
        "Couldn't open Checkout",
        err?.message ?? "Please try again.",
      );
    }
  };

  return (
    <Animated.View entering={FadeInDown.delay(150).springify()}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={[styles.cardRow, { justifyContent: "space-between" }]}>
          <View style={styles.cardRow}>
            <Feather
              name="file-text"
              size={15}
              color={colors.mutedForeground}
            />
            <Text
              style={[
                styles.cardTitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                  marginLeft: 6,
                },
              ]}
            >
              PAYMENT & BROKER FEE
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: payColor + "20",
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Inter_700Bold",
                color: payColor,
              }}
            >
              {PAY_LABEL[status] ?? status}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 8, gap: 2 }}>
          <View style={styles.feeRow}>
            <Text style={[styles.feeLabel, { color: colors.mutedForeground }]}>
              Work value
              {liveJob.totalHours
                ? ` (${liveJob.totalHours}h × $${liveJob.ratePerHour}/hr)`
                : ""}
            </Text>
            <Text style={[styles.feeVal, { color: colors.foreground }]}>
              {fmt(base)}
            </Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={[styles.feeLabel, { color: colors.mutedForeground }]}>
              HaulBrokr broker fee ({Math.round(feeRate * 100)}%)
            </Text>
            <Text style={[styles.feeVal, { color: colors.primary }]}>
              + {fmt(liveJob.platformFeeAmount)}
            </Text>
          </View>
          <View
            style={[
              styles.feeRow,
              {
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: 8,
                marginTop: 4,
              },
            ]}
          >
            <Text
              style={[
                styles.feeLabel,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              Customer total
            </Text>
            <Text
              style={[
                styles.feeVal,
                {
                  color: colors.foreground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 16,
                },
              ]}
            >
              {fmt(liveJob.customerTotalAmount)}
            </Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={[styles.feeLabel, { color: colors.mutedForeground }]}>
              Provider net payout
            </Text>
            <Text
              style={[
                styles.feeVal,
                { color: ACCENT.green, fontFamily: "Inter_700Bold" },
              ]}
            >
              {fmt(liveJob.providerNetAmount)}
            </Text>
          </View>
        </View>

        <Text
          style={[
            { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 8 },
            { color: colors.mutedForeground },
          ]}
        >
          The {Math.round(feeRate * 100)}% broker fee is deducted before the
          driver is paid. On Net terms the provider is paid once the customer
          settles the invoice.
        </Text>

        {status === "released" && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 12,
            }}
          >
            <Feather name="check-circle" size={15} color={ACCENT.green} />
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Inter_600SemiBold",
                color: ACCENT.green,
              }}
            >
              Provider received {fmt(liveJob.providerNetAmount)} · HaulBrokr
              retained {fmt(liveJob.platformFeeAmount)}
            </Text>
          </View>
        )}

        {/* Customer actions */}
        {isCustomer && (status === "unpaid" || status === "failed") && (
          <Pressable
            disabled={pending}
            onPress={onCharge}
            style={[
              {
                marginTop: 12,
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: "center",
                opacity: pending ? 0.6 : 1,
              },
              { backgroundColor: colors.primary },
            ]}
          >
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Inter_700Bold",
                color: colors.primaryForeground,
              }}
            >
              {charge.isPending
                ? "Processing…"
                : `Pay ${fmt(liveJob.customerTotalAmount)}`}
            </Text>
          </Pressable>
        )}
        {isCustomer && (status === "invoiced" || status === "paid") && (
          <Pressable
            disabled={pending}
            onPress={onRelease}
            style={[
              {
                marginTop: 12,
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: "center",
                opacity: pending ? 0.6 : 1,
              },
              { backgroundColor: ACCENT.green },
            ]}
          >
            <Text
              style={{
                fontSize: 13,
                fontFamily: "Inter_700Bold",
                color: "#fff",
              }}
            >
              {release.isPending
                ? "Processing…"
                : status === "invoiced"
                  ? `Settle Invoice & Release ${fmt(liveJob.providerNetAmount)}`
                  : "Release Payout to Provider"}
            </Text>
          </Pressable>
        )}

        {/* Additive second payment path: Stripe-hosted Checkout (destination
            charge). Same payable states as the off-session flow above. */}
        {isCustomer &&
          (status === "unpaid" ||
            status === "failed" ||
            status === "invoiced" ||
            status === "paid") && (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginVertical: 12,
                }}
              >
                <View
                  style={{ flex: 1, height: 1, backgroundColor: colors.border }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "Inter_600SemiBold",
                    color: colors.mutedForeground,
                  }}
                >
                  OR
                </Text>
                <View
                  style={{ flex: 1, height: 1, backgroundColor: colors.border }}
                />
              </View>
              <Pressable
                disabled={pending || checkoutBusy}
                onPress={onCheckout}
                style={[
                  {
                    paddingVertical: 12,
                    borderRadius: 8,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 7,
                    borderWidth: 1.5,
                    opacity: pending || checkoutBusy ? 0.6 : 1,
                  },
                  { borderColor: colors.primary },
                ]}
              >
                <Feather name="credit-card" size={15} color={colors.primary} />
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: "Inter_700Bold",
                    color: colors.primary,
                  }}
                >
                  {verifyCheckout.isPending
                    ? "Confirming payment…"
                    : checkoutSession.isPending
                      ? "Opening Checkout…"
                      : `Pay with Stripe Checkout ${fmt(liveJob.customerTotalAmount)}`}
                </Text>
              </Pressable>
              <Text
                style={[
                  {
                    fontSize: 11,
                    fontFamily: "Inter_400Regular",
                    marginTop: 6,
                    textAlign: "center",
                  },
                  { color: colors.mutedForeground },
                ]}
              >
                Pay securely on Stripe's hosted page with any card.
              </Text>
            </>
          )}

        {/* Payouts-not-enabled warning — completed jobs can't pay out until set up */}
        {isProviderLive &&
          status !== "released" &&
          payoutStatusData != null &&
          !payoutsEnabled && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/account");
              }}
              style={[
                styles.payoutNotice,
                {
                  backgroundColor: colors.primary + "12",
                  borderColor: colors.primary + "40",
                },
              ]}
            >
              <Feather name="alert-circle" size={14} color={colors.primary} />
              <Text
                style={[
                  styles.payoutNoticeText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                Payouts aren't enabled yet. Payments from completed jobs can't
                be released until you set up your payout account.
              </Text>
              <Feather name="chevron-right" size={14} color={colors.primary} />
            </Pressable>
          )}

        {/* Provider read-only context */}
        {isProviderLive && (status === "unpaid" || status === "invoiced") && (
          <Text
            style={[
              { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 12 },
              { color: colors.mutedForeground },
            ]}
          >
            {status === "invoiced"
              ? "Customer is on Net terms — your net payout releases once they settle the invoice."
              : "Awaiting customer payment. Your net payout transfers automatically once they pay."}
          </Text>
        )}
        {isProviderLive && status === "released" && (
          <Text
            style={[
              { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 12 },
              { color: ACCENT.green },
            ]}
          >
            You received {fmt(liveJob.providerNetAmount)} (net of the{" "}
            {Math.round(feeRate * 100)}% broker fee).
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={styles.infoRow}>
      <Feather
        name={icon as any}
        size={14}
        color={colors.primary}
        style={{ flexShrink: 0 }}
      />
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
          { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function fmtTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ── Live chat (real jobs) ────────────────────────────────────────────────────
function LiveChatPanel({ numericId }: { numericId: number | null }) {
  const colors = useColors();
  const { data: myProfile } = useMyProfile();
  const { data: messages, isLoading } = useJobMessages(numericId);
  const sendMessage = useSendJobMessage(numericId);
  const [text, setText] = useState("");

  const myId = (myProfile as any)?.id;

  const handleSend = () => {
    const body = text.trim();
    if (!body) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage.mutate(body, {
      onError: (e: any) =>
        Alert.alert("Couldn't send", e?.message ?? "Try again."),
    });
    setText("");
  };

  return (
    <Animated.View entering={FadeInDown.delay(130).springify()}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.cardTitle,
            { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          MESSAGES
        </Text>
        {isLoading ? (
          <Text
            style={[
              styles.ticketEmpty,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            Loading…
          </Text>
        ) : (messages?.length ?? 0) === 0 ? (
          <Text
            style={[
              styles.ticketEmpty,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            No messages yet. Say hello to coordinate this job.
          </Text>
        ) : (
          (messages ?? []).map((msg) => {
            const isMe = myId != null && msg.senderProfileId === myId;
            return (
              <View
                key={msg.id}
                style={[
                  styles.msgBubbleWrap,
                  { justifyContent: isMe ? "flex-end" : "flex-start" },
                ]}
              >
                <View
                  style={[
                    styles.msgBubble,
                    {
                      backgroundColor: isMe
                        ? colors.primary
                        : colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {!isMe && (
                    <Text
                      style={[
                        styles.msgSender,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {msg.senderName}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.msgText,
                      {
                        color: isMe
                          ? colors.primaryForeground
                          : colors.foreground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {msg.body}
                  </Text>
                  <Text
                    style={[
                      styles.msgTime,
                      {
                        color: isMe
                          ? colors.primaryForeground + "99"
                          : colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {fmtTime(msg.createdAt)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
        <View
          style={[
            styles.msgInputRow,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <TextInput
            style={[
              styles.msgInput,
              { color: colors.foreground, fontFamily: "Inter_400Regular" },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            style={[
              styles.sendBtn,
              { backgroundColor: text.trim() ? colors.primary : colors.border },
            ]}
          >
            <Feather
              name="send"
              size={16}
              color={
                text.trim() ? colors.primaryForeground : colors.mutedForeground
              }
            />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Live rating (completed real jobs) ────────────────────────────────────────
function LiveRatingPanel({
  numericId,
  isProvider,
}: {
  numericId: number | null;
  isProvider: boolean;
}) {
  const colors = useColors();
  const { data, isLoading } = useJobRating(numericId);
  const submit = useSubmitJobRating(numericId);
  const [hoverRating, setHoverRating] = useState(0);

  const mine = data?.mine ?? null;

  const handleRate = (stars: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    submit.mutate(
      { stars },
      {
        onError: (e: any) =>
          Alert.alert("Couldn't submit rating", e?.message ?? "Try again."),
      },
    );
  };

  return (
    <Animated.View entering={FadeInDown.delay(140).springify()}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.cardTitle,
            { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {mine ? "YOUR RATING" : "RATE THIS JOB"}
        </Text>
        {isLoading ? (
          <Text
            style={[
              styles.ratingPrompt,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            Loading…
          </Text>
        ) : mine ? (
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Feather
                key={s}
                name="star"
                size={24}
                color={s <= mine.stars ? "#f59e0b" : colors.border}
              />
            ))}
            <Text
              style={[
                styles.ratingLabel,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              You rated this {mine.stars}/5
            </Text>
          </View>
        ) : (
          <View>
            <Text
              style={[
                styles.ratingPrompt,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              How was your experience with this{" "}
              {isProvider ? "customer" : "provider"}?
            </Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable
                  key={s}
                  disabled={submit.isPending}
                  onPress={() => handleRate(s)}
                  onPressIn={() => setHoverRating(s)}
                  onPressOut={() => setHoverRating(0)}
                >
                  <Feather
                    name="star"
                    size={36}
                    color={s <= (hoverRating || 0) ? "#f59e0b" : colors.border}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ── Live load tickets (real jobs) ────────────────────────────────────────────
function LiveTicketsPanel({
  numericId,
  role,
  status,
}: {
  numericId: number | null;
  role: string;
  status: string;
}) {
  const colors = useColors();
  const { data, isLoading } = useTickets(numericId);
  const createTicket = useCreateTicket();
  const clockIn = useTicketClockIn();
  const clockOut = useTicketClockOut();

  const tickets: any[] = (data as any)?.tickets ?? [];
  const isDriverSide = role === "provider" || role === "driver";
  const isVerifierSide = role === "customer" || role === "supervisor";
  const totalWeight = tickets.reduce(
    (sum, t) => sum + (parseFloat(t.weightTons) || 0),
    0,
  );

  const handleAdd = () => {
    if (numericId == null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    createTicket.mutate(
      { jobId: numericId },
      {
        onError: (e: any) =>
          Alert.alert("Couldn't log load", e?.message ?? "Try again."),
      },
    );
  };

  return (
    <Animated.View entering={FadeInDown.delay(150).springify()}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardRow}>
          <Text
            style={[
              styles.cardTitle,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_600SemiBold",
              },
            ]}
          >
            LOAD TICKETS ({tickets.length})
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {isVerifierSide && tickets.length > 0 && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/ticket/scan" as any);
                }}
                style={[
                  styles.ticketAddBtn,
                  {
                    backgroundColor: ACCENT.blue + "1a",
                    borderColor: ACCENT.blue + "55",
                  },
                ]}
              >
                <Feather name="maximize" size={13} color={ACCENT.blue} />
                <Text
                  style={[
                    styles.ticketAddText,
                    { color: ACCENT.blue, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  Scan
                </Text>
              </Pressable>
            )}
            {status !== "completed" && isDriverSide && (
              <Pressable
                onPress={handleAdd}
                disabled={createTicket.isPending}
                style={[
                  styles.ticketAddBtn,
                  {
                    backgroundColor: colors.primary + "18",
                    borderColor: colors.primary + "40",
                  },
                ]}
              >
                <Feather name="plus" size={13} color={colors.primary} />
                <Text
                  style={[
                    styles.ticketAddText,
                    { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  Log Load
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        {isLoading ? (
          <Text
            style={[
              styles.ticketEmpty,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            Loading…
          </Text>
        ) : tickets.length === 0 ? (
          <Text
            style={[
              styles.ticketEmpty,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            No load tickets yet. Tap "Log Load" after each trip.
          </Text>
        ) : (
          tickets.map((t, idx) => {
            const isVerified = !!t.verifiedAt;
            const isCompleted =
              t.status === "completed" || t.status === "verified" || isVerified;
            const isInProgress =
              t.status === "in_progress" ||
              (!!t.clockedInAt && !t.clockedOutAt);
            const statusColor = isVerified
              ? ACCENT.green
              : isCompleted
                ? ACCENT.blue
                : isInProgress
                  ? colors.primary
                  : colors.mutedForeground;
            const statusLabel = isVerified
              ? "Verified"
              : isCompleted
                ? "Completed"
                : isInProgress
                  ? "Hauling"
                  : "Pending";
            return (
              <View key={t.id}>
                <View style={styles.ticketRow}>
                  <View
                    style={[
                      styles.ticketNum,
                      { backgroundColor: statusColor + "1f" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ticketNumText,
                        { color: statusColor, fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      #{t.loadNumber}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={[
                          styles.ticketTime,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
                      >
                        {fmtTime(t.createdAt)}
                      </Text>
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          backgroundColor: statusColor + "1a",
                          borderRadius: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 9,
                            color: statusColor,
                            fontFamily: "Inter_700Bold",
                            letterSpacing: 0.4,
                          }}
                        >
                          {statusLabel.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    {(t.clockedInAt || t.clockedOutAt) && (
                      <Text
                        style={[
                          styles.ticketNote,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {t.clockedInAt ? `In ${fmtTime(t.clockedInAt)}` : ""}
                        {t.clockedOutAt
                          ? ` • Out ${fmtTime(t.clockedOutAt)}`
                          : ""}
                      </Text>
                    )}
                    {isVerified && (
                      <Text
                        style={[
                          styles.ticketNote,
                          {
                            color: ACCENT.green,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
                      >
                        ✓ Verified {fmtTime(t.verifiedAt)}
                      </Text>
                    )}
                    {t.notes && (
                      <Text
                        style={[
                          styles.ticketNote,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {t.notes}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    {t.weightTons != null && (
                      <Text
                        style={[
                          styles.ticketWeight,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {t.weightTons} tons
                      </Text>
                    )}
                    {t.photoUrl && (
                      <Feather name="image" size={13} color={ACCENT.blue} />
                    )}
                  </View>
                </View>

                {isDriverSide && !isVerified && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    {!t.clockedInAt && (
                      <Pressable
                        onPress={() =>
                          clockIn.mutate(t.id, {
                            onError: (e: any) =>
                              Alert.alert("Error", e?.message ?? "Try again."),
                          })
                        }
                        style={[
                          styles.ticketActionBtn,
                          {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          },
                        ]}
                      >
                        <Feather name="play" size={12} color="#1e2235" />
                        <Text
                          style={[
                            styles.ticketActionText,
                            { color: "#1e2235" },
                          ]}
                        >
                          Clock In
                        </Text>
                      </Pressable>
                    )}
                    {t.clockedInAt && !t.clockedOutAt && (
                      <Pressable
                        onPress={() =>
                          clockOut.mutate(t.id, {
                            onError: (e: any) =>
                              Alert.alert("Error", e?.message ?? "Try again."),
                          })
                        }
                        style={[
                          styles.ticketActionBtn,
                          {
                            backgroundColor: ACCENT.green,
                            borderColor: ACCENT.green,
                          },
                        ]}
                      >
                        <Feather name="check" size={12} color="#fff" />
                        <Text
                          style={[styles.ticketActionText, { color: "#fff" }]}
                        >
                          Clock Out
                        </Text>
                      </Pressable>
                    )}
                    {t.clockedOutAt && (
                      <Pressable
                        onPress={() =>
                          router.push(
                            `/ticket/qr?jobId=${numericId}&ticketId=${t.id}` as any,
                          )
                        }
                        style={[
                          styles.ticketActionBtn,
                          {
                            backgroundColor: ACCENT.blue + "22",
                            borderColor: ACCENT.blue + "66",
                          },
                        ]}
                      >
                        <Feather name="grid" size={12} color={ACCENT.blue} />
                        <Text
                          style={[
                            styles.ticketActionText,
                            { color: ACCENT.blue },
                          ]}
                        >
                          Show QR
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {idx < tickets.length - 1 && (
                  <View
                    style={[
                      styles.divider,
                      { backgroundColor: colors.border, marginTop: 10 },
                    ]}
                  />
                )}
              </View>
            );
          })
        )}
        {tickets.length > 0 && (
          <View style={[styles.ticketTotal, { borderTopColor: colors.border }]}>
            <Text
              style={[
                styles.ticketTotalLabel,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              Total Weight Logged
            </Text>
            <Text
              style={[
                styles.ticketTotalValue,
                { color: ACCENT.green, fontFamily: "Inter_700Bold" },
              ]}
            >
              {totalWeight.toFixed(1)} tons
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  content: { padding: 16, gap: 14 },
  topRow: { flexDirection: "row", gap: 8, marginBottom: 6, flexWrap: "wrap" },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: 1,
  },
  typeText: { fontSize: 12 },
  material: { fontSize: 26, fontWeight: "700", marginTop: 4 },
  quantity: { fontSize: 14 },
  rateCard: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  rateSection: { flex: 1, gap: 3, alignItems: "center" },
  rateLabel: { fontSize: 11 },
  rateValue: { fontSize: 18, fontWeight: "700" },
  rateDivider: { width: 1, height: 36, marginHorizontal: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
  cardTitle: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 2,
  },
  // Provider contact
  providerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  providerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  providerAvatarText: { fontSize: 13 },
  providerName: { fontSize: 14 },
  providerPhone: { fontSize: 13 },
  contactBtns: { gap: 6 },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  contactBtnText: { fontSize: 12 },
  trackingBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  trackingBtnText: { flex: 1, fontSize: 13 },
  // Time tracking
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  timeItem: { flex: 1, alignItems: "center", gap: 4 },
  timeLabel: { fontSize: 11 },
  timeValue: { fontSize: 15 },
  timeDivider: { width: 1, height: 40 },
  checkBtns: { flexDirection: "row", gap: 10 },
  checkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  checkBtnText: { fontSize: 14 },
  // Route
  routeRow: { flexDirection: "row", gap: 14 },
  routeIndicator: { alignItems: "center", paddingTop: 4, gap: 4 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { width: 2, flex: 1, minHeight: 20 },
  routeAddresses: { flex: 1, gap: 16 },
  routeAddr: { gap: 3 },
  routeAddrLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  routeAddrText: { fontSize: 14, lineHeight: 20 },
  routeAddrDist: { fontSize: 12 },
  // Info rows
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  infoLabel: { fontSize: 13, width: 90, flexShrink: 0 },
  infoValue: { fontSize: 13, flex: 1 },
  notes: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 6, marginTop: 4 },
  notesLabel: { fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" },
  notesText: { fontSize: 13, lineHeight: 20 },
  // Bids
  divider: { height: 1 },
  bidRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
  },
  bidAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bidAvatarText: { fontSize: 13 },
  bidName: { fontSize: 14 },
  bidCompany: { fontSize: 12 },
  bidMsg: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  bidRate: { fontSize: 15 },
  immediateBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  immediateText: { fontSize: 10 },
  // Chat
  msgBubbleWrap: { flexDirection: "row", marginVertical: 3 },
  msgBubble: {
    maxWidth: "80%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 2,
  },
  msgSender: { fontSize: 11 },
  msgText: { fontSize: 13, lineHeight: 18 },
  msgTime: { fontSize: 10 },
  msgInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    gap: 8,
    marginTop: 6,
  },
  msgInput: {
    flex: 1,
    fontSize: 14,
    maxHeight: 80,
    minHeight: 36,
    paddingTop: 4,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  // Rating
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingLabel: { fontSize: 13, marginLeft: 4 },
  ratingPrompt: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  starsRow: { flexDirection: "row", gap: 8 },
  // Bid form
  bidFormSub: { fontSize: 13, lineHeight: 18 },
  payoutNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 10,
  },
  payoutNoticeText: { flex: 1, fontSize: 12, lineHeight: 16 },
  bidFormRow: { flexDirection: "row", gap: 12 },
  bidFormLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  bidFormInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  bidFormTextarea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 72,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    marginTop: 4,
  },
  check: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkLabel: { fontSize: 14 },
  bidFormBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBidBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  cancelBidBtnText: { fontSize: 14 },
  submitBidBtn: { paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  submitBidText: { fontSize: 15 },
  // Card row
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  feeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 3,
  },
  feeLabel: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  feeVal: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  // Load tickets
  ticketAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  ticketAddText: { fontSize: 12 },
  ticketActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  ticketActionText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  ticketEmpty: { fontSize: 13, lineHeight: 18 },
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  ticketNum: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  ticketNumText: { fontSize: 13 },
  ticketTime: { fontSize: 13 },
  ticketNote: { fontSize: 11 },
  ticketWeight: { fontSize: 13 },
  ticketTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  ticketTotalLabel: { fontSize: 12 },
  ticketTotalValue: { fontSize: 16 },
  // Invoice button
  invoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  invoiceBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  invoiceBtnTitle: { fontSize: 14 },
  invoiceBtnSub: { fontSize: 12, marginTop: 2 },
  // Dispute
  disputePrompt: { fontSize: 13, lineHeight: 18 },
  disputeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 88,
  },
  disputeOpenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  disputeOpenText: { fontSize: 14, flex: 1 },
  disputeFiledText: { fontSize: 13, lineHeight: 18 },
  disputeStatus: { fontSize: 12, lineHeight: 18 },
  // Cancel modal
  cancelFeeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  cancelFeeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioInner: { width: 8, height: 8, borderRadius: 4 },
  reasonText: { fontSize: 14 },
  // Action bar
  actionBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  customerActionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionBtnText: { fontSize: 16 },
  cancelJobBtn: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
});
