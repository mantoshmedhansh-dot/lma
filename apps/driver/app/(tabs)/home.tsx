import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '@/lib/store/auth';
import { useOrdersStore } from '@/lib/store/orders';
import { useEarningsStore } from '@/lib/store/earnings';
import { useThemeColors } from '@/hooks/useThemeColor';

export default function HomeScreen() {
  const colors = useThemeColors();
  const { driver, updateOnlineStatus, updateLocation } = useAuthStore();
  const { availableOrders, activeOrder, fetchAvailableOrders, fetchActiveOrder, acceptOrder, subscribeToOrders } =
    useOrdersStore();
  const { todayEarnings, todayDeliveries, fetchEarnings } = useEarningsStore();
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);

  useEffect(() => {
    if (driver) {
      requestLocationPermission();
      fetchData();
      const unsubscribe = subscribeToOrders(driver.id);
      return () => unsubscribe();
    }
  }, [driver?.id]);

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === 'granted');

    if (status === 'granted') {
      startLocationTracking();
    }
  };

  const startLocationTracking = async () => {
    if (!driver?.is_online) return;

    try {
      const location = await Location.getCurrentPositionAsync({});
      await updateLocation(location.coords.latitude, location.coords.longitude);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const fetchData = async () => {
    if (!driver) return;
    await Promise.all([
      fetchAvailableOrders(driver.id),
      fetchActiveOrder(driver.id),
      fetchEarnings(driver.id),
    ]);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleToggleOnline = async (value: boolean) => {
    if (!locationPermission && value) {
      Alert.alert(
        'Location Required',
        'Please enable location access to go online.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: requestLocationPermission },
        ]
      );
      return;
    }

    await updateOnlineStatus(value);
    if (value) {
      startLocationTracking();
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    if (!driver) return;

    const { error } = await acceptOrder(orderId, driver.id);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Order accepted! Navigate to the merchant to pick up.');
    }
  };

  if (!driver) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  const isPending = driver.status === 'pending';
  const isSuspended = driver.status === 'suspended';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Status Banner */}
      {isPending && (
        <View style={[styles.banner, { backgroundColor: colors.warning }]}>
          <Ionicons name="time-outline" size={20} color="#FFFFFF" />
          <Text style={styles.bannerText}>
            Your account is pending approval
          </Text>
        </View>
      )}

      {isSuspended && (
        <View style={[styles.banner, { backgroundColor: colors.error }]}>
          <Ionicons name="alert-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.bannerText}>
            Your account has been suspended
          </Text>
        </View>
      )}

      {/* Online Toggle */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.onlineRow}>
          <View>
            <Text style={[styles.onlineLabel, { color: colors.text }]}>
              {driver.is_online ? 'You are Online' : 'You are Offline'}
            </Text>
            <Text style={[styles.onlineSubtext, { color: colors.textSecondary }]}>
              {driver.is_online
                ? 'Receiving delivery requests'
                : 'Go online to receive orders'}
            </Text>
          </View>
          <Switch
            value={driver.is_online}
            onValueChange={handleToggleOnline}
            disabled={isPending || isSuspended}
            trackColor={{ false: colors.border, true: colors.tintLight }}
            thumbColor={driver.is_online ? colors.tint : colors.textSecondary}
          />
        </View>
      </View>

      {/* Today's Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="wallet-outline" size={24} color={colors.tint} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            ₹{todayEarnings.toFixed(0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Today's Earnings
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle-outline" size={24} color={colors.success} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {todayDeliveries}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Deliveries
          </Text>
        </View>
      </View>

      {/* Active Order */}
      {activeOrder && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Active Delivery
            </Text>
            <View style={[styles.badge, { backgroundColor: colors.tintLight }]}>
              <Text style={[styles.badgeText, { color: colors.tint }]}>
                #{activeOrder.order_number}
              </Text>
            </View>
          </View>

          <View style={styles.orderDetails}>
            <View style={styles.orderRow}>
              <Ionicons name="storefront-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.orderText, { color: colors.text }]}>
                {activeOrder.merchant?.name}
              </Text>
            </View>
            <View style={styles.orderRow}>
              <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.orderText, { color: colors.text }]}>
                {activeOrder.delivery_address?.street}, {activeOrder.delivery_address?.city}
              </Text>
            </View>
            <View style={styles.orderRow}>
              <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.orderText, { color: colors.text }]}>
                {activeOrder.customer?.full_name}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.tint }]}
          >
            <Ionicons name="navigate" size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Navigate</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Available Orders */}
      {!activeOrder && driver.is_online && (
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Available Orders ({availableOrders.length})
          </Text>

          {availableOrders.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="bicycle-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No orders available right now
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                New orders will appear here
              </Text>
            </View>
          ) : (
            availableOrders.slice(0, 5).map((order) => (
              <View
                key={order.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.merchantName, { color: colors.text }]}>
                    {order.merchant?.name}
                  </Text>
                  <Text style={[styles.orderFee, { color: colors.tint }]}>
                    ₹{order.delivery_fee}
                  </Text>
                </View>

                <View style={styles.orderDetails}>
                  <View style={styles.orderRow}>
                    <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                    <Text
                      style={[styles.orderText, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {order.delivery_address?.street}
                    </Text>
                  </View>
                  <View style={styles.orderRow}>
                    <Ionicons name="cube-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.orderText, { color: colors.textSecondary }]}>
                      {order.items?.length || 0} items
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.acceptButton, { backgroundColor: colors.tint }]}
                  onPress={() => handleAcceptOrder(order.id)}
                >
                  <Text style={styles.acceptButtonText}>Accept Order</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  bannerText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onlineLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  onlineSubtext: {
    fontSize: 14,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderDetails: {
    gap: 8,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderText: {
    fontSize: 14,
    flex: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '600',
  },
  orderFee: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  acceptButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
