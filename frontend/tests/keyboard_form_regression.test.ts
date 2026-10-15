import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_PATH = path.resolve(__dirname, '../components/forms/KeyboardForm.tsx');
const source = fs.readFileSync(SOURCE_PATH, 'utf8');

describe('KeyboardForm shared context regressions (static contract)', () => {
  it('keeps footer measurement + explicit inset and +12 caret clearance', () => {
    expect(source).toContain('const [height, measure] = useState(0);');
    expect(source).toContain('height + footerBottomInset');
    expect(source).toContain('bottomOffset={height + 12}');
  });

  it('keeps keyboard-safe props without extra IME padding', () => {
    expect(source).toContain('extraKeyboardSpace={0}');
    expect(source).toContain('automaticallyAdjustKeyboardInsets={false}');
    expect(source).toContain('contentInsetAdjustmentBehavior="never"');
    expect(source).toContain('disableScrollOnKeyboardHide');
  });

  it('keeps taps handled and clipping disabled for long forms', () => {
    expect(source).toContain('keyboardShouldPersistTaps="handled"');
    expect(source).toContain("keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}");
    expect(source).toContain('removeClippedSubviews={false}');
  });

  it('keeps scope isolation through context provider/consumer usage', () => {
    expect(source).toContain('<FooterContext.Provider value={footer}>');
    expect(source).toContain('const { height } = useContext(FooterContext);');
    expect(source).toContain('const { measure } = useContext(FooterContext);');
  });

  it('keeps footer onLayout remeasurement and event forwarding behavior', () => {
    expect(source).toContain('onLayout={event => { measure(event.nativeEvent.layout.height); onLayout?.(event); }}');
  });

  it('keeps ref forwarding on scroll component', () => {
    expect(source).toContain('export const KeyboardFormScrollView = forwardRef<ScrollView');
    expect(source).toContain('ref={ref}');
  });
});
