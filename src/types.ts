import { jsPDF } from 'jspdf';
import type { Renderer } from './renderer/Renderer';

/**
 * CSS properties extracted from computed styles
 */
export interface ParsedCSS {
  'font-family': string;
  'font-style': string;
  'font-size': number; // Multiplier (e.g., 1.0 = default size)
  'line-height': number; // Multiplier
  'text-align': 'left' | 'right' | 'center' | 'justify';
  'display': 'block' | 'inline';
  'margin-top': number;
  'margin-bottom': number;
  'margin-left': number;
  'margin-right': number;
  'padding-top': number;
  'padding-bottom': number;
  'padding-left': number;
  'padding-right': number;
  'word-spacing': number; // PDF units (used for justify)
  width: number; // px (computed width; 0 if 'auto')
  height: number; // px (computed height; 0 if 'auto')
  'border-width': number; // px
  'border-color': string; // CSS color string
  'border-style': string; // e.g. 'none', 'solid'
  'background-color'?: string; // CSS color string (undefined or absent = transparent)
  'background-image': string; // CSS background-image value (e.g. 'none' or 'url(...)')
  'page-break-before': string;
  'float': 'none' | 'left' | 'right';
  'clear': 'none' | 'both';
  'color': string; // CSS color string
}

/**
 * Settings for HTML to PDF conversion
 */
export interface FromHTMLSettings {
  width?: number;
  elementHandlers?: ElementHandlers;
}

/**
 * Margins for PDF document
 */
export interface Margins {
  top: number;
  bottom: number;
  left?: number;
  right?: number;
}

/**
 * Custom font definition for embedding in PDF
 */
export interface FontDefinition {
  /** CSS font-family name to match (e.g., 'Roboto', 'Open Sans') */
  family: string;
  /** Base64-encoded .ttf font data */
  src: string;
  /** Font style variant. Default: 'normal' */
  style?: 'normal' | 'bold' | 'italic' | 'bolditalic';
}

/**
 * Element handlers for custom rendering
 */
export interface ElementHandlers {
  [key: string]: ElementHandler | ElementHandler[] | boolean | undefined;
  printHeaders?: boolean;
}

/**
 * Element handler function
 * Returns true if element was handled, false otherwise
 */
export type ElementHandler = (element: HTMLElement, renderer: Renderer) => boolean;

/**
 * Renderer state and settings
 */
export interface RendererSettings {
  width: number;
}

/**
 * Text fragment with style information
 */
export interface TextFragment {
  text: string;
  style: ParsedCSS;
}

/**
 * Line of text fragments
 */
export type TextLine = Array<[string, ParsedCSS]>;

/**
 * Paragraph data structure
 */
export interface Paragraph {
  text: string[];
  style: ParsedCSS[];
  blockstyle: ParsedCSS;
  priorblockstyle?: ParsedCSS;
}

/**
 * Watch function for handling floating elements
 */
export type WatchFunction = (element?: Node) => boolean;
