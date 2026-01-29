import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMerchantsStore } from '@/lib/store/merchants';
import { useCartStore } from '@/lib/store/cart';
import { useThemeColors } from '@/hooks/useThemeColor';

const { width } = Dimensions.get('window');

export default function MerchantScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentMerchant, currentProducts, loading, fetchMerchantBySlug } = useMerchantsStore();
  const { addItem, getItemCount, merchant: cartMerchant } = useCartStore();
  const cartItemCount = getItemCount();

  useEffect(() => {
    if (slug) {
      fetchMerchantBySlug(slug);
    }
  }, [slug]);

  const handleAddToCart = (product: any) => {
    if (!currentMerchant) return;

    // Check if cart has items from different merchant
    if (cartMerchant && cartMerchant.id !== currentMerchant.id && cartItemCount > 0) {
      Alert.alert(
        'Replace cart?',
        `Your cart has items from ${cartMerchant.name}. Would you like to clear it and add items from ${currentMerchant.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            onPress: () => {
              addItem(product, {
                id: currentMerchant.id,
                name: currentMerchant.name,
                slug: currentMerchant.slug,
                delivery_fee: currentMerchant.delivery_fee,
                minimum_order: currentMerchant.minimum_order,
              });
            },
          },
        ]
      );
      return;
    }

    addItem(product, {
      id: currentMerchant.id,
      name: currentMerchant.name,
      slug: currentMerchant.slug,
      delivery_fee: currentMerchant.delivery_fee,
      minimum_order: currentMerchant.minimum_order,
    });
  };

  if (loading || !currentMerchant) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  // Group products by category
  const productsByCategory = currentProducts.reduce((acc, product) => {
    const categoryId = product.category_id || 'uncategorized';
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(product);
    return acc;
  }, {} as Record<string, typeof currentProducts>);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <View style={styles.coverContainer}>
          {currentMerchant.cover_image_url ? (
            <Image
              source={{ uri: currentMerchant.cover_image_url }}
              style={styles.coverImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: colors.tintLight }]}>
              <Ionicons name="storefront" size={64} color={colors.tint} />
            </View>
          )}
          <View style={[styles.coverOverlay, { paddingTop: insets.top }]}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: colors.background }]}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Merchant Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <View style={styles.infoHeader}>
            <View>
              <Text style={[styles.merchantName, { color: colors.text }]}>
                {currentMerchant.name}
              </Text>
              <Text style={[styles.merchantType, { color: colors.textSecondary }]}>
                {currentMerchant.type}
              </Text>
            </View>
            {!currentMerchant.is_open && (
              <View style={[styles.closedBadge, { backgroundColor: colors.error }]}>
                <Text style={styles.closedText}>Closed</Text>
              </View>
            )}
          </View>

          {currentMerchant.description && (
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {currentMerchant.description}
            </Text>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {currentMerchant.rating?.toFixed(1) || '0.0'}
              </Text>
              <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                ({currentMerchant.total_reviews || 0})
              </Text>
            </View>
            <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {currentMerchant.preparation_time} min
              </Text>
            </View>
            <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
            <View style={styles.metaItem}>
              <Ionicons name="bicycle-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.metaValue, { color: colors.text }]}>
                ₹{currentMerchant.delivery_fee}
              </Text>
            </View>
          </View>

          {currentMerchant.minimum_order > 0 && (
            <Text style={[styles.minimumOrder, { color: colors.textSecondary }]}>
              Minimum order: ₹{currentMerchant.minimum_order}
            </Text>
          )}
        </View>

        {/* Products */}
        <View style={styles.productsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Menu</Text>

          {currentProducts.length === 0 ? (
            <View style={[styles.emptyMenu, { backgroundColor: colors.card }]}>
              <Ionicons name="restaurant-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No items available
              </Text>
            </View>
          ) : (
            Object.entries(productsByCategory).map(([categoryId, products]) => (
              <View key={categoryId} style={styles.categorySection}>
                {categoryId !== 'uncategorized' && (
                  <Text style={[styles.categoryTitle, { color: colors.text }]}>
                    {categoryId}
                  </Text>
                )}
                {products.map((product) => (
                  <View
                    key={product.id}
                    style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.productInfo}>
                      <Text style={[styles.productName, { color: colors.text }]}>
                        {product.name}
                      </Text>
                      {product.description && (
                        <Text
                          style={[styles.productDescription, { color: colors.textSecondary }]}
                          numberOfLines={2}
                        >
                          {product.description}
                        </Text>
                      )}
                      <View style={styles.priceRow}>
                        <Text style={[styles.productPrice, { color: colors.text }]}>
                          ₹{product.price}
                        </Text>
                        {product.compare_at_price && (
                          <Text style={[styles.comparePrice, { color: colors.textSecondary }]}>
                            ₹{product.compare_at_price}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.productRight}>
                      {product.image_url ? (
                        <Image
                          source={{ uri: product.image_url }}
                          style={styles.productImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.productImagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                          <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
                        </View>
                      )}
                      <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.tint }]}
                        onPress={() => handleAddToCart(product)}
                        disabled={!product.is_available || !currentMerchant.is_open}
                      >
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Cart Button */}
      {cartItemCount > 0 && cartMerchant?.id === currentMerchant.id && (
        <View style={[styles.cartBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.viewCartButton, { backgroundColor: colors.tint }]}
            onPress={() => router.push('/cart')}
          >
            <View style={styles.cartButtonLeft}>
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
              </View>
              <Text style={styles.viewCartText}>View Cart</Text>
            </View>
            <Text style={styles.viewCartText}>
              ₹{useCartStore.getState().getSubtotal().toFixed(2)}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  coverContainer: {
    height: 200,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    padding: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginTop: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  merchantName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  merchantType: {
    fontSize: 14,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  closedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  closedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    marginTop: 12,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  metaLabel: {
    fontSize: 13,
  },
  metaDivider: {
    width: 1,
    height: 16,
    marginHorizontal: 12,
  },
  minimumOrder: {
    fontSize: 12,
    marginTop: 12,
  },
  productsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyMenu: {
    padding: 48,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  productCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
  },
  productDescription: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '600',
  },
  comparePrice: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  productRight: {
    alignItems: 'center',
    gap: 8,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  productImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBar: {
    padding: 16,
    borderTopWidth: 1,
  },
  viewCartButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  cartButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  viewCartText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
