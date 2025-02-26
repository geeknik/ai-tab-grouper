// Import quantum chaos organizer module
import { groupTabsQuantumChaosOrganizer } from './src/quantumChaosOrganizer.js';

// Grouping related variables
let documents = [];
let tfidf = {};
let idf = {};
let vocabulary = new Set();
let bm25 = {};
let keyphrases = {};
let lsaVectors = {};
let lsaTermMatrix = [];
let lsaTerms = [];

// Settings
let settings = {
    similarityThreshold: 0.3,
    groupingInterval: 5,
    maxGroupNameLength: 15,
    groupingAlgorithm: 'tfidf', // 'tfidf', 'bm25', 'keyphrase', 'hac', or 'lsa'
    bm25k1: 1.5,
    bm25b: 0.75,
    lsaDimensions: 50, // Number of dimensions to use for LSA
};

// Load settings
export async function loadSettings() {
    const items = await chrome.storage.sync.get({
        similarityThreshold: 0.3,
        groupingInterval: 5,
        maxGroupNameLength: 15,
        groupingAlgorithm: 'tfidf',
        bm25k1: 1.5,
        bm25b: 0.75,
        lsaDimensions: 50,
    });
    settings = items;
    resetAlarm();
}

// Reset alarm for automatic grouping
function resetAlarm() {
    chrome.alarms.clear('groupTabs', () => {
        chrome.alarms.create('groupTabs', { periodInMinutes: settings.groupingInterval });
    });
}

// Function to check if a tab should be considered for grouping
function isGroupableTab(tab) {
    // First and foremost, always ignore pinned tabs
    if (tab.pinned) {
        return false;
    }
    
    // Ignore browser-specific pages and extension pages
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('brave://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('opera://')) {
        return false;
    }
    
    // Ignore empty tabs or tabs with invalid URLs
    if (!tab.url || tab.url === '' || tab.url === 'about:blank') {
        return false;
    }
    
    return true;
}

// Function to calculate TF-IDF incrementally
function updateTFIDF(newDocument, docId) {
    // Tokenize the document with improved preprocessing
    const terms = newDocument.toLowerCase()
        .split(/\W+/)
        .filter(term => term.length > 2 && !isStopWord(term));
    
    const termFreq = {};
    const docLength = terms.length;
    
    // Skip processing if document is too short
    if (docLength < 3) {
        console.log(`Document ${docId} is too short for meaningful TF-IDF analysis`);
        tfidf[docId] = {};
        return;
    }
    
    // Calculate term frequencies
    terms.forEach(term => {
        termFreq[term] = (termFreq[term] || 0) + 1;
        vocabulary.add(term);
    });

    // Calculate TF with length normalization and log scaling for better weighting
    Object.keys(termFreq).forEach(term => {
        // Log normalization: 1 + log(tf) to reduce the effect of high-frequency terms
        termFreq[term] = 1 + Math.log(termFreq[term]);
    });

    tfidf[docId] = termFreq;

    // Update IDF with smoothing to handle rare terms better
    vocabulary.forEach(term => {
        const docCount = Object.values(tfidf).filter(doc => doc[term]).length;
        // Smoothed IDF formula with log base 10 for more intuitive scaling
        idf[term] = Math.log10((Object.keys(tfidf).length + 1) / (docCount + 0.5)) + 1;
    });

    // Update TF-IDF scores
    Object.keys(tfidf).forEach(id => {
        Object.keys(tfidf[id]).forEach(term => {
            tfidf[id][term] *= idf[term];
        });
    });
}

// Helper function to check if a word is a stop word
function isStopWord(word) {
    const stopWords = new Set([
        'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'is', 'this', 'about', 'that', 'and', 'or', 'but', 'from', 'as', 'it',
        'are', 'was', 'be', 'being', 'been', 'has', 'have', 'had', 'do', 'does', 'did',
        'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can',
        'you', 'your', 'yours', 'we', 'our', 'ours', 'they', 'their', 'theirs',
        'he', 'his', 'him', 'she', 'her', 'hers', 'its', 'my', 'mine', 'i', 'me',
        'who', 'whom', 'whose', 'which', 'what', 'where', 'when', 'why', 'how'
    ]);
    return stopWords.has(word);
}

// Function to calculate BM25 incrementally
function updateBM25(newDocument, docId) {
    // Tokenize with improved preprocessing
    const terms = newDocument.toLowerCase()
        .split(/\W+/)
        .filter(term => term.length > 2 && !isStopWord(term));
    
    const termFreq = {};
    let docLength = terms.length;
    
    // Skip processing if document is too short
    if (docLength < 3) {
        console.log(`Document ${docId} is too short for meaningful BM25 analysis`);
        bm25[docId] = { termFreq: {}, docLength: 0 };
        return;
    }
    
    // Calculate term frequencies
    terms.forEach(term => {
        termFreq[term] = (termFreq[term] || 0) + 1;
        vocabulary.add(term);
    });
    
    bm25[docId] = { termFreq, docLength };

    // Update IDF with BM25-specific formula
    vocabulary.forEach(term => {
        // Number of documents containing this term
        const docCount = Object.values(bm25).filter(doc => doc.termFreq[term]).length;
        // BM25 specific IDF formula with smoothing
        idf[term] = Math.log((Object.keys(bm25).length - docCount + 0.5) / (docCount + 0.5) + 1);
    });

    // Calculate average document length - important for BM25's length normalization
    const totalDocs = Object.keys(bm25).length;
    const totalLength = Object.values(bm25).reduce((sum, doc) => sum + doc.docLength, 0);
    const avgDocLength = totalLength / totalDocs;

    // Update BM25 scores with document length normalization
    Object.keys(bm25).forEach(id => {
        const doc = bm25[id];
        // Skip empty documents
        if (doc.docLength === 0) return;
        
        // BM25 normalization factor based on document length
        const normalizationFactor = 1 - settings.bm25b + settings.bm25b * (doc.docLength / avgDocLength);
        
        Object.keys(doc.termFreq).forEach(term => {
            const tf = doc.termFreq[term];
            // BM25 term frequency saturation formula
            const numerator = tf * (settings.bm25k1 + 1);
            const denominator = tf + settings.bm25k1 * normalizationFactor;
            // Final BM25 score for this term in this document
            bm25[id].termFreq[term] = idf[term] * (numerator / denominator);
        });
    });
}

// Enhanced RAKE (Rapid Automatic Keyword Extraction) implementation
function extractKeyphrases(text, numPhrases = 5) {
    // Skip processing if text is too short
    if (!text || text.length < 20) {
        console.log("Text too short for meaningful keyphrase extraction");
        return [];
    }

    // Split text into words while preserving multi-word phrases
    const words = text.toLowerCase().split(/\s+/);
    const phrases = [];
    
    // Extract multi-word phrases
    for (let i = 0; i < words.length - 1; i++) {
        let phrase = words[i];
        if (phrase.length < 2) continue;
        
        let phraseWords = [phrase];
        for (let j = i + 1; j < words.length && j < i + 3; j++) {
            phrase += ' ' + words[j];
            if (phrase.length > 2) {
                phraseWords.push(words[j]);
                phrases.push(phraseWords.join(' '));
            }
        }
    }
    
    // Filter and sort phrases
    const filteredPhrases = phrases
        .filter(phrase => phrase.length >= 3)
        .filter(phrase => !isStopPhrase(phrase));
    
    // Return unique phrases
    return Array.from(new Set(filteredPhrases))
        .slice(0, numPhrases);
}

function isStopPhrase(phrase) {
    const stopWords = new Set([
        'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'is', 'this', 'about', 'that', 'and', 'or', 'but', 'from', 'as', 'it'
    ]);
    
    const words = phrase.split(' ');
    return words.every(word => stopWords.has(word));
}

// Function to update keyphrases
function updateKeyphrases(newDocument, docId) {
    keyphrases[docId] = extractKeyphrases(newDocument);
}

// Function to get cosine similarity between two documents
function cosineSimilarity(doc1, doc2) {
    const terms = new Set([...Object.keys(doc1), ...Object.keys(doc2)]);
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const term of terms) {
        const val1 = doc1[term] || 0;
        const val2 = doc2[term] || 0;
        dotProduct += val1 * val2;
        magnitude1 += val1 * val1;
        magnitude2 += val2 * val2;
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    return dotProduct / (magnitude1 * magnitude2);
}

// Function to get Jaccard similarity between two sets of keyphrases
function jaccardSimilarity(set1, set2) {
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
}

// Function to cluster tabs based on the chosen algorithm
function clusterTabs(tabVectors) {
    if (settings.groupingAlgorithm === 'hac') {
        return hierarchicalAgglomerativeClustering(tabVectors);
    }

    const clusters = [];
    const assigned = new Set();

    const sortedTabIds = Object.keys(tabVectors).sort((a, b) => {
        const sumA = Object.values(tabVectors[a]).reduce((sum, val) => sum + val, 0);
        const sumB = Object.values(tabVectors[b]).reduce((sum, val) => sum + val, 0);
        return sumB - sumA;
    });

    for (const tabId of sortedTabIds) {
        if (!assigned.has(tabId)) {
            const cluster = [tabId];
            assigned.add(tabId);

            for (const otherTabId of sortedTabIds) {
                if (tabId !== otherTabId && !assigned.has(otherTabId)) {
                    let similarity;
                    if (settings.groupingAlgorithm === 'keyphrase') {
                        similarity = jaccardSimilarity(new Set(tabVectors[tabId]), new Set(tabVectors[otherTabId]));
                    } else {
                        similarity = cosineSimilarity(tabVectors[tabId], tabVectors[otherTabId]);
                    }
                    if (similarity > settings.similarityThreshold) {
                        cluster.push(otherTabId);
                        assigned.add(otherTabId);
                    }
                }
            }

            if (cluster.length > 1) {
                clusters.push(cluster);
            }
        }
    }

    return clusters;
}

// Memoized cosine similarity function
const memoizedCosineSimilarity = (() => {
    const cache = new Map();
    return (doc1, doc2) => {
        const key = `${doc1.id}-${doc2.id}`;
        if (cache.has(key)) {
            return cache.get(key);
        }
        const similarity = cosineSimilarity(doc1, doc2);
        cache.set(key, similarity);
        return similarity;
    };
})();

// Hierarchical Agglomerative Clustering (HAC) implementation
function hierarchicalAgglomerativeClustering(tabVectors) {
    const tabIds = Object.keys(tabVectors);
    let clusters = tabIds.map(id => [id]);

    while (clusters.length > 1) {
        let maxSimilarity = -1;
        let mergeIndices = [-1, -1];

        for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                const similarity = clusterSimilarity(clusters[i], clusters[j], tabVectors);
                if (similarity > maxSimilarity) {
                    maxSimilarity = similarity;
                    mergeIndices = [i, j];
                }
            }
        }

        if (maxSimilarity < settings.similarityThreshold) {
            break;
        }

        const [i, j] = mergeIndices;
        clusters[i] = clusters[i].concat(clusters[j]);
        clusters.splice(j, 1);
    }

    return clusters.filter(cluster => cluster.length > 1);
}

function clusterSimilarity(cluster1, cluster2, tabVectors) {
    let totalSimilarity = 0;
    let comparisons = 0;

    for (const id1 of cluster1) {
        for (const id2 of cluster2) {
            totalSimilarity += cosineSimilarity(tabVectors[id1], tabVectors[id2]);
            comparisons++;
        }
    }

    return totalSimilarity / comparisons;
}

// Function to generate a group name based on common terms
function generateGroupName(clusterDocs) {
    // Skip if no documents are provided
    if (!clusterDocs || clusterDocs.length === 0) {
        return "Group";
    }
    
    // Ensure maxLength is a valid number and at least 1
    const maxLength = Math.max(1, (global.settings && typeof global.settings.maxGroupNameLength === 'number') 
        ? global.settings.maxGroupNameLength 
        : (settings && typeof settings.maxGroupNameLength === 'number')
            ? settings.maxGroupNameLength
            : 15);
    
    // Extract domain names for potential use in group naming
    const domains = [];
    const urlRegex = /https?:\/\/([^\/]+)/i;
    
    for (const doc of clusterDocs) {
        const match = doc.match(urlRegex);
        if (match && match[1]) {
            // Extract domain without www. and .com/.org/etc.
            let domain = match[1].replace(/^www\./, '').split('.')[0];
            if (domain && domain.length > 2) {
                domains.push(domain);
            }
        }
    }
    
    // Process all terms from the documents
    const combinedTerms = clusterDocs.join(' ')
        .toLowerCase()
        .replace(/[^\w\s-]/g, ' ')
        .split(/\s+/)
        .filter(term => term.length > 2);
    
    // Count term frequencies
    const termFreq = {};
    combinedTerms.forEach(term => {
        termFreq[term] = (termFreq[term] || 0) + 1;
    });
    
    // Sort terms by frequency
    const sortedTerms = Object.entries(termFreq)
        .sort((a, b) => b[1] - a[1])
        .map(([term]) => term)
        .filter(term => !term.match(/^\d+$/));
    
    // Count domain frequencies
    const domainFreq = {};
    domains.forEach(domain => {
        domainFreq[domain] = (domainFreq[domain] || 0) + 1;
    });
    
    // Get most common domain
    const commonDomain = Object.entries(domainFreq)
        .sort((a, b) => b[1] - a[1])
        .map(([domain]) => domain)[0];
    
    // Generate name
    let name = "Group";
    
    if (commonDomain) {
        name = commonDomain.charAt(0).toUpperCase() + commonDomain.slice(1);
    } else if (sortedTerms.length > 0) {
        name = sortedTerms[0].charAt(0).toUpperCase() + sortedTerms[0].slice(1);
    }
    
    // Strictly enforce maxLength
    return name.slice(0, maxLength);
}

// Function to extract features from a tab
async function extractTabFeatures(tab) {
    if (!isGroupableTab(tab)) {
        return null;
    }
    try {
        const url = new URL(tab.url);
        const domain = url.hostname;
        const path = url.pathname;
        const queryParams = url.searchParams.toString();
        const cleanTitle = tab.title.replace(/[^\w\s-]/g, ''); // Remove special characters from title
        return `${domain} ${path} ${queryParams} ${cleanTitle}`.toLowerCase();
    } catch (error) {
        console.error(`Error extracting features from tab ${tab.id}:`, error);
        return null;
    }
}

// Function to group tabs
async function groupTabs() {
    try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        let clusters = [];

        // Handle QCO algorithm separately as it doesn't use tabVectors
        if (settings.groupingAlgorithm === 'qco') {
            // Filter out pinned tabs and non-groupable tabs before passing to QCO
            const groupableTabs = tabs.filter(tab => !tab.pinned && isGroupableTab(tab));
            
            if (groupableTabs.length === 0) {
                console.log('No groupable tabs found');
                return;
            }

            try {
                // Call QCO algorithm with filtered tabs
                const qcoGroups = await Promise.resolve(groupTabsQuantumChaosOrganizer(groupableTabs));
                
                if (qcoGroups && Array.isArray(qcoGroups) && qcoGroups.length > 0) {
                    // Extract tab IDs from the groups
                    clusters = qcoGroups
                        .filter(group => Array.isArray(group) && group.length > 1)
                        .map(group => group.map(tab => tab.id));
                }
            } catch (error) {
                console.error('Error in groupTabs: QCO algorithm failed', error);
                return;
            }
        } else {
            // Handle other algorithms that use tabVectors
            const tabIds = [];
            const tabVectors = {};

            for (const tab of tabs) {
                if (isGroupableTab(tab)) {
                    try {
                        const features = await extractTabFeatures(tab);
                        if (features) {
                            const tabId = tab.id.toString();
                            switch (settings.groupingAlgorithm) {
                                case 'tfidf':
                                    updateTFIDF(features, tabId);
                                    tabVectors[tabId] = tfidf[tabId];
                                    break;
                                case 'bm25':
                                    updateBM25(features, tabId);
                                    tabVectors[tabId] = bm25[tabId].termFreq;
                                    break;
                                case 'keyphrase':
                                    updateKeyphrases(features, tabId);
                                    tabVectors[tabId] = keyphrases[tabId];
                                    break;
                                case 'lsa':
                                    updateLSA(features, tabId);
                                    tabVectors[tabId] = lsaVectors[tabId];
                                    break;
                                default:
                                    throw new Error(`Unknown grouping algorithm: ${settings.groupingAlgorithm}`);
                            }
                            tabIds.push(tab.id);
                        }
                    } catch (error) {
                        console.error(`Error processing tab ${tab.id}:`, error);
                    }
                }
            }

            clusters = clusterTabs(tabVectors);
        }

        // Group tabs based on clusters
        for (const cluster of clusters) {
            if (cluster.length > 1) {
                try {
                    const groupId = await chrome.tabs.group({ tabIds: cluster });
                    const groupName = generateGroupName(cluster.map(tabId => {
                        const tab = tabs.find(t => t.id === tabId);
                        return tab ? `${tab.url} ${tab.title}` : '';
                    }).filter(Boolean));
                    await chrome.tabGroups.update(groupId, { title: groupName });
                } catch (error) {
                    console.error('Error creating or updating tab group:', error);
                }
            }
        }

        // Save the current state
        await saveState();
    } catch (error) {
        console.error('Error in groupTabs:', error);
    }
}

// Function to save the current state
async function saveState() {
    try {
        await chrome.storage.local.set({
            tfidf: tfidf,
            bm25: bm25,
            keyphrases: keyphrases,
            idf: idf,
            vocabulary: Array.from(vocabulary),
            lsaVectors: lsaVectors,
            lsaTermMatrix: lsaTermMatrix,
            lsaTerms: lsaTerms
        });
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

// Function to load the saved state
async function loadState() {
    try {
        const state = await chrome.storage.local.get(['tfidf', 'bm25', 'keyphrases', 'idf', 'vocabulary', 'lsaVectors', 'lsaTermMatrix', 'lsaTerms']);
        if (state.tfidf) tfidf = state.tfidf;
        if (state.bm25) bm25 = state.bm25;
        if (state.keyphrases) keyphrases = state.keyphrases;
        if (state.idf) idf = state.idf;
        if (state.vocabulary) vocabulary = new Set(state.vocabulary);
        if (state.lsaVectors) lsaVectors = state.lsaVectors;
        if (state.lsaTermMatrix) lsaTermMatrix = state.lsaTermMatrix;
        if (state.lsaTerms) lsaTerms = state.lsaTerms;
    } catch (error) {
        console.error('Error loading state:', error);
    }
}

// Listen for tab updates
if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && isGroupableTab(tab)) {
            const features = `${tab.url} ${tab.title}`;
            if (settings.groupingAlgorithm === 'tfidf') {
                updateTFIDF(features, tabId.toString());
            } else if (settings.groupingAlgorithm === 'bm25') {
                updateBM25(features, tabId.toString());
            } else if (settings.groupingAlgorithm === 'keyphrase') {
                updateKeyphrases(features, tabId.toString());
            } else if (settings.groupingAlgorithm === 'lsa') {
                updateLSA(features, tabId.toString());
            } else if (settings.groupingAlgorithm === 'qco') {
                // Quantum Chaos Organizer handling - no additional feature update needed
            }
            groupTabs();
        }
    });

    // Listen for tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
        delete tfidf[tabId.toString()];
        delete bm25[tabId.toString()];
        delete keyphrases[tabId.toString()];
        groupTabs();
    });

    // Listen for alarms
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'groupTabs') {
            groupTabs();
        }
    });

    // Listen for settings updates
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateSettings') {
            loadSettings();
        } else if (request.action === 'groupTabs') {
            groupTabs();
        }
    });

    // Run initialization when the extension is installed or updated
    chrome.runtime.onInstalled.addListener(initialize);
}

// Initial setup
async function initialize() {
    try {
        await loadSettings();
        await loadState();
        await groupTabs();
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// Export functions for testing
export {
  cosineSimilarity,
  jaccardSimilarity,
  generateGroupName,
  extractKeyphrases,
  groupTabs,
  isGroupableTab  // Add this for testing
};

// Latent Semantic Analysis (LSA) implementation
function updateLSA(newDocument, docId) {
    // Skip processing if document is too short
    if (!newDocument || newDocument.length < 20) {
        console.log(`Document ${docId} is too short for meaningful LSA analysis`);
        lsaVectors[docId] = {};
        return;
    }

    // Tokenize and preprocess the document
    const terms = newDocument.toLowerCase()
        .split(/\W+/)
        .filter(term => term.length > 2 && !isStopWord(term));
    
    // Add terms to global vocabulary
    terms.forEach(term => vocabulary.add(term));
    
    // Create a document-term frequency map
    const termFreq = {};
    terms.forEach(term => {
        termFreq[term] = (termFreq[term] || 0) + 1;
    });
    
    // Store the document vector
    documents[docId] = termFreq;
    
    // Only perform SVD when we have enough documents
    if (Object.keys(documents).length >= 2) {
        performLSA();
    } else {
        // For the first document, just use TF-IDF as a fallback
        updateTFIDF(newDocument, docId);
        lsaVectors[docId] = tfidf[docId];
    }
}

// Function to perform Latent Semantic Analysis using Singular Value Decomposition
function performLSA() {
    try {
        // Create the term list from vocabulary
        lsaTerms = Array.from(vocabulary);
        
        // Create the document-term matrix
        const docIds = Object.keys(documents);
        const termMatrix = [];
        
        // Fill the matrix with term frequencies
        for (const docId of docIds) {
            const docVector = Array(lsaTerms.length).fill(0);
            
            for (let i = 0; i < lsaTerms.length; i++) {
                const term = lsaTerms[i];
                docVector[i] = documents[docId][term] || 0;
            }
            
            // Apply TF-IDF weighting to the term frequencies
            for (let i = 0; i < lsaTerms.length; i++) {
                const term = lsaTerms[i];
                const tf = docVector[i];
                if (tf > 0) {
                    // Calculate IDF
                    const docCount = docIds.filter(id => documents[id][term]).length;
                    const idfValue = Math.log((docIds.length + 1) / (docCount + 0.5)) + 1;
                    // Apply TF-IDF weighting
                    docVector[i] = tf * idfValue;
                }
            }
            
            termMatrix.push(docVector);
        }
        
        // Perform Singular Value Decomposition (SVD)
        const { u, s, v } = performSVD(termMatrix, settings.lsaDimensions);
        
        // Create the reduced-dimension document vectors
        for (let i = 0; i < docIds.length; i++) {
            const docId = docIds[i];
            const reducedVector = {};
            
            // Use the left singular vectors as the LSA vectors
            for (let j = 0; j < settings.lsaDimensions; j++) {
                reducedVector[`dim_${j}`] = u[i][j] * s[j];
            }
            
            lsaVectors[docId] = reducedVector;
        }
        
        // Store the term matrix for future use
        lsaTermMatrix = v;
        
    } catch (error) {
        console.error('Error performing LSA:', error);
    }
}

// Function to perform Singular Value Decomposition (SVD)
function performSVD(matrix, k) {
    // This is a simplified SVD implementation
    // In a production environment, you would use a library like numeric.js or math.js
    
    // For simplicity, we'll use a basic implementation that works for small matrices
    
    // Step 1: Calculate the covariance matrix (A^T * A)
    const covMatrix = calculateCovarianceMatrix(matrix);
    
    // Step 2: Calculate eigenvalues and eigenvectors of the covariance matrix
    const { eigenvalues, eigenvectors } = calculateEigenvectors(covMatrix, k);
    
    // Step 3: Sort eigenvalues and eigenvectors
    const indices = eigenvalues.map((val, idx) => idx)
        .sort((a, b) => eigenvalues[b] - eigenvalues[a]);
    
    const sortedEigenvalues = indices.map(i => eigenvalues[i]);
    const sortedEigenvectors = indices.map(i => eigenvectors[i]);
    
    // Step 4: Take the top k eigenvalues and eigenvectors
    const topK = Math.min(k, sortedEigenvalues.length);
    const s = sortedEigenvalues.slice(0, topK);
    const v = sortedEigenvectors.slice(0, topK);
    
    // Step 5: Calculate the left singular vectors (U = A * V * S^-1)
    const u = calculateLeftSingularVectors(matrix, v, s);
    
    return { u, s, v };
}

// Helper function to calculate the covariance matrix
function calculateCovarianceMatrix(matrix) {
    const numRows = matrix.length;
    const numCols = matrix[0].length;
    const result = Array(numCols).fill().map(() => Array(numCols).fill(0));
    
    for (let i = 0; i < numCols; i++) {
        for (let j = 0; j < numCols; j++) {
            let sum = 0;
            for (let k = 0; k < numRows; k++) {
                sum += matrix[k][i] * matrix[k][j];
            }
            result[i][j] = sum;
        }
    }
    
    return result;
}

// Helper function to calculate eigenvalues and eigenvectors
function calculateEigenvectors(matrix, k) {
    // This is a simplified implementation using power iteration
    // In a real application, you would use a more robust method
    
    const n = matrix.length;
    const eigenvalues = [];
    const eigenvectors = [];
    
    // Use power iteration to find the top k eigenvalues and eigenvectors
    for (let i = 0; i < k && i < n; i++) {
        // Initialize a random vector
        let vector = Array(n).fill().map(() => Math.random());
        
        // Normalize the vector
        vector = normalizeVector(vector);
        
        // Perform power iteration
        for (let iter = 0; iter < 100; iter++) {
            // Multiply matrix by vector
            const newVector = multiplyMatrixVector(matrix, vector);
            
            // Normalize the result
            const normalizedVector = normalizeVector(newVector);
            
            // Check for convergence
            if (vectorDistance(vector, normalizedVector) < 1e-10) {
                break;
            }
            
            vector = normalizedVector;
        }
        
        // Calculate the eigenvalue (Rayleigh quotient)
        const eigenvalue = calculateRayleighQuotient(matrix, vector);
        
        // Store the eigenvalue and eigenvector
        eigenvalues.push(eigenvalue);
        eigenvectors.push(vector);
        
        // Deflate the matrix to find the next eigenvalue
        deflateMatrix(matrix, vector, eigenvalue);
    }
    
    return { eigenvalues, eigenvectors };
}

// Helper function to normalize a vector
function normalizeVector(vector) {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / (norm || 1));
}

// Helper function to calculate the distance between two vectors
function vectorDistance(v1, v2) {
    let sum = 0;
    for (let i = 0; i < v1.length; i++) {
        sum += (v1[i] - v2[i]) * (v1[i] - v2[i]);
    }
    return Math.sqrt(sum);
}

// Helper function to multiply a matrix by a vector
function multiplyMatrixVector(matrix, vector) {
    const result = Array(matrix.length).fill(0);
    
    for (let i = 0; i < matrix.length; i++) {
        for (let j = 0; j < vector.length; j++) {
            result[i] += matrix[i][j] * vector[j];
        }
    }
    
    return result;
}

// Helper function to calculate the Rayleigh quotient
function calculateRayleighQuotient(matrix, vector) {
    const Av = multiplyMatrixVector(matrix, vector);
    const vAv = vector.reduce((sum, val, i) => sum + val * Av[i], 0);
    const vv = vector.reduce((sum, val) => sum + val * val, 0);
    
    return vAv / vv;
}

// Helper function to deflate a matrix
function deflateMatrix(matrix, vector, eigenvalue) {
    const n = matrix.length;
    
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            matrix[i][j] -= eigenvalue * vector[i] * vector[j];
        }
    }
}

// Helper function to calculate the left singular vectors
function calculateLeftSingularVectors(matrix, v, s) {
    const numRows = matrix.length;
    const numCols = v.length;
    const u = Array(numRows).fill().map(() => Array(numCols).fill(0));
    
    for (let i = 0; i < numRows; i++) {
        for (let j = 0; j < numCols; j++) {
            let sum = 0;
            for (let k = 0; k < matrix[0].length; k++) {
                sum += matrix[i][k] * v[j][k];
            }
            u[i][j] = sum / (s[j] || 1);
        }
    }
    
    return u;
}
