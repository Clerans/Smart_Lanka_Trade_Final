import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton, Card } from '../../components';

export const DemoTradingScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>BTC / LKR</Text>
            <View style={styles.demoBadge}>
              <View style={styles.demoDot} />
              <Text style={styles.demoBadgeText}>RISK-FREE SIMULATION</Text>
            </View>
          </View>

          {/* Virtual Balance Card */}
          <Card style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>VIRTUAL BALANCE</Text>
              <TouchableOpacity>
                <MaterialIcons name="refresh" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceValue}>LKR 1,000,000</Text>
            <Text style={styles.balanceSubtitle}>+0.00% (Today)</Text>
          </Card>

          {/* Live Price & Chart */}
          <View style={styles.chartSection}>
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.livePrice}>28,450,000</Text>
                <Text style={styles.liveChange}>+2.45%</Text>
              </View>
              <View style={styles.timeFilter}>
                {['1H', '1D', '1W'].map(t => (
                  <TouchableOpacity key={t} style={[styles.timeBtn, t === '1H' && styles.timeBtnActive]}>
                    <Text style={[styles.timeText, t === '1H' && styles.timeTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.chartContainer}>
              <Svg height="120" width="100%" viewBox="0 0 300 120" preserveAspectRatio="none">
                <Path
                  d="M0 80 Q 30 60, 60 70 T 120 40 T 180 90 T 240 20 T 300 30"
                  fill="none"
                  stroke={colors.accent}
                  strokeWidth="2"
                />
              </Svg>
            </View>
          </View>

          {/* Trade Form Card */}
          <Card style={styles.formCard}>
            <View style={styles.tradeTabs}>
              <TouchableOpacity style={[styles.tradeTab, styles.tradeTabActive]}>
                <Text style={styles.tradeTabTextActive}>BUY</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tradeTab}>
                <Text style={styles.tradeTabText}>SELL</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>ORDER TYPE</Text>
            <View style={styles.dropdownInput}>
              <Text style={styles.inputText}>Market Order</Text>
              <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.textSecondary} />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>AMOUNT (BTC)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={{ width: 16 }} />
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>TOTAL (LKR)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            <View style={styles.balanceInfoRow}>
              <Text style={styles.availableText}>Available: 1,000,000 LKR</Text>
              <TouchableOpacity>
                <Text style={styles.maxBuyText}>Max Buy</Text>
              </TouchableOpacity>
            </View>

            <PrimaryButton title="EXECUTE VIRTUAL TRADE ⚡" onPress={() => { }} />
          </Card>

          {/* Virtual History */}
          <View style={styles.historySection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>VIRTUAL HISTORY</Text>
              <TouchableOpacity><Text style={styles.seeAllText}>View All</Text></TouchableOpacity>
            </View>

            <View style={styles.txRow}>
              <View style={styles.txLeft}>
                <View style={[styles.txIconContainer, styles.txBgGreen]}>
                  <MaterialIcons name="call-received" size={20} color={colors.accent} />
                </View>
                <View>
                  <Text style={styles.txPair}>Buy BTC</Text>
                  <Text style={styles.txTime}>Today, 10:42 AM</Text>
                </View>
              </View>
              <View style={styles.txRight}>
                <Text style={[styles.txAmount, styles.txAmountGreen]}>+0.0052 BTC</Text>
                <Text style={styles.txTime}>+LKR 145,000</Text>
              </View>
            </View>

            <View style={styles.txRow}>
              <View style={styles.txLeft}>
                <View style={[styles.txIconContainer, styles.txBgRed]}>
                  <MaterialIcons name="call-made" size={20} color={colors.red} />
                </View>
                <View>
                  <Text style={styles.txPair}>Sell BTC</Text>
                  <Text style={styles.txTime}>Yesterday, 2:15 PM</Text>
                </View>
              </View>
              <View style={styles.txRight}>
                <Text style={[styles.txAmount, styles.txAmountRed]}>-0.0120 BTC</Text>
                <Text style={styles.txTime}>-LKR 340,000</Text>
              </View>
            </View>
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
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    ...typography.body,
    fontWeight: '700',
    flex: 1,
    marginLeft: 8,
  },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  demoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: 6,
  },
  demoBadgeText: {
    ...typography.label,
    fontSize: 10,
  },
  balanceCard: {
    marginHorizontal: 24,
    marginBottom: 32,
    backgroundColor: '#161616',
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    ...typography.label,
    color: colors.accent,
  },
  balanceValue: {
    ...typography.price,
    marginBottom: 8,
  },
  balanceSubtitle: {
    ...typography.bodySmall,
  },
  chartSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  livePrice: {
    ...typography.h2,
    fontSize: 28,
  },
  liveChange: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '700',
    marginTop: 4,
  },
  timeFilter: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusPill,
    padding: 4,
  },
  timeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: layout.borderRadiusPill,
  },
  timeBtnActive: {
    backgroundColor: colors.accent,
  },
  timeText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  timeTextActive: {
    color: '#000',
  },
  chartContainer: {
    height: 120,
    width: '100%',
    marginVertical: 16,
  },
  formCard: {
    marginHorizontal: 24,
    marginBottom: 32,
  },
  tradeTabs: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  tradeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  tradeTabActive: {
    borderBottomColor: colors.accent,
  },
  tradeTabText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tradeTabTextActive: {
    ...typography.body,
    fontWeight: '700',
    color: colors.accent,
  },
  dropdownInput: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusSmall,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inputText: {
    ...typography.body,
    color: colors.textPrimary,
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
  balanceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  availableText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  maxBuyText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '600',
  },
  historySection: {
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    ...typography.label,
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
});
