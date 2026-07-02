import React, { type ReactNode } from "react";
import { Modal as RNModal, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { spacing } from "@workspace/design-tokens";

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ visible, onClose, children }: ModalProps) {
  const colors = useColors();
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <View style={[styles.content, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {children}
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[4],
  },
  content: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    padding: spacing[4],
  },
});
