// Stub react-native per test node
export const Platform = { OS: 'web', select: (o) => (o && (o.web ?? o.default)) };
export const Appearance = { getColorScheme: () => 'dark', addChangeListener: () => ({ remove() {} }) };
export const StyleSheet = { create: (x) => x, flatten: (x) => x, hairlineWidth: 1 };
export const Dimensions = { get: () => ({ width: 390, height: 844 }) };
export const NativeModules = {};
export const I18nManager = { isRTL: false };
export const Linking = { openSettings: async () => {}, openURL: async () => {} };
export const Alert = { alert: () => {} };
