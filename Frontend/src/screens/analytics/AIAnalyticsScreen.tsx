import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { Card } from '../../components';

const filters = ['All Assets', 'Crypto', 'Stocks', 'Forex'];

const analyticsData = [
  {
    id: 1,
    asset: 'Bitcoin',
    pair: 'BTC/USD',
    icon: 'bitcoin',
    color: '#F7931A',
    sentiment: '85% BULLISH',
    risk: 'Medium Risk',
    score: 92,
    isPositive: true,
    summary: 'Market structure indicates strong accumulation phase. Breakout above 18.5M LKR expected within 48h based on order book imbalance.',
  },
  {
    id: 2,
    asset: 'Ethereum',
    pair: 'ETH/LKR',
    icon: 'ethereum',
    color: '#627EEA',
    sentiment: '78% BULLISH',
    risk: 'High Risk',
    score: 78,
    isPositive: true,
    summary: 'Network activity surge driving positive price action. Resistance expected at 850k LKR level.',
  },
  {
    id: 3,
    asset: 'NVIDIA Corp',
    pair: 'NVDA/USD',
    icon: 'microchip',
    color: '#76B900',
    sentiment: 'NEUTRAL',
    risk: 'High Risk',
    score: 54,
    isPositive: false,
    summary: 'Price consolidating after recent earnings report. Wait for clear breakout signal before entry.',
  },
  {
    id: 4,
    asset: 'Euro',
    pair: 'EUR/USD',
    icon: 'euro-sign',
    color: '#0A3B7C',
    sentiment: '65% BULLISH',
    risk: 'Low Risk',
    score: 65,
    isPositive: true,
    summary: 'Macroeconomic data suggests ECB rate hold, providing support for the pair in the near term.',
  }
];

export const AIAnalyticsScreen = () => {
  const navigation = useNavigation<any>();
  const [activeFilter, setActiveFilter] = useState('All Assets');

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatar}>
            <MaterialIcons name="person" size={24} color={colors.accent} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>AI Insights</Text>
            <Text style={styles.headerSubtitle}>PRO TERMINAL</Text>
          </View>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="search" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="notifications-none" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Indicator */}
      <View style={styles.liveIndicatorContainer}>
        <View style={styles.liveLeft}>
          <View style={styles.pulseDot} />
          <Text style={styles.liveText}>Live Market Analysis</Text>
        </View>
        <Text style={styles.updatedText}>UPDATED: 2M AGO</Text>
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

      {/* Timeline/Cards */}
      <ScrollView contentContainerStyle={styles.listContainer}>
        {analyticsData.map((item) => (
          <Card key={item.id} style={styles.insightCard}>

            <View style={styles.cardTopRow}>
              <View style={styles.assetInfoRow}>
                <View style={[styles.assetIcon, { backgroundColor: item.color + '22' }]}>
                  <FontAwesome5 name={item.icon} size={18} color={item.color} />
                </View>
                <View>
                  <Text style={styles.assetName}>{item.asset}</Text>
                  <Text style={styles.assetPair}>{item.pair}</Text>
                </View>
              </View>

              <View style={styles.badgeContainer}>
                <View style={[styles.sentimentBadge, !item.isPositive && styles.sentimentBadgeNeutral]}>
                  <Text style={[styles.sentimentText, !item.isPositive && styles.sentimentTextNeutral]}>
                    {item.sentiment}
                  </Text>
                </View>
                <Text style={styles.riskText}>{item.risk}</Text>
              </View>
            </View>

            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>AI Confidence Score</Text>
              <Text style={[styles.scoreValue, !item.isPositive && { color: colors.yellow }]}>
                {item.score}%
              </Text>
            </View>

            <View style={styles.progressBarBg}>
              <View style={[
                styles.progressBarFill,
                { width: `${item.score}%` },
                !item.isPositive && { backgroundColor: colors.yellow }
              ]} />
            </View>

            <View style={styles.summaryContainer}>
              <Text style={styles.summaryLabel}>Summary: </Text>
              <Text style={styles.summaryText}>{item.summary}</Text>
            </View>

          </Card>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Action Button (Optional based on design spec) */}
      <TouchableOpacity
        style={styles.fabBtn}
        onPress={() => navigation.navigate('SOMIAIChat')}
      >
        <FontAwesome5 name="robot" size={24} color="#000" />
      </TouchableOpacity>
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
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    ...typography.h3,
  },
  headerSubtitle: {
    ...typography.label,
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconBtn: {
    marginLeft: 16,
  },
  liveIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  liveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: 8,
  },
  liveText: {
    ...typography.bodySmall,
    color: '#FFF',
  },
  updatedText: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
  },
  filtersWrapper: {
    marginBottom: 24,
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
  insightCard: {
    marginBottom: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  assetInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  assetPair: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badgeContainer: {
    alignItems: 'flex-end',
  },
  sentimentBadge: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
  sentimentBadgeNeutral: {
    backgroundColor: colors.yellow + '33',
  },
  sentimentText: {
    ...typography.label,
    fontSize: 10,
    color: colors.accent,
  },
  sentimentTextNeutral: {
    color: colors.yellow,
  },
  riskText: {
    ...typography.bodySmall,
    fontSize: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  scoreValue: {
    ...typography.h3,
    color: colors.accent,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.bgInput,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  summaryLabel: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '700',
  },
  summaryText: {
    ...typography.bodySmall,
    flex: 1,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  fabBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
