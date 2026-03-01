import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store/auth';
import { useRouteStore } from '@/lib/store/route';
import { useThemeColors } from '@/hooks/useThemeColor';
import type { RouteStop } from '@/lib/types/route';

type FilterTab = 'all' | 'pending' | 'delivered' | 'failed';

const FILTERS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'failed', label: 'Failed' },
];

export default function StopsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { driver } = useAuthStore();
  const { route, loading, fetchRoute } = useRouteStore();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (driver) fetchRoute();
  }, [driver?.id]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRoute();
    setRefreshing(false);
  }, [fetchRoute]);

  const stops = route?.stops || [];

  const filteredStops = stops.filter((s) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return s.status === 'pending' || s.status === 'arrived';
    return s.status === filter;
  });

  const deliveredCount = stops.filter((s) => s.status === 'delivered').length;
  const failedCount = stops.filter((s) => s.status === 'failed').length;
  const remainingCount = stops.filter((s) => s.status === 'pending' || s.status === 'arrived').length;

  const stopStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return colors.success;
      case 'failed': return colors.error;
      case 'arrived': return '#3B82F6';
      default: return colors.textSecondary;
    }
  };

  const stopStatusBg = (status: string) => {
    switch (status) {
      case 'delivered': return colors.success + '20';
      case 'failed': return colors.error + '20';
      case 'arrived': return '#3B82F620';
      default: return colors.backgroundSecondary;
    }
  };

  const renderStop = ({ item: stop }: { item: RouteStop }) => (
    <TouchableOpacity
      style={[styles.stopCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => {
        if (stop.status === 'pending' || stop.status === 'arrived') {
          router.push(`/delivery/${stop.id}`);
        }
      }}
      disabled={stop.status === 'delivered' || stop.status === 'failed'}
    >
      <View style={[styles.seqBadge, { backgroundColor: stopStatusBg(stop.status) }]}>
        <Text style={[styles.seqText, { color: stopStatusColor(stop.status) }]}>
          {stop.sequence}
        </Text>
      </View>
      <View style={styles.stopInfo}>
        <Text style={[styles.stopName, { color: colors.text }]} numberOfLines={1}>
          {stop.order?.customer_name || 'Unknown Customer'}
        </Text>
        <Text style={[styles.stopAddress, { color: colors.textSecondary }]} numberOfLines={1}>
          {stop.order?.delivery_address || ''}
        </Text>
        <Text style={[styles.stopProduct, { color: colors.textSecondary }]} numberOfLines={1}>
          {stop.order?.product_description || ''}
        </Text>
      </View>
      <View style={styles.stopRight}>
        <View style={[styles.statusTag, { backgroundColor: stopStatusBg(stop.status) }]}>
          <Text style={[styles.statusTagText, { color: stopStatusColor(stop.status) }]}>
            {stop.status === 'arrived' ? 'Arrived' : stop.status.charAt(0).toUpperCase() + stop.status.slice(1)}
          </Text>
        </View>
        {stop.order?.is_cod && (
          <Text style={[styles.codLabel, { color: colors.warning }]}>COD</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterTab,
                {
                  backgroundColor: filter === item.key ? colors.tint : colors.backgroundSecondary,
                  borderColor: filter === item.key ? colors.tint : colors.border,
                },
              ]}
              onPress={() => setFilter(item.key)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: filter === item.key ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Stops List */}
      {!route ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No route assigned
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredStops}
          keyExtractor={(item) => item.id}
          renderItem={renderStop}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No stops match this filter
              </Text>
            </View>
          }
        />
      )}

      {/* Summary Bar */}
      {route && stops.length > 0 && (
        <View style={[styles.summaryBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Text style={[styles.summaryText, { color: colors.text }]}>
            <Text style={{ color: colors.success, fontWeight: '600' }}>{deliveredCount}/{stops.length}</Text>
            {' Delivered'}
            {failedCount > 0 && (
              <Text>
                {'  '}
                <Text style={{ color: colors.error, fontWeight: '600' }}>{failedCount}</Text>
                {' Failed'}
              </Text>
            )}
            {'  '}
            <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{remainingCount}</Text>
            {' Remaining'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterRow: {
    paddingTop: 8,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 60,
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  seqBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqText: {
    fontSize: 15,
    fontWeight: '700',
  },
  stopInfo: {
    flex: 1,
    gap: 2,
  },
  stopName: {
    fontSize: 15,
    fontWeight: '600',
  },
  stopAddress: {
    fontSize: 12,
  },
  stopProduct: {
    fontSize: 12,
  },
  stopRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  codLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  summaryBar: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  summaryText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
