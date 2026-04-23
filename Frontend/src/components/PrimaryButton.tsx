import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, ViewStyle } from 'react-native';
import { colors, typography } from '../theme';

interface PrimaryButtonProps extends TouchableOpacityProps {
    title: string;
    outline?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({ title, outline = false, style, ...props }) => {
    return (
        <TouchableOpacity
            style={[
                styles.button,
                outline ? styles.outlineButton : styles.filledButton,
                style
            ]}
            {...props}
        >
            <Text style={[
                styles.text,
                outline ? styles.outlineText : styles.filledText
            ]}>
                {title}
            </Text>
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
