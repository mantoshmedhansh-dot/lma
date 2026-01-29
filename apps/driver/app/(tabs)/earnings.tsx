import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/store/auth';
import { useEarningsStore } from '@/lib/store/earnings';
import { useThemeColors } from '@/hooks/useThemeColor';

const { width } = Dimensions.get('window');

export default function EarningsScreen() {
  const colors = useThemeColors();
  const { driver } = useAuthStore();
  const {
    todayEarnings,
    todayDeliveries,
    weekEarnings,
    weekDeliveries,
    monthEarnings,
    monthDeliveries,
    dailyEarnings,
    loading,
    fetchEarnings,
  } = useEarningsStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (driver) {
      fetchEarnings(driver.id);
    }
  }, [driver?.id]);

  const handleRefresh = async () => {
    if (!driver) return;
    setRefreshing(true);
    await fetchEarnings(driver.id);
    setRefreshing(false);
  };

  const maxDailyEarning = Math.max(...dailyEarnings.map((d) => d.amount), 1);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Today's Summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.tint }]}>
        <Text style={styles.summaryLabel}>Today's Earnings</Text>
        <Text style={styles.summaryAmount}>₹{todayEarnings.toFixed(0)}</Text>
        <View style={styles.summaryDetails}>
          <View style={styles.summaryItem}>
            <Ionicons name="checkmark-circle" size={18} color="rgba(255,255,255,0.8)" />
            <Text style={styles.summaryItemText}>
              {todayDeliveries} deliveries
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="time" size={18} color="rgba(255,255,255,0.8)" />
            <Text style={styles.summaryItemText}>
              ₹{todayDeliveries > 0 ? (todayEarnings / todayDeliveries).toFixed(0) : 0} avg
            </Text>
          </View>
        </View>
      </View>

      {/* Period Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            This Week
          </Text>
          <Text style={[styles.statAmount, { color: colors.text }]}>
            ₹{weekEarnings.toFixed(0)}
          </Text>
          <Text style={[styles.statDeliveries, { color: colors.textSecondary }]}>
            {weekDeliveries} deliveries
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            This Month
          </Text>
          <Text style={[styles.statAmount, { color: colors.text }]}>
            ₹{monthEarnings.toFixed(0)}
          </Text>
          <Text style={[styles.statDeliveries, { color: colors.textSecondary }]}>
            {monthDeliveries} deliveries
          </Text>
        </View>
      </View>

      {/* Daily Chart */}
      <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>
          Last 7 Days
        </Text>
        <View style={styles.chart}>
          {dailyEarnings.slice(0, 7).reverse().map((day, index) => {
            const height = (day.amount / maxDailyEarning) * 100;
            const date = new Date(day.date);
            const dayName = date.toLocaleDateString('en', { weekday: 'short' });

            return (
              <View key={day.date} style={styles.chartBar}>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(height, 5)}%`,
                        backgroundColor: index === dailyEarnings.length - 1 ? colors.tint : colors.tintLight,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: colors.textSecondary }]}>
                  {dayName}
                </Text>
                <Text style={[styles.barAmount, { color: colors.text }]}>
                  ₹{day.amount.toFixed(0)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Earnings Breakdown */}
      <View style={[styles.breakdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.breakdownTitle, { color: colors.text }]}>
          Earnings Breakdown
        </Text>

        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownIcon, { backgroundColor: colors.tintLight }]}>
              <Ionicons name="bicycle" size={20} color={colors.tint} />
            </View>
            <View>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                Delivery Fees
              </Text>
              <Text style={[styles.breakdownAmount, { color: colors.text }]}>
                ₹{monthEarnings.toFixed(0)}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <View style={[styles.breakdownIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="star" size={20} color="#F59E0B" />
            </View>
            <View>
              <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                Tips
              </Text>
              <Text style={[styles.breakdownAmount, { color: colors.text }]}>
                ₹0
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>
            Total Earnings
          </Text>
          <Text style={[styles.totalAmount, { color: colors.tint }]}>
            ₹{monthEarnings.toFixed(0)}
          </Text>
        </View>
      </View>

      {/* Tips */}
      <View style={[styles.tipsCard, { backgroundColor: colors.backgroundSecondary }]}>
        <Ionicons name="bulb-outline" size={24} color={colors.tint} />
        <View style={styles.tipsContent}>
          <Text style={[styles.tipsTitle, { color: colors.text }]}>
            Increase Your Earnings
          </Text>
          <Text style={[styles.tipsText, { color: colors.textSecondary }]}>
            Stay online during peak hours (12-2 PM, 7-10 PM) to get more delivery requests and earn more.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  summaryCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  summaryAmount: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  summaryDetails: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryItemText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 12,
  },
  statAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statDeliveries: {
    fontSize: 12,
    marginTop: 4,
  },
  chartCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 140,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barContainer: {
    flex: 1,
    width: '70%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
  },
  barAmount: {
    fontSize: 10,
    fontWeight: '600',
  },
  breakdownCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  breakdownRow: {
    paddingVertical: 12,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownLabel: {
    fontSize: 12,
  },
  breakdownAmount: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    height: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tipsCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  tipsText: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});
