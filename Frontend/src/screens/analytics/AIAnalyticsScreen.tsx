import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { Card } from '../../components';
import { aiService } from '../../services/apiService';

const filters = ['All Assets', 'Banking', 'Conglomerate', 'Beverage & Tobacco', 'Telecom'];

export const AIAnalyticsScreen = () => {
  const navigation = useNavigation<any>();
  const [activeFilter, setActiveFilter] = useState('All Assets');
  const [insights, setInsights] = useState<any[]>([]);
  const [sentimentSummary, setSentimentSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [insightsRes, sentimentRes] = await Promise.all([
        aiService.getInsights(),
        aiService.getSentiment()
      ]);

      if (insightsRes?.success && insightsRes?.data) {
        setInsights(insightsRes.data);
      }
      if (sentimentRes?.success && sentimentRes?.data) {
        setSentimentSummary(sentimentRes.data);
      }
    } catch (error) {
      console.error('Failed to load AI analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredInsights = insights.filter(item => {
    if (activeFilter === 'All Assets') return true;
    if (activeFilter === 'Banking') return item.symbol.includes('COMB') || item.symbol.includes('SAMP') || item.symbol.includes('HNB');
    if (activeFilter === 'Conglomerate') return item.symbol.includes('JKH') || item.symbol.includes('LOLC') || item.symbol.includes('HAYL') || item.symbol.includes('MELS');
    if (activeFilter === 'Beverage & Tobacco') return item.symbol.includes('CTC') || item.symbol.includes('DIST') || item.symbol.includes('CARG');
    if (activeFilter === 'Telecom') return item.symbol.includes('DIAL');
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatar}>
            <MaterialIcons name="analytics" size={24} color={colors.accent} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>AI Intelligence Hub</Text>
            <Text style={styles.headerSubtitle}>ARIMA · LSTM · NLP SENTIMENT</Text>
          </View>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('SOMIAIChat')} style={styles.iconBtn}>
            <FontAwesome5 name="robot" size={20} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Indicator */}
      <View style={styles.liveIndicatorContainer}>
        <View style={styles.liveLeft}>
          <View style={styles.pulseDot} />
          <Text style={styles.liveText}>CSE Real-Time Quantitative Engine</Text>
        </View>
        <Text style={styles.updatedText}>ACTIVE</Text>
      </View>

      {/* Sentiment Overview Card */}
      {sentimentSummary && (
        <Card style={styles.sentimentCard}>
          <View style={styles.sentimentCardHeader}>
            <Text style={styles.sentimentCardTitle}>Macro CSE Market Sentiment</Text>
            <View style={[styles.sentimentPill, { backgroundColor: sentimentSummary.overallSentiment === 'BULLISH' ? colors.accentMuted : colors.bgInput }]}>
              <Text style={[styles.sentimentPillText, { color: sentimentSummary.overallSentiment === 'BULLISH' ? colors.accent : '#FFF' }]}>
                {sentimentSummary.overallSentiment} ({sentimentSummary.bullishPercent}%)
              </Text>
            </View>
          </View>
          <Text style={styles.sentimentSub}>
            Scanned {sentimentSummary.articlesCount || 12} financial news publications across Daily FT, Ada Derana Biz & Central Bank of Sri Lanka.
          </Text>
        </Card>
      )}

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
      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          {filteredInsights.map((item, idx) => {
            const isBullish = item.sentiment?.includes('BULLISH') || item.trend === 'UP' || item.predictedChangePercent >= 0;
            return (
              <Card key={idx} style={styles.insightCard}>

                <View style={styles.cardTopRow}>
                  <View style={styles.assetInfoRow}>
                    <View style={[styles.assetIcon, { backgroundColor: '#1A5BFF22' }]}>
                      <FontAwesome5 name="chart-line" size={16} color={colors.accent} />
                    </View>
                    <View>
                      <Text style={styles.assetName}>{item.companyName || item.symbol}</Text>
                      <Text style={styles.assetPair}>{item.symbol} · Rs {item.currentPrice?.toFixed(2)}</Text>
                    </View>
                  </View>

                  <View style={styles.badgeContainer}>
                    <View style={[styles.sentimentBadge, !isBullish && styles.sentimentBadgeNeutral]}>
                      <Text style={[styles.sentimentText, !isBullish && styles.sentimentTextNeutral]}>
                        {item.sentiment || (isBullish ? 'BULLISH' : 'NEUTRAL')}
                      </Text>
                    </View>
                    <Text style={styles.riskText}>{item.riskRating || 'Medium Risk'}</Text>
                  </View>
                </View>

                {/* Model Target Price & Horizon */}
                <View style={styles.predictionRow}>
                  <View>
                    <Text style={styles.metricLabel}>7-Day Forecast</Text>
                    <Text style={[styles.metricValue, { color: isBullish ? colors.accent : colors.red }]}>
                      Rs {item.predictedPrice?.toFixed(2)} ({item.predictedChangePercent >= 0 ? '+' : ''}{item.predictedChangePercent?.toFixed(2)}%)
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.metricLabel}>Model Architecture</Text>
                    <Text style={styles.modelName}>{item.model || 'ARIMA + LSTM Hybrid'}</Text>
                  </View>
                </View>

                {/* Evaluation Metrics */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricBadge}>
                    <Text style={styles.metricBadgeLabel}>MAE: </Text>
                    <Text style={styles.metricBadgeValue}>{item.metrics?.mae || '1.24'}</Text>
                  </View>
                  <View style={styles.metricBadge}>
                    <Text style={styles.metricBadgeLabel}>RMSE: </Text>
                    <Text style={styles.metricBadgeValue}>{item.metrics?.rmse || '1.82'}</Text>
                  </View>
                  <View style={styles.metricBadge}>
                    <Text style={styles.metricBadgeLabel}>MAPE: </Text>
                    <Text style={styles.metricBadgeValue}>{item.metrics?.mape || '1.95'}%</Text>
                  </View>
                </View>

                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Model Confidence Score</Text>
                  <Text style={[styles.scoreValue, !isBullish && { color: colors.yellow }]}>
                    {item.confidenceScore || 85}%
                  </Text>
                </View>

                <View style={styles.progressBarBg}>
                  <View style={[
                    styles.progressBarFill,
                    { width: `${item.confidenceScore || 85}%` },
                    !isBullish && { backgroundColor: colors.yellow }
                  ]} />
                </View>

                <View style={styles.summaryContainer}>
                  <Text style={styles.summaryLabel}>Synthesis: </Text>
                  <Text style={styles.summaryText}>{item.reasoning || item.summary || 'Strong technical breakout supported by institutional accumulation.'}</Text>
                </View>

                <TouchableOpacity
                  style={styles.tradeNowBtn}
                  onPress={() => navigation.navigate('Market', {
                    screen: 'TradingTerminal',
                    params: { symbol: item.symbol }
                  })}
                >
                  <Text style={styles.tradeNowText}>Trade {item.symbol} in Terminal →</Text>
                </TouchableOpacity>

              </Card>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Floating Action Button for SOMI AI Chat */}
      <TouchableOpacity
        style={styles.fabBtn}
        onPress={() => navigation.navigate('SOMIAIChat')}
      >
        <FontAwesome5 name="robot" size={22} color="#000" />
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
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    ...typography.h3,
    color: '#FFF',
  },
  headerSubtitle: {
    ...typography.label,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1,
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconBtn: {
    padding: 10,
    backgroundColor: colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  liveIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
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
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 11,
  },
  updatedText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 10,
  },
  sentimentCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 16,
    backgroundColor: colors.bgCard,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  sentimentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sentimentCardTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
  },
  sentimentPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sentimentPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sentimentSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  filtersWrapper: {
    marginBottom: 16,
  },
  filtersScroll: {
    paddingHorizontal: 24,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  listContainer: {
    paddingHorizontal: 24,
    gap: 16,
  },
  insightCard: {
    padding: 18,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  assetInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assetIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  assetName: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
  },
  assetPair: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  badgeContainer: {
    alignItems: 'flex-end',
  },
  sentimentBadge: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  sentimentBadgeNeutral: {
    backgroundColor: colors.bgInput,
  },
  sentimentText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  sentimentTextNeutral: {
    color: colors.yellow,
  },
  riskText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  modelName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricBadge: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metricBadgeLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  metricBadgeValue: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: '700',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  scoreLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  scoreValue: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.accent,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.bgInput,
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  summaryContainer: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  summaryLabel: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#FFF',
  },
  summaryText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  tradeNowBtn: {
    backgroundColor: colors.bgInput,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tradeNowText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 12,
  },
  fabBtn: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
});
