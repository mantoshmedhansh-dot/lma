import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store/auth';
import { useOrdersStore } from '@/lib/store/orders';
import { useThemeColors } from '@/hooks/useThemeColor';

type Tab = 'active' | 'available' | 'completed';

export default function OrdersScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { driver } = useAuthStore();
  const {
    availableOrders,
    activeOrder,
    completedOrders,
    loading,
    fetchAvailableOrders,
    fetchActiveOrder,
    fetchCompletedOrders,
    acceptOrder,
    updateOrderStatus,
  } = useOrdersStore();
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (driver) {
      fetchData();
    }
  }, [driver?.id]);

  const fetchData = async () => {
    if (!driver) return;
    await Promise.all([
      fetchAvailableOrders(driver.id),
      fetchActiveOrder(driver.id),
      fetchCompletedOrders(driver.id),
    ]);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleAccept = async (orderId: string) => {
    if (!driver) return;
    const { error } = await acceptOrder(orderId, driver.id);
    if (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleCompleteDelivery = (orderId: string) => {
    router.push(`/delivery/${orderId}`);
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'active', label: 'Active', count: activeOrder ? 1 : 0 },
    { key: 'available', label: 'Available', count: availableOrders.length },
    { key: 'completed', label: 'History', count: completedOrders.length },
  ];

  const renderActiveOrder = () => {
    if (!activeOrder) {
      return (
        <View style={[styles.emptyContainer, { backgroundColor: colors.card }]}>
          <Ionicons name="bicycle-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Active Delivery
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Accept an order to start delivering
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.activeOrderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={[styles.orderNumber, { color: colors.tint }]}>
              #{activeOrder.order_number}
            </Text>
            <Text style={[styles.merchantName, { color: colors.text }]}>
              {activeOrder.merchant?.name}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.tintLight }]}>
            <Text style={[styles.statusText, { color: colors.tint }]}>
              {activeOrder.status === 'ready' ? 'Pick Up' : 'Delivering'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.addressSection}>
          <View style={styles.addressRow}>
            <View style={[styles.addressDot, { backgroundColor: colors.tint }]} />
            <View style={styles.addressContent}>
              <Text style={[styles.addressLabel, { color: colors.textSecondary }]}>
                Pickup from
              </Text>
              <Text style={[styles.addressText, { color: colors.text }]}>
                {activeOrder.merchant?.address?.street}
              </Text>
              <TouchableOpacity style={styles.callButton}>
                <Ionicons name="call-outline" size={16} color={colors.tint} />
                <Text style={[styles.callText, { color: colors.tint }]}>
                  Call Merchant
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.addressLine, { backgroundColor: colors.border }]} />

          <View style={styles.addressRow}>
            <View style={[styles.addressDot, { backgroundColor: colors.success }]} />
            <View style={styles.addressContent}>
              <Text style={[styles.addressLabel, { color: colors.textSecondary }]}>
                Deliver to
              </Text>
              <Text style={[styles.addressText, { color: colors.text }]}>
                {activeOrder.delivery_address?.street}, {activeOrder.delivery_address?.city}
              </Text>
              <Text style={[styles.customerName, { color: colors.text }]}>
                {activeOrder.customer?.full_name}
              </Text>
              <TouchableOpacity style={styles.callButton}>
                <Ionicons name="call-outline" size={16} color={colors.tint} />
                <Text style={[styles.callText, { color: colors.tint }]}>
                  Call Customer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {activeOrder.delivery_instructions && (
          <View style={[styles.instructionsBox, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
              {activeOrder.delivery_instructions}
            </Text>
          </View>
        )}

        <View style={styles.orderItems}>
          <Text style={[styles.itemsTitle, { color: colors.text }]}>
            Order Items ({activeOrder.items?.length || 0})
          </Text>
          {activeOrder.items?.map((item) => (
            <Text
              key={item.id}
              style={[styles.itemText, { color: colors.textSecondary }]}
            >
              {item.quantity}x {item.product?.name}
            </Text>
          ))}
        </View>

        <View style={styles.orderFooter}>
          <View>
            <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>
              Delivery Fee
            </Text>
            <Text style={[styles.feeValue, { color: colors.tint }]}>
              ₹{activeOrder.delivery_fee}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.deliverButton, { backgroundColor: colors.success }]}
            onPress={() => handleCompleteDelivery(activeOrder.id)}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.deliverButtonText}>Complete Delivery</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAvailableOrder = ({ item }: { item: any }) => (
    <View style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.orderCardHeader}>
        <View>
          <Text style={[styles.merchantName, { color: colors.text }]}>
            {item.merchant?.name}
          </Text>
          <Text style={[styles.orderTime, { color: colors.textSecondary }]}>
            {new Date(item.created_at).toLocaleTimeString()}
          </Text>
        </View>
        <Text style={[styles.orderFee, { color: colors.tint }]}>
          ₹{item.delivery_fee}
        </Text>
      </View>

      <View style={styles.orderCardDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.delivery_address?.street}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="cube-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>
            {item.items?.length || 0} items • ₹{item.total_amount}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.acceptButton, { backgroundColor: colors.tint }]}
        onPress={() => handleAccept(item.id)}
      >
        <Text style={styles.acceptButtonText}>Accept</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCompletedOrder = ({ item }: { item: any }) => (
    <View style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.orderCardHeader}>
        <View>
          <Text style={[styles.merchantName, { color: colors.text }]}>
            {item.merchant?.name}
          </Text>
          <Text style={[styles.orderTime, { color: colors.textSecondary }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <Text style={[styles.orderFee, { color: colors.success }]}>
          +₹{item.delivery_fee}
        </Text>
      </View>
      <View style={styles.detailRow}>
        <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.delivery_address?.street}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && { borderBottomColor: colors.tint },
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab.key ? colors.tint : colors.textSecondary },
              ]}
            >
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View
                style={[
                  styles.tabBadge,
                  { backgroundColor: activeTab === tab.key ? colors.tint : colors.textSecondary },
                ]}
              >
                <Text style={styles.tabBadgeText}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'active' ? (
        <FlatList
          data={[1]}
          renderItem={renderActiveOrder}
          keyExtractor={() => 'active'}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      ) : activeTab === 'available' ? (
        <FlatList
          data={availableOrders}
          renderItem={renderAvailableOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={[styles.emptyContainer, { backgroundColor: colors.card }]}>
              <Ionicons name="search-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No Orders Available
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Pull to refresh for new orders
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={completedOrders}
          renderItem={renderCompletedOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={[styles.emptyContainer, { backgroundColor: colors.card }]}>
              <Ionicons name="receipt-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No Delivery History
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Completed deliveries will appear here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    padding: 48,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  activeOrderCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  addressSection: {
    gap: 8,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  addressLine: {
    width: 2,
    height: 20,
    marginLeft: 5,
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  customerName: {
    fontSize: 13,
    marginTop: 2,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  callText: {
    fontSize: 13,
    fontWeight: '500',
  },
  instructionsBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  instructionsText: {
    flex: 1,
    fontSize: 13,
  },
  orderItems: {
    gap: 4,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemText: {
    fontSize: 13,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: 12,
  },
  feeValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  deliverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  deliverButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  orderCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderTime: {
    fontSize: 12,
    marginTop: 2,
  },
  orderFee: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  orderCardDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    flex: 1,
  },
  acceptButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
