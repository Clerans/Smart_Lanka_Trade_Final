import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { colors, typography, layout, SCREEN_PADDING, TAB_BAR_BOTTOM_OFFSET, spacing } from '../../theme';
import { Card, PrimaryButton } from '../../components';
import { portfolioService, walletService, marketService } from '../../services/apiService';
import { formatLKR, formatNumber } from '../../utils/formatters';

interface HoldingItem {
  coin: string;
  symbol: string;
  name: string;
  assetType?: 'CRYPTO' | 'STOCK';
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  profitLoss: number;
  profitPercent: number;
  color: string;
  letter: string;
  dataFreshness?: string;
}

const COIN_METADATA: Record<string, { name: string; color: string; letter: string }> = {
  BTC: { name: 'Bitcoin', color: '#F7931A', letter: 'B' },
  ETH: { name: 'Ethereum', color: '#627EEA', letter: 'E' },
  SOL: { name: 'Solana', color: '#14F195', letter: 'S' },
  BNB: { name: 'BNB', color: '#F3BA2F', letter: 'B' },
  XRP: { name: 'Ripple', color: '#23292F', letter: 'X' },
  ADA: { name: 'Cardano', color: '#0033AD', letter: 'A' },
  DOGE: { name: 'Dogecoin', color: '#C2A633', letter: 'D' },
  LKR: { name: 'Sri Lankan Rupee', color: '#00E676', letter: 'Rs' },
  USDT: { name: 'Tether USD', color: '#26A17B', letter: 'T' },
  // Colombo Stock Exchange (CSE) equities
  JKH: { name: 'John Keells Holdings', color: '#00A86B', letter: 'J' },
  COMB: { name: 'Commercial Bank', color: '#0052CC', letter: 'C' },
  DIAL: { name: 'Dialog Axiata', color: '#E60000', letter: 'D' },
  HNB: { name: 'Hatton National Bank', color: '#FF8C00', letter: 'H' },
  LIOC: { name: 'Lanka IOC', color: '#008080', letter: 'L' },
};

export const PortfolioScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'CRYPTO' | 'STOCKS' | 'CASH'>('ALL');


  // Portfolio data states
  const [totalValue, setTotalValue] = useState<number>(0);
  const [availableCash, setAvailableCash] = useState<number>(0);
  const [totalInvested, setTotalInvested] = useState<number>(0);
  const [totalProfitLoss, setTotalProfitLoss] = useState<number>(0);
  const [pnlPercent, setPnlPercent] = useState<number>(0);
  const [usdToLkr, setUsdToLkr] = useState<number>(331.27);
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);

  const fetchPortfolioData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // 1. Fetch live portfolio summary & holdings
      const [portfolioRes, walletRes, marketRes] = await Promise.allSettled([
        portfolioService.getPortfolio(),
        walletService.getOverview(isManualRefresh),
        marketService.getMultiplePricesLKR(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'DOGEUSDT']),
      ]);

      let cash = 0;
      let rate = 331.27;
      let rawHoldings: any[] = [];
      let summaryVal = 0;
      let investedVal = 0;
      let profitVal = 0;
      let profitPct = 0;

      if (walletRes.status === 'fulfilled' && walletRes.value?.success && walletRes.value?.data) {
        const wData = walletRes.value.data;
        cash = Number(wData.availableBalance || 0);
        if (wData.usdToLkr) rate = Number(wData.usdToLkr);
      }

      if (portfolioRes.status === 'fulfilled' && portfolioRes.value?.success && portfolioRes.value?.data) {
        const pData = portfolioRes.value.data;
        const summary = pData.summary || {};
        rawHoldings = pData.holdings || [];
        summaryVal = Number(summary.totalPortfolioValue || 0);
        investedVal = Number(summary.investedAmount || 0);
        profitVal = Number(summary.todaysProfit || 0);
        profitPct = Number(summary.profitLossPercent || 0);
        if (summary.availableCash !== undefined) {
          cash = Number(summary.availableCash);
        }
      }

      setUsdToLkr(rate);
      setAvailableCash(cash);

      // Process holdings with fallback to wallet holdings if portfolio is empty
      if (rawHoldings.length === 0 && walletRes.status === 'fulfilled' && walletRes.value?.data?.holdings) {
        rawHoldings = walletRes.value.data.holdings;
      }

      let totalHoldingsSum = 0;
      const formattedHoldings: HoldingItem[] = rawHoldings.map((h: any) => {
        const isStock = h.assetType === 'STOCK' || h.symbol?.includes('.') || h.symbol?.endsWith('0000');
        const coinCode = (h.coin || (isStock ? h.symbol?.split('.')[0] : h.symbol?.replace('USDT', '')) || 'ASSET').toUpperCase();
        const meta = COIN_METADATA[coinCode] || {
          name: h.name || coinCode,
          color: isStock ? '#00A86B' : '#00E676',
          letter: coinCode.charAt(0),
        };

        const qty = Number(h.quantity || 0);
        const avgBuy = Number(h.averageBuyPrice || h.avgCost || 0);
        const curPrice = Number(h.currentPrice || (qty > 0 ? (h.currentValue || 0) / qty : avgBuy));
        const curVal = Number(h.currentValue || (qty * curPrice));
        const pnl = Number(h.profitLoss !== undefined ? h.profitLoss : (h.floatingPnl !== undefined ? h.floatingPnl : (curVal - qty * avgBuy)));
        const pnlPct = Number(h.profitPercent !== undefined ? h.profitPercent : (h.floatingPnlPct !== undefined ? h.floatingPnlPct : (avgBuy > 0 ? (pnl / (qty * avgBuy)) * 100 : 0)));

        totalHoldingsSum += curVal;

        return {
          coin: coinCode,
          symbol: h.symbol || (isStock ? `${coinCode}.N0000` : `${coinCode}USDT`),
          name: h.name || meta.name,
          assetType: isStock ? 'STOCK' : 'CRYPTO',
          quantity: qty,
          averageBuyPrice: avgBuy,
          currentPrice: curPrice,
          currentValue: curVal,
          profitLoss: pnl,
          profitPercent: pnlPct,
          color: meta.color,
          letter: meta.letter,
          dataFreshness: h.dataFreshness
        };
      });

      setHoldings(formattedHoldings);

      // Final reconciled balance
      const computedTotal = summaryVal > 0 ? summaryVal : (totalHoldingsSum + cash);
      setTotalValue(computedTotal > 0 ? computedTotal : cash);
      setTotalInvested(investedVal > 0 ? investedVal : totalHoldingsSum);
      setTotalProfitLoss(profitVal);
      setPnlPercent(profitPct);

    } catch (err) {
      console.error('PortfolioScreen error fetching data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolioData();
  }, [fetchPortfolioData]);

  // Asset allocation calculation for Donut Chart
  const allocationSegments = useMemo(() => {
    const total = totalValue || (holdings.reduce((sum, h) => sum + h.currentValue, 0) + availableCash) || 1;
    const segments: Array<{ label: string; value: number; percent: number; color: string }> = [];

    // Cash portion
    if (availableCash > 0) {
      const cashPct = (availableCash / total) * 100;
      segments.push({
        label: 'Cash (LKR)',
        value: availableCash,
        percent: cashPct,
        color: '#00E676',
      });
    }

    // Crypto & Stock holdings sorted by value
    const sorted = [...holdings].sort((a, b) => b.currentValue - a.currentValue);
    sorted.forEach((item) => {
      if (item.currentValue > 0) {
        const pct = (item.currentValue / total) * 100;
        segments.push({
          label: item.coin,
          value: item.currentValue,
          percent: pct,
          color: item.color,
        });
      }
    });

    return segments;
  }, [totalValue, availableCash, holdings]);

  // Filtered holdings list
  const displayedHoldings = useMemo(() => {
    if (selectedFilter === 'CASH') return [];
    if (selectedFilter === 'CRYPTO') return holdings.filter(h => h.assetType !== 'STOCK');
    if (selectedFilter === 'STOCKS') return holdings.filter(h => h.assetType === 'STOCK');
    return holdings;
  }, [selectedFilter, holdings]);


  const isProfit = totalProfitLoss >= 0;
  const totalInUSDT = usdToLkr > 0 ? totalValue / usdToLkr : totalValue / 331.27;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Investment Portfolio</Text>
        <TouchableOpacity
          onPress={() => fetchPortfolioData(true)}
          style={styles.refreshBtn}
          activeOpacity={0.7}
        >
          <MaterialIcons name="refresh" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: TAB_BAR_BOTTOM_OFFSET + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPortfolioData(true)}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Hero Portfolio Balance Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroLabel}>TOTAL PORTFOLIO VALUE</Text>
              <View style={styles.heroValueRow}>
                <Text style={styles.heroCurrencyPrefix}>LKR</Text>
                <Text style={styles.heroValue}>
                  {loading && !refreshing
                    ? '---'
                    : formatNumber(totalValue, 2)}
                </Text>
              </View>
              <Text style={styles.heroSubValue}>
                ≈ ${formatNumber(totalInUSDT, 2)} USDT
              </Text>
            </View>

            {/* 24H PNL Pill */}
            <View
              style={[
                styles.pnlBadge,
                isProfit ? styles.pnlBadgeGreen : styles.pnlBadgeRed,
              ]}
            >
              <MaterialIcons
                name={isProfit ? 'trending-up' : 'trending-down'}
                size={16}
                color={isProfit ? '#00E676' : '#FF5252'}
              />
              <Text
                style={[
                  styles.pnlBadgeText,
                  { color: isProfit ? '#00E676' : '#FF5252' },
                ]}
              >
                {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
              </Text>
            </View>
          </View>

          <View style={styles.heroDivider} />

          {/* Secondary Stats: Invested, Returns, Cash */}
          <View style={styles.heroStatsGrid}>
            <View style={styles.statCol}>
              <Text style={styles.statColLabel}>TOTAL INVESTED</Text>
              <Text style={styles.statColValue}>
                LKR {formatNumber(totalInvested, 0)}
              </Text>
            </View>

            <View style={styles.statCol}>
              <Text style={styles.statColLabel}>UNREALIZED P&L</Text>
              <Text
                style={[
                  styles.statColValue,
                  { color: isProfit ? '#00E676' : '#FF5252' },
                ]}
              >
                {isProfit ? '+' : ''}LKR {formatNumber(Math.abs(totalProfitLoss), 0)}
              </Text>
            </View>

            <View style={styles.statCol}>
              <Text style={styles.statColLabel}>AVAILABLE CASH</Text>
              <Text style={[styles.statColValue, { color: '#00E676' }]}>
                LKR {formatNumber(availableCash, 0)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Action Navigation Buttons */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={styles.actionPillBtn}
            onPress={() => navigation.navigate('MainApp', { screen: 'Trade' })}
            activeOpacity={0.8}
          >
            <MaterialIcons name="swap-horiz" size={20} color="#06090E" />
            <Text style={styles.actionPillBtnText}>Trade Crypto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionPillSecondaryBtn}
            onPress={() => navigation.navigate('MainApp', { screen: 'Wallet' })}
            activeOpacity={0.8}
          >
            <MaterialIcons name="account-balance-wallet" size={20} color={colors.accent} />
            <Text style={styles.actionPillSecondaryBtnText}>Deposit Cash</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionPillSecondaryBtn}
            onPress={() => navigation.navigate('DemoTrading')}
            activeOpacity={0.8}
          >
            <MaterialIcons name="psychology" size={20} color={colors.accent} />
            <Text style={styles.actionPillSecondaryBtnText}>Virtual Sim</Text>
          </TouchableOpacity>
        </View>

        {/* Asset Allocation Breakdown Section */}
        <Card style={styles.allocationCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.titleIconRow}>
              <MaterialIcons name="pie-chart" size={20} color={colors.accent} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Asset Allocation</Text>
            </View>
            <Text style={styles.sectionSubtext}>
              {allocationSegments.length} Asset{allocationSegments.length === 1 ? '' : 's'}
            </Text>
          </View>

          {/* Allocation Progress Bar */}
          <View style={styles.multiBarContainer}>
            {allocationSegments.map((seg, idx) => (
              <View
                key={seg.label + idx}
                style={[
                  styles.barSegment,
                  {
                    backgroundColor: seg.color,
                    flex: Math.max(seg.percent, 3),
                  },
                ]}
              />
            ))}
          </View>

          {/* Legend Grid */}
          <View style={styles.legendGrid}>
            {allocationSegments.map((seg, idx) => (
              <View key={seg.label + idx} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                <View style={styles.legendTextWrapper}>
                  <Text style={styles.legendLabel} numberOfLines={1}>{seg.label}</Text>
                  <Text style={styles.legendPercent}>{seg.percent.toFixed(1)}%</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Holdings Section */}
        <View style={styles.holdingsSectionHeader}>
          <View>
            <Text style={styles.holdingsSectionTitle}>Your Holdings</Text>
            <Text style={styles.holdingsSectionSub}>
              Active assets in your SmartLanka Trade account
            </Text>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterPillRow}>
            <TouchableOpacity
              style={[
                styles.filterPill,
                selectedFilter === 'ALL' && styles.filterPillActive,
              ]}
              onPress={() => setSelectedFilter('ALL')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedFilter === 'ALL' && styles.filterPillTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                selectedFilter === 'CRYPTO' && styles.filterPillActive,
              ]}
              onPress={() => setSelectedFilter('CRYPTO')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedFilter === 'CRYPTO' && styles.filterPillTextActive,
                ]}
              >
                Crypto
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                selectedFilter === 'STOCKS' && styles.filterPillActive,
              ]}
              onPress={() => setSelectedFilter('STOCKS')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedFilter === 'STOCKS' && styles.filterPillTextActive,
                ]}
              >
                Stocks
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                selectedFilter === 'CASH' && styles.filterPillActive,
              ]}
              onPress={() => setSelectedFilter('CASH')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedFilter === 'CASH' && styles.filterPillTextActive,
                ]}
              >
                Cash
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cash Card Item if All or Cash filter selected */}
        {(selectedFilter === 'ALL' || selectedFilter === 'CASH') && (
          <TouchableOpacity
            style={styles.holdingCard}
            onPress={() => navigation.navigate('Wallet')}
            activeOpacity={0.8}
          >
            <View style={styles.holdingTopRow}>
              <View style={styles.coinLeftGroup}>
                <View style={[styles.coinIconCircle, { backgroundColor: '#00E67622', borderColor: '#00E676', borderWidth: 1 }]}>
                  <Text style={[styles.coinLetter, { color: '#00E676' }]}>Rs</Text>
                </View>
                <View>
                  <Text style={styles.coinName}>LKR Wallet Cash</Text>
                  <Text style={styles.coinTicker}>Fiat Balance</Text>
                </View>
              </View>

              <View style={styles.coinRightGroup}>
                <Text style={styles.coinHoldingValue}>
                  LKR {formatNumber(availableCash, 2)}
                </Text>
                <View style={styles.cashAvailablePill}>
                  <MaterialIcons name="check-circle" size={12} color="#00E676" style={{ marginRight: 4 }} />
                  <Text style={styles.cashAvailableText}>Available for trading</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Holdings List */}
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading portfolio holdings...</Text>
          </View>
        ) : displayedHoldings.length === 0 && selectedFilter !== 'CASH' ? (
          <Card style={styles.emptyCard}>
            <MaterialIcons name="pie-chart-outline" size={44} color={colors.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No {selectedFilter === 'STOCKS' ? 'Stock' : 'Crypto'} Holdings Yet</Text>
            <Text style={styles.emptySub}>
              {selectedFilter === 'STOCKS'
                ? 'Start simulated trading in CSE equities like JKH, COMB, and DIAL directly in LKR.'
                : 'Start trading Bitcoin, Ethereum, and other crypto assets directly using your LKR balance.'}
            </Text>
            <PrimaryButton
              title={selectedFilter === 'STOCKS' ? "Trade CSE Stocks ⚡" : "Start Trading Crypto ⚡"}
              onPress={() => navigation.navigate('MainApp', { screen: selectedFilter === 'STOCKS' ? 'Market' : 'Trade' })}
              style={{ marginTop: 16 }}
            />
          </Card>
        ) : (
          displayedHoldings.map((item, idx) => {
            const holdingProfit = item.profitLoss >= 0;
            const sign = holdingProfit ? '+' : '';

            return (
              <TouchableOpacity
                key={item.coin + idx}
                style={styles.holdingCard}
                onPress={() => {
                  if (item.assetType === 'STOCK') {
                    navigation.navigate('DemoTrading', { initialSymbol: item.symbol });
                  } else {
                    navigation.navigate('AssetDetails', { symbol: item.symbol, coin: item.coin });
                  }
                }}
                activeOpacity={0.8}
              >
                {/* Top Row: Coin Icon, Name, Quantity, Value */}
                <View style={styles.holdingTopRow}>
                  <View style={styles.coinLeftGroup}>
                    <View style={[styles.coinIconCircle, { backgroundColor: item.color }]}>
                      <Text
                        style={[
                          styles.coinLetter,
                          item.coin === 'SOL' || item.coin === 'BNB' ? { color: '#080B11' } : { color: '#FFF' },
                        ]}
                      >
                        {item.letter}
                      </Text>
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.coinName}>{item.name}</Text>
                        {item.assetType === 'STOCK' && (
                          <View style={{ backgroundColor: '#00A86B22', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginLeft: 6 }}>
                            <Text style={{ color: '#00A86B', fontSize: 9, fontWeight: '800' }}>CSE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.coinTicker}>{item.assetType === 'STOCK' ? item.symbol : `${item.symbol.replace('USDT', '')} / LKR`}</Text>
                    </View>
                  </View>

                  <View style={styles.coinRightGroup}>
                    <Text style={styles.coinHoldingValue}>
                      LKR {formatNumber(item.currentValue, 2)}
                    </Text>
                    <Text style={styles.coinQuantitySub}>
                      {item.assetType === 'STOCK' ? `${item.quantity.toFixed(4)} Shares` : `${item.quantity.toFixed(6)} ${item.coin}`}
                    </Text>
                  </View>
                </View>


                {/* Divider */}
                <View style={styles.holdingCardDivider} />

                {/* Bottom Row: Avg Price, Live Price, Floating PNL */}
                <View style={styles.holdingBottomRow}>
                  <View style={styles.priceMetaCol}>
                    <Text style={styles.priceMetaLabel}>AVG BUY</Text>
                    <Text style={styles.priceMetaValue}>
                      Rs {formatNumber(item.averageBuyPrice, 0)}
                    </Text>
                  </View>

                  <View style={styles.priceMetaCol}>
                    <Text style={styles.priceMetaLabel}>CURRENT PRICE</Text>
                    <Text style={styles.priceMetaValue}>
                      Rs {formatNumber(item.currentPrice, 0)}
                    </Text>
                  </View>

                  <View style={styles.pnlMetaCol}>
                    <Text style={styles.priceMetaLabelRight}>P&L</Text>
                    <View
                      style={[
                        styles.holdingPnlPill,
                        holdingProfit ? styles.pnlBadgeGreen : styles.pnlBadgeRed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.holdingPnlText,
                          { color: holdingProfit ? '#00E676' : '#FF5252' },
                        ]}
                      >
                        {sign}{formatNumber(item.profitLoss, 0)} ({sign}{item.profitPercent.toFixed(1)}%)
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
  },
  heroCard: {
    backgroundColor: '#0E131E',
    borderWidth: 1,
    borderColor: '#1E2536',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroCurrencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
    marginRight: 6,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  heroSubValue: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  pnlBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pnlBadgeGreen: {
    backgroundColor: '#00E67620',
    borderWidth: 1,
    borderColor: '#00E67644',
  },
  pnlBadgeRed: {
    backgroundColor: '#FF525220',
    borderWidth: 1,
    borderColor: '#FF525244',
  },
  pnlBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#1E2536',
    marginVertical: 16,
  },
  heroStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCol: {
    flex: 1,
  },
  statColLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statColValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionPillBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
  },
  actionPillBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#06090E',
  },
  actionPillSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121622',
    borderWidth: 1,
    borderColor: '#1E2536',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 6,
  },
  actionPillSecondaryBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FFF',
  },
  allocationCard: {
    backgroundColor: '#0E131E',
    borderWidth: 1,
    borderColor: '#1E2536',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.2,
  },
  sectionSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  multiBarContainer: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#1E2536',
    marginBottom: 16,
  },
  barSegment: {
    height: '100%',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '45%',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendTextWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  legendLabel: {
    fontSize: 12,
    color: '#CCD2E0',
    fontWeight: '500',
  },
  legendPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  holdingsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  holdingsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  holdingsSectionSub: {
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  filterPillRow: {
    flexDirection: 'row',
    backgroundColor: '#121622',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#1E2536',
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
  },
  filterPillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#06090E',
    fontWeight: '700',
  },
  holdingCard: {
    backgroundColor: '#0E131E',
    borderWidth: 1,
    borderColor: '#1E2536',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  holdingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coinLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coinIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinLetter: {
    fontSize: 15,
    fontWeight: '800',
  },
  coinName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFF',
  },
  coinTicker: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  coinRightGroup: {
    alignItems: 'flex-end',
  },
  coinHoldingValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  coinQuantitySub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cashAvailablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  cashAvailableText: {
    fontSize: 11,
    color: '#00E676',
    fontWeight: '500',
  },
  holdingCardDivider: {
    height: 1,
    backgroundColor: '#161C2A',
    marginVertical: 12,
  },
  holdingBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceMetaCol: {
    flex: 1,
  },
  priceMetaLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  priceMetaLabelRight: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.4,
    textAlign: 'right',
  },
  priceMetaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 2,
  },
  pnlMetaCol: {
    flex: 1.2,
    alignItems: 'flex-end',
  },
  holdingPnlPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  holdingPnlText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 12,
  },
  emptyCard: {
    backgroundColor: '#0E131E',
    borderWidth: 1,
    borderColor: '#1E2536',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
