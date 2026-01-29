import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  FlatList,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMerchantsStore } from '@/lib/store/merchants';
import { useCartStore } from '@/lib/store/cart';
import { useThemeColors } from '@/hooks/useThemeColor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    merchants,
    featuredMerchants,
    categories,
    loading,
    fetchMerchants,
    fetchFeaturedMerchants,
    fetchCategories,
  } = useMerchantsStore();
  const cartItemCount = useCartStore((state) => state.getItemCount());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([
      fetchMerchants(),
      fetchFeaturedMerchants(),
      fetchCategories(),
    ]);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderCategory = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/search?type=${item.id}`)}
    >
      <View style={[styles.categoryIcon, { backgroundColor: colors.tintLight }]}>
        <Ionicons
          name={
            item.id === 'restaurant'
              ? 'restaurant'
              : item.id === 'grocery'
              ? 'cart'
              : item.id === 'pharmacy'
              ? 'medkit'
              : item.id === 'bakery'
              ? 'cafe'
              : item.id === 'cafe'
              ? 'cafe'
              : 'storefront'
          }
          size={24}
          color={colors.tint}
        />
      </View>
      <Text style={[styles.categoryName, { color: colors.text }]} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderMerchant = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.merchantCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/merchant/${item.slug}`)}
    >
      <View style={styles.merchantImage}>
        {item.cover_image_url ? (
          <Image
            source={{ uri: item.cover_image_url }}
            style={styles.merchantImageInner}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.merchantImagePlaceholder, { backgroundColor: colors.tintLight }]}>
            <Ionicons name="storefront" size={32} color={colors.tint} />
          </View>
        )}
        {!item.is_open && (
          <View style={styles.closedBadge}>
            <Text style={styles.closedText}>Closed</Text>
          </View>
        )}
      </View>
      <View style={styles.merchantInfo}>
        <Text style={[styles.merchantName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.merchantMeta}>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={[styles.rating, { color: colors.text }]}>
              {item.rating?.toFixed(1) || '0.0'}
            </Text>
          </View>
          <Text style={[styles.dot, { color: colors.textSecondary }]}>•</Text>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {item.preparation_time} min
          </Text>
          <Text style={[styles.dot, { color: colors.textSecondary }]}>•</Text>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            ₹{item.delivery_fee} delivery
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              Deliver to
            </Text>
            <TouchableOpacity style={styles.locationRow}>
              <Ionicons name="location" size={18} color={colors.tint} />
              <Text style={[styles.location, { color: colors.text }]}>
                Current Location
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.cartButton, { backgroundColor: colors.tintLight }]}
            onPress={() => router.push('/cart')}
          >
            <Ionicons name="cart" size={24} color={colors.tint} />
            {cartItemCount > 0 && (
              <View style={[styles.cartBadge, { backgroundColor: colors.tint }]}>
                <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary }]}
          onPress={() => router.push('/(tabs)/search')}
        >
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <Text style={[styles.searchPlaceholder, { color: colors.textSecondary }]}>
            Search restaurants, groceries...
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Categories */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Categories
          </Text>
          <FlatList
            data={categories}
            renderItem={renderCategory}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          />
        </View>

        {/* Featured */}
        {featuredMerchants.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Featured
            </Text>
            <FlatList
              data={featuredMerchants}
              renderItem={renderMerchant}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.merchantList}
            />
          </View>
        )}

        {/* All Merchants */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            All Restaurants
          </Text>
          {merchants.map((merchant) => (
            <TouchableOpacity
              key={merchant.id}
              style={[styles.merchantRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/merchant/${merchant.slug}`)}
            >
              <View style={styles.merchantRowImage}>
                {merchant.logo_url ? (
                  <Image
                    source={{ uri: merchant.logo_url }}
                    style={styles.merchantRowImageInner}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.merchantRowPlaceholder, { backgroundColor: colors.tintLight }]}>
                    <Ionicons name="storefront" size={24} color={colors.tint} />
                  </View>
                )}
              </View>
              <View style={styles.merchantRowInfo}>
                <Text style={[styles.merchantRowName, { color: colors.text }]}>
                  {merchant.name}
                </Text>
                <View style={styles.merchantMeta}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={[styles.ratingSmall, { color: colors.text }]}>
                    {merchant.rating?.toFixed(1) || '0.0'}
                  </Text>
                  <Text style={[styles.dot, { color: colors.textSecondary }]}>•</Text>
                  <Text style={[styles.metaTextSmall, { color: colors.textSecondary }]}>
                    {merchant.type}
                  </Text>
                </View>
                <Text style={[styles.metaTextSmall, { color: colors.textSecondary }]}>
                  {merchant.preparation_time} min • ₹{merchant.delivery_fee} delivery
                </Text>
              </View>
              {!merchant.is_open && (
                <View style={[styles.closedBadgeSmall, { backgroundColor: colors.error }]}>
                  <Text style={styles.closedTextSmall}>Closed</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 16,
    fontWeight: '600',
  },
  cartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchPlaceholder: {
    fontSize: 15,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryCard: {
    width: 80,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  merchantList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  merchantCard: {
    width: width * 0.7,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  merchantImage: {
    height: 120,
  },
  merchantImageInner: {
    width: '100%',
    height: '100%',
  },
  merchantImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  closedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  merchantInfo: {
    padding: 12,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  merchantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rating: {
    fontSize: 13,
    fontWeight: '500',
  },
  dot: {
    fontSize: 8,
  },
  metaText: {
    fontSize: 13,
  },
  merchantRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  merchantRowImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
  },
  merchantRowImageInner: {
    width: '100%',
    height: '100%',
  },
  merchantRowPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantRowInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  merchantRowName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  ratingSmall: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaTextSmall: {
    fontSize: 12,
  },
  closedBadgeSmall: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  closedTextSmall: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});
