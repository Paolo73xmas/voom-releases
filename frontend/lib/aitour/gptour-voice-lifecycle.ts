type RecorderCleanup = { readonly isRecording: boolean; stop: () => Promise<void> };

/** Expo owns the native recorder: its SharedObject can already be released on unmount. */
export async function cleanupGptourAudio(recorder: RecorderCleanup, web: boolean, resetAudioMode: () => Promise<void>) {
  try {
    // The web MediaRecorder needs an explicit stop to close its microphone tracks.
    // Never read native properties or call methods after Expo's automatic release.
    if (web && recorder.isRecording) await recorder.stop();
  } catch { /* Cleanup must also tolerate an already disposed web recorder. */ }
  try { await resetAudioMode(); } catch { /* Audio session may already be closed. */ }
}