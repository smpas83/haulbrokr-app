import React, { type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { spacing } from "@workspace/design-tokens";

export interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Drawer({ visible, onClose, title, children }: DrawerProps) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          {title ? <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text> : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopWidth: 1,
    padding: spacing[4],
    minHeight: 200,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing[3],
  },
});
