import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { PrimaryButton } from './PrimaryButton';

interface NetworkErrorScreenProps {
  onRetry: () => void;
  message?: string;
}

export const NetworkErrorScreen: React.FC<NetworkErrorScreenProps> = ({
  onRetry,
  message = "Please check your internet connection and try again."
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="wifi-off" size={48} color={colors.red} />
        </View>

        <Text style={styles.title}>Network Error</Text>
        <Text style={styles.description}>{message}</Text>

        <PrimaryButton
          title="Retry Connection"
          onPress={onRetry}
          style={styles.retryBtn}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 30,
    backgroundColor: '#1E1414',
    borderColor: '#3A1E1E',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 24,
  },
  retryBtn: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    width: '80%',
  }
});
