/**
 * Unit tests for LSA implementation
 */

import { LSA } from '../../../algorithms/lsa.js';

describe('LSA', () => {
    let lsa;

    beforeEach(() => {
        lsa = new LSA();
    });

    describe('Constructor and Parameters', () => {
        test('should initialize with default parameters', () => {
            const stats = lsa.getStats();
            expect(stats.parameters.numDimensions).toBe(100);
            expect(stats.parameters.minDocuments).toBe(3);
        });

        test('should accept custom parameters', () => {
            lsa = new LSA({
                numDimensions: 50,
                minDocuments: 5
            });
            
            const stats = lsa.getStats();
            expect(stats.parameters.numDimensions).toBe(50);
            expect(stats.parameters.minDocuments).toBe(5);
        });
    });

    describe('Document Management', () => {
        test('should add documents correctly', () => {
            lsa.addDocument('doc1', 'This is a test document about artificial intelligence');
            lsa.addDocument('doc2', 'Another document about machine learning and AI');
            
            const stats = lsa.getStats();
            expect(stats.numDocuments).toBe(2);
            expect(stats.vocabularySize).toBeGreaterThan(0);
        });

        test('should remove documents correctly', () => {
            lsa.addDocument('doc1', 'This is a test document');
            lsa.addDocument('doc2', 'Another test document');
            lsa.removeDocument('doc1');
            
            const stats = lsa.getStats();
            expect(stats.numDocuments).toBe(1);
        });

        test('should handle empty documents', () => {
            lsa.addDocument('doc1', '');
            const stats = lsa.getStats();
            expect(stats.numDocuments).toBe(1);
            expect(stats.vocabularySize).toBe(0);
        });

        test('should enforce minimum document requirement', () => {
            lsa.addDocument('doc1', 'First document');
            lsa.addDocument('doc2', 'Second document');
            
            expect(() => {
                lsa.getDocumentVector('doc1');
            }).toThrow(/Need at least \d+ documents/);
        });
    });

    describe('LSA Processing', () => {
        beforeEach(() => {
            // Add minimum required documents
            lsa.addDocument('doc1', 'The quick brown fox jumps over the lazy dog');
            lsa.addDocument('doc2', 'The quick brown fox jumps over the quick rabbit');
            lsa.addDocument('doc3', 'The lazy rabbit sleeps');
            lsa.addDocument('doc4', 'A quick brown dog chases the fox');
        });

        test('should generate document vectors', () => {
            const vector = lsa.getDocumentVector('doc1');
            expect(vector).toBeDefined();
            expect(vector.length).toBeLessThanOrEqual(lsa.numDimensions);
            expect(vector.every(v => typeof v === 'number')).toBe(true);
        });

        test('should generate term vectors', () => {
            const vector = lsa.getTermVector('quick');
            expect(vector).toBeDefined();
            expect(vector.length).toBeLessThanOrEqual(lsa.numDimensions);
            expect(vector.every(v => typeof v === 'number')).toBe(true);
        });

        test('should throw error for non-existent document', () => {
            expect(() => {
                lsa.getDocumentVector('nonexistent');
            }).toThrow();
        });

        test('should throw error for non-existent term', () => {
            expect(() => {
                lsa.getTermVector('nonexistent');
            }).toThrow();
        });
    });

    describe('Document Similarity', () => {
        beforeEach(() => {
            lsa.addDocument('doc1', 'The quick brown fox jumps over the lazy dog');
            lsa.addDocument('doc2', 'The quick brown fox jumps over the quick rabbit');
            lsa.addDocument('doc3', 'The lazy rabbit sleeps');
            lsa.addDocument('doc4', 'A completely different topic about machine learning');
        });

        test('should calculate high similarity for similar documents', () => {
            const similarity = lsa.similarity('doc1', 'doc2');
            expect(similarity).toBeGreaterThan(0.5);
        });

        test('should calculate low similarity for different documents', () => {
            const similarity = lsa.similarity('doc1', 'doc4');
            expect(similarity).toBeLessThan(0.5);
        });

        test('should handle documents with no common terms', () => {
            lsa.addDocument('doc5', 'xyz abc def ghi');
            const similarity = lsa.similarity('doc1', 'doc5');
            expect(similarity).toBeCloseTo(0, 1);
        });
    });

    describe('Search Functionality', () => {
        beforeEach(() => {
            lsa.addDocument('doc1', 'The quick brown fox jumps over the lazy dog');
            lsa.addDocument('doc2', 'The quick brown fox jumps over the quick rabbit');
            lsa.addDocument('doc3', 'The lazy rabbit sleeps');
            lsa.addDocument('doc4', 'A document about artificial intelligence and machine learning');
            lsa.addDocument('doc5', 'Deep learning and neural networks in AI');
        });

        test('should find relevant documents', () => {
            const results = lsa.search('quick fox');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].docId).toMatch(/doc[12]/); // Should be either doc1 or doc2
        });

        test('should respect result limit', () => {
            const results = lsa.search('the', { limit: 2 });
            expect(results.length).toBe(2);
        });

        test('should respect similarity threshold', () => {
            const results = lsa.search('artificial intelligence', { threshold: 0.5 });
            expect(results.every(r => r.score >= 0.5)).toBe(true);
        });

        test('should handle queries with no matches', () => {
            const results = lsa.search('nonexistent terms');
            expect(results).toEqual([]);
        });
    });

    describe('Term Similarity', () => {
        beforeEach(() => {
            lsa.addDocument('doc1', 'artificial intelligence and machine learning');
            lsa.addDocument('doc2', 'deep learning and neural networks');
            lsa.addDocument('doc3', 'machine learning algorithms and AI');
            lsa.addDocument('doc4', 'artificial intelligence research in deep learning');
        });

        test('should find similar terms', () => {
            const results = lsa.findSimilarTerms('artificial');
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.term === 'intelligence')).toBe(true);
        });

        test('should respect result limit', () => {
            const results = lsa.findSimilarTerms('learning', { limit: 2 });
            expect(results.length).toBe(2);
        });

        test('should respect similarity threshold', () => {
            const results = lsa.findSimilarTerms('machine', { threshold: 0.3 });
            expect(results.every(r => r.score >= 0.3)).toBe(true);
        });

        test('should handle non-existent terms', () => {
            expect(() => {
                lsa.findSimilarTerms('nonexistent');
            }).toThrow();
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle documents with special characters', () => {
            lsa.addDocument('doc1', 'special!@#$%^&*()characters');
            lsa.addDocument('doc2', 'more@#$%special');
            lsa.addDocument('doc3', 'testing#$%^&');
            
            const vector = lsa.getDocumentVector('doc1');
            expect(vector).toBeDefined();
        });

        test('should handle very long documents', () => {
            const longText = 'word '.repeat(1000);
            lsa.addDocument('doc1', longText);
            lsa.addDocument('doc2', 'short document');
            lsa.addDocument('doc3', 'another document');
            
            const vector = lsa.getDocumentVector('doc1');
            expect(vector).toBeDefined();
        });

        test('should handle case sensitivity correctly', () => {
            lsa.addDocument('doc1', 'The Quick Brown Fox');
            lsa.addDocument('doc2', 'the quick brown fox');
            lsa.addDocument('doc3', 'THE QUICK BROWN FOX');
            
            const similarity = lsa.similarity('doc1', 'doc2');
            expect(similarity).toBeCloseTo(1, 1);
        });

        test('should handle document removal and re-addition', () => {
            lsa.addDocument('doc1', 'test document');
            lsa.addDocument('doc2', 'another document');
            lsa.addDocument('doc3', 'third document');
            
            lsa.removeDocument('doc2');
            lsa.addDocument('doc2', 'new content');
            
            const vector = lsa.getDocumentVector('doc2');
            expect(vector).toBeDefined();
        });
    });
}); 