import React, { forwardRef } from 'react';
import { View, TextInput, StyleSheet, TextInputProps, ViewStyle, StyleProp } from 'react-native';
import { colors, layout, typography } from '../theme';

export interface InputFieldProps extends TextInputProps {
    iconLeft?: React.ReactNode;
    iconRight?: React.ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
}

export const InputField = forwardRef<TextInput, InputFieldProps>(({
    iconLeft,
    iconRight,
    containerStyle,
    style,
    ...props
}, ref) => {
    return (
        <View style={[styles.container, containerStyle]}>
            {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
            <TextInput
                ref={ref}
                style={[
                    styles.input,
                    iconLeft ? { paddingLeft: 46 } : null,
                    iconRight ? { paddingRight: 46 } : null,
                    style
                ]}
                placeholderTextColor={colors.textSecondary}
                {...props}
            />
            {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
        </View>
    );
});

InputField.displayName = 'InputField';

const styles = StyleSheet.create({
    container: {
        width: '100%',
        position: 'relative',
        justifyContent: 'center',
        marginBottom: 10,
    },
    input: {
        ...typography.body,
        height: 50,
        backgroundColor: colors.bgInput,
        borderRadius: layout.borderRadiusSmall,
        color: colors.textPrimary,
        paddingHorizontal: 16,
        fontSize: 14,
    },
    iconLeft: {
        position: 'absolute',
        left: 14,
        zIndex: 1,
    },
    iconRight: {
        position: 'absolute',
        right: 14,
        zIndex: 1,
    },
});
