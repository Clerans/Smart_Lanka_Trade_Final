import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { Card } from '../../components';

const menuItems = [
  { id: '1', title: 'Security & Privacy', icon: 'security' },
  { id: '2', title: 'Payment Methods', icon: 'payment' },
  { id: '3', title: 'Trading Limits & Fees', icon: 'assessment' },
  { id: '4', title: 'Connected Devices', icon: 'devices' },
  { id: '5', title: 'Help & Support', icon: 'help-outline' },
  { id: '6', title: 'About SmartLanka', icon: 'info-outline' },
];

export const UserProfileScreen = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.iconBtn}>
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
              <Text style={styles.userName}>Alex Fernando</Text>
              <Text style={styles.userEmail}>alex.f@email.com</Text>
              <View style={styles.tierBadge}>
                <MaterialIcons name="verified" size={14} color={colors.accent} />
                <Text style={styles.tierText}>Tier 2 Verified</Text>
              </View>
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
            <TouchableOpacity key={item.id} style={styles.menuItem}>
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
        <TouchableOpacity style={styles.logoutBtn}>
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
    backgroundColor: colors.accentMuted,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  tierText: {
    ...typography.label,
    color: colors.accent,
    marginLeft: 4,
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
