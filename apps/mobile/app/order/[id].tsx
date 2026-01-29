import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useOrdersStore } from '@/lib/store/orders';
import { useThemeColors } from '@/hooks/useThemeColor';

const statusConfig: Record<string, { label: string; color: string; icon: string; description: string }> = {
  pending: {
    label: 'Order Placed',
    color: '#F59E0B',
    icon: 'time-outline',
    description: 'Waiting for restaurant confirmation',
  },
  confirmed: {
    label: 'Confirmed',
    color: '#3B82F6',
    icon: 'checkmark-circle-outline',
    description: 'Restaurant has confirmed your order',
  },
  preparing: {
    label: 'Preparing',
    color: '#8B5CF6',
    icon: 'restaurant-outline',
    description: 'Your food is being prepared',
  },
  ready: {
    label: 'Ready for Pickup',
    color: '#10B981',
    icon: 'bag-check-outline',
    description: 'Your order is ready for pickup',
  },
  picked_up: {
    label: 'On the Way',
    color: '#6366F1',
    icon: 'bicycle-outline',
    description: 'Driver is on the way',
  },
  delivered: {
    label: 'Delivered',
    color: '#22C55E',
    icon: 'checkmark-done-outline',
    description: 'Your order has been delivered',
  },
  cancelled: {
    label: 'Cancelled',
    color: '#EF4444',
    icon: 'close-circle-outline',
    description: 'Your order was cancelled',
  },
};

const orderFlow = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivered'];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const router = useRouter();
  const { currentOrder, loading, fetchOrderById, subscribeToOrder } = useOrdersStore();

  useEffect(() => {
    if (id) {
      fetchOrderById(id);
      const unsubscribe = subscribeToOrder(id);
      return unsubscribe;
    }
  }, [id]);

  if (!currentOrder) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  const status = statusConfig[currentOrder.status] || statusConfig.pending;
  const currentStatusIndex = orderFlow.indexOf(currentOrder.status);

  const handleCallMerchant = () => {
    if (currentOrder.merchant?.contact_phone) {
      Linking.openURL(`tel:${currentOrder.merchant.contact_phone}`);
    }
  };

  const handleCallDriver = () => {
    if (currentOrder.driver?.phone) {
      Linking.openURL(`tel:${currentOrder.driver.phone}`);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Status Card */}
      <View style={[styles.statusCard, { backgroundColor: status.color }]}>
        <View style={styles.statusIconContainer}>
          <Ionicons name={status.icon as any} size={48} color="#FFFFFF" />
        </View>
        <Text style={styles.statusLabel}>{status.label}</Text>
        <Text style={styles.statusDescription}>{status.description}</Text>
      </View>

      {/* Order Progress */}
      {currentOrder.status !== 'cancelled' && (
        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {orderFlow.map((step, index) => {
            const stepStatus = statusConfig[step];
            const isCompleted = index <= currentStatusIndex;
            const isActive = index === currentStatusIndex;

            return (
              <View key={step} style={styles.progressItem}>
                <View style={styles.progressLeft}>
                  <View
                    style={[
                      styles.progressDot,
                      {
                        backgroundColor: isCompleted ? stepStatus.color : colors.border,
                        borderWidth: isActive ? 3 : 0,
                        borderColor: stepStatus.color,
                      },
                    ]}
                  >
                    {isCompleted && !isActive && (
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    )}
                  </View>
                  {index < orderFlow.length - 1 && (
                    <View
                      style={[
                        styles.progressLine,
                        { backgroundColor: isCompleted ? stepStatus.color : colors.border },
                      ]}
                    />
                  )}
                </View>
                <View style={styles.progressInfo}>
                  <Text
                    style={[
                      styles.progressLabel,
                      { color: isCompleted ? colors.text : colors.textSecondary },
                    ]}
                  >
                    {stepStatus.label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Driver Info */}
      {currentOrder.driver && ['picked_up', 'delivered'].includes(currentOrder.status) && (
        <View style={[styles.driverCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.driverInfo}>
            <View style={[styles.driverAvatar, { backgroundColor: colors.tintLight }]}>
              <Ionicons name="person" size={24} color={colors.tint} />
            </View>
            <View>
              <Text style={[styles.driverName, { color: colors.text }]}>
                {currentOrder.driver.full_name}
              </Text>
              <Text style={[styles.driverLabel, { color: colors.textSecondary }]}>
                Your Delivery Partner
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.callButton, { backgroundColor: colors.tintLight }]}
            onPress={handleCallDriver}
          >
            <Ionicons name="call" size={20} color={colors.tint} />
          </TouchableOpacity>
        </View>
      )}

      {/* Restaurant Info */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.restaurantInfo}>
            {currentOrder.merchant?.logo_url ? (
              <Image
                source={{ uri: currentOrder.merchant.logo_url }}
                style={styles.restaurantLogo}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.restaurantLogoPlaceholder, { backgroundColor: colors.tintLight }]}>
                <Ionicons name="storefront" size={20} color={colors.tint} />
              </View>
            )}
            <Text style={[styles.restaurantName, { color: colors.text }]}>
              {currentOrder.merchant?.name}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.callButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={handleCallMerchant}
          >
            <Ionicons name="call" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Delivery Address */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="location" size={20} color={colors.tint} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Delivery Address</Text>
        </View>
        <Text style={[styles.addressText, { color: colors.textSecondary }]}>
          {currentOrder.delivery_address?.street}, {currentOrder.delivery_address?.city},{' '}
          {currentOrder.delivery_address?.state} {currentOrder.delivery_address?.postal_code}
        </Text>
        {currentOrder.delivery_instructions && (
          <Text style={[styles.instructions, { color: colors.textSecondary }]}>
            Note: {currentOrder.delivery_instructions}
          </Text>
        )}
      </View>

      {/* Order Items */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="receipt-outline" size={20} color={colors.tint} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Order Items</Text>
        </View>
        {currentOrder.items?.map((item) => (
          <View key={item.id} style={styles.orderItem}>
            <Text style={[styles.itemName, { color: colors.text }]}>
              {item.quantity}x {item.product?.name}
            </Text>
            <Text style={[styles.itemPrice, { color: colors.text }]}>
              ₹{(item.unit_price * item.quantity).toFixed(2)}
            </Text>
          </View>
        ))}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Subtotal</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            ₹{currentOrder.subtotal?.toFixed(2)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Delivery Fee</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            ₹{currentOrder.delivery_fee?.toFixed(2)}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryRow}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>
            ₹{currentOrder.total_amount?.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Order Info */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Order Number</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>#{currentOrder.order_number}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Placed on</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {new Date(currentOrder.created_at).toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Back to Home */}
      <TouchableOpacity
        style={[styles.backButton, { borderColor: colors.border }]}
        onPress={() => router.replace('/(tabs)/home')}
      >
        <Ionicons name="home-outline" size={20} color={colors.text} />
        <Text style={[styles.backButtonText, { color: colors.text }]}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
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
  content: {
    padding: 16,
    gap: 16,
  },
  statusCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  statusIconContainer: {
    marginBottom: 12,
  },
  statusLabel: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 4,
  },
  progressCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  progressLeft: {
    alignItems: 'center',
    width: 24,
  },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressLine: {
    width: 2,
    height: 24,
    marginVertical: 4,
  },
  progressInfo: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
  },
  driverLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  restaurantLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  restaurantLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
  },
  instructions: {
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 14,
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
