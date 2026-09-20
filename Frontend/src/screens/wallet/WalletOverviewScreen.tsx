import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import {
  Card,
  DepositModal,
  WithdrawModal,
  TransferModal,
  TransactionDetailsModal
} from '../../components';
import { colors, layout, typography, SCREEN_PADDING, TAB_BAR_BOTTOM_OFFSET } from '../../theme';
import { walletService } from '../../services/apiService';
import { formatLKR, formatNumber } from '../../utils/formatters';

const { useState, useEffect, useCallback, useRef } = React;

interface HoldingItem {
  coin: string;
  name: string;
  symbol: string;
  quantity: number;
  currentValue: number;
  floatingPnl: number;
  floatingPnlPct: number;
  avgCost: number;
  color: string;
  letter: string;
}

export const WalletOverviewScreen = () => {
  const isFocused = useIsFocused();
  const navigation = useNavigation<any>();

  // State
  const [walletData, setWalletData] = useState<any>(null);
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usdToLkr, setUsdToLkr] = useState<number>(331.27);
  const [pnlPct, setPnlPct] = useState<number>(0);
  const [errorState, setErrorState] = useState<string | null>(null);

  // Modals
  const [isDepositVisible, setIsDepositVisible] = useState(false);
  const [isWithdrawVisible, setIsWithdrawVisible] = useState(false);
  const [isTransferVisible, setIsTransferVisible] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [isTxDetailsVisible, setIsTxDetailsVisible] = useState(false);

  // Avoid repetitive calls on unmount / fast refocus
  const lastFetchedTimeRef = useRef<number>(0);

  const getCoinMeta = (coin: string) => {
    switch (coin.toUpperCase()) {
      case 'BTC':
        return { name: 'Bitcoin', color: '#F7931A', letter: 'B' };
      case 'ETH':
        return { name: 'Ethereum', color: '#627EEA', letter: 'E' };
      case 'SOL':
        return { name: 'Solana', color: '#14F195', letter: 'S' };
      case 'BNB':
        return { name: 'BNB', color: '#F3BA2F', letter: 'B' };
      case 'XRP':
        return { name: 'Ripple', color: '#23292F', letter: 'X' };
      case 'ADA':
        return { name: 'Cardano', color: '#0033AD', letter: 'A' };
      case 'DOGE':
        return { name: 'Dogecoin', color: '#C2A633', letter: 'D' };
      default:
        return { name: coin, color: '#00E676', letter: coin.charAt(0).toUpperCase() };
    }
  };

  const fetchWalletData = useCallback(async (isManualRefresh: boolean = false) => {
    try {
      if (!isManualRefresh && walletData && Date.now() - lastFetchedTimeRef.current < 4000) {
        return; // Fresh in-memory cache, skip redundant roundtrip
      }

      setErrorState(null);
      const res = await walletService.getOverview(isManualRefresh);

      if (res?.success && res?.data) {
        const data = res.data;
        setWalletData(data);
        lastFetchedTimeRef.current = Date.now();

        if (data.usdToLkr) {
          setUsdToLkr(Number(data.usdToLkr));
        }

        if (data.profitLossPercent !== undefined) {
          setPnlPct(Number(data.profitLossPercent));
        }

        if (Array.isArray(data.recentTransactions)) {
          setTransactions(data.recentTransactions);
        }

        if (Array.isArray(data.holdings) && data.holdings.length > 0) {
          const mapped: HoldingItem[] = data.holdings.map((h: any) => {
            const meta = getCoinMeta(h.coin);
            return {
              coin: h.coin,
              name: meta.name,
              symbol: h.symbol || h.coin,
              quantity: parseFloat(h.quantity || 0),
              currentValue: parseFloat(h.currentValue || 0),
              floatingPnl: parseFloat(h.profitLoss || 0),
              floatingPnlPct: parseFloat(h.profitPercent || 0),
              avgCost: parseFloat(h.averageBuyPrice || 0),
              color: meta.color,
              letter: meta.letter
            };
          });
          setHoldings(mapped);
        } else {
          setHoldings([]);
        }
      }
    } catch (error: any) {
      console.warn('Failed to fetch wallet overview:', error?.message || error);
      if (!walletData) {
        setErrorState('Unable to load wallet. Tap to retry.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [walletData]);

  useEffect(() => {
    if (isFocused) {
      fetchWalletData(false);
    }
  }, [isFocused, fetchWalletData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWalletData(true);
  }, [fetchWalletData]);

  const availableCash = walletData?.availableBalance !== undefined && walletData?.availableBalance !== null
    ? Number(walletData.availableBalance)
    : 0.00;

  const totalAssetVal = walletData?.totalAssetValue !== undefined && walletData?.totalAssetValue !== null
    ? Number(walletData.totalAssetValue)
    : availableCash;

  const handleOpenTxDetails = (tx: any) => {
    setSelectedTx(tx);
    setIsTxDetailsVisible(true);
  };

  const getTxTypeTitle = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return 'Deposit';
      case 'WITHDRAW':
        return 'Withdrawal';
      case 'TRANSFER_SENT':
        return 'Transfer Sent';
      case 'TRANSFER_RECEIVED':
        return 'Transfer Received';
      case 'BUY':
        return 'Bought Asset';
      case 'SELL':
        return 'Sold Asset';
      default:
        return type;
    }
  };

  const getTxIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return 'arrow-downward';
      case 'WITHDRAW':
        return 'arrow-upward';
      case 'TRANSFER_SENT':
        return 'arrow-forward';
      case 'TRANSFER_RECEIVED':
        return 'arrow-back';
      case 'BUY':
        return 'shopping-cart';
      case 'SELL':
        return 'sell';
      default:
        return 'swap-horiz';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00E676"
            colors={['#00E676']}
          />
        }
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Wallet</Text>
            {walletData?.accountUid ? (
              <Text style={styles.headerUidText}>UID: {walletData.accountUid}</Text>
            ) : loading ? (
              <View style={styles.skeletonUidBadge} />
            ) : (
              <Text style={styles.headerUidText}>SmartLanka Account</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.gridBtn}
            onPress={() => {
              if (transactions.length > 0) {
                handleOpenTxDetails(transactions[0]);
              } else {
                Alert.alert('Transaction History', 'No transaction activity found.');
              }
            }}
            activeOpacity={0.7}
          >
            <MaterialIcons name="receipt-long" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Error Notification / Retry Bar if network issue */}
        {errorState && (
          <TouchableOpacity style={styles.errorBanner} onPress={() => { setLoading(true); fetchWalletData(true); }} activeOpacity={0.8}>
            <MaterialIcons name="cloud-off" size={18} color="#FF5252" />
            <Text style={styles.errorBannerText}>{errorState}</Text>
            <MaterialIcons name="refresh" size={18} color="#00E676" />
          </TouchableOpacity>
        )}

        {/* Total Asset Value Card */}
        <Card style={styles.totalAssetCard}>
          <View style={styles.balanceHeaderRow}>
            <Text style={styles.totalAssetLabel}>EST. TOTAL VALUE</Text>
            <View style={styles.liveRateBadge}>
              <View style={styles.liveRateDot} />
              <Text style={styles.liveRateText}>
                1 USDT ≈ Rs {usdToLkr ? usdToLkr.toFixed(2) : '331.27'}
              </Text>
            </View>
          </View>

          <View style={styles.balanceMainRow}>
            <Text style={styles.balanceCurrencyPrefix}>LKR</Text>
            {loading && !walletData ? (
              <View style={styles.skeletonBalanceText} />
            ) : (
              <Text style={styles.totalAssetNumber}>
                {formatLKR(totalAssetVal, 2)}
              </Text>
            )}
          </View>

          <View style={styles.balanceCardDivider} />

          <View style={styles.balanceFooterRow}>
            {loading && !walletData ? (
              <View style={styles.skeletonPill} />
            ) : (
              <View style={[
                styles.pnlPill,
                pnlPct < 0 ? styles.pnlPillRed : styles.pnlPillGreen
              ]}>
                <MaterialIcons
                  name={pnlPct >= 0 ? "trending-up" : "trending-down"}
                  size={16}
                  color={pnlPct >= 0 ? colors.accent : colors.red}
                />
                <Text style={[
                  styles.pnlText,
                  pnlPct >= 0 ? { color: colors.accent } : { color: colors.red }
                ]}>
                  {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}% PNL
                </Text>
              </View>
            )}

            <View style={styles.cashRow}>
              <Text style={styles.cashLabel}>Available: </Text>
              {loading && !walletData ? (
                <View style={styles.skeletonCashText} />
              ) : (
                <Text style={styles.cashValue}>
                  LKR {formatNumber(availableCash, 0)}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          {/* Deposit */}
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={styles.actionSquareBtn}
              onPress={() => setIsDepositVisible(true)}
              activeOpacity={0.75}
            >
              <MaterialIcons name="arrow-downward" size={22} color="#00E676" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Deposit</Text>
          </View>

          {/* Withdraw */}
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={styles.actionSquareBtn}
              onPress={() => setIsWithdrawVisible(true)}
              activeOpacity={0.75}
            >
              <MaterialIcons name="arrow-upward" size={22} color="#00E676" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Withdraw</Text>
          </View>

          {/* Transfer */}
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={styles.actionSquareBtn}
              onPress={() => setIsTransferVisible(true)}
              activeOpacity={0.75}
            >
              <MaterialIcons name="swap-horiz" size={24} color="#00E676" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Transfer</Text>
          </View>
        </View>

        {/* Holdings Section */}
        <View style={styles.holdingsSection}>
          <View style={styles.holdingsHeaderRow}>
            <Text style={styles.holdingsTitle}>Your Holdings</Text>
            <TouchableOpacity onPress={() => fetchWalletData(true)} activeOpacity={0.7}>
              <Text style={styles.viewAllText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {/* Progressive Holdings State */}
          {loading && !walletData ? (
            // Skeleton Holding Row
            <View style={styles.skeletonCard}>
              <View style={styles.skeletonRow}>
                <View style={styles.skeletonCircle} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.skeletonLineShort} />
                  <View style={[styles.skeletonLineShort, { width: '40%', marginTop: 6 }]} />
                </View>
              </View>
            </View>
          ) : holdings.length === 0 ? (
            <View style={styles.emptyHoldingsCard}>
              <MaterialIcons name="account-balance-wallet" size={36} color={colors.textSecondary} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyHoldingsTitle}>No Crypto Holdings Yet</Text>
              <Text style={styles.emptyHoldingsSub}>Trade crypto pairs using your available LKR wallet balance.</Text>
              <TouchableOpacity
                style={styles.exploreMarketBtn}
                onPress={() => navigation.navigate('Market')}
                activeOpacity={0.8}
              >
                <Text style={styles.exploreMarketBtnText}>Explore Market</Text>
                <MaterialIcons name="arrow-forward" size={16} color="#080B11" />
              </TouchableOpacity>
            </View>
          ) : (
            holdings.map((item, index) => {
              const isProfit = (item.floatingPnl || 0) >= 0;
              const sign = isProfit ? '+' : '-';
              const pnlText = `${sign}LKR ${formatNumber(Math.abs(item.floatingPnl || 0), 0)} (${sign}${Math.abs(item.floatingPnlPct || 0).toFixed(1)}%)`;

              return (
                <View key={item.coin + index} style={styles.holdingCard}>
                  {/* Top Row: Coin Icon, Name/Symbol, Quantity, Value */}
                  <View style={styles.holdingTopRow}>
                    <View style={styles.holdingLeftInfo}>
                      <View style={[styles.coinIconCircle, { backgroundColor: item.color }]}>
                        <Text style={[styles.coinLetterText, item.coin === 'SOL' || item.coin === 'BNB' ? { color: '#080B11' } : { color: '#FFFFFF' }]}>
                          {item.letter}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.coinFullName}>{item.name}</Text>
                        <Text style={styles.coinTicker}>{item.symbol}</Text>
                      </View>
                    </View>

                    <View style={styles.holdingRightInfo}>
                      <Text style={styles.coinQuantityText}>
                        {(item.quantity || 0).toFixed(6)} {item.coin}
                      </Text>
                      <Text style={styles.coinValueText}>
                        LKR {formatLKR(item.currentValue, 2)}
                      </Text>
                    </View>
                  </View>

                  {/* Horizontal Divider */}
                  <View style={styles.holdingDivider} />

                  {/* Bottom Row: Floating P&L and Avg. Cost */}
                  <View style={styles.holdingBottomRow}>
                    <View style={styles.pnlColumn}>
                      <Text style={styles.statLabel}>FLOATING P&L</Text>
                      <Text style={[styles.pnlValueText, { color: isProfit ? '#00E676' : '#FF5252' }]}>
                        {pnlText}
                      </Text>
                    </View>

                    <View style={styles.costColumn}>
                      <Text style={styles.statLabelRight}>AVG. COST</Text>
                      <Text style={styles.avgCostText}>
                        LKR {formatNumber(item.avgCost, 0)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Recent Activity Section */}
        <View style={[styles.holdingsSection, { marginTop: 24 }]}>
          <View style={styles.holdingsHeaderRow}>
            <Text style={styles.holdingsTitle}>Recent Activity</Text>
            <Text style={styles.activitySubText}>{transactions.length} Records</Text>
          </View>

          {loading && !walletData ? (
            <View style={styles.skeletonCard}>
              <View style={styles.skeletonRow}>
                <View style={styles.skeletonCircle} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.skeletonLineShort} />
                </View>
              </View>
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.emptyActivityCard}>
              <MaterialIcons name="history" size={32} color={colors.textSecondary} style={{ marginBottom: 6 }} />
              <Text style={styles.emptyActivityText}>No recent funding or transfer activity.</Text>
            </View>
          ) : (
            transactions.slice(0, 5).map((tx, idx) => {
              const isIncoming = tx.isIncoming !== undefined
                ? tx.isIncoming
                : ['DEPOSIT', 'TRANSFER_RECEIVED', 'SELL'].includes(tx.type || tx.TYPE);

              const rawAmount = tx.amount !== undefined ? tx.amount : (tx.AMOUNT !== undefined ? tx.AMOUNT : (tx.total || 0));

              return (
                <TouchableOpacity
                  key={(tx.id || tx.ID || idx).toString()}
                  style={styles.activityCard}
                  onPress={() => handleOpenTxDetails(tx)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.activityIconBox, { backgroundColor: isIncoming ? colors.accentMuted : '#FF525222' }]}>
                    <MaterialIcons
                      name={getTxIcon(tx.type || tx.TYPE)}
                      size={20}
                      color={isIncoming ? colors.accent : '#FF5252'}
                    />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityTitle}>{getTxTypeTitle(tx.type || tx.TYPE)}</Text>
                    <Text style={styles.activityDate}>
                      {tx.paymentMethod ? `${tx.paymentMethod} • ` : ''}
                      {tx.createdAt || tx.CREATED_AT ? new Date(tx.createdAt || tx.CREATED_AT).toLocaleDateString() : 'Today'}
                    </Text>
                  </View>
                  <View style={styles.activityRight}>
                    <Text style={[styles.activityAmount, { color: isIncoming ? colors.accent : '#FFFFFF' }]}>
                      {isIncoming ? '+' : '-'} LKR {formatLKR(rawAmount, 2)}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: (tx.status || tx.STATUS) === 'COMPLETED' ? colors.accentMuted : '#FFB30022' }]}>
                      <Text style={[styles.statusBadgeText, { color: (tx.status || tx.STATUS) === 'COMPLETED' ? colors.accent : '#FFB300' }]}>
                        {tx.status || tx.STATUS || 'COMPLETED'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Deposit Modal */}
      <DepositModal
        isVisible={isDepositVisible}
        onClose={() => setIsDepositVisible(false)}
        onSuccess={() => fetchWalletData(true)}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        isVisible={isWithdrawVisible}
        onClose={() => setIsWithdrawVisible(false)}
        availableBalance={availableCash}
        onSuccess={() => fetchWalletData(true)}
      />

      {/* Internal Transfer Modal */}
      <TransferModal
        isVisible={isTransferVisible}
        onClose={() => setIsTransferVisible(false)}
        availableBalance={availableCash}
        onSuccess={() => fetchWalletData(true)}
      />

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        isVisible={isTxDetailsVisible}
        onClose={() => setIsTxDetailsVisible(false)}
        transaction={selectedTx}
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
    paddingBottom: TAB_BAR_BOTTOM_OFFSET,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerUidText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  skeletonUidBadge: {
    width: 90,
    height: 14,
    borderRadius: 6,
    backgroundColor: colors.bgElevated,
    marginTop: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 82, 82, 0.12)',
    borderWidth: 1,
    borderColor: '#FF5252',
    marginHorizontal: SCREEN_PADDING,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  errorBannerText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    marginHorizontal: 8,
  },
  gridBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalAssetCard: {
    marginHorizontal: SCREEN_PADDING,
    marginBottom: 20,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  balanceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalAssetLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.accent,
  },
  liveRateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveRateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: 6,
  },
  liveRateText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  balanceMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  balanceCurrencyPrefix: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textSecondary,
    marginRight: 8,
  },
  totalAssetNumber: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  skeletonBalanceText: {
    width: 180,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.bgElevated,
  },
  balanceCardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  balanceFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonPill: {
    width: 80,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.bgElevated,
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
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accentDark,
  },
  pnlPillRed: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.red,
  },
  pnlText: {
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 5,
  },
  cashRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cashLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  cashValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  skeletonCashText: {
    width: 70,
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.bgElevated,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SCREEN_PADDING,
    marginBottom: 24,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionSquareBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  actionLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 8,
  },
  holdingsSection: {
    paddingHorizontal: SCREEN_PADDING,
  },
  holdingsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  holdingsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  activitySubText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  skeletonCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 14,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgElevated,
  },
  skeletonLineShort: {
    width: '60%',
    height: 14,
    borderRadius: 6,
    backgroundColor: colors.bgElevated,
  },
  emptyHoldingsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHoldingsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptyHoldingsSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  exploreMarketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  exploreMarketBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#080B11',
    marginRight: 6,
  },
  holdingCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 14,
  },
  holdingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  holdingLeftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coinLetterText: {
    fontSize: 18,
    fontWeight: '800',
  },
  coinFullName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  coinTicker: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  holdingRightInfo: {
    alignItems: 'flex-end',
  },
  coinQuantityText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  coinValueText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  holdingDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  holdingBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pnlColumn: {
    flex: 1,
  },
  costColumn: {
    flex: 1,
    alignItems: 'flex-end',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statLabelRight: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 2,
    textAlign: 'right',
  },
  pnlValueText: {
    fontSize: 13,
    fontWeight: '800',
  },
  avgCostText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyActivityCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActivityText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  activityIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  activityDate: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
