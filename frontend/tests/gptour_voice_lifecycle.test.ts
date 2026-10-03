import { describe, expect, it, vi } from 'vitest';
import { cleanupGptourAudio } from '../lib/aitour/gptour-voice-lifecycle';

describe('cleanupGptourAudio regression guard', () => {
  // Negative control: this models pre-fix behavior from 40e5283c
  // where native getters could be touched after SharedObject release.
  function originalCleanupLike40e5283c(
    recorder: { readonly isRecording: boolean; stop: () => Promise<void> },
    resetAudioMode: () => Promise<void>
  ) {
    // Original synchronous effect cleanup: .catch only guards the stop promise.
    if (recorder.isRecording) void recorder.stop().catch(() => undefined);
    void resetAudioMode().catch(() => undefined);
  }

  it('negative control: legacy cleanup throws on disposed native getter', async () => {
    const recorder = {
      get isRecording(): boolean {
        throw new Error('SharedObjectreleased');
      },
      stop: vi.fn(async () => undefined),
    };
    expect(() => originalCleanupLike40e5283c(recorder, async () => undefined)).toThrow('SharedObjectreleased');
  });

  it.each(['android', 'ios'])('native (%s): never touches disposed recorder and always resolves', async () => {
    let getterReads = 0;
    const recorder = {
      get isRecording(): boolean {
        getterReads += 1;
        throw new Error('SharedObjectreleased');
      },
      stop: vi.fn(async () => {
        throw new Error('SharedObjectreleased');
      }),
    };
    const resetAudioMode = vi.fn(async () => undefined);
    await expect(cleanupGptourAudio(recorder as unknown as { readonly isRecording: boolean; stop: () => Promise<void> }, false, resetAudioMode)).resolves.toBeUndefined();
    expect(getterReads).toBe(0);
    expect(recorder.stop).not.toHaveBeenCalled();
    expect(resetAudioMode).toHaveBeenCalledTimes(1);
  });

  it('web: stops active recording then resets mode', async () => {
    const recorder = {
      isRecording: true,
      stop: vi.fn(async () => undefined),
    };
    const resetAudioMode = vi.fn(async () => undefined);
    await expect(cleanupGptourAudio(recorder, true, resetAudioMode)).resolves.toBeUndefined();
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(resetAudioMode).toHaveBeenCalledTimes(1);
  });

  it('web: getter throw, stop throw, reset throw or reject are all swallowed', async () => {
    const getterThrows = {
      get isRecording(): boolean {
        throw new Error('SharedObjectreleased');
      },
      stop: vi.fn(async () => undefined),
    };
    await expect(cleanupGptourAudio(getterThrows, true, () => {
      throw new Error('reset-sync');
    })).resolves.toBeUndefined();

    const stopRejects = {
      isRecording: true,
      stop: vi.fn(async () => {
        throw new Error('stop-reject');
      }),
    };
    await expect(cleanupGptourAudio(stopRejects, true, async () => Promise.reject(new Error('reset-reject')))).resolves.toBeUndefined();
    expect(stopRejects.stop).toHaveBeenCalledTimes(1);
    const stopThrows = { isRecording: true, stop: () => { throw new Error('stop-sync'); } };
    const reset = vi.fn(async () => undefined);
    await expect(cleanupGptourAudio(stopThrows, true, reset)).resolves.toBeUndefined();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
