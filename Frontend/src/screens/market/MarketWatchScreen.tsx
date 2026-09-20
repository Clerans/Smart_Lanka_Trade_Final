import * as React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout, SCREEN_PADDING, TAB_BAR_BOTTOM_OFFSET } from '../../theme';
import { marketService } from '../../services/apiService';
import { formatLKR } from '../../utils/formatters';

import { useNavigation } from '@react-navigation/native';
const { useState, useEffect, useCallback } = React;

const filters = ['All Assets', 'Crypto', 'Stocks', 'Indices'];

const assetMeta: any = {
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

export const MarketWatchScreen = () => {
  const navigation = useNavigation<any>();
  const [activeFilter, setActiveFilter] = useState('All Assets');
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAssets = assets.filter(asset => {
    // Search query filter
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.ticker.toLowerCase().includes(searchQuery.toLowerCase());

    // Category filter
    let matchesCategory = true;
    if (activeFilter === 'Crypto') {
      matchesCategory = true;
    } else if (activeFilter === 'Stocks' || activeFilter === 'Indices') {
      matchesCategory = false;
    }

    return matchesSearch && matchesCategory;
  });

  const fetchMarketData = async () => {
    try {
      const response = await marketService.getAllPricesLKR();
      if (response.success) {
        const formatted = response.data.prices.map((p: any, index: number) => ({
          id: index,
          name: assetMeta[p.symbol]?.name || p.symbol.replace('USDT', ''),
          ticker: p.symbol.replace('USDT', ''),
          price: formatLKR(p.priceLKR, 2),
          change: `${p.changePercent >= 0 ? '+' : ''}${p.changePercent.toFixed(2)}%`,
          isPositive: p.changePercent >= 0,
          color: assetMeta[p.symbol]?.color || '#888',
          icon: assetMeta[p.symbol]?.icon || 'chart-line',
        }));
        setAssets(formatted);
      }
    } catch (error) {
      console.error('Failed to fetch market data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMarketData();
  };

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Market Watch</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            style={[styles.filterIconBtn, { marginRight: 8 }]}
            onPress={() => navigation.navigate('AIAnalytics')}
          >
            <MaterialIcons name="psychology" size={24} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterIconBtn}>
            <MaterialIcons name="tune" size={24} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search BTC, LOLC, etc."
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
                  onPress={() => navigation.navigate('AssetDetails', {
                    symbol: asset.ticker + 'USDT',
                    coin: asset.ticker
                  })}
                >

                  <View style={styles.assetRowLeft}>
                    <View style={[styles.assetIcon, { backgroundColor: asset.color + '22' }]}>
                      <FontAwesome5 name={asset.icon} size={18} color={asset.color} />
                    </View>
                    <View style={{ flexShrink: 1 }}>
                      <Text style={styles.assetName} numberOfLines={1}>{asset.name}</Text>
                      <Text style={styles.assetTicker}>{asset.ticker}</Text>
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
    marginBottom: 16,
  },
  headerTitle: {
    ...typography.h1,
    fontSize: 28,
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
    marginBottom: 16,
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
    height: 46,
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
    marginBottom: 2,
  },
  assetTicker: {
    ...typography.label,
    fontSize: 11,
    color: colors.accent,
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
});
