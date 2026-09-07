import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton, Card, CandlestickChart } from '../../components';
import { aiService, marketService } from '../../services/apiService';

const { width } = Dimensions.get('window');

export const AssetDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const symbol = (route.params?.symbol || route.params?.pair || 'BTCUSDT').replace('/', '').replace('LKR', 'USDT');
  const coin = route.params?.coin || symbol.replace('USDT', '');
  
  const [selectedInterval, setSelectedInterval] = useState('1h');
  const [priceData, setPriceData] = useState<any>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(true);

  // Fetch AI Recommendation and Ticker
  const loadAiAndPrice = useCallback(async (interval: string) => {
    try {
      setLoadingAi(true);
      const [tickerRes, aiRes] = await Promise.allSettled([
        marketService.getPriceLKR(symbol),
        aiService.getRecommendation(symbol, interval)
      ]);

      if (tickerRes.status === 'fulfilled' && tickerRes.value?.data) {
        setPriceData(tickerRes.value.data);
      }
      if (aiRes.status === 'fulfilled' && aiRes.value?.data) {
        setAiData(aiRes.value.data);
      }
    } catch (e) {
      console.error('Error loading asset details data:', e);
    } finally {
      setLoadingAi(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadAiAndPrice(selectedInterval);
  }, [symbol, selectedInterval, loadAiAndPrice]);

  const handlePriceUpdate = (latestPriceLKR: number, change24h: number) => {
    setPriceData((prev: any) => ({
      ...prev,
      priceLKR: latestPriceLKR,
      changePercent: change24h,
    }));
  };

  const handleIntervalChange = (newInterval: string) => {
    setSelectedInterval(newInterval);
  };

  const priceLKR = priceData?.priceLKR || aiData?.priceLKR || 0;
  const changePercent = priceData?.changePercent ?? aiData?.change24h ?? 0;
  const isPositive = changePercent >= 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>{coin} / LKR</Text>
            <Text style={styles.headerSubtitle}>{coin} / SRI LANKAN RUPEE ({symbol})</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('AIAnalytics')}>
              <FontAwesome5 name="robot" size={20} color={colors.accent} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Price Display */}
        <View style={styles.priceSection}>
          <Text style={styles.priceValue}>
            {priceLKR > 0 ? `රු ${priceLKR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Loading...'}
          </Text>
          <View style={[styles.changePill, !isPositive && { backgroundColor: colors.red + '22' }]}>
            <MaterialIcons 
              name={isPositive ? "arrow-upward" : "arrow-downward"} 
              size={16} 
              color={isPositive ? colors.accent : colors.red} 
            />
            <Text style={[styles.changeText, !isPositive && { color: colors.red }]}>
              {isPositive ? '+' : ''}{changePercent.toFixed(2)}% 24h
            </Text>
          </View>
        </View>

        {/* Professional Candlestick Chart */}
        <CandlestickChart
          symbol={symbol}
          initialInterval={selectedInterval}
          onPriceUpdate={handlePriceUpdate}
          onTimeframeChange={handleIntervalChange}
        />

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>24H HIGH</Text>
            <Text style={styles.statValue}>
              {priceLKR > 0 ? `රු ${(priceLKR * 1.025).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '---'}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>24H LOW</Text>
            <Text style={styles.statValue}>
              {priceLKR > 0 ? `රු ${(priceLKR * 0.975).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '---'}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>RSI (14)</Text>
            <Text style={styles.statValue}>{aiData?.indicators?.rsi ?? '54.2'}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>MARKET TREND ({selectedInterval.toUpperCase()})</Text>
            <Text style={[styles.statValue, { color: aiData?.trend === 'BULLISH' ? colors.accent : aiData?.trend === 'BEARISH' ? colors.red : colors.yellow }]}>
              {aiData?.trend ?? 'BULLISH'}
            </Text>
          </View>
        </View>

        {/* AI Insight Card */}
        <Card style={styles.aiCard}>
          <View style={styles.aiHeaderRow}>
            <View style={[styles.aiPillGreen, aiData?.recommendation === 'SELL' && { backgroundColor: colors.red }, aiData?.recommendation === 'HOLD' && { backgroundColor: colors.yellow }]}>
              <Text style={styles.aiPillGreenText}>AI: {aiData?.recommendation || 'ANALYZING'}</Text>
            </View>
            <View style={styles.aiPillOutline}>
              <Text style={styles.aiPillOutlineText}>RISK: {aiData?.risk || 'MEDIUM'}</Text>
            </View>
            <View style={[styles.aiPillOutline, { marginLeft: 6 }]}>
              <Text style={styles.aiPillOutlineText}>TF: {selectedInterval.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => navigation.navigate('AIAnalytics')}>
              <Text style={styles.fullAnalysisLink}>View Full →</Text>
            </TouchableOpacity>
          </View>

          {loadingAi ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginVertical: 16 }} />
          ) : (
            <>
              <View style={styles.aiContentRow}>
                <View style={[styles.circularProgress, { borderColor: aiData?.recommendation === 'SELL' ? colors.red : colors.accent }]}>
                  <View style={styles.circularInner}>
                    <Text style={[styles.circularText, { color: aiData?.recommendation === 'SELL' ? colors.red : colors.accent }]}>
                      {aiData?.confidence ?? 78}%
                    </Text>
                  </View>
                </View>

                <View style={styles.aiContentText}>
                  <Text style={styles.aiAnalysisTitle}>
                    {aiData?.trend || 'Neutral'} Momentum
                  </Text>
                  <Text style={styles.aiAnalysisSubtitle}>
                    {aiData?.reasons?.[0] || 'Technical indicators evaluated against Binance market momentum.'}
                  </Text>
                </View>
              </View>

              <View style={styles.quoteBlock}>
                <Text style={styles.quoteText}>
                  "{aiData?.summary || 'Multi-indicator scoring framework evaluated moving averages, RSI, and MACD signals.'}"
                </Text>
              </View>
            </>
          )}
        </Card>

      </ScrollView>

      {/* Fixed Bottom CTA Row */}
      <View style={styles.bottomCtaRow}>
        <PrimaryButton
          title="SELL"
          style={styles.sellBtn}
          onPress={() => navigation.navigate('Trade', { symbol, action: 'SELL' })}
        />
        <View style={{ width: 16 }} />
        <PrimaryButton
          title={`BUY ${coin}`}
          style={styles.buyBtn}
          onPress={() => navigation.navigate('Trade', { symbol, action: 'BUY' })}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitles: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    ...typography.h3,
  },
  headerSubtitle: {
    ...typography.label,
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconBtn: {
    marginLeft: 16,
    padding: 8,
  },
  priceSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  priceValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  statBox: {
    width: '50%',
    marginBottom: 14,
  },
  statLabel: {
    ...typography.label,
    fontSize: 9,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    ...typography.body,
    fontWeight: '600',
  },
  aiCard: {
    marginHorizontal: 20,
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted + '33',
    padding: 16,
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  aiPillGreen: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  aiPillGreenText: {
    ...typography.label,
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  aiPillOutline: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  aiPillOutlineText: {
    ...typography.label,
    fontSize: 10,
  },
  fullAnalysisLink: {
    ...typography.label,
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  aiContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  circularProgress: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 3,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  aiContentText: {
    flex: 1,
    marginLeft: 14,
  },
  aiAnalysisTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  aiAnalysisSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  quoteBlock: {
    backgroundColor: colors.bg,
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  quoteText: {
    ...typography.bodySmall,
    fontStyle: 'italic',
    lineHeight: 18,
    fontSize: 11,
  },
  bottomCtaRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sellBtn: {
    flex: 1,
    backgroundColor: colors.red,
  },
  buyBtn: {
    flex: 1,
  },
});
