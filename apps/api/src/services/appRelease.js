const DEFAULT_PLAY_STORE =
  'https://play.google.com/store/apps/details?id=com.shappire.stickers';

export function getAppReleasePayload() {
  const latestVersion = (process.env.ANDROID_LATEST_VERSION ?? '0.2.2').trim();
  const minVersion = (process.env.ANDROID_MIN_VERSION ?? '0.2.0').trim();
  const playStoreUrl = (process.env.ANDROID_PLAY_STORE_URL ?? DEFAULT_PLAY_STORE).trim();
  const releaseNotes = process.env.APP_RELEASE_NOTES?.trim() || null;

  return {
    android: {
      latestVersion,
      minVersion,
      playStoreUrl,
      releaseNotes,
    },
  };
}
