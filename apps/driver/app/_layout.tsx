import { useEffect, useRef } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useAuthStore } from "@/lib/store/auth";
import { Colors } from "@/constants/colors";
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from "@/lib/notifications";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const initialize = useAuthStore((state) => state.initialize);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    initialize();
  }, []);

  // Initialize push notifications
  useEffect(() => {
    registerForPushNotifications();

    notificationListener.current = addNotificationReceivedListener(
      (notification) => {
        console.log("Notification received:", notification.request.content);
      },
    );

    responseListener.current = addNotificationResponseListener((response) => {
      console.log(
        "Notification tapped:",
        response.notification.request.content,
      );
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return (
    <>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors[colorScheme].background,
          },
          headerTintColor: Colors[colorScheme].text,
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: Colors[colorScheme].background,
          },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="documents"
          options={{ title: "Documents", headerBackTitle: "Profile" }}
        />
        <Stack.Screen
          name="payment-methods"
          options={{ title: "Payment Methods", headerBackTitle: "Profile" }}
        />
      </Stack>
    </>
  );
}
