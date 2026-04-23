import React from 'react';
import { Switch, SwitchProps } from 'react-native';
import { colors } from '../theme';

export const GreenToggle: React.FC<SwitchProps> = (props) => {
    return (
        <Switch
            trackColor={{ false: colors.bgInput, true: colors.accent }}
            thumbColor={'#FFFFFF'}
            ios_backgroundColor={colors.bgInput}
            {...props}
        />
    );
};
