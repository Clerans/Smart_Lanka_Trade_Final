import * as React from 'react';
const { useEffect, useState } = React;
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { colors, typography, layout } from '../../theme';
import { Card } from '../../components';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { marketService, portfolioService } from '../../services/apiService';
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
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
};

export const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [lkrPriceData, setLkrPriceData] = useState<any>(null);
  const [topGainer, setTopGainer] = useState<any>(null);
  const [topLoser, setTopLoser] = useState<any>(null);
  const [trendTab, setTrendTab] = useState<'gainer' | 'loser'>('gainer');
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [portfolioValue, setPortfolioValue] = useState<number | null>(null);
  const [todaysProfit, setTodaysProfit] = useState<number | null>(null);
  const [pnlPercent, setPnlPercent] = useState<number | null>(null);
  const [user, setUser] = useState<{ name: string; profileImage?: string } | null>(null);
  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return 'SL';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Load user info
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          setUser(JSON.parse(userData));
        }

        // Fetch prices with sparkline data for all major pairs
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT'];
        const marketResponse = await marketService.getMultiplePricesLKR(symbols, true);

        // Fetch portfolio summary
        const portfolioResponse = await portfolioService.getPortfolio();

        if (marketResponse.success && marketResponse.data?.prices) {
          const prices = marketResponse.data.prices;
          const formatted = prices.map((p: any) => ({
            symbol: p.symbol,
            pair: `${p.symbol.replace('USDT', '')}/LKR`,
            change: `${p.changePercent >= 0 ? '+' : ''}${p.changePercent.toFixed(2)}%`,
            changeVal: p.changePercent,
            price: p.priceLKR < 10
              ? `Rs ${p.priceLKR.toFixed(4)}`
              : `Rs ${p.priceLKR.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            rawPrice: p.priceLKR,
            color: p.changePercent >= 0 ? colors.accent : colors.red,
            path: generateSparklinePath(p.sparkline, 110, 42),
            sparkline: p.sparkline || []
          }));
          setWatchlist(formatted);
          setLkrPriceData(marketResponse.data);

          // Find top gainer & loser
          const sorted = [...formatted].sort((a, b) => b.changeVal - a.changeVal);
          setTopGainer(sorted[0]);
          setTopLoser(sorted[sorted.length - 1]);
        }

        if (portfolioResponse.success) {
          const { summary } = portfolioResponse.data;
          setBalance(summary.availableCash);
          setPortfolioValue(summary.totalPortfolioValue);
          setTodaysProfit(summary.todaysProfit);
          setPnlPercent(summary.profitLossPercent);
        }

      } catch (error) {
        console.error('Failed to fetch home data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeTrend = trendTab === 'gainer' ? topGainer : topLoser;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >

        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerLeft}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.avatar}>
              {user?.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
              )}
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.greetingText}>Ayubowan,</Text>
              <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Trader'}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('Markets')}
              activeOpacity={0.7}
            >
              <MaterialIcons name="search" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('SecuritySettings')}
              activeOpacity={0.7}
            >
              <MaterialIcons name="settings" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Card */}
        <Card style={styles.balanceCard}>
          <View style={styles.balanceHeaderRow}>
            <Text style={styles.balanceLabel}>EST. TOTAL VALUE</Text>
            <View style={styles.liveRateBadge}>
              <View style={styles.liveRateDot} />
              <Text style={styles.liveRateText}>
                1 USDT ≈ Rs {lkrPriceData?.usdToLkr ? lkrPriceData.usdToLkr.toFixed(2) : '331.27'}
              </Text>
            </View>
          </View>

          <View style={styles.balanceMainRow}>
            <Text style={styles.balanceCurrencyPrefix}>LKR</Text>
            <Text style={styles.balanceValue}>
              {portfolioValue !== null ? portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '1,030,000.00'}
            </Text>
          </View>

          <View style={styles.balanceCardDivider} />

          <View style={styles.balanceFooterRow}>
            <View style={[
              styles.pnlPill,
              todaysProfit !== null && todaysProfit < 0 ? styles.pnlPillRed : styles.pnlPillGreen
            ]}>
              <MaterialIcons
                name={todaysProfit !== null && todaysProfit >= 0 ? "trending-up" : "trending-down"}
                size={16}
                color={todaysProfit !== null && todaysProfit >= 0 ? colors.accent : colors.red}
              />
              <Text style={[
                styles.pnlText,
                todaysProfit !== null && todaysProfit >= 0 ? { color: colors.accent } : { color: colors.red }
              ]}>
                {todaysProfit !== null && todaysProfit >= 0 ? '+' : ''}{pnlPercent !== null ? pnlPercent.toFixed(2) : '0.00'}% PNL
              </Text>
            </View>

            <View style={styles.walletBalanceContainer}>
              <Text style={styles.walletBalanceLabel}>Available: </Text>
              <Text style={styles.walletBalanceValue}>
                LKR {balance !== null ? balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '1,030,000'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.actionCard, styles.actionCardBuy]}
            onPress={() => navigation.navigate('Trade')}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconBoxBuy}>
              <MaterialIcons name="shopping-cart" size={20} color="#000" />
            </View>
            <Text style={styles.actionCardBuyText}>Buy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('AIAnalytics')}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconBox}>
              <MaterialIcons name="psychology" size={20} color={colors.accent} />
            </View>
            <Text style={styles.actionCardText}>AI Signals</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('SOMIAIChat')}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconBox}>
              <MaterialIcons name="chat" size={20} color={colors.accent} />
            </View>
            <Text style={styles.actionCardText}>SOMI AI</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Wallet')}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconBox}>
              <MaterialIcons name="pie-chart-outline" size={20} color={colors.accent} />
            </View>
            <Text style={styles.actionCardText}>Portfolio</Text>
          </TouchableOpacity>
        </View>

        {/* USDT/LKR Rate Banner */}
        <Card style={styles.rateBanner}>
          <View style={styles.rateBannerLeft}>
            <View style={styles.iconStack}>
              <View style={[styles.currencyIcon, { backgroundColor: '#26A17B', zIndex: 2 }]}>
                <Text style={styles.currencyIconText}>USD</Text>
              </View>
              <View style={[styles.currencyIcon, { backgroundColor: '#1A5BFF', marginLeft: -10, zIndex: 1 }]}>
                <Text style={styles.currencyIconText}>LKR</Text>
              </View>
            </View>
            <View style={styles.rateInfoCol}>
              <Text style={styles.ratePairTitle}>USDT / LKR</Text>
              {loading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={styles.rateValue}>Rs {lkrPriceData?.usdToLkr?.toFixed(2) || '331.27'}</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.alertBtn}
            onPress={() => setIsAlertModalVisible(true)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="notifications-active" size={14} color={colors.accent} />
            <Text style={styles.alertBtnText}>Set Alert</Text>
          </TouchableOpacity>
        </Card>

        {/* Watchlist Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Watchlist</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Markets')} activeOpacity={0.7}>
            <Text style={styles.seeAllText}>See All →</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.watchlistScroll}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 16 }} />
          ) : (
            watchlist.map((item: any, index: number) => (
              <TouchableOpacity
                key={index}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AssetDetails', { symbol: item.symbol, coin: item.symbol.replace('USDT', '') })}
              >
                <Card style={styles.watchlistCard}>
                  <View style={styles.watchPairRow}>
                    <Text style={styles.watchPair}>{item.pair}</Text>
                    <Text style={[styles.watchChange, { color: item.color }]}>{item.change}</Text>
                  </View>
                  <Text style={styles.watchPrice}>{item.price}</Text>
                  <View style={styles.sparklineContainer}>
                    <Svg height="42" width="110" viewBox="0 0 110 42">
                      <Path d={item.path} fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round" />
                    </Svg>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Market Trends Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Market Trends</Text>
          <View style={styles.trendToggleContainer}>
            <TouchableOpacity
              style={[styles.trendTogglePill, trendTab === 'gainer' && styles.trendTogglePillActive]}
              onPress={() => setTrendTab('gainer')}
              activeOpacity={0.8}
            >
              <Text style={[styles.trendToggleText, trendTab === 'gainer' && styles.trendToggleTextActive]}>Gainers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.trendTogglePill, trendTab === 'loser' && styles.trendTogglePillActive]}
              onPress={() => setTrendTab('loser')}
              activeOpacity={0.8}
            >
              <Text style={[styles.trendToggleText, trendTab === 'loser' && styles.trendToggleTextActive]}>Losers</Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTrend ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AssetDetails', { symbol: activeTrend.symbol, coin: activeTrend.symbol.replace('USDT', '') })}
          >
            <Card style={styles.trendCard}>
              <View style={styles.trendHeader}>
                <View style={styles.trendHeaderLeft}>
                  <View style={[styles.trendIcon, activeTrend.changeVal < 0 ? { backgroundColor: colors.red + '22' } : { backgroundColor: colors.accentMuted }]}>
                    <MaterialIcons
                      name={activeTrend.changeVal >= 0 ? "trending-up" : "trending-down"}
                      size={20}
                      color={activeTrend.color}
                    />
                  </View>
                  <View>
                    <Text style={styles.trendTitle}>{trendTab === 'gainer' ? 'Top Gainer' : 'Top Loser'}</Text>
                    <Text style={styles.trendSubtitle}>{activeTrend.pair}</Text>
                  </View>
                </View>
                <View style={styles.trendHeaderRight}>
                  <Text style={styles.trendPrice}>{activeTrend.price}</Text>
                  <Text style={[styles.trendChange, { color: activeTrend.color }]}>{activeTrend.change}</Text>
                </View>
              </View>

              {/* Dynamic Sparkline Chart */}
              <View style={styles.candlestickPlaceholder}>
                {activeTrend.sparkline?.length > 1 ? (
                  <View style={{ width: '100%', height: 64, justifyContent: 'center' }}>
                    <Svg height="64" width="100%" viewBox="0 0 300 64">
                      <Path
                        d={generateSparklinePath(activeTrend.sparkline, 300, 54)}
                        fill="none"
                        stroke={activeTrend.color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </Svg>
                  </View>
                ) : (
                  <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginVertical: 10 }}>
                    Tap to view live interactive chart →
                  </Text>
                )}
              </View>
            </Card>
          </TouchableOpacity>
        ) : null}

        {/* Extra Bottom Padding so content is never covered by the floating tab bar */}
        <View style={{ height: 110 }} />

      </ScrollView>

      {lkrPriceData && (
        <SetAlertModal
          visible={isAlertModalVisible}
          onClose={() => setIsAlertModalVisible(false)}
          symbol="USDTUSDT"
          currentPrice={lkrPriceData.usdToLkr}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
  },
  headerTextContainer: {
    flex: 1,
  },
  greetingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
  },
  userName: {
    ...typography.h3,
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: layout.borderRadiusSmall,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#0D1317',
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#18242A',
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#00E676',
  },
  liveRateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#132225',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1D3538',
  },
  liveRateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E676',
    marginRight: 6,
  },
  liveRateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  balanceMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  balanceCurrencyPrefix: {
    fontSize: 16,
    fontWeight: '800',
    color: '#718096',
    marginRight: 8,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  balanceCardDivider: {
    height: 1,
    backgroundColor: '#18202A',
    marginBottom: 14,
  },
  balanceFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pnlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pnlPillGreen: {
    backgroundColor: '#0A251B',
    borderWidth: 1,
    borderColor: '#114D2E',
  },
  pnlPillRed: {
    backgroundColor: '#2E1214',
    borderWidth: 1,
    borderColor: '#5A1E22',
  },
  pnlText: {
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 5,
  },
  walletBalanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletBalanceLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  walletBalanceValue: {
    fontSize: 12.5,
    color: '#E2E8F0',
    fontWeight: '800',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionCardBuy: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionIconBoxBuy: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#00C853',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionCardText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  actionCardBuyText: {
    fontSize: 11,
    color: '#000000',
    fontWeight: '800',
  },
  rateBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rateBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconStack: {
    flexDirection: 'row',
    marginRight: 12,
  },
  currencyIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.bgCard,
  },
  currencyIconText: {
    fontSize: 7.5,
    color: '#FFF',
    fontWeight: '800',
  },
  rateInfoCol: {
    justifyContent: 'center',
  },
  ratePairTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  rateValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.accent,
  },
  alertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent + '44',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  alertBtnText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  seeAllText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  watchlistScroll: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 4,
    marginBottom: 20,
  },
  watchlistCard: {
    width: 148,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  watchPairRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  watchPair: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  watchChange: {
    fontSize: 11,
    fontWeight: '700',
  },
  watchPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  sparklineContainer: {
    height: 42,
    width: 110,
    justifyContent: 'center',
  },
  trendToggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trendTogglePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendTogglePillActive: {
    backgroundColor: colors.accent,
  },
  trendToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  trendToggleTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  trendCard: {
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trendHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trendTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  trendSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  trendHeaderRight: {
    alignItems: 'flex-end',
  },
  trendPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  trendChange: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  candlestickPlaceholder: {
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
