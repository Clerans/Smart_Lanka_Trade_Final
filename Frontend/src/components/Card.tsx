import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { colors, layout } from '../theme';

interface CardProps extends ViewProps {
    children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, style, ...props }) => {
    return (
        <View style={[styles.card, style]} {...props}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.bgCard,
        borderRadius: layout.borderRadius,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
    },
});
