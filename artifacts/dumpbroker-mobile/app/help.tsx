import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
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

import { useColors } from "@/hooks/useColors";

const FAQS = [
  {
    id: "f1",
    category: "Getting Started",
    q: "How does HaulBrokr work?",
    a: "HaulBrokr connects customers who need material hauled or dumped with licensed dump truck providers. Customers post job requests with pickup/delivery info and budget. Providers browse open jobs and submit competitive bids. Once a Customer accepts a bid, the job is scheduled and payment is processed through the platform.",
  },
  {
    id: "f2",
    category: "Getting Started",
    q: "Who can use HaulBrokr?",
    a: "HaulBrokr is built for two types of users:\n\n• Customers: Construction companies, general contractors, developers, municipalities, and homeowners who need material hauled, dumped, or delivered.\n\n• Providers: Licensed dump truck operators, trucking companies, and hauling businesses with commercial vehicles and required insurance.",
  },
  {
    id: "f3",
    category: "Getting Started",
    q: "How do I switch between Customer and Provider mode?",
    a: "Go to the Account tab and tap 'Switch to Provider' (or 'Switch to Customer') at the top of your profile card. This changes your dashboard view and available features. You can switch at any time.",
  },
  {
    id: "f4",
    category: "Posting Jobs",
    q: "What information do I need to post a job?",
    a: "To post a job, you'll need:\n\n• Material type (dirt, concrete, gravel, etc.)\n• Estimated quantity in tons\n• Pickup address\n• Delivery/dump address\n• Number of trucks needed\n• Budget per hour\n• Scheduled date\n• Whether you require the provider to supply all equipment",
  },
  {
    id: "f5",
    category: "Posting Jobs",
    q: "What materials can be hauled through HaulBrokr?",
    a: "HaulBrokr supports common construction and demolition materials:\n\n• Dirt, fill, and topsoil\n• Concrete debris and rubble\n• Asphalt millings\n• Rock, gravel, and aggregates\n• Demolition debris\n• Sand\n• Scrap metal\n\nHazardous materials, asbestos, radioactive waste, and regulated substances CANNOT be posted on HaulBrokr.",
  },
  {
    id: "f6",
    category: "Posting Jobs",
    q: "Can I cancel a job after posting?",
    a: "You can cancel a job at any time before accepting a bid at no charge. After accepting a bid, cancellation within 24 hours of the scheduled start time may result in a 15% cancellation fee based on the estimated job value. Cancellations due to Provider non-performance are not subject to fees.",
  },
  {
    id: "f7",
    category: "Bidding",
    q: "How do Providers bid on jobs?",
    a: "Providers browse open jobs on the Job Board tab, filtered by material type, location, and status. Tap any job card to view full details, then tap 'Place a Bid' to submit your rate. Your bid includes your hourly rate and any notes for the Customer.",
  },
  {
    id: "f8",
    category: "Bidding",
    q: "How many bids can I receive on one job?",
    a: "There is no limit to the number of bids a job can receive. Customers can view all bids and compare Providers by rate, rating, and review history. Most open jobs receive 3–8 bids within the first 24 hours.",
  },
  {
    id: "f9",
    category: "Bidding",
    q: "What happens after my bid is accepted?",
    a: "You will receive a push notification and in-app alert when your bid is accepted. The job moves to 'Accepted' status on your Jobs tab. Review the pickup/delivery details, confirm the schedule, and arrive on time. After job completion, payment is processed within 3–5 business days.",
  },
  {
    id: "f10",
    category: "Payments",
    q: "How does payment work?",
    a: "Customers are charged after job completion. HaulBrokr charges:\n\n• Customer platform fee: 8% of total job value\n• Provider platform fee: 5% of total job value\n\nProviders receive payment via direct deposit within 3–5 business days after the Customer confirms job completion.",
  },
  {
    id: "f11",
    category: "Payments",
    q: "What payment methods are accepted?",
    a: "HaulBrokr accepts:\n\n• Major credit and debit cards (Visa, Mastercard, Amex, Discover)\n• ACH bank transfers (for businesses)\n• Invoicing for enterprise accounts\n\nAll payments are secured by 256-bit SSL encryption and processed through our PCI-compliant payment partner.",
  },
  {
    id: "f12",
    category: "Payments",
    q: "What if there is a payment dispute?",
    a: "If you believe a charge is incorrect, contact HaulBrokr Support within 7 days of the charge. We will investigate by reviewing weight tickets, job records, and communication between parties. During a dispute investigation, payments may be held pending resolution. Our team aims to resolve disputes within 5 business days.",
  },
  {
    id: "f13",
    category: "Compliance",
    q: "What documents do Providers need to submit?",
    a: "All Providers must submit:\n\n• W-9 Tax Form\n• Commercial General Liability Insurance (minimum $1M per occurrence)\n• FMCSA registration (USDOT number)\n• Payout bank account information\n\nAdditional documents may be required depending on your state and the types of materials you haul.",
  },
  {
    id: "f14",
    category: "Compliance",
    q: "Is HaulBrokr responsible for illegal dumping?",
    a: "No. Providers are solely responsible for compliance with all federal, state, and local disposal laws. HaulBrokr is a technology marketplace and does not control where or how materials are disposed. Providers who engage in illegal dumping will be permanently banned and reported to the appropriate authorities.",
  },
  {
    id: "f15",
    category: "Dump Sites",
    q: "How do I find a nearby dump site or landfill?",
    a: "Tap the 'Dump Sites' button on the Home screen to open the Site Locator. You can search by city, state, or material type. Switch between 'Dump Sites' (landfills and transfer stations) and 'Material Sites' (quarries and suppliers) using the tabs at the top of the screen.",
  },
  {
    id: "f16",
    category: "Account",
    q: "How do I update my profile information?",
    a: "Go to the Account tab to view your profile. Tap 'Edit Profile' to update your name, company, phone number, and location. Changes to your insurance or compliance documents must be submitted through the Compliance section.",
  },
];

const CATEGORIES = ["All", "Getting Started", "Posting Jobs", "Bidding", "Payments", "Compliance", "Dump Sites", "Account"];

const CONTACT_OPTIONS = [
  { id: "phone", icon: "phone", label: "Call Support", sub: "(214) 555-0100", action: "phone" },
  { id: "email", icon: "mail", label: "Email Support", sub: "support@haulbrokr.com", action: "email" },
  { id: "chat", icon: "message-circle", label: "Live Chat", sub: "Mon–Fri 8am–6pm CST", action: "chat" },
];

export default function HelpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered = useMemo(() => {
    let items = FAQS;
    if (category !== "All") items = items.filter((f) => f.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
      );
    }
    return items;
  }, [category, search]);

  const handleContact = (action: string, sub: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (action === "phone") {
      Linking.openURL(`tel:+12145550100`).catch(() =>
        Alert.alert("Call Support", "Phone: (214) 555-0100")
      );
    } else if (action === "email") {
      Linking.openURL(`mailto:support@haulbrokr.com`).catch(() =>
        Alert.alert("Email Support", "support@haulbrokr.com")
      );
    } else {
      Alert.alert("Live Chat", "Live chat is available Mon–Fri, 8am–6pm CST.\n\nOpening chat...", [
        { text: "OK" },
      ]);
    }
  };

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
          Help & Support
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom }]}
      >
        {/* Contact cards */}
        <View style={[styles.contactSection, { backgroundColor: colors.primary + "10", borderColor: colors.border }]}>
          <Text style={[styles.contactTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Contact Us
          </Text>
          <Text style={[styles.contactSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Our team is ready to help with any issue.
          </Text>
          <View style={styles.contactCards}>
            {CONTACT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => handleContact(opt.action, opt.sub)}
                style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.contactIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name={opt.icon as any} size={20} color={colors.primary} />
                </View>
                <Text style={[styles.contactLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.contactSub2, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {opt.sub}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Search */}
        <Text style={[styles.faqTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          Frequently Asked Questions
        </Text>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
            placeholder="Search questions..."
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

        {/* Category filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setCategory(cat)}
              style={[
                styles.chip,
                {
                  backgroundColor: category === cat ? colors.primary : colors.card,
                  borderColor: category === cat ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_500Medium",
                  color: category === cat ? colors.primaryForeground : colors.foreground,
                }}
              >
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* FAQ count */}
        <Text style={[styles.count, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {filtered.length} question{filtered.length !== 1 ? "s" : ""}
          {category !== "All" ? ` in ${category}` : ""}
        </Text>

        {/* FAQ list */}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="help-circle" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              No results for "{search}"
            </Text>
          </View>
        ) : (
          <View style={[styles.faqList, { borderColor: colors.border }]}>
            {filtered.map((faq, idx) => {
              const open = expanded === faq.id;
              return (
                <View key={faq.id}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setExpanded(open ? null : faq.id);
                    }}
                    style={[styles.faqRow, { backgroundColor: open ? colors.primary + "08" : colors.card }]}
                  >
                    <View style={styles.faqLeft}>
                      <View style={[styles.catDot, { backgroundColor: colors.primary }]} />
                      <Text
                        style={[
                          styles.faqQ,
                          {
                            color: open ? colors.primary : colors.foreground,
                            fontFamily: "Inter_500Medium",
                          },
                        ]}
                      >
                        {faq.q}
                      </Text>
                    </View>
                    <Feather
                      name={open ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={open ? colors.primary : colors.mutedForeground}
                    />
                  </Pressable>
                  {open && (
                    <View style={[styles.faqAnswer, { backgroundColor: colors.card }]}>
                      <Text style={[styles.answerText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                        {faq.a}
                      </Text>
                    </View>
                  )}
                  {idx < filtered.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Still need help */}
        <View style={[styles.stillHelp, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="life-buoy" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.stillHelpTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Still need help?
            </Text>
            <Text style={[styles.stillHelpSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Our support team typically responds within 2 business hours.
            </Text>
          </View>
          <Pressable
            onPress={() => handleContact("email", "")}
            style={[styles.stillHelpBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
              Contact
            </Text>
          </Pressable>
        </View>
      </ScrollView>
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
  content: { padding: 16, gap: 14 },
  contactSection: { padding: 16, borderWidth: 1, gap: 8 },
  contactTitle: { fontSize: 18, fontWeight: "700" as const },
  contactSub: { fontSize: 13 },
  contactCards: { flexDirection: "row", gap: 10, marginTop: 4 },
  contactCard: {
    flex: 1,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  contactIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  contactLabel: { fontSize: 12, fontWeight: "600" as const, textAlign: "center" },
  contactSub2: { fontSize: 10, textAlign: "center" },
  faqTitle: { fontSize: 20, fontWeight: "700" as const, marginTop: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14, height: "100%" },
  chips: { gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  count: { fontSize: 12 },
  faqList: { borderWidth: 1, overflow: "hidden" },
  faqRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 14,
    gap: 10,
  },
  faqLeft: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  catDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  faqQ: { flex: 1, fontSize: 14, lineHeight: 20 },
  faqAnswer: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 0 },
  answerText: { fontSize: 14, lineHeight: 22, paddingLeft: 16 },
  divider: { height: 1 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14 },
  stillHelp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 4,
  },
  stillHelpTitle: { fontSize: 14, fontWeight: "600" as const, marginBottom: 2 },
  stillHelpSub: { fontSize: 12 },
  stillHelpBtn: { paddingHorizontal: 14, paddingVertical: 8 },
});
