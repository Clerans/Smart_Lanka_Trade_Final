const fs = require('fs');
const path = require('path');

const screens = [
    'SplashScreen', 'LoginScreen', 'RegisterScreen', 'OTPVerificationScreen', 'KYCVerificationScreen',
    'HomeScreen', 'MarketWatchScreen', 'TradingTerminalScreen', 'AssetDetailsScreen', 'AIAnalyticsScreen',
    'SOMIAIChatScreen', 'DemoTradingScreen', 'WalletOverviewScreen', 'CurrencyConversionScreen',
    'UserProfileScreen', 'SecuritySettingsScreen'
];

const dir = path.join(__dirname, 'src', 'screens');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

screens.forEach(screen => {
    const content = `import React from 'react';\nimport { View, Text, StyleSheet } from 'react-native';\nimport { colors } from '../theme';\n\nexport const ${screen} = () => {\n  return (\n    <View style={styles.container}>\n      <Text style={styles.text}>${screen}</Text>\n    </View>\n  );\n};\n\nconst styles = StyleSheet.create({\n  container: {\n    flex: 1,\n    backgroundColor: colors.bg,\n    justifyContent: 'center',\n    alignItems: 'center',\n  },\n  text: {\n    color: colors.textPrimary,\n  },\n});\n`;
    fs.writeFileSync(path.join(dir, `${screen}.tsx`), content);
});

// Create index.ts for screens to export all
const indexContent = screens.map(s => `export * from './${s}';`).join('\n');
fs.writeFileSync(path.join(dir, 'index.ts'), indexContent);

console.log('Screens scaffolded');
