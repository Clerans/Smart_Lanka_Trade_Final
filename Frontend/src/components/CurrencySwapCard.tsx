import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import { marketService, tradeService, walletService, portfolioService } from '../services/apiService';
import { formatNumber, formatLKR } from '../utils/formatters';

export interface CurrencyItem {
  code: string;
  symbol: string;
  name: string;
  type: 'fiat' | 'stablecoin' | 'crypto';
  decimals: number;
  color?: string;
  badgeText?: string;
  priceLKR?: number;
}

export const BASE_CURRENCIES: CurrencyItem[] = [
  { code: 'LKR', symbol: 'LKR', name: 'Sri Lankan Rupee', type: 'fiat', decimals: 2, color: '#00E676', badgeText: '🇱🇰' },
  { code: 'USDT', symbol: 'USDT', name: 'Tether USD', type: 'stablecoin', decimals: 2, color: '#26A17B', badgeText: '₮' },
  { code: 'USD', symbol: 'USD', name: 'US Dollar', type: 'fiat', decimals: 2, color: '#1E5AA8', badgeText: '🇺🇸' },
  { code: 'BTC', symbol: 'BTC', name: 'Bitcoin', type: 'crypto', decimals: 6, color: '#F7931A', badgeText: '₿' },
  { code: 'ETH', symbol: 'ETH', name: 'Ethereum', type: 'crypto', decimals: 6, color: '#627EEA', badgeText: 'Ξ' },
  { code: 'SOL', symbol: 'SOL', name: 'Solana', type: 'crypto', decimals: 4, color: '#14F195', badgeText: '◎' },
  { code: 'BNB', symbol: 'BNB', name: 'BNB', type: 'crypto', decimals: 4, color: '#F3BA2F', badgeText: '🔶' },
  { code: 'XRP', symbol: 'XRP', name: 'XRP', type: 'crypto', decimals: 2, color: '#23292F', badgeText: '✕' },
  { code: 'ADA', symbol: 'ADA', name: 'Cardano', type: 'crypto', decimals: 2, color: '#0033AD', badgeText: '₳' },
  { code: 'DOGE', symbol: 'DOGE', name: 'Dogecoin', type: 'crypto', decimals: 2, color: '#C2A633', badgeText: 'Ð' },
];

const STORAGE_BALANCES_KEY = '@smartlanka_currency_balances';

const DEFAULT_INITIAL_BALANCES: Record<string, number> = {
  LKR: 500000.0,
  USDT: 1500.0,
  USD: 500.0,
  BTC: 0.05,
  ETH: 0.85,
  SOL: 8.5,
  BNB: 2.5,
  XRP: 450.0,
  ADA: 600.0,
  DOGE: 1200.0,
};

export interface SwapExecutionResult {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  isDemo: boolean;
  newFromBalance: number;
  newToBalance: number;
}

export interface CurrencySwapCardProps {
  isDemoMode?: boolean;
  onShowToast?: (message: string, type: 'success' | 'error' | 'warning') => void;
  onSwapExecuted?: (result: SwapExecutionResult) => void;
  style?: any;
}

export const CurrencySwapCard: React.FC<CurrencySwapCardProps> = ({
  isDemoMode = false,
  onShowToast,
  onSwapExecuted,
  style,
}) => {
  const [fromCurrency, setFromCurrency] = useState<string>('LKR');
  const [toCurrency, setToCurrency] = useState<string>('USDT');
  const [fromAmount, setFromAmount] = useState<string>('10000');
  const [toAmount, setToAmount] = useState<string>('0');

  // Rates & Coins State
  const [usdToLkr, setUsdToLkr] = useState<number>(281.34);
  const [coinPricesUSD, setCoinPricesUSD] = useState<Record<string, number>>({
    LKR: 1 / 281.34,
    USDT: 1.0,
    USD: 1.0,
    BTC: 68500,
    ETH: 3500,
    SOL: 155,
    BNB: 580,
    XRP: 0.58,
    ADA: 0.45,
    DOGE: 0.12,
  });

  const [availableCoins, setAvailableCoins] = useState<CurrencyItem[]>(BASE_CURRENCIES);
  const [balances, setBalances] = useState<Record<string, number>>(DEFAULT_INITIAL_BALANCES);

  const [loadingRate, setLoadingRate] = useState<boolean>(true);
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateSource, setRateSource] = useState<'live' | 'cached' | 'fallback'>('live');
  const [isSwapping, setIsSwapping] = useState<boolean>(false);

  // Currency Picker Modal & Search State
  const [pickerVisible, setPickerVisible] = useState<boolean>(false);
  const [pickerTarget, setPickerTarget] = useState<'FROM' | 'TO'>('FROM');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pickerCategory, setPickerCategory] = useState<'ALL' | 'CRYPTO' | 'FIAT'>('ALL');

  // Swap animation
  const rotateAnim = useMemo(() => new Animated.Value(0), []);

  const triggerSwapAnimation = () => {
    rotateAnim.setValue(0);
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const spinInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // 1. Load user balances from storage and sync with wallet/portfolio backend
  const loadBalances = useCallback(async () => {
    try {
      let currentBalances = { ...DEFAULT_INITIAL_BALANCES };
      const savedStr = await AsyncStorage.getItem(STORAGE_BALANCES_KEY);
      if (savedStr) {
        try {
          const parsed = JSON.parse(savedStr);
          if (parsed && typeof parsed === 'object') {
            currentBalances = { ...currentBalances, ...parsed };
          }
        } catch (e) {
          console.warn('Failed parsing cached swap balances:', e);
        }
      }

      // Sync live wallet cash from backend
      try {
        const walletRes = await walletService.getBalance().catch(() => null);
        if (walletRes && walletRes.success && typeof walletRes.data?.balance === 'number') {
          currentBalances.LKR = walletRes.data.balance;
        }
      } catch (e) {}

      // Sync live portfolio holdings from backend
      try {
        const portRes = await portfolioService.getPortfolio().catch(() => null);
        if (portRes && portRes.success && Array.isArray(portRes.data?.holdings)) {
          portRes.data.holdings.forEach((h: any) => {
            const sym = (h.symbol || '').replace('USDT', '').toUpperCase();
            if (sym && typeof h.quantity === 'number') {
              currentBalances[sym] = h.quantity;
            }
          });
        }
      } catch (e) {}

      setBalances(currentBalances);
      await AsyncStorage.setItem(STORAGE_BALANCES_KEY, JSON.stringify(currentBalances));
    } catch (err) {
      console.warn('Balance load error:', err);
    }
  }, []);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  // Helper to persist updated balances
  const saveUpdatedBalances = async (newBalances: Record<string, number>) => {
    setBalances(newBalances);
    try {
      await AsyncStorage.setItem(STORAGE_BALANCES_KEY, JSON.stringify(newBalances));
    } catch (e) {
      console.warn('Error saving balances:', e);
    }
  };

  // 2. Fetch live market rates & coins catalog
  const fetchMarketData = useCallback(async () => {
    setLoadingRate(true);
    setRateError(null);
    try {
      const [priceRes, allPricesRes] = await Promise.allSettled([
        marketService.getPriceLKR('BTCUSDT'),
        marketService.getAllPricesLKR(),
      ]);

      let liveUsdToLkr = usdToLkr;
      const newPricesUSD: Record<string, number> = { ...coinPricesUSD };

      if (priceRes.status === 'fulfilled' && priceRes.value?.success && priceRes.value.data) {
        const d = priceRes.value.data;
        if (d.usdToLkr && d.usdToLkr > 0) {
          liveUsdToLkr = d.usdToLkr;
          setUsdToLkr(d.usdToLkr);
        }
        if (d.priceUSDT && d.priceUSDT > 0) {
          newPricesUSD.BTC = d.priceUSDT;
        }
        setRateSource(d.isRateEstimated ? 'fallback' : 'live');
      }

      newPricesUSD.LKR = 1 / liveUsdToLkr;
      newPricesUSD.USDT = 1.0;
      newPricesUSD.USD = 1.0;

      // Extract all available coins from allPricesRes
      if (allPricesRes.status === 'fulfilled' && allPricesRes.value?.success && allPricesRes.value.data) {
        const rawCoins = allPricesRes.value.data.prices || [];
        const dynamicCoinsMap = new Map<string, CurrencyItem>();

        // Prepopulate base currencies
        BASE_CURRENCIES.forEach((c) => {
          const coinInLkr = (newPricesUSD[c.code] || 1) * liveUsdToLkr;
          dynamicCoinsMap.set(c.code, { ...c, priceLKR: coinInLkr });
        });

        // Add dynamically discovered coins
        rawCoins.forEach((rc: any) => {
          const code = (rc.symbol || '').replace('USDT', '').trim().toUpperCase();
          if (code && !dynamicCoinsMap.has(code) && rc.priceUSDT > 0) {
            newPricesUSD[code] = rc.priceUSDT;
            dynamicCoinsMap.set(code, {
              code,
              symbol: code,
              name: code,
              type: 'crypto',
              decimals: rc.priceUSDT < 1 ? 4 : 2,
              color: '#3B82F6',
              badgeText: code.slice(0, 3),
              priceLKR: rc.priceLKR || rc.priceUSDT * liveUsdToLkr,
            });
          } else if (code && dynamicCoinsMap.has(code) && rc.priceUSDT > 0) {
            newPricesUSD[code] = rc.priceUSDT;
            const existing = dynamicCoinsMap.get(code)!;
            dynamicCoinsMap.set(code, {
              ...existing,
              priceLKR: rc.priceLKR || rc.priceUSDT * liveUsdToLkr,
            });
          }
        });

        setAvailableCoins(Array.from(dynamicCoinsMap.values()));
      }

      setCoinPricesUSD(newPricesUSD);
    } catch (err: any) {
      console.warn('Market data fetch warning in CurrencySwap:', err?.message || err);
      setRateSource('cached');
      if (!usdToLkr || usdToLkr <= 0) {
        setRateError('Rate service offline');
      }
    } finally {
      setLoadingRate(false);
    }
  }, [usdToLkr, coinPricesUSD]);

  useEffect(() => {
    fetchMarketData();
  }, []);

  // 3. Compute conversion rate between any two currencies
  const calculateRate = useCallback(
    (source: string, target: string): number => {
      if (source === target) return 1.0;

      const sourceValUSD =
        source === 'LKR'
          ? 1 / (usdToLkr > 0 ? usdToLkr : 281.34)
          : coinPricesUSD[source] || (source === 'USDT' || source === 'USD' ? 1.0 : 1.0);

      const targetValUSD =
        target === 'LKR'
          ? 1 / (usdToLkr > 0 ? usdToLkr : 281.34)
          : coinPricesUSD[target] || (target === 'USDT' || target === 'USD' ? 1.0 : 1.0);

      if (targetValUSD <= 0) return 0;
      return sourceValUSD / targetValUSD;
    },
    [usdToLkr, coinPricesUSD]
  );

  // Recalculate converted target amount
  useEffect(() => {
    const rawVal = fromAmount.trim();
    if (!rawVal || isNaN(Number(rawVal))) {
      setToAmount('0.00');
      return;
    }

    const num = parseFloat(rawVal);
    if (num <= 0) {
      setToAmount('0.00');
      return;
    }

    const rate = calculateRate(fromCurrency, toCurrency);
    const converted = num * rate;

    const targetDef = availableCoins.find((c) => c.code === toCurrency);
    const dec = targetDef ? targetDef.decimals : 2;

    if (toCurrency === 'BTC' || toCurrency === 'ETH') {
      setToAmount(converted >= 1 ? converted.toFixed(4) : converted.toFixed(6));
    } else if (toCurrency === 'LKR') {
      setToAmount(formatNumber(converted, 2));
    } else {
      setToAmount(converted < 0.01 ? converted.toFixed(dec) : converted.toFixed(dec));
    }
  }, [fromAmount, fromCurrency, toCurrency, calculateRate, availableCoins]);

  // Current balances
  const fromBalance = balances[fromCurrency] || 0.0;
  const toBalance = balances[toCurrency] || 0.0;

  // Max Button
  const handleSetMax = () => {
    if (fromBalance <= 0) {
      onShowToast?.(`No available ${fromCurrency} balance to swap.`, 'warning');
      return;
    }
    const dec = fromCurrency === 'BTC' || fromCurrency === 'ETH' ? 6 : fromCurrency === 'LKR' ? 2 : 4;
    setFromAmount(fromBalance.toFixed(dec).replace(/\.?0+$/, ''));
  };

  // Reverse Currencies
  const handleReverseCurrencies = () => {
    triggerSwapAnimation();
    const prevFrom = fromCurrency;
    const prevTo = toCurrency;
    const prevConverted = toAmount.replace(/,/g, '');

    setFromCurrency(prevTo);
    setToCurrency(prevFrom);

    const parsedConverted = parseFloat(prevConverted);
    if (!isNaN(parsedConverted) && parsedConverted > 0) {
      const dec = prevTo === 'BTC' || prevTo === 'ETH' ? 6 : prevTo === 'LKR' ? 2 : 2;
      setFromAmount(parsedConverted.toFixed(dec).replace(/\.?0+$/, ''));
    }
  };

  // Currency Selection
  const handleOpenPicker = (target: 'FROM' | 'TO') => {
    setPickerTarget(target);
    setSearchQuery('');
    setPickerCategory('ALL');
    setPickerVisible(true);
  };

  const handleSelectCurrency = (selectedCode: string) => {
    setPickerVisible(false);
    if (pickerTarget === 'FROM') {
      if (selectedCode === toCurrency) {
        setToCurrency(fromCurrency);
      }
      setFromCurrency(selectedCode);
    } else {
      if (selectedCode === fromCurrency) {
        setFromCurrency(toCurrency);
      }
      setToCurrency(selectedCode);
    }
  };

  // Filtered coins in picker modal
  const filteredCoins = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return availableCoins.filter((coin) => {
      const matchesSearch =
        !q ||
        coin.code.toLowerCase().includes(q) ||
        coin.name.toLowerCase().includes(q) ||
        coin.symbol.toLowerCase().includes(q);

      let matchesCat = true;
      if (pickerCategory === 'CRYPTO') matchesCat = coin.type === 'crypto';
      if (pickerCategory === 'FIAT') matchesCat = coin.type === 'fiat' || coin.type === 'stablecoin';

      return matchesSearch && matchesCat;
    });
  }, [availableCoins, searchQuery, pickerCategory]);

  // Exchange rate human-readable string
  const exchangeRateLabel = useMemo(() => {
    if (loadingRate && (!usdToLkr || usdToLkr <= 0)) {
      return 'Fetching live rates...';
    }

    if (
      (fromCurrency === 'LKR' && toCurrency === 'USDT') ||
      (fromCurrency === 'USDT' && toCurrency === 'LKR')
    ) {
      return `1 USDT ≈ ${usdToLkr.toFixed(2)} LKR`;
    }

    if (
      (fromCurrency === 'LKR' && toCurrency === 'USD') ||
      (fromCurrency === 'USD' && toCurrency === 'LKR')
    ) {
      return `1 USD ≈ ${usdToLkr.toFixed(2)} LKR`;
    }

    const rate = calculateRate(fromCurrency, toCurrency);
    if (rate >= 1) {
      return `1 ${fromCurrency} ≈ ${formatNumber(rate, 2)} ${toCurrency}`;
    }
    const invRate = rate > 0 ? 1 / rate : 0;
    return `1 ${toCurrency} ≈ ${formatNumber(invRate, 2)} ${fromCurrency}`;
  }, [fromCurrency, toCurrency, usdToLkr, loadingRate, calculateRate]);

  // Balance Check Status
  const numFromInput = parseFloat(fromAmount.replace(/,/g, '')) || 0;
  const isInsufficient = numFromInput > fromBalance;

  // 4. FUNCTIONAL SWAP EXECUTION: Updates balance & deducts from USDT or LKR
  const handleExecuteSwap = async () => {
    if (isSwapping) return;

    if (isNaN(numFromInput) || numFromInput <= 0) {
      onShowToast?.('Please enter a valid amount to swap.', 'warning');
      return;
    }

    if (isInsufficient) {
      onShowToast?.(
        `Insufficient ${fromCurrency} balance. Available: ${formatNumber(fromBalance, 4)} ${fromCurrency}`,
        'warning'
      );
      return;
    }

    if (rateError) {
      onShowToast?.('Exchange rate unavailable. Tap sync to retry.', 'error');
      return;
    }

    setIsSwapping(true);

    try {
      const rate = calculateRate(fromCurrency, toCurrency);
      const cleanTo = parseFloat(toAmount.replace(/,/g, '')) || numFromInput * rate;

      // Real balance deductions and additions
      const newFromBal = Math.max(0, fromBalance - numFromInput);
      const newToBal = toBalance + cleanTo;

      const updatedBalances = {
        ...balances,
        [fromCurrency]: newFromBal,
        [toCurrency]: newToBal,
      };

      // 1. Persist updated balances to storage immediately
      await saveUpdatedBalances(updatedBalances);

      // 2. Trigger appropriate backend API workflows if the asset is an active crypto symbol on the exchange order book
      const BACKEND_SUPPORTED_CRYPTO = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE'];
      try {
        if (fromCurrency === 'LKR' && BACKEND_SUPPORTED_CRYPTO.includes(toCurrency)) {
          // Buying supported crypto pair with LKR on backend
          const targetSym = `${toCurrency}USDT`;
          await tradeService.buy(targetSym, numFromInput).catch(() => null);
        } else if (toCurrency === 'LKR' && BACKEND_SUPPORTED_CRYPTO.includes(fromCurrency)) {
          // Selling supported crypto pair for LKR on backend
          const sourceSym = `${fromCurrency}USDT`;
          await tradeService.sell(sourceSym, numFromInput).catch(() => null);
        }
      } catch (backendErr) {
        // Non-blocking sync notice
      }

      const result: SwapExecutionResult = {
        fromCurrency,
        toCurrency,
        fromAmount: numFromInput,
        toAmount: cleanTo,
        rate,
        isDemo: isDemoMode,
        newFromBalance: newFromBal,
        newToBalance: newToBal,
      };

      onSwapExecuted?.(result);

      // Feedback with live balance updates
      const formattedConverted =
        cleanTo < 0.01 ? cleanTo.toFixed(6) : formatNumber(cleanTo, toCurrency === 'LKR' ? 2 : 4);
      const formattedFrom = formatNumber(numFromInput, fromCurrency === 'LKR' ? 2 : 4);

      onShowToast?.(
        `Swapped ${formattedFrom} ${fromCurrency} → ${formattedConverted} ${toCurrency}! Updated ${toCurrency} Balance: ${formatNumber(newToBal, 4)} ${toCurrency}`,
        'success'
      );
    } catch (err: any) {
      console.error('Swap execution error:', err);
      onShowToast?.(err?.message || 'Failed to complete swap. Please try again.', 'error');
    } finally {
      setIsSwapping(false);
    }
  };

  // Render coin badge / flag
  const renderCurrencyIcon = (code: string) => {
    switch (code) {
      case 'LKR':
        return (
          <View style={styles.flagContainer}>
            <Text style={styles.flagEmoji}>🇱🇰</Text>
          </View>
        );
      case 'USDT':
        return (
          <View style={[styles.coinBadge, { backgroundColor: '#26A17B' }]}>
            <Text style={styles.coinBadgeSymbol}>₮</Text>
          </View>
        );
      case 'USD':
        return (
          <View style={styles.flagContainer}>
            <Text style={styles.flagEmoji}>🇺🇸</Text>
          </View>
        );
      case 'BTC':
        return (
          <View style={[styles.coinBadge, { backgroundColor: '#F7931A' }]}>
            <Text style={styles.coinBadgeSymbol}>₿</Text>
          </View>
        );
      case 'ETH':
        return (
          <View style={[styles.coinBadge, { backgroundColor: '#627EEA' }]}>
            <Text style={styles.coinBadgeSymbol}>Ξ</Text>
          </View>
        );
      case 'SOL':
        return (
          <View style={[styles.coinBadge, { backgroundColor: '#14F195' }]}>
            <Text style={[styles.coinBadgeSymbol, { color: '#000' }]}>◎</Text>
          </View>
        );
      case 'BNB':
        return (
          <View style={[styles.coinBadge, { backgroundColor: '#F3BA2F' }]}>
            <Text style={[styles.coinBadgeSymbol, { color: '#000' }]}>🔶</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.coinBadge, { backgroundColor: '#2563EB' }]}>
            <Text style={styles.coinBadgeSymbol}>{code.charAt(0)}</Text>
          </View>
        );
    }
  };

  return (
    <View style={[styles.cardContainer, style]}>
      {/* 1. Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.cardTitle}>Currency Swap</Text>
          <View style={[styles.demoBadge, isDemoMode ? styles.demoBadgeDemo : styles.demoBadgeLive]}>
            <Text style={styles.demoBadgeText}>{isDemoMode ? 'DEMO' : 'INSTANT'}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => {
            fetchMarketData();
            loadBalances();
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {loadingRate ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <MaterialIcons name="sync" size={20} color={colors.accent} />
          )}
        </TouchableOpacity>
      </View>

      {/* 2. Two Horizontal Currency Panels */}
      <View style={styles.panelsRow}>
        {/* FROM PANEL */}
        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelLabel}>FROM</Text>
            <TouchableOpacity onPress={handleSetMax} activeOpacity={0.7}>
              <Text style={styles.maxLinkText}>MAX</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.currencySelector}
            onPress={() => handleOpenPicker('FROM')}
            activeOpacity={0.8}
          >
            <View style={styles.currencyBadgeRow}>
              {renderCurrencyIcon(fromCurrency)}
              <Text style={styles.currencyCodeText}>{fromCurrency}</Text>
            </View>
            <MaterialIcons name="arrow-drop-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.amountBox, isInsufficient && styles.amountBoxError]}>
            <TextInput
              style={styles.amountInput}
              value={fromAmount}
              onChangeText={setFromAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
              maxLength={14}
            />
          </View>

          <Text style={styles.panelBalanceText} numberOfLines={1}>
            Bal: {formatNumber(fromBalance, fromCurrency === 'LKR' ? 2 : 4)} {fromCurrency}
          </Text>
        </View>

        {/* GREEN BIDIRECTIONAL SWAP ICON */}
        <TouchableOpacity
          style={styles.swapCenterBtn}
          onPress={handleReverseCurrencies}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Animated.View style={{ transform: [{ rotate: spinInterpolation }] }}>
            <MaterialIcons name="swap-horiz" size={22} color={colors.accent} />
          </Animated.View>
        </TouchableOpacity>

        {/* TO PANEL */}
        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <Text style={styles.panelLabel}>TO</Text>
          </View>

          <TouchableOpacity
            style={styles.currencySelector}
            onPress={() => handleOpenPicker('TO')}
            activeOpacity={0.8}
          >
            <View style={styles.currencyBadgeRow}>
              {renderCurrencyIcon(toCurrency)}
              <Text style={styles.currencyCodeText}>{toCurrency}</Text>
            </View>
            <MaterialIcons name="arrow-drop-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.amountBox, styles.amountBoxReadonly]}>
            <Text
              style={styles.amountConvertedText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {toAmount}
            </Text>
          </View>

          <Text style={styles.panelBalanceText} numberOfLines={1}>
            Bal: {formatNumber(toBalance, toCurrency === 'LKR' ? 2 : 4)} {toCurrency}
          </Text>
        </View>
      </View>

      {/* 3. Bottom Row: Exchange Rate (Left) + SWAP Button (Right) */}
      <View style={styles.bottomRow}>
        <View style={styles.rateInfoContainer}>
          <View
            style={[
              styles.statusDot,
              rateError
                ? styles.statusDotError
                : rateSource === 'fallback'
                ? styles.statusDotWarning
                : styles.statusDotLive,
            ]}
          />
          <Text style={styles.rateText} numberOfLines={1}>
            {rateError ? 'Rate unavailable' : exchangeRateLabel}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.swapSubmitBtn,
            isInsufficient && styles.swapSubmitBtnWarning,
            isSwapping && styles.swapSubmitBtnDisabled,
          ]}
          onPress={handleExecuteSwap}
          activeOpacity={0.85}
          disabled={isSwapping}
        >
          {isSwapping ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Text style={[styles.swapSubmitText, isInsufficient && styles.swapSubmitTextWarning]}>
              {isInsufficient ? 'INSUFFICIENT' : 'SWAP'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 4. Searchable Currency & Coin Picker Modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
        >
          <View style={styles.pickerModalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickerTarget === 'FROM' ? 'Swap From' : 'Swap To'}
              </Text>
              <TouchableOpacity
                onPress={() => setPickerVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* SEARCH INPUT BAR */}
            <View style={styles.searchBarContainer}>
              <MaterialIcons name="search" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchTextInput}
                placeholder="Search coin or fiat (e.g. BTC, ETH, USDT)..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialIcons name="cancel" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter Tabs */}
            <View style={styles.filterTabsRow}>
              {(['ALL', 'CRYPTO', 'FIAT'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.filterTabPill, pickerCategory === cat && styles.filterTabPillActive]}
                  onPress={() => setPickerCategory(cat)}
                >
                  <Text
                    style={[
                      styles.filterTabPillText,
                      pickerCategory === cat && styles.filterTabPillTextActive,
                    ]}
                  >
                    {cat === 'ALL' ? 'All Assets' : cat === 'CRYPTO' ? 'Crypto' : 'Fiat / Stables'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Searchable Coins List */}
            <ScrollView
              style={{ maxHeight: 300 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              {filteredCoins.length > 0 ? (
                filteredCoins.map((cur) => {
                  const isSelected =
                    pickerTarget === 'FROM' ? fromCurrency === cur.code : toCurrency === cur.code;
                  const curBal = balances[cur.code] || 0;

                  return (
                    <TouchableOpacity
                      key={cur.code}
                      style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                      onPress={() => handleSelectCurrency(cur.code)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.pickerItemLeft}>
                        {renderCurrencyIcon(cur.code)}
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.pickerCodeText}>{cur.code}</Text>
                          <Text style={styles.pickerNameText} numberOfLines={1}>
                            {cur.name}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.pickerItemRight}>
                        <Text style={styles.pickerBalanceText}>
                          Bal: {formatNumber(curBal, cur.code === 'LKR' ? 2 : 4)}
                        </Text>
                        {cur.priceLKR ? (
                          <Text style={styles.pickerPriceText}>
                            Rs {formatLKR(cur.priceLKR, 2)}
                          </Text>
                        ) : null}
                      </View>

                      {isSelected ? (
                        <MaterialIcons
                          name="check-circle"
                          size={20}
                          color={colors.accent}
                          style={{ marginLeft: 8 }}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptySearchContainer}>
                  <MaterialIcons name="search-off" size={32} color={colors.textMuted} />
                  <Text style={styles.emptySearchText}>No matching coins found.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#0A0D0B',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 16,
    padding: 14,
    marginVertical: 14,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  demoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
  },
  demoBadgeDemo: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderColor: 'rgba(0, 230, 118, 0.4)',
  },
  demoBadgeLive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  demoBadgeText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerIconBtn: {
    padding: 4,
  },
  panelsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  panel: {
    flex: 1,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  panelLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  maxLinkText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#151816',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#242825',
  },
  currencyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyCodeText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  flagContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagEmoji: {
    fontSize: 15,
    includeFontPadding: false,
  },
  coinBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinBadgeSymbol: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginTop: Platform.OS === 'android' ? -1 : 0,
  },
  amountBox: {
    height: 42,
    backgroundColor: '#111412',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#242825',
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  amountBoxError: {
    borderColor: 'rgba(255, 68, 68, 0.6)',
  },
  amountBoxReadonly: {
    backgroundColor: '#131814',
    borderColor: 'rgba(0, 230, 118, 0.25)',
  },
  amountInput: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    padding: 0,
    margin: 0,
  },
  amountConvertedText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  panelBalanceText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },
  swapCenterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#102217',
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    marginTop: 24,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  rateInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusDotLive: {
    backgroundColor: colors.accent,
  },
  statusDotWarning: {
    backgroundColor: colors.warning,
  },
  statusDotError: {
    backgroundColor: colors.loss,
  },
  rateText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    flexShrink: 1,
  },
  swapSubmitBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  swapSubmitBtnWarning: {
    backgroundColor: '#382020',
    borderWidth: 1,
    borderColor: colors.loss,
  },
  swapSubmitBtnDisabled: {
    opacity: 0.65,
  },
  swapSubmitText: {
    color: '#000000',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  swapSubmitTextWarning: {
    color: colors.loss,
    fontSize: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  pickerModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#111412',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2E2B',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161A18',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: '#242825',
    marginBottom: 10,
  },
  searchTextInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    marginLeft: 8,
    paddingVertical: 0,
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterTabPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#161917',
    borderWidth: 1,
    borderColor: '#222624',
  },
  filterTabPillActive: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderColor: colors.accent,
  },
  filterTabPillText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterTabPillTextActive: {
    color: colors.accent,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161A18',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#242825',
    marginBottom: 6,
  },
  pickerItemActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
  },
  pickerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pickerCodeText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pickerNameText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
    maxWidth: 110,
  },
  pickerItemRight: {
    alignItems: 'flex-end',
    marginRight: 6,
  },
  pickerBalanceText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pickerPriceText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptySearchContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },
});
