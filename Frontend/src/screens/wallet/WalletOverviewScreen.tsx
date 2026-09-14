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
import { useIsFocused } from '@react-navigation/native';
import {
  Card,
  DepositModal,
  WithdrawModal,
  TransferModal,
  TransactionDetailsModal
} from '../../components';
import { colors } from '../../theme';
import { walletService, portfolioService } from '../../services/apiService';
import { formatLKR, formatNumber } from '../../utils/formatters';
const { useState, useEffect, useCallback } = React;

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

const DEFAULT_HOLDINGS: HoldingItem[] = [
  {
    coin: 'BTC',
    name: 'Bitcoin',
    symbol: 'BTC',
    quantity: 0.004215,
    currentValue: 385220.00,
    floatingPnl: 12940.00,
    floatingPnlPct: 3.5,
    avgCost: 88410900.00,
    color: '#F7931A',
    letter: 'B'
  },
  {
    coin: 'ETH',
    name: 'Ethereum',
    symbol: 'ETH',
    quantity: 1.842000,
    currentValue: 298760.00,
    floatingPnl: 6110.00,
    floatingPnlPct: 2.1,
    avgCost: 158760.00,
    color: '#627EEA',
    letter: 'E'
  },
  {
    coin: 'SOL',
    name: 'Solana',
    symbol: 'SOL',
    quantity: 14.500000,
    currentValue: 71300.00,
    floatingPnl: -1450.00,
    floatingPnlPct: -1.8,
    avgCost: 5017.00,
    color: '#14F195',
    letter: 'S'
  }
];

export const WalletOverviewScreen = () => {
  const isFocused = useIsFocused();

  const [walletDetails, setWalletDetails] = useState<any>(null);
  const [holdings, setHoldings] = useState<HoldingItem[]>(DEFAULT_HOLDINGS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [isDepositVisible, setIsDepositVisible] = useState(false);
  const [isWithdrawVisible, setIsWithdrawVisible] = useState(false);
  const [isTransferVisible, setIsTransferVisible] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [isTxDetailsVisible, setIsTxDetailsVisible] = useState(false);

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

  const fetchWalletData = useCallback(async () => {
    try {
      const [walletRes, txRes, portfolioRes] = await Promise.all([
        walletService.getWalletDetails().catch(() => null),
        walletService.getTransactions('ALL', 10).catch(() => null),
        portfolioService.getPortfolio().catch(() => null)
      ]);

      if (walletRes?.success) {
        setWalletDetails(walletRes);
      }
      if (txRes?.success && Array.isArray(txRes.data)) {
        setTransactions(txRes.data);
      }

      if (portfolioRes?.success && Array.isArray(portfolioRes.data?.holdings) && portfolioRes.data.holdings.length > 0) {
        const mappedHoldings: HoldingItem[] = portfolioRes.data.holdings.map((h: any) => {
          const meta = getCoinMeta(h.coin);
          return {
            coin: h.coin,
            name: meta.name,
            symbol: h.coin,
            quantity: parseFloat(h.quantity || 0),
            currentValue: parseFloat(h.currentValue || 0),
            floatingPnl: parseFloat(h.profitLoss || 0),
            floatingPnlPct: parseFloat(h.profitPercent || 0),
            avgCost: parseFloat(h.averageBuyPrice || 0),
            color: meta.color,
            letter: meta.letter
          };
        });
        setHoldings(mappedHoldings);
      } else {
        setHoldings(DEFAULT_HOLDINGS);
      }
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchWalletData();
    }
  }, [isFocused, fetchWalletData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWalletData();
  }, [fetchWalletData]);

  const availableCash = walletDetails?.availableBalance !== undefined && walletDetails?.availableBalance !== null
    ? Number(walletDetails.availableBalance) 
    : 892300.00;
  const totalAssetVal = walletDetails?.balanceLKR !== undefined && walletDetails?.balanceLKR !== null
    ? Number(walletDetails.balanceLKR) 
    : 1247850.40;

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
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00E676" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
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
              {walletDetails?.accountUid && (
                <Text style={styles.headerUidText}>UID: {walletDetails.accountUid}</Text>
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

          {/* Total Asset Value Card */}
          <Card style={styles.totalAssetCard}>
            <Text style={styles.totalAssetLabel}>TOTAL ASSET VALUE</Text>
            <Text style={styles.totalAssetNumber}>
              LKR {formatLKR(totalAssetVal, 2)}
            </Text>
            <View style={styles.cashRow}>
              <Text style={styles.cashLabel}>Available Cash: </Text>
              <Text style={styles.cashValue}>
                LKR {formatLKR(availableCash, 2)}
              </Text>
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
              <TouchableOpacity onPress={() => fetchWalletData()} activeOpacity={0.7}>
                <Text style={styles.viewAllText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {/* Holdings Cards List */}
            {holdings.map((item, index) => {
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
                        {(item.quantity || 0).toFixed(6)} {item.symbol}
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
            })}
          </View>

          {/* Recent Activity Section */}
          <View style={[styles.holdingsSection, { marginTop: 24 }]}>
            <View style={styles.holdingsHeaderRow}>
              <Text style={styles.holdingsTitle}>Recent Activity</Text>
              <Text style={styles.activitySubText}>{transactions.length} Records</Text>
            </View>

            {transactions.length === 0 ? (
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
      )}

      {/* Deposit Modal */}
      <DepositModal
        isVisible={isDepositVisible}
        onClose={() => setIsDepositVisible(false)}
        onSuccess={fetchWalletData}
      />

      {/* Withdraw Modal */}
      <WithdrawModal
        isVisible={isWithdrawVisible}
        onClose={() => setIsWithdrawVisible(false)}
        availableBalance={availableCash}
        onSuccess={fetchWalletData}
      />

      {/* Internal Transfer Modal */}
      <TransferModal
        isVisible={isTransferVisible}
        onClose={() => setIsTransferVisible(false)}
        availableBalance={availableCash}
        onSuccess={fetchWalletData}
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
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
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
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  totalAssetLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  totalAssetNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    marginVertical: 8,
    letterSpacing: -0.5,
  },
  cashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cashLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  cashValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionSquareBtn: {
    width: 58,
    height: 58,
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
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 8,
  },
  holdingsSection: {
    paddingHorizontal: 20,
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
    marginBottom: 3,
  },
  statLabelRight: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 3,
    textAlign: 'right',
  },
  pnlValueText: {
    fontSize: 14,
    fontWeight: '700',
  },
  avgCostText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  emptyActivityCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyActivityText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 14,
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
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  activityDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
