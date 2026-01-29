import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMerchantsStore } from '@/lib/store/merchants';
import { useThemeColors } from '@/hooks/useThemeColor';

export default function SearchScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const {
    searchQuery,
    searchResults,
    merchants,
    loading,
    setSearchQuery,
    searchMerchants,
  } = useMerchantsStore();
  const [localQuery, setLocalQuery] = useState(searchQuery);

  // Filter by type if provided
  const filteredMerchants = params.type
    ? merchants.filter((m) => m.type === params.type)
    : searchResults.length > 0
    ? searchResults
    : merchants;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== searchQuery) {
        setSearchQuery(localQuery);
        searchMerchants(localQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localQuery]);

  const renderMerchant = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.merchantCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/merchant/${item.slug}`)}
    >
      <View style={styles.merchantImage}>
        {item.logo_url ? (
          <Image
            source={{ uri: item.logo_url }}
            style={styles.merchantImageInner}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.merchantPlaceholder, { backgroundColor: colors.tintLight }]}>
            <Ionicons name="storefront" size={24} color={colors.tint} />
          </View>
        )}
      </View>
      <View style={styles.merchantInfo}>
        <Text style={[styles.merchantName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.merchantMeta}>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <Text style={[styles.rating, { color: colors.text }]}>
            {item.rating?.toFixed(1) || '0.0'}
          </Text>
          <Text style={[styles.dot, { color: colors.textSecondary }]}>•</Text>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {item.type}
          </Text>
        </View>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {item.preparation_time} min • ₹{item.delivery_fee} delivery
        </Text>
      </View>
      {!item.is_open && (
        <View style={[styles.closedBadge, { backgroundColor: colors.error }]}>
          <Text style={styles.closedText}>Closed</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search restaurants, cuisines..."
            placeholderTextColor={colors.textSecondary}
            value={localQuery}
            onChangeText={setLocalQuery}
            autoFocus
            returnKeyType="search"
          />
          {localQuery.length > 0 && (
            <TouchableOpacity onPress={() => setLocalQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : (
        <FlatList
          data={filteredMerchants}
          renderItem={renderMerchant}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {localQuery ? 'No results found' : 'Search for restaurants'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {localQuery
                  ? 'Try a different search term'
                  : 'Find your favorite restaurants and cuisines'}
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  merchantCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  merchantImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
  },
  merchantImageInner: {
    width: '100%',
    height: '100%',
  },
  merchantPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  merchantName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  merchantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  rating: {
    fontSize: 12,
    fontWeight: '500',
  },
  dot: {
    fontSize: 8,
  },
  metaText: {
    fontSize: 12,
  },
  closedBadge: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  closedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
