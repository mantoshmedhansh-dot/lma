import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useAuthStore } from '@/lib/store/auth';
import {
  useRouteOptimization,
  formatDuration,
  formatDistance,
} from '@/lib/hooks/useRouteOptimization';

interface Stop {
  sequence: number;
  location: {
    id: string;
    type: 'pickup' | 'delivery';
    address?: string;
  };
  distanceFromPrevious: number;
  durationFromPrevious: number;
  cumulativeDistance: number;
  cumulativeDuration: number;
  estimatedArrival: string;
  orderNumber?: string;
  merchantName?: string;
  customerName?: string;
}

interface RouteData {
  driverLocation: { latitude: number; longitude: number };
  stops: Stop[];
  totalDistance: number;
  totalDuration: number;
  savings: {
    distanceSaved: number;
    timeSaved: number;
    percentageSaved: number;
  };
  orderCount: number;
}

export default function RouteScreen() {
  const colors = useThemeColors();
  const { driver } = useAuthStore();
  const { getMyRoute, loading, error } = useRouteOptimization();

  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const fetchRoute = useCallback(async () => {
    // Request location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationError('Location permission is required for route optimization');
      return;
    }

    const data = await getMyRoute();
    setRouteData(data);
  }, [getMyRoute]);

  useEffect(() => {
    if (driver) {
      fetchRoute();
    }
  }, [driver?.id, fetchRoute]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRoute();
    setRefreshing(false);
  };

  const openInMaps = (stop: Stop) => {
    const { latitude, longitude } = stop.location as { latitude: number; longitude: number };
    const label = stop.location.address || `Stop ${stop.sequence}`;

    const scheme = Platform.select({
      ios: 'maps:',
      android: 'geo:',
    });
    const url = Platform.select({
      ios: `${scheme}?daddr=${latitude},${longitude}&dirflg=d`,
      android: `${scheme}${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
    });

    if (url) {
      Linking.openURL(url);
    }
  };

  const renderStopIcon = (type: 'pickup' | 'delivery') => {
    return type === 'pickup' ? (
      <View style={[styles.stopIcon, { backgroundColor: colors.tintLight }]}>
        <Ionicons name="cube" size={16} color={colors.tint} />
      </View>
    ) : (
      <View style={[styles.stopIcon, { backgroundColor: '#DCFCE7' }]}>
        <Ionicons name="location" size={16} color="#22C55E" />
      </View>
    );
  };

  if (loading && !routeData) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Optimizing your route...
        </Text>
      </View>
    );
  }

  if (locationError) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="location-outline" size={64} color={colors.textSecondary} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>Location Required</Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{locationError}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.tint }]}
          onPress={fetchRoute}
        >
          <Text style={styles.retryButtonText}>Enable Location</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!routeData || routeData.stops.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="navigate-outline" size={64} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Active Route</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Accept orders to see your optimized delivery route
        </Text>
        <TouchableOpacity
          style={[styles.refreshButton, { borderColor: colors.tint }]}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={20} color={colors.tint} />
          <Text style={[styles.refreshButtonText, { color: colors.tint }]}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Route Summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.tint }]}>
              {routeData.orderCount}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Orders</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatDistance(routeData.totalDistance)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Distance</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatDuration(routeData.totalDuration)}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Time</Text>
          </View>
        </View>

        {routeData.savings.percentageSaved > 0 && (
          <View style={[styles.savingsBanner, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="leaf" size={16} color="#22C55E" />
            <Text style={styles.savingsText}>
              Route optimized! Saving {formatDistance(routeData.savings.distanceSaved)} (
              {routeData.savings.percentageSaved}%)
            </Text>
          </View>
        )}
      </View>

      {/* Stops List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.stopsContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {routeData.stops.map((stop, index) => (
          <View key={stop.location.id}>
            {/* Connector line */}
            {index > 0 && (
              <View style={styles.connector}>
                <View style={[styles.connectorLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.connectorText, { color: colors.textSecondary }]}>
                  {formatDistance(stop.distanceFromPrevious)} •{' '}
                  {formatDuration(stop.durationFromPrevious)}
                </Text>
              </View>
            )}

            {/* Stop Card */}
            <TouchableOpacity
              style={[styles.stopCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => openInMaps(stop)}
              activeOpacity={0.7}
            >
              <View style={styles.stopHeader}>
                {renderStopIcon(stop.location.type)}
                <View style={styles.stopInfo}>
                  <View style={styles.stopTitleRow}>
                    <Text style={[styles.stopSequence, { color: colors.textSecondary }]}>
                      #{stop.sequence + 1}
                    </Text>
                    <Text
                      style={[
                        styles.stopType,
                        {
                          color: stop.location.type === 'pickup' ? colors.tint : '#22C55E',
                          backgroundColor:
                            stop.location.type === 'pickup' ? colors.tintLight : '#DCFCE7',
                        },
                      ]}
                    >
                      {stop.location.type === 'pickup' ? 'Pickup' : 'Delivery'}
                    </Text>
                  </View>
                  {stop.orderNumber && (
                    <Text style={[styles.orderNumber, { color: colors.text }]}>
                      Order #{stop.orderNumber}
                    </Text>
                  )}
                  {stop.location.type === 'pickup' && stop.merchantName && (
                    <Text style={[styles.merchantName, { color: colors.text }]}>
                      {stop.merchantName}
                    </Text>
                  )}
                  {stop.location.type === 'delivery' && stop.customerName && (
                    <Text style={[styles.customerName, { color: colors.text }]}>
                      {stop.customerName}
                    </Text>
                  )}
                </View>
                <Ionicons name="navigate-outline" size={20} color={colors.tint} />
              </View>

              {stop.location.address && (
                <Text style={[styles.stopAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                  {stop.location.address}
                </Text>
              )}

              <View style={styles.stopFooter}>
                <View style={styles.etaContainer}>
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.etaText, { color: colors.textSecondary }]}>
                    ETA: {new Date(stop.estimatedArrival).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text style={[styles.cumulativeDistance, { color: colors.textSecondary }]}>
                  {formatDistance(stop.cumulativeDistance)} total
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Navigate All Button */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.navigateButton, { backgroundColor: colors.tint }]}
          onPress={() => {
            if (routeData.stops.length > 0) {
              openInMaps(routeData.stops[0]);
            }
          }}
        >
          <Ionicons name="navigate" size={20} color="#FFFFFF" />
          <Text style={styles.navigateButtonText}>Start Navigation</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 24,
    gap: 8,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  summaryCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 40,
  },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  savingsText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  stopsContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  connector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 20,
    height: 40,
  },
  connectorLine: {
    width: 2,
    height: '100%',
  },
  connectorText: {
    marginLeft: 12,
    fontSize: 12,
  },
  stopCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stopIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopInfo: {
    flex: 1,
    gap: 4,
  },
  stopTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stopSequence: {
    fontSize: 12,
    fontWeight: '500',
  },
  stopType: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  merchantName: {
    fontSize: 15,
    fontWeight: '500',
  },
  customerName: {
    fontSize: 15,
  },
  stopAddress: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 52,
  },
  stopFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 52,
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  etaText: {
    fontSize: 12,
  },
  cumulativeDistance: {
    fontSize: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  navigateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
