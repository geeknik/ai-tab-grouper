// Mock chrome API
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    group: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
    },
    onRemoved: {
      addListener: jest.fn(),
    },
  },
  tabGroups: {
    update: jest.fn(),
  },
  alarms: {
    clear: jest.fn(),
    create: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    getURL: jest.fn(),
  },
};

// Mock console.error
global.console.error = jest.fn();

// Import functions to test
import {
  cosineSimilarity,
  jaccardSimilarity,
  generateGroupName,
  extractKeyphrases,
  groupTabs,
  isGroupableTab,
  loadSettings,
  settings
} from './background.js';

// Mock the QCO module
jest.mock('./src/quantumChaosOrganizer.js', () => ({
  groupTabsQuantumChaosOrganizer: jest.fn()
}));

// Import the mocked module
import { groupTabsQuantumChaosOrganizer } from './src/quantumChaosOrganizer.js';

// Mock chrome API and global settings
beforeAll(() => {
  global.settings = {
    groupingAlgorithm: 'qco',
    similarityThreshold: 0.5,
    maxGroupNameLength: 50,
    groupingInterval: 5,
  };
});

describe('Tab Grouping Extension', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset settings before each test
    global.settings = {
      groupingAlgorithm: 'qco',
      similarityThreshold: 0.5,
      maxGroupNameLength: 50,
      groupingInterval: 5,
    };
  });

  describe('cosineSimilarity', () => {
    test('calculates cosine similarity correctly', () => {
      const doc1 = { term1: 1, term2: 2 };
      const doc2 = { term1: 2, term2: 1 };
      expect(cosineSimilarity(doc1, doc2)).toBeCloseTo(0.8, 2);
    });

    test('returns 0 for orthogonal vectors', () => {
      const doc1 = { term1: 1 };
      const doc2 = { term2: 1 };
      expect(cosineSimilarity(doc1, doc2)).toBe(0);
    });

    test('returns 1 for identical vectors', () => {
      const doc1 = { term1: 1, term2: 2 };
      const doc2 = { term1: 1, term2: 2 };
      expect(cosineSimilarity(doc1, doc2)).toBeCloseTo(1, 10);
    });
  });

  describe('jaccardSimilarity', () => {
    test('calculates Jaccard similarity correctly', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['b', 'c', 'd']);
      expect(jaccardSimilarity(set1, set2)).toBe(0.5);
    });

    test('returns 1 for identical sets', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['a', 'b', 'c']);
      expect(jaccardSimilarity(set1, set2)).toBe(1);
    });

    test('returns 0 for disjoint sets', () => {
      const set1 = new Set(['a', 'b']);
      const set2 = new Set(['c', 'd']);
      expect(jaccardSimilarity(set1, set2)).toBe(0);
    });
  });

  describe('generateGroupName', () => {
    beforeEach(() => {
      // Reset settings before each test
      global.settings = {
        maxGroupNameLength: 50
      };
    });

    test('generates a group name based on common terms', () => {
      const docs = [
        'https://example.com/page1 Example Website',
        'https://example.com/page2 Another Example'
      ];
      const name = generateGroupName(docs);
      expect(name.toLowerCase()).toContain('example');
    });

    test('respects maxGroupNameLength setting', () => {
      const docs = [
        'https://verylongdomainname.com/page1 Very Long Title That Should Be Truncated',
        'https://verylongdomainname.com/page2 Another Very Long Title'
      ];
      console.log('Before test - settings:', global.settings);
      global.settings = { maxGroupNameLength: 10 };
      console.log('After setting - settings:', global.settings);
      const name = generateGroupName(docs);
      console.log('Generated name:', name, 'length:', name.length);
      expect(name.length).toBeLessThanOrEqual(10);
    });
  });

  describe('extractKeyphrases', () => {
    test('extracts keyphrases from text', () => {
      const text = 'artificial intelligence machine learning deep neural networks';
      const phrases = extractKeyphrases(text);
      expect(phrases).toContain('artificial intelligence');
    });

    test('respects the number of phrases parameter', () => {
      const text = 'artificial intelligence machine learning deep neural networks data science';
      const phrases = extractKeyphrases(text, 2);
      expect(phrases.length).toBeLessThanOrEqual(2);
    });
  });

  describe('groupTabs - QCO algorithm respects pinned tabs', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Mock chrome.tabs.query to return test data
      chrome.tabs.query.mockResolvedValue([]);
      // Mock chrome.tabs.group to return a group ID
      chrome.tabs.group.mockResolvedValue(1);
      // Mock chrome.tabGroups.update to resolve successfully
      chrome.tabGroups.update.mockResolvedValue({});
      // Mock chrome.storage.sync.get to return QCO settings
      chrome.storage.sync.get.mockImplementation(defaults => 
        Promise.resolve({
          ...defaults,
          groupingAlgorithm: 'qco',
          maxGroupNameLength: 50
        })
      );
    });

    test('should not include pinned tabs when grouping with QCO', async () => {
      // Set up test data
      const tabs = [
        { id: 1, pinned: true, url: 'https://example1.com', title: 'Example 1' },
        { id: 2, pinned: false, url: 'https://example2.com', title: 'Example 2' },
        { id: 3, pinned: false, url: 'https://example3.com', title: 'Example 3' }
      ];
      
      // Set up mocks
      chrome.tabs.query.mockResolvedValue(tabs);
      
      // Set up QCO mock
      const nonPinnedTabs = tabs.filter(tab => !tab.pinned);
      groupTabsQuantumChaosOrganizer.mockReturnValue([nonPinnedTabs]);

      // Load settings and execute groupTabs
      await loadSettings();
      await groupTabs();

      // Verify QCO was called correctly
      expect(groupTabsQuantumChaosOrganizer).toHaveBeenCalledTimes(1);
      expect(groupTabsQuantumChaosOrganizer).toHaveBeenCalledWith(
        expect.arrayContaining(nonPinnedTabs)
      );
      
      // Verify tabs were grouped correctly
      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [2, 3]
      });
    });

    test('handles empty tab list gracefully', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      await groupTabs();
      expect(groupTabsQuantumChaosOrganizer).not.toHaveBeenCalled();
      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });

    test('handles all pinned tabs gracefully', async () => {
      const allPinnedTabs = [
        { id: 1, pinned: true, url: 'https://example1.com', title: 'Example 1' },
        { id: 2, pinned: true, url: 'https://example2.com', title: 'Example 2' }
      ];
      chrome.tabs.query.mockResolvedValue(allPinnedTabs);
      
      await groupTabs();
      
      expect(groupTabsQuantumChaosOrganizer).not.toHaveBeenCalled();
      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });

    test('handles errors in QCO gracefully', async () => {
      // Set up test data
      const tabs = [
        { id: 1, pinned: false, url: 'https://example.com', title: 'Example' }
      ];
      
      // Set up mocks
      chrome.tabs.query.mockResolvedValue(tabs);
      
      // Mock QCO to throw an error
      const testError = new Error('QCO processing error');
      groupTabsQuantumChaosOrganizer.mockImplementation(() => {
        throw testError;
      });

      // Mock console.error specifically for this test
      const originalConsoleError = console.error;
      console.error = jest.fn();

      try {
        // Load settings and execute groupTabs
        await loadSettings();
        await groupTabs();
        
        // Verify error handling
        expect(chrome.tabs.group).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(
          'Error in groupTabs: QCO algorithm failed',
          testError
        );
        
        // Verify no other errors were logged
        expect(console.error).toHaveBeenCalledTimes(1);
      } finally {
        // Restore console.error
        console.error = originalConsoleError;
      }
    });
  });
});
