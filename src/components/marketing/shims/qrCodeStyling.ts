import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QRCodeCanvas } from 'qrcode.react';

export interface QRCodeStylingOptions {
  width?: number;
  height?: number;
  type?: 'canvas' | 'svg';
  data?: string;
  image?: string;
  margin?: number;
  qrOptions?: {
    typeNumber?: number;
    mode?: string;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  };
  imageOptions?: {
    hideBackgroundDots?: boolean;
    imageSize?: number;
    margin?: number;
    crossOrigin?: string;
  };
  dotsOptions?: {
    color?: string;
    type?: string;
    gradient?: {
      type?: string;
      rotation?: number;
      colorStops?: Array<{ offset: number; color: string }>;
    };
  };
  backgroundOptions?: {
    color?: string;
    gradient?: any;
  };
  cornersSquareOptions?: {
    color?: string;
    type?: string;
    gradient?: any;
  };
  cornersDotOptions?: {
    color?: string;
    type?: string;
    gradient?: any;
  };
}

export default class QRCodeStyling {
  private options: QRCodeStylingOptions;
  private container: HTMLElement | null = null;
  private root: Root | null = null;

  constructor(options: QRCodeStylingOptions = {}) {
    this.options = options;
  }

  append(container?: HTMLElement | null): void {
    if (!container) return;
    this.container = container;
    this.render();
  }

  update(options: Partial<QRCodeStylingOptions>): void {
    this.options = {
      ...this.options,
      ...options,
      dotsOptions: { ...this.options.dotsOptions, ...options.dotsOptions },
      backgroundOptions: { ...this.options.backgroundOptions, ...options.backgroundOptions },
      imageOptions: { ...this.options.imageOptions, ...options.imageOptions },
      qrOptions: { ...this.options.qrOptions, ...options.qrOptions },
    };
    this.render();
  }

  private render(): void {
    if (!this.container) return;
    if (!this.root) {
      this.container.innerHTML = '';
      const mountNode = document.createElement('div');
      mountNode.style.display = 'inline-flex';
      mountNode.style.alignItems = 'center';
      mountNode.style.justifyContent = 'center';
      this.container.appendChild(mountNode);
      this.root = createRoot(mountNode);
    }

    const size = this.options.width || 240;
    const fgColor =
      this.options.dotsOptions?.gradient?.colorStops?.[0]?.color ||
      this.options.dotsOptions?.color ||
      '#0f172a';
    const bgColor = this.options.backgroundOptions?.color || '#ffffff';
    const level = this.options.qrOptions?.errorCorrectionLevel || 'H';
    const image = this.options.image;
    const imageRatio = this.options.imageOptions?.imageSize || 0.22;
    const imgSize = Math.round(size * imageRatio);

    this.root.render(
      React.createElement(QRCodeCanvas, {
        value: this.options.data || 'https://myerp.vn',
        size,
        bgColor,
        fgColor,
        level,
        marginSize: this.options.margin ? Math.max(1, Math.round(this.options.margin / 4)) : 2,
        imageSettings: image
          ? {
              src: image,
              height: imgSize,
              width: imgSize,
              excavate: this.options.imageOptions?.hideBackgroundDots !== false,
            }
          : undefined,
      })
    );
  }

  async download(downloadOptions?: { name?: string; extension?: 'png' | 'jpeg' | 'webp' | 'svg' }): Promise<void> {
    const name = downloadOptions?.name || 'qr-code';
    const ext = downloadOptions?.extension || 'png';
    const canvas = this.container?.querySelector('canvas');
    if (canvas) {
      const mime = ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
      const dataUrl = canvas.toDataURL(mime);
      const link = document.createElement('a');
      link.download = `${name}.${ext}`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}

export type DrawType = 'canvas' | 'svg';
export type TypeNumber = number;
export type Mode = 'Numeric' | 'Alphanumeric' | 'Byte' | 'Kanji';
export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
export type DotType = string;
export type CornerSquareType = string;
export type CornerDotType = string;
export type Options = QRCodeStylingOptions;
export const DrawType: any = undefined;
export const TypeNumber: any = undefined;
export const Mode: any = undefined;
export const ErrorCorrectionLevel: any = undefined;
export const DotType: any = undefined;
export const CornerSquareType: any = undefined;
export const CornerDotType: any = undefined;
export const Options: any = undefined;
