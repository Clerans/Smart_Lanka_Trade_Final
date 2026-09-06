import * as React from 'react';
const { useEffect, useState } = React;
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, layout } from '../../theme';
import { Card } from '../../components';
import { authService, kycService } from '../../services/apiService';

const menuItems = [
  { id: 'kyc', title: 'KYC Identity Verification', icon: 'verified-user', screen: 'KYCVerification' },
  { id: '1', title: 'Security & Privacy', icon: 'security', screen: 'SecuritySettings' },
  { id: '2', title: 'Currency Conversion', icon: 'currency-exchange', screen: 'CurrencyConversion' },
  { id: '3', title: 'Trading Limits & Fees', icon: 'assessment' },
  { id: '4', title: 'Connected Devices', icon: 'devices', screen: 'SecuritySettings' },
  { id: '5', title: 'Help & Support', icon: 'help-outline' },
  { id: '6', title: 'About SmartLanka', icon: 'info-outline' },
];

export const UserProfileScreen = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [kycStatus, setKycStatus] = useState<string>('NOT_SUBMITTED');
  const [loadingKyc, setLoadingKyc] = useState<boolean>(true);

  // Functional Preferences
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);

  // Modals
  const [limitsModalVisible, setLimitsModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        setUser(JSON.parse(userData));
      }

      const bio = await AsyncStorage.getItem('@pref_biometric');
      if (bio !== null) setBiometricEnabled(bio === 'true');

      const push = await AsyncStorage.getItem('@pref_push_notifications');
      if (push !== null) setPushEnabled(push === 'true');
    };
    loadUser();
  }, [isFocused]);

  useEffect(() => {
    async function fetchKyc() {
      try {
        setLoadingKyc(true);
        const res = await kycService.getKYCStatus();
        if (res?.data?.status) {
          setKycStatus(res.data.status);
        }
      } catch (e) {
        // user not authenticated or offline
      } finally {
        setLoadingKyc(false);
      }
    }
    if (isFocused) {
      fetchKyc();
    }
  }, [isFocused]);

  const handleBiometricToggle = async (val: boolean) => {
    setBiometricEnabled(val);
    await AsyncStorage.setItem('@pref_biometric', String(val));
    if (val) {
      Alert.alert('Biometrics Enabled', 'Biometric authentication is active for fast sign-in.');
    } else {
      Alert.alert('Biometrics Disabled', 'Standard password login is now required.');
    }
  };

  const handlePushToggle = async (val: boolean) => {
    setPushEnabled(val);
    await AsyncStorage.setItem('@pref_push_notifications', String(val));
    if (val) {
      Alert.alert('Push Notifications Enabled', 'You will receive real-time price alerts and trade execution notifications.');
    } else {
      Alert.alert('Push Notifications Disabled', 'Notification alerts muted.');
    }
  };

  const handleMenuItemPress = (item: any) => {
    if (item.screen) {
      navigation.navigate(item.screen);
      return;
    }
    if (item.id === '3') {
      setLimitsModalVisible(true);
    } else if (item.id === '5') {
      setSupportModalVisible(true);
    } else if (item.id === '6') {
      setAboutModalVisible(true);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Logout', 
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Auth' }],
          });
        }
      }
    ]);
  };

  const getTierBadge = () => {
    if (loadingKyc) {
      return (
        <View style={[styles.tierBadge, { backgroundColor: colors.bgInput }]}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
        </View>
      );
    }
    if (kycStatus === 'VERIFIED') {
      return (
        <TouchableOpacity style={[styles.tierBadge, { backgroundColor: colors.accentMuted }]} onPress={() => navigation.navigate('KYCVerification')}>
          <MaterialIcons name="verified" size={14} color={colors.accent} />
          <Text style={[styles.tierText, { color: colors.accent }]}>Tier 2 Verified</Text>
        </TouchableOpacity>
      );
    }
    if (kycStatus === 'PENDING') {
      return (
        <TouchableOpacity style={[styles.tierBadge, { backgroundColor: colors.yellow + '33' }]} onPress={() => navigation.navigate('KYCVerification')}>
          <MaterialIcons name="pending-actions" size={14} color={colors.yellow} />
          <Text style={[styles.tierText, { color: colors.yellow }]}>KYC Pending Review</Text>
        </TouchableOpacity>
      );
    }
    if (kycStatus === 'REJECTED') {
      return (
        <TouchableOpacity style={[styles.tierBadge, { backgroundColor: colors.red + '33' }]} onPress={() => navigation.navigate('KYCVerification')}>
          <MaterialIcons name="error" size={14} color={colors.red} />
          <Text style={[styles.tierText, { color: colors.red }]}>KYC Rejected (Retry)</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity style={[styles.tierBadge, { backgroundColor: colors.bgInput }]} onPress={() => navigation.navigate('KYCVerification')}>
        <MaterialIcons name="shield" size={14} color={colors.textSecondary} />
        <Text style={[styles.tierText, { color: colors.textSecondary }]}>Verify Identity (KYC)</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('SecuritySettings')}>
            <MaterialIcons name="settings" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* User Card */}
        <Card style={styles.userCard}>
          <View style={styles.userInfoRow}>
            <View style={styles.avatarLarge}>
              <MaterialIcons name="person" size={40} color={colors.accent} />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user?.name || 'SmartLanka Trader'}</Text>
              <Text style={styles.userEmail}>{user?.email || 'trader@smartlanka.com'}</Text>
              {getTierBadge()}
            </View>
          </View>
        </Card>

        {/* Preferences Toggle Row */}
        <View style={styles.preferencesSection}>
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <MaterialIcons name="fingerprint" size={24} color={colors.accent} style={styles.prefIcon} />
              <View>
                <Text style={styles.prefText}>Biometric Login</Text>
                <Text style={styles.prefSubtext}>Fingerprint & Face authentication</Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <MaterialIcons name="notifications-active" size={24} color={colors.accent} style={styles.prefIcon} />
              <View>
                <Text style={styles.prefText}>Push Notifications</Text>
                <Text style={styles.prefSubtext}>Price alerts and order executions</Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={pushEnabled}
              onValueChange={handlePushToggle}
            />
          </View>
        </View>

        {/* Menu List */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.menuItem}
              onPress={() => handleMenuItemPress(item)}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconBg, item.id === 'kyc' && { backgroundColor: colors.accentMuted }]}>
                  <MaterialIcons 
                    name={item.icon as any} 
                    size={20} 
                    color={item.id === 'kyc' ? colors.accent : colors.textPrimary} 
                  />
                </View>
                <Text style={[styles.menuTitle, item.id === 'kyc' && { fontWeight: '700' }]}>
                  {item.title}
                </Text>
              </View>
              {item.id === 'kyc' && (
                <Text style={{ fontSize: 11, color: kycStatus === 'VERIFIED' ? colors.accent : colors.yellow, marginRight: 8, fontWeight: '600' }}>
                  {kycStatus === 'VERIFIED' ? 'Verified' : kycStatus === 'PENDING' ? 'Pending' : 'Required'}
                </Text>
              )}
              {item.id === '4' && (
                <Text style={{ fontSize: 11, color: colors.accent, marginRight: 8, fontWeight: '600' }}>
                  2 Active
                </Text>
              )}
              <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Log Out Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color={colors.red} style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />

      </ScrollView>

      {/* 1. TRADING LIMITS & FEES MODAL */}
      <Modal visible={limitsModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trading Limits & Fees</Text>
              <TouchableOpacity onPress={() => setLimitsModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              <View style={styles.limitCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.limitTierTitle}>Virtual Demo Trading</Text>
                  <Text style={[styles.limitValue, { color: colors.accent }]}>UNLIMITED</Text>
                </View>
                <Text style={styles.limitSub}>Virtual balance: LKR 1,000,000.00 with zero risk simulation</Text>
              </View>

              <View style={styles.limitCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.limitTierTitle}>Daily LKR Deposit Limit</Text>
                  <Text style={styles.limitValue}>LKR 5,000,000</Text>
                </View>
                <Text style={styles.limitSub}>Tier 2 Verified Account via direct bank wire / CEFTS</Text>
              </View>

              <View style={styles.limitCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.limitTierTitle}>Daily Crypto Withdrawal</Text>
                  <Text style={styles.limitValue}>2.000000 BTC</Text>
                </View>
                <Text style={styles.limitSub}>24-hour rolling security limit with 2FA enforcement</Text>
              </View>

              <View style={styles.feeBreakdown}>
                <Text style={styles.feeTitle}>FEE SCHEDULE</Text>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Maker Fee</Text>
                  <Text style={styles.feeValue}>0.10%</Text>
                </View>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Taker Fee</Text>
                  <Text style={styles.feeValue}>0.15%</Text>
                </View>
                <View style={styles.feeRow}>
                  <Text style={styles.feeLabel}>Sri Lanka Tax (WHT)</Text>
                  <Text style={[styles.feeValue, { color: colors.accent }]}>0.00% (Exempt)</Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setLimitsModalVisible(false)}>
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. ABOUT SMARTLANKA MODAL */}
      <Modal visible={aboutModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>About SmartLanka Trade</Text>
              <TouchableOpacity onPress={() => setAboutModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', marginVertical: 16 }}>
              <View style={styles.aboutLogoBg}>
                <MaterialIcons name="trending-up" size={36} color={colors.accent} />
              </View>
              <Text style={styles.aboutAppName}>SmartLanka Trade</Text>
              <Text style={styles.aboutVersion}>Version 2.4.0 (Build 2026.09)</Text>
            </View>

            <Text style={styles.aboutDesc}>
              Sri Lanka's leading digital trading terminal combining CSE equities with global crypto assets. Features AI technical signal generation (SOMI Engine), real-time LKR exchange rate conversion, and automated Sri Lankan NIC OCR verification.
            </Text>

            <View style={styles.certRow}>
              <MaterialIcons name="security" size={16} color={colors.accent} />
              <Text style={styles.certText}>256-Bit SSL Encryption • Oracle ACID Database</Text>
            </View>

            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setAboutModalVisible(false)}>
              <Text style={styles.modalDoneBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. HELP & SUPPORT MODAL */}
      <Modal visible={supportModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Help & Support</Text>
              <TouchableOpacity onPress={() => setSupportModalVisible(false)}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.supportOption} 
              onPress={() => {
                setSupportModalVisible(false);
                navigation.navigate('SOMIAIChat');
              }}
            >
              <View style={styles.supportOptionIcon}>
                <MaterialIcons name="smart-toy" size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportOptionTitle}>Chat with SOMI AI</Text>
                <Text style={styles.supportOptionSub}>Get instant answers on trading, signals & portfolio</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.supportOption}
              onPress={() => {
                Alert.alert('Official Email Support', 'Reach us anytime at:\n\nsupport@smartlanka.trade\n\nResponse time: Under 1 hour.');
              }}
            >
              <View style={styles.supportOptionIcon}>
                <MaterialIcons name="mail-outline" size={24} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportOptionTitle}>Official Email Support</Text>
                <Text style={styles.supportOptionSub}>support@smartlanka.trade</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setSupportModalVisible(false)}>
              <Text style={styles.modalDoneBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingBottom: 40,
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
    color: '#FFF',
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    borderRadius: 16,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    ...typography.h3,
    color: '#FFF',
    marginBottom: 2,
    fontSize: 18,
  },
  userEmail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  tierText: {
    ...typography.label,
    fontSize: 10,
    marginLeft: 4,
    fontWeight: '700',
  },
  preferencesSection: {
    marginHorizontal: 24,
    backgroundColor: colors.bgCard,
    borderRadius: layout.borderRadius,
    marginBottom: 24,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  prefIcon: {
    marginRight: 14,
  },
  prefText: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFF',
  },
  prefSubtext: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  menuSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFF',
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 24,
    paddingVertical: 16,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.red,
    backgroundColor: 'rgba(255, 68, 68, 0.05)',
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    ...typography.body,
    color: colors.red,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    ...typography.h2,
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  modalDoneBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  modalDoneBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  limitCard: {
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  limitTierTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFF',
  },
  limitValue: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFF',
  },
  limitSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
  },
  feeBreakdown: {
    marginTop: 10,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  feeTitle: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 10,
    marginBottom: 10,
    letterSpacing: 1,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  feeLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  feeValue: {
    ...typography.bodySmall,
    color: '#FFF',
    fontWeight: '600',
  },
  aboutLogoBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  aboutAppName: {
    ...typography.h2,
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  aboutVersion: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  aboutDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginVertical: 12,
  },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: colors.bgInput,
    borderRadius: 8,
  },
  certText: {
    ...typography.bodySmall,
    color: colors.accent,
    fontSize: 11,
    marginLeft: 6,
    fontWeight: '600',
  },
  supportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  supportOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  supportOptionTitle: {
    ...typography.body,
    fontWeight: '600',
    color: '#FFF',
  },
  supportOptionSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
});
