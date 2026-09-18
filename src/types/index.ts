export type Orientation = 'portrait' | 'landscape';

export type FrameMaterialType = 'wood' | 'metal' | 'mdf';

export type FrameType = 'framed' | 'object';

export type GlassType = 'clear' | 'antiglare' | 'matte' | 'none';

export interface MattingConfig {
  enabled: boolean;
  widthCm: number;
  colorHex: string;
  asymmetric?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export interface FrameMaterial {
  type: FrameMaterialType;
  colorHex: string;
  profileWidthCm: number;
  depthCm: number;
}

export interface GlassConfig {
  type: GlassType;
}

export interface ArtworkConfig {
  imageUrl?: string;
  cornerPoints?: [Point, Point, Point, Point];
  warpedTextureUrl?: string;
  rotationDeg?: 0 | 90 | 180 | 270;
}

export interface Point {
  x: number;
  y: number;
}

export interface FixingPosition {
  frameOffset: Point;
  wallOffset: Point;
}

export interface FixingsConfig {
  type: 'velcro';
  count: number;
  positions: FixingPosition[];
}

export interface Frame {
  id: string;
  xCm: number;
  yCm: number;
  widthCm: number;
  heightCm: number;
  orientation: Orientation;
  frameType: FrameType;
  material: FrameMaterial;
  glass: GlassConfig;
  matting: MattingConfig;
  artwork: ArtworkConfig;
  fixings: FixingsConfig;
}

export interface WallConfig {
  widthCm: number;
  heightCm: number;
  colorHex: string;
  textureUrl?: string;
}

export interface GridConfig {
  cellSizeCm: number;
  snapEnabled: boolean;
  showGuides: boolean;
}
