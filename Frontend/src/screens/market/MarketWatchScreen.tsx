import * as React from 'react';
const { useState, useEffect } = React;
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { marketService } from '../../services/apiService';

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

import { useNavigation } from '@react-navigation/native';

export const MarketWatchScreen = () => {
  const navigation = useNavigation<any>();
  const [activeFilter, setActiveFilter] = useState('All Assets');
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.ticker.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await marketService.getAllPricesLKR();
        if (response.success) {
          const formatted = response.data.prices.map((p: any, index: number) => ({
            id: index,
            name: assetMeta[p.symbol]?.name || p.symbol.replace('USDT', ''),
            ticker: p.symbol.replace('USDT', ''),
            price: p.priceLKR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Market Watch</Text>
        <TouchableOpacity style={styles.filterIconBtn}>
          <MaterialIcons name="tune" size={24} color={colors.accent} />
        </TouchableOpacity>
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
        <ScrollView contentContainerStyle={styles.listContainer}>
          {filteredAssets.map((asset) => (
            <View key={asset.id}>
                <TouchableOpacity 
                  style={styles.assetRow}
                  onPress={() => navigation.navigate('Market', { 
                    screen: 'TradingTerminal', 
                    params: { symbol: assets.find(a => a.id === asset.id)?.ticker + 'USDT' } 
                  })}
                >

                <View style={styles.assetRowLeft}>
                  <View style={[styles.assetIcon, { backgroundColor: asset.color + '22' }]}>
                    <FontAwesome5 name={asset.icon} size={20} color={asset.color} />
                  </View>
                  <View>
                    <Text style={styles.assetName}>{asset.name}</Text>
                    <Text style={styles.assetTicker}>{asset.ticker}</Text>
                  </View>
                </View>

                <View style={styles.assetRowRight}>
                  <Text style={styles.assetPrice}>Rs {asset.price}</Text>
                  <View style={[styles.changePill, asset.isPositive ? styles.changePositiveBg : styles.changeNegativeBg]}>
                    <Text style={[styles.assetChange, asset.isPositive ? styles.changePositiveTxt : styles.changeNegativeTxt]}>
                      {asset.change}
                    </Text>
                  </View>
                </View>

              </TouchableOpacity>
              <View style={styles.divider} />
            </View>
          ))}
          {/* Fill bottom space corresponding to tab bar */}
          <View style={{ height: 80 }} />
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
    paddingTop: 20,
    marginBottom: 24,
  },
  headerTitle: {
    ...typography.h1,
  },
  filterIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  searchInput: {
    ...typography.body,
    height: 50,
    backgroundColor: colors.bgInput,
    borderRadius: layout.borderRadiusPill,
    paddingLeft: 48,
    paddingRight: 16,
    color: colors.textPrimary,
  },
  filtersWrapper: {
    marginBottom: 16,
  },
  filtersScroll: {
    paddingHorizontal: 24,
  },
  filterPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: layout.borderRadiusPill,
    backgroundColor: colors.bgInput,
    marginRight: 12,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
  },
  filterText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
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
    paddingVertical: 16,
  },
  assetRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  assetName: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 4,
  },
  assetTicker: {
    ...typography.label,
    fontSize: 10,
    color: colors.accent,
  },
  assetRowRight: {
    alignItems: 'flex-end',
  },
  assetPrice: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 6,
  },
  changePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  changePositiveBg: {
    backgroundColor: colors.accentMuted,
  },
  changeNegativeBg: {
    backgroundColor: colors.red + '22',
  },
  assetChange: {
    ...typography.bodySmall,
    fontSize: 12,
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
});
