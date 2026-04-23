import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton, Card } from '../../components';

export const TradingTerminalScreen = () => {
  const navigation = useNavigation<any>();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <MaterialIcons name="trending-up" size={24} color={colors.accent} />
              <Text style={styles.logoText}>SmartLanka</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconBtn}>
                <MaterialIcons name="notifications-none" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.avatar}>
                <MaterialIcons name="person" size={20} color={colors.accent} />
              </View>
            </View>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggleContainer}>
            <TouchableOpacity
              style={[styles.modeToggleBtn, !isDemoMode && styles.modeToggleActive]}
              onPress={() => setIsDemoMode(false)}
            >
              <Text style={[styles.modeText, !isDemoMode && styles.modeTextActive]}>Real Mode</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeToggleBtn, isDemoMode && styles.modeToggleActive]}
              onPress={() => {
                setIsDemoMode(true);
                navigation.navigate('DemoTrading');
              }}
            >
              <Text style={[styles.modeText, isDemoMode && styles.modeTextActive]}>Demo Mode</Text>
            </TouchableOpacity>
          </View>

          {/* Asset Selector */}
          <Card style={styles.assetSelector}>
            <Text style={styles.assetSelectorText}>BTC / LKR</Text>
            <MaterialIcons name="keyboard-arrow-down" size={24} color={colors.textPrimary} />
          </Card>

          {/* Trade Form */}
          <View style={styles.tradeTabs}>
            <TouchableOpacity
              style={[styles.tradeTab, tradeType === 'BUY' && styles.tradeTabBuy]}
              onPress={() => setTradeType('BUY')}
            >
              <Text style={[styles.tradeTabText, tradeType === 'BUY' && styles.tradeTabTextBuy]}>BUY</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tradeTab, tradeType === 'SELL' && styles.tradeTabSell]}
              onPress={() => setTradeType('SELL')}
            >
              <Text style={[styles.tradeTabText, tradeType === 'SELL' && styles.tradeTabTextSell]}>SELL</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.orderForm}>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>QUANTITY (BTC)</Text>
                <TextInput
                  style={styles.input}
                  defaultValue="0.0025"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={{ width: 16 }} />
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>LIMIT PRICE (LKR)</Text>
                <TextInput
                  style={styles.input}
                  defaultValue="18450000"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            <Card style={styles.totalCard}>
              <View>
                <Text style={styles.totalLabel}>Estimated Total</Text>
                <Text style={styles.totalValue}>46,125.00 LKR</Text>
              </View>
              <TouchableOpacity style={styles.calcIcon}>
                <MaterialIcons name="calculate" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </Card>

            <PrimaryButton
              title={tradeType === 'BUY' ? 'CONFIRM BUY ORDER →' : 'CONFIRM SELL ORDER →'}
              onPress={() => { }}
              style={tradeType === 'SELL' ? { backgroundColor: colors.red } : {}}
            />
          </View>

          {/* Recent Transactions */}
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity><Text style={styles.seeAllText}>View All</Text></TouchableOpacity>
            </View>

            {[
              { id: 1, type: 'Buy', pair: 'BTC/LKR', amount: '+0.0015 BTC', status: 'Completed', isBuy: true },
              { id: 2, type: 'Sell', pair: 'ETH/LKR', amount: '-0.2400 ETH', status: 'Pending', isBuy: false },
              { id: 3, type: 'Buy', pair: 'SOL/LKR', amount: '+12.50 SOL', status: 'Completed', isBuy: true },
            ].map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={styles.txLeft}>
                  <View style={[styles.txIconContainer, tx.isBuy ? styles.txBgGreen : styles.txBgRed]}>
                    <MaterialIcons
                      name={tx.isBuy ? 'call-received' : 'call-made'}
                      size={20}
                      color={tx.isBuy ? colors.accent : colors.red}
                    />
                  </View>
                  <View>
                    <Text style={styles.txPair}>{tx.pair}</Text>
                    <Text style={styles.txTime}>Today, {tx.type}</Text>
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
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardAvoiding: {
    flex: 1,
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    ...typography.body,
    fontWeight: '700',
    marginLeft: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    marginRight: 16,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusPill,
    padding: 4,
    marginBottom: 24,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: layout.borderRadiusPill,
    alignItems: 'center',
  },
  modeToggleActive: {
    backgroundColor: colors.textPrimary,
  },
  modeText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '600',
  },
  modeTextActive: {
    color: colors.bg,
  },
  assetSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    paddingVertical: 16,
    marginBottom: 24,
  },
  assetSelectorText: {
    ...typography.body,
    fontWeight: '700',
  },
  tradeTabs: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 16,
  },
  tradeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: layout.borderRadiusPill,
    backgroundColor: colors.bgInput,
  },
  tradeTabBuy: {
    backgroundColor: colors.accent,
  },
  tradeTabSell: {
    backgroundColor: colors.red,
  },
  tradeTabText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tradeTabTextBuy: {
    color: colors.bg,
  },
  tradeTabTextSell: {
    color: colors.textPrimary,
  },
  orderForm: {
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    ...typography.label,
    marginBottom: 8,
    color: colors.textSecondary,
  },
  input: {
    ...typography.body,
    height: 48,
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusSmall,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    fontWeight: '600',
  },
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    marginBottom: 24,
  },
  totalLabel: {
    ...typography.label,
    marginBottom: 8,
  },
  totalValue: {
    ...typography.h2,
    color: colors.accent,
  },
  calcIcon: {
    padding: 8,
  },
  recentSection: {
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '700',
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
