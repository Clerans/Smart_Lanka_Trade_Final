import * as React from 'react';
const { useEffect, useState } = React;
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { colors, typography, layout } from '../../theme';
import { Card, NotificationModal, SetAlertModal } from '../../components';
import { storageService } from '../../services/storageService';
import { marketService, walletService, portfolioService, authService } from '../../services/apiService';

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
  const isFocused = useIsFocused();
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
  const [user, setUser] = useState<{ name: string; profileImage?: string | null } | null>(null);
  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false);
  const [isNotificationModalVisible, setIsNotificationModalVisible] = useState(false);

  // Reload user info on focus (e.g. after updating profile image or name)
  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await storageService.getUserData();
        if (userData) {
          setUser(userData);
        }
        const profileRes = await authService.getProfile();
        if (profileRes?.user) {
          setUser(profileRes.user);
          await storageService.setUserData(profileRes.user);
        }
      } catch (e) {
        // Ignore offline error
      }
    };
    if (isFocused) {
      loadUser();
    }
  }, [isFocused]);

  useEffect(() => {
    const fetchData = async () => {
      try {
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
            path: generateSparklinePath(p.sparkline, 100, 40),
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerLeft} 
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.avatar}>
              {user?.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
              ) : (
                <MaterialIcons name="person" size={24} color={colors.accent} />
              )}
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.greetingText}>Ayubowan,</Text>
              <Text style={styles.userName}>{user?.name || 'Friend'}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerIcons}>
            <TouchableOpacity 
              style={styles.iconButton}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Markets')}
            >
              <MaterialIcons name="search" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              activeOpacity={0.7}
              onPress={() => setIsNotificationModalVisible(true)}
            >
              <MaterialIcons name="notifications-none" size={24} color={colors.textPrimary} />
              <View style={styles.notificationBadgeDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Card */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Est. Total Value</Text>
          <Text style={styles.balanceValue}>
            LKR {portfolioValue !== null ? portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '1,000,000.00'}
          </Text>
          <View style={styles.balanceFooterRow}>
            <View style={[
              styles.pnlPill,
              todaysProfit !== null && todaysProfit < 0 ? styles.pnlPillRed : styles.pnlPillGreen
            ]}>
              <MaterialIcons 
                name={todaysProfit !== null && todaysProfit >= 0 ? "trending-up" : "trending-down"} 
                size={14} 
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
              <Text style={styles.walletBalanceValue}>LKR {balance !== null ? balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '1,000,000'}</Text>
            </View>
          </View>
          <MaterialIcons
            name="account-balance-wallet"
            size={60}
            color={colors.border}
            style={styles.walletWatermark}
          />
        </Card>

        {lkrPriceData && (
          <View style={{ marginHorizontal: 24, marginBottom: 16 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'right' }}>
              Live Rate: 1 USDT = <Text style={{ color: colors.accent, fontWeight: '700' }}>Rs {lkrPriceData.usdToLkr.toFixed(2)}</Text>
            </Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity 
            style={[styles.actionCard, styles.actionCardActive]}
            onPress={() => navigation.navigate('Wallet', { screen: 'CurrencyConversion' })}
          >
            <MaterialIcons name="shopping-cart" size={22} color="#000" />
            <Text style={styles.actionCardActiveText}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('AIAnalytics')}
          >
            <MaterialIcons name="psychology" size={22} color={colors.accent} />
            <Text style={styles.actionCardText}>AI Signals</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('SOMIAIChat')}
          >
            <MaterialIcons name="chat" size={22} color={colors.accent} />
            <Text style={styles.actionCardText}>SOMI AI</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => navigation.navigate('Wallet', { screen: 'WalletOverview' })}
          >
            <MaterialIcons name="pie-chart-outline" size={22} color={colors.accent} />
            <Text style={styles.actionCardText}>Portfolio</Text>
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
              <Text style={styles.ratePairTitle}>USDT/LKR</Text>
              {loading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={styles.rateValue}>Rs {lkrPriceData?.usdToLkr?.toFixed(2) || '---'}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity 
            style={styles.alertBtn}
            onPress={() => setIsAlertModalVisible(true)}
          >
            <MaterialIcons name="notifications-active" size={14} color={colors.accent} />
            <Text style={styles.alertBtnText}>Set Alert</Text>
          </TouchableOpacity>
        </Card>

        {/* Watchlist */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Watchlist</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Markets')}>
            <Text style={styles.seeAllText}>See All {'>'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.watchlistScroll}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: 24 }} />
          ) : (
            watchlist.map((item: any, index: number) => (
              <TouchableOpacity
                key={index}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AssetDetails', { symbol: item.symbol, coin: item.symbol.replace('USDT', '') })}
              >
                <Card style={styles.watchlistCard}>
                  <Text style={styles.watchPair}>{item.pair} <Text style={{ color: item.color }}>{item.change}</Text></Text>
                  <Text style={styles.watchPrice}>{item.price}</Text>
                  <View style={styles.sparklineContainer}>
                    <Svg height="50" width="100" viewBox="0 0 100 50">
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
          <Text style={styles.sectionTitle}>Market Trends</Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity 
              style={[styles.trendTogglePill, trendTab === 'gainer' && styles.trendTogglePillActive]}
              onPress={() => setTrendTab('gainer')}
            >
              <Text style={[styles.trendToggleText, trendTab === 'gainer' && styles.trendToggleTextActive]}>Gainers</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.trendTogglePill, trendTab === 'loser' && styles.trendTogglePillActive, { marginLeft: 6 }]}
              onPress={() => setTrendTab('loser')}
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
                  <View style={[styles.trendIcon, activeTrend.changeVal < 0 && { backgroundColor: colors.red + '22' }]}>
                    <MaterialIcons 
                      name={activeTrend.changeVal >= 0 ? "trending-up" : "trending-down"} 
                      size={18} 
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

              {/* Dynamic Sparkline / Mini Candles */}
              <View style={styles.candlestickPlaceholder}>
                {activeTrend.sparkline?.length > 1 ? (
                  <View style={{ width: '100%', height: 60, justifyContent: 'center' }}>
                    <Svg height="60" width="100%" viewBox="0 0 300 60">
                      <Path 
                        d={generateSparklinePath(activeTrend.sparkline, 300, 50)} 
                        fill="none" 
                        stroke={activeTrend.color} 
                        strokeWidth="2.5" 
                      />
                    </Svg>
                  </View>
                ) : (
                  <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginVertical: 10 }}>
                    Tap to view live candlestick chart →
                  </Text>
                )}
              </View>
            </Card>
          </TouchableOpacity>
        ) : null}

      </ScrollView>
      {lkrPriceData && (
        <SetAlertModal
          visible={isAlertModalVisible}
          onClose={() => setIsAlertModalVisible(false)}
          symbol="USDTUSDT" // We are setting alert for USDT in LKR
          currentPrice={lkrPriceData.usdToLkr}
        />
      )}
      <NotificationModal
        visible={isNotificationModalVisible}
        onClose={() => setIsNotificationModalVisible(false)}
        onOpenSetAlert={() => setIsAlertModalVisible(true)}
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
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  headerTextContainer: {
    flex: 1,
  },
  greetingText: {
    ...typography.label,
  },
  userName: {
    ...typography.h3,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadgeDot: {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.bg,
  },
  balanceCard: {
    marginHorizontal: 24,
    marginBottom: 20,
    backgroundColor: '#161616',  // slightly distinct
    padding: 24,
  },
  balanceLabel: {
    ...typography.label,
    marginBottom: 8,
  },
  balanceValue: {
    ...typography.price,
    marginBottom: 16,
  },
  pnlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pnlPillGreen: {
    backgroundColor: colors.accentMuted,
  },
  pnlPillRed: {
    backgroundColor: colors.red + '22',
  },
  pnlText: {
    fontWeight: '600',
    fontSize: 12,
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
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
  },
  walletBalanceValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 11,
  },
  walletWatermark: {
    position: 'absolute',
    top: 20,
    right: 20,
    opacity: 0.1,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: layout.borderRadius,
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionCardActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionCardText: {
    ...typography.bodySmall,
    marginTop: 8,
    color: '#FFF',
    fontWeight: '600',
  },
  actionCardActiveText: {
    ...typography.bodySmall,
    marginTop: 8,
    color: '#000',
    fontWeight: '700',
  },
  rateBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 32,
    padding: 16,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.bgCard,
  },
  currencyIconText: {
    fontSize: 8,
    color: '#FFF',
    fontWeight: '700',
  },
  rateInfoRow: {
    justifyContent: 'center',
  },
  ratePairTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#FFF',
  },
  rateValue: {
    ...typography.label,
    fontSize: 14,
  },
  alertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  alertBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    ...typography.h3,
  },
  seeAllText: {
    color: colors.accent,
    fontWeight: '600',
  },
  watchlistScroll: {
    paddingLeft: 24,
    marginBottom: 32,
  },
  watchlistCard: {
    width: 160,
    marginRight: 16,
    padding: 16,
  },
  watchPair: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 8,
  },
  watchPrice: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 8,
  },
  sparklineContainer: {
    height: 50,
    width: 100,
    marginTop: 8,
  },
  trendCard: {
    marginHorizontal: 24,
    padding: 20,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  trendHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trendTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  trendSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  trendTogglePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.bgInput,
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
    color: '#000',
  },
  trendHeaderRight: {
    alignItems: 'flex-end',
  },
  trendPrice: {
    ...typography.body,
    fontWeight: '700',
  },
  trendChange: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '700',
  },
  candlestickPlaceholder: {
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
});
