import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton, Card, Toast, NetworkErrorScreen } from '../../components';
import { marketService, walletService, tradeService, transactionService, portfolioService } from '../../services/apiService';

export const DemoTradingScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [selectedSymbol, setSelectedSymbol] = useState(route.params?.symbol || 'JKH.N0000');
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  
  const [walletDetails, setWalletDetails] = useState<any>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<any>(null);
  const [portfolioHoldings, setPortfolioHoldings] = useState<any[]>([]);
  const [liveEquities, setLiveEquities] = useState<any[]>([]);
  const [activeStockPriceLKR, setActiveStockPriceLKR] = useState<number>(205.50);
  const [activeStockChange, setActiveStockChange] = useState<number>(0);
  
  const [amountLKR, setAmountLKR] = useState('');
  const [quantityShares, setQuantityShares] = useState('');
  const [loading, setLoading] = useState(true);
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
        marketService.getAllPricesLKR(),
        transactionService.getTransactions(),
        portfolioService.getPortfolio()
      ]);

      if (walletRes?.success) setWalletDetails(walletRes.data || walletRes);
      if (txRes?.success) setTxHistory((txRes.data || []).slice(0, 10));
      if (portfolioRes?.success) {
        setPortfolioSummary(portfolioRes.data.summary);
        setPortfolioHoldings(portfolioRes.data.holdings || []);
      }

      if (marketRes?.success && marketRes.data?.prices) {
        setLiveEquities(marketRes.data.prices);
        const active = marketRes.data.prices.find((c: any) => c.symbol === selectedSymbol);
        if (active) {
          setActiveStockPriceLKR(active.priceLKR);
          setActiveStockChange(active.changePercent);
        }
      }
      setIsNetworkError(false);
    } catch (error: any) {
      console.error('Error loading demo trading data:', error);
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast('Failed to load live CSE trading data.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTradingData();
    const interval = setInterval(fetchTradingData, 10000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  // Handle amount and quantity updates
  const handleAmountLKRChange = (text: string) => {
    setAmountLKR(text);
    if (!text || isNaN(parseFloat(text)) || activeStockPriceLKR === 0) {
      setQuantityShares('');
      return;
    }
    const val = Math.floor(parseFloat(text) / activeStockPriceLKR);
    setQuantityShares(val > 0 ? val.toString() : '');
  };

  const handleQuantitySharesChange = (text: string) => {
    setQuantityShares(text);
    if (!text || isNaN(parseInt(text, 10)) || activeStockPriceLKR === 0) {
      setAmountLKR('');
      return;
    }
    const val = parseInt(text, 10) * activeStockPriceLKR;
    setAmountLKR(val.toFixed(2));
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
      const available = walletDetails?.availableBalance || walletDetails?.availableBalanceLKR || 0;
      if (buyAmt > available) {
        showToast('Insufficient balance in virtual wallet.', 'warning');
        return;
      }
    } else {
      const sellQty = parseInt(quantityShares, 10);
      if (!sellQty || sellQty <= 0) {
        showToast('Please enter a sell quantity in shares.', 'warning');
        return;
      }
      if (sellQty > getOwnedQuantity()) {
        showToast(`Insufficient share holdings to sell (Owned: ${getOwnedQuantity()}).`, 'warning');
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
        res = await tradeService.sell(selectedSymbol, parseInt(quantityShares, 10));
      }

      if (res?.success) {
        showToast(res.message || 'CSE Trade executed successfully!', 'success');
        setAmountLKR('');
        setQuantityShares('');
        await fetchTradingData();
      } else {
        showToast(res?.message || 'Trade execution failed.', 'error');
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

  const filteredPickerEquities = liveEquities.filter(item => 
    item.symbol.toLowerCase().includes(pickerSearchQuery.toLowerCase())
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
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={colors.accent} size="large" /></View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Header (Fixed at top) */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPickerVisible(!pickerVisible)} style={styles.headerSelector}>
                <Text style={styles.headerTitle}>{selectedSymbol}</Text>
                <MaterialIcons name={pickerVisible ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={22} color={colors.accent} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
              <View style={styles.demoBadge}>
                <View style={styles.demoDot} />
                <Text style={styles.demoBadgeText}>CSE DEMO</Text>
              </View>
            </View>

            {/* Equities Picker Dropdown (Floating Overlay) */}
            {pickerVisible && (
              <View style={styles.pickerDropdownFloating}>
                <View style={styles.pickerSearchContainer}>
                  <MaterialIcons name="search" size={20} color={colors.textSecondary} />
                  <TextInput
                    style={styles.pickerSearchInput}
                    placeholder="Search CSE symbols (JKH, COMB, SAMP...)"
                    placeholderTextColor={colors.textSecondary}
                    value={pickerSearchQuery}
                    onChangeText={setPickerSearchQuery}
                    autoFocus
                  />
                </View>
                <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled">
                  {filteredPickerEquities.map((item) => (
                    <TouchableOpacity
                      key={item.symbol}
                      style={styles.pickerItem}
                      onPress={() => {
                        setSelectedSymbol(item.symbol);
                        setPickerVisible(false);
                        setPickerSearchQuery('');
                        setLoading(true);
                      }}
                    >
                      <Text style={[styles.pickerItemText, selectedSymbol === item.symbol && { color: colors.accent }]}>
                        {item.symbol}
                      </Text>
                      <Text style={styles.pickerItemPrice}>
                        Rs {item.priceLKR?.toFixed(2)}
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
                <Text style={styles.balanceLabel}>Virtual Demo Portfolio</Text>
                <View style={styles.pnlBadge}>
                  <Text style={[styles.pnlText, (portfolioSummary?.unrealizedProfitLoss || 0) >= 0 ? { color: colors.accent } : { color: colors.red }]}>
                    {(portfolioSummary?.unrealizedProfitLoss || 0) >= 0 ? '+' : ''}{portfolioSummary?.profitLossPercent?.toFixed(2) || '0.00'}% PnL
                  </Text>
                </View>
              </View>
              <Text style={styles.balanceValue}>
                LKR {(portfolioSummary?.totalPortfolioValue || walletDetails?.availableBalance || 1000000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <View style={styles.balanceFooter}>
                <Text style={styles.balanceFooterLabel}>
                  Available Cash: <Text style={{ color: '#FFF', fontWeight: '700' }}>LKR {(walletDetails?.availableBalance || walletDetails?.availableBalanceLKR || 1000000).toLocaleString()}</Text>
                </Text>
              </View>
            </Card>

            {/* Active Equities Ticker Card */}
            <Card style={styles.priceCard}>
              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.stockSymbolTitle}>{selectedSymbol}</Text>
                  <Text style={styles.stockSub}>Colombo Stock Exchange Regular Market</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.stockPriceLarge}>Rs {activeStockPriceLKR.toFixed(2)}</Text>
                  <Text style={[styles.stockChangeLarge, activeStockChange >= 0 ? { color: colors.accent } : { color: colors.red }]}>
                    {activeStockChange >= 0 ? '+' : ''}{activeStockChange?.toFixed(2)}%
                  </Text>
                </View>
              </View>
            </Card>

            {/* Trade Side Tabs (BUY / SELL) */}
            <View style={styles.tradeTypeContainer}>
              <TouchableOpacity
                style={[styles.tradeTypeBtn, tradeType === 'BUY' && styles.tradeTypeBtnBuyActive]}
                onPress={() => setTradeType('BUY')}
              >
                <Text style={[styles.tradeTypeBtnText, tradeType === 'BUY' && { color: '#000', fontWeight: '700' }]}>
                  BUY {selectedSymbol.split('.')[0]}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tradeTypeBtn, tradeType === 'SELL' && styles.tradeTypeBtnSellActive]}
                onPress={() => setTradeType('SELL')}
              >
                <Text style={[styles.tradeTypeBtnText, tradeType === 'SELL' && { color: '#FFF', fontWeight: '700' }]}>
                  SELL {selectedSymbol.split('.')[0]}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Input Form */}
            <Card style={styles.tradeFormCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ORDER VALUE (LKR)</Text>
                <TextInput
                  style={styles.tradeInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={amountLKR}
                  onChangeText={handleAmountLKRChange}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>QUANTITY (INTEGER SHARES)</Text>
                <TextInput
                  style={styles.tradeInput}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={quantityShares}
                  onChangeText={handleQuantitySharesChange}
                />
                <Text style={styles.sharesOwnedNote}>
                  Shares in Portfolio: {getOwnedQuantity().toLocaleString()}
                </Text>
              </View>

              <View style={styles.actionBtnRow}>
                <PrimaryButton
                  title={tradeLoading ? "Executing CSE Order..." : `${tradeType} ${selectedSymbol.split('.')[0]}`}
                  onPress={handleOpenConfirmation}
                  disabled={tradeLoading}
                  style={tradeType === 'SELL' ? { backgroundColor: colors.red } : undefined}
                />
              </View>
            </Card>

            {/* Recent Executed Demo Trades */}
            <View style={{ marginTop: 24 }}>
              <Text style={styles.sectionHeaderTitle}>Recent CSE Transactions</Text>
              {txHistory.length > 0 ? (
                txHistory.map((tx, idx) => (
                  <View key={idx} style={styles.txRow}>
                    <View>
                      <Text style={styles.txSymbol}>{tx.TYPE || tx.type} · {tx.SYMBOL || tx.symbol || 'CSE'}</Text>
                      <Text style={styles.txDate}>{new Date(tx.CREATED_AT || tx.createdAt || Date.now()).toLocaleDateString()}</Text>
                    </View>
                    <Text style={[styles.txValue, (tx.TYPE === 'BUY' || tx.type === 'BUY') ? { color: colors.accent } : { color: colors.red }]}>
                      LKR {Number(tx.AMOUNT || tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginVertical: 8 }}>
                  No demo trades executed yet. Place an order above.
                </Text>
              )}
            </View>

            <View style={{ height: 60 }} />
          </ScrollView>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Confirmation Modal */}
      <Modal visible={confirmModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Card style={styles.confirmModalCard}>
            <Text style={styles.modalTitle}>Confirm CSE {tradeType} Order</Text>
            <Text style={styles.modalSub}>Colombo Stock Exchange Paper Trading Engine</Text>

            <View style={styles.confirmDetailRow}>
              <Text style={styles.confirmLabel}>EQUITY:</Text>
              <Text style={styles.confirmValue}>{selectedSymbol}</Text>
            </View>
            <View style={styles.confirmDetailRow}>
              <Text style={styles.confirmLabel}>SIDE:</Text>
              <Text style={[styles.confirmValue, { color: tradeType === 'BUY' ? colors.accent : colors.red }]}>{tradeType}</Text>
            </View>
            <View style={styles.confirmDetailRow}>
              <Text style={styles.confirmLabel}>EXECUTION PRICE:</Text>
              <Text style={styles.confirmValue}>Rs {activeStockPriceLKR.toFixed(2)}</Text>
            </View>
            <View style={styles.confirmDetailRow}>
              <Text style={styles.confirmLabel}>QUANTITY:</Text>
              <Text style={styles.confirmValue}>{quantityShares} Shares</Text>
            </View>
            <View style={styles.confirmDetailRow}>
              <Text style={styles.confirmLabel}>TOTAL VALUE:</Text>
              <Text style={styles.confirmValue}>LKR {parseFloat(amountLKR).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setConfirmModalVisible(false)}
                disabled={tradeLoading}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, tradeType === 'SELL' && { backgroundColor: colors.red }]}
                onPress={handleExecuteTrade}
                disabled={tradeLoading}
              >
                <Text style={[styles.confirmBtnText, tradeType === 'SELL' && { color: '#FFF' }]}>
                  {tradeLoading ? "Executing..." : `Confirm ${tradeType}`}
                </Text>
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
  keyboardAvoiding: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: '#FFF',
  },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  demoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginRight: 4,
  },
  demoBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent,
  },
  pickerDropdownFloating: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 999,
    elevation: 10,
  },
  pickerSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  pickerSearchInput: {
    flex: 1,
    paddingVertical: 8,
    color: '#FFF',
    fontSize: 13,
    marginLeft: 6,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemText: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600',
  },
  pickerItemPrice: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  balanceCard: {
    padding: 16,
    marginBottom: 16,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  balanceLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  pnlBadge: {
    backgroundColor: colors.bgInput,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pnlText: {
    fontSize: 11,
    fontWeight: '700',
  },
  balanceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  balanceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceFooterLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  priceCard: {
    padding: 16,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockSymbolTitle: {
    ...typography.h3,
    color: '#FFF',
  },
  stockSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stockPriceLarge: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  stockChangeLarge: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  tradeTypeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  tradeTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeTypeBtnBuyActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tradeTypeBtnSellActive: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  tradeTypeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tradeFormCard: {
    padding: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  tradeInput: {
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sharesOwnedNote: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  actionBtnRow: {
    marginTop: 8,
  },
  sectionHeaderTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txSymbol: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  txDate: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  txValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  confirmModalCard: {
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
  confirmDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  confirmLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  confirmValue: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
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
