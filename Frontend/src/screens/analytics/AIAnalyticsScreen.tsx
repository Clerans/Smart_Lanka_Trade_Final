import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { Card } from '../../components';
import { aiService } from '../../services/apiService';

const intervals = ['1h', '4h', '1d'];

const ASSET_METADATA: Record<string, { name: string, icon: string, color: string }> = {
  'BTCUSDT': { name: 'Bitcoin', icon: 'bitcoin', color: '#F7931A' },
  'ETHUSDT': { name: 'Ethereum', icon: 'ethereum', color: '#627EEA' },
  'BNBUSDT': { name: 'BNB', icon: 'coins', color: '#F3BA2F' },
  'SOLUSDT': { name: 'Solana', icon: 'bolt', color: '#14F195' },
  'XRPUSDT': { name: 'XRP', icon: 'gem', color: '#23292F' },
  'ADAUSDT': { name: 'Cardano', icon: 'layer-group', color: '#0033AD' },
  'DOGEUSDT': { name: 'Dogecoin', icon: 'paw', color: '#C2A633' },
};

export const AIAnalyticsScreen = () => {
  const navigation = useNavigation<any>();
  const [activeInterval, setActiveInterval] = useState('1h');
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await aiService.getRecommendations(activeInterval);
      if (response && response.data) {
        setRecommendations(response.data);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastUpdated(timeStr);
      }
    } catch (err: any) {
      console.error('Failed to load AI recommendations:', err);
      setError(err.message || 'Unable to connect to AI recommendation service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeInterval]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const toggleExpand = (symbol: string) => {
    setExpandedSymbol(prev => prev === symbol ? null : symbol);
  };

  const getRecommendationBadgeColor = (rec: string) => {
    if (rec === 'BUY') return colors.accent;
    if (rec === 'SELL') return colors.red;
    return colors.yellow;
  };

  const getRiskColor = (risk: string) => {
    if (risk === 'LOW') return colors.accent;
    if (risk === 'HIGH') return colors.red;
    return colors.yellow;
  };

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
            <Text style={styles.headerSubtitle}>ALGORITHMIC RECOMMENDATION ENGINE</Text>
          </View>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => fetchRecommendations(true)}>
            <MaterialIcons name="refresh" size={24} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Status Bar */}
      <View style={styles.liveIndicatorContainer}>
        <View style={styles.liveLeft}>
          <View style={styles.pulseDot} />
          <Text style={styles.liveText}>Multi-Indicator Market Analysis</Text>
        </View>
        <Text style={styles.updatedText}>UPDATED: {lastUpdated}</Text>
      </View>

      {/* Timeframe Interval Filters */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {intervals.map((interval) => {
            const isActive = activeInterval === interval;
            return (
              <TouchableOpacity
                key={interval}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setActiveInterval(interval)}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {interval.toUpperCase()} Timeframe
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Loading State */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Analyzing market indicators from Binance...</Text>
        </View>
      ) : null}

      {/* Error State */}
      {error && !loading ? (
        <View style={styles.errorCard}>
          <MaterialIcons name="error-outline" size={32} color={colors.red} />
          <Text style={styles.errorTitle}>Analysis Unavailable</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchRecommendations(false)}>
            <Text style={styles.retryBtnText}>Retry Analysis</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Recommendations List */}
      {!loading && !error ? (
        <ScrollView 
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={() => fetchRecommendations(true)} 
              tintColor={colors.accent} 
            />
          }
        >
          {recommendations.map((item) => {
            const meta = ASSET_METADATA[item.symbol] || { 
              name: item.coin || item.symbol, 
              icon: 'coins', 
              color: colors.accent 
            };
            const recColor = getRecommendationBadgeColor(item.recommendation);
            const isExpanded = expandedSymbol === item.symbol;

            return (
              <Card key={item.symbol} style={styles.insightCard}>

                {/* Top Row: Coin Info & Action Badge */}
                <View style={styles.cardTopRow}>
                  <View style={styles.assetInfoRow}>
                    <View style={[styles.assetIcon, { backgroundColor: meta.color + '22' }]}>
                      <FontAwesome5 name={meta.icon} size={18} color={meta.color} />
                    </View>
                    <View>
                      <Text style={styles.assetName}>{meta.name}</Text>
                      <Text style={styles.assetPair}>{item.coin}/LKR • {item.symbol}</Text>
                    </View>
                  </View>

                  <View style={styles.badgeContainer}>
                    <View style={[styles.sentimentBadge, { backgroundColor: recColor + '22', borderColor: recColor, borderWidth: 1 }]}>
                      <Text style={[styles.sentimentText, { color: recColor }]}>
                        {item.recommendation}
                      </Text>
                    </View>
                    <Text style={[styles.riskText, { color: getRiskColor(item.risk) }]}>
                      {item.risk} Risk
                    </Text>
                  </View>
                </View>

                {/* Price & Trend Header */}
                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.priceLabel}>Current Price (LKR)</Text>
                    <Text style={styles.priceValue}>
                      රු {item.priceLKR ? item.priceLKR.toLocaleString() : '---'}
                    </Text>
                  </View>
                  <View style={styles.trendContainer}>
                    <Text style={styles.trendLabel}>Trend Direction</Text>
                    <View style={[styles.trendBadge, { backgroundColor: item.trend === 'BULLISH' ? colors.accentMuted : colors.bgInput }]}>
                      <MaterialIcons 
                        name={item.trend === 'BULLISH' ? 'trending-up' : item.trend === 'BEARISH' ? 'trending-down' : 'trending-flat'} 
                        size={16} 
                        color={item.trend === 'BULLISH' ? colors.accent : item.trend === 'BEARISH' ? colors.red : colors.textSecondary} 
                      />
                      <Text style={[styles.trendText, { color: item.trend === 'BULLISH' ? colors.accent : item.trend === 'BEARISH' ? colors.red : colors.textSecondary }]}>
                        {item.trend}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Model Confidence Progress Bar */}
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreLabel}>Model Confidence Score</Text>
                  <Text style={[styles.scoreValue, { color: recColor }]}>
                    {item.confidence}%
                  </Text>
                </View>

                <View style={styles.progressBarBg}>
                  <View style={[
                    styles.progressBarFill,
                    { width: `${item.confidence}%`, backgroundColor: recColor }
                  ]} />
                </View>

                {/* Executive Summary */}
                <View style={styles.summaryContainer}>
                  <Text style={styles.summaryLabel}>Analysis: </Text>
                  <Text style={styles.summaryText}>{item.summary}</Text>
                </View>

                {/* Toggle Button for Full Technical Indicators */}
                <TouchableOpacity 
                  style={styles.toggleIndicatorsBtn}
                  onPress={() => toggleExpand(item.symbol)}
                >
                  <Text style={styles.toggleIndicatorsText}>
                    {isExpanded ? 'Hide Technical Indicators' : 'View Indicator Breakdown & Signals'}
                  </Text>
                  <MaterialIcons 
                    name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                    size={20} 
                    color={colors.accent} 
                  />
                </TouchableOpacity>

                {/* Expanded Technical Indicators & Reasons */}
                {isExpanded && (
                  <View style={styles.expandedSection}>
                    <Text style={styles.indicatorsTitle}>Key Technical Indicators</Text>
                    
                    <View style={styles.indicatorsGrid}>
                      <View style={styles.indicatorBox}>
                        <Text style={styles.indicatorName}>RSI (14)</Text>
                        <Text style={styles.indicatorValue}>{item.indicators?.rsi ?? 'N/A'}</Text>
                      </View>
                      <View style={styles.indicatorBox}>
                        <Text style={styles.indicatorName}>SMA 20</Text>
                        <Text style={styles.indicatorValue}>${item.indicators?.sma20 ? item.indicators.sma20.toLocaleString() : 'N/A'}</Text>
                      </View>
                      <View style={styles.indicatorBox}>
                        <Text style={styles.indicatorName}>SMA 50</Text>
                        <Text style={styles.indicatorValue}>${item.indicators?.sma50 ? item.indicators.sma50.toLocaleString() : 'N/A'}</Text>
                      </View>
                      <View style={styles.indicatorBox}>
                        <Text style={styles.indicatorName}>EMA 20</Text>
                        <Text style={styles.indicatorValue}>${item.indicators?.ema20 ? item.indicators.ema20.toLocaleString() : 'N/A'}</Text>
                      </View>
                      <View style={styles.indicatorBox}>
                        <Text style={styles.indicatorName}>MACD Hist</Text>
                        <Text style={[styles.indicatorValue, { color: (item.indicators?.macdHistogram ?? 0) >= 0 ? colors.accent : colors.red }]}>
                          {item.indicators?.macdHistogram ?? 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.indicatorBox}>
                        <Text style={styles.indicatorName}>Volatility</Text>
                        <Text style={styles.indicatorValue}>{(item.indicators?.volatility * 100).toFixed(2)}%</Text>
                      </View>
                    </View>

                    {/* Supporting Reasons Checklist */}
                    <Text style={styles.reasonsTitle}>Model Decision Signals</Text>
                    {item.reasons && item.reasons.length > 0 ? (
                      item.reasons.map((reason: string, idx: number) => (
                        <View key={idx} style={styles.reasonRow}>
                          <MaterialIcons name="check-circle" size={16} color={colors.accent} style={styles.checkIcon} />
                          <Text style={styles.reasonText}>{reason}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.reasonText}>Consolidation phase detected.</Text>
                    )}
                  </View>
                )}

              </Card>
            );
          })}

          <View style={styles.disclaimerContainer}>
            <MaterialIcons name="info-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.disclaimerText}>
              SmartLanka AI Recommendations are algorithmic signals built for research and educational purposes. Always practice proper risk management.
            </Text>
          </View>
          <View style={{ height: 90 }} />
        </ScrollView>
      ) : null}

      {/* Floating Action Button for SOMI AI Chat */}
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
    fontSize: 9,
    marginTop: 2,
    color: colors.textSecondary,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconBtn: {
    padding: 8,
  },
  liveIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
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
    fontWeight: '600',
  },
  updatedText: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
  },
  filtersWrapper: {
    marginBottom: 16,
  },
  filtersScroll: {
    paddingHorizontal: 24,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusPill,
    backgroundColor: colors.bgInput,
    marginRight: 10,
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  errorCard: {
    margin: 24,
    padding: 24,
    backgroundColor: colors.bgCard,
    borderRadius: layout.borderRadius,
    borderWidth: 1,
    borderColor: colors.red,
    alignItems: 'center',
  },
  errorTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.red,
    marginTop: 8,
  },
  errorMessage: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: layout.borderRadiusPill,
  },
  retryBtnText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#000',
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  insightCard: {
    marginBottom: 16,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
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
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  sentimentText: {
    ...typography.label,
    fontSize: 11,
    fontWeight: '700',
  },
  riskText: {
    ...typography.label,
    fontSize: 10,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  priceLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textSecondary,
  },
  priceValue: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 2,
  },
  trendContainer: {
    alignItems: 'flex-end',
  },
  trendLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  trendText: {
    ...typography.label,
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  scoreLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  scoreValue: {
    ...typography.h3,
    fontSize: 18,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.bgInput,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBarFill: {
    height: '100%',
  },
  summaryContainer: {
    backgroundColor: colors.bg,
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  summaryLabel: {
    ...typography.label,
    color: colors.accent,
    fontWeight: '700',
    marginBottom: 2,
  },
  summaryText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    lineHeight: 18,
    fontSize: 12,
  },
  toggleIndicatorsBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  toggleIndicatorsText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '600',
    fontSize: 12,
    marginRight: 4,
  },
  expandedSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  indicatorsTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  indicatorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  indicatorBox: {
    width: '31%',
    backgroundColor: colors.bgInput,
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  indicatorName: {
    ...typography.label,
    fontSize: 9,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  indicatorValue: {
    ...typography.bodySmall,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  reasonsTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  checkIcon: {
    marginRight: 6,
    marginTop: 2,
  },
  reasonText: {
    ...typography.bodySmall,
    flex: 1,
    fontSize: 11,
    color: colors.textPrimary,
    lineHeight: 16,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  disclaimerText: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
    flex: 1,
    marginLeft: 8,
    lineHeight: 14,
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
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
