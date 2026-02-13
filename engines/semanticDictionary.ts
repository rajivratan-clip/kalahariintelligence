/**
 * Semantic Dictionary Store
 * Caches semantic mappings (raw event names -> business-friendly labels) client-side.
 * Syncs with backend on schema load, falls back to raw event names if mapping unavailable.
 */

import { create } from 'zustand';

export interface SemanticMapping {
  business_label: string;
  confidence: 'high' | 'medium' | 'low';
  category: string;
}

interface SemanticDictionaryState {
  /** Cache of event_type -> semantic mapping */
  mappings: Record<string, SemanticMapping>;
  
  /** Last sync timestamp */
  lastSyncTimestamp: string | null;
  
  /** Set a mapping for an event type */
  setMapping: (eventType: string, mapping: SemanticMapping) => void;
  
  /** Batch set mappings */
  setMappings: (mappings: Record<string, SemanticMapping>) => void;
  
  /** Get mapping for an event type (returns fallback if not found) */
  getMapping: (eventType: string) => SemanticMapping;
  
  /** Clear all mappings */
  clear: () => void;
  
  /** Sync mappings from backend */
  syncFromBackend: () => Promise<void>;
}

const fallbackMapping = (eventType: string): SemanticMapping => ({
  business_label: eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
  confidence: 'low',
  category: 'unknown',
});

export const useSemanticDictionary = create<SemanticDictionaryState>((set, get) => ({
  mappings: {},
  lastSyncTimestamp: null,

  setMapping: (eventType, mapping) => {
    set((state) => ({
      mappings: {
        ...state.mappings,
        [eventType]: mapping,
      },
    }));
  },

  setMappings: (mappings) => {
    set((state) => ({
      mappings: {
        ...state.mappings,
        ...mappings,
      },
    }));
  },

  getMapping: (eventType) => {
    const { mappings } = get();
    return mappings[eventType] || fallbackMapping(eventType);
  },

  clear: () => {
    set({
      mappings: {},
      lastSyncTimestamp: null,
    });
  },

  syncFromBackend: async () => {
    try {
      // Fetch detailed schema which includes semantic mappings
      const response = await fetch('http://localhost:8000/api/metadata/schema/detailed');
      if (!response.ok) {
        console.warn('Failed to sync semantic dictionary from backend');
        return;
      }

      const data = await response.json();
      
      // If backend provides semantic mappings in the response, use them
      // For now, we'll generate mappings client-side from event_frequency data
      if (data.event_frequency && Array.isArray(data.event_frequency)) {
        const newMappings: Record<string, SemanticMapping> = {};
        
        // Generate basic mappings from event types
        data.event_frequency.forEach((item: any) => {
          const eventType = item.event_type;
          if (eventType && !get().mappings[eventType]) {
            // Use rule-based mapping as fallback until backend provides semantic mappings
            newMappings[eventType] = fallbackMapping(eventType);
          }
        });
        
        if (Object.keys(newMappings).length > 0) {
          get().setMappings(newMappings);
        }
      }

      set({ lastSyncTimestamp: data.last_scan_timestamp || new Date().toISOString() });
    } catch (error) {
      console.error('Error syncing semantic dictionary:', error);
    }
  },
}));
