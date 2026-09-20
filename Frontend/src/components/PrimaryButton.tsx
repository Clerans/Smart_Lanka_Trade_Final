import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { colors, typography } from '../theme';

interface PrimaryButtonProps extends TouchableOpacityProps {
  title: string;
  outline?: boolean;
  loading?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  outline = false,
  loading = false,
  style,
  disabled,
  ...props
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        outline ? styles.outlineButton : styles.filledButton,
        (disabled || loading) && styles.disabledButton,
        style
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={outline ? colors.accent : '#000000'} size="small" />
      ) : (
        <Text style={[
          styles.text,
          outline ? styles.outlineText : styles.filledText
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  filledButton: {
    backgroundColor: colors.accent,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  disabledButton: {
    opacity: 0.7,
  },
  text: {
    ...typography.body,
    fontWeight: '700',
  },
  filledText: {
    color: '#000000',
  },
  outlineText: {
    color: colors.accent,
  },
});
