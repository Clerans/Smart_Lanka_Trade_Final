import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout, SCREEN_PADDING, TAB_BAR_BOTTOM_OFFSET } from '../../theme';
import { marketService } from '../../services/apiService';
import { formatLKR } from '../../utils/formatters';
import { useNavigation } from '@react-navigation/native';

const { useState, useEffect } = React;

const filters = ['All Assets', 'CSE Stocks', 'Cryptocurrency'];

const cryptoMeta: Record<string, { name: string; icon: string; color: string }> = {
  'BTCUSDT': { name: 'Bitcoin', icon: 'bitcoin', color: '#F7931A' },
  'ETHUSDT': { name: 'Ethereum', icon: 'ethereum', color: '#627EEA' },
  'BNBUSDT': { name: 'Binance Coin', icon: 'coins', color: '#F3BA2F' },
  'SOLUSDT': { name: 'Solana', icon: 'sun', color: '#14F195' },
  'ADAUSDT': { name: 'Cardano', icon: 'layer-group', color: '#0033AD' },
  'XRPUSDT': { name: 'XRP', icon: 'bolt', color: '#23292F' },
  'DOGEUSDT': { name: 'Dogecoin', icon: 'dog', color: '#C2A633' },
  'DOTUSDT': { name: 'Polkadot', icon: 'circle', color: '#E6007A' },
  'TRXUSDT': { name: 'TRON', icon: 'play-circle', color: '#FF0013' },
  'MATICUSDT': { name: 'Polygon', icon: 'vector-square', color: '#8247E5' },
};

const cseStockMeta: Record<string, { icon: string; color: string }> = {
  'JKH.N0000': { icon: 'building', color: '#00A86B' },
  'COMB.N0000': { icon: 'university', color: '#0052CC' },
  'DIAL.N0000': { icon: 'broadcast-tower', color: '#E60000' },
  'HNB.N0000': { icon: 'landmark', color: '#FF8C00' },
  'LIOC.N0000': { icon: 'gas-pump', color: '#008080' },
};

export const MarketWatchScreen = () => {
  const navigation = useNavigation<any>();
  const [activeFilter, setActiveFilter] = useState('All Assets');
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState<any | null>(null);

  const fetchMarketData = async () => {
    try {
      const [cryptoRes, cseRes] = await Promise.allSettled([
        marketService.getAllPricesLKR(),
        marketService.getCseWatchlist()
      ]);

      const merged: any[] = [];

      // 1. Process CSE Sri Lankan Stocks
      if (cseRes.status === 'fulfilled' && cseRes.value?.success && Array.isArray(cseRes.value?.data)) {
        cseRes.value.data.forEach((s: any) => {
          const meta = cseStockMeta[s.symbol] || { icon: 'chart-line', color: '#00A86B' };
          merged.push({
            id: 'stock_' + s.symbol,
            assetType: 'STOCK',
            exchange: 'CSE',
            symbol: s.symbol,
            ticker: s.ticker || s.symbol.split('.')[0],
            name: s.name,
            sector: s.sector,
            priceNum: s.priceLKR,
            price: formatLKR(s.priceLKR, 2),
            changePercent: s.changePercent,
            change: `${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%`,
            changeAmount: s.change >= 0 ? `+Rs ${s.change.toFixed(2)}` : `-Rs ${Math.abs(s.change).toFixed(2)}`,
            isPositive: s.changePercent >= 0,
            color: meta.color,
            icon: meta.icon,
            dataFreshness: s.dataFreshness || 'SAMPLE_REFERENCE',
            isMarketOpen: s.isMarketOpen,
            sessionStatus: s.sessionStatus,
            highLKR: s.highLKR,
            lowLKR: s.lowLKR,
            volume: s.volume,
            lastTradedTime: s.lastTradedTime,
            marketHoursNotice: s.marketHoursNotice || '09:30 - 14:30 SLT (Mon-Fri)'
          });
        });
      }

      // 2. Process Cryptocurrency Pairs
      if (cryptoRes.status === 'fulfilled' && cryptoRes.value?.success && Array.isArray(cryptoRes.value?.data?.prices)) {
        cryptoRes.value.data.prices.forEach((p: any) => {
          const meta = cryptoMeta[p.symbol] || { name: p.symbol.replace('USDT', ''), icon: 'coins', color: '#888' };
          merged.push({
            id: 'crypto_' + p.symbol,
            assetType: 'CRYPTO',
            exchange: 'BINANCE',
            symbol: p.symbol,
            ticker: p.symbol.replace('USDT', ''),
            name: meta.name,
            sector: 'Cryptocurrency',
            priceNum: p.priceLKR,
            price: formatLKR(p.priceLKR, 2),
            changePercent: p.changePercent,
            change: `${p.changePercent >= 0 ? '+' : ''}${p.changePercent.toFixed(2)}%`,
            isPositive: p.changePercent >= 0,
            color: meta.color,
            icon: meta.icon,
            dataFreshness: p.isFallback ? 'DELAYED' : 'LIVE',
            isMarketOpen: true,
            sessionStatus: '24/7_OPEN'
          });
        });
      }

      setAssets(merged);
    } catch (error) {
      console.error('Failed to fetch market data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 20000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMarketData();
  };

  const filteredAssets = assets.filter(asset => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      asset.name.toLowerCase().includes(q) ||
      asset.ticker.toLowerCase().includes(q) ||
      asset.symbol.toLowerCase().includes(q) ||
      (asset.sector && asset.sector.toLowerCase().includes(q));

    let matchesCategory = true;
    if (activeFilter === 'Cryptocurrency') {
      matchesCategory = asset.assetType === 'CRYPTO';
    } else if (activeFilter === 'CSE Stocks') {
      matchesCategory = asset.assetType === 'STOCK';
    }

    return matchesSearch && matchesCategory;
  });

  const handleAssetPress = (asset: any) => {
    if (asset.assetType === 'STOCK') {
      setSelectedStock(asset);
    } else {
      navigation.navigate('AssetDetails', {
        symbol: asset.symbol,
        coin: asset.ticker
      });
    }
  };

  const handleTradeStockInDemo = (stock: any) => {
    setSelectedStock(null);
    navigation.navigate('DemoTrading', {
      initialSymbol: stock.symbol
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Market Watch</Text>
          <Text style={styles.headerSubtitle}>CSE Equities & Crypto Markets</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.filterIconBtn, { marginRight: 8 }]}
            onPress={() => navigation.navigate('AIAnalytics')}
          >
            <MaterialIcons name="psychology" size={24} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterIconBtn}
            onPress={() => navigation.navigate('DemoTrading')}
          >
            <MaterialIcons name="swap-horiz" size={24} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search JKH, COMB, BTC, ETH..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filters */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {filters.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Asset List */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          {filteredAssets.length > 0 ? (
            filteredAssets.map((asset) => (
              <View key={asset.id}>
                <TouchableOpacity
                  style={styles.assetRow}
                  activeOpacity={0.7}
                  onPress={() => handleAssetPress(asset)}
                >
                  <View style={styles.assetRowLeft}>
                    <View style={[styles.assetIcon, { backgroundColor: asset.color + '22' }]}>
                      <FontAwesome5 name={asset.icon} size={18} color={asset.color} />
                    </View>
                    <View style={{ flexShrink: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.assetName} numberOfLines={1}>{asset.name}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Text style={styles.assetTicker}>{asset.ticker}</Text>
                        {asset.assetType === 'STOCK' ? (
                          <View style={styles.cseBadge}>
                            <Text style={styles.cseBadgeText}>CSE</Text>
                          </View>
                        ) : (
                          <View style={styles.cryptoBadge}>
                            <Text style={styles.cryptoBadgeText}>CRYPTO</Text>
                          </View>
                        )}
                        {asset.dataFreshness === 'SAMPLE_REFERENCE' && (
                          <View style={styles.sampleBadge}>
                            <Text style={styles.sampleBadgeText}>SAMPLE</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={styles.assetRowRight}>
                    <Text style={styles.assetPrice} numberOfLines={1}>Rs {asset.price}</Text>
                    <View style={[styles.changePill, asset.isPositive ? styles.changePositiveBg : styles.changeNegativeBg]}>
                      <Text style={[styles.assetChange, asset.isPositive ? styles.changePositiveTxt : styles.changeNegativeTxt]}>
                        {asset.change}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={styles.divider} />
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="search-off" size={56} color={colors.textSecondary} />
              <Text style={styles.emptyText}>No assets found in this category.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Stock Detail Modal */}
      <Modal
        visible={!!selectedStock}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedStock(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedStock && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={[styles.modalIcon, { backgroundColor: selectedStock.color + '22' }]}>
                      <FontAwesome5 name={selectedStock.icon} size={20} color={selectedStock.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalStockName} numberOfLines={1}>{selectedStock.name}</Text>
                      <Text style={styles.modalStockSymbol}>{selectedStock.symbol} • {selectedStock.sector}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedStock(null)}
                    style={styles.modalCloseBtn}
                  >
                    <MaterialIcons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Price Display */}
                <View style={styles.modalPriceContainer}>
                  <Text style={styles.modalPriceLKR}>Rs {selectedStock.price}</Text>
                  <View style={[styles.changePill, selectedStock.isPositive ? styles.changePositiveBg : styles.changeNegativeBg, { marginLeft: 10 }]}>
                    <Text style={[styles.assetChange, selectedStock.isPositive ? styles.changePositiveTxt : styles.changeNegativeTxt]}>
                      {selectedStock.change} ({selectedStock.changeAmount})
                    </Text>
                  </View>
                </View>

                {/* Market Details Grid */}
                <View style={styles.stockDetailsGrid}>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Exchange</Text>
                    <Text style={styles.gridValue}>Colombo Stock Exchange</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Trading Hours</Text>
                    <Text style={styles.gridValue}>09:30 - 14:30 SLT</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Day High</Text>
                    <Text style={styles.gridValue}>{selectedStock.highLKR ? `Rs ${formatLKR(selectedStock.highLKR, 2)}` : '—'}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>Day Low</Text>
                    <Text style={styles.gridValue}>{selectedStock.lowLKR ? `Rs ${formatLKR(selectedStock.lowLKR, 2)}` : '—'}</Text>
                  </View>
                </View>

                {/* Data Transparency Notice */}
                <View style={styles.noticeCard}>
                  <MaterialIcons name="info-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
                  <Text style={styles.noticeText}>
                    {selectedStock.dataFreshness === 'SAMPLE_REFERENCE'
                      ? 'Sample reference fixture. Unlicensed real-time CSE feeds are never fabricated.'
                      : `Data Freshness: ${selectedStock.dataFreshness}.`}
                  </Text>
                </View>

                {/* Action Buttons */}
                <TouchableOpacity
                  style={styles.tradeDemoBtn}
                  onPress={() => handleTradeStockInDemo(selectedStock)}
                >
                  <MaterialIcons name="trending-up" size={20} color="#000" style={{ marginRight: 8 }} />
                  <Text style={styles.tradeDemoBtnText}>Simulate Trade in Demo Engine</Text>
                </TouchableOpacity>
              </>
            )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    marginBottom: 12,
  },
  headerTitle: {
    ...typography.h1,
    fontSize: 26,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  filterIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchContainer: {
    marginHorizontal: SCREEN_PADDING,
    marginBottom: 14,
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  searchInput: {
    ...typography.body,
    height: 44,
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusPill,
    paddingLeft: 44,
    paddingRight: 16,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filtersWrapper: {
    marginBottom: 14,
  },
  filtersScroll: {
    paddingHorizontal: SCREEN_PADDING,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusPill,
    backgroundColor: colors.bgInput,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  filterTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  listContainer: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: TAB_BAR_BOTTOM_OFFSET,
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  assetRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  assetIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  assetName: {
    ...typography.body,
    fontWeight: '700',
    fontSize: 15,
  },
  assetTicker: {
    ...typography.label,
    fontSize: 11,
    color: colors.textSecondary,
    marginRight: 6,
  },
  cseBadge: {
    backgroundColor: '#00A86B22',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 5,
  },
  cseBadgeText: {
    color: '#00A86B',
    fontSize: 9,
    fontWeight: '800',
  },
  cryptoBadge: {
    backgroundColor: '#627EEA22',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 5,
  },
  cryptoBadgeText: {
    color: '#627EEA',
    fontSize: 9,
    fontWeight: '800',
  },
  sampleBadge: {
    backgroundColor: '#E6A10022',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sampleBadgeText: {
    color: '#E6A100',
    fontSize: 8.5,
    fontWeight: '800',
  },
  assetRowRight: {
    alignItems: 'flex-end',
  },
  assetPrice: {
    ...typography.body,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 4,
    fontVariant: ['tabular-nums'] as any,
  },
  changePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  changePositiveBg: {
    backgroundColor: colors.accentMuted,
  },
  changeNegativeBg: {
    backgroundColor: colors.red + '22',
  },
  assetChange: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  changePositiveTxt: {
    color: colors.accent,
  },
  changeNegativeTxt: {
    color: colors.red,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalStockName: {
    ...typography.h2,
    fontSize: 18,
    color: '#FFF',
  },
  modalStockSymbol: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalPriceLKR: {
    ...typography.price,
    fontSize: 26,
    color: '#FFF',
  },
  stockDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.bgInput,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  gridItem: {
    width: '50%',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  gridLabel: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  gridValue: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 2,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.2)',
  },
  noticeText: {
    ...typography.bodySmall,
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  tradeDemoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: layout.borderRadiusPill,
  },
  tradeDemoBtnText: {
    ...typography.body,
    color: '#000',
    fontWeight: '800',
  },
});

