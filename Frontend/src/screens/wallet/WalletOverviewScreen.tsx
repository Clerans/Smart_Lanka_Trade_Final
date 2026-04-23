import * as React from 'react';
const { useState, useEffect } = React;
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { Card } from '../../components';
import Svg, { Circle } from 'react-native-svg';
import { walletService } from '../../services/apiService';

const { width } = Dimensions.get('window');

export const WalletOverviewScreen = () => {
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        const response = await walletService.getBalance();
        if (response.success) {
          setBalance(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch wallet data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchWalletData();
  }, []);

  const allocData = [
    { id: 1, name: 'Bitcoin (BTC)', percent: '45%', color: '#F7931A' },
    { id: 2, name: 'Ethereum (ETH)', percent: '30%', color: '#627EEA' },
    { id: 3, name: 'Solana (SOL)', percent: '15%', color: '#14F195' },
    { id: 4, name: 'LKR Fiat', percent: balance ? `${((balance.balance / 245000) * 10).toFixed(1)}%` : '10%', color: '#1A5BFF' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Wallet</Text>
            <TouchableOpacity style={styles.iconBtn}>
              <MaterialIcons name="qr-code-scanner" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Balance Card */}
          <Card style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Total Asset Value</Text>
            <Text style={styles.balanceValue}>LKR {balance ? (balance.balance + 195000).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '245,320.50'}</Text>
            <View style={styles.pnlPill}>
              <MaterialIcons name="trending-up" size={14} color={colors.accent} />
              <Text style={styles.pnlText}>+1.24% Today</Text>
            </View>
          </Card>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn}>
              <View style={styles.actionIconBgDark}>
                <MaterialIcons name="arrow-downward" size={24} color={colors.accent} />
              </View>
              <Text style={styles.actionText}>Deposit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <View style={styles.actionIconBgDark}>
                <MaterialIcons name="arrow-upward" size={24} color={colors.accent} />
              </View>
              <Text style={styles.actionText}>Withdraw</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <View style={styles.actionIconBgDark}>
                <MaterialIcons name="swap-horiz" size={24} color={colors.accent} />
              </View>
              <Text style={styles.actionText}>Transfer</Text>
            </TouchableOpacity>
          </View>

          {/* Asset Allocation */}
          <View style={styles.allocSection}>
            <Text style={styles.sectionTitle}>Asset Allocation</Text>

            <Card style={styles.allocCard}>
              <View style={styles.chartLegendContainer}>

                {/* Fake Donut Chart */}
                <View style={styles.chartWrapper}>
                  <Svg height="140" width="140" viewBox="0 0 140 140">
                    <Circle cx="70" cy="70" r="50" stroke="#161616" strokeWidth="20" fill="transparent" />
                    {/* BTC */}
                    <Circle cx="70" cy="70" r="50" stroke="#F7931A" strokeWidth="20" fill="transparent" strokeDasharray="314" strokeDashoffset="173" transform="rotate(-90 70 70)" />
                    {/* ETH */}
                    <Circle cx="70" cy="70" r="50" stroke="#627EEA" strokeWidth="20" fill="transparent" strokeDasharray="314" strokeDashoffset="220" transform="rotate(72 70 70)" />
                    {/* SOL */}
                    <Circle cx="70" cy="70" r="50" stroke="#14F195" strokeWidth="20" fill="transparent" strokeDasharray="314" strokeDashoffset="267" transform="rotate(180 70 70)" />
                    {/* LKR */}
                    <Circle cx="70" cy="70" r="50" stroke="#1A5BFF" strokeWidth="20" fill="transparent" strokeDasharray="314" strokeDashoffset="283" transform="rotate(234 70 70)" />
                  </Svg>
                  <View style={styles.chartCenter}>
                    <Text style={styles.chartCenterTitle}>4</Text>
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

          {/* Recent History */}
          <View style={styles.historySection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity><Text style={styles.seeAllText}>View All</Text></TouchableOpacity>
            </View>

            {[
              { id: 1, type: 'Deposit', pair: 'LKR Fiat', amount: balance ? `+LKR ${balance.balance.toLocaleString()}` : '+LKR 50,000', status: 'Completed', isBuy: true },
              { id: 2, type: 'Buy', pair: 'BTC', amount: '+0.0015 BTC', status: 'Completed', isBuy: true },
              { id: 3, type: 'Withdraw', pair: 'LKR Fiat', amount: '-LKR 12,000', status: 'Pending', isBuy: false },
            ].map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={styles.txLeft}>
                  <View style={[styles.txIconContainer, tx.isBuy ? styles.txBgGreen : styles.txBgRed]}>
                    <MaterialIcons
                      name={tx.isBuy ? 'arrow-downward' : 'arrow-upward'}
                      size={20}
                      color={tx.isBuy ? colors.accent : colors.red}
                    />
                  </View>
                  <View>
                    <Text style={styles.txPair}>{tx.type}</Text>
                    <Text style={styles.txTime}>{tx.pair}</Text>
                  </View>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, tx.isBuy ? styles.txAmountGreen : styles.txAmountRed]}>
                    {tx.amount}
                  </Text>
                  <View style={[styles.statusBadge, tx.status === 'Completed' ? styles.statusCompleted : styles.statusPending]}>
                    <Text style={[styles.statusText, tx.status === 'Completed' ? styles.statusTextCompleted : styles.statusTextPending]}>
                      {tx.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            <View style={{ height: 80 }} />
          </View>

        </ScrollView>
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    marginBottom: 24,
  },
  headerTitle: {
    ...typography.h1,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: '#161616',
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
    backgroundColor: colors.accentMuted,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pnlText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionIconBgDark: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  allocSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: 16,
  },
  allocCard: {
    padding: 24,
  },
  chartLegendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chartWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 24,
  },
  chartCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCenterTitle: {
    ...typography.h2,
    color: '#FFF',
  },
  chartCenterSub: {
    ...typography.label,
    fontSize: 10,
  },
  legendWrapper: {
    flex: 1,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  legendPercent: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#FFF',
  },
  historySection: {
    paddingHorizontal: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAllText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '600',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txBgGreen: { backgroundColor: colors.accentMuted },
  txBgRed: { backgroundColor: colors.red + '22' },
  txPair: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  txTime: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textSecondary,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 6,
  },
  txAmountGreen: { color: colors.accent },
  txAmountRed: { color: colors.red },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: { backgroundColor: colors.accentMuted },
  statusPending: { backgroundColor: colors.yellow + '33' },
  statusText: {
    ...typography.bodySmall,
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextCompleted: { color: colors.accent },
  statusTextPending: { color: colors.yellow },
});
