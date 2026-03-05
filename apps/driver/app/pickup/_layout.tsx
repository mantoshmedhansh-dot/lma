import { Stack } from "expo-router";
import { useThemeColors } from "@/hooks/useThemeColor";

export default function PickupLayout() {
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: "600",
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="[pickupId]"
        options={{
          title: "Complete Pickup",
          presentation: "modal",
        }}
      />
    </Stack>
  );
}
