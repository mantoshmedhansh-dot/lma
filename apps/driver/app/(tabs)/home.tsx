import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store/auth';
import { useRouteStore } from '@/lib/store/route';
import { useThemeColors } from '@/hooks/useThemeColor';
import type { RouteStop } from '@/lib/types/route';

export default function HomeScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { driver } = useAuthStore();
  const { route, currentStop, loading, fetchRoute } = useRouteStore();
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (driver) {
      fetchRoute();
    }
  }, [driver?.id]);

  // Auto-refresh every 60s when route is in_progress
  useEffect(() => {
    if (route?.status === 'in_progress') {
      intervalRef.current = setInterval(() => {
        fetchRoute();
      }, 60000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [route?.status]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRoute();
    setRefreshing(false);
  }, [fetchRoute]);

  const openMaps = (stop: RouteStop) => {
    const order = stop.order;
    if (!order) return;
    const { delivery_latitude: lat, delivery_longitude: lng, delivery_address } = order;
    if (lat && lng) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    } else {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(delivery_address)}`,
      );
    }
  };

  const callCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  if (!driver) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  // Status banners
  const isPending = driver.status === 'pending';
  const isSuspended = driver.status === 'suspended';

  // Route stats
  const deliveredCount = route?.stops.filter((s) => s.status === 'delivered').length || 0;
  const failedCount = route?.stops.filter((s) => s.status === 'failed').length || 0;
  const totalStops = route?.stops.length || 0;
  const remainingCount = totalStops - deliveredCount - failedCount;
  const allDone = route && remainingCount === 0;

  // Upcoming stops (next 3 after current)
  const upcomingStops = route?.stops
    .filter((s) => s.status === 'pending' && s.id !== currentStop?.id)
    .slice(0, 3) || [];

  const statusColor = (status: string) => {
    switch (status) {
      case 'planned': return colors.textSecondary;
      case 'assigned': return colors.warning;
      case 'in_progress': return colors.tint;
      case 'completed': return colors.success;
      default: return colors.textSecondary;
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Status Banners */}
      {isPending && (
        <View style={[styles.banner, { backgroundColor: colors.warning }]}>
          <Ionicons name="time-outline" size={20} color="#FFFFFF" />
          <Text style={styles.bannerText}>Your account is pending approval</Text>
        </View>
      )}
      {isSuspended && (
        <View style={[styles.banner, { backgroundColor: colors.error }]}>
          <Ionicons name="alert-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.bannerText}>Your account has been suspended</Text>
        </View>
      )}

      {/* No Route State */}
      {!loading && !route && (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="car-outline" size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No route assigned for today
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Pull down to refresh
          </Text>
        </View>
      )}

      {/* Route Header Card */}
      {route && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.routeHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.routeName, { color: colors.text }]}>
                {route.route_name || 'Today\'s Route'}
              </Text>
              <Text style={[styles.routeDate, { color: colors.textSecondary }]}>
                {new Date(route.route_date).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(route.status) + '20' }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor(route.status) }]}>
                {route.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Vehicle info */}
          {route.vehicle && (
            <View style={styles.vehicleRow}>
              <Ionicons name="car-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.vehicleText, { color: colors.textSecondary }]}>
                {route.vehicle.vehicle_type} - {route.vehicle.plate_number}
              </Text>
            </View>
          )}

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={[styles.progressBar, { backgroundColor: colors.backgroundSecondary }]}>
              {totalStops > 0 && (
                <>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.success,
                        width: `${(deliveredCount / totalStops) * 100}%`,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.error,
                        width: `${(failedCount / totalStops) * 100}%`,
                      },
                    ]}
                  />
                </>
              )}
            </View>
            <View style={styles.progressStats}>
              <Text style={[styles.progressText, { color: colors.success }]}>
                {deliveredCount} delivered
              </Text>
              {failedCount > 0 && (
                <Text style={[styles.progressText, { color: colors.error }]}>
                  {failedCount} failed
                </Text>
              )}
              <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                {remainingCount} remaining
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Current Stop Card */}
      {route && currentStop && !allDone && (
        <View style={[styles.currentStopCard, { backgroundColor: colors.card, borderColor: colors.tint }]}>
          <View style={styles.currentStopHeader}>
            <View style={[styles.stopBadge, { backgroundColor: colors.tint }]}>
              <Text style={styles.stopBadgeText}>Stop #{currentStop.sequence}</Text>
            </View>
            {currentStop.status === 'arrived' && (
              <View style={[styles.arrivedBadge, { backgroundColor: '#3B82F620' }]}>
                <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '600' }}>ARRIVED</Text>
              </View>
            )}
          </View>

          {currentStop.order && (
            <View style={styles.stopDetails}>
              <View style={styles.stopRow}>
                <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.stopCustomerName, { color: colors.text }]}>
                  {currentStop.order.customer_name}
                </Text>
                <TouchableOpacity onPress={() => callCustomer(currentStop.order!.customer_phone)}>
                  <Ionicons name="call-outline" size={20} color={colors.tint} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.stopRow} onPress={() => openMaps(currentStop)}>
                <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.stopAddress, { color: colors.text }]} numberOfLines={2}>
                  {currentStop.order.delivery_address}
                </Text>
                <Ionicons name="open-outline" size={16} color={colors.tint} />
              </TouchableOpacity>

              <View style={styles.stopRow}>
                <Ionicons name="cube-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.stopText, { color: colors.textSecondary }]}>
                  {currentStop.order.product_description}
                </Text>
              </View>

              {currentStop.order.is_cod && (
                <View style={[styles.codTag, { backgroundColor: colors.warning + '20' }]}>
                  <Ionicons name="cash-outline" size={16} color={colors.warning} />
                  <Text style={[styles.codTagText, { color: colors.warning }]}>
                    COD: Rs. {currentStop.order.cod_amount}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.currentStopActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
              onPress={() => openMaps(currentStop)}
            >
              <Ionicons name="navigate" size={20} color={colors.tint} />
              <Text style={[styles.actionButtonText, { color: colors.tint }]}>Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.tint }]}
              onPress={() => router.push(`/delivery/${currentStop.id}`)}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>Start Delivery</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Upcoming Stops */}
      {route && upcomingStops.length > 0 && !allDone && (
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Stops</Text>
          {upcomingStops.map((stop) => (
            <View
              key={stop.id}
              style={[styles.upcomingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.seqBadge, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.seqText, { color: colors.textSecondary }]}>
                  {stop.sequence}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.upcomingName, { color: colors.text }]}>
                  {stop.order?.customer_name || 'Unknown'}
                </Text>
                <Text style={[styles.upcomingAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                  {stop.order?.delivery_address || ''}
                </Text>
              </View>
              {stop.order?.is_cod && (
                <View style={[styles.smallCodTag, { backgroundColor: colors.warning + '20' }]}>
                  <Text style={{ color: colors.warning, fontSize: 10, fontWeight: '600' }}>COD</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Route Complete State */}
      {route && allDone && (
        <View style={[styles.completeCard, { backgroundColor: colors.success + '15', borderColor: colors.success }]}>
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          <Text style={[styles.completeTitle, { color: colors.success }]}>
            All Stops Completed!
          </Text>
          <Text style={[styles.completeStats, { color: colors.text }]}>
            {deliveredCount} delivered{failedCount > 0 ? ` / ${failedCount} failed` : ''}
          </Text>
          <Text style={[styles.completeSubtext, { color: colors.textSecondary }]}>
            Return to the hub to end your route
          </Text>
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
  emptyCard: {
    padding: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  routeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  routeName: {
    fontSize: 18,
    fontWeight: '600',
  },
  routeDate: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleText: {
    fontSize: 13,
  },
  progressSection: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressStats: {
    flexDirection: 'row',
    gap: 12,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
  },
  currentStopCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 14,
  },
  currentStopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stopBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  arrivedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stopDetails: {
    gap: 10,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stopCustomerName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  stopAddress: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  stopText: {
    fontSize: 14,
    flex: 1,
  },
  codTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  codTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  currentStopActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  upcomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
    marginBottom: 8,
  },
  seqBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqText: {
    fontSize: 14,
    fontWeight: '600',
  },
  upcomingName: {
    fontSize: 14,
    fontWeight: '500',
  },
  upcomingAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  smallCodTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  completeCard: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  completeTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  completeStats: {
    fontSize: 16,
    fontWeight: '500',
  },
  completeSubtext: {
    fontSize: 14,
    marginTop: 4,
  },
});
