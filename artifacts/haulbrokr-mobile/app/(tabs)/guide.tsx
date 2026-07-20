import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInRight,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const { width } = Dimensions.get("window");

interface GuideStep {
  number: number;
  icon: string;
  title: string;
  description: string;
  tip?: string;
}

const CUSTOMER_STEPS: GuideStep[] = [
  {
    number: 1,
    icon: "user-plus",
    title: "Create Your Account",
    description:
      "Sign up with your business details and verify your email. Set up billing to pay providers directly through the platform.",
    tip: "Takes under 5 minutes",
  },
  {
    number: 2,
    icon: "file-plus",
    title: "Post a Job Request",
    description:
      "Describe your haul: material type, quantity (tons), pickup & delivery locations, number of trucks, and your preferred schedule.",
    tip: "The more detail you add, the better your bids",
  },
  {
    number: 3,
    icon: "trending-up",
    title: "Review Bids",
    description:
      "Compare quotes from vetted, insured providers. View their trucks, experience ratings, and pricing. Bids typically arrive within hours.",
    tip: "Average 4–8 bids per request",
  },
  {
    number: 4,
    icon: "map-pin",
    title: "Accept & Track",
    description:
      "Accept the best bid. Track your driver in real-time from pickup to delivery. You'll be notified at every milestone.",
    tip: "GPS tracking included",
  },
  {
    number: 5,
    icon: "check-circle",
    title: "Confirm & Pay",
    description:
      "Confirm delivery, release payment securely through the platform, and rate your provider. Payment is released only after your approval.",
    tip: "Secure escrow payment",
  },
];

const PROVIDER_STEPS: GuideStep[] = [
  {
    number: 1,
    icon: "clipboard",
    title: "Set Up Your Account",
    description:
      "Register your business, submit your W-9 tax form, provide proof of insurance, and add your truck fleet details.",
    tip: "Full compliance required before bidding",
  },
  {
    number: 2,
    icon: "search",
    title: "Browse the Job Board",
    description:
      "Search open haul requests by material type, location, date, and budget. Filter by distance to find jobs near your yard.",
    tip: "New jobs posted daily",
  },
  {
    number: 3,
    icon: "send",
    title: "Submit a Bid",
    description:
      "Send your hourly rate and availability. Customers can see your fleet, capacity, and ratings. Fast responders win more jobs.",
    tip: "Respond within 2 hours for best results",
  },
  {
    number: 4,
    icon: "truck",
    title: "Complete the Haul",
    description:
      "Accept the job in the app, confirm pickup with your driver, transport the material, and confirm delivery. Update status in real-time.",
    tip: "Photo verification at pickup & delivery",
  },
  {
    number: 5,
    icon: "dollar-sign",
    title: "Get Paid",
    description:
      "Payment releases automatically after the customer confirms delivery. Funds hit your linked bank account within 2 business days.",
    tip: "No invoicing needed — automatic payout",
  },
];

const FAQS = [
  {
    q: "How are providers vetted?",
    a: "All providers must submit a W-9, valid commercial insurance, and proof of FMCSA registration before their first job. We verify all documents.",
  },
  {
    q: "What materials can I haul?",
    a: "We handle dirt, fill, concrete debris, asphalt millings, rock & gravel, sand, demolition debris, scrap metal, and more.",
  },
  {
    q: "What are HaulBrokr's fees?",
    a: "Customers pay a transparent 15% marketplace fee on the base haul of each completed load, plus any fuel surcharge, tolls, and taxes where applicable. Carriers receive the base haul and pass-through charges (fuel, tolls, wait time). No monthly fees.",
  },
  {
    q: "What if there's a dispute?",
    a: "Our support team mediates all disputes. Payment is held in escrow until both parties confirm delivery — protecting everyone.",
  },
];

export default function GuideScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<"customer" | "provider">("customer");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const steps = role === "customer" ? CUSTOMER_STEPS : PROVIDER_STEPS;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: 100 + insets.bottom },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Text
        style={[
          styles.title,
          { color: colors.foreground, fontFamily: "Inter_700Bold" },
        ]}
      >
        How It Works
      </Text>
      <Text
        style={[
          styles.subtitle,
          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
        ]}
      >
        HaulBrokr connects construction companies with vetted dump truck providers — faster and smarter.
      </Text>

      {/* Role Toggle */}
      <View
        style={[
          styles.roleToggle,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {(["customer", "provider"] as const).map((r) => (
          <Pressable
            key={r}
            onPress={() => {
              setRole(r);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.roleBtn,
              r === role && { backgroundColor: colors.primary },
            ]}
          >
            <Feather
              name={r === "customer" ? "briefcase" : "truck"}
              size={16}
              color={
                r === role ? colors.primaryForeground : colors.mutedForeground
              }
            />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600" as const,
                fontFamily: "Inter_600SemiBold",
                color:
                  r === role ? colors.primaryForeground : colors.foreground,
              }}
            >
              {r === "customer" ? "I Need Trucks" : "I Have Trucks"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Steps */}
      <View style={styles.steps}>
        {steps.map((step, idx) => (
          <StepCard
            key={`${role}-${step.number}`}
            step={step}
            isLast={idx === steps.length - 1}
            colors={colors}
            delay={idx * 80}
          />
        ))}
      </View>

      {/* CTA */}
      <Animated.View entering={FadeInDown.delay(500).springify()}>
        <View
          style={[
            styles.ctaCard,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text
            style={[
              styles.ctaTitle,
              {
                color: colors.primaryForeground,
                fontFamily: "Inter_700Bold",
              },
            ]}
          >
            Ready to get started?
          </Text>
          <Text
            style={[
              styles.ctaSub,
              {
                color: colors.primaryForeground + "cc",
                fontFamily: "Inter_400Regular",
              },
            ]}
          >
            {role === "customer"
              ? "Post your first job request in under 2 minutes."
              : "Browse open jobs and start earning today."}
          </Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(role === "customer" ? "/(tabs)/jobs" : "/(tabs)/jobs");
            }}
            style={[
              styles.ctaBtn,
              { backgroundColor: colors.primaryForeground },
            ]}
          >
            <Text
              style={[
                styles.ctaBtnText,
                { color: colors.primary, fontFamily: "Inter_700Bold" },
              ]}
            >
              {role === "customer" ? "Post a Job" : "Browse Jobs"}
            </Text>
            <Feather
              name="arrow-right"
              size={16}
              color={colors.primary}
            />
          </Pressable>
        </View>
      </Animated.View>

      {/* FAQ */}
      <Text
        style={[
          styles.faqTitle,
          { color: colors.foreground, fontFamily: "Inter_700Bold" },
        ]}
      >
        Frequently Asked Questions
      </Text>
      {FAQS.map((faq, idx) => (
        <Animated.View
          key={idx}
          entering={FadeInDown.delay(idx * 60).springify()}
        >
          <Pressable
            onPress={() => {
              setExpandedFaq(expandedFaq === idx ? null : idx);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={[
              styles.faqItem,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.faqHeader}>
              <Text
                style={[
                  styles.faqQ,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {faq.q}
              </Text>
              <Feather
                name={expandedFaq === idx ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.mutedForeground}
              />
            </View>
            {expandedFaq === idx && (
              <Text
                style={[
                  styles.faqA,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {faq.a}
              </Text>
            )}
          </Pressable>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

function StepCard({
  step,
  isLast,
  colors,
  delay,
}: {
  step: GuideStep;
  isLast: boolean;
  colors: ReturnType<typeof useColors>;
  delay: number;
}) {
  return (
    <Animated.View
      style={styles.stepRow}
      entering={FadeInRight.delay(delay).springify()}
    >
      {/* Left: number + connector */}
      <View style={styles.stepLeft}>
        <View
          style={[styles.stepCircle, { backgroundColor: colors.primary }]}
        >
          <Text
            style={[
              styles.stepNum,
              {
                color: colors.primaryForeground,
                fontFamily: "Inter_700Bold",
              },
            ]}
          >
            {step.number}
          </Text>
        </View>
        {!isLast && (
          <View
            style={[styles.connector, { backgroundColor: colors.border }]}
          />
        )}
      </View>

      {/* Right: content */}
      <View style={styles.stepContent}>
        <View
          style={[
            styles.stepIconWrap,
            { backgroundColor: colors.primary + "18" },
          ]}
        >
          <Feather name={step.icon as any} size={20} color={colors.primary} />
        </View>
        <Text
          style={[
            styles.stepTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {step.title}
        </Text>
        <Text
          style={[
            styles.stepDesc,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          {step.description}
        </Text>
        {step.tip && (
          <View
            style={[
              styles.tipRow,
              { backgroundColor: colors.primary + "12" },
            ]}
          >
            <Feather name="info" size={12} color={colors.primary} />
            <Text
              style={[
                styles.tipText,
                { color: colors.primary, fontFamily: "Inter_500Medium" },
              ]}
            >
              {step.tip}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  roleToggle: {
    flexDirection: "row",
    borderWidth: 1,
    padding: 4,
    marginBottom: 32,
  },
  roleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  steps: {
    marginBottom: 32,
  },
  stepRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 0,
  },
  stepLeft: {
    alignItems: "center",
    width: 40,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNum: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginVertical: 4,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 28,
    gap: 8,
  },
  stepIconWrap: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
  },
  stepDesc: {
    fontSize: 14,
    lineHeight: 21,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  tipText: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  ctaCard: {
    padding: 24,
    gap: 12,
    marginBottom: 36,
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
  },
  ctaSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  faqTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    marginBottom: 16,
  },
  faqItem: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
    gap: 10,
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  faqQ: {
    fontSize: 15,
    fontWeight: "600" as const,
    flex: 1,
    lineHeight: 21,
  },
  faqA: {
    fontSize: 14,
    lineHeight: 20,
  },
});
