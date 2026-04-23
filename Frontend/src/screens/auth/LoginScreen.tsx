import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors, typography, layout } from '../../theme';
import { InputField, PrimaryButton } from '../../components';

const { height } = Dimensions.get('window');
const isSmallDevice = height < 700;

export const LoginScreen = () => {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>

          <View style={styles.spacer} />

          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <MaterialIcons name="trending-up" size={isSmallDevice ? 20 : 24} color={colors.accent} />
            </View>
            <Text style={styles.appName}>SmartLanka Trade</Text>

            <Text style={styles.headline}>Welcome Back</Text>
            <Text style={styles.subtitle}>Trade Smarter. Securely.</Text>
          </View>

          <View style={styles.spacer} />

          {/* Form Section */}
          <View style={styles.formSection}>
            <Text style={styles.label}>Email Address</Text>
            <InputField
              placeholder="yourname@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              iconLeft={<MaterialIcons name="mail-outline" size={20} color={colors.accent} />}
            />

            <View style={styles.passwordHeader}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity>
                <Text style={styles.forgotPassword}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <InputField
              placeholder="••••••••••••"
              secureTextEntry
              iconLeft={<MaterialIcons name="lock-outline" size={20} color={colors.accent} />}
              iconRight={<MaterialIcons name="visibility-off" size={20} color={colors.textSecondary} />}
            />

            {/* Biometrics Button */}
            <TouchableOpacity style={styles.biometricsButton}>
              <MaterialIcons name="fingerprint" size={20} color={colors.accent} />
              <Text style={styles.biometricsText}>Use Biometrics</Text>
            </TouchableOpacity>

            {/* Primary CTA */}
            <PrimaryButton
              title="Login to Dashboard"
              onPress={() => navigation.navigate('MainApp')}
              style={styles.loginBtn}
            />
          </View>

          <View style={styles.smallSpacer} />

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.smallSpacer} />

          {/* Google Button */}
          <TouchableOpacity style={styles.googleButton}>
            <FontAwesome5 name="google" size={18} color="#FFFFFF" />
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.spacer} />

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don't have an account?{' '}
              <Text
                style={styles.registerLink}
                onPress={() => navigation.navigate('Register')}
              >
                Register Now
              </Text>
            </Text>
          </View>

          <View style={styles.spacer} />

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  spacer: {
    flex: 1,
  },
  smallSpacer: {
    flex: 0.5,
    minHeight: isSmallDevice ? 16 : 24,
  },
  header: {
    alignItems: 'center',
  },
  logoContainer: {
    width: isSmallDevice ? 36 : 48,
    height: isSmallDevice ? 36 : 48,
    borderRadius: isSmallDevice ? 18 : 24,
    backgroundColor: colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: isSmallDevice ? 8 : 16,
  },
  appName: {
    ...typography.h3,
    marginBottom: isSmallDevice ? 16 : 32,
  },
  headline: {
    ...typography.h1,
    fontSize: isSmallDevice ? 28 : 32,
    marginBottom: 8,
  },
  subtitle: {
    ...typography.body,
    fontSize: isSmallDevice ? 14 : 16,
    color: colors.accent,
  },
  formSection: {
    width: '100%',
  },
  label: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: isSmallDevice ? 8 : 12,
  },
  forgotPassword: {
    ...typography.bodySmall,
    color: colors.accent,
  },
  biometricsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    alignSelf: 'center',
    marginBottom: isSmallDevice ? 16 : 24,
    marginTop: isSmallDevice ? 8 : 12,
  },
  biometricsText: {
    ...typography.bodySmall,
    color: colors.accent,
    marginLeft: 8,
    fontWeight: '600',
  },
  loginBtn: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    paddingHorizontal: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: isSmallDevice ? 48 : 56,
    borderRadius: layout.borderRadiusPill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleText: {
    ...typography.body,
    color: '#FFFFFF',
    marginLeft: 12,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    ...typography.body,
    fontSize: isSmallDevice ? 14 : 16,
    color: colors.textSecondary,
  },
  registerLink: {
    color: colors.accent,
    fontWeight: '700',
  },
});
