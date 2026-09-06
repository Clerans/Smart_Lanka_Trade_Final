import * as React from 'react';
const { useState, useEffect } = React;
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton, Card } from '../../components';
import { marketService, walletService } from '../../services/apiService';

export const CurrencyConversionScreen = () => {
  const navigation = useNavigation<any>();
  const [fromAmount, setFromAmount] = useState('150000');
  const [toAmount, setToAmount] = useState('0');
  const [rate, setRate] = useState(310.50);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [isLkrToUsd, setIsLkrToUsd] = useState(true);
  const [lkrBalance, setLkrBalance] = useState<number>(1000000);
  const [usdBalance, setUsdBalance] = useState<number>(2500);

  const loadData = async () => {
    try {
      setLoading(true);
      const [forexRes, walletRes] = await Promise.all([
        marketService.getForexRates(),
        walletService.getOverview()
      ]);

      if (forexRes?.success && forexRes?.data?.rates?.USD_LKR) {
        const liveRate = forexRes.data.rates.USD_LKR;
        setRate(liveRate);
        const initialTo = (150000 / liveRate).toFixed(2);
        setToAmount(initialTo);
      }

      if (walletRes?.success && walletRes?.data) {
        setLkrBalance(walletRes.data.availableBalanceLKR || walletRes.data.cashBalanceLKR || 1000000);
        setUsdBalance(walletRes.data.usdBalance || 2500);
      }
    } catch (error) {
      console.error('Failed to fetch conversion rate/balances:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFromChange = (value: string) => {
    setFromAmount(value);
    const num = parseFloat(value);
    if (!isNaN(num) && rate > 0) {
      if (isLkrToUsd) {
        setToAmount((num / rate).toFixed(2));
      } else {
        setToAmount((num * rate).toFixed(2));
      }
    } else {
      setToAmount('0');
    }
  };

  const toggleDirection = () => {
    const nextIsLkrToUsd = !isLkrToUsd;
    setIsLkrToUsd(nextIsLkrToUsd);
    const prevTo = toAmount;
    setFromAmount(prevTo);
    const num = parseFloat(prevTo);
    if (!isNaN(num) && rate > 0) {
      if (nextIsLkrToUsd) {
        setToAmount((num / rate).toFixed(2));
      } else {
        setToAmount((num * rate).toFixed(2));
      }
    } else {
      setToAmount('0');
    }
  };

  const handleConvert = async () => {
    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to convert.');
      return;
    }

    const available = isLkrToUsd ? lkrBalance : usdBalance;
    const fromCur = isLkrToUsd ? 'LKR' : 'USD';
    const toCur = isLkrToUsd ? 'USD' : 'LKR';

    if (amount > available) {
      Alert.alert('Insufficient Balance', `You have ${available.toLocaleString()} ${fromCur} available.`);
      return;
    }

    try {
      setConverting(true);
      const res = await walletService.convertCurrency({
        fromCurrency: fromCur,
        toCurrency: toCur,
        amount
      });

      if (res?.success) {
        Alert.alert(
          'Conversion Successful',
          `Successfully converted ${amount.toLocaleString()} ${fromCur} to ${res.data.convertedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${toCur} at rate ${res.data.exchangeRate.toFixed(2)}.`
        );
        loadData();
      } else {
        Alert.alert('Conversion Failed', res?.message || 'Could not complete currency conversion.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || error.message || 'Currency conversion request failed.');
    } finally {
      setConverting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>LKR / USD Forex Hub</Text>
          <TouchableOpacity onPress={loadData} style={styles.iconBtn}>
            <MaterialIcons name="refresh" size={24} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <View style={styles.content}>

            {/* Converter Cards Container */}
            <View style={styles.converterContainer}>

              {/* FROM Card */}
              <View style={styles.fromCard}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.label}>FROM</Text>
                  <View style={styles.currencyPill}>
                    <View style={[styles.flagCircle, { backgroundColor: isLkrToUsd ? '#1A5BFF' : '#26A17B' }]} />
                    <Text style={styles.currencyCode}>{isLkrToUsd ? 'LKR' : 'USD'}</Text>
                  </View>
                </View>
                <TextInput
                  style={styles.amountInput}
                  value={fromAmount}
                  onChangeText={handleFromChange}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.balanceText}>
                  Available: {isLkrToUsd ? `${lkrBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} LKR` : `${usdBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD`}
                </Text>
              </View>

              {/* Swap Button Wrapper */}
              <View style={styles.swapButtonWrapper}>
                <TouchableOpacity style={styles.swapButton} onPress={toggleDirection}>
                  <MaterialIcons name="swap-vert" size={28} color="#000" />
                </TouchableOpacity>
              </View>

              {/* TO Card */}
              <View style={styles.toCard}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.label}>TO</Text>
                  <View style={styles.currencyPill}>
                    <View style={[styles.flagCircle, { backgroundColor: isLkrToUsd ? '#26A17B' : '#1A5BFF' }]} />
                    <Text style={styles.currencyCode}>{isLkrToUsd ? 'USD' : 'LKR'}</Text>
                  </View>
                </View>
                <TextInput
                  style={[styles.amountInput, styles.amountInputGreen]}
                  value={toAmount}
                  editable={false}
                />
                <Text style={styles.balanceText}>
                  1 {isLkrToUsd ? 'USD' : 'LKR'} = {isLkrToUsd ? `Rs ${rate.toFixed(2)}` : `$${(1 / rate).toFixed(6)}`}
                </Text>
              </View>
            </View>

            {/* Rate Pill */}
            <View style={styles.ratePillContainer}>
              <View style={styles.ratePill}>
                <MaterialIcons name="trending-up" size={16} color={colors.accent} />
                <Text style={styles.ratePillText}>CBSL BENCHMARK: 1 USD = Rs {rate.toFixed(2)}</Text>
              </View>
            </View>

          </View>
        )}

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <Card style={styles.confirmCard}>
            <View style={styles.confirmHeader}>
              <MaterialIcons name="verified-user" size={22} color={colors.accent} />
              <Text style={styles.confirmTitle}>Zero-Fee Institutional Rate</Text>
            </View>
            <Text style={styles.confirmDesc}>
              Instant conversion between Sri Lankan Rupee (LKR) and US Dollar (USD) for international portfolio diversification.
            </Text>
          </Card>

          <PrimaryButton
            title={converting ? "Converting..." : `Convert to ${isLkrToUsd ? 'USD' : 'LKR'}`}
            onPress={handleConvert}
            disabled={converting || loading}
          />
        </View>

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
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    ...typography.h3,
    color: '#FFF',
  },
  iconBtn: {
    padding: 8,
    marginRight: -8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  converterContainer: {
    position: 'relative',
    gap: 16,
  },
  fromCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  flagCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 6,
  },
  currencyCode: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
  },
  amountInput: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
    padding: 0,
  },
  amountInputGreen: {
    color: colors.accent,
  },
  balanceText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  swapButtonWrapper: {
    alignItems: 'center',
    marginVertical: -24,
    zIndex: 10,
  },
  swapButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.bg,
  },
  ratePillContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  ratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratePillText: {
    ...typography.label,
    color: colors.accent,
    marginLeft: 8,
    fontWeight: '700',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  confirmCard: {
    marginBottom: 16,
    padding: 16,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 8,
  },
  confirmDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
