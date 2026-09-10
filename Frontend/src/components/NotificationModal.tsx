import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../theme';
import { alertService } from '../services/apiService';
import { useNavigation } from '@react-navigation/native';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenSetAlert?: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
  onOpenSetAlert,
}) => {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<'all' | 'alerts' | 'signals'>('all');
  const [userAlerts, setUserAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await alertService.getUserAlerts();
      if (res && res.success && Array.isArray(res.data)) {
        setUserAlerts(res.data);
      } else if (Array.isArray(res)) {
        setUserAlerts(res);
      }
    } catch (e) {
      // Keep empty if none or network issue
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchAlerts();
    }
  }, [visible]);

  const handleDeleteAlert = async (id: number) => {
    try {
      await alertService.deleteAlert(id);
      setUserAlerts(prev => prev.filter(a => a.id !== id && a.ID !== id));
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  };

  // Static system & AI signals for a rich live experience
  const systemNotifications = [
    {
      id: 's1',
      type: 'signal',
      title: 'BTC/LKR Bullish Momentum',
      message: 'SOMI AI detected strong upward RSI trend for BTC/LKR on the 1H timeframe.',
      time: '10m ago',
      icon: 'psychology',
      color: colors.accent,
      screen: 'AssetDetails',
      params: { symbol: 'BTCUSDT', coin: 'BTC' }
    },
    {
      id: 's2',
      type: 'signal',
      title: 'USDT/LKR Rate Update',
      message: 'Live exchange rate is holding steady at Rs 328.08 / USD.',
      time: '35m ago',
      icon: 'currency-exchange',
      color: '#00E5FF'
    },
    {
      id: 's3',
      type: 'system',
      title: 'Instant KYC Verification',
      message: 'Automated OCR & Liveness verification is active. Verify your account today.',
      time: '2h ago',
      icon: 'verified-user',
      color: colors.accent,
      screen: 'KYCVerification'
    }
  ];

  const filteredItems = () => {
    if (activeTab === 'alerts') {
      return userAlerts.map(a => ({
        id: `alert-${a.id || a.ID}`,
        type: 'alert',
        rawId: a.id || a.ID,
        title: `${(a.symbol || a.SYMBOL || 'BTCUSDT').replace('USDT', '')}/LKR Price Alert`,
        message: `Trigger when price moves ${a.alertType || a.ALERT_TYPE || 'ABOVE'} Rs ${(a.targetPrice || a.TARGET_PRICE || 0).toLocaleString()}`,
        time: 'Active',
        icon: 'notifications-active',
        color: colors.yellow,
        isUserAlert: true
      }));
    }

    if (activeTab === 'signals') {
      return systemNotifications.filter(n => n.type === 'signal');
    }

    // Tab 'all' - combine user alerts and signals
    const alertItems = userAlerts.map(a => ({
      id: `alert-${a.id || a.ID}`,
      type: 'alert',
      rawId: a.id || a.ID,
      title: `${(a.symbol || a.SYMBOL || 'BTCUSDT').replace('USDT', '')}/LKR Price Alert`,
      message: `Trigger when price moves ${a.alertType || a.ALERT_TYPE || 'ABOVE'} Rs ${(a.targetPrice || a.TARGET_PRICE || 0).toLocaleString()}`,
      time: 'Active Alert',
      icon: 'notifications-active',
      color: colors.yellow,
      isUserAlert: true
    }));

    return [...alertItems, ...systemNotifications];
  };

  const items = filteredItems();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <View style={styles.bellIconBox}>
                <MaterialIcons name="notifications" size={20} color={colors.accent} />
              </View>
              <Text style={styles.headerTitle}>Notifications & Alerts</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterPill, activeTab === 'all' && styles.filterPillActive]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.filterText, activeTab === 'all' && styles.filterTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, activeTab === 'alerts' && styles.filterPillActive]}
              onPress={() => setActiveTab('alerts')}
            >
              <Text style={[styles.filterText, activeTab === 'alerts' && styles.filterTextActive]}>
                Price Alerts ({userAlerts.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, activeTab === 'signals' && styles.filterPillActive]}
              onPress={() => setActiveTab('signals')}
            >
              <Text style={[styles.filterText, activeTab === 'signals' && styles.filterTextActive]}>
                AI Signals
              </Text>
            </TouchableOpacity>
          </View>

          {/* Notifications List */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.loadingText}>Fetching alerts & market updates...</Text>
            </View>
          ) : (
            <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
              {items.length > 0 ? (
                items.map((item: any) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.notificationCard}
                    activeOpacity={item.screen ? 0.7 : 1}
                    onPress={() => {
                      if (item.screen) {
                        onClose();
                        navigation.navigate(item.screen, item.params);
                      }
                    }}
                  >
                    <View style={[styles.iconBox, { backgroundColor: item.color + '22' }]}>
                      <MaterialIcons name={item.icon as any} size={20} color={item.color} />
                    </View>

                    <View style={styles.cardTextContainer}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.cardTime}>{item.time}</Text>
                      </View>
                      <Text style={styles.cardMessage}>{item.message}</Text>
                    </View>

                    {item.isUserAlert && (
                      <TouchableOpacity
                        style={styles.deleteAlertBtn}
                        onPress={() => handleDeleteAlert(item.rawId)}
                      >
                        <MaterialIcons name="delete-outline" size={20} color={colors.red} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyBox}>
                  <MaterialIcons name="notifications-none" size={48} color={colors.textMuted} />
                  <Text style={styles.emptyTitle}>No Notifications</Text>
                  <Text style={styles.emptySubtitle}>You are all caught up with alerts and market news.</Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* Bottom Action */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.createAlertBtn}
              onPress={() => {
                onClose();
                if (onOpenSetAlert) {
                  onOpenSetAlert();
                }
              }}
            >
              <MaterialIcons name="add-alert" size={18} color="#000" />
              <Text style={styles.createAlertText}>Set New Price Alert</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: Dimensions.get('window').height * 0.8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: {
    ...typography.h3,
    fontSize: 18,
  },
  closeBtn: {
    padding: 6,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: layout.borderRadiusPill,
    backgroundColor: colors.bgInput,
  },
  filterPillActive: {
    backgroundColor: colors.accent,
  },
  filterText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 10,
  },
  listScroll: {
    maxHeight: 380,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  cardTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: 6,
  },
  cardMessage: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  deleteAlertBtn: {
    padding: 8,
    marginLeft: 6,
  },
  emptyBox: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '700',
    marginTop: 12,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  footerRow: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createAlertBtn: {
    flexDirection: 'row',
    backgroundColor: colors.accent,
    borderRadius: layout.borderRadiusPill,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  createAlertText: {
    ...typography.body,
    color: '#000',
    fontWeight: '700',
  },
});
