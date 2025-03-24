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
  extractPageTypes,
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
    
    test('combines domain and top term when both are available', () => {
      const docs = [
        'https://github.com/user/repo JavaScript Project Repository',
        'https://github.com/user/another-repo Another JavaScript Project'
      ];
      const name = generateGroupName(docs);
      expect(name).toBe('Github: javascript');
    });
    
    test('uses page type and top term when domain varies', () => {
      const docs = [
        'https://site1.com/tutorials/js Learn JavaScript Tutorial',
        'https://site2.com/learn/javascript Complete JavaScript Course'
      ];
      const name = generateGroupName(docs);
      expect(name).toBe('Learning: javascript');
    });
    
    test('combines multiple top terms when no common domain or page type', () => {
      const docs = [
        'https://site1.com/page1 React Framework Overview',
        'https://site2.com/page2 Using React Components'
      ];
      const name = generateGroupName(docs);
      expect(name).toBe('react & components');
    });
    
    test('handles empty input gracefully', () => {
      expect(generateGroupName([])).toBe('Group');
      expect(generateGroupName(null)).toBe('Group');
      expect(generateGroupName(undefined)).toBe('Group');
    });
    
    test('filters out stop words from group names', () => {
      const docs = [
        'https://site.com/page The and of with JavaScript',
        'https://site.com/other The and of with Programming'
      ];
      const name = generateGroupName(docs);
      // Should not contain stop words like "the", "and", "of", "with"
      expect(name.toLowerCase()).not.toMatch(/\b(the|and|of|with)\b/);
      // Should contain meaningful terms
      expect(name.toLowerCase()).toMatch(/\b(javascript|programming)\b/);
    });
  });

  describe('extractPageTypes', () => {
    test('identifies news content', () => {
      const docs = [
        'https://news.com/article Latest News Article',
        'https://blog.com/post Blog Post About Current Events'
      ];
      const types = extractPageTypes(docs);
      expect(types).toContain('News');
    });
    
    test('identifies shopping content', () => {
      const docs = [
        'https://shop.com/product Buy This Product',
        'https://store.com/item Best Price for Item'
      ];
      const types = extractPageTypes(docs);
      expect(types).toContain('Shopping');
    });
    
    test('identifies multiple content types with correct frequency order', () => {
      const docs = [
        'https://site.com/video Watch This Video',
        'https://site.com/tutorial Learn From This Tutorial',
        'https://site.com/another-video Another Video To Watch',
        'https://site.com/article News Article'
      ];
      const types = extractPageTypes(docs);
      // Video appears twice, so it should be first
      expect(types[0]).toBe('Video');
      expect(types).toContain('Learning');
      expect(types).toContain('News');
    });
    
    test('returns empty array when no recognized types', () => {
      const docs = [
        'https://site.com/page Generic Page With No Type',
        'https://site.com/other Another Generic Page'
      ];
      const types = extractPageTypes(docs);
      expect(types).toEqual([]);
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

describe('Clustering Filter Tests', () => {
  const { clusterTabs } = require('./background.js');
  
  // Helper cosine similarity: simple function that returns 1 if same, 0 otherwise
  function simpleCosine(doc1, doc2) {
    // Assume all vectors equal for testing
    return 1;
  }
  
  // Override cosineSimilarity in our test scope if needed
  // For testing, we assume our clusterTabs uses cosineSimilarity for non-keyphrase algorithms.
  
  test('clusterTabs filters out clusters with less than 3 tabs', () => {
    // Create a simulated tabVectors object.
    // Let's assume each tab vector is identical so cosine similarity always 1 > threshold
    // Create 5 tabs, but arrange manually so that one cluster ends up being of size 2
    const tabVectors = {
      '1': { a: 1 },
      '2': { a: 1 },
      '3': { a: 1 },
      '4': { a: 0 }, // This one will be isolated if similarity is 0
      '5': { a: 0 }  // Similar to 4 so cluster of size 2
    };
    // To simulate isolation for tabs 4 and 5, we override cosineSimilarity to return 0 when one of them is compared with any tab having value 1
    const originalCosine = global.cosineSimilarity;
    global.cosineSimilarity = (vec1, vec2) => {
      if ((vec1.a === 1 && vec2.a === 1) || (vec1.a === 0 && vec2.a === 0)) {
        return 1;
      }
      return 0;
    };
    
    // Set similarityThreshold to 0.5 in settings
    global.settings = { similarityThreshold: 0.5 };
    
    const clusters = clusterTabs(tabVectors);
    
    // Expected: Only the cluster with tabs '1','2','3' should be returned, group with tabs '4' and '5' is filtered out
    expect(clusters).toEqual([['1', '2', '3']]);
    
    // Restore original cosineSimilarity if needed
    global.cosineSimilarity = originalCosine;
  });

  test('hierarchicalAgglomerativeClustering filters out clusters with less than 3 tabs', () => {
    // Here we simulate a scenario for hierarchicalAgglomerativeClustering using similar setup as above.
    const { hierarchicalAgglomerativeClustering } = require('./background.js');
    
    // Create simulated tabVectors
    const tabVectors = {
      '1': { a: 1 },
      '2': { a: 1 },
      '3': { a: 1 },
      '4': { a: 0 },
      '5': { a: 0 },
      '6': { a: 1 }
    };

    // Override cosineSimilarity similarly
    const originalCosine = global.cosineSimilarity;
    global.cosineSimilarity = (vec1, vec2) => {
      if ((vec1.a === 1 && vec2.a === 1) || (vec1.a === 0 && vec2.a === 0)) {
        return 1;
      }
      return 0;
    };
    
    // Set similarityThreshold to 0.5 in settings
    global.settings = { similarityThreshold: 0.5 };
    
    const clusters = hierarchicalAgglomerativeClustering(tabVectors);
    
    // Expect cluster with tabs that have a=1: tabs '1','2','3','6' (size 4) to exist, and group with a=0
    // tabs '4' and '5' form a cluster of size 2 which should be filtered out
    const expectedCluster = ['1', '2', '3', '6'];
    // Since order might vary, sort the clusters for comparison
    const sortedClusters = clusters.map(cluster => cluster.sort());
    expect(sortedClusters).toContainEqual(expectedCluster.sort());
    expect(clusters.some(cluster => cluster.length === 2)).toBe(false);
    
    // Restore original cosineSimilarity
    global.cosineSimilarity = originalCosine;
  });
});
