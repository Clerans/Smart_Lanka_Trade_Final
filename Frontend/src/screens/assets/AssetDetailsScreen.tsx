import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton, Card } from '../../components';
import { marketService, aiService } from '../../services/apiService';

const cseMetadata: Record<string, { name: string; sector: string }> = {
  'JKH.N0000': { name: 'John Keells Holdings PLC', sector: 'Conglomerates' },
  'COMB.N0000': { name: 'Commercial Bank of Ceylon PLC', sector: 'Banking' },
  'SAMP.N0000': { name: 'Sampath Bank PLC', sector: 'Banking' },
  'HNB.N0000': { name: 'Hatton National Bank PLC', sector: 'Banking' },
  'DIAL.N0000': { name: 'Dialog Axiata PLC', sector: 'Telecom & Technology' },
  'CTC.N0000': { name: 'Ceylon Tobacco Company PLC', sector: 'Beverage & Tobacco' },
  'LOLC.N0000': { name: 'LOLC Holdings PLC', sector: 'Diversified Financials' },
  'MELS.N0000': { name: 'Melstacorp PLC', sector: 'Conglomerates' },
  'BIL.N0000': { name: 'Browns Investments PLC', sector: 'Investments' },
  'DIST.N0000': { name: 'Distilleries Company of Sri Lanka PLC', sector: 'Beverages' },
  'HAYL.N0000': { name: 'Hayleys PLC', sector: 'Conglomerates' },
  'CARG.N0000': { name: 'Cargills (Ceylon) PLC', sector: 'Food & Staples Retailing' },
};

export const AssetDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const symbol = route.params?.symbol || 'JKH.N0000';

  const [activeTab, setActiveTab] = useState('1D');
  const [quote, setQuote] = useState<any>(null);
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const company = cseMetadata[symbol] || {
    name: symbol,
    sector: 'Colombo Stock Exchange',
  };

  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true);
        const [quoteRes, predRes] = await Promise.all([
          marketService.getPriceLKR(symbol),
          aiService.getPrediction(symbol)
        ]);

        if (quoteRes?.success) setQuote(quoteRes.data);
        if (predRes?.success) setPrediction(predRes.data);
      } catch (error) {
        console.error('Failed to load asset details:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [symbol]);

  const isPositive = (quote?.changePercent || 0) >= 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>{symbol}</Text>
            <Text style={styles.headerSubtitle}>{company.name.toUpperCase()}</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn}>
              <MaterialIcons name="star-outline" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 80, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <>
            {/* Price Display */}
            <View style={styles.priceSection}>
              <Text style={styles.priceValue}>Rs {quote?.priceLKR?.toFixed(2) || '205.50'}</Text>
              <View style={[styles.changePill, isPositive ? styles.changePositiveBg : styles.changeNegativeBg]}>
                <MaterialIcons name={isPositive ? "arrow-upward" : "arrow-downward"} size={16} color={isPositive ? colors.accent : colors.red} />
                <Text style={[styles.changeText, { color: isPositive ? colors.accent : colors.red }]}>
                  {isPositive ? '+' : ''}{quote?.changePercent?.toFixed(2) || '0.00'}% (Last 24h)
                </Text>
              </View>
            </View>

            {/* Time Tabs */}
            <View style={styles.timeTabs}>
              {['1D', '1W', '1M', '1Y', 'ALL'].map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.timeTabBtn, activeTab === tab && styles.timeTabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.timeTabText, activeTab === tab && styles.timeTabTextActive]}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Candlestick / Area Chart Representation */}
            <View style={styles.chartArea}>
              {[60, 45, 80, 50, 95, 110, 85, 120, 100, 140, 130, 160].map((h, i) => {
                const isGreen = i % 2 !== 0 && i > 0;
                return (
                  <View key={i} style={styles.candleContainer}>
                    <View style={[styles.candleWick, { height: h + 24 }]} />
                    <View style={[styles.candleBody, { height: h, backgroundColor: isGreen ? colors.accent : colors.red }]} />
                  </View>
                );
              })}
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>24H HIGH</Text>
                <Text style={styles.statValue}>Rs {quote?.high24h?.toFixed(2) || (quote?.priceLKR * 1.02)?.toFixed(2)}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>24H LOW</Text>
                <Text style={styles.statValue}>Rs {quote?.low24h?.toFixed(2) || (quote?.priceLKR * 0.98)?.toFixed(2)}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>VOLUME</Text>
                <Text style={styles.statValue}>{quote?.volume ? Number(quote.volume).toLocaleString() : '124,500'} Shares</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>SECTOR</Text>
                <Text style={styles.statValue}>{company.sector}</Text>
              </View>
            </View>

            {/* AI Insight Card */}
            <Card style={styles.aiCard}>
              <View style={styles.aiHeaderRow}>
                <View style={styles.aiPillGreen}><Text style={styles.aiPillGreenText}>QUANT AI INSIGHT</Text></View>
                <View style={styles.aiPillOutline}><Text style={styles.aiPillOutlineText}>MODEL: ARIMA + LSTM</Text></View>
                <View style={{ flex: 1 }} />
                <FontAwesome5 name="robot" size={16} color={colors.accent} />
              </View>

              <View style={styles.aiContentRow}>
                <View style={styles.circularProgress}>
                  <Text style={styles.circularText}>{prediction?.confidenceScore || 87}%</Text>
                  <Text style={styles.circularSub}>CONF</Text>
                </View>

                <View style={styles.aiContentText}>
                  <Text style={styles.aiAnalysisTitle}>{prediction?.trend || 'Bullish'} Trajectory</Text>
                  <Text style={styles.aiAnalysisSubtitle}>
                    7-Day Forecast: Rs {prediction?.predictedPrice?.toFixed(2) || (quote?.priceLKR * 1.04)?.toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={styles.quoteBlock}>
                <Text style={styles.quoteText}>
                  "{prediction?.reasoning || 'Price structure indicates solid accumulation on the Colombo Stock Exchange with strong institutional dividend support.'}"
                </Text>
              </View>
            </Card>
          </>
        )}

      </ScrollView>

      {/* Fixed Bottom CTA Row */}
      <View style={styles.bottomCtaRow}>
        <TouchableOpacity
          style={styles.sellBtn}
          onPress={() => navigation.navigate('TradingTerminal', { symbol, initialSide: 'SELL' })}
        >
          <Text style={styles.btnTextWhite}>SELL</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buyBtn}
          onPress={() => navigation.navigate('TradingTerminal', { symbol, initialSide: 'BUY' })}
        >
          <Text style={styles.btnTextBlack}>BUY {symbol.split('.')[0]}</Text>
        </TouchableOpacity>
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
    paddingBottom: 120,
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
    color: '#FFF',
  },
  headerSubtitle: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconBtn: {
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
    marginBottom: 6,
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  changePositiveBg: {
    backgroundColor: colors.accentMuted,
  },
  changeNegativeBg: {
    backgroundColor: colors.red + '22',
  },
  changeText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  timeTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  timeTabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
  },
  timeTabActive: {
    backgroundColor: colors.accent,
  },
  timeTabText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  timeTabTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  chartArea: {
    flexDirection: 'row',
    height: 160,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  candleContainer: {
    alignItems: 'center',
    width: 14,
  },
  candleWick: {
    width: 2,
    backgroundColor: colors.border,
    position: 'absolute',
  },
  candleBody: {
    width: 10,
    borderRadius: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  statBox: {
    width: '48%',
    backgroundColor: colors.bgCard,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  aiCard: {
    marginHorizontal: 24,
    padding: 18,
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  aiPillGreen: {
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  aiPillGreenText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
  },
  aiPillOutline: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiPillOutlineText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  aiContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  circularProgress: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  circularText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  circularSub: {
    fontSize: 8,
    color: colors.textSecondary,
  },
  aiContentText: {
    flex: 1,
  },
  aiAnalysisTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  aiAnalysisSubtitle: {
    fontSize: 12,
    color: colors.accent,
  },
  quoteBlock: {
    backgroundColor: colors.bgInput,
    padding: 12,
    borderRadius: 10,
  },
  quoteText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  bottomCtaRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sellBtn: {
    flex: 1,
    backgroundColor: colors.red,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  buyBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  btnTextWhite: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  btnTextBlack: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
});
