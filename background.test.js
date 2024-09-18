// Mock chrome API
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
    },
  },
};

// Import functions to test
const {
  cosineSimilarity,
  jaccardSimilarity,
  generateGroupName,
  extractKeyphrases,
} = require('./background');

describe('Tab Grouping Extension', () => {
  describe('cosineSimilarity', () => {
    test('calculates cosine similarity correctly', () => {
      const doc1 = { a: 1, b: 2, c: 3 };
      const doc2 = { b: 2, c: 4, d: 5 };
      expect(cosineSimilarity(doc1, doc2)).toBeCloseTo(0.7745, 4);
    });

    test('returns 0 for orthogonal vectors', () => {
      const doc1 = { a: 1, b: 0 };
      const doc2 = { a: 0, b: 1 };
      expect(cosineSimilarity(doc1, doc2)).toBe(0);
    });

    test('returns 1 for identical vectors', () => {
      const doc = { a: 1, b: 2, c: 3 };
      expect(cosineSimilarity(doc, doc)).toBe(1);
    });
  });

  describe('jaccardSimilarity', () => {
    test('calculates Jaccard similarity correctly', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['b', 'c', 'd']);
      expect(jaccardSimilarity(set1, set2)).toBe(0.5);
    });

    test('returns 1 for identical sets', () => {
      const set = new Set(['a', 'b', 'c']);
      expect(jaccardSimilarity(set, set)).toBe(1);
    });

    test('returns 0 for disjoint sets', () => {
      const set1 = new Set(['a', 'b', 'c']);
      const set2 = new Set(['d', 'e', 'f']);
      expect(jaccardSimilarity(set1, set2)).toBe(0);
    });
  });

  describe('generateGroupName', () => {
    test('generates a group name based on common terms', () => {
      const clusterDocs = [
        'example website home page',
        'example website about us',
        'example website contact'
      ];
      expect(generateGroupName(clusterDocs)).toBe('example-website');
    });

    test('respects maxGroupNameLength setting', () => {
      const clusterDocs = [
        'very long example website name home page',
        'very long example website name about us',
        'very long example website name contact'
      ];
      // Assuming maxGroupNameLength is set to 15
      expect(generateGroupName(clusterDocs).length).toBeLessThanOrEqual(15);
    });
  });

  describe('extractKeyphrases', () => {
    test('extracts keyphrases from text', () => {
      const text = 'This is an example text about keyword extraction. Keyword extraction is an important task in natural language processing.';
      const keyphrases = extractKeyphrases(text);
      expect(keyphrases).toContain('keyword extraction');
      expect(keyphrases).toContain('natural language processing');
    });

    test('respects the number of phrases parameter', () => {
      const text = 'This is an example text about keyword extraction. Keyword extraction is an important task in natural language processing.';
      const keyphrases = extractKeyphrases(text, 3);
      expect(keyphrases.length).toBe(3);
    });
  });
});
