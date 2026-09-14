import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography } from '../../theme';
import { authService } from '../../services/apiService';

export const SplashScreen = () => {
  const navigation = useNavigation<any>();
  const progress = React.useRef(new Animated.Value(0));
  const [widthInterpolated, setWidthInterpolated] = React.useState<Animated.AnimatedInterpolation<string | number> | null>(null);

  useEffect(() => {
    const interpolated = progress.current.interpolate({
      inputRange: [0, 100],
      outputRange: ['0%', '100%'],
    });
    setWidthInterpolated(interpolated);

    Animated.timing(progress.current, {
      toValue: 100,
      duration: 2200,
      useNativeDriver: false,
    }).start(async ({ finished }) => {
      if (finished) {
        try {
          const rememberMe = await AsyncStorage.getItem('rememberMe');
          const { firebaseAuthService } = require('../../services/firebaseAuthService');
          const currentUser = firebaseAuthService.getCurrentUser();
          const token = await firebaseAuthService.getIdToken();

          if (rememberMe === 'true' && (currentUser || token)) {
            try {
              if (currentUser && !currentUser.emailVerified) {
                navigation.replace('OTPVerification', { email: currentUser.email });
                return;
              }
              await authService.sync();
              navigation.replace('MainApp');
              return;
            } catch {
              console.log('Stored token is invalid or expired. Clearing storage.');
              await authService.logout();
            }
          } else {
            // Clean up session if not remembering
            await authService.logout();
          }
        } catch (storageErr) {
          console.error('Storage check failed:', storageErr);
        }
        navigation.replace('Login');
      }
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Centered Content */}
      <View style={styles.centerContent}>
        {/* Logo Icon */}
        <View style={styles.logoContainer}>
          <MaterialIcons name="security" size={48} color={colors.accent} />
          {/* We'll just fake the shield/trending logo according to spec. */}
        </View>

        {/* Top App Name */}
        <Text style={styles.appNameRow}>
          SmartLanka <Text style={{ color: colors.accent }}>Trade</Text>
        </Text>

        {/* Tagline & Progress Container */}
        <View style={styles.progressSection}>
          <View style={styles.taglineRow}>
            <Text style={styles.taglineRowText}>SYSTEM READINESS</Text>
            <Text style={styles.taglineRowTextGreen}>INVEST IN THE FUTURE</Text>
            <Text style={styles.percentageText}>75%</Text>
          </View>
          <View style={styles.progressBarBg}>
            {widthInterpolated ? (
              <Animated.View style={[styles.progressBarFill, { width: widthInterpolated }]} />
            ) : null}
          </View>
        </View>

        {/* Stacked App Name Below Loading */}
        <View style={styles.stackedBrandName}>
          <Text style={styles.stackedNameWhite}>SmartLanka</Text>
          <Text style={styles.stackedNameGreen}>Trade</Text>
          <Text style={styles.investText}>INVEST IN THE FUTURE</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>FINTECH SOLUTIONS SRI LANKA</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: colors.bgCard,
    borderColor: colors.accentMuted,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  appNameRow: {
    ...typography.h2,
    marginBottom: 32,
  },
  progressSection: {
    width: '100%',
    marginBottom: 40,
  },
  taglineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  taglineRowText: {
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  taglineRowTextGreen: {
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1,
    fontWeight: '700',
  },
  percentageText: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: colors.bgInput,
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  stackedBrandName: {
    alignItems: 'flex-start',
    width: '100%',
  },
  stackedNameWhite: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 40,
  },
  stackedNameGreen: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.accent,
    lineHeight: 40,
    marginBottom: 16,
  },
  investText: {
    ...typography.label,
    marginTop: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
  },
  footerText: {
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
