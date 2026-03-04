
export interface ColumnMapping {
  columnName: string;
  language: string;
  isImage?: boolean;
}

export interface CardConfig {
  frontColumns: ColumnMapping[];
  backColumns: ColumnMapping[];
  tagColumn: string;
  tag2Column?: string;
  frontPosition: 'center' | 'top' | 'bottom';
  backPosition: 'center' | 'top' | 'bottom';
  flipSpeed?: number;
}

export interface Flashcard {
  id: string;
  frontData: { text: string; lang: string; isImage?: boolean; columnName?: string }[];
  backData: { text: string; lang: string; isImage?: boolean; columnName?: string }[];
  tags: string[];
  tags2: string[];
  level: number;
}

export enum CardOrder {
  SEQUENTIAL = 'sequential',
  RANDOM = 'random'
}

export enum CardSide {
  FRONT_FIRST = 'front_first',
  BACK_FIRST = 'back_first',
  RANDOM = 'random'
}

export enum StudyMode {
  FRONT_FIRST = 'front_first',
  BACK_FIRST = 'back_first',
  RANDOM_ORDER = 'random_order',
  RANDOM_SIDE = 'random_side'
}
