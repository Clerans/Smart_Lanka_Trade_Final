import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { PrimaryButton, Card } from '../../components';

const { width } = Dimensions.get('window');

export const AssetDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState('1D');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>BTC / LKR</Text>
            <Text style={styles.headerSubtitle}>BITCOIN / SRI LANKAN RUPEE</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconBtn}>
              <MaterialIcons name="star-outline" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <MaterialIcons name="share" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Price Display */}
        <View style={styles.priceSection}>
          <Text style={styles.priceValue}>18,450,200 LKR</Text>
          <View style={styles.changePill}>
            <MaterialIcons name="arrow-upward" size={16} color={colors.accent} />
            <Text style={styles.changeText}>+2.41% Last 24h</Text>
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

        {/* Fake Candlestick Chart Area */}
        <View style={styles.chartArea}>
          {/* Simple visual representation of candles */}
          {[60, 45, 80, 50, 95, 110, 85, 120, 100, 140, 130, 160].map((h, i) => {
            const isGreen = i % 2 !== 0 && i > 0;
            return (
              <View key={i} style={styles.candleContainer}>
                <View style={[styles.candleWick, { height: h + 30 }]} />
                <View style={[styles.candleBody, { height: h, backgroundColor: isGreen ? colors.accent : colors.red }]} />
              </View>
            );
          })}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>24H HIGH</Text>
            <Text style={styles.statValue}>18,620,000</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>24H LOW</Text>
            <Text style={styles.statValue}>17,980,500</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>24H VOLUME</Text>
            <Text style={styles.statValue}>4.2k BTC</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>MARKET CAP</Text>
            <Text style={styles.statValue}>1.2T LKR</Text>
          </View>
        </View>

        {/* AI Insight Card */}
        <Card style={styles.aiCard}>
          <View style={styles.aiHeaderRow}>
            <View style={styles.aiPillGreen}><Text style={styles.aiPillGreenText}>AI INSIGHT</Text></View>
            <View style={styles.aiPillOutline}><Text style={styles.aiPillOutlineText}>RISK: LOW</Text></View>
            <View style={{ flex: 1 }} />
            <FontAwesome5 name="sparkles" size={16} color={colors.accent} />
          </View>

          <View style={styles.aiContentRow}>
            {/* Fake Circular Progress */}
            <View style={styles.circularProgress}>
              <View style={styles.circularInner}>
                <Text style={styles.circularText}>70%</Text>
              </View>
            </View>

            <View style={styles.aiContentText}>
              <Text style={styles.aiAnalysisTitle}>Bullish Sentiment</Text>
              <Text style={styles.aiAnalysisSubtitle}>Market indicators suggest a strong upward momentum.</Text>
            </View>
          </View>

          <View style={styles.quoteBlock}>
            <Text style={styles.quoteText}>
              "Historical moving averages are converging positively, indicating structural support at the 18.2M LKR level. Volume footprint analysis confirms retail accumulation."
            </Text>
          </View>
        </Card>

      </ScrollView>

      {/* Fixed Bottom CTA Row */}
      <View style={styles.bottomCtaRow}>
        <PrimaryButton
          title="SELL"
          style={styles.sellBtn}
          onPress={() => { }}
        />
        <View style={{ width: 16 }} />
        <PrimaryButton
          title="BUY BTC"
          style={styles.buyBtn}
          onPress={() => { }}
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
    paddingBottom: 100, // space for bottom CTAs
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 24,
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
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconBtn: {
    marginLeft: 16,
  },
  priceSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  priceValue: {
    fontSize: 36,
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
  timeTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  timeTabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: layout.borderRadiusPill,
    backgroundColor: colors.bgInput,
  },
  timeTabActive: {
    backgroundColor: colors.accent,
  },
  timeTabText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  timeTabTextActive: {
    color: '#000',
  },
  chartArea: {
    height: 220,
    width: '100%',
    backgroundColor: '#050505',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 40,
    marginBottom: 24,
  },
  candleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  candleWick: {
    width: 2,
    backgroundColor: colors.textSecondary,
    position: 'absolute',
  },
  candleBody: {
    width: 10,
    borderRadius: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  statBox: {
    width: '50%',
    marginBottom: 16,
  },
  statLabel: {
    ...typography.label,
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    ...typography.body,
    fontWeight: '600',
  },
  aiCard: {
    marginHorizontal: 24,
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted + '44',
  },
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiPillGreen: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  aiPillGreenText: {
    ...typography.label,
    color: '#000',
    fontSize: 10,
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
  aiContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  circularProgress: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '700',
  },
  aiContentText: {
    flex: 1,
    marginLeft: 16,
  },
  aiAnalysisTitle: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  aiAnalysisSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  quoteBlock: {
    backgroundColor: colors.bg,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  quoteText: {
    ...typography.bodySmall,
    fontStyle: 'italic',
    lineHeight: 20,
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
  },
  buyBtn: {
    flex: 1,
  },
});
