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
    title: "1. Acceptance of Terms",
    body: `By downloading, installing, or using the HaulBrokr application ("App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.

HaulBrokr LLC ("Company," "we," "us," or "our") reserves the right to update these Terms at any time. Continued use of the App after changes constitutes acceptance of the revised Terms. The effective date of the current Terms is shown at the bottom of this document.`,
  },
  {
    id: "2",
    title: "2. Description of Service",
    body: `HaulBrokr is a technology platform that connects customers ("Customers") who need materials hauled, dumped, or delivered with licensed dump truck operators and hauling companies ("Providers"). The Company acts solely as a marketplace intermediary and does not itself perform hauling, disposal, or material delivery services.

HaulBrokr does not own, operate, or control any dump trucks, hauling equipment, or disposal facilities. All hauling and disposal services are performed by independent Providers who are solely responsible for the legality, safety, and quality of their services.`,
  },
  {
    id: "3",
    title: "3. User Eligibility & Registration",
    body: `To use HaulBrokr, you must:

• Be at least 18 years of age
• Represent a legally operating business entity or be a licensed sole proprietor
• Provide accurate, complete, and up-to-date registration information
• Maintain the confidentiality of your account credentials

Providers must additionally hold all required federal, state, and local licenses, permits, and insurance policies required to legally operate commercial hauling vehicles and accept disposal materials. Providers are responsible for maintaining FMCSA compliance and valid CDL licensure where required.

The Company reserves the right to suspend or terminate accounts that violate these eligibility requirements or provide false information.`,
  },
  {
    id: "4",
    title: "4. Customer Responsibilities",
    body: `As a Customer, you agree to:

• Accurately describe the type, quantity, and characteristics of materials to be hauled or disposed
• Ensure pickup and delivery locations are legally accessible and safe for commercial vehicles
• Obtain all necessary permits for material disposal or delivery at your site
• Not request hauling or disposal of hazardous, radioactive, asbestos-containing, or otherwise regulated materials without proper disclosure and applicable licenses
• Pay all agreed fees promptly and in full per the agreed payment schedule
• Be present or designate a responsible representative at the job site during scheduled service

Misrepresentation of materials (e.g., representing hazardous waste as clean fill) may result in immediate account termination and liability for all remediation costs.`,
  },
  {
    id: "5",
    title: "5. Provider Responsibilities",
    body: `As a Provider, you agree to:

• Maintain valid USDOT, MC numbers, and all applicable state operating authority
• Carry minimum liability insurance of $1,000,000 per occurrence and cargo insurance as required by applicable law
• Operate vehicles that comply with all federal and state weight, safety, and emissions regulations
• Honor accepted bids and arrive at scheduled jobs on time
• Dispose of materials only at licensed and permitted facilities
• Provide accurate weight tickets and manifests as required by law
• Not subcontract jobs without prior written consent of the Customer
• Comply with all environmental regulations regarding material disposal

Providers acknowledge that HaulBrokr may verify credentials, insurance, and licensing at any time and may suspend accounts for non-compliance.`,
  },
  {
    id: "6",
    title: "6. Bidding & Job Awards",
    body: `Providers submit bids for posted jobs through the HaulBrokr platform. Bid submission does not guarantee job award. Customers retain sole discretion to accept, reject, or counter any bid.

Once a Customer accepts a bid, both parties enter into a binding service agreement. Providers who accept a job and subsequently cancel without legitimate cause (e.g., equipment failure, documented emergency) may be subject to cancellation fees and/or account penalties.

Customers who cancel an accepted bid within 24 hours of the scheduled job start time may be charged a cancellation fee equal to 15% of the estimated job value, unless cancellation results from Provider non-performance.`,
  },
  {
    id: "7",
    title: "7. Payments & Fees",
    body: `HaulBrokr charges a platform service fee on each completed transaction. The current fee schedule is:

• Customer platform fee: 8% of total job value
• Provider platform fee: 5% of total job value

Fees are subject to change with 30 days' notice. Payment is processed via the secured payment method on file. Providers receive payment within 3–5 business days after job completion and Customer confirmation.

Disputed jobs may have payments held pending resolution. The Company is not responsible for disputes arising from disagreements over quantity, quality, or scope of work — those disputes are between Customer and Provider.`,
  },
  {
    id: "8",
    title: "8. Prohibited Activities",
    body: `You agree not to use HaulBrokr to:

• Post or accept jobs involving illegal dumping or disposal
• Haul or dispose of hazardous waste, asbestos, polychlorinated biphenyls (PCBs), radioactive materials, or other regulated substances without proper licensing and disclosure
• Circumvent platform payments by soliciting off-platform transactions
• Create multiple accounts to manipulate ratings or reviews
• Engage in fraudulent bidding, including bid manipulation or collusion
• Harass, threaten, or defame other users on the platform
• Access or attempt to access another user's account

Violation of these prohibitions may result in immediate account termination, reporting to regulatory authorities, and/or legal action.`,
  },
  {
    id: "9",
    title: "9. Limitation of Liability",
    body: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, HAULBROKR LLC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE APP OR ANY SERVICES ARRANGED THROUGH THE PLATFORM.

HaulBrokr's total aggregate liability for any claim relating to the App or services shall not exceed the greater of (a) the total fees paid by you to HaulBrokr in the 12 months preceding the claim, or (b) $500.00.

The Company does not guarantee the accuracy, completeness, or availability of the platform at all times and is not liable for outages, data loss, or service interruptions.`,
  },
  {
    id: "10",
    title: "10. Dispute Resolution",
    body: `Any dispute, controversy, or claim arising out of or relating to these Terms or the App shall be resolved by binding arbitration administered by the American Arbitration Association ("AAA") under its Commercial Arbitration Rules.

Arbitration shall take place in Dallas County, Texas. Judgment on the arbitration award may be entered in any court of competent jurisdiction. You waive any right to a jury trial and any right to participate in class action litigation.

Notwithstanding the foregoing, either party may seek injunctive or other equitable relief in a court of competent jurisdiction to prevent irreparable harm pending arbitration.`,
  },
  {
    id: "11",
    title: "11. Governing Law",
    body: `These Terms are governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of law provisions. Any legal proceedings not subject to arbitration shall be brought exclusively in the state or federal courts located in Dallas County, Texas.`,
  },
  {
    id: "12",
    title: "12. Contact & Effective Date",
    body: `If you have questions about these Terms, contact us at:

HaulBrokr LLC
Legal Department
legal@haulbrokr.com
(214) 555-0100
Dallas, Texas 75201

Effective Date: January 1, 2026
Last Updated: May 1, 2026`,
  },
];

export default function TermsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>("1");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

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
          Terms of Service
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Intro banner */}
      <View
        style={[
          styles.banner,
          {
            backgroundColor: colors.primary + "18",
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Feather name="file-text" size={16} color={colors.primary} />
        <Text
          style={[
            styles.bannerText,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          Please read these terms carefully before using HaulBrokr.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 60 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section) => {
          const open = expanded === section.id;
          return (
            <View
              key={section.id}
              style={[styles.section, { borderColor: colors.border }]}
            >
              <Pressable
                onPress={() => setExpanded(open ? null : section.id)}
                style={[
                  styles.sectionHeader,
                  {
                    backgroundColor: open ? colors.primary + "10" : colors.card,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color: open ? colors.primary : colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
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
                <View
                  style={[styles.sectionBody, { backgroundColor: colors.card }]}
                >
                  <Text
                    style={[
                      styles.bodyText,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    flex: 1,
    textAlign: "center",
  },
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600" as const,
    flex: 1,
    lineHeight: 20,
  },
  sectionBody: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: "transparent",
  },
  bodyText: { fontSize: 14, lineHeight: 22 },
});
