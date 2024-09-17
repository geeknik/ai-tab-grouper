// Grouping related variables
let documents = [];
let tfidf = {};
let idf = {};
let vocabulary = new Set();
let bm25 = {};
let keyphrases = {};

// Settings
let settings = {
    similarityThreshold: 0.3,
    groupingInterval: 5,
    maxGroupNameLength: 15,
    groupingAlgorithm: 'tfidf', // 'tfidf', 'bm25', 'keyphrase', or 'hac'
    bm25k1: 1.5,
    bm25b: 0.75,
};

// Load settings
async function loadSettings() {
    const items = await chrome.storage.sync.get({
        similarityThreshold: 0.3,
        groupingInterval: 5,
        maxGroupNameLength: 15,
        groupingAlgorithm: 'tfidf',
        bm25k1: 1.5,
        bm25b: 0.75,
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
    return !tab.pinned && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://');
}

// Function to calculate TF-IDF incrementally
function updateTFIDF(newDocument, docId) {
    const terms = newDocument.split(/\W+/).filter(term => term.length > 2);
    const termFreq = {};
    const docLength = terms.length;
    terms.forEach(term => {
        term = term.toLowerCase();
        termFreq[term] = (termFreq[term] || 0) + 1;
        vocabulary.add(term);
    });
    
    // Calculate TF with length normalization
    Object.keys(termFreq).forEach(term => {
        termFreq[term] = termFreq[term] / docLength;
    });
    
    tfidf[docId] = termFreq;

    // Update IDF
    vocabulary.forEach(term => {
        const docCount = Object.values(tfidf).filter(doc => doc[term]).length;
        idf[term] = Math.log((Object.keys(tfidf).length + 1) / (docCount + 1)) + 1;
    });

    // Update TF-IDF scores
    Object.keys(tfidf).forEach(id => {
        Object.keys(tfidf[id]).forEach(term => {
            tfidf[id][term] *= idf[term];
        });
    });
}

// Function to calculate BM25 incrementally
function updateBM25(newDocument, docId) {
    const terms = newDocument.split(/\W+/);
    const termFreq = {};
    let docLength = 0;
    terms.forEach(term => {
        term = term.toLowerCase();
        termFreq[term] = (termFreq[term] || 0) + 1;
        docLength++;
        vocabulary.add(term);
    });
    bm25[docId] = { termFreq, docLength };

    // Update IDF (same as in TF-IDF)
    vocabulary.forEach(term => {
        const docCount = Object.values(bm25).filter(doc => doc.termFreq[term]).length;
        idf[term] = Math.log((Object.keys(bm25).length - docCount + 0.5) / (docCount + 0.5) + 1);
    });

    // Calculate average document length
    const avgDocLength = Object.values(bm25).reduce((sum, doc) => sum + doc.docLength, 0) / Object.keys(bm25).length;

    // Update BM25 scores with document length normalization
    Object.keys(bm25).forEach(id => {
        const doc = bm25[id];
        const normalizationFactor = 1 - settings.bm25b + settings.bm25b * (doc.docLength / avgDocLength);
        Object.keys(doc.termFreq).forEach(term => {
            const tf = doc.termFreq[term];
            const numerator = tf * (settings.bm25k1 + 1);
            const denominator = tf + settings.bm25k1 * normalizationFactor;
            bm25[id].termFreq[term] = idf[term] * (numerator / denominator);
        });
    });
}

// RAKE (Rapid Automatic Keyword Extraction) implementation
function extractKeyphrases(text, numPhrases = 5) {
    const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    const words = text.toLowerCase().split(/\W+/).filter(word => word.length > 1 && !stopWords.has(word));
    const phrases = [];
    let currentPhrase = [];

    words.forEach(word => {
        if (stopWords.has(word)) {
            if (currentPhrase.length > 0) {
                phrases.push(currentPhrase.join(' '));
                currentPhrase = [];
            }
        } else {
            currentPhrase.push(word);
        }
    });

    if (currentPhrase.length > 0) {
        phrases.push(currentPhrase.join(' '));
    }

    const wordScores = {};
    words.forEach(word => {
        wordScores[word] = (wordScores[word] || 0) + 1;
    });

    const phraseScores = phrases.map(phrase => {
        const words = phrase.split(' ');
        const score = words.reduce((sum, word) => sum + wordScores[word], 0) / words.length;
        return [phrase, score];
    });

    return phraseScores
        .sort((a, b) => b[1] - a[1])
        .slice(0, numPhrases)
        .map(entry => entry[0]);
}

// Function to update keyphrases
function updateKeyphrases(newDocument, docId) {
    keyphrases[docId] = extractKeyphrases(newDocument);
}

// Function to get cosine similarity between two documents
function cosineSimilarity(doc1, doc2) {
    const commonTerms = new Set([...Object.keys(doc1), ...Object.keys(doc2)]);
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    commonTerms.forEach(term => {
        const val1 = doc1[term] || 0;
        const val2 = doc2[term] || 0;
        dotProduct += val1 * val2;
        magnitude1 += val1 * val1;
        magnitude2 += val2 * val2;
    });

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

    sortedTabIds.forEach(tabId => {
        if (!assigned.has(tabId)) {
            const cluster = [tabId];
            assigned.add(tabId);

            sortedTabIds.forEach(otherTabId => {
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
            });

            if (cluster.length > 1) {
                clusters.push(cluster);
            }
        }
    });

    return clusters;
}

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
    const combinedTerms = clusterDocs.join(' ').toLowerCase().split(/\W+/);
    const termFreq = {};
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    combinedTerms.forEach(term => {
        if (term.length > 3 && !stopWords.has(term)) {
            termFreq[term] = (termFreq[term] || 0) + 1;
        }
    });
    
    const sortedTerms = Object.entries(termFreq)
        .sort((a, b) => b[1] - a[1])
        .filter(([term]) => !term.match(/^\d+$/)); // Remove purely numeric terms
    
    const topTerms = sortedTerms.slice(0, 3).map(([term]) => term);
    return topTerms.join('-').substring(0, settings.maxGroupNameLength);
}

// Function to extract features from a tab
async function extractTabFeatures(tab) {
    if (!isGroupableTab(tab)) {
        return null;
    }
    const url = new URL(tab.url);
    const domain = url.hostname;
    const path = url.pathname;
    return `${domain} ${path} ${tab.title}`;
}

// Function to group tabs
async function groupTabs() {
    try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const tabIds = [];

        for (const tab of tabs) {
            if (isGroupableTab(tab)) {
                try {
                    const features = await extractTabFeatures(tab);
                    if (features) {
                        if (settings.groupingAlgorithm === 'tfidf') {
                            updateTFIDF(features, tab.id.toString());
                        } else if (settings.groupingAlgorithm === 'bm25') {
                            updateBM25(features, tab.id.toString());
                        } else if (settings.groupingAlgorithm === 'keyphrase') {
                            updateKeyphrases(features, tab.id.toString());
                        }
                        tabIds.push(tab.id);
                    }
                } catch (error) {
                    console.error(`Error processing tab ${tab.id}:`, error);
                }
            }
        }

        const tabVectors = {};
        tabIds.forEach((tabId) => {
            try {
                if (settings.groupingAlgorithm === 'tfidf') {
                    tabVectors[tabId] = tfidf[tabId.toString()];
                } else if (settings.groupingAlgorithm === 'bm25') {
                    tabVectors[tabId] = bm25[tabId.toString()].termFreq;
                } else if (settings.groupingAlgorithm === 'keyphrase') {
                    tabVectors[tabId] = keyphrases[tabId.toString()];
                }
            } catch (error) {
                console.error(`Error creating vector for tab ${tabId}:`, error);
            }
        });

        const clusters = clusterTabs(tabVectors);

        // Group tabs based on clusters
        for (const cluster of clusters) {
            if (cluster.length > 1) {
                try {
                    const groupId = await chrome.tabs.group({ tabIds: cluster.map(Number) });
                    const groupName = generateGroupName(cluster.map(tabId => `${tabs.find(t => t.id === Number(tabId)).url} ${tabs.find(t => t.id === Number(tabId)).title}`));
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
            vocabulary: Array.from(vocabulary)
        });
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

// Function to load the saved state
async function loadState() {
    try {
        const state = await chrome.storage.local.get(['tfidf', 'bm25', 'keyphrases', 'idf', 'vocabulary']);
        if (state.tfidf) tfidf = state.tfidf;
        if (state.bm25) bm25 = state.bm25;
        if (state.keyphrases) keyphrases = state.keyphrases;
        if (state.idf) idf = state.idf;
        if (state.vocabulary) vocabulary = new Set(state.vocabulary);
    } catch (error) {
        console.error('Error loading state:', error);
    }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && isGroupableTab(tab)) {
        const features = `${tab.url} ${tab.title}`;
        if (settings.groupingAlgorithm === 'tfidf') {
            updateTFIDF(features, tabId.toString());
        } else if (settings.groupingAlgorithm === 'bm25') {
            updateBM25(features, tabId.toString());
        } else if (settings.groupingAlgorithm === 'keyphrase') {
            updateKeyphrases(features, tabId.toString());
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

// Run initialization when the extension is installed or updated
chrome.runtime.onInstalled.addListener(initialize);
