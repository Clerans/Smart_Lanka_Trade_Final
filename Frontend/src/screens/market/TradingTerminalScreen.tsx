import * as React from 'react';
const { useState, useEffect } = React;
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton, Card, Toast, NetworkErrorScreen } from '../../components';
import { marketService, tradeService, transactionService, walletService, portfolioService } from '../../services/apiService';

export const TradingTerminalScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [selectedSymbol, setSelectedSymbol] = useState(route.params?.symbol || 'JKH.N0000');
  const [currentQuote, setCurrentQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [quantity, setQuantity] = useState('100'); // Number of shares
  const [priceLKR, setPriceLKR] = useState('198.50');
  const [showPicker, setShowPicker] = useState(false);
  const [allStocks, setAllStocks] = useState<any[]>([]);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  
  const [walletDetails, setWalletDetails] = useState<any>(null);
  const [portfolioHoldings, setPortfolioHoldings] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  // Toast & Network states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');
  const [isNetworkError, setIsNetworkError] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const loadMarketAndWalletData = async () => {
    try {
      const [marketRes, quoteRes, walletRes, txRes, portRes] = await Promise.all([
        marketService.getAllPricesLKR(),
        marketService.getPriceLKR(selectedSymbol),
        walletService.getWalletDetails(),
        transactionService.getTransactions(),
        portfolioService.getPortfolio()
      ]);

      if (marketRes.success) setAllStocks(marketRes.prices || []);
      if (quoteRes.success && quoteRes.quote) {
        setCurrentQuote(quoteRes.quote);
        setPriceLKR(quoteRes.quote.priceLKR.toFixed(2));
      }
      if (walletRes.success) setWalletDetails(walletRes);
      if (txRes.success) setRecentTransactions(txRes.data.slice(0, 5));
      if (portRes.success) setPortfolioHoldings(portRes.data.holdings || []);
      setIsNetworkError(false);
    } catch (error: any) {
      console.error('Failed to load trading terminal data:', error);
      if (error.code === 'NETWORK_ERROR') {
        setIsNetworkError(true);
      } else {
        showToast('Error loading live market data.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketAndWalletData();
    const interval = setInterval(loadMarketAndWalletData, 15000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const numQty = parseFloat(quantity) || 0;
  const numPrice = parseFloat(priceLKR) || 0;
  const totalAmountLKR = numQty * numPrice;

  const getOwnedQuantity = () => {
    const asset = portfolioHoldings.find(h => h.symbol === selectedSymbol);
    return asset ? asset.quantity : 0;
  };

  const handleValidateAndOpenConfirm = () => {
    if (!numQty || numQty <= 0) {
      showToast('Please enter a valid share quantity.', 'warning');
      return;
    }

    if (tradeType === 'BUY') {
      const available = walletDetails ? walletDetails.availableBalance : 0;
      if (totalAmountLKR > available) {
        showToast(`Insufficient simulated cash. Available: LKR ${available.toLocaleString()}`, 'warning');
        return;
      }
    } else {
      const owned = getOwnedQuantity();
      if (numQty > owned) {
        showToast(`Insufficient shares. You only hold ${owned} shares of ${selectedSymbol}.`, 'warning');
        return;
      }
    }

    setConfirmModalVisible(true);
  };

  const handleExecuteTrade = async () => {
    setConfirmModalVisible(false);
    setTradeLoading(true);
    setIsNetworkError(false);

    try {
      let response;
      if (tradeType === 'BUY') {
        response = await tradeService.buy(selectedSymbol, totalAmountLKR, numQty);
      } else {
        response = await tradeService.sell(selectedSymbol, numQty);
      }

      if (response.success) {
        showToast(response.message || 'Simulated trade executed successfully!', 'success');
        await loadMarketAndWalletData();
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

  const filteredPickerStocks = allStocks.filter(stock => 
    stock.companyName.toLowerCase().includes(pickerSearchQuery.toLowerCase()) ||
    stock.symbol.toLowerCase().includes(pickerSearchQuery.toLowerCase()) ||
    stock.sector.toLowerCase().includes(pickerSearchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {isNetworkError && <NetworkErrorScreen onRetry={loadMarketAndWalletData} />}
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
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <MaterialIcons name="trending-up" size={24} color={colors.accent} />
              <Text style={styles.logoText}>SmartLanka Trade</Text>
            </View>
            <View style={styles.demoBadge}>
              <View style={styles.demoDot} />
              <Text style={styles.demoBadgeText}>CSE SIMULATION</Text>
            </View>
          </View>

          {/* Asset Selector */}
          <TouchableOpacity onPress={() => setShowPicker(!showPicker)}>
            <Card style={styles.assetSelector}>
              <View>
                <Text style={styles.assetSelectorText}>{currentQuote?.companyName || selectedSymbol}</Text>
                <Text style={styles.assetSelectorSub}>{selectedSymbol} • {currentQuote?.sector || 'CSE Equities'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.selectorPrice}>Rs {parseFloat(priceLKR).toFixed(2)}</Text>
                <MaterialIcons name={showPicker ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color={colors.accent} style={{ marginLeft: 8 }} />
              </View>
            </Card>
          </TouchableOpacity>

          {/* Stock Picker Dropdown */}
          {showPicker && (
            <View style={styles.pickerDropdown}>
              <View style={styles.pickerSearchContainer}>
                <MaterialIcons name="search" size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.pickerSearchInput}
                  placeholder="Search CSE stock name or symbol (e.g. JKH, COMB)..."
                  placeholderTextColor={colors.textSecondary}
                  value={pickerSearchQuery}
                  onChangeText={setPickerSearchQuery}
                  autoFocus
                />
              </View>
              <ScrollView style={{ maxHeight: 250 }} keyboardShouldPersistTaps="handled">
                {filteredPickerStocks.map((stock) => (
                  <TouchableOpacity 
                    key={stock.symbol} 
                    style={styles.pickerItem} 
                    onPress={() => {
                      setSelectedSymbol(stock.symbol);
                      setShowPicker(false);
                      setPickerSearchQuery('');
                      setPriceLKR(stock.priceLKR.toFixed(2));
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickerItemText, selectedSymbol === stock.symbol && { color: colors.accent }]}>
                        {stock.companyName}
                      </Text>
                      <Text style={styles.pickerItemSub}>{stock.symbol} • {stock.sector}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.pickerItemPrice}>Rs {stock.priceLKR.toFixed(2)}</Text>
                      <Text style={[styles.pickerItemChange, stock.changePercent >= 0 ? { color: colors.accent } : { color: colors.red }]}>
                        {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Trade Form */}
          <View style={styles.tradeTabs}>
            <TouchableOpacity
              style={[styles.tradeTab, tradeType === 'BUY' && styles.tradeTabBuy]}
              onPress={() => setTradeType('BUY')}
            >
              <Text style={[styles.tradeTabText, tradeType === 'BUY' && styles.tradeTabTextBuy]}>BUY SHARES</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tradeTab, tradeType === 'SELL' && styles.tradeTabSell]}
              onPress={() => setTradeType('SELL')}
            >
              <Text style={[styles.tradeTabText, tradeType === 'SELL' && styles.tradeTabTextSell]}>SELL SHARES</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.orderForm}>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>SHARE QUANTITY</Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder="100"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={{ width: 16 }} />
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>MARKET PRICE (LKR)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bgElevated }]}
                  value={priceLKR}
                  editable={false}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            {/* Balances info */}
            <View style={styles.balanceInfoRow}>
              <Text style={styles.availableText}>
                {tradeType === 'BUY' 
                  ? `Simulated Cash Available: LKR ${walletDetails ? walletDetails.availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '1,000,000.00'}`
                  : `Shares Owned: ${getOwnedQuantity()} shares`
                }
              </Text>
              <TouchableOpacity onPress={() => {
                if (tradeType === 'BUY') {
                  if (walletDetails && numPrice > 0) {
                    const maxShares = Math.floor(walletDetails.availableBalance / numPrice);
                    setQuantity(maxShares.toString());
                  }
                } else {
                  setQuantity(getOwnedQuantity().toString());
                }
              }}>
                <Text style={styles.maxText}>{tradeType === 'BUY' ? 'Max Buy' : 'Max Sell'}</Text>
              </TouchableOpacity>
            </View>

            <Card style={styles.totalCard}>
              <View>
                <Text style={styles.totalLabel}>Estimated Total Order Value</Text>
                <Text style={styles.totalValue}>LKR {isNaN(totalAmountLKR) ? '0.00' : totalAmountLKR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <MaterialIcons name="calculate" size={28} color={colors.accent} />
            </Card>

            {tradeLoading ? (
              <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 16 }} />
            ) : (
              <PrimaryButton
                title={tradeType === 'BUY' ? 'CONFIRM DEMO BUY ORDER →' : 'CONFIRM DEMO SELL ORDER →'}
                onPress={handleValidateAndOpenConfirm}
                style={tradeType === 'SELL' ? { backgroundColor: colors.red } : {}}
              />
            )}
          </View>

          {/* Recent Executed Transactions */}
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Executions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Wallet')}><Text style={styles.seeAllText}>View All History</Text></TouchableOpacity>
            </View>

            {recentTransactions.length > 0 ? (
              recentTransactions.map((tx) => (
                <View key={tx.id || tx.ID} style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <View style={[styles.txIconContainer, tx.action === 'BUY' || tx.TYPE === 'BUY' || tx.TYPE === 'DEPOSIT' ? styles.txBgGreen : styles.txBgRed]}>
                      <MaterialIcons
                        name={tx.action === 'BUY' || tx.TYPE === 'BUY' || tx.TYPE === 'DEPOSIT' ? 'call-received' : 'call-made'}
                        size={20}
                        color={tx.action === 'BUY' || tx.TYPE === 'BUY' || tx.TYPE === 'DEPOSIT' ? colors.accent : colors.red}
                      />
                    </View>
                    <View>
                      <Text style={styles.txPair}>{tx.symbol || tx.SYMBOL || 'CSE Equities'}</Text>
                      <Text style={styles.txTime}>{new Date(tx.date || tx.CREATED_AT).toLocaleDateString()} • {tx.action || tx.TYPE}</Text>
                    </View>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, tx.action === 'BUY' || tx.TYPE === 'BUY' || tx.TYPE === 'DEPOSIT' ? styles.txAmountGreen : styles.txAmountRed]}>
                      {tx.action === 'BUY' || tx.TYPE === 'BUY' || tx.TYPE === 'DEPOSIT' ? '+' : '-'}{tx.quantity || tx.QUANTITY || 1} Shares
                    </Text>
                    <Text style={styles.txTotalVal}>LKR {(tx.total || tx.AMOUNT || 0).toLocaleString()}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No executed transactions yet.</Text>
              </View>
            )}
          </View>

        </ScrollView>
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
            <Text style={styles.modalSubtitle}>Colombo Stock Exchange Demo Execution</Text>
            
            <View style={styles.modalDetailsBox}>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Stock:</Text>
                <Text style={styles.modalDetailValue}>{currentQuote?.companyName || selectedSymbol}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Symbol:</Text>
                <Text style={styles.modalDetailValue}>{selectedSymbol}</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Action:</Text>
                <Text style={[styles.modalDetailValue, { color: tradeType === 'BUY' ? colors.accent : colors.red, fontWeight: '700' }]}>
                  {tradeType}
                </Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Shares:</Text>
                <Text style={styles.modalDetailValue}>{numQty} Shares</Text>
              </View>
              <View style={styles.modalDetailRow}>
                <Text style={styles.modalDetailLabel}>Price / Share:</Text>
                <Text style={styles.modalDetailValue}>LKR {numPrice.toFixed(2)}</Text>
              </View>
              <View style={[styles.modalDetailRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 }]}>
                <Text style={[styles.modalDetailLabel, { fontWeight: '700', color: '#FFF' }]}>Total LKR:</Text>
                <Text style={[styles.modalDetailValue, { fontWeight: '700', color: colors.accent, fontSize: 16 }]}>
                  LKR {totalAmountLKR.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

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
                <Text style={styles.modalConfirmText}>Confirm Order</Text>
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
  assetSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    paddingVertical: 16,
    marginBottom: 16,
  },
  assetSelectorText: {
    ...typography.body,
    fontWeight: '700',
  },
  assetSelectorSub: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  selectorPrice: {
    ...typography.body,
    fontWeight: '700',
    color: colors.accent,
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
  pickerItemSub: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  pickerItemPrice: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 12,
  },
  pickerItemChange: {
    ...typography.bodySmall,
    fontSize: 10,
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
    marginBottom: 32,
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
    marginBottom: 20,
  },
  availableText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
  },
  maxText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '700',
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
    paddingVertical: 14,
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
  txBgGreen: { backgroundColor: colors.accentMuted },
  txBgRed: { backgroundColor: colors.red + '22' },
  txPair: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 2,
    fontSize: 14,
  },
  txTime: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  txAmountGreen: { color: colors.accent },
  txAmountRed: { color: colors.red },
  txTotalVal: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
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
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...typography.label,
    color: colors.accent,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  modalDetailsBox: {
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  modalDetailLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  modalDetailValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: layout.borderRadiusPill,
    backgroundColor: colors.accent,
    marginLeft: 8,
  },
  modalConfirmText: {
    color: '#000',
    fontWeight: '700',
  },
});
