/**
 * Unit tests for BM25 implementation
 */

import { BM25 } from '../../../algorithms/bm25.js';

describe('BM25', () => {
    let bm25;

    beforeEach(() => {
        bm25 = new BM25();
    });

    describe('Constructor and Parameters', () => {
        test('should initialize with default parameters', () => {
            const stats = bm25.getStats();
            expect(stats.parameters.k1).toBe(1.5);
            expect(stats.parameters.b).toBe(0.75);
        });

        test('should accept custom parameters', () => {
            bm25 = new BM25({ k1: 2.0, b: 0.5 });
            const stats = bm25.getStats();
            expect(stats.parameters.k1).toBe(2.0);
            expect(stats.parameters.b).toBe(0.5);
        });

        test('should validate parameters on update', () => {
            expect(() => {
                bm25.updateParameters({ k1: -1 });
            }).toThrow();

            expect(() => {
                bm25.updateParameters({ b: 1.5 });
            }).toThrow();
        });
    });

    describe('Document Management', () => {
        test('should add documents correctly', () => {
            bm25.addDocument('doc1', 'This is a test document');
            bm25.addDocument('doc2', 'Another test document');
            
            const stats = bm25.getStats();
            expect(stats.numDocuments).toBe(2);
            expect(stats.vocabularySize).toBeGreaterThan(0);
            expect(stats.averageDocLength).toBeGreaterThan(0);
        });

        test('should remove documents correctly', () => {
            bm25.addDocument('doc1', 'This is a test document');
            bm25.addDocument('doc2', 'Another test document');
            bm25.removeDocument('doc1');
            
            const stats = bm25.getStats();
            expect(stats.numDocuments).toBe(1);
        });

        test('should handle empty documents', () => {
            bm25.addDocument('doc1', '');
            const stats = bm25.getStats();
            expect(stats.numDocuments).toBe(1);
            expect(stats.vocabularySize).toBe(0);
            expect(stats.averageDocLength).toBe(0);
        });

        test('should update average document length', () => {
            bm25.addDocument('doc1', 'short doc');
            bm25.addDocument('doc2', 'this is a longer document with more words');
            
            const stats = bm25.getStats();
            expect(stats.averageDocLength).toBeGreaterThan(0);
        });
    });

    describe('BM25 Scoring', () => {
        beforeEach(() => {
            bm25.addDocument('doc1', 'the quick brown fox jumps over the lazy dog');
            bm25.addDocument('doc2', 'the quick brown fox jumps over the quick rabbit');
            bm25.addDocument('doc3', 'the lazy rabbit sleeps');
        });

        test('should calculate document vectors correctly', () => {
            const vector = bm25.getDocumentVector('doc1');
            expect(vector).toBeDefined();
            expect(Object.keys(vector)).toContain('fox');
            expect(Object.keys(vector)).toContain('dog');
        });

        test('should give higher weight to rare terms', () => {
            const vector = bm25.getDocumentVector('doc1');
            // 'dog' appears in only one document, 'the' appears in all
            expect(vector['dog']).toBeGreaterThan(vector['the']);
        });

        test('should consider term frequency saturation', () => {
            bm25.addDocument('doc4', 'quick quick quick quick quick');
            bm25.addDocument('doc5', 'quick');
            
            const vector4 = bm25.getDocumentVector('doc4');
            const vector5 = bm25.getDocumentVector('doc5');
            
            // The score increase should be less than linear
            expect(vector4['quick'] / vector5['quick']).toBeLessThan(5);
        });

        test('should consider document length normalization', () => {
            bm25.addDocument('doc4', 'fox');
            bm25.addDocument('doc5', 'fox ' + 'word '.repeat(20));
            
            const vector4 = bm25.getDocumentVector('doc4');
            const vector5 = bm25.getDocumentVector('doc5');
            
            // The shorter document should have a higher score for 'fox'
            expect(vector4['fox']).toBeGreaterThan(vector5['fox']);
        });
    });

    describe('Document Similarity', () => {
        beforeEach(() => {
            bm25.addDocument('doc1', 'the quick brown fox');
            bm25.addDocument('doc2', 'the quick brown fox');
            bm25.addDocument('doc3', 'the lazy dog sleeps');
        });

        test('should calculate high similarity for identical documents', () => {
            const similarity = bm25.similarity('doc1', 'doc2');
            expect(similarity).toBeCloseTo(1, 5);
        });

        test('should calculate low similarity for different documents', () => {
            const similarity = bm25.similarity('doc1', 'doc3');
            expect(similarity).toBeLessThan(0.5);
        });

        test('should handle documents with no common terms', () => {
            bm25.addDocument('doc4', 'completely different terms here');
            const similarity = bm25.similarity('doc1', 'doc4');
            expect(similarity).toBe(0);
        });
    });

    describe('Search Functionality', () => {
        beforeEach(() => {
            bm25.addDocument('doc1', 'the quick brown fox jumps over the lazy dog');
            bm25.addDocument('doc2', 'the quick brown fox jumps over the quick rabbit');
            bm25.addDocument('doc3', 'the lazy rabbit sleeps');
            bm25.addDocument('doc4', 'a completely different document about cats');
        });

        test('should find relevant documents', () => {
            const results = bm25.search('quick fox');
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].docId).toMatch(/doc[12]/); // Should be either doc1 or doc2
        });

        test('should respect result limit', () => {
            const results = bm25.search('the', { limit: 2 });
            expect(results.length).toBe(2);
        });

        test('should respect score threshold', () => {
            const results = bm25.search('cats', { threshold: 0.5 });
            expect(results.length).toBe(1);
            expect(results[0].docId).toBe('doc4');
        });

        test('should handle queries with no matches', () => {
            const results = bm25.search('nonexistent terms');
            expect(results).toEqual([]);
        });

        test('should rank documents by relevance', () => {
            const results = bm25.search('quick');
            expect(results[0].score).toBeGreaterThan(results[results.length - 1].score);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle documents with special characters', () => {
            bm25.addDocument('doc1', 'special!@#$%^&*()characters');
            const vector = bm25.getDocumentVector('doc1');
            expect(vector).toBeDefined();
        });

        test('should handle very long documents', () => {
            const longText = 'word '.repeat(1000);
            bm25.addDocument('doc1', longText);
            const vector = bm25.getDocumentVector('doc1');
            expect(vector).toBeDefined();
        });

        test('should handle documents with numbers', () => {
            bm25.addDocument('doc1', 'document with 123 numbers 456');
            const vector = bm25.getDocumentVector('doc1');
            expect(vector).toBeDefined();
        });

        test('should throw error for non-existent document', () => {
            expect(() => {
                bm25.getDocumentVector('nonexistent');
            }).toThrow();
        });

        test('should handle case sensitivity correctly', () => {
            bm25.addDocument('doc1', 'The Quick Brown Fox');
            bm25.addDocument('doc2', 'the quick brown fox');
            const similarity = bm25.similarity('doc1', 'doc2');
            expect(similarity).toBe(1);
        });
    });
}); 