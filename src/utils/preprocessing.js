/**
 * Text preprocessing utilities for document analysis algorithms
 */

// Common English stop words
export const STOP_WORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any',
    'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between',
    'both', 'but', 'by', 'can', 'did', 'do', 'does', 'doing', 'down', 'during', 'each',
    'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here',
    'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
    'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now',
    'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out',
    'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the',
    'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
    'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
    'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'you',
    'your', 'yours', 'yourself', 'yourselves'
]);

// Web-specific stop words
export const WEB_STOP_WORDS = new Set([
    'http', 'https', 'www', 'com', 'net', 'org', 'html', 'htm', 'php', 'asp', 'jsp',
    'cgi', 'page', 'site', 'web', 'click', 'view', 'privacy', 'policy', 'terms',
    'conditions', 'cookie', 'cookies', 'website'
]);

/**
 * Tokenizes text into words, applying various preprocessing steps
 * @param {string} text - Input text to tokenize
 * @param {Object} options - Tokenization options
 * @param {boolean} options.removeStopWords - Whether to remove stop words
 * @param {boolean} options.removeWebStopWords - Whether to remove web-specific stop words
 * @param {number} options.minWordLength - Minimum word length to keep
 * @param {boolean} options.toLowerCase - Whether to convert to lowercase
 * @returns {string[]} Array of tokenized words
 */
export function tokenize(text, {
    removeStopWords = true,
    removeWebStopWords = true,
    minWordLength = 1,
    toLowerCase = true
} = {}) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    // Convert to lowercase if specified
    let processedText = toLowerCase ? text.toLowerCase() : text;

    // Split on word boundaries and non-word characters
    let words = processedText.match(/\b\w+\b/g) || [];

    // Apply filters
    return words.filter(word => {
        // Check minimum length
        if (word.length < minWordLength) {
            return false;
        }

        // Check stop words if enabled
        if (removeStopWords && STOP_WORDS.has(word)) {
            return false;
        }

        // Check web stop words if enabled
        if (removeWebStopWords && WEB_STOP_WORDS.has(word)) {
            return false;
        }

        return true;
    });
}

/**
 * Generates n-grams from a list of tokens
 * @param {string[]} tokens - Array of tokens
 * @param {number} n - Size of n-grams to generate
 * @returns {string[]} Array of n-grams
 */
export function generateNGrams(tokens, n) {
    if (!Array.isArray(tokens) || n < 1 || n > tokens.length) {
        return [];
    }

    const ngrams = [];
    for (let i = 0; i <= tokens.length - n; i++) {
        ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
}

/**
 * Calculates term frequency for a document
 * @param {string[]} tokens - Array of tokens from the document
 * @returns {Object.<string, number>} Map of term frequencies
 */
export function calculateTermFrequency(tokens) {
    return tokens.reduce((freq, token) => {
        freq[token] = (freq[token] || 0) + 1;
        return freq;
    }, {});
}

/**
 * Normalizes a vector of term frequencies
 * @param {Object.<string, number>} termFreq - Term frequency map
 * @param {string} method - Normalization method ('none' | 'l1' | 'l2' | 'max')
 * @returns {Object.<string, number>} Normalized term frequencies
 */
export function normalizeVector(termFreq, method = 'l2') {
    const terms = Object.keys(termFreq);
    if (terms.length === 0) return {};

    let normalizer;
    switch (method) {
        case 'l1':
            normalizer = Math.abs(Object.values(termFreq).reduce((sum, val) => sum + val, 0));
            break;
        case 'l2':
            normalizer = Math.sqrt(Object.values(termFreq).reduce((sum, val) => sum + val * val, 0));
            break;
        case 'max':
            normalizer = Math.max(...Object.values(termFreq));
            break;
        case 'none':
        default:
            return { ...termFreq };
    }

    // Return zero vector if normalizer is too small
    if (normalizer < 1e-10) {
        return terms.reduce((zeroVec, term) => {
            zeroVec[term] = 0;
            return zeroVec;
        }, {});
    }

    return terms.reduce((normalized, term) => {
        normalized[term] = termFreq[term] / normalizer;
        return normalized;
    }, {});
}

/**
 * Preprocesses a document for analysis
 * @param {string} text - Input document text
 * @param {Object} options - Preprocessing options
 * @returns {Object} Processed document data
 */
export function preprocessDocument(text, options = {}) {
    const tokens = tokenize(text, options);
    
    // Handle empty documents after filtering
    if (tokens.length === 0) {
        return {
            tokens: [],
            termFreq: {},
            normalizedFreq: {},
            uniqueTerms: new Set(),
            length: 0
        };
    }

    const termFreq = calculateTermFrequency(tokens);
    const normalizedFreq = normalizeVector(termFreq, options.normalization);
    const uniqueTerms = new Set(tokens);

    return {
        tokens,
        termFreq,
        normalizedFreq,
        uniqueTerms,
        length: tokens.length
    };
} 