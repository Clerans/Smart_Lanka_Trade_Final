import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, Animated, View } from 'react-native';
import { colors, typography } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type,
  visible,
  onDismiss,
  duration = 3500
}) => {
  const animatedValue = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      // Slide Down & Fade In
      Animated.spring(animatedValue, {
        toValue: 20,
        useNativeDriver: true,
        bounciness: 8
      }).start();

      const timer = setTimeout(() => {
        dismissToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      animatedValue.setValue(-100);
    }
  }, [visible]);

  const dismissToast = () => {
    Animated.timing(animatedValue, {
      toValue: -120,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      onDismiss();
    });
  };

  if (!visible) return null;

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return colors.bgCard;
      case 'error':
        return '#2C1B1B';
      case 'warning':
        return '#2C251B';
      default:
        return colors.bgCard;
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return colors.accent;
      case 'error':
        return colors.red;
      case 'warning':
        return colors.yellow || '#FFA726';
      default:
        return colors.border;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <MaterialIcons name="check-circle" size={20} color={colors.accent} />;
      case 'error':
        return <MaterialIcons name="error" size={20} color={colors.red} />;
      case 'warning':
        return <MaterialIcons name="warning" size={20} color={colors.yellow || '#FFA726'} />;
      default:
        return null;
    }
  };

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          transform: [{ translateY: animatedValue }],
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
        }
      ]}
    >
      <View style={styles.iconContainer}>{getIcon()}</View>
      <Text style={styles.messageText}>{message}</Text>
      <MaterialIcons
        name="close"
        size={18}
        color={colors.textSecondary}
        onPress={dismissToast}
        style={styles.closeIcon}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 30,
    left: 20,
    right: 20,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 9999,
  },
  iconContainer: {
    marginRight: 12,
  },
  messageText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '500',
    lineHeight: 18,
  },
  closeIcon: {
    marginLeft: 8,
    padding: 4,
  }
});
