import * as React from 'react';
const { useEffect, useState } = React;
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
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
  { id: '4', title: 'Connected Devices', icon: 'devices' },
  { id: '5', title: 'Help & Support', icon: 'help-outline' },
  { id: '6', title: 'About SmartLanka', icon: 'info-outline' },
];

export const UserProfileScreen = () => {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [kycStatus, setKycStatus] = useState<string>('NOT_SUBMITTED');
  const [loadingKyc, setLoadingKyc] = useState<boolean>(true);

  useEffect(() => {
    const loadUser = async () => {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    };
    loadUser();
  }, []);

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
          <Text style={[styles.tierText, { color: colors.yellow }]}>KYC Pending</Text>
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
            <TouchableOpacity style={styles.editBtn}>
              <MaterialIcons name="edit" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Preferences Toggle Row */}
        <View style={styles.preferencesSection}>
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <MaterialIcons name="fingerprint" size={24} color={colors.textSecondary} style={styles.prefIcon} />
              <Text style={styles.prefText}>Biometric Login</Text>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={true}
              onValueChange={() => { }}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <MaterialIcons name="notifications-active" size={24} color={colors.textSecondary} style={styles.prefIcon} />
              <Text style={styles.prefText}>Push Notifications</Text>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={true}
              onValueChange={() => { }}
            />
          </View>
        </View>

        {/* Menu List */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.menuItem}
              onPress={() => {
                if (item.screen) {
                  navigation.navigate(item.screen);
                }
              }}
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
    marginBottom: 32,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: colors.border,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    ...typography.h3,
    marginBottom: 4,
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
  editBtn: {
    padding: 8,
  },
  preferencesSection: {
    marginHorizontal: 24,
    backgroundColor: colors.bgCard,
    borderRadius: layout.borderRadius,
    marginBottom: 32,
    padding: 8,
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
  },
  prefIcon: {
    marginRight: 16,
  },
  prefText: {
    ...typography.body,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  menuSection: {
    paddingHorizontal: 24,
    marginBottom: 40,
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
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    ...typography.body,
    color: colors.red,
    fontWeight: '700',
  },
});
