import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request in unit test'); })));
afterEach(() => vi.unstubAllGlobals());

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void };
const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

function createHookHarness() {
  let mounted = true;
  let stateIdx = 0;
  let refIdx = 0;
  let effectIdx = 0;
  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const effects: { deps?: unknown[]; cleanup?: (() => void) | void }[] = [];
  let afterUnmountStateUpdates = 0;

  const reactModule = {
    useState<T>(initial: T): [T, (value: T | ((prev: T) => T)) => void] {
      const idx = stateIdx++;
      if (!(idx in states)) states[idx] = initial;
      const setState = (value: T | ((prev: T) => T)) => {
        if (!mounted) {
          afterUnmountStateUpdates += 1;
          return;
        }
        const prev = states[idx] as T;
        states[idx] = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
      };
      return [states[idx] as T, setState];
    },
    useRef<T>(initial: T): { current: T } {
      const idx = refIdx++;
      if (!refs[idx]) refs[idx] = { current: initial };
      return refs[idx] as { current: T };
    },
    useEffect(fn: () => void | (() => void), deps?: unknown[]) {
      const idx = effectIdx++;
      const prev = effects[idx];
      const changed =
        !prev ||
        !deps ||
        !prev.deps ||
        deps.length !== prev.deps.length ||
        deps.some((d, i) => !Object.is(d, prev.deps![i]));
      if (changed) {
        if (prev?.cleanup) prev.cleanup();
        const cleanup = fn();
        effects[idx] = { deps, cleanup };
      }
    },
  };

  const render = <T,>(factory: () => T): T => {
    stateIdx = 0;
    refIdx = 0;
    effectIdx = 0;
    return factory();
  };

  const unmount = () => {
    mounted = false;
    for (const effect of effects) if (effect?.cleanup) effect.cleanup();
  };

  return { reactModule, render, unmount, get_after_unmount_updates: () => afterUnmountStateUpdates };
}

async function setupVoiceHook(options?: {
  platform?: 'android' | 'ios' | 'web';
  permission?: () => Promise<{ granted: boolean }>;
  setAudioMode?: (mode: { allowsRecording: boolean; playsInSilentMode?: boolean }) => Promise<void>;
  prepare?: () => Promise<void>;
  stop?: () => Promise<void>;
  uri?: string | null;
  cleanupSpy?: ReturnType<typeof vi.fn>;
}) {
  vi.resetModules();
  vi.doUnmock('../lib/aitour/gptour-voice-lifecycle');
  const harness = createHookHarness();
  const prepare = options?.prepare ?? (async () => undefined);
  const stop = options?.stop ?? (async () => undefined);
  const permission = options?.permission ?? (async () => ({ granted: true }));
  const setAudioMode = options?.setAudioMode ?? (async () => undefined);
  const recorder = {
    prepareToRecordAsync: vi.fn(prepare),
    record: vi.fn(() => undefined),
    stop: vi.fn(stop),
    get uri() {
      return options?.uri ?? 'file://voice.m4a';
    },
  };

  vi.doMock('react', () => harness.reactModule);
  vi.doMock('react-native', () => ({ Platform: { OS: options?.platform ?? 'android' } }));
  vi.doMock('expo-constants', () => ({ default: { expoConfig: { extra: { backendUrl: 'https://fixture.local' } } } }));
  vi.doMock('expo-audio', () => ({
    RecordingPresets: { HIGH_QUALITY: 'HQ' },
    useAudioRecorder: vi.fn(() => recorder),
    requestRecordingPermissionsAsync: vi.fn(permission),
    setAudioModeAsync: vi.fn(setAudioMode),
  }));
  if (options?.cleanupSpy) {
    vi.doMock('../lib/aitour/gptour-voice-lifecycle', () => ({ cleanupGptourAudio: options.cleanupSpy }));
  }

  const onText = vi.fn();
  const pool = [{ city: 'Milano', projectName: 'P1', name: 'Cliente A' }] as never;
  const { useGptourVoice } = await import('../hooks/useGptourVoice');
  const render = () => harness.render(() => useGptourVoice(pool, onText));
  const api = render();
  const expoAudio = await import('expo-audio');

  return {
    api,
    rerender: render,
    unmount: harness.unmount,
    recorder,
    onText,
    setAudioModeAsync: vi.mocked(expoAudio.setAudioModeAsync),
    requestRecordingPermissionsAsync: vi.mocked(expoAudio.requestRecordingPermissionsAsync),
    get_after_unmount_updates: harness.get_after_unmount_updates,
  };
}

describe('useGptourVoice lifecycle regression', () => {
  it('deferred permission resolving after unmount never prepares/records or enables mode', async () => {
    const permissionDef = deferred<{ granted: boolean }>();
    const env = await setupVoiceHook({ permission: () => permissionDef.promise });
    const run = env.api.toggle();
    env.unmount();
    permissionDef.resolve({ granted: true });
    await run;

    expect(env.recorder.prepareToRecordAsync).not.toHaveBeenCalled();
    expect(env.recorder.record).not.toHaveBeenCalled();
    expect(env.setAudioModeAsync).not.toHaveBeenCalledWith(expect.objectContaining({ allowsRecording: true }));
  });

  it('deferred setAudioMode completion after unmount never touches prepare/record', async () => {
    const modeDef = deferred<void>();
    const env = await setupVoiceHook({
      setAudioMode: async (mode) => {
        if (mode.allowsRecording) return modeDef.promise;
      },
    });
    const run = env.api.toggle();
    await vi.waitFor(() => expect(env.setAudioModeAsync).toHaveBeenCalledWith({ allowsRecording: true, playsInSilentMode: true }));
    env.unmount();
    modeDef.resolve(undefined);
    await run;

    expect(env.recorder.prepareToRecordAsync).not.toHaveBeenCalled();
    expect(env.recorder.record).not.toHaveBeenCalled();
    expect(env.setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
    expect(env.get_after_unmount_updates()).toBe(0);
  });

  it('deferred prepare completion after unmount never starts record', async () => {
    const prepareDef = deferred<void>();
    const env = await setupVoiceHook({ prepare: () => prepareDef.promise });
    const run = env.api.toggle();
    await vi.waitFor(() => expect(env.recorder.prepareToRecordAsync).toHaveBeenCalledTimes(1));
    env.unmount();
    prepareDef.resolve(undefined);
    await run;

    expect(env.recorder.record).not.toHaveBeenCalled();
    expect(env.get_after_unmount_updates()).toBe(0);
  });

  it('stop completion after unmount never reads uri or uploads audio', async () => {
    const stopDef = deferred<void>();
    let uriReads = 0;
    const env = await setupVoiceHook({ stop: () => stopDef.promise });
    Object.defineProperty(env.recorder, 'uri', {
      configurable: true,
      get() {
        uriReads += 1;
        return 'file://voice.m4a';
      },
    });
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ text: 'ok' }) }));
    vi.stubGlobal('fetch', fetchSpy);

    await env.api.toggle();
    const stopRun = env.rerender().toggle();
    expect(env.recorder.stop).toHaveBeenCalledTimes(1);
    env.unmount();
    stopDef.resolve(undefined);
    await stopRun;

    expect(uriReads).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('pending transcription aborts after unmount: no onText and no state updates after unmount', async () => {
    const env = await setupVoiceHook();
    const fetchSpy = vi.fn(async (_url: string, init?: { signal?: AbortSignal }) => {
      return await new Promise<never>((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
          reject(abort);
        });
      });
    });
    vi.stubGlobal('fetch', fetchSpy);

    await env.api.toggle();
    const stopRun = env.rerender().toggle();
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const signal = fetchSpy.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    env.unmount();
    await stopRun;

    expect(signal?.aborted).toBe(true);
    expect(env.onText).not.toHaveBeenCalled();
    expect(env.get_after_unmount_updates()).toBe(0);
  });

  it('cleanup is not triggered by recording state changes, only on unmount', async () => {
    const cleanupSpy = vi.fn(async () => undefined);
    const env = await setupVoiceHook({ cleanupSpy });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ text: 'ciao' }) })));

    await env.api.toggle();
    await env.rerender().toggle();
    expect(cleanupSpy).toHaveBeenCalledTimes(0);
    env.unmount();
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it('repeat mount/unmount still allows normal start/stop/transcription', async () => {
    const first = await setupVoiceHook();
    first.unmount();

    const second = await setupVoiceHook();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ text: '  Dettato valido  ' }) })));
    await second.api.toggle();
    await second.rerender().toggle();
    expect(second.onText).toHaveBeenCalledWith('Dettato valido');
    second.unmount();
  });
});
