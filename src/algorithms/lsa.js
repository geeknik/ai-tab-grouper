/**
 * LSA (Latent Semantic Analysis) implementation
 */

import { preprocessDocument, normalizeVector } from '../utils/preprocessing.js';
import { svd } from '../utils/math.js';

export class LSA {
    constructor(options = {}) {
        this.numDimensions = options.numDimensions || 100;
        this.minDocuments = options.minDocuments || 3;
        this.documents = new Map();
        this.vocabulary = new Set();
        this.termDocMatrix = null;
        this.U = null;
        this.S = null;
        this.V = null;
        this.epsilon = 1e-10;
        this.docs = [];  // Cache document IDs
        this.terms = [];  // Cache terms
        this.options = {
            dimensions: this.numDimensions,
            minDocuments: this.minDocuments,
            removeStopWords: false,
            removeWebStopWords: true,
            minWordLength: 1,
            toLowerCase: true,
            ...options
        };
    }

    getStats() {
        return {
            numDocuments: this.documents.size,
            vocabularySize: this.vocabulary.size,
            parameters: {
                numDimensions: this.numDimensions,
                minDocuments: this.minDocuments
            }
        };
    }

    getDocumentVector(docId) {
        if (!this.documents.has(docId)) throw new Error('Document not found');
        if (this.documents.size < this.minDocuments) throw new Error(`Need at least ${this.minDocuments} documents for LSA processing`);
        if (!this.V) this._performSVD();
        const idx = this.docs.findIndex(([id]) => id === docId);
        return idx !== -1 ? this.V[idx] : null;
    }

    getTermVector(term) {
        if (!this.vocabulary.has(term)) throw new Error('Term not found in vocabulary');
        if (this.documents.size < this.minDocuments) throw new Error(`Need at least ${this.minDocuments} documents for LSA processing`);
        if (!this.U) this._performSVD();
        const idx = this.terms.indexOf(term);
        return idx !== -1 ? this.U[idx] : null;
    }

    findSimilarTerms(term, { limit = 10, threshold = 0.0 } = {}) {
        if (!this.vocabulary.has(term)) throw new Error(`Term '${term}' not found in vocabulary`);
        if (this.documents.size < this.minDocuments) throw new Error(`Need at least ${this.minDocuments} documents for term similarity`);
        if (!this.U) this._performSVD();
        const termVector = this.getTermVector(term);
        const results = [];
        for (let i = 0; i < this.terms.length; i++) {
            const otherTerm = this.terms[i];
            if (otherTerm === term) continue;
            const otherVector = this.U[i];
            const similarity = this._calculateCosineSimilarity(termVector, otherVector);
            if (similarity >= threshold) {
                results.push({ term: otherTerm, score: similarity });
            }
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }

    addDocument(docId, text) {
        const processedDoc = preprocessDocument(text, this.options);
        this.documents.set(docId, processedDoc);
        processedDoc.uniqueTerms.forEach(term => this.vocabulary.add(term));
        this._invalidateModel();
    }

    removeDocument(docId) {
        if (this.documents.has(docId)) {
            this.documents.delete(docId);
            this._invalidateModel();
        }
    }

    _invalidateModel() {
        this.termDocMatrix = null;
        this.U = null;
        this.S = null;
        this.V = null;
        this.docs = Array.from(this.documents.entries());
        this.terms = Array.from(this.vocabulary);
    }

    _buildTermDocMatrix() {
        if (!this.termDocMatrix) {
            const terms = Array.from(this.vocabulary).sort();
            const docs = Array.from(this.documents.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            this.terms = terms;
            this.docs = docs;

            this.docFreq = new Map();
            let totalLength = 0;
            for (const [_, doc] of docs) {
                totalLength += doc.length;
                for (const term of Object.keys(doc.termFreq)) {
                    this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
                }
            }
            this.avgDocLength = totalLength / docs.length;

            const matrix = [];
            for (let i = 0; i < terms.length; i++) {
                const term = terms[i];
                const row = [];
                const df = this.docFreq.get(term) || 0;
                const idf = Math.log1p(docs.length / df);

                for (let j = 0; j < docs.length; j++) {
                    const doc = docs[j][1];
                    const tf = doc.termFreq[term] || 0;
                    if (tf > 0) {
                        const k1 = 1.2;
                        const b = 0.25;
                        const lengthFactor = 1 - b + b * (doc.length / this.avgDocLength);
                        const tfNorm = (tf * (k1 + 1)) / (tf + k1 * lengthFactor);

                        let positionBoost = 1.0;
                        if (doc.termPositions && doc.termPositions[term]) {
                            const firstPos = doc.termPositions[term][0];
                            positionBoost = 1.0 + 0.1 * Math.exp(-firstPos / 20);
                        }

                        const freqBoost = 1.0 + 0.1 * Math.log1p(tf);

                        row.push(tfNorm * idf * positionBoost * freqBoost);
                    } else {
                        row.push(0);
                    }
                }
                matrix.push(row);
            }

            for (let j = 0; j < docs.length; j++) {
                let colSum = 0;
                let nonZeroCount = 0;
                for (let i = 0; i < terms.length; i++) {
                    if (matrix[i][j] > this.epsilon) {
                        colSum += matrix[i][j] * matrix[i][j];
                        nonZeroCount++;
                    }
                }
                if (colSum > this.epsilon) {
                    const smoothingFactor = Math.exp(-0.05 * nonZeroCount);
                    const norm = Math.sqrt(colSum + smoothingFactor);
                    for (let i = 0; i < terms.length; i++) {
                        matrix[i][j] /= norm;
                    }
                }
            }

            this.termDocMatrix = matrix;
        }
        return this.termDocMatrix;
    }

    _performSVD() {
        const matrix = this._buildTermDocMatrix();
        if (!matrix || matrix.length === 0 || matrix[0].length === 0) {
            this.U = [];
            this.S = [];
            this.V = [];
            return;
        }

        try {
            // Defensive: limit matrix size to avoid stack overflow
            const maxRows = 200;
            const maxCols = 200;
            if (matrix.length > maxRows || matrix[0].length > maxCols) {
                console.warn(`LSA matrix too large (${matrix.length}x${matrix[0].length}), truncating to ${maxRows}x${maxCols}`);
                matrix.length = Math.min(matrix.length, maxRows);
                for (let i = 0; i < matrix.length; i++) {
                    matrix[i].length = Math.min(matrix[i].length, maxCols);
                }
            }

            const { u, s, v } = svd(matrix);

            const maxRank = Math.min(this.numDimensions, s.length);
            const maxSingularValue = s[0];
            const threshold = maxSingularValue * Math.min(0.05, 1 / Math.sqrt(this.terms.length));
            const effectiveRank = s.findIndex(val => val < threshold);
            const rank = Math.min(maxRank, effectiveRank === -1 ? s.length : effectiveRank);

            this.U = u.map(row => row.slice(0, rank));
            this.S = s.slice(0, rank);
            this.V = v.map(row => row.slice(0, rank));

            for (let i = 0; i < rank; i++) {
                const semanticWeight = Math.pow(0.95, i);
                const scaleFactor = Math.sqrt(this.S[i]) * semanticWeight;
                for (let j = 0; j < this.U.length; j++) {
                    this.U[j][i] *= scaleFactor;
                }
                for (let j = 0; j < this.V.length; j++) {
                    this.V[j][i] *= scaleFactor;
                }
            }

            for (let i = 0; i < this.V.length; i++) {
                const norm = Math.sqrt(this.V[i].reduce((sum, val) => sum + val * val, 0));
                if (norm > this.epsilon) {
                    for (let j = 0; j < this.V[i].length; j++) {
                        this.V[i][j] /= norm;
                    }
                }
            }
        } catch (error) {
            console.error('SVD computation failed:', error);
            this.U = [];
            this.S = [];
            this.V = [];
        }
    }

    _calculateCosineSimilarity(vec1, vec2) {
        if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
        let dot = 0, norm1 = 0, norm2 = 0;
        for (let i = 0; i < vec1.length; i++) {
            dot += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        if (norm1 < this.epsilon || norm2 < this.epsilon) return 0;
        const sim = dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
        if (Math.abs(sim - 1) < this.epsilon) return 1;
        return Math.max(0, Math.min(1, sim));
    }

    similarity(docId1, docId2) {
        if (!this.documents.has(docId1) || !this.documents.has(docId2)) return 0;
        if (docId1 === docId2) return 1;
        if (this.documents.size < this.minDocuments) return 0;
        if (!this.V) this._performSVD();
        const idx1 = this.docs.findIndex(([id]) => id === docId1);
        const idx2 = this.docs.findIndex(([id]) => id === docId2);
        if (idx1 === -1 || idx2 === -1) return 0;
        return this._calculateCosineSimilarity(this.V[idx1], this.V[idx2]);
    }

    search(query, { limit = 10, threshold = 0.0 } = {}) {
        if (this.documents.size < this.minDocuments) return [];
        if (!this.V || !this.S || !this.U) this._performSVD();
        if (!this.S || this.S.length === 0) return [];

        const processedQuery = preprocessDocument(query, {
            ...this.options,
            removeStopWords: false
        });
        const queryTerms = new Set(Object.keys(processedQuery.termFreq));
        if (queryTerms.size === 0) return [];

        const queryVector = new Array(this.terms.length).fill(0);
        let hasMatchingTerms = false;
        for (let i = 0; i < this.terms.length; i++) {
            const term = this.terms[i];
            const tf = processedQuery.termFreq[term] || 0;
            if (tf > 0) {
                const df = this.docFreq.get(term) || 0;
                if (df > 0) {
                    hasMatchingTerms = true;
                    const idf = Math.log1p(this.docs.length / (df + 0.5));
                    const tfWeight = 1.0 + Math.log1p(tf);
                    queryVector[i] = tfWeight * idf;
                }
            }
        }
        if (!hasMatchingTerms) return [];

        const queryNorm = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0));
        if (queryNorm > this.epsilon) {
            for (let i = 0; i < queryVector.length; i++) {
                queryVector[i] /= queryNorm;
            }
        }

        const queryLSA = new Array(this.S.length).fill(0);
        for (let i = 0; i < this.S.length; i++) {
            for (let j = 0; j < this.terms.length; j++) {
                queryLSA[i] += queryVector[j] * this.U[j][i];
            }
        }

        const queryLSANorm = Math.sqrt(queryLSA.reduce((sum, val) => sum + val * val, 0));
        if (queryLSANorm > this.epsilon) {
            for (let i = 0; i < queryLSA.length; i++) {
                queryLSA[i] /= queryLSANorm;
            }
        }

        const results = [];
        for (let i = 0; i < this.docs.length; i++) {
            const similarity = this._calculateCosineSimilarity(queryLSA, this.V[i]);
            const doc = this.documents.get(this.docs[i][0]);
            const docTerms = new Set(Object.keys(doc.termFreq));
            const matchingTerms = Array.from(queryTerms).filter(term => docTerms.has(term));

            let semanticBoost = 1.0;
            if (matchingTerms.length > 0) {
                const termOverlapRatio = matchingTerms.length / queryTerms.size;
                const freqCorrelation = matchingTerms.reduce((sum, term) => {
                    const queryFreq = processedQuery.termFreq[term];
                    const docFreq = doc.termFreq[term];
                    return sum + Math.min(queryFreq, docFreq) / Math.max(queryFreq, docFreq);
                }, 0) / matchingTerms.length;
                const exactMatchBoost = matchingTerms.length === queryTerms.size ? 1.5 : 1.0;
                const overlapBoost = Math.pow(termOverlapRatio, 0.5);
                semanticBoost = (1.0 + 0.5 * (overlapBoost + freqCorrelation)) * exactMatchBoost;
            }

            const finalScore = similarity * semanticBoost;
            if (finalScore >= Math.max(0.01, threshold)) {
                results.push({ docId: this.docs[i][0], score: finalScore });
            }
        }

        return results.sort((a, b) => b.score - a.score).slice(0, limit);
    }
}
