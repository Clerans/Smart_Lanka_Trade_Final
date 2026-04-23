import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';

const filters = ['All Assets', 'Crypto', 'Stocks', 'Indices'];

const mockAssets = [
  { id: 1, name: 'Bitcoin', ticker: 'BTC', price: '18,450,200', change: '+2.41%', isPositive: true, color: '#F7931A', icon: 'bitcoin' },
  { id: 2, name: 'Ethereum', ticker: 'ETH', price: '824,150', change: '+1.80%', isPositive: true, color: '#627EEA', icon: 'ethereum' },
  { id: 3, name: 'Hayleys PLC', ticker: 'HAYL', price: '84.50', change: '+0.45%', isPositive: true, color: '#888', icon: 'chart-line' },
  { id: 4, name: 'LOLC Holdings', ticker: 'LOLC', price: '425.00', change: '-1.45%', isPositive: false, color: '#888', icon: 'chart-line' },
  { id: 5, name: 'Dialog Axiata', ticker: 'DIAL', price: '10.50', change: '-2.15%', isPositive: false, color: '#888', icon: 'chart-line' },
  { id: 6, name: 'Sampath Bank', ticker: 'SAMP', price: '68.20', change: '+3.82%', isPositive: true, color: '#888', icon: 'chart-line' },
];

export const MarketWatchScreen = () => {
  const [activeFilter, setActiveFilter] = useState('All Assets');

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
      <ScrollView contentContainerStyle={styles.listContainer}>
        {mockAssets.map((asset) => (
          <View key={asset.id}>
            <TouchableOpacity style={styles.assetRow}>

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
