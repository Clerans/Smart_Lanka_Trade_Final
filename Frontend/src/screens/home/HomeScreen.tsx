import * as React from 'react';
const { useEffect, useState } = React;
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { colors, typography, layout } from '../../theme';
import { Card } from '../../components';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { marketService, walletService, portfolioService } from '../../services/apiService';
import { SetAlertModal } from '../../components/SetAlertModal';

// Helper to generate SVG path for sparklines
const generateSparklinePath = (data: number[], width: number, height: number) => {
  if (!data || data.length < 2) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  
  return data.map((val, i) => {
    const x = i * stepX;
    const y = height - ((val - min) / range) * height;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
};

export const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [forexRate, setForexRate] = useState<number>(310.50);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availableCash, setAvailableCash] = useState<number>(1000000);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState<number>(1000000);
  const [unrealizedPL, setUnrealizedPL] = useState<number>(0);
  const [todaysProfit, setTodaysProfit] = useState<number>(0);
  const [pnlPercent, setPnlPercent] = useState<number>(0);
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false);
  const [selectedStockForAlert, setSelectedStockForAlert] = useState<string>('JKH.N0000');

  const fetchData = async () => {
    try {
      setLoading(true);
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        setUser(JSON.parse(userData));
      }

      const [marketRes, portfolioRes, forexRes] = await Promise.all([
        marketService.getMultiplePricesLKR(['JKH.N0000', 'COMB.N0000', 'SAMP.N0000', 'DIAL.N0000'], true),
        portfolioService.getPortfolio(),
        marketService.getForexRates()
      ]);

      if (marketRes?.success && marketRes.data?.prices) {
        const formatted = marketRes.data.prices.map((p: any) => ({
          symbol: p.symbol,
          pair: `${p.symbol.split('.')[0]} / LKR`,
          change: `${p.changePercent >= 0 ? '+' : ''}${p.changePercent?.toFixed(2)}%`,
          price: `Rs ${p.priceLKR?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          color: p.changePercent >= 0 ? colors.accent : colors.red,
          path: generateSparklinePath(p.sparkline || [p.priceLKR * 0.98, p.priceLKR * 0.99, p.priceLKR, p.priceLKR * 1.01], 100, 40)
        }));
        setWatchlist(formatted);
      }

      if (portfolioRes?.success && portfolioRes.data?.summary) {
        const s = portfolioRes.data.summary;
        setAvailableCash(s.availableCash);
        setTotalPortfolioValue(s.totalPortfolioValue);
        setUnrealizedPL(s.unrealizedProfitLoss);
        setTodaysProfit(s.todaysProfit);
        setPnlPercent(s.profitLossPercent);
      }

      if (forexRes?.success && forexRes.data?.rates?.USD_LKR) {
        setForexRate(forexRes.data.rates.USD_LKR);
      }
    } catch (error) {
      console.error('Failed to fetch home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatar}>
              <MaterialIcons name="person" size={24} color={colors.accent} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.greetingText}>Ayubowan,</Text>
              <Text style={styles.userName}>{user?.name || 'Investor'}</Text>
            </View>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Market')}>
              <MaterialIcons name="search" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('AIAnalytics')}>
              <FontAwesome5 name="robot" size={20} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Portfolio Net Worth Card */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Est. Total Portfolio Value (LKR)</Text>
          <Text style={styles.balanceValue}>
            LKR {totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View style={styles.balanceFooterRow}>
            <View style={[
              styles.pnlPill,
              unrealizedPL < 0 ? styles.pnlPillRed : styles.pnlPillGreen
            ]}>
              <MaterialIcons 
                name={unrealizedPL >= 0 ? "trending-up" : "trending-down"} 
                size={14} 
                color={unrealizedPL >= 0 ? colors.accent : colors.red} 
              />
              <Text style={[
                styles.pnlText,
                unrealizedPL >= 0 ? { color: colors.accent } : { color: colors.red }
              ]}>
                {unrealizedPL >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}% (Rs {unrealizedPL.toLocaleString()})
              </Text>
            </View>
            <View style={styles.walletBalanceContainer}>
              <Text style={styles.walletBalanceLabel}>Available Cash: </Text>
              <Text style={styles.walletBalanceValue}>LKR {availableCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            </View>
          </View>
        </Card>

        {/* CBSL Benchmark Banner */}
        <View style={{ marginHorizontal: 24, marginBottom: 16 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'right' }}>
            CBSL Official Forex Benchmark: 1 USD = <Text style={{ color: colors.accent, fontWeight: '700' }}>Rs {forexRate.toFixed(2)}</Text>
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity 
            style={[styles.actionCard, styles.actionCardActive]}
            onPress={() => navigation.navigate('Market', { screen: 'TradingTerminal', params: { symbol: 'JKH.N0000' } })}
          >
            <MaterialIcons name="show-chart" size={24} color="#000" />
            <Text style={styles.actionCardActiveText}>Trade Stocks</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('Wallet', { screen: 'WalletOverview' })}
          >
            <MaterialIcons name="account-balance-wallet" size={24} color={colors.accent} />
            <Text style={styles.actionCardText}>Holdings</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('Wallet', { screen: 'CurrencyConversion' })}
          >
            <MaterialIcons name="currency-exchange" size={24} color={colors.accent} />
            <Text style={styles.actionCardText}>Forex Hub</Text>
          </TouchableOpacity>
        </View>

        {/* Rate Banner */}
        <Card style={styles.rateBanner}>
          <View style={styles.rateBannerLeft}>
            <View style={styles.iconStack}>
              <View style={[styles.currencyIcon, { backgroundColor: '#26A17B', zIndex: 2 }]}><Text style={styles.currencyIconText}>USD</Text></View>
              <View style={[styles.currencyIcon, { backgroundColor: '#1A5BFF', marginLeft: -12, zIndex: 1 }]}><Text style={styles.currencyIconText}>LKR</Text></View>
            </View>
            <View style={styles.rateInfoRow}>
              <Text style={styles.ratePairTitle}>USD / LKR Spot</Text>
              <Text style={styles.rateValue}>Rs {forexRate.toFixed(2)}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.alertBtn}
            onPress={() => {
              setSelectedStockForAlert('JKH.N0000');
              setIsAlertModalVisible(true);
            }}
          >
            <MaterialIcons name="notifications-active" size={14} color={colors.accent} />
            <Text style={styles.alertBtnText}>Price Alert</Text>
          </TouchableOpacity>
        </Card>

        {/* Watchlist */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>CSE Featured Watchlist</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Market')}>
            <Text style={styles.seeAllText}>All Equities {'>'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.watchlistScroll}>
          {loading && !refreshing ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 24 }} />
          ) : (
            watchlist.map((item: any, index: number) => (
              <TouchableOpacity
                key={index}
                onPress={() => navigation.navigate('Market', { screen: 'TradingTerminal', params: { symbol: item.symbol } })}
              >
                <Card style={styles.watchlistCard}>
                  <Text style={styles.watchPair}>{item.pair} <Text style={{ color: item.color }}>{item.change}</Text></Text>
                  <Text style={styles.watchPrice}>{item.price}</Text>
                  <View style={styles.sparklineContainer}>
                    <Svg height="40" width="100" viewBox="0 0 100 40">
                      <Path d={item.path} fill="none" stroke={item.color} strokeWidth="2" />
                    </Svg>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
          <View style={{ width: 24 }} />
        </ScrollView>

        {/* Market Trends */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>CSE Daily Top Movers</Text>
        </View>
        <Card style={styles.trendCard}>
          <View style={styles.trendHeader}>
            <View style={styles.trendHeaderLeft}>
              <View style={styles.trendIcon}>
                <MaterialIcons name="show-chart" size={16} color={colors.accent} />
              </View>
              <View>
                <Text style={styles.trendTitle}>John Keells Holdings</Text>
                <Text style={styles.trendSubtitle}>JKH.N0000 · Conglomerates</Text>
              </View>
            </View>
            <View style={styles.trendHeaderRight}>
              <Text style={styles.trendPrice}>Rs 205.50</Text>
              <Text style={[styles.trendChange, { color: colors.accent }]}>+2.45%</Text>
            </View>
          </View>
        </Card>

      </ScrollView>

      <SetAlertModal
        visible={isAlertModalVisible}
        onClose={() => setIsAlertModalVisible(false)}
        symbol={selectedStockForAlert}
        currentPrice={205.50}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {},
  greetingText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  userName: {
    ...typography.h3,
    color: '#FFF',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#161616',
    padding: 20,
  },
  balanceLabel: {
    ...typography.label,
    marginBottom: 8,
    color: colors.textSecondary,
  },
  balanceValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 14,
  },
  pnlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  pnlPillGreen: {
    backgroundColor: colors.accentMuted,
  },
  pnlPillRed: {
    backgroundColor: colors.red + '22',
  },
  pnlText: {
    fontWeight: '700',
    fontSize: 11,
    marginLeft: 4,
  },
  balanceFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletBalanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletBalanceLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  walletBalanceValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionCardActive: {
    backgroundColor: colors.accent,
  },
  actionCardText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 6,
  },
  actionCardActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    marginTop: 6,
  },
  rateBanner: {
    marginHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    marginBottom: 20,
  },
  rateBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconStack: {
    flexDirection: 'row',
    marginRight: 10,
  },
  currencyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  currencyIconText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFF',
  },
  rateInfoRow: {},
  ratePairTitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  rateValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  alertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  alertBtnText: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
    marginLeft: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
  },
  seeAllText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
  watchlistScroll: {
    paddingLeft: 24,
    marginBottom: 20,
  },
  watchlistCard: {
    width: 140,
    padding: 12,
    marginRight: 12,
  },
  watchPair: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  watchPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  sparklineContainer: {
    height: 40,
    justifyContent: 'center',
  },
  trendCard: {
    marginHorizontal: 24,
    padding: 16,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  trendTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
  },
  trendSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  trendHeaderRight: {
    alignItems: 'flex-end',
  },
  trendPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  trendChange: {
    fontSize: 11,
    fontWeight: '700',
  },
});
