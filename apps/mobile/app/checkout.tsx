import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/store/auth';
import { useCartStore } from '@/lib/store/cart';
import { useOrdersStore } from '@/lib/store/orders';
import { useThemeColors } from '@/hooks/useThemeColor';

export default function CheckoutScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { user } = useAuthStore();
  const { items, merchant, getSubtotal, getTotal, clearCart } = useCartStore();
  const { addresses, defaultAddress, fetchAddresses, createOrder } = useOrdersStore();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [loading, setLoading] = useState(false);

  const subtotal = getSubtotal();
  const total = getTotal();
  const deliveryFee = merchant?.delivery_fee || 0;

  useEffect(() => {
    if (user) {
      fetchAddresses(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    if (defaultAddress) {
      setSelectedAddress(defaultAddress.id);
    }
  }, [defaultAddress]);

  const handlePlaceOrder = async () => {
    if (!user || !merchant || !selectedAddress) {
      Alert.alert('Error', 'Please select a delivery address');
      return;
    }

    if (merchant.minimum_order > subtotal) {
      Alert.alert(
        'Minimum Order',
        `Minimum order amount is ₹${merchant.minimum_order}. Please add more items.`
      );
      return;
    }

    setLoading(true);

    const { orderId, error } = await createOrder({
      userId: user.id,
      merchantId: merchant.id,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
      addressId: selectedAddress,
      deliveryInstructions,
      subtotal,
      deliveryFee,
      total,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    clearCart();
    router.replace(`/order/${orderId}`);
  };

  if (items.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.text }]}>
          Your cart is empty
        </Text>
        <TouchableOpacity
          style={[styles.browseButton, { backgroundColor: colors.tint }]}
          onPress={() => router.replace('/(tabs)/home')}
        >
          <Text style={styles.browseButtonText}>Browse Restaurants</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Delivery Address */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color={colors.tint} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Delivery Address
            </Text>
          </View>

          {addresses.length === 0 ? (
            <TouchableOpacity
              style={[styles.addAddressButton, { borderColor: colors.tint }]}
              onPress={() => Alert.alert('Coming Soon', 'Address management will be available soon.')}
            >
              <Ionicons name="add" size={20} color={colors.tint} />
              <Text style={[styles.addAddressText, { color: colors.tint }]}>
                Add New Address
              </Text>
            </TouchableOpacity>
          ) : (
            addresses.map((address) => (
              <TouchableOpacity
                key={address.id}
                style={[
                  styles.addressCard,
                  {
                    borderColor: selectedAddress === address.id ? colors.tint : colors.border,
                    backgroundColor: selectedAddress === address.id ? colors.tintLight : 'transparent',
                  },
                ]}
                onPress={() => setSelectedAddress(address.id)}
              >
                <View style={styles.addressRadio}>
                  <View
                    style={[
                      styles.radioOuter,
                      { borderColor: selectedAddress === address.id ? colors.tint : colors.border },
                    ]}
                  >
                    {selectedAddress === address.id && (
                      <View style={[styles.radioInner, { backgroundColor: colors.tint }]} />
                    )}
                  </View>
                </View>
                <View style={styles.addressInfo}>
                  <View style={styles.addressLabelRow}>
                    <Text style={[styles.addressLabel, { color: colors.text }]}>
                      {address.label}
                    </Text>
                    {address.is_default && (
                      <View style={[styles.defaultBadge, { backgroundColor: colors.tintLight }]}>
                        <Text style={[styles.defaultText, { color: colors.tint }]}>
                          Default
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.addressText, { color: colors.textSecondary }]}>
                    {address.street}, {address.city}, {address.state} {address.postal_code}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Delivery Instructions */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={20} color={colors.tint} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Delivery Instructions
            </Text>
          </View>
          <TextInput
            style={[
              styles.instructionsInput,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary },
            ]}
            placeholder="Add any special instructions..."
            placeholderTextColor={colors.textSecondary}
            value={deliveryInstructions}
            onChangeText={setDeliveryInstructions}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Order Summary */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="receipt-outline" size={20} color={colors.tint} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Order Summary
            </Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.summaryItem}>
              <Text style={[styles.summaryItemName, { color: colors.text }]}>
                {item.quantity}x {item.name}
              </Text>
              <Text style={[styles.summaryItemPrice, { color: colors.text }]}>
                ₹{(item.price * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Subtotal</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>₹{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Delivery Fee</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>₹{deliveryFee.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>₹{total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Place Order Button */}
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            { backgroundColor: loading || !selectedAddress ? colors.textSecondary : colors.tint },
          ]}
          onPress={handlePlaceOrder}
          disabled={loading || !selectedAddress}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.placeOrderText}>Place Order</Text>
              <Text style={styles.placeOrderTotal}>₹{total.toFixed(2)}</Text>
            </>
          )}
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
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 16,
  },
  browseButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  addAddressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  addressCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  addressRadio: {
    paddingTop: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultText: {
    fontSize: 10,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  instructionsInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryItemName: {
    fontSize: 14,
    flex: 1,
  },
  summaryItemPrice: {
    fontSize: 14,
  },
  summaryDivider: {
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
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  placeOrderButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  placeOrderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  placeOrderTotal: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
