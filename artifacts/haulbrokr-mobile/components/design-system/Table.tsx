import React, { type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { spacing } from "@workspace/design-tokens";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string;
}

export function Table<T>({ columns, data, getRowKey }: TableProps<T>) {
  const colors = useColors();
  return (
    <ScrollView horizontal>
      <View style={[styles.table, { borderColor: colors.border }]}>
        <View style={[styles.row, styles.headerRow, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          {columns.map((col) => (
            <Text key={col.key} style={[styles.cell, styles.headerCell, { color: colors.foreground }]}>
              {col.header}
            </Text>
          ))}
        </View>
        {data.map((row) => (
          <View key={getRowKey(row)} style={[styles.row, { borderColor: colors.border }]}>
            {columns.map((col) => (
              <View key={col.key} style={styles.cell}>
                {typeof col.render(row) === "string" || typeof col.render(row) === "number" ? (
                  <Text style={{ color: colors.foreground }}>{col.render(row)}</Text>
                ) : (
                  col.render(row)
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  headerRow: {},
  cell: {
    minWidth: 120,
    padding: spacing[3],
  },
  headerCell: {
    fontWeight: "600",
    fontSize: 12,
  },
});
