import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, layout, SCREEN_PADDING, TAB_BAR_BOTTOM_OFFSET } from '../../theme';
import { PrimaryButton, Card, Toast, TransactionDetailsModal } from '../../components';
import {
  marketService,
  aiService,
  tradeService,
  walletService,
  portfolioService,
  transactionService,
} from '../../services/apiService';
import { formatLKR } from '../../utils/formatters';

const { useState, useEffect, useCallback } = React;

export const TradingTerminalScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [isDemoMode, setIsDemoMode] = useState(false);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [selectedSymbol, setSelectedSymbol] = useState(route.params?.symbol || 'BTCUSDT');
  const [lkrPriceData, setLkrPriceData] = useState<any>(null);
  const [aiRec, setAiRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quantity, setQuantity] = useState('0.00002');
  const [limitPrice, setLimitPrice] = useState('27680438');
  const [showPicker, setShowPicker] = useState(false);
  const [allCoins, setAllCoins] = useState<any[]>([]);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');

  // Financial & Trading States
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [portfolioHoldings, setPortfolioHoldings] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals
  const [insufficientModalVisible, setInsufficientModalVisible] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    visible: boolean;
    tradeType: 'BUY' | 'SELL';
    quantity: number;
    coinName: string;
    total: number;
    price: number;
    isDemo: boolean;
  }>({
    visible: false,
    tradeType: 'BUY',
    quantity: 0,
    coinName: '',
    total: 0,
    price: 0,
    isDemo: false,
  });

  // Transaction Receipt Modal
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [isTxModalVisible, setIsTxModalVisible] = useState(false);

  // Toast Notification State
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  }, []);

  // Update selected symbol if route params change
  useEffect(() => {
    if (route.params?.symbol && route.params.symbol !== selectedSymbol) {
      setSelectedSymbol(route.params.symbol);
    }
  }, [route.params?.symbol]);

  // Fetch Live Coin Price & AI Recommendation
  const fetchPriceAndAI = useCallback(async () => {
    try {
      const [priceRes, aiRes] = await Promise.allSettled([
        marketService.getPriceLKR(selectedSymbol),
        aiService.getRecommendation(selectedSymbol, '1h'),
      ]);

      if (priceRes.status === 'fulfilled' && priceRes.value?.success) {
        setLkrPriceData(priceRes.value.data);
        const price = priceRes.value.data.priceLKR;
        const formattedPrice = price < 10
          ? price.toFixed(4)
          : Math.round(price).toString();
        setLimitPrice(formattedPrice);
      }
      if (aiRes.status === 'fulfilled' && aiRes.value?.data) {
        setAiRec(aiRes.value.data);
      }
    } catch (error) {
      console.error('Failed to fetch price and AI data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSymbol]);

  // Fetch User Financial Data (Wallet Balance, Portfolio Holdings, Recent Transactions)
  const fetchUserData = useCallback(async () => {
    try {
      const [walletRes, portfolioRes, txRes] = await Promise.allSettled([
        walletService.getBalance(),
        portfolioService.getPortfolio(),
        transactionService.getTransactions(),
      ]);

      if (walletRes.status === 'fulfilled' && walletRes.value) {
        const val = walletRes.value;
        const bal = val.data ? val.data.balance : (val.availableBalance ?? val.balanceLKR ?? 0);
        setWalletBalance(parseFloat(bal) || 0);
      }

      if (portfolioRes.status === 'fulfilled' && portfolioRes.value?.success && portfolioRes.value.data) {
        setPortfolioHoldings(portfolioRes.value.data.holdings || []);
      }

      if (txRes.status === 'fulfilled' && txRes.value?.success && txRes.value.data) {
        setRecentTransactions(txRes.value.data || []);
      }
    } catch (error) {
      console.warn('Failed to load user financial data:', error);
    }
  }, []);

  // Fetch list of tradeable coins for picker
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const liveRes = await marketService.getLivePrices();
        if (liveRes.success && Array.isArray(liveRes.data)) {
          setAllCoins(liveRes.data);
        } else {
          const allRes = await marketService.getAllPricesLKR();
          if (allRes.success && allRes.data?.prices) {
            setAllCoins(allRes.data.prices);
          }
        }
      } catch (error) {
        try {
          const allRes = await marketService.getAllPricesLKR();
          if (allRes.success && allRes.data?.prices) {
            setAllCoins(allRes.data.prices);
          }
        } catch (err) {
          console.error('Failed to fetch all coins:', err);
        }
      }
    };
    fetchInitialData();
  }, []);

  // Initial and recurring load
  useEffect(() => {
    fetchPriceAndAI();
    fetchUserData();
    const interval = setInterval(() => {
      fetchPriceAndAI();
      fetchUserData();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchPriceAndAI, fetchUserData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      fetchPriceAndAI(),
      fetchUserData(),
    ]);
    setRefreshing(false);
  };

  // Find owned quantity for selected symbol
  const getOwnedQuantity = useCallback(() => {
    const holding = portfolioHoldings.find(
      (h: any) => h.symbol === selectedSymbol || h.SYMBOL === selectedSymbol
    );
    if (!holding) return 0;
    return parseFloat(holding.quantity || holding.QUANTITY || 0);
  }, [portfolioHoldings, selectedSymbol]);

  // Quick percentage handler (25%, 50%, 75%, 100%)
  const handleQuickPercent = (percent: number) => {
    const currentPrice = parseFloat(limitPrice) || (lkrPriceData?.priceLKR ?? 0);
    if (currentPrice <= 0) {
      showToast('Limit price is not available. Please enter a limit price.', 'warning');
      return;
    }

    if (tradeType === 'BUY') {
      const balance = (walletBalance !== null && walletBalance > 0) ? walletBalance : 1000000;
      const budget = balance * percent;
      const calculatedQty = budget / currentPrice;
      const formattedQty = calculatedQty < 0.0001
        ? calculatedQty.toFixed(6)
        : calculatedQty < 1
          ? calculatedQty.toFixed(5)
          : calculatedQty.toFixed(4);
      setQuantity(formattedQty);
    } else {
      const owned = getOwnedQuantity();
      if (owned <= 0) {
        showToast(`You have 0 ${selectedSymbol.replace('USDT', '')} in your holdings.`, 'warning');
        return;
      }
      const calculatedQty = owned * percent;
      const formattedQty = calculatedQty < 0.0001
        ? calculatedQty.toFixed(6)
        : calculatedQty < 1
          ? calculatedQty.toFixed(5)
          : calculatedQty.toFixed(4);
      setQuantity(formattedQty);
    }
  };

  // Execute Order (Real or Demo Simulation)
  const handleExecuteTrade = async (forceDemo: boolean = false) => {
    const numQty = parseFloat(quantity);
    const numPrice = parseFloat(limitPrice);

    if (!quantity || isNaN(numQty) || numQty <= 0) {
      showToast('Please enter a valid quantity greater than zero.', 'warning');
      return;
    }

    if (!limitPrice || isNaN(numPrice) || numPrice <= 0) {
      showToast('Please enter a valid limit price greater than zero.', 'warning');
      return;
    }

    const orderTotal = numQty * numPrice;
    const coinName = selectedSymbol.replace('USDT', '');
    setIsSubmitting(true);

    try {
      // 1. If Demo Mode is active or forced via Resolution Modal
      if (isDemoMode || forceDemo) {
        // Create simulated completed transaction record
        const simulatedTx = {
          id: Date.now(),
          action: tradeType,
          type: tradeType === 'BUY' ? 'Buy' : 'Sell',
          coin: coinName,
          symbol: selectedSymbol,
          quantity: numQty,
          price: numPrice,
          total: orderTotal,
          date: new Date().toISOString(),
          status: 'COMPLETED',
          isDemo: true,
        };

        // Prepend to recent transactions immediately
        setRecentTransactions((prev) => [simulatedTx, ...prev]);

        // Update local portfolio holdings
        setPortfolioHoldings((prev) => {
          const existing = prev.find(
            (h: any) => h.symbol === selectedSymbol || h.SYMBOL === selectedSymbol
          );
          if (tradeType === 'BUY') {
            if (existing) {
              const prevQty = parseFloat(existing.quantity || existing.QUANTITY || 0);
              return prev.map((h: any) =>
                h.symbol === selectedSymbol || h.SYMBOL === selectedSymbol
                  ? { ...h, quantity: prevQty + numQty }
                  : h
              );
            } else {
              return [
                ...prev,
                {
                  symbol: selectedSymbol,
                  quantity: numQty,
                  averagePrice: numPrice,
                  investedAmount: orderTotal,
                },
              ];
            }
          } else {
            if (existing) {
              const prevQty = parseFloat(existing.quantity || existing.QUANTITY || 0);
              const remaining = Math.max(0, prevQty - numQty);
              return prev.map((h: any) =>
                h.symbol === selectedSymbol || h.SYMBOL === selectedSymbol
                  ? { ...h, quantity: remaining }
                  : h
              );
            }
            return prev;
          }
        });

        // Update simulated wallet balance
        if (tradeType === 'BUY') {
          setWalletBalance((prev) => Math.max(0, (prev ?? 1000000) - orderTotal));
        } else {
          setWalletBalance((prev) => (prev ?? 0) + orderTotal);
        }

        setInsufficientModalVisible(false);
        setSuccessModalData({
          visible: true,
          tradeType,
          quantity: numQty,
          coinName,
          total: orderTotal,
          price: numPrice,
          isDemo: true,
        });

        showToast(
          `Demo Order Executed! ${tradeType === 'BUY' ? 'Purchased' : 'Sold'} ${numQty} ${coinName}`,
          'success'
        );
        return;
      }

      // 2. Real Mode pre-check: if live balance is explicitly known to be 0 or insufficient
      const currentBal = walletBalance ?? 0;
      if (tradeType === 'BUY' && walletBalance !== null && currentBal < orderTotal) {
        setInsufficientModalVisible(true);
        setIsSubmitting(false);
        return;
      }

      const owned = getOwnedQuantity();
      if (tradeType === 'SELL' && numQty > owned) {
        showToast(
          `Insufficient crypto holdings. You hold ${owned} ${coinName}.`,
          'warning'
        );
        setIsSubmitting(false);
        return;
      }

      // 3. Execute Real Trade on API
      let res;
      if (tradeType === 'BUY') {
        res = await tradeService.buy(selectedSymbol, orderTotal);
      } else {
        res = await tradeService.sell(selectedSymbol, numQty);
      }

      if (res && res.success) {
        setSuccessModalData({
          visible: true,
          tradeType,
          quantity: numQty,
          coinName,
          total: orderTotal,
          price: numPrice,
          isDemo: false,
        });
        showToast(
          res.message || `Successfully executed ${tradeType} order for ${numQty} ${coinName}!`,
          'success'
        );
        await Promise.allSettled([fetchUserData(), fetchPriceAndAI()]);
      } else {
        showToast(res?.message || 'Failed to execute trade order.', 'error');
      }
    } catch (error: any) {
      console.error('Trade Execution Error:', error);
      if (error.code === 'INSUFFICIENT_BALANCE') {
        setInsufficientModalVisible(true);
      } else if (error.code === 'EMAIL_NOT_VERIFIED') {
        showToast('Please verify your email before executing live trades.', 'warning');
        setInsufficientModalVisible(true);
      } else if (error.code === 'ASSET_NOT_FOUND') {
        showToast(`You do not hold any ${coinName} to sell.`, 'error');
      } else if (error.code === 'INVALID_SYMBOL') {
        showToast(`Symbol ${selectedSymbol} is currently not supported for trading.`, 'error');
      } else {
        showToast(error.message || 'Trade execution failed.', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPickerCoins = allCoins.filter((coin) =>
    (coin.symbol || coin.coin || '').toLowerCase().includes(pickerSearchQuery.toLowerCase())
  ).slice(0, 50);

  const numQty = parseFloat(quantity) || 0;
  const numPrice = parseFloat(limitPrice) || 0;
  const total = numQty * numPrice;

  return (
    <SafeAreaView style={styles.safeArea}>
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
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: TAB_BAR_BOTTOM_OFFSET }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoRow}>
              <MaterialIcons name="trending-up" size={24} color={colors.accent} />
              <Text style={styles.logoText}>SmartLanka</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Wallet')}>
                <MaterialIcons name="account-balance-wallet" size={22} color={colors.textPrimary} />
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
              onPress={() => {
                setIsDemoMode(false);
                showToast('Switched to Real Trading Mode', 'success');
              }}
            >
              <Text style={[styles.modeText, !isDemoMode && styles.modeTextActive]}>Real Mode</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeToggleBtn, isDemoMode && styles.modeToggleActive]}
              onPress={() => {
                setIsDemoMode(true);
                showToast('Switched to Demo Simulation Mode', 'success');
              }}
            >
              <Text style={[styles.modeText, isDemoMode && styles.modeTextActive]}>Demo Mode</Text>
            </TouchableOpacity>
          </View>

          {/* Asset Selector */}
          <TouchableOpacity onPress={() => setShowPicker(!showPicker)}>
            <Card style={styles.assetSelector}>
              <Text style={styles.assetSelectorText}>{selectedSymbol.replace('USDT', '')} / LKR</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {loading && <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />}
                <MaterialIcons name={showPicker ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={24} color={colors.textPrimary} />
              </View>
            </Card>
          </TouchableOpacity>

          {/* Coin Picker Dropdown */}
          {showPicker && (
            <View style={styles.pickerDropdown}>
              <View style={styles.pickerSearchContainer}>
                <MaterialIcons name="search" size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.pickerSearchInput}
                  placeholder="Search coins (e.g. BTC, ETH, SOL)..."
                  placeholderTextColor={colors.textSecondary}
                  value={pickerSearchQuery}
                  onChangeText={setPickerSearchQuery}
                  autoFocus
                />
              </View>
              <ScrollView style={{ maxHeight: 300 }}>
                {filteredPickerCoins.length > 0 ? (
                  filteredPickerCoins.map((coin) => {
                    const sym = coin.symbol || `${coin.coin}USDT`;
                    const isSelected = selectedSymbol === sym;
                    return (
                      <TouchableOpacity
                        key={sym}
                        style={styles.pickerItem}
                        onPress={() => {
                          setSelectedSymbol(sym);
                          setShowPicker(false);
                          setLoading(true);
                          setPickerSearchQuery('');
                        }}
                      >
                        <Text style={[styles.pickerItemText, isSelected && { color: colors.accent }]}>
                          {sym.replace('USDT', '')} / LKR
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.pickerItemPrice}>
                            Rs {formatLKR(coin.priceLKR || 0, 2)}
                          </Text>
                          {isSelected && <MaterialIcons name="check" size={20} color={colors.accent} style={{ marginLeft: 8 }} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ color: colors.textSecondary }}>No coins found</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {/* Live AI Recommendation Banner */}
          {aiRec && (
            <TouchableOpacity
              style={styles.aiBannerCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('AIAnalytics')}
            >
              <View style={styles.aiBannerLeft}>
                <View style={[
                  styles.aiActionPill,
                  aiRec.recommendation === 'BUY' ? styles.aiPillBuy :
                    aiRec.recommendation === 'SELL' ? styles.aiPillSell : styles.aiPillHold
                ]}>
                  <Text style={styles.aiActionPillText}>AI: {aiRec.recommendation}</Text>
                </View>
                <Text style={styles.aiConfidenceText}>{aiRec.confidence}% Confidence</Text>
                <Text style={styles.aiRiskText}>• {aiRec.risk} RISK</Text>
              </View>
              <View style={styles.aiBannerRight}>
                <Text style={styles.aiDetailsLink}>Analysis →</Text>
              </View>
            </TouchableOpacity>
          )}

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
            {/* Available Balance / Holdings Bar */}
            <View style={styles.availableBar}>
              <View style={styles.availableLeft}>
                <MaterialIcons
                  name={tradeType === 'BUY' ? 'account-balance-wallet' : 'pie-chart'}
                  size={16}
                  color={colors.accent}
                />
                <Text style={styles.availableLabel}>
                  {tradeType === 'BUY'
                    ? (isDemoMode ? 'Demo Balance:' : 'Available Balance:')
                    : 'Available Holdings:'}
                </Text>
              </View>
              <Text style={styles.availableValue}>
                {tradeType === 'BUY'
                  ? `Rs ${formatLKR(isDemoMode ? (walletBalance ?? 1000000) : (walletBalance ?? 0), 2)}`
                  : `${getOwnedQuantity()} ${selectedSymbol.replace('USDT', '')}`}
              </Text>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>QUANTITY ({selectedSymbol.replace('USDT', '')})</Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={{ width: 16 }} />
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>LIMIT PRICE (LKR)</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={limitPrice}
                    onChangeText={setLimitPrice}
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TouchableOpacity
                    style={styles.syncBtn}
                    onPress={() => {
                      if (lkrPriceData) setLimitPrice(Math.round(lkrPriceData.priceLKR || 0).toString());
                    }}
                  >
                    <MaterialIcons name="sync" size={20} color={colors.accent} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Quick Percentage Pills */}
            <View style={styles.percentRow}>
              {[0.25, 0.5, 0.75, 1.0].map((pct) => (
                <TouchableOpacity
                  key={pct}
                  style={styles.percentBtn}
                  onPress={() => handleQuickPercent(pct)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.percentBtnText}>{pct === 1.0 ? 'MAX' : `${pct * 100}%`}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Card style={styles.totalCard}>
              <View>
                <Text style={styles.totalLabel}>Estimated Total</Text>
                <Text style={styles.totalValue}>{formatLKR(total, 2)} LKR</Text>
              </View>
              <TouchableOpacity
                style={styles.calcIcon}
                onPress={() => {
                  if (lkrPriceData?.priceLKR) {
                    const price = Math.round(lkrPriceData.priceLKR);
                    setLimitPrice(price.toString());
                  }
                }}
              >
                <MaterialIcons name="calculate" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </Card>

            <PrimaryButton
              title={tradeType === 'BUY' ? 'CONFIRM BUY ORDER →' : 'CONFIRM SELL ORDER →'}
              onPress={() => handleExecuteTrade(false)}
              loading={isSubmitting}
              style={tradeType === 'SELL' ? { backgroundColor: colors.red } : {}}
            />
          </View>

          {/* Recent Transactions */}
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Wallet')}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {recentTransactions.length > 0 ? (
              recentTransactions.slice(0, 5).map((tx: any) => {
                const isBuy = tx.action === 'BUY' || tx.type === 'Buy' || tx.action === 'DEPOSIT';
                const actionLabel = tx.action || tx.type || 'TRADE';
                const coinName = tx.coin || (tx.symbol ? tx.symbol.replace('USDT', '') : 'LKR');
                const qtyStr = tx.quantity ? `${Number(tx.quantity).toFixed(4)} ${coinName}` : `${tx.amount || ''}`;
                const formattedDate = tx.date ? new Date(tx.date).toLocaleDateString() : 'Recent';
                const isCompleted = (tx.status || 'COMPLETED').toUpperCase() === 'COMPLETED';

                return (
                  <TouchableOpacity
                    key={tx.id}
                    style={styles.txRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedTx(tx);
                      setIsTxModalVisible(true);
                    }}
                  >
                    <View style={styles.txLeft}>
                      <View style={[styles.txIconContainer, isBuy ? styles.txBgGreen : styles.txBgRed]}>
                        <MaterialIcons
                          name={isBuy ? 'call-received' : 'call-made'}
                          size={20}
                          color={isBuy ? colors.accent : colors.red}
                        />
                      </View>
                      <View>
                        <Text style={styles.txPair}>{actionLabel} {coinName}/LKR</Text>
                        <Text style={styles.txTime}>{formattedDate} {tx.isDemo ? '• Demo' : ''}</Text>
                      </View>
                    </View>
                    <View style={styles.txRight}>
                      <Text style={[styles.txAmount, isBuy ? styles.txAmountGreen : styles.txAmountRed]}>
                        {isBuy ? '+' : '-'}{qtyStr}
                      </Text>
                      <View style={[styles.statusBadge, isCompleted ? styles.statusCompleted : styles.statusPending]}>
                        <Text style={[styles.statusText, isCompleted ? styles.statusTextCompleted : styles.statusTextPending]}>
                          {tx.status || 'Completed'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyTxBox}>
                <MaterialIcons name="receipt-long" size={32} color={colors.textSecondary} />
                <Text style={styles.emptyTxText}>No recent transactions found.</Text>
                <Text style={styles.emptyTxSub}>Place your first trade above to see it here.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal
        visible={successModalData.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSuccessModalData({ ...successModalData, visible: false })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconCircle}>
              <MaterialIcons name="check" size={36} color="#000000" />
            </View>

            <Text style={styles.successModalTitle}>Order Executed Successfully!</Text>
            <Text style={styles.successModalSubtitle}>
              Your {successModalData.tradeType} order for{' '}
              <Text style={{ color: colors.accent, fontWeight: '700' }}>
                {successModalData.quantity} {successModalData.coinName}
              </Text>{' '}
              has been processed.
            </Text>

            <View style={styles.successReceiptCard}>
              <View style={styles.modalDetailItem}>
                <Text style={styles.modalDetailLabel}>Order Type</Text>
                <Text style={styles.modalDetailValue}>Limit Order ({successModalData.tradeType})</Text>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.modalDetailItem}>
                <Text style={styles.modalDetailLabel}>Execution Price</Text>
                <Text style={styles.modalDetailValue}>Rs {formatLKR(successModalData.price, 2)}</Text>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.modalDetailItem}>
                <Text style={styles.modalDetailLabel}>Total Value</Text>
                <Text style={[styles.modalDetailValue, { color: colors.accent, fontWeight: '800' }]}>
                  Rs {formatLKR(successModalData.total, 2)}
                </Text>
              </View>
              <View style={styles.modalDivider} />
              <View style={styles.modalDetailItem}>
                <Text style={styles.modalDetailLabel}>Status</Text>
                <Text style={[styles.modalDetailValue, { color: colors.accent }]}>
                  COMPLETED {successModalData.isDemo ? '(DEMO)' : ''}
                </Text>
              </View>
            </View>

            <PrimaryButton
              title="DONE"
              onPress={() => setSuccessModalData({ ...successModalData, visible: false })}
            />
          </View>
        </View>
      </Modal>

      {/* Insufficient Balance / Demo Test Modal */}
      <Modal
        visible={insufficientModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setInsufficientModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.warningIconCircle}>
              <MaterialIcons name="account-balance-wallet" size={32} color={colors.yellow || '#FFA726'} />
            </View>

            <Text style={styles.successModalTitle}>Live Balance Required</Text>
            <Text style={styles.successModalSubtitle}>
              Your live wallet balance is{' '}
              <Text style={{ color: colors.accent, fontWeight: '700' }}>
                Rs {formatLKR(walletBalance || 0, 2)}
              </Text>
              . You need{' '}
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                Rs {formatLKR(total, 2)}
              </Text>{' '}
              to complete this live order.
            </Text>

            <View style={{ gap: 12, marginTop: 12, width: '100%' }}>
              <PrimaryButton
                title="⚡ EXECUTE AS DEMO TEST TRADE"
                onPress={() => handleExecuteTrade(true)}
              />

              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => {
                  setInsufficientModalVisible(false);
                  navigation.navigate('Wallet');
                }}
              >
                <Text style={styles.modalSecondaryBtnText}>💳 Deposit Funds to Wallet</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setInsufficientModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        isVisible={isTxModalVisible}
        onClose={() => {
          setIsTxModalVisible(false);
          setSelectedTx(null);
        }}
        transaction={selectedTx}
      />
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
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    marginBottom: 16,
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
    marginRight: 12,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  modeToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: SCREEN_PADDING,
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusPill,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 13,
  },
  modeTextActive: {
    color: colors.bg,
    fontWeight: '800',
  },
  assetSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: SCREEN_PADDING,
    paddingVertical: 14,
    marginBottom: 16,
  },
  assetSelectorText: {
    ...typography.body,
    fontWeight: '700',
  },
  tradeTabs: {
    flexDirection: 'row',
    marginHorizontal: SCREEN_PADDING,
    marginBottom: 16,
    gap: 8,
  },
  tradeTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: layout.borderRadiusPill,
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeTabBuy: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tradeTabSell: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  tradeTabText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textSecondary,
    fontSize: 14,
  },
  tradeTabTextBuy: {
    color: '#000000',
    fontWeight: '800',
  },
  tradeTabTextSell: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  orderForm: {
    paddingHorizontal: SCREEN_PADDING,
    marginBottom: 24,
  },
  availableBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: layout.borderRadiusSmall,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  availableLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  availableLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  availableValue: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '700',
    fontVariant: ['tabular-nums'] as any,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
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
    borderWidth: 1,
    borderColor: colors.border,
    fontVariant: ['tabular-nums'] as any,
  },
  percentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  percentBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: colors.bgCard,
    borderRadius: layout.borderRadiusSmall,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  percentBtnText: {
    ...typography.bodySmall,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 20,
  },
  totalLabel: {
    ...typography.label,
    marginBottom: 6,
  },
  totalValue: {
    ...typography.h2,
    color: colors.accent,
    fontVariant: ['tabular-nums'] as any,
  },
  calcIcon: {
    padding: 8,
  },
  recentSection: {
    paddingHorizontal: SCREEN_PADDING,
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
  statusPending: { backgroundColor: (colors.yellow || '#FFA726') + '33' },
  statusText: {
    ...typography.bodySmall,
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextCompleted: { color: colors.accent },
  statusTextPending: { color: colors.yellow || '#FFA726' },
  emptyTxBox: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  emptyTxText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 10,
  },
  emptyTxSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
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
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pickerItemPrice: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 10,
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusSmall,
    paddingRight: 8,
  },
  syncBtn: {
    padding: 8,
  },
  aiBannerCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  aiActionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  aiPillBuy: { backgroundColor: colors.accent },
  aiPillSell: { backgroundColor: colors.red },
  aiPillHold: { backgroundColor: colors.yellow || '#FFA726' },
  aiActionPillText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 11,
  },
  aiConfidenceText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 12,
    marginRight: 6,
  },
  aiRiskText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  aiBannerRight: {
    marginLeft: 8,
  },
  aiDetailsLink: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web'
      ? {
          position: 'fixed' as any,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw' as any,
          height: '100vh' as any,
          zIndex: 99999,
        }
      : {}),
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderRadius: 24,
    width: '100%',
    maxWidth: 440,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  warningIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: (colors.yellow || '#FFA726') + '22',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.yellow || '#FFA726',
  },
  successModalTitle: {
    ...typography.h3,
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  successModalSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  successReceiptCard: {
    width: '100%',
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusMedium,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  modalDetailLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  modalDetailValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'] as any,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  modalSecondaryBtn: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.accent,
    width: '100%',
  },
  modalSecondaryBtnText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.accent,
  },
  modalCancelBtn: {
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    width: '100%',
  },
  modalCancelText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
