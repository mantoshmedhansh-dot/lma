import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store/auth';
import { useThemeColors } from '@/hooks/useThemeColor';

export default function ProfileScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { driver, signOut, loading } = useAuthStore();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  if (!driver) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  const vehicleIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    bike: 'bicycle',
    scooter: 'bicycle',
    car: 'car',
  };

  const menuItems = [
    {
      icon: 'document-text-outline' as const,
      label: 'Documents',
      onPress: () => Alert.alert('Coming Soon', 'Document management will be available soon.'),
    },
    {
      icon: 'card-outline' as const,
      label: 'Payment Methods',
      onPress: () => Alert.alert('Coming Soon', 'Payment methods will be available soon.'),
    },
    {
      icon: 'notifications-outline' as const,
      label: 'Notifications',
      onPress: () => Alert.alert('Coming Soon', 'Notification settings will be available soon.'),
    },
    {
      icon: 'help-circle-outline' as const,
      label: 'Help & Support',
      onPress: () => Alert.alert('Coming Soon', 'Help center will be available soon.'),
    },
    {
      icon: 'shield-checkmark-outline' as const,
      label: 'Privacy Policy',
      onPress: () => Alert.alert('Privacy Policy', 'Our privacy policy protects your data.'),
    },
    {
      icon: 'document-outline' as const,
      label: 'Terms of Service',
      onPress: () => Alert.alert('Terms of Service', 'By using this app, you agree to our terms.'),
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Profile Header */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatarContainer, { backgroundColor: colors.tintLight }]}>
          <Text style={[styles.avatarText, { color: colors.tint }]}>
            {driver.full_name?.charAt(0)?.toUpperCase() || 'D'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.text }]}>
            {driver.full_name}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
            {driver.email}
          </Text>
          <View style={styles.profileStats}>
            <View style={styles.profileStat}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={[styles.statText, { color: colors.text }]}>
                {driver.rating?.toFixed(1) || '0.0'}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.profileStat}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={[styles.statText, { color: colors.text }]}>
                {driver.total_deliveries || 0} deliveries
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Vehicle Info */}
      <View style={[styles.vehicleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.vehicleHeader}>
          <Ionicons
            name={vehicleIcons[driver.vehicle_type] || 'bicycle'}
            size={24}
            color={colors.tint}
          />
          <Text style={[styles.vehicleTitle, { color: colors.text }]}>
            Vehicle Details
          </Text>
        </View>
        <View style={styles.vehicleDetails}>
          <View style={styles.vehicleRow}>
            <Text style={[styles.vehicleLabel, { color: colors.textSecondary }]}>
              Type
            </Text>
            <Text style={[styles.vehicleValue, { color: colors.text }]}>
              {driver.vehicle_type?.charAt(0).toUpperCase() + driver.vehicle_type?.slice(1)}
            </Text>
          </View>
          <View style={styles.vehicleRow}>
            <Text style={[styles.vehicleLabel, { color: colors.textSecondary }]}>
              Number
            </Text>
            <Text style={[styles.vehicleValue, { color: colors.text }]}>
              {driver.vehicle_number}
            </Text>
          </View>
          <View style={styles.vehicleRow}>
            <Text style={[styles.vehicleLabel, { color: colors.textSecondary }]}>
              License
            </Text>
            <Text style={[styles.vehicleValue, { color: colors.text }]}>
              {driver.license_number}
            </Text>
          </View>
        </View>
      </View>

      {/* Account Status */}
      <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statusRow}>
          <Text style={[styles.statusLabel, { color: colors.text }]}>
            Account Status
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  driver.status === 'approved'
                    ? '#D1FAE5'
                    : driver.status === 'pending'
                    ? '#FEF3C7'
                    : '#FEE2E2',
              },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                {
                  color:
                    driver.status === 'approved'
                      ? '#059669'
                      : driver.status === 'pending'
                      ? '#D97706'
                      : '#DC2626',
                },
              ]}
            >
              {driver.status?.charAt(0).toUpperCase() + driver.status?.slice(1)}
            </Text>
          </View>
        </View>
        {driver.status === 'pending' && (
          <Text style={[styles.statusNote, { color: colors.textSecondary }]}>
            Your account is being reviewed. You'll be notified once approved.
          </Text>
        )}
      </View>

      {/* Menu Items */}
      <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[
              styles.menuItem,
              index < menuItems.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              },
            ]}
            onPress={item.onPress}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name={item.icon} size={22} color={colors.textSecondary} />
              <Text style={[styles.menuItemLabel, { color: colors.text }]}>
                {item.label}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={[styles.signOutButton, { borderColor: colors.error }]}
        onPress={handleSignOut}
        disabled={loading}
      >
        <Ionicons name="log-out-outline" size={22} color={colors.error} />
        <Text style={[styles.signOutText, { color: colors.error }]}>
          {loading ? 'Signing out...' : 'Sign Out'}
        </Text>
      </TouchableOpacity>

      {/* Version */}
      <Text style={[styles.version, { color: colors.textSecondary }]}>
        Version 1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  profileCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  profileStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 12,
  },
  vehicleCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  vehicleTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  vehicleDetails: {
    gap: 12,
  },
  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vehicleLabel: {
    fontSize: 14,
  },
  vehicleValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusNote: {
    fontSize: 12,
    marginTop: 8,
  },
  menuCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemLabel: {
    fontSize: 15,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 16,
  },
});
