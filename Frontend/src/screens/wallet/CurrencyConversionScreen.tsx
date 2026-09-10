import * as React from 'react';
const { useState, useEffect } = React;
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert
} from 'react-native';
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
  const [rate, setRate] = useState(328.08);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLkrToUsd, setIsLkrToUsd] = useState(true);
  const [converting, setConverting] = useState(false);

  const fetchRate = async () => {
    try {
      const response = await marketService.getPriceLKR('BTCUSDT');
      if (response.success && response.data.usdToLkr) {
        const liveRate = response.data.usdToLkr;
        setRate(liveRate);
        const num = parseFloat(fromAmount) || 0;
        if (isLkrToUsd) {
          setToAmount((num / liveRate).toFixed(2));
        } else {
          setToAmount((num * liveRate).toFixed(2));
        }
      }
    } catch (error) {
      console.error('Failed to fetch rate:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRate();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRate();
  };

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
    const nextDir = !isLkrToUsd;
    setIsLkrToUsd(nextDir);
    const oldFrom = fromAmount;
    const oldTo = toAmount;
    setFromAmount(oldTo);
    const num = parseFloat(oldTo);
    if (!isNaN(num) && rate > 0) {
      if (nextDir) {
        setToAmount((num / rate).toFixed(2));
      } else {
        setToAmount((num * rate).toFixed(2));
      }
    }
  };

  const handleConvertNow = async () => {
    const num = parseFloat(fromAmount);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to convert.');
      return;
    }

    try {
      setConverting(true);
      // Simulate conversion process
      await new Promise(r => setTimeout(r, 800));
      Alert.alert(
        'Conversion Successful',
        `Successfully converted ${parseFloat(fromAmount).toLocaleString()} ${isLkrToUsd ? 'LKR' : 'USD'} to ${parseFloat(toAmount).toLocaleString()} ${isLkrToUsd ? 'USD' : 'LKR'}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      Alert.alert('Conversion Failed', e.message || 'Could not complete transaction.');
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Currency Converter</Text>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={() => Alert.alert('FX Settings', 'SmartLanka Live Central Bank & Binance CEFTS rate sync enabled.')}>
            <MaterialIcons name="settings" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
          >
            {/* Converter Cards Container */}
            <View style={styles.converterContainer}>
              {/* FROM Card */}
              <View style={styles.converterCard}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.label}>FROM</Text>
                  <TouchableOpacity style={styles.currencyPill} onPress={toggleDirection} activeOpacity={0.8}>
                    <View style={[styles.flagCircle, { backgroundColor: isLkrToUsd ? '#1A5BFF' : '#26A17B' }]} />
                    <Text style={styles.currencyCode}>{isLkrToUsd ? 'LKR' : 'USD'}</Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.amountInput}
                  value={fromAmount}
                  onChangeText={handleFromChange}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.balanceText}>
                  Balance: {isLkrToUsd ? '245,000.00 LKR' : '1,250.00 USD'}
                </Text>
              </View>

              {/* Symmetrical Floating Swap Button */}
              <View style={styles.swapButtonWrapper}>
                <TouchableOpacity style={styles.swapButton} onPress={toggleDirection} activeOpacity={0.85}>
                  <MaterialIcons name="swap-vert" size={24} color="#000000" />
                </TouchableOpacity>
              </View>

              {/* TO Card */}
              <View style={[styles.converterCard, styles.toCard]}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.label}>TO</Text>
                  <TouchableOpacity style={styles.currencyPill} onPress={toggleDirection} activeOpacity={0.8}>
                    <View style={[styles.flagCircle, { backgroundColor: isLkrToUsd ? '#26A17B' : '#1A5BFF' }]} />
                    <Text style={styles.currencyCode}>{isLkrToUsd ? 'USD' : 'LKR'}</Text>
                    <MaterialIcons name="arrow-drop-down" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.amountInput, styles.amountInputGreen]} numberOfLines={1}>
                  {toAmount}
                </Text>
                <Text style={styles.balanceText}>
                  1 {isLkrToUsd ? 'LKR' : 'USD'} ≈ {isLkrToUsd ? (1 / (rate || 328)).toFixed(6) : rate.toFixed(2)} {isLkrToUsd ? 'USD' : 'LKR'}
                </Text>
              </View>
            </View>

            {/* Rate Pill */}
            <View style={styles.ratePillContainer}>
              <View style={styles.ratePill}>
                <MaterialIcons name="trending-up" size={16} color={colors.accent} />
                <Text style={styles.ratePillText}>
                  LIVE RATE: 1 USD = Rs {rate > 0 ? rate.toFixed(2) : '328.08'}
                </Text>
              </View>
            </View>

            {/* Bottom Status & Convert Button */}
            <View style={styles.bottomSection}>
              <Card style={styles.confirmCard}>
                <View style={styles.confirmHeader}>
                  <MaterialIcons name="check-circle" size={22} color={colors.accent} />
                  <Text style={styles.confirmTitle}>Conversion Ready</Text>
                </View>
                <Text style={styles.confirmDesc}>
                  Convert {parseFloat(fromAmount || '0').toLocaleString()} {isLkrToUsd ? 'LKR' : 'USD'} to your {isLkrToUsd ? 'USD' : 'LKR'} wallet instantly.
                </Text>
              </Card>

              <PrimaryButton
                title={converting ? "Converting..." : "Convert Now"}
                onPress={handleConvertNow}
                loading={converting}
              />
            </View>
          </ScrollView>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  iconBtn: {
    padding: 8,
    borderRadius: 8,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  converterContainer: {
    position: 'relative',
    marginTop: 8,
    marginBottom: 20,
  },
  converterCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
  },
  toCard: {
    backgroundColor: colors.bgInput,
    marginTop: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flagCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 6,
  },
  currencyCode: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: 2,
  },
  amountInput: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.textPrimary,
    padding: 0,
    marginVertical: 6,
  },
  amountInputGreen: {
    color: colors.accent,
  },
  balanceText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 4,
  },
  swapButtonWrapper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -22,
    marginTop: -22,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.bg,
  },
  swapButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  ratePillContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  ratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  ratePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  bottomSection: {
    marginTop: 10,
  },
  confirmCard: {
    marginBottom: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    borderRadius: 16,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
    marginLeft: 8,
  },
  confirmDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

