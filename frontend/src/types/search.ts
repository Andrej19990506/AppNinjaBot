import { InventoryItem } from './inventory';

export interface SearchMatch {
  field: string;
  value: string;
}

export interface SearchResult {
  category: string;
  itemId: string;
  item: InventoryItem;
  matches: SearchMatch[];
} 