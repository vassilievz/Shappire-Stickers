export type CropAspectRatio = '1:1' | 'free' | 'circle' | '3:4' | '4:3';
export type StudioTab = 'frame' | 'magic' | 'lasso';

export interface ImageCropResult {
  dataUrl: string;
  width: number;
  height: number;
}
