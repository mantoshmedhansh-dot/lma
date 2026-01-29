import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAuthStore } from '@/lib/store/auth';
import { useOrdersStore } from '@/lib/store/orders';
import { useThemeColors } from '@/hooks/useThemeColor';

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Order Placed', color: '#F59E0B', icon: 'time-outline' },
  confirmed: { label: 'Confirmed', color: '#3B82F6', icon: 'checkmark-circle-outline' },
  preparing: { label: 'Preparing', color: '#8B5CF6', icon: 'restaurant-outline' },
  ready: { label: 'Ready', color: '#10B981', icon: 'bag-check-outline' },
  picked_up: { label: 'On the way', color: '#6366F1', icon: 'bicycle-outline' },
  delivered: { label: 'Delivered', color: '#22C55E', icon: 'checkmark-done-outline' },
  cancelled: { label: 'Cancelled', color: '#EF4444', icon: 'close-circle-outline' },
};

export default function OrdersScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { user } = useAuthStore();
  const { orders, loading, fetchOrders } = useOrdersStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchOrders(user.id);
    }
  }, [user?.id]);

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    await fetchOrders(user.id);
    setRefreshing(false);
  };

  const renderOrder = ({ item }: { item: any }) => {
    const status = statusConfig[item.status] || statusConfig.pending;

    return (
      <TouchableOpacity
        style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/order/${item.id}`)}
      >
        <View style={styles.orderHeader}>
          <View style={styles.merchantInfo}>
            {item.merchant?.logo_url ? (
              <Image
                source={{ uri: item.merchant.logo_url }}
                style={styles.merchantLogo}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.merchantLogoPlaceholder, { backgroundColor: colors.tintLight }]}>
                <Ionicons name="storefront" size={20} color={colors.tint} />
              </View>
            )}
            <View>
              <Text style={[styles.merchantName, { color: colors.text }]}>
                {item.merchant?.name || 'Restaurant'}
              </Text>
              <Text style={[styles.orderNumber, { color: colors.textSecondary }]}>
                Order #{item.order_number}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
            <Ionicons name={status.icon as any} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.orderFooter}>
          <View>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              Total
            </Text>
            <Text style={[styles.totalAmount, { color: colors.text }]}>
              ₹{item.total_amount?.toFixed(2)}
            </Text>
          </View>
          <View style={styles.dateContainer}>
            <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && orders.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.tintLight }]}>
              <Ionicons name="receipt-outline" size={48} color={colors.tint} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No orders yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              When you place an order, it will appear here
            </Text>
            <TouchableOpacity
              style={[styles.browseButton, { backgroundColor: colors.tint }]}
              onPress={() => router.push('/(tabs)/home')}
            >
              <Text style={styles.browseButtonText}>Browse Restaurants</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
  },
  list: {
    padding: 16,
    gap: 12,
  },
  orderCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  merchantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  merchantLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  merchantLogoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantName: {
    fontSize: 15,
    fontWeight: '600',
  },
  orderNumber: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 12,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderDate: {
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  browseButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
