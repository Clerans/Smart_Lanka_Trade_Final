import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton, Card, Toast, NetworkErrorScreen } from '../../components';
import { marketService, walletService, tradeService, transactionService, portfolioService } from '../../services/apiService';

export const DemoTradingScreen = () => {
  const navigation = useNavigation<any>();
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  
  const [walletDetails, setWalletDetails] = useState<any>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<any>(null);
  const [portfolioHoldings, setPortfolioHoldings] = useState<any[]>([]);
  const [liveCoins, setLiveCoins] = useState<any[]>([]);
  const [activeCoinPriceLKR, setActiveCoinPriceLKR] = useState<number>(0);
  const [activeCoinChange, setActiveCoinChange] = useState<number>(0);
  
  const [amountLKR, setAmountLKR] = useState('');
  const [quantityCoin, setQuantityCoin] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [txHistory, setTxHistory] = useState<any[]>([]);
  
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  
  // Toast & Network states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [lastAction, setLastAction] = useState<'fetch' | 'trade'>('fetch');

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const fetchTradingData = async () => {
    try {
      const [walletRes, marketRes, txRes, portfolioRes] = await Promise.all([
        walletService.getWalletDetails(),
        marketService.getLivePrices(),
        transactionService.getTransactions(),
        portfolioService.getPortfolio()
      ]);

      if (walletRes.success) setWalletDetails(walletRes);
      if (txRes.success) setTxHistory(txRes.data.slice(0, 10)); // Show top 10 recent
      if (portfolioRes.success) {
        setPortfolioSummary(portfolioRes.data.summary);
        setPortfolioHoldings(portfolioRes.data.holdings);
      }

      if (marketRes.success) {
        setLiveCoins(marketRes.data);
        const active = marketRes.data.find((c: any) => c.symbol === selectedSymbol);
        if (active) {
          setActiveCoinPriceLKR(active.priceLKR);
          setActiveCoinChange(active.change24h);
        }
      }
      setIsNetworkError(false);
    } catch (error: any) {
      console.error('Error loading demo trading data:', error);
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast('Failed to load live trading data.', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTradingData();
  };

  useEffect(() => {
    fetchTradingData();
    const interval = setInterval(fetchTradingData, 10000); // 10s refresh rate
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  // Handle amount and quantity updates
  const handleAmountLKRChange = (text: string) => {
    setAmountLKR(text);
    if (!text || isNaN(parseFloat(text)) || activeCoinPriceLKR === 0) {
      setQuantityCoin('');
      return;
    }
    const val = parseFloat(text) / activeCoinPriceLKR;
    setQuantityCoin(val.toFixed(6));
  };

  const handleQuantityCoinChange = (text: string) => {
    setQuantityCoin(text);
    if (!text || isNaN(parseFloat(text)) || activeCoinPriceLKR === 0) {
      setAmountLKR('');
      return;
    }
    const val = parseFloat(text) * activeCoinPriceLKR;
    setAmountLKR(Math.round(val).toString());
  };

  const getOwnedQuantity = () => {
    const asset = portfolioHoldings.find(h => h.symbol === selectedSymbol);
    return asset ? asset.quantity : 0;
  };

  const handleOpenConfirmation = () => {
    if (tradeType === 'BUY') {
      const buyAmt = parseFloat(amountLKR);
      if (!buyAmt || buyAmt <= 0) {
        showToast('Please enter a purchase amount in LKR', 'warning');
        return;
      }
      if (walletDetails && buyAmt > walletDetails.availableBalance) {
        showToast('Insufficient balance in virtual wallet.', 'warning');
        return;
      }
    } else {
      const sellQty = parseFloat(quantityCoin);
      if (!sellQty || sellQty <= 0) {
        showToast('Please enter a sell quantity.', 'warning');
        return;
      }
      if (sellQty > getOwnedQuantity()) {
        showToast(`Insufficient asset holdings to sell.`, 'warning');
        return;
      }
    }
    setConfirmModalVisible(true);
  };

  const handleExecuteTrade = async () => {
    setConfirmModalVisible(false);
    setTradeLoading(true);
    setIsNetworkError(false);
    setLastAction('trade');

    try {
      let res;
      if (tradeType === 'BUY') {
        res = await tradeService.buy(selectedSymbol, parseFloat(amountLKR));
      } else {
        res = await tradeService.sell(selectedSymbol, parseFloat(quantityCoin));
      }

      if (res.success) {
        showToast(res.message || 'Trade executed successfully!', 'success');
        setAmountLKR('');
        setQuantityCoin('');
        await fetchTradingData();
      }
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast(error.message || 'Trade execution failed.', 'error');
      }
    } finally {
      setTradeLoading(false);
    }
  };

  const filteredPickerCoins = liveCoins.filter(coin => 
    coin.coin.toLowerCase().includes(pickerSearchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {isNetworkError && <NetworkErrorScreen onRetry={lastAction === 'fetch' ? fetchTradingData : handleExecuteTrade} />}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.accent} size="large" /></View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Header (Fixed at top) */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPickerVisible(!pickerVisible)} style={styles.headerSelector}>
                <Text style={styles.headerTitle}>{selectedSymbol.replace('USDT', '')} / LKR</Text>
                <MaterialIcons name={pickerVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={22} color={colors.accent} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
              <View style={styles.demoBadge}>
                <View style={styles.demoDot} />
                <Text style={styles.demoBadgeText}>DEMO</Text>
              </View>
            </View>

            {/* Coin Picker Dropdown (Floating Overlay) */}
            {pickerVisible && (
              <View style={styles.pickerDropdownFloating}>
                <View style={styles.pickerSearchContainer}>
                  <MaterialIcons name="search" size={20} color={colors.textSecondary} />
                  <TextInput
                    style={styles.pickerSearchInput}
                    placeholder="Search symbols..."
                    placeholderTextColor={colors.textSecondary}
                    value={pickerSearchQuery}
                    onChangeText={setPickerSearchQuery}
                    autoFocus
                  />
                </View>
                <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
                  {filteredPickerCoins.map((coin) => (
                    <TouchableOpacity
                      key={coin.symbol}
                      style={styles.pickerItem}
                      onPress={() => {
                        setSelectedSymbol(coin.symbol);
                        setPickerVisible(false);
                        setPickerSearchQuery('');
                        setLoading(true);
                      }}
                    >
                      <Text style={[styles.pickerItemText, selectedSymbol === coin.symbol && { color: colors.accent }]}>
                        {coin.coin} / LKR
                      </Text>
                      <Text style={styles.pickerItemPrice}>
                        Rs {coin.priceLKR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

            {/* Virtual Balance Card */}
            <Card style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <Text style={styles.balanceLabel}>VIRTUAL BALANCE</Text>
                <TouchableOpacity onPress={fetchTradingData}>
                  <MaterialIcons name="refresh" size={20} color={colors.accent} />
                </TouchableOpacity>
              </View>
              <Text style={styles.balanceValue}>
                LKR {walletDetails ? walletDetails.balanceLKR.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '1,000,000.00'}
              </Text>
              <Text style={[
                styles.balanceSubtitle,
                portfolioSummary && portfolioSummary.todaysProfit >= 0 ? { color: colors.accent } : { color: colors.red }
              ]}>
                PNL: {portfolioSummary && portfolioSummary.todaysProfit >= 0 ? '+' : ''}{portfolioSummary ? portfolioSummary.todaysProfit.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'} LKR ({portfolioSummary ? (portfolioSummary.profitLossPercent >= 0 ? '+' : '') + portfolioSummary.profitLossPercent.toFixed(2) : '0.00'}%)
              </Text>
            </Card>

            {/* Live Price & Chart */}
            <View style={styles.chartSection}>
              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.livePrice}>
                    Rs {activeCoinPriceLKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.liveChange, activeCoinChange >= 0 ? { color: colors.accent } : { color: colors.red }]}>
                    {activeCoinChange >= 0 ? '+' : ''}{activeCoinChange.toFixed(2)}%
                  </Text>
                </View>
                <View style={styles.timeFilter}>
                  {['1H', '1D', '1W'].map(t => (
                    <TouchableOpacity key={t} style={[styles.timeBtn, t === '1D' && styles.timeBtnActive]}>
                      <Text style={[styles.timeText, t === '1D' && styles.timeTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.chartContainer}>
                <Svg height="120" width="100%" viewBox="0 0 300 120" preserveAspectRatio="none">
                  <Path
                    d={activeCoinChange >= 0 
                      ? "M0 100 Q 50 80, 100 90 T 200 40 T 300 20"
                      : "M0 20 Q 50 40, 100 30 T 200 80 T 300 100"
                    }
                    fill="none"
                    stroke={activeCoinChange >= 0 ? colors.accent : colors.red}
                    strokeWidth="2.5"
                  />
                </Svg>
              </View>
            </View>

            {/* Trade Form Card */}
            <Card style={styles.formCard}>
              <View style={styles.tradeTabs}>
                <TouchableOpacity
                  style={[
                    styles.tradeTab,
                    tradeType === 'BUY' ? styles.tradeTabBuyActive : styles.tradeTabInactive
                  ]}
                  onPress={() => {
                    setTradeType('BUY');
                    setAmountLKR('');
                    setQuantityCoin('');
                  }}
                >
                  <Text style={[styles.tradeTabText, tradeType === 'BUY' && styles.tradeTabTextBuyActive]}>BUY</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tradeTab,
                    tradeType === 'SELL' ? styles.tradeTabSellActive : styles.tradeTabInactive
                  ]}
                  onPress={() => {
                    setTradeType('SELL');
                    setAmountLKR('');
                    setQuantityCoin('');
                  }}
                >
                  <Text style={[styles.tradeTabText, tradeType === 'SELL' && styles.tradeTabTextSellActive]}>SELL</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>ORDER TYPE</Text>
              <View style={styles.dropdownInput}>
                <Text style={styles.inputText}>Market Order</Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={colors.textSecondary} />
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>AMOUNT ({selectedSymbol.replace('USDT', '')})</Text>
                  <TextInput
                    style={styles.input}
                    value={quantityCoin}
                    onChangeText={handleQuantityCoinChange}
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
                    value={amountLKR}
                    onChangeText={handleAmountLKRChange}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.balanceInfoRow}>
                <Text style={styles.availableText}>
                  {tradeType === 'BUY' 
                    ? `Available: ${walletDetails ? walletDetails.availableBalance.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '1,000,000'} LKR`
                    : `Holding: ${getOwnedQuantity().toFixed(6)} ${selectedSymbol.replace('USDT', '')}`
                  }
                </Text>
                <TouchableOpacity onPress={() => {
                  if (tradeType === 'BUY') {
                    if (walletDetails) {
                      handleAmountLKRChange(walletDetails.availableBalance.toString());
                    }
                  } else {
                    handleQuantityCoinChange(getOwnedQuantity().toString());
                  }
                }}>
                  <Text style={styles.maxBuyText}>{tradeType === 'BUY' ? 'Max Buy' : 'Max Sell'}</Text>
                </TouchableOpacity>
              </View>

              {tradeLoading ? (
                <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 16 }} />
              ) : (
                <PrimaryButton 
                  title={tradeType === 'BUY' ? 'EXECUTE VIRTUAL BUY ⚡' : 'EXECUTE VIRTUAL SELL ⚡'} 
                  onPress={handleOpenConfirmation} 
                  style={tradeType === 'SELL' && { backgroundColor: colors.red }}
                />
              )}
            </Card>

            {/* Virtual History */}
            <View style={styles.historySection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>VIRTUAL HISTORY</Text>
                <TouchableOpacity onPress={fetchTradingData}><Text style={styles.seeAllText}>Refresh</Text></TouchableOpacity>
              </View>

              {txHistory.length > 0 ? (
                txHistory.map((tx) => (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={styles.txLeft}>
                      <View style={[
                        styles.txIconContainer,
                        tx.action === 'BUY' || tx.action === 'DEPOSIT' ? styles.txBgGreen : styles.txBgRed
                      ]}>
                        <MaterialIcons 
                          name={tx.action === 'BUY' || tx.action === 'DEPOSIT' ? 'call-received' : 'call-made'} 
                          size={20} 
                          color={tx.action === 'BUY' || tx.action === 'DEPOSIT' ? colors.accent : colors.red} 
                        />
                      </View>
                      <View>
                        <Text style={styles.txPair}>{tx.action} {tx.coin}</Text>
                        <Text style={styles.txTime}>{new Date(tx.date).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</Text>
                      </View>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={[
                        styles.txAmount,
                        tx.action === 'BUY' || tx.action === 'DEPOSIT' ? styles.txAmountGreen : styles.txAmountRed
                      ]}>
                        {tx.action === 'BUY' || tx.action === 'DEPOSIT' ? '+' : '-'}{tx.quantity.toFixed(4)} {tx.coin}
                      </Text>
                      <Text style={styles.txTotalVal}>LKR {tx.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyHistory}>
                  <Text style={styles.emptyText}>No virtual trading history yet.</Text>
                </View>
              )}
            </View>

          </ScrollView>
        </View>
      )}
    </KeyboardAvoidingView>

      {/* Confirmation Modal */}
      <Modal
        visible={confirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfirmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Simulated Order</Text>
            <Text style={styles.modalText}>
              Are you sure you want to {tradeType === 'BUY' ? 'buy' : 'sell'}{' '}
              <Text style={{ fontWeight: '700', color: colors.accent }}>
                {parseFloat(quantityCoin).toFixed(6)} {selectedSymbol.replace('USDT', '')}
              </Text>{' '}
              for{' '}
              <Text style={{ fontWeight: '700', color: colors.accent }}>
                LKR {parseFloat(amountLKR).toLocaleString()}
              </Text>?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalConfirmBtn, tradeType === 'SELL' && { backgroundColor: colors.red }]} 
                onPress={handleExecuteTrade}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  headerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
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
    padding: 24,
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
    fontWeight: '600',
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
    padding: 24,
  },
  tradeTabs: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusPill,
    padding: 4,
  },
  tradeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: layout.borderRadiusPill,
  },
  tradeTabInactive: {
    backgroundColor: 'transparent',
  },
  tradeTabBuyActive: {
    backgroundColor: colors.accent,
  },
  tradeTabSellActive: {
    backgroundColor: colors.red,
  },
  tradeTabText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tradeTabTextBuyActive: {
    color: '#000',
  },
  tradeTabTextSellActive: {
    color: '#FFF',
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
    color: colors.textSecondary,
    letterSpacing: 1.5,
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
    marginBottom: 4,
  },
  txAmountGreen: { color: colors.accent },
  txAmountRed: { color: colors.red },
  txTotalVal: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  emptyHistory: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  pickerDropdown: {
    marginHorizontal: 24,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerDropdownFloating: {
    position: 'absolute',
    top: 70,
    left: 24,
    right: 24,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 999,
    elevation: 10,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pickerItemPrice: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
  },
  pickerSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    paddingHorizontal: 12,
    margin: 8,
    height: 40,
  },
  pickerSearchInput: {
    ...typography.bodySmall,
    flex: 1,
    marginLeft: 8,
    color: colors.textPrimary,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    width: '100%',
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: 16,
    color: '#FFF',
    textAlign: 'center',
  },
  modalText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    marginLeft: 8,
    backgroundColor: colors.accent,
  },
  modalConfirmText: {
    ...typography.body,
    color: '#000',
    fontWeight: '700',
  },
});
