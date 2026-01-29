import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCartStore } from '@/lib/store/cart';
import { useThemeColors } from '@/hooks/useThemeColor';

export default function CartScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const {
    items,
    merchant,
    updateQuantity,
    removeItem,
    clearCart,
    getSubtotal,
    getTotal,
  } = useCartStore();

  const subtotal = getSubtotal();
  const total = getTotal();
  const deliveryFee = merchant?.delivery_fee || 0;

  if (items.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.tintLight }]}>
          <Ionicons name="cart-outline" size={64} color={colors.tint} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          Your cart is empty
        </Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Add items from a restaurant to get started
        </Text>
        <TouchableOpacity
          style={[styles.browseButton, { backgroundColor: colors.tint }]}
          onPress={() => router.back()}
        >
          <Text style={styles.browseButtonText}>Browse Restaurants</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Restaurant Info */}
        {merchant && (
          <TouchableOpacity
            style={[styles.merchantCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/merchant/${merchant.slug}`)}
          >
            <Ionicons name="storefront" size={24} color={colors.tint} />
            <View style={styles.merchantInfo}>
              <Text style={[styles.merchantName, { color: colors.text }]}>
                {merchant.name}
              </Text>
              <Text style={[styles.addMoreText, { color: colors.tint }]}>
                Add more items
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Cart Items */}
        <View style={[styles.itemsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {items.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.cartItem,
                index < items.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.itemImage}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.itemImagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                  <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: colors.text }]}>
                  {item.name}
                </Text>
                <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
                  ₹{item.price}
                </Text>
              </View>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={[styles.quantityButton, { borderColor: colors.border }]}
                  onPress={() => updateQuantity(item.productId, item.quantity - 1)}
                >
                  <Ionicons
                    name={item.quantity === 1 ? 'trash-outline' : 'remove'}
                    size={16}
                    color={item.quantity === 1 ? colors.error : colors.text}
                  />
                </TouchableOpacity>
                <Text style={[styles.quantity, { color: colors.text }]}>
                  {item.quantity}
                </Text>
                <TouchableOpacity
                  style={[styles.quantityButton, { borderColor: colors.border }]}
                  onPress={() => updateQuantity(item.productId, item.quantity + 1)}
                >
                  <Ionicons name="add" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Bill Details */}
        <View style={[styles.billCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.billTitle, { color: colors.text }]}>Bill Details</Text>
          <View style={styles.billRow}>
            <Text style={[styles.billLabel, { color: colors.textSecondary }]}>Subtotal</Text>
            <Text style={[styles.billValue, { color: colors.text }]}>₹{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={[styles.billLabel, { color: colors.textSecondary }]}>Delivery Fee</Text>
            <Text style={[styles.billValue, { color: colors.text }]}>₹{deliveryFee.toFixed(2)}</Text>
          </View>
          <View style={[styles.billDivider, { backgroundColor: colors.border }]} />
          <View style={styles.billRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>₹{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Clear Cart */}
        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearCart}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={[styles.clearButtonText, { color: colors.error }]}>
            Clear Cart
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Checkout Button */}
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <View style={styles.footerInfo}>
          <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>Total</Text>
          <Text style={[styles.footerTotal, { color: colors.text }]}>₹{total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButton, { backgroundColor: colors.tint }]}
          onPress={() => router.push('/checkout')}
        >
          <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
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
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
  content: {
    flex: 1,
    padding: 16,
  },
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  merchantInfo: {
    flex: 1,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '600',
  },
  addMoreText: {
    fontSize: 13,
    marginTop: 2,
  },
  itemsCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  itemImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemPrice: {
    fontSize: 13,
    marginTop: 4,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 20,
    textAlign: 'center',
  },
  billCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  billLabel: {
    fontSize: 14,
  },
  billValue: {
    fontSize: 14,
  },
  billDivider: {
    height: 1,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
  },
  footerInfo: {},
  footerLabel: {
    fontSize: 12,
  },
  footerTotal: {
    fontSize: 18,
    fontWeight: '600',
  },
  checkoutButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
