import * as React from 'react';
const { useState, useEffect } = React;
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { marketService } from '../../services/apiService';
import { useNavigation } from '@react-navigation/native';

const filters = ['All Equities', 'Banking', 'Conglomerate', 'Beverage & Tobacco', 'Telecom & Tech'];

const cseMetadata: Record<string, { name: string; sector: string; icon: string; color: string }> = {
  'JKH.N0000': { name: 'John Keells Holdings', sector: 'Conglomerate', icon: 'building', color: '#1A5BFF' },
  'COMB.N0000': { name: 'Commercial Bank of Ceylon', sector: 'Banking', icon: 'university', color: '#0080FF' },
  'SAMP.N0000': { name: 'Sampath Bank PLC', sector: 'Banking', icon: 'money-check-alt', color: '#FF9900' },
  'HNB.N0000': { name: 'Hatton National Bank', sector: 'Banking', icon: 'landmark', color: '#009933' },
  'DIAL.N0000': { name: 'Dialog Axiata PLC', sector: 'Telecom & Tech', icon: 'signal', color: '#E60000' },
  'CTC.N0000': { name: 'Ceylon Tobacco Company', sector: 'Beverage & Tobacco', icon: 'industry', color: '#888888' },
  'LOLC.N0000': { name: 'LOLC Holdings PLC', sector: 'Conglomerate', icon: 'chart-pie', color: '#9933FF' },
  'MELS.N0000': { name: 'Melstacorp PLC', sector: 'Conglomerate', icon: 'wine-bottle', color: '#CC6600' },
  'BIL.N0000': { name: 'Browns Investments PLC', sector: 'Conglomerate', icon: 'cubes', color: '#00CCCC' },
  'DIST.N0000': { name: 'Distilleries Company', sector: 'Beverage & Tobacco', icon: 'glass-whiskey', color: '#FF3366' },
  'HAYL.N0000': { name: 'Hayleys PLC', sector: 'Conglomerate', icon: 'boxes', color: '#3399FF' },
  'CARG.N0000': { name: 'Cargills (Ceylon) PLC', sector: 'Beverage & Tobacco', icon: 'shopping-cart', color: '#FF3333' },
};

export const MarketWatchScreen = () => {
  const navigation = useNavigation<any>();
  const [activeFilter, setActiveFilter] = useState('All Equities');
  const [stocks, setStocks] = useState<any[]>([]);
  const [marketStatus, setMarketStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      const [marketRes, statusRes] = await Promise.all([
        marketService.getAllPricesLKR(),
        marketService.getMarketStatus()
      ]);

      if (marketRes?.success && marketRes.data?.prices) {
        const formatted = marketRes.data.prices.map((p: any) => {
          const meta = cseMetadata[p.symbol] || {
            name: p.symbol,
            sector: 'Equities',
            icon: 'chart-line',
            color: '#888',
          };

          return {
            symbol: p.symbol,
            name: meta.name,
            sector: meta.sector,
            icon: meta.icon,
            color: meta.color,
            price: p.priceLKR,
            changePercent: p.changePercent,
            high24h: p.high24h,
            low24h: p.low24h,
            volume: p.volume,
          };
        });
        setStocks(formatted);
      }

      if (statusRes?.success) {
        setMarketStatus(statusRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch CSE market data:', error);
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

  const filteredStocks = stocks.filter(stock => {
    const matchesSearch = stock.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeFilter === 'All Equities') return true;
    return stock.sector === activeFilter;
  });

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Colombo Stock Exchange</Text>
          <View style={styles.statusRow}>
            <View style={[styles.marketDot, { backgroundColor: marketStatus?.isOpen ? colors.accent : colors.red }]} />
            <Text style={styles.marketStatusText}>
              CSE REGULAR MARKET: {marketStatus?.isOpen ? 'OPEN (09:30 - 14:30 SLT)' : 'CLOSED (PRE-OPEN)'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.filterIconBtn} onPress={onRefresh}>
          <MaterialIcons name="refresh" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Market Indices Card */}
      <View style={styles.indicesContainer}>
        <View style={styles.indexBox}>
          <Text style={styles.indexTitle}>ASPI INDEX</Text>
          <Text style={styles.indexValue}>13,245.80</Text>
          <Text style={[styles.indexChange, { color: colors.accent }]}>+0.84% (+110.2)</Text>
        </View>
        <View style={styles.indexBox}>
          <Text style={styles.indexTitle}>S&P SL20</Text>
          <Text style={styles.indexValue}>3,980.50</Text>
          <Text style={[styles.indexChange, { color: colors.accent }]}>+1.12% (+44.1)</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search JKH, COMB, SAMP, DIAL, etc."
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

      {/* Equities List */}
      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          {filteredStocks.length > 0 ? (
            filteredStocks.map((stock) => {
              const isPositive = stock.changePercent >= 0;
              return (
                <View key={stock.symbol}>
                  <TouchableOpacity
                    style={styles.assetRow}
                    onPress={() => navigation.navigate('TradingTerminal', { symbol: stock.symbol })}
                  >

                    <View style={styles.assetRowLeft}>
                      <View style={[styles.assetIcon, { backgroundColor: stock.color + '22' }]}>
                        <FontAwesome5 name={stock.icon} size={18} color={stock.color} />
                      </View>
                      <View>
                        <Text style={styles.assetName}>{stock.name}</Text>
                        <Text style={styles.assetTicker}>{stock.symbol} · {stock.sector}</Text>
                      </View>
                    </View>

                    <View style={styles.assetRowRight}>
                      <Text style={styles.assetPrice}>Rs {stock.price?.toFixed(2)}</Text>
                      <View style={[styles.changePill, isPositive ? styles.changePositiveBg : styles.changeNegativeBg]}>
                        <Text style={[styles.assetChange, isPositive ? styles.changePositiveTxt : styles.changeNegativeTxt]}>
                          {isPositive ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                        </Text>
                      </View>
                    </View>

                  </TouchableOpacity>
                  <View style={styles.divider} />
                </View>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="search-off" size={56} color={colors.textMuted} />
              <Text style={styles.emptyText}>No CSE equities found for this category.</Text>
            </View>
          )}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

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
    paddingHorizontal: 24,
    paddingTop: 16,
    marginBottom: 16,
  },
  headerTitle: {
    ...typography.h3,
    color: '#FFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  marketDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  marketStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  filterIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  indicesContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  indexBox: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  indexTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  indexValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginVertical: 2,
  },
  indexChange: {
    fontSize: 11,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    marginHorizontal: 24,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 13,
  },
  filtersWrapper: {
    marginBottom: 12,
  },
  filtersScroll: {
    paddingHorizontal: 24,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  listContainer: {
    paddingHorizontal: 24,
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
  },
  assetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  assetName: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
  },
  assetTicker: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  assetRowRight: {
    alignItems: 'flex-end',
  },
  assetPrice: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  changePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  changePositiveBg: {
    backgroundColor: colors.accentMuted,
  },
  changeNegativeBg: {
    backgroundColor: colors.red + '22',
  },
  assetChange: {
    fontSize: 11,
    fontWeight: '700',
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
    paddingVertical: 40,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 10,
  },
});
