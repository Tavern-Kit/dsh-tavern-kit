import React, { forwardRef } from 'react';
import * as Line from 'lucide-react';
import { PIXEL_PATHS as Pixel } from './PixelArtwork.js';
import { DetailArtwork, DETAIL_ICON_STYLES, type DetailIcon } from './DetailArtwork.js';
import type { LucideIcon, LucideProps } from 'lucide-react';

type PixelIcon = readonly string[];
/** The same semantic icon and accessible props; CSS chooses the current theme's local artwork. */
function themed(name: string, Vector: LucideIcon, Grid: PixelIcon, filledPath?: string, detail?: DetailIcon): LucideIcon {
  const Icon = forwardRef<SVGSVGElement, LucideProps>(function ThemeIcon({ size = 24, strokeWidth = 2, absoluteStrokeWidth, fill = 'none', className = '', ...props }, ref) {
    return <svg {...props} ref={ref} width={size} height={size} viewBox="0 0 24 24" fill="none" className={`tk-theme-icon ${className}`}>
      <g className="tk-icon-vector"><Vector size={24} strokeWidth={strokeWidth} absoluteStrokeWidth={absoluteStrokeWidth} fill={fill} aria-hidden="true" /></g>
      <g className="tk-icon-pixel" shapeRendering="crispEdges">{filledPath && fill !== 'none' ? <path d={filledPath} fill="currentColor" /> : Grid.map((d, index) => <path d={d} fill="currentColor" key={index} />)}{detail && <path className="tk-icon-pixel-flash" d="M20 3h2v2h-2zM22 6h2v2h-2z" />}</g>
      {detail && <DetailArtwork kind={detail} />}
    </svg>;
  });
  Icon.displayName = `Tavern${name}`;
  return Icon;
}

export const ArrowLeft = themed('ArrowLeft', Line.ArrowLeft, Pixel.ArrowLeft);
export const ArrowRight = themed('ArrowRight', Line.ArrowRight, Pixel.ArrowRight);
export const ArrowUp = themed('ArrowUp', Line.ArrowUp, Pixel.ArrowUp);
export const BookOpen = themed('BookOpen', Line.BookOpen, Pixel.BookOpen);
export const Courtyard = themed('Courtyard', Line.PanelsTopLeft, Pixel.BookOpen, undefined, 'courtyard');
export const ChevronLeft = themed('ChevronLeft', Line.ChevronLeft, Pixel.ChevronLeft);
export const ChevronRight = themed('ChevronRight', Line.ChevronRight, Pixel.ChevronRight);
export const Download = themed('Download', Line.Download, Pixel.Download);
export const FolderHeart = themed('FolderHeart', Line.FolderHeart, Pixel.Folder);
export const GitBranch = themed('GitBranch', Line.GitBranch, Pixel.GitBranch);
export const Heart = themed('Heart', Line.Heart, Pixel.Heart, 'M9 2H5v2H3v2H1v6h2v2h2v2h2v2h2v2h2v2h2v-2h2v-2h2v-2h2v-2h2v-2h2V6h-2V4h-2V2h-4v2h-2v2h-2V4H9V2z');
export const Import = themed('Import', Line.Import, Pixel.Download);
export const Layers2 = themed('Layers2', Line.Layers2, Pixel.CardStack);
export const LockKeyhole = themed('LockKeyhole', Line.LockKeyhole, Pixel.Lock);
export const Menu = themed('Menu', Line.Menu, Pixel.Menu);
export const MoreHorizontal = themed('MoreHorizontal', Line.MoreHorizontal, Pixel.MoreHorizontal);
export const NotebookPen = themed('NotebookPen', Line.NotebookPen, Pixel.Notes, undefined, 'memo');
export const Palette = themed('Palette', Line.Palette, Pixel.PaintBucket);
export const PenLine = themed('PenLine', Line.PenLine, Pixel.Edit);
export const Plus = themed('Plus', Line.Plus, Pixel.Plus);
export const RefreshCw = themed('RefreshCw', Line.RefreshCw, Pixel.Reload);
export const RotateCcw = themed('RotateCcw', Line.RotateCcw, Pixel.Reload);
export const Search = themed('Search', Line.Search, Pixel.Search, undefined, 'search');
export const Settings2 = themed('Settings2', Line.Settings2, Pixel.Sliders, undefined, 'settings');
export const Square = themed('Square', Line.Square, Pixel.Stop);
export const X = themed('X', Line.X, Pixel.Close);

export const THEME_ICON_STYLES = `
.tk-theme-icon{display:inline-block;flex:none;vertical-align:middle}
.tk-theme-icon>.tk-icon-pixel{display:none}
:root[data-tk-skin=pixel] .tk-rp .tk-theme-icon>.tk-icon-vector{display:none}
:root[data-tk-skin=pixel] .tk-rp .tk-theme-icon>.tk-icon-pixel{display:inline}
` + DETAIL_ICON_STYLES;
