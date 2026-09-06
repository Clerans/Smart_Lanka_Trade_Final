import * as React from 'react';
const { useEffect, useState } = React;
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, layout } from '../../theme';
import { Card } from '../../components';
import { authService, kycService } from '../../services/apiService';

export const UserProfileScreen = () => {
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<{ name: string; email: string; role?: string; kyc_status?: string } | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        setUser(JSON.parse(userData));
      }
      try {
        const kycRes = await kycService.getKycStatus();
        if (kycRes?.success && kycRes.data) {
          setUser(prev => prev ? { ...prev, kyc_status: kycRes.data.status } : null);
        }
      } catch (err) {
        // ignore
      }
    };
    loadUser();
  }, []);

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

  const menuItems = [
    {
      id: '1',
      title: 'KYC Identity Verification',
      icon: 'verified-user',
      onPress: () => navigation.navigate('KYCVerification'),
    },
    {
      id: '2',
      title: 'Security & 2FA Settings',
      icon: 'security',
      onPress: () => navigation.navigate('SecuritySettings'),
    },
    {
      id: '3',
      title: 'SOMI AI Financial Helpdesk',
      icon: 'support-agent',
      onPress: () => navigation.navigate('SOMIAIChat'),
    },
    {
      id: '4',
      title: 'Trading Limits & SEC Compliance',
      icon: 'assessment',
      onPress: () => Alert.alert('SEC Sri Lanka Compliance', 'Your account operates under standard CSE/SEC tier retail equity trading limits (LKR 5,000,000 / day).'),
    },
    {
      id: '5',
      title: 'About SmartLanka Trade',
      icon: 'info-outline',
      onPress: () => Alert.alert('SmartLanka Trade v2.4.0', 'Horizon Campus IT41028 Capstone Project.\nReal-Time LKR Stock Trading with Quantitative Machine Learning Intelligence.'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Account Profile</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SecuritySettings')} style={styles.iconBtn}>
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
              <Text style={styles.userEmail}>{user?.email || 'trader@smartlanka.lk'}</Text>
              <View style={styles.tierBadge}>
                <MaterialIcons name="verified" size={14} color={colors.accent} />
                <Text style={styles.tierText}>
                  {user?.kyc_status === 'VERIFIED' ? 'NIC KYC Verified' : 'Standard Investor'}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Preferences Toggle Row */}
        <View style={styles.preferencesSection}>
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <MaterialIcons name="fingerprint" size={24} color={colors.textSecondary} style={styles.prefIcon} />
              <Text style={styles.prefText}>Biometric Authentication</Text>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={biometricEnabled}
              onValueChange={setBiometricEnabled}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <MaterialIcons name="notifications-active" size={24} color={colors.textSecondary} style={styles.prefIcon} />
              <Text style={styles.prefText}>CSE Market Price Alerts</Text>
            </View>
            <Switch
              trackColor={{ false: colors.bgInput, true: colors.accent }}
              thumbColor={'#FFF'}
              ios_backgroundColor="#3e3e3e"
              value={pushEnabled}
              onValueChange={setPushEnabled}
            />
          </View>
        </View>

        {/* Menu List */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity key={item.id} style={styles.menuItem} onPress={item.onPress}>
              <View style={styles.menuLeft}>
                <View style={styles.menuIconBg}>
                  <MaterialIcons name={item.icon as any} size={20} color={colors.textPrimary} />
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
              </View>
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
    paddingTop: 16,
    marginBottom: 20,
  },
  headerTitle: {
    ...typography.h1,
    color: '#FFF',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    color: '#FFF',
    marginBottom: 2,
  },
  userEmail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  tierText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    marginLeft: 4,
  },
  preferencesSection: {
    marginHorizontal: 24,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefIcon: {
    marginRight: 12,
  },
  prefText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  menuSection: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.bgInput,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTitle: {
    ...typography.body,
    color: colors.textPrimary,
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.red + '22',
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.red,
  },
});
