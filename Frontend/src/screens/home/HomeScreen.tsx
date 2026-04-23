import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { colors, typography, layout } from '../../theme';
import { Card } from '../../components';

export const HomeScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <MaterialIcons name="person" size={24} color={colors.accent} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.greetingText}>Ayubowan,</Text>
              <Text style={styles.userName}>Alex</Text>
            </View>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <MaterialIcons name="search" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <MaterialIcons name="notifications-none" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Card */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Est. Total Value</Text>
          <Text style={styles.balanceValue}>LKR 245,320.50</Text>
          <View style={styles.pnlPill}>
            <MaterialIcons name="trending-up" size={14} color={colors.accent} />
            <Text style={styles.pnlText}>+1.24% Today's PNL</Text>
          </View>
          <MaterialIcons
            name="account-balance-wallet"
            size={60}
            color={colors.border}
            style={styles.walletWatermark}
          />
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={[styles.actionCard, styles.actionCardActive]}>
            <MaterialIcons name="shopping-cart" size={24} color="#000" />
            <Text style={styles.actionCardActiveText}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard}>
            <MaterialIcons name="pie-chart-outline" size={24} color={colors.accent} />
            <Text style={styles.actionCardText}>Portfolio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard}>
            <MaterialIcons name="history" size={24} color={colors.accent} />
            <Text style={styles.actionCardText}>History</Text>
          </TouchableOpacity>
        </View>

        {/* Rate Banner */}
        <Card style={styles.rateBanner}>
          <View style={styles.rateBannerLeft}>
            <View style={styles.iconStack}>
              <View style={[styles.currencyIcon, { backgroundColor: '#26A17B', zIndex: 2 }]}><Text style={styles.currencyIconText}>USD</Text></View>
              <View style={[styles.currencyIcon, { backgroundColor: '#1A5BFF', marginLeft: -12, zIndex: 1 }]}><Text style={styles.currencyIconText}>LKR</Text></View>
            </View>
            <View style={styles.rateInfoRow}>
              <Text style={styles.ratePairTitle}>USDT/LKR</Text>
              <Text style={styles.rateValue}>Rs 312.25</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.alertBtn}>
            <MaterialIcons name="notifications-active" size={14} color={colors.accent} />
            <Text style={styles.alertBtnText}>Set Alert</Text>
          </TouchableOpacity>
        </Card>

        {/* Watchlist */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Watchlist</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All {'>'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.watchlistScroll}>
          {[
            { pair: 'BTC/LKR', change: '+2.4%', price: '18,450,200', color: colors.accent, data: "M0 30 Q 10 20, 20 25 T 40 10 T 60 40 T 80 5 T 100 20" },
            { pair: 'ETH/LKR', change: '+1.8%', price: '824,150', color: colors.accent, data: "M0 40 Q 15 35, 30 20 T 60 50 T 80 10 T 100 30" }
          ].map((item, index) => (
            <Card key={index} style={styles.watchlistCard}>
              <Text style={styles.watchPair}>{item.pair} <Text style={{ color: item.color }}>{item.change}</Text></Text>
              <Text style={styles.watchPrice}>{item.price}</Text>
              <View style={styles.sparklineContainer}>
                <Svg height="50" width="100" viewBox="0 0 100 50">
                  <Path d={item.data} fill="none" stroke={item.color} strokeWidth="2" />
                </Svg>
              </View>
            </Card>
          ))}
          <View style={{ width: 24 }} />
        </ScrollView>

        {/* Market Trends */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Market Trends</Text>
        </View>
        <Card style={styles.trendCard}>
          <View style={styles.trendHeader}>
            <View style={styles.trendHeaderLeft}>
              <View style={styles.trendIcon}>
                <MaterialIcons name="show-chart" size={16} color={colors.accent} />
              </View>
              <View>
                <Text style={styles.trendTitle}>Top Gainer</Text>
                <Text style={styles.trendSubtitle}>SOL/LKR</Text>
              </View>
            </View>
            <View style={styles.trendHeaderRight}>
              <Text style={styles.trendPrice}>Rs 45,230</Text>
              <Text style={styles.trendChange}>+8.45%</Text>
            </View>
          </View>
          <View style={styles.candlestickPlaceholder}>
            {/* Fake Candlesticks using Views for demonstration */}
            {[50, 60, 40, 70, 80, 50, 90, 110, 100, 130].map((h, i) => (
              <View key={i} style={styles.candleContainer}>
                <View style={[styles.candleWick, { height: h + 20 }]} />
                <View style={[styles.candleBody, { height: h, backgroundColor: i % 3 === 0 ? colors.textMuted : colors.textPrimary }]} />
              </View>
            ))}
          </View>
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {},
  greetingText: {
    ...typography.label,
  },
  userName: {
    ...typography.h3,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 16,
    justifyContent: 'center',
  },
  balanceCard: {
    marginHorizontal: 24,
    marginBottom: 20,
    backgroundColor: '#161616',  // slightly distinct
    padding: 24,
  },
  balanceLabel: {
    ...typography.label,
    marginBottom: 8,
  },
  balanceValue: {
    ...typography.price,
    marginBottom: 16,
  },
  pnlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pnlText: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 4,
  },
  walletWatermark: {
    position: 'absolute',
    top: 20,
    right: 20,
    opacity: 0.1,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: layout.borderRadius,
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionCardActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionCardText: {
    ...typography.bodySmall,
    marginTop: 8,
    color: '#FFF',
    fontWeight: '600',
  },
  actionCardActiveText: {
    ...typography.bodySmall,
    marginTop: 8,
    color: '#000',
    fontWeight: '700',
  },
  rateBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 32,
    padding: 16,
  },
  rateBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconStack: {
    flexDirection: 'row',
    marginRight: 12,
  },
  currencyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.bgCard,
  },
  currencyIconText: {
    fontSize: 8,
    color: '#FFF',
    fontWeight: '700',
  },
  rateInfoRow: {
    justifyContent: 'center',
  },
  ratePairTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#FFF',
  },
  rateValue: {
    ...typography.label,
    fontSize: 14,
  },
  alertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  alertBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    ...typography.h3,
  },
  seeAllText: {
    color: colors.accent,
    fontWeight: '600',
  },
  watchlistScroll: {
    paddingLeft: 24,
    marginBottom: 32,
  },
  watchlistCard: {
    width: 160,
    marginRight: 16,
    padding: 16,
  },
  watchPair: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 8,
  },
  watchPrice: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 8,
  },
  sparklineContainer: {
    height: 50,
    width: 100,
    marginTop: 8,
  },
  trendCard: {
    marginHorizontal: 24,
    padding: 20,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  trendHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trendTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  trendSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  trendHeaderRight: {
    alignItems: 'flex-end',
  },
  trendPrice: {
    ...typography.body,
    fontWeight: '700',
  },
  trendChange: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '700',
  },
  candlestickPlaceholder: {
    height: 150,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingBottom: 20,
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
    width: 8,
    borderRadius: 2,
  },
});
