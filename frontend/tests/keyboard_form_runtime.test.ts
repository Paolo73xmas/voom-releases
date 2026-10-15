// Execute the real component functions with controlled host components/hooks.
// Verifies our prop/context wiring, NOT native keyboard animations or geometry.
import { afterEach, describe, expect, it, vi } from 'vitest';

async function setup() {
  vi.resetModules();
  let currentScope = 'main';
  let currentContext: unknown = { height: 0, measure: () => {} };
  const heights = new Map<string, number>();
  const platform = { OS: 'android' };
  vi.doMock('react', async () => {
    const real = await vi.importActual<typeof import('react')>('react');
    const controlled = {
      ...real,
      useState: (initial: number) => {
        const owner = currentScope;
        return [heights.get(owner) ?? initial, (value: number) => heights.set(owner, value)];
      },
      useMemo: (fn: () => unknown) => fn(),
      useContext: () => currentContext,
      forwardRef: (fn: unknown) => fn,
    };
    return { ...controlled, default: controlled };
  });
  vi.doMock('react-native', () => ({ Platform: platform, ScrollView: 'Scroll', View: 'View', StyleSheet: { create: (s: unknown) => s } }));
  vi.doMock('react-native-keyboard-controller', () => ({ KeyboardAwareScrollView: 'Aware', KeyboardStickyView: 'Sticky' }));
  const mod = await import('../components/forms/KeyboardForm');
  type Element = { type: unknown; props: Record<string, any> };
  const form = (scope: string, inset = 0) => {
    currentScope = scope;
    return mod.KeyboardForm({ testID: scope, footerBottomInset: inset }) as unknown as Element;
  };
  const enter = (element: Element) => { currentContext = element.props.value; };
  const scroll = mod.KeyboardFormScrollView as unknown as (props: Record<string, any>, ref?: unknown) => Element;
  const footer = mod.KeyboardFormFooter as unknown as (props: Record<string, any>) => Element;
  return { form, enter, scroll, footer, platform };
}

afterEach(() => {
  vi.doUnmock('react');
  vi.doUnmock('react-native');
  vi.doUnmock('react-native-keyboard-controller');
  vi.resetModules();
});

describe('KeyboardForm executed component contract', () => {
  it('measures and remeasures footer, adds the outside safe-area inset exactly once', async () => {
    const h = await setup();
    h.enter(h.form('screen', 20));
    const callback = vi.fn();
    const footer = h.footer({ testID: 'footer', onLayout: callback });
    const event = { nativeEvent: { layout: { height: 64 } } };
    footer.props.onLayout(event);
    expect(callback).toHaveBeenCalledExactlyOnceWith(event);
    h.enter(h.form('screen', 20));
    expect(h.scroll({ testID: 'scroll' }).props.bottomOffset).toBe(96);
    h.footer({ testID: 'footer' }).props.onLayout({ nativeEvent: { layout: { height: 90 } } });
    h.enter(h.form('screen', 10));
    expect(h.scroll({ testID: 'scroll' }).props.bottomOffset).toBe(112);
  });

  it('modal measurements cannot overwrite the parent form clearance', async () => {
    const h = await setup();
    h.enter(h.form('main'));
    h.footer({ testID: 'main-footer' }).props.onLayout({ nativeEvent: { layout: { height: 70 } } });
    h.enter(h.form('modal', 18));
    h.footer({ testID: 'modal-footer' }).props.onLayout({ nativeEvent: { layout: { height: 40 } } });
    h.enter(h.form('modal', 18));
    expect(h.scroll({ testID: 'modal-scroll' }).props.bottomOffset).toBe(70);
    h.enter(h.form('main'));
    expect(h.scroll({ testID: 'main-scroll' }).props.bottomOffset).toBe(82);
  });

  it('forwards scroll events/ref and forbids duplicate IME spacing or clipping', async () => {
    const h = await setup();
    const ref = { current: null };
    const onScroll = vi.fn();
    const node = h.scroll({ testID: 'scroll', onScroll, enabled: false, bottomOffset: 999,
      extraKeyboardSpace: 999, automaticallyAdjustKeyboardInsets: true, removeClippedSubviews: true }, ref);
    expect(node.type).toBe('Aware');
    expect(node.props).toMatchObject({ ref, onScroll, enabled: false, bottomOffset: 12,
      extraKeyboardSpace: 0, automaticallyAdjustKeyboardInsets: false, removeClippedSubviews: false,
      keyboardShouldPersistTaps: 'handled', contentInsetAdjustmentBehavior: 'never' });
  });

  it('keeps native drag-dismiss, but never blurs a web input on automatic focus scrolling', async () => {
    const h = await setup();
    for (const os of ['android', 'ios', 'web']) {
      h.platform.OS = os;
      expect(h.scroll({ testID: os }).props.keyboardDismissMode).toBe(os === 'web' ? 'none' : 'on-drag');
    }
  });

  it('footer only translates using StickyView and forwards disabled state, without KAV', async () => {
    const h = await setup();
    h.enter(h.form('screen'));
    const footer = h.footer({ testID: 'footer', enabled: false, children: 'commands' });
    expect(footer.type).toBe('Sticky');
    expect(footer.props).toMatchObject({ enabled: false, children: 'commands' });
    expect(footer.props.behavior).toBeUndefined();
  });
});