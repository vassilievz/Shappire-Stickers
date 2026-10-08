export type DownloadMode = 'auto' | 'audio' | 'mute';

export interface DownloadPickerItem {
  type: 'photo' | 'video' | string;
  url: string;
  thumb?: string;
}

export interface DownloadSuccessResult {
  status: 'redirect' | 'tunnel' | 'picker';
  downloadId?: string;
  url?: string;
  filename?: string;
  picker?: DownloadPickerItem[];
  audio?: string;
  audioFilename?: string;
}

export interface DownloadErrorResult {
  status: 'error';
  error: {
    code: string;
    context?: unknown;
  };
}

export type DownloadApiResponse = DownloadSuccessResult | DownloadErrorResult;

export interface RequestDownloadOptions {
  url: string;
  downloadMode?: DownloadMode;
  videoQuality?: 'max' | '1080' | '720' | '480' | '360';
  audioFormat?: 'best' | 'mp3' | 'wav' | 'flac' | 'ogg' | 'opus';
  audioBitrate?: '320' | '256' | '192' | '128' | '96' | '64';
  filenameStyle?: 'basic' | 'classic' | 'pretty' | 'nerdy';
  convertGif?: boolean;
  disableMetadata?: boolean;
  tiktokFullAudio?: boolean;
  alwaysProxy?: boolean;
}
