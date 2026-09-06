import * as React from 'react';
const { useState, useEffect } = React;
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton, Card } from '../../components';
import { marketService } from '../../services/apiService';

export const CurrencyConversionScreen = () => {
  const navigation = useNavigation<any>();
  const [fromAmount, setFromAmount] = useState('150000');
  const [toAmount, setToAmount] = useState('0');
  const [rate, setRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLkrToUsd, setIsLkrToUsd] = useState(true);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const response = await marketService.getPriceLKR('BTCUSDT'); // We just need the usdToLkr rate
        if (response.success) {
          setRate(response.data.usdToLkr);
          // Initial calculation
          const initialTo = (150000 / response.data.usdToLkr).toFixed(2);
          setToAmount(initialTo);
        }
      } catch (error) {
        console.error('Failed to fetch rate:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRate();
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
    setIsLkrToUsd(!isLkrToUsd);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
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
          <Text style={styles.headerTitle}>Currency Converter</Text>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="settings" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>
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
                    <MaterialIcons name="arrow-drop-down" size={20} color="#FFF" />
                  </View>
                </View>
                <TextInput
                  style={styles.amountInput}
                  value={fromAmount}
                  onChangeText={handleFromChange}
                  keyboardType="numeric"
                />
                <Text style={styles.balanceText}>Balance: {isLkrToUsd ? '245,000.00 LKR' : '1,250.00 USD'}</Text>
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
                    <MaterialIcons name="arrow-drop-down" size={20} color="#FFF" />
                  </View>
                </View>
                <TextInput
                  style={[styles.amountInput, styles.amountInputGreen]}
                  value={toAmount}
                  editable={false}
                />
                <Text style={styles.balanceText}>
                  1 {isLkrToUsd ? 'LKR' : 'USD'} ≈ {isLkrToUsd ? (1 / rate).toFixed(6) : rate.toFixed(2)} {isLkrToUsd ? 'USD' : 'LKR'}
                </Text>
              </View>
            </View>

            {/* Rate Pill */}
            <View style={styles.ratePillContainer}>
              <View style={styles.ratePill}>
                <MaterialIcons name="trending-up" size={16} color={colors.textSecondary} />
                <Text style={styles.ratePillText}>LIVE RATE: 1 USD = Rs {rate.toFixed(2)}</Text>
              </View>
            </View>

            <View style={styles.fakeChartArea} />

          </View>
        )}

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <Card style={styles.confirmCard}>
            <View style={styles.confirmHeader}>
              <MaterialIcons name="check-circle" size={24} color={colors.accent} />
              <Text style={styles.confirmTitle}>Conversion Ready</Text>
            </View>
            <Text style={styles.confirmDesc}>
              Convert {parseFloat(fromAmount).toLocaleString()} {isLkrToUsd ? 'LKR' : 'USD'} to your {isLkrToUsd ? 'USD' : 'LKR'} wallet instantly.
            </Text>
          </Card>

          <PrimaryButton
            title="Convert Now"
            onPress={() => { }}
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
    marginBottom: 32,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    ...typography.h3,
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
    marginBottom: 32,
  },
  fromCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  toCard: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 24,
    paddingTop: 40,
    marginTop: -20,
    zIndex: -1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flagCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  currencyCode: {
    ...typography.body,
    fontWeight: '700',
    marginRight: 4,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFF',
    padding: 0,
    marginBottom: 12,
  },
  amountInputGreen: {
    color: colors.accent,
  },
  balanceText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  swapButtonWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -28,
    marginTop: -28,
    zIndex: 10,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratePillContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratePillText: {
    ...typography.label,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  fakeChartArea: {
    flex: 1,
    // Add blurred chart background in future implementation
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  confirmCard: {
    marginBottom: 24,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.accent,
    marginLeft: 8,
  },
  confirmDesc: {
    ...typography.bodySmall,
    lineHeight: 22,
  },
});
