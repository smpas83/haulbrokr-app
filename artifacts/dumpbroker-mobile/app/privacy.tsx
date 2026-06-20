import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const SECTIONS = [
  {
    id: "1",
    title: "1. Information We Collect",
    body: `We collect information you provide directly to us and information generated through your use of the App:

Registration Data: Name, company name, email address, phone number, city and state.

Business Credentials: W-9 tax forms, insurance certificates, FMCSA registration numbers, CDL information.

Job & Transaction Data: Job postings, bids, accepted jobs, addresses, material types, quantities, and payment records.

Device & Usage Data: Device type, operating system, IP address, app usage patterns, crash logs, and diagnostic data.

Location Data: With your permission, approximate location to display nearby jobs and sites.`,
  },
  {
    id: "2",
    title: "2. How We Use Your Information",
    body: `We use the information collected to:

• Operate and improve the HaulBrokr platform
• Match Customers with qualified Providers
• Process and settle payments
• Verify Provider credentials and insurance
• Send job alerts, bid notifications, and account updates
• Respond to support inquiries
• Comply with legal and regulatory obligations
• Prevent fraud and enforce our Terms of Service
• Generate anonymized analytics to improve platform performance

We do not sell your personal information to third parties.`,
  },
  {
    id: "3",
    title: "3. Information Sharing",
    body: `We share your information in the following circumstances:

Between Customers and Providers: When a job is posted or a bid is accepted, certain information (company name, city, job details) is shared between the parties to facilitate the transaction.

Service Providers: We share data with trusted third-party vendors who help us operate the platform, including payment processors, cloud hosting providers, and analytics services. These vendors are bound by data processing agreements.

Legal Compliance: We may disclose information when required by law, subpoena, or government request, or to protect the rights and safety of HaulBrokr and its users.

Business Transfers: In the event of a merger, acquisition, or sale of assets, user data may be transferred as part of the transaction.`,
  },
  {
    id: "4",
    title: "4. Data Retention",
    body: `We retain your personal information for as long as your account is active or as needed to provide services. Specifically:

• Account data: Retained for the life of your account plus 5 years after closure
• Transaction records: Retained for 7 years to comply with tax and financial regulations
• Job and bid history: Retained for 3 years
• Device and usage logs: Retained for 90 days

You may request deletion of your account and associated data by contacting privacy@haulbrokr.com. Note that some data may be retained for legal compliance even after account deletion.`,
  },
  {
    id: "5",
    title: "5. Your Privacy Rights",
    body: `Depending on your location, you may have the following rights:

Access: Request a copy of the personal data we hold about you.

Correction: Request correction of inaccurate or incomplete personal data.

Deletion: Request deletion of your personal data, subject to legal retention requirements.

Opt-Out: Opt out of marketing communications at any time by updating your notification preferences in the Account tab or contacting support.

Data Portability: Request your data in a portable, machine-readable format.

To exercise these rights, contact us at privacy@haulbrokr.com. We will respond within 30 days.`,
  },
  {
    id: "6",
    title: "6. Security",
    body: `HaulBrokr takes data security seriously. We implement:

• 256-bit SSL/TLS encryption for all data in transit
• AES-256 encryption for sensitive data at rest
• PCI-DSS compliant payment processing
• Multi-factor authentication for administrative access
• Regular security audits and penetration testing
• Role-based access controls limiting employee data access

No system is 100% secure. In the event of a data breach that affects your rights, we will notify affected users within 72 hours as required by applicable law.`,
  },
  {
    id: "7",
    title: "7. Cookies & Tracking",
    body: `Our web-based platform uses cookies and similar technologies to:

• Maintain your session and authentication state
• Remember your preferences
• Analyze platform usage patterns
• Detect and prevent fraudulent activity

You can control cookie settings through your browser preferences. Disabling certain cookies may limit functionality of the platform.

We do not engage in cross-site tracking for advertising purposes.`,
  },
  {
    id: "8",
    title: "8. Children's Privacy",
    body: `HaulBrokr is intended for use by business professionals aged 18 and older. We do not knowingly collect personal information from children under 13. If we learn we have collected information from a child under 13, we will delete it promptly.

If you believe we have collected information from a child, please contact privacy@haulbrokr.com.`,
  },
  {
    id: "9",
    title: "9. Contact & Effective Date",
    body: `For privacy-related inquiries, contact our Privacy Team:

HaulBrokr LLC — Privacy Team
privacy@haulbrokr.com
(214) 555-0100
Dallas, Texas 75201

Effective Date: January 1, 2026
Last Updated: May 1, 2026`,
  },
];

export default function PrivacyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>("1");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          Privacy Policy
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.banner, { backgroundColor: colors.primary + "18", borderBottomColor: colors.border }]}>
        <Feather name="lock" size={16} color={colors.primary} />
        <Text style={[styles.bannerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          We are committed to protecting your personal data and being transparent about how we use it.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section) => {
          const open = expanded === section.id;
          return (
            <View key={section.id} style={[styles.section, { borderColor: colors.border }]}>
              <Pressable
                onPress={() => setExpanded(open ? null : section.id)}
                style={[styles.sectionHeader, { backgroundColor: open ? colors.primary + "10" : colors.card }]}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: open ? colors.primary : colors.foreground, fontFamily: "Inter_600SemiBold" },
                  ]}
                  numberOfLines={2}
                >
                  {section.title}
                </Text>
                <Feather
                  name={open ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={open ? colors.primary : colors.mutedForeground}
                />
              </Pressable>
              {open && (
                <View style={[styles.sectionBody, { backgroundColor: colors.card }]}>
                  <Text style={[styles.bodyText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                    {section.body}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
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
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  bannerText: { fontSize: 13, flex: 1, lineHeight: 18 },
  content: { padding: 16, gap: 2 },
  section: { borderWidth: 1, borderBottomWidth: 0, overflow: "hidden" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600" as const, flex: 1, lineHeight: 20 },
  sectionBody: { padding: 16, paddingTop: 12 },
  bodyText: { fontSize: 14, lineHeight: 22 },
});
