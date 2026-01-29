import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store/auth';
import { useThemeColors } from '@/hooks/useThemeColor';

export default function Index() {
  const router = useRouter();
  const colors = useThemeColors();
  const { initialized, user, driver } = useAuthStore();

  useEffect(() => {
    if (!initialized) return;

    if (user && driver) {
      router.replace('/(tabs)/home');
    } else {
      router.replace('/(auth)/login');
    }
  }, [initialized, user, driver]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
