import * as React from 'react';
const { useState, useEffect } = React;
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, layout } from '../../theme';
import { Card, DepositModal, PrimaryButton } from '../../components';
import Svg, { Circle } from 'react-native-svg';
import { walletService, portfolioService } from '../../services/apiService';

const { width } = Dimensions.get('window');

const stockColors = ['#1A5BFF', '#009933', '#FF9900', '#9933FF', '#E60000', '#CC6600'];

export const WalletOverviewScreen = () => {
  const navigation = useNavigation<any>();
  const [walletDetails, setWalletDetails] = useState<any>(null);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDepositVisible, setIsDepositVisible] = useState(false);
  const [isWithdrawVisible, setIsWithdrawVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawBank, setWithdrawBank] = useState('Commercial Bank PLC');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const [walletRes, txRes, portfolioRes] = await Promise.all([
        walletService.getWalletDetails(),
        walletService.getTransactions(),
        portfolioService.getPortfolio()
      ]);

      if (walletRes?.success) setWalletDetails(walletRes.data || walletRes);
      if (txRes?.success) setTransactions(txRes.data || []);
      if (portfolioRes?.success) setHoldings(portfolioRes.data?.holdings || []);
    } catch (error) {
      console.error('Failed to fetch wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, []);

  const handleWithdraw = async () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid withdrawal amount in LKR.');
      return;
    }
    if (!withdrawAccount.trim()) {
      Alert.alert('Account Required', 'Please enter your Sri Lankan bank account number.');
      return;
    }

    const available = walletDetails?.availableBalance || walletDetails?.availableBalanceLKR || 0;
    if (amt > available) {
      Alert.alert('Insufficient Balance', `You have LKR ${available.toLocaleString()} available to withdraw.`);
      return;
    }

    try {
      setWithdrawing(true);
      const res = await walletService.withdrawMoney({
        amount: amt,
        bankName: withdrawBank,
        accountNumber: withdrawAccount,
      });

      if (res?.success) {
        setIsWithdrawVisible(false);
        setWithdrawAmount('');
        setWithdrawAccount('');
        Alert.alert('Withdrawal Submitted', `Your withdrawal request of LKR ${amt.toLocaleString()} via SLIPS/CEFT has been initiated.`);
        fetchWalletData();
      } else {
        Alert.alert('Withdrawal Failed', res?.message || 'Could not process withdrawal.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Withdrawal request failed.');
    } finally {
      setWithdrawing(false);
    }
  };

  // Build allocation legend dynamically
  const allocData: any[] = [];
  const totalVal = (walletDetails?.balanceLKR || walletDetails?.totalPortfolioValue || 1000000);
  
  holdings.forEach((h, idx) => {
    const pct = (((h.currentValue || (h.quantity * (h.currentPrice || h.averageBuyPrice))) / totalVal) * 100).toFixed(1);
    allocData.push({
      id: idx + 1,
      name: `${h.symbol.split('.')[0]} Shares`,
      percent: `${pct}%`,
      color: stockColors[idx % stockColors.length],
    });
  });

  const cashBalance = walletDetails?.availableBalance || walletDetails?.availableBalanceLKR || 0;
  const cashPct = ((cashBalance / totalVal) * 100).toFixed(1);
  allocData.push({
    id: holdings.length + 1,
    name: 'LKR Cash Balance',
    percent: `${cashPct}%`,
    color: colors.accent,
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Account & Wallet</Text>
            <TouchableOpacity onPress={fetchWalletData} style={styles.iconBtn}>
              <MaterialIcons name="refresh" size={24} color={colors.accent} />
            </TouchableOpacity>
          </View>

          {/* Balance Card */}
          <Card style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Total Asset Valuation (LKR)</Text>
            <Text style={styles.balanceValue}>
              LKR {totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <View style={styles.walletBalanceContainer}>
              <Text style={styles.walletBalanceLabel}>Available Trading Cash: </Text>
              <Text style={styles.walletBalanceValue}>
                LKR {cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </Card>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setIsDepositVisible(true)}>
              <View style={styles.actionIconBgDark}>
                <MaterialIcons name="arrow-downward" size={24} color={colors.accent} />
              </View>
              <Text style={styles.actionText}>Deposit</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={() => setIsWithdrawVisible(true)}>
              <View style={styles.actionIconBgDark}>
                <MaterialIcons name="arrow-upward" size={24} color={colors.accent} />
              </View>
              <Text style={styles.actionText}>Withdraw</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('CurrencyConversion')}
            >
              <View style={styles.actionIconBgDark}>
                <MaterialIcons name="currency-exchange" size={24} color={colors.accent} />
              </View>
              <Text style={styles.actionText}>Forex Hub</Text>
            </TouchableOpacity>
          </View>

          {/* Asset Allocation */}
          <View style={styles.allocSection}>
            <Text style={styles.sectionTitle}>Asset Allocation</Text>

            <Card style={styles.allocCard}>
              <View style={styles.chartLegendContainer}>

                {/* Donut Chart Indicator */}
                <View style={styles.chartWrapper}>
                  <Svg height="120" width="120" viewBox="0 0 140 140">
                    <Circle cx="70" cy="70" r="50" stroke="#1E1E1E" strokeWidth="18" fill="transparent" />
                    <Circle cx="70" cy="70" r="50" stroke={colors.accent} strokeWidth="18" fill="transparent" strokeDasharray="314" strokeDashoffset="100" transform="rotate(-90 70 70)" />
                    <Circle cx="70" cy="70" r="50" stroke="#1A5BFF" strokeWidth="18" fill="transparent" strokeDasharray="314" strokeDashoffset="240" transform="rotate(30 70 70)" />
                  </Svg>
                  <View style={styles.chartCenter}>
                    <Text style={styles.chartCenterTitle}>{holdings.length + 1}</Text>
                    <Text style={styles.chartCenterSub}>Assets</Text>
                  </View>
                </View>

                {/* Legend List */}
                <View style={styles.legendWrapper}>
                  {allocData.map(item => (
                    <View key={item.id} style={styles.legendRow}>
                      <View style={styles.legendLeft}>
                        <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                        <Text style={styles.legendName}>{item.name}</Text>
                      </View>
                      <Text style={styles.legendPercent}>{item.percent}</Text>
                    </View>
                  ))}
                </View>

              </View>
            </Card>
          </View>

          {/* Active Holdings Table */}
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Equities Portfolio Holdings</Text>
            {holdings.length > 0 ? (
              holdings.map((h, idx) => (
                <View key={idx} style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <View style={[styles.txIconContainer, { backgroundColor: '#1A5BFF22' }]}>
                      <FontAwesome5 name="chart-pie" size={16} color="#1A5BFF" />
                    </View>
                    <View>
                      <Text style={styles.txPair}>{h.symbol}</Text>
                      <Text style={styles.txTime}>{h.quantity?.toLocaleString()} Shares · Avg Rs {h.averageBuyPrice?.toFixed(2)}</Text>
                    </View>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={styles.txAmount}>
                      Rs {(h.currentValue || (h.quantity * (h.currentPrice || h.averageBuyPrice)))?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={[styles.holdingPLText, (h.unrealizedProfitLoss || 0) >= 0 ? { color: colors.accent } : { color: colors.red }]}>
                      {(h.unrealizedProfitLoss || 0) >= 0 ? '+' : ''}Rs {(h.unrealizedProfitLoss || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginVertical: 8 }}>
                No active stock holdings yet. Use the Trading Terminal to buy CSE equities.
              </Text>
            )}
          </View>

          {/* Recent Transactions */}
          <View style={styles.historySection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
            </View>

            {transactions.length > 0 ? (
              transactions.slice(0, 10).map((tx, idx) => {
                const isCredit = tx.TYPE === 'DEPOSIT' || tx.TYPE === 'SELL' || tx.type === 'DEPOSIT' || tx.type === 'SELL';
                const txType = tx.TYPE || tx.type || 'TRADE';
                const txAmt = tx.AMOUNT || tx.amount || 0;
                const txSymbol = tx.SYMBOL || tx.symbol || 'LKR Fiat';

                return (
                  <View key={idx} style={styles.txRow}>
                    <View style={styles.txLeft}>
                      <View style={[styles.txIconContainer, isCredit ? styles.txBgGreen : styles.txBgRed]}>
                        <MaterialIcons
                          name={isCredit ? 'arrow-downward' : 'arrow-upward'}
                          size={18}
                          color={isCredit ? colors.accent : colors.red}
                        />
                      </View>
                      <View>
                        <Text style={styles.txPair}>{txType} · {txSymbol}</Text>
                        <Text style={styles.txTime}>{new Date(tx.CREATED_AT || tx.createdAt || Date.now()).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={[styles.txAmount, isCredit ? styles.txAmountGreen : styles.txAmountRed]}>
                        {isCredit ? '+' : '-'}LKR {Number(txAmt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </Text>
                      <View style={styles.statusCompleted}>
                        <Text style={styles.statusCompletedText}>COMPLETED</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginVertical: 8 }}>
                No transaction records found.
              </Text>
            )}
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      <DepositModal
        visible={isDepositVisible}
        onClose={() => setIsDepositVisible(false)}
        onDepositSuccess={fetchWalletData}
      />

      {/* Withdraw Modal */}
      <Modal visible={isWithdrawVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Card style={styles.withdrawModalCard}>
            <Text style={styles.modalTitle}>Withdraw to Bank Account</Text>
            <Text style={styles.modalSub}>SLIPS / CEFT Instant Interbank Transfer</Text>

            <Text style={styles.inputLabel}>AMOUNT (LKR)</Text>
            <TextInput
              style={styles.modalInput}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              placeholder="e.g. 50000"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>BENEFICIARY BANK</Text>
            <TextInput
              style={styles.modalInput}
              value={withdrawBank}
              onChangeText={setWithdrawBank}
              placeholder="e.g. Commercial Bank / Sampath Bank"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>ACCOUNT NUMBER</Text>
            <TextInput
              style={styles.modalInput}
              value={withdrawAccount}
              onChangeText={setWithdrawAccount}
              placeholder="Bank Account Number"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsWithdrawVisible(false)}
                disabled={withdrawing}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleWithdraw}
                disabled={withdrawing}
              >
                <Text style={styles.confirmBtnText}>{withdrawing ? "Processing..." : "Withdraw Funds"}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    ...typography.h3,
    color: '#FFF',
  },
  iconBtn: {
    padding: 8,
  },
  balanceCard: {
    padding: 20,
    marginBottom: 20,
  },
  balanceLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  walletBalanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletBalanceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  walletBalanceValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
  },
  actionIconBgDark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  allocSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  allocCard: {
    padding: 16,
  },
  chartLegendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  chartCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  chartCenterTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  chartCenterSub: {
    fontSize: 9,
    color: colors.textSecondary,
  },
  legendWrapper: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendName: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  legendPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  historySection: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txBgGreen: {
    backgroundColor: colors.accentMuted,
  },
  txBgRed: {
    backgroundColor: colors.red + '22',
  },
  txPair: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFF',
    fontSize: 13,
  },
  txTime: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  txAmountGreen: {
    color: colors.accent,
  },
  txAmountRed: {
    color: colors.red,
  },
  holdingPLText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  statusCompleted: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  statusCompletedText: {
    fontSize: 8,
    fontWeight: '700',
    color: colors.accent,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  withdrawModalCard: {
    padding: 20,
  },
  modalTitle: {
    ...typography.h3,
    color: '#FFF',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.bgInput,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#000',
    fontWeight: '700',
  },
});
