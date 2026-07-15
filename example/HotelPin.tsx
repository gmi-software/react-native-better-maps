import { StyleSheet, Text, View } from 'react-native';
import type { HotelCategory } from './examples/hotels';

/** Fixed logical size passed to marker `image.width` / `image.height` (dp). */
export const HOTEL_PIN_WIDTH = 96;
export const HOTEL_PIN_HEIGHT = 40;

const CATEGORY_GLYPH: Record<HotelCategory, string> = {
  budget: '◆',
  boutique: '✦',
  luxury: '★',
  business: '▣',
};

export type HotelPinProps = {
  price: number;
  category: HotelCategory;
  focused?: boolean;
};

export function HotelPin({ price, category, focused = false }: HotelPinProps) {
  return (
    <View
      style={[
        styles.pin,
        focused ? styles.pinFocused : styles.pinDefault,
      ]}
    >
      <Text style={[styles.glyph, focused && styles.glyphFocused]}>
        {CATEGORY_GLYPH[category]}
      </Text>
      <Text style={[styles.price, focused && styles.priceFocused]}>
        ${price}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: HOTEL_PIN_WIDTH,
    height: HOTEL_PIN_HEIGHT,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  pinDefault: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e5ea',
  },
  pinFocused: {
    backgroundColor: '#e53935',
    borderColor: '#c62828',
  },
  glyph: {
    fontSize: 14,
    color: '#636366',
  },
  glyphFocused: {
    color: '#ffffff',
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  priceFocused: {
    color: '#ffffff',
  },
});
