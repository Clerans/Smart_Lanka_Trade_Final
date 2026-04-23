import React from 'react';
import { View, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, layout, typography } from '../theme';

interface InputFieldProps extends TextInputProps {
    iconLeft?: React.ReactNode;
    iconRight?: React.ReactNode;
}

export const InputField: React.FC<InputFieldProps> = ({
    iconLeft,
    iconRight,
    style,
    ...props
}) => {
    return (
        <View style={styles.container}>
            {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
            <TextInput
                style={[
                    styles.input,
                    iconLeft ? { paddingLeft: 48 } : null,
                    iconRight ? { paddingRight: 48 } : null,
                    style
                ]}
                placeholderTextColor={colors.textSecondary}
                {...props}
            />
            {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        position: 'relative',
        justifyContent: 'center',
        marginBottom: layout.borderRadius,
    },
    input: {
        ...typography.body,
        height: 56,
        backgroundColor: colors.bgInput,
        borderRadius: layout.borderRadiusSmall,
        color: colors.textPrimary,
        paddingHorizontal: 16,
    },
    iconLeft: {
        position: 'absolute',
        left: 16,
        zIndex: 1,
    },
    iconRight: {
        position: 'absolute',
        right: 16,
        zIndex: 1,
    },
});
