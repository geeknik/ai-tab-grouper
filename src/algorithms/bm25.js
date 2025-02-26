/**
 * Enhanced BM25 implementation with optimizations
 */

import { preprocessDocument } from '../utils/preprocessing.js';
import { cosineSimilarity } from '../utils/math.js';

/**
 * Cache implementation with LRU (Least Recently Used) strategy
 */
class LRUCache {
    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        const item = this.cache.get(key);
        if (item) {
            // Refresh item
            this.cache.delete(key);
            this.cache.set(key, item);
        }
        return item;
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            // Remove oldest item
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
    }
}

export class BM25 {
    constructor(options = {}) {
        this.k1 = options.k1 || 1.5;  // Term frequency saturation parameter
        this.b = options.b || 0.75;   // Length normalization parameter
        this.documents = new Map();
        this.docFreq = new Map();
        this.avgDocLength = 0;
        this.totalLength = 0;
        this.minDocuments = 2;
        this.vocabulary = new Set();
        this.dirty = true;
        this.epsilon = 1e-10;

        // Initialize caches
        this.vectorCache = new Map();
        this.scoreCache = new Map();
        this.similarityCache = new Map();
    }

    /**
     * Add or update a document in the collection
     * @param {string} docId - Document identifier
     * @param {string} text - Document text
     * @param {Object} options - Preprocessing options
     */
    addDocument(docId, text, options = {}) {
        const processedDoc = preprocessDocument(text, {
            removeStopWords: false,  // We want to keep all terms for BM25
            toLowerCase: true,       // Always normalize case
            minWordLength: 1
        });
        
        // Update document frequencies and vocabulary
        processedDoc.uniqueTerms.forEach(term => {
            this.vocabulary.add(term);
            this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
        });

        // Store processed document
        this.documents.set(docId, processedDoc);
        
        // Update length statistics
        this.totalLength += processedDoc.length;
        this.avgDocLength = this.totalLength / this.documents.size;
        this.dirty = true;
    }

    /**
     * Remove a document from the collection
     * @param {string} docId - Document identifier
     */
    removeDocument(docId) {
        const doc = this.documents.get(docId);
        if (doc) {
            // Update document frequencies
            doc.uniqueTerms.forEach(term => {
                const df = this.docFreq.get(term);
                if (df === 1) {
                    this.docFreq.delete(term);
                    this.vocabulary.delete(term);
                } else {
                    this.docFreq.set(term, df - 1);
                }
            });

            // Update length statistics
            this.totalLength -= doc.length;
            this.documents.delete(docId);
            if (this.documents.size > 0) {
                this.avgDocLength = this.totalLength / this.documents.size;
            } else {
                this.avgDocLength = 0;
            }
            this.dirty = true;
            
            // Clear caches
            this.vectorCache.clear();
            this.scoreCache.clear();
            this.similarityCache.clear();
        }
    }

    /**
     * Calculate IDF scores for all terms
     * @private
     */
    _updateIDF() {
        if (!this.dirty) {
            return;
        }

        this.docFreq.clear();
        const numDocs = this.documents.size;

        // Process terms in batches for memory efficiency
        const batchSize = 1000;
        const terms = Array.from(this.vocabulary);
        
        for (let i = 0; i < terms.length; i += batchSize) {
            const batchTerms = terms.slice(i, Math.min(i + batchSize, terms.length));
            this._processIDFBatch(batchTerms, numDocs);
        }

        this.dirty = false;
    }

    /**
     * Process a batch of terms for IDF calculation
     * @private
     * @param {string[]} terms - Batch of terms to process
     * @param {number} numDocs - Total number of documents
     */
    _processIDFBatch(terms, numDocs) {
        // Count document frequency for each term
        const docFreq = new Map();
        for (const [_, doc] of this.documents) {
            const uniqueTerms = new Set(doc.tokens);
            for (const term of terms) {
                if (uniqueTerms.has(term)) {
                    docFreq.set(term, (docFreq.get(term) || 0) + 1);
                }
            }
        }

        // Calculate IDF using BM25 formula
        for (const term of terms) {
            const df = docFreq.get(term) || 0;
            const idf = Math.log1p((numDocs - df + 0.5) / (df + 0.5) + 1);
            this.docFreq.set(term, Math.max(0, idf)); // Ensure non-negative IDF
        }
    }

    /**
     * Calculate BM25 score for a term
     * @private
     */
    _getTermScore(term, tf, docLength) {
        const cacheKey = `score_${term}_${tf}_${docLength}`;
        const cachedScore = this.scoreCache.get(cacheKey);
        if (cachedScore !== undefined) {
            return cachedScore;
        }

        // Calculate document frequency
        let df = 0;
        for (const doc of this.documents.values()) {
            if (doc.tokens.includes(term)) {
                df++;
            }
        }

        // Calculate IDF with smoothing to prevent negative values
        const numDocs = this.documents.size;
        const idf = Math.log1p((numDocs - df + 0.5) / (df + 0.5));
        
        // Calculate normalized term frequency with BM25 formula
        const normalizedTf = (tf * (this.k1 + 1)) / 
            (tf + this.k1 * (1 - this.b + this.b * docLength / Math.max(1, this.avgDocLength)));

        // Ensure rare terms get higher scores
        const score = idf * normalizedTf;
        this.scoreCache.set(cacheKey, score);
        return score;
    }

    /**
     * Get document vector with BM25 scores
     * @param {string} docId - Document identifier
     * @returns {Object} Document vector with term scores
     */
    getDocumentVector(docId) {
        if (this.vectorCache.has(docId)) {
            return this.vectorCache.get(docId);
        }

        const doc = this.documents.get(docId);
        if (!doc) {
            throw new Error(`Document ${docId} not found`);
        }

        const vector = {};
        const docLength = doc.length;

        // Calculate term weights
        for (const term of doc.uniqueTerms) {
            const tf = doc.termFreq[term];
            const df = this.docFreq.get(term) || 0;
            
            // BM25 IDF calculation with stronger penalty for common terms
            const idf = Math.log1p((this.documents.size - df + 0.5) / (df + 0.5));
            
            // BM25 term frequency saturation with length normalization
            const lengthFactor = 1 - this.b + this.b * (docLength / Math.max(1, this.avgDocLength));
            const tfNorm = (tf * (this.k1 + 1)) / (tf + this.k1 * lengthFactor);
            
            // Store score with additional boost for rare terms
            vector[term] = tfNorm * idf * (1 + Math.log1p(this.documents.size / (df + 1)));
        }

        this.vectorCache.set(docId, vector);
        return vector;
    }

    /**
     * Calculate similarity between two documents using BM25 scores
     * @param {string} docId1 - First document identifier
     * @param {string} docId2 - Second document identifier
     * @returns {number} Similarity score
     */
    similarity(docId1, docId2) {
        const cacheKey = `${docId1}_${docId2}`;
        if (this.similarityCache.has(cacheKey)) {
            return this.similarityCache.get(cacheKey);
        }

        if (!this.documents.has(docId1) || !this.documents.has(docId2)) {
            throw new Error('Document not found');
        }

        if (docId1 === docId2) {
            return 1;
        }

        const vec1 = this.getDocumentVector(docId1);
        const vec2 = this.getDocumentVector(docId2);

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        // Calculate dot product and norms
        const allTerms = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
        for (const term of allTerms) {
            const val1 = vec1[term] || 0;
            const val2 = vec2[term] || 0;
            dotProduct += val1 * val2;
            norm1 += val1 * val1;
            norm2 += val2 * val2;
        }

        // Handle zero vectors and numerical precision
        if (norm1 < this.epsilon || norm2 < this.epsilon) {
            return 0;
        }

        // Calculate cosine similarity with precision handling
        const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
        if (Math.abs(similarity - 1) < this.epsilon) {
            return 1;
        }
        const result = Math.max(0, Math.min(1, similarity));
        this.similarityCache.set(cacheKey, result);
        this.similarityCache.set(`${docId2}_${docId1}`, result);
        return result;
    }

    /**
     * Optimize BM25 parameters using grid search
     * @param {Object} options - Optimization options
     * @returns {Object} Optimized parameters
     */
    optimizeParameters(options = {}) {
        const {
            k1Range = { min: 0.5, max: 3.0, step: 0.5 },
            bRange = { min: 0.1, max: 1.0, step: 0.1 },
            validationQueries = []
        } = options;

        if (validationQueries.length === 0) {
            throw new Error('Need validation queries for parameter optimization');
        }

        let bestScore = -Infinity;
        let bestParams = { k1: this.k1, b: this.b };

        // Grid search over parameter space
        for (let k1 = k1Range.min; k1 <= k1Range.max; k1 += k1Range.step) {
            for (let b = bRange.min; b <= bRange.max; b += bRange.step) {
                // Update parameters
                this.updateParameters({ k1, b });
                
                // Evaluate parameters
                let score = 0;
                for (const query of validationQueries) {
                    const results = this.search(query.text);
                    score += this._evaluateResults(results, query.relevantDocs);
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestParams = { k1, b };
                }
            }
        }

        // Set best parameters
        this.updateParameters(bestParams);
        return bestParams;
    }

    /**
     * Evaluate search results against relevant documents
     * @private
     * @param {Array} results - Search results
     * @param {Array} relevantDocs - Relevant document IDs
     * @returns {number} Evaluation score
     */
    _evaluateResults(results, relevantDocs) {
        const relevantSet = new Set(relevantDocs);
        let precision = 0;
        let recall = 0;

        for (let i = 0; i < results.length; i++) {
            if (relevantSet.has(results[i].docId)) {
                precision++;
            }
        }

        precision = precision / results.length;
        recall = precision * results.length / relevantSet.size;

        // F1 score
        return 2 * (precision * recall) / (precision + recall || 1);
    }

    /**
     * Search for documents similar to a query
     * @param {string} query - Query text
     * @param {Object} options - Search options
     * @returns {Array<{docId: string, score: number}>} Ranked results
     */
    search(query, { limit = 10, threshold = 0.0 } = {}) {
        if (this.documents.size < this.minDocuments) {
            return [];
        }

        const processedQuery = preprocessDocument(query, {
            removeStopWords: false,  // Keep all terms for matching
            toLowerCase: true,       // Always normalize case
            minWordLength: 1
        });
        
        if (processedQuery.uniqueTerms.size === 0) {
            return [];
        }

        // Create query vector using BM25 weights
        const queryVector = {};
        let hasMatchingTerms = false;

        // Calculate query term weights
        for (const term of processedQuery.uniqueTerms) {
            if (this.docFreq.has(term)) {
                hasMatchingTerms = true;
                const tf = processedQuery.termFreq[term];
                const df = this.docFreq.get(term);
                
                // BM25 IDF calculation with stronger penalty for common terms
                const idf = Math.log1p((this.documents.size - df + 0.5) / (df + 0.5));
                
                // BM25 term frequency normalization for query
                const lengthFactor = 1 - this.b + this.b * (processedQuery.length / this.avgDocLength);
                const tfNorm = (tf * (this.k1 + 1)) / (tf + this.k1 * lengthFactor);
                
                // Store score with additional boost for rare terms
                queryVector[term] = tfNorm * idf * (1 + Math.log1p(this.documents.size / (df + 1)));
            }
        }

        if (!hasMatchingTerms) {
            return [];
        }

        // Calculate scores for all documents
        const results = [];
        for (const [docId] of this.documents) {
            const docVector = this.getDocumentVector(docId);
            let score = 0;
            let queryNorm = 0;
            let docNorm = 0;

            // Calculate similarity score
            for (const term in queryVector) {
                const queryWeight = queryVector[term];
                const docWeight = docVector[term] || 0;
                score += queryWeight * docWeight;
                queryNorm += queryWeight * queryWeight;
                docNorm += docWeight * docWeight;
            }

            // Normalize score with precision handling
            if (queryNorm > this.epsilon && docNorm > this.epsilon) {
                score /= Math.sqrt(queryNorm * docNorm);
                if (score > threshold) {
                    // Add small random factor to break ties
                    const finalScore = score + Math.random() * this.epsilon;
                    results.push({ docId, score: finalScore });
                }
            }
        }

        // Sort by score and apply limit
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, Math.min(Math.max(1, limit), results.length));
    }

    /**
     * Get statistics about the document collection
     * @returns {Object} Collection statistics
     */
    getStats() {
        return {
            parameters: {
                k1: this.k1,
                b: this.b
            },
            numDocuments: this.documents.size,
            vocabularySize: this.vocabulary.size,
            averageDocLength: this.avgDocLength
        };
    }

    /**
     * Update BM25 parameters
     * @param {Object} params - New parameters
     * @param {number} params.k1 - Term frequency saturation parameter
     * @param {number} params.b - Length normalization parameter
     */
    updateParameters(params) {
        if (params.k1 !== undefined) {
            if (params.k1 < 0) {
                throw new Error('k1 parameter must be non-negative');
            }
            this.k1 = params.k1;
        }
        if (params.b !== undefined) {
            if (params.b < 0 || params.b > 1) {
                throw new Error('b parameter must be between 0 and 1');
            }
            this.b = params.b;
        }
        this.dirty = true;
    }
} 