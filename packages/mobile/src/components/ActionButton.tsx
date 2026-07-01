import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii } from "../theme";

type ActionButtonProps = {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  secondary?: boolean;
  onPress: () => void;
};

export function ActionButton({ label, icon, disabled, destructive, secondary, onPress }: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        destructive && styles.destructive,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon}
      <Text style={[styles.label, secondary && styles.secondaryLabel, destructive && styles.destructiveLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg2,
  },
  destructive: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(239, 107, 107, 0.45)",
    backgroundColor: "rgba(239, 107, 107, 0.12)",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
  },
  label: {
    color: colors.fg,
    fontFamily: "System",
    fontSize: 13,
    fontWeight: "600",
  },
  secondaryLabel: {
    color: colors.muted,
  },
  destructiveLabel: {
    color: colors.error,
  },
});
