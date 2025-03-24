// Import quantum chaos organizer module
let groupTabsQuantumChaosOrganizer = function(tabs) {
  console.log('🧪 Using inline QCO implementation');
  
  if (!tabs || !Array.isArray(tabs) || tabs.length === 0) {
    console.warn('⚠️ QCO received invalid or empty tabs array');
    return [];
  }

  // Filter out any pinned tabs
  const unpinnedTabs = tabs.filter(tab => !tab.pinned);
  console.log('📑 QCO processing', unpinnedTabs.length, 'unpinned tabs');
  
  if (unpinnedTabs.length < 3) {
    console.log('📊 Not enough tabs for QCO to form meaningful groups');
    return [];
  }

  try {
    // Simple implementation that groups tabs in batches of 3-4
    const groups = [];
    const groupSize = 3;
    
    // Create group batches
    for (let i = 0; i < unpinnedTabs.length; i += groupSize) {
      const group = unpinnedTabs.slice(i, i + groupSize);
      if (group.length >= 2) {
        groups.push(group);
      }
    }
    
    console.log(`🧩 QCO: Created ${groups.length} groups`);
    return groups;
  } catch (error) {
    console.error('❌ QCO algorithm error:', error);
    return [];
  }
};

// Log extension startup
console.log('🚀 AI Tab Grouper extension starting up');

// Check if APIs are available
if (!chrome.tabs) {
  console.error('❌ Chrome Tabs API not available!');
}

if (!chrome.tabGroups) {
  console.error('❌ Chrome Tab Groups API not available!');
}

if (!chrome.storage) {
  console.error('❌ Chrome Storage API not available!');
}

if (!chrome.alarms) {
  console.error('❌ Chrome Alarms API not available!');
}

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
// Add tab interaction history tracking
let tabInteractionHistory = {};
let tabContentCache = {};
// Topic modeling variables
let topicModels = {};
let globalTopics = [];
let documentTopics = {};

// Settings
let settings = {
    similarityThreshold: 0.3,
    groupingInterval: 5,
    maxGroupNameLength: 15,
    groupingAlgorithm: 'tfidf', // 'tfidf', 'bm25', 'keyphrase', 'hac', 'lsa', 'qco', or 'topic'
    bm25k1: 1.5,
    bm25b: 0.75,
    lsaDimensions: 50, // Number of dimensions to use for LSA
    useHistoricalData: true, // Whether to use historical data for grouping
    historicalWeight: 1.2, // Weight to apply to historical patterns
    contentCacheExpiry: 1440, // Content cache expiry in minutes (24 hours)
    adaptiveThreshold: true, // Whether to dynamically adjust similarity threshold
    minThreshold: 0.2, // Minimum similarity threshold
    maxThreshold: 0.7, // Maximum similarity threshold
    thresholdAdjustmentRate: 0.05, // How quickly to adjust the threshold
    targetGroupSize: 4, // Ideal average group size for auto-adjustment
    topicCount: 10, // Number of topics for topic modeling
    topicModelingIterations: 10, // Number of iterations for topic modeling
};

// Main initialization function
async function initializeExtension() {
  console.log('🔄 Initializing extension...');
  
  try {
    // Load settings first
    await loadSettings();
    
    // Load saved state
    await loadState();
    
    // Set up alarms for periodic grouping
    resetAlarm();
    
    // Perform an initial grouping if auto-grouping is enabled
    if (settings.groupingInterval > 0) {
      console.log(`⏱️ Auto-grouping enabled with interval: ${settings.groupingInterval} minutes`);
      
      // Wait a moment before first grouping to let browser settle
      setTimeout(() => {
        groupTabs();
      }, 5000);
    } else {
      console.log('⏱️ Auto-grouping is disabled');
    }
    
    // Set up listeners
    setupEventListeners();
    
    console.log('✅ Extension initialization complete');
  } catch (error) {
    console.error('❌ Error during extension initialization:', error);
  }
}

// Set up event listeners
function setupEventListeners() {
  console.log('🔄 Setting up event listeners');
  
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
    
    // Listen for tab activation to track user interaction patterns
    chrome.tabs.onActivated.addListener((activeInfo) => {
      trackTabInteraction(activeInfo.tabId, 'activation');
      
      // Check if this tab is part of a group
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab && tab.groupId && tab.groupId !== -1) {
          // Find other tabs in the same group and record navigation within the group
          chrome.tabs.query({ groupId: tab.groupId }, (groupTabs) => {
            for (const groupTab of groupTabs) {
              if (groupTab.id !== activeInfo.tabId) {
                trackTabInteraction(groupTab.id, 'group-navigation');
              }
            }
          });
        }
      });
    });
    
    // Listen for tab group changes
    if (chrome.tabGroups) {
      // Listen for tab group updates
      chrome.tabGroups.onUpdated.addListener((group) => {
        // Record manual group renaming as a signal
        if (group.title) {
          chrome.tabs.query({ groupId: group.id }, (groupTabs) => {
            for (const tab of groupTabs) {
              trackTabInteraction(tab.id, 'manual-grouping');
            }
            
            // Learn from this manual grouping
            learnFromManualGrouping(groupTabs, group.title);
          });
        }
      });
      
      // Listen for tabs being grouped or ungrouped
      if (chrome.tabs.onGroupChanged) {
        chrome.tabs.onGroupChanged.addListener((tabId, details) => {
          if (details.groupId) {
            // Tab was added to a group
            chrome.tabs.get(tabId, (tab) => {
              if (tab) {
                trackTabInteraction(tab.id, 'manual-grouping');
                
                // Learn from this grouping action
                setTimeout(() => {
                  learnFromGroupChange(tabId, details.groupId);
                }, 500); // Small delay to ensure group is fully updated
              }
            });
          } else {
            // Tab was removed from a group
            chrome.tabs.get(tabId, (tab) => {
              if (tab) {
                trackTabInteraction(tab.id, 'group-ungrouped');
              }
            });
          }
        });
      } else {
        console.warn('⚠️ Tab onGroupChanged API not available');
      }
    } else {
      console.warn('⚠️ Tab Groups API not available');
    }

    // Listen for alarms
    if (chrome.alarms) {
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'groupTabs') {
          console.log('⏰ Alarm triggered for tab grouping');
          groupTabs();
        }
      });
    }

    // Listen for settings updates
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateSettings') {
        loadSettings();
        sendResponse({ success: true });
      } else if (request.action === 'groupTabs') {
        groupTabs();
        sendResponse({ success: true });
      } else if (request.action === 'userFeedback') {
        // Handle explicit user feedback
        processUserFeedback(request.feedback, request.tabIds);
        sendResponse({ success: true });
      } else if (request.action === 'getStatus') {
        // Return current status to popup
        sendResponse({
          settings: settings,
          groupCount: Object.keys(documentTopics).length,
          lastGrouped: new Date().toISOString()
        });
        return true; // Required for asynchronous response
      }
    });
  } else {
    console.error('❌ Chrome Tabs API not available - event listeners not set up');
  }
}

// Load settings
export async function loadSettings() {
    console.log('📣 Loading extension settings');
    try {
        const items = await chrome.storage.sync.get({
            similarityThreshold: 0.3,
            groupingInterval: 5,
            maxGroupNameLength: 15,
            groupingAlgorithm: 'tfidf',
            bm25k1: 1.5,
            bm25b: 0.75,
            lsaDimensions: 50,
            useHistoricalData: true,
            historicalWeight: 1.2,
            contentCacheExpiry: 1440,
            adaptiveThreshold: true,
            minThreshold: 0.2,
            maxThreshold: 0.7,
            thresholdAdjustmentRate: 0.05,
            targetGroupSize: 4,
            topicCount: 10,
            topicModelingIterations: 10,
        });
        settings = items;
        
        // Verify the settings
        console.log('📊 Current settings:', {
            algorithm: settings.groupingAlgorithm,
            threshold: settings.similarityThreshold,
            interval: settings.groupingInterval,
            adaptive: settings.adaptiveThreshold
        });
        
        // Validate grouping algorithm
        const validAlgorithms = ['tfidf', 'bm25', 'keyphrase', 'hac', 'lsa', 'qco', 'topic'];
        if (!validAlgorithms.includes(settings.groupingAlgorithm)) {
            console.warn(`⚠️ Invalid algorithm: ${settings.groupingAlgorithm}, defaulting to 'tfidf'`);
            settings.groupingAlgorithm = 'tfidf';
            await chrome.storage.sync.set({ groupingAlgorithm: 'tfidf' });
        }
        
        resetAlarm();
    } catch (error) {
        console.error('❌ Error loading settings:', error);
        // Use default settings if there's an error
        settings = {
            similarityThreshold: 0.3,
            groupingInterval: 5,
            maxGroupNameLength: 15,
            groupingAlgorithm: 'tfidf',
            bm25k1: 1.5,
            bm25b: 0.75,
            lsaDimensions: 50,
            useHistoricalData: true,
            historicalWeight: 1.2,
            contentCacheExpiry: 1440,
            adaptiveThreshold: true,
            minThreshold: 0.2,
            maxThreshold: 0.7,
            thresholdAdjustmentRate: 0.05,
            targetGroupSize: 4,
            topicCount: 10,
            topicModelingIterations: 10,
        };
        resetAlarm();
    }
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

// Updated TF-IDF tokenization
function updateTFIDF(newDocument, docId) {
    // Use regex matching to accurately extract words
    const terms = (newDocument.toLowerCase().match(/\b\w+\b/g) || []).filter(term => term.length > 2 && !isStopWord(term));
    const termFreq = {};
    const docLength = terms.length;
    
    // Skip processing if document is too short
    if (docLength < 3) {
        console.log(`Document ${docId} is too short for meaningful TF-IDF analysis`);
        tfidf[docId] = {};
        return;
    }
    
    // Calculate term frequencies and update global vocabulary
    terms.forEach(term => {
        termFreq[term] = (termFreq[term] || 0) + 1;
        vocabulary.add(term);
    });

    // Apply log normalization (1 + log(tf)) to reduce the impact of very high frequency terms
    Object.keys(termFreq).forEach(term => {
        termFreq[term] = 1 + Math.log(termFreq[term]);
    });

    tfidf[docId] = termFreq;

    // Update IDF using smoothed formula
    vocabulary.forEach(term => {
        const docCount = Object.values(tfidf).filter(doc => doc[term]).length;
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
        'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
        'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
        'can', 'com', 'could', 'did', 'do', 'does', 'doing', 'down', 'during',
        'each', 'few', 'for', 'from', 'further',
        'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
        'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
        'just', 'me', 'more', 'most', 'my', 'myself',
        'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
        'same', 'she', 'should', 'so', 'some', 'such',
        'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
        'under', 'until', 'up', 'very',
        'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with',
        'www', 'you', 'your', 'yours', 'yourself', 'yourselves',
        // Common web terms that don't add meaning
        'http', 'https', 'html', 'htm', 'php', 'asp', 'jsp', 'cgi', 'page', 'site', 'web', 'click', 'view'
    ]);
    
    return stopWords.has(word.toLowerCase());
}

// Updated BM25 tokenization (similar to TF-IDF)
function updateBM25(newDocument, docId) {
    const terms = (newDocument.toLowerCase().match(/\b\w+\b/g) || []).filter(term => term.length > 2 && !isStopWord(term));
    const termFreq = {};
    let docLength = terms.length;
    
    if (docLength < 3) {
        console.log(`Document ${docId} is too short for meaningful BM25 analysis`);
        bm25[docId] = { termFreq: {}, docLength: 0 };
        return;
    }
    
    terms.forEach(term => {
        termFreq[term] = (termFreq[term] || 0) + 1;
        vocabulary.add(term);
    });
    
    bm25[docId] = { termFreq, docLength };

    // Update IDF with BM25-specific smoothing formula
    vocabulary.forEach(term => {
        const docCount = Object.values(bm25).filter(doc => doc.termFreq[term]).length;
        idf[term] = Math.log((Object.keys(bm25).length - docCount + 0.5) / (docCount + 0.5) + 1);
    });

    const totalDocs = Object.keys(bm25).length;
    const totalLength = Object.values(bm25).reduce((sum, doc) => sum + doc.docLength, 0);
    const avgDocLength = totalLength / totalDocs;

    Object.keys(bm25).forEach(id => {
        const doc = bm25[id];
        if (doc.docLength === 0) return;
        const normalizationFactor = 1 - settings.bm25b + settings.bm25b * (doc.docLength / avgDocLength);
        Object.keys(doc.termFreq).forEach(term => {
            const tf = doc.termFreq[term];
            const numerator = tf * (settings.bm25k1 + 1);
            const denominator = tf + settings.bm25k1 * normalizationFactor;
            bm25[id].termFreq[term] = idf[term] * (numerator / denominator);
        });
    });
}

// Improved Keyphrase Extraction using NLP-inspired techniques
function extractKeyphrases(text, numPhrases = 5) {
    if (!text || text.length < 20) {
        console.log("Text too short for meaningful keyphrase extraction");
        return [];
    }
    
    // Clean and normalize the text
    const cleanText = text.toLowerCase()
        .replace(/[^\w\s-]/g, ' ')  // Replace non-alphanumeric with spaces
        .replace(/\s+/g, ' ')       // Normalize whitespace
        .trim();
    
    // Extract words and filter out stopwords and short words
    const words = cleanText.split(/\s+/).filter(word => word.length > 2 && !isStopWord(word));
    
    // Build n-grams (2-word and 3-word phrases)
    const ngrams = [];
    const ngramFreq = {};
    
    // Generate 2-grams and 3-grams
    for (let n of [2, 3]) {
        for (let i = 0; i <= words.length - n; i++) {
            const phrase = words.slice(i, i + n).join(' ');
            
            // Skip phrases that are all stopwords or too short
            if (isStopPhrase(phrase) || phrase.length < 5) continue;
            
            // Count frequency of each phrase
            ngramFreq[phrase] = (ngramFreq[phrase] || 0) + 1;
            ngrams.push(phrase);
        }
    }
    
    // Calculate a score for each phrase based on frequency and other factors
    const phraseScores = {};
    for (const phrase of Object.keys(ngramFreq)) {
        // Base score is the frequency
        let score = ngramFreq[phrase];
        
        // Bonus for phrases with title capitalization in the original text
        if (new RegExp('\\b' + phrase.replace(/\s+/g, '\\s+') + '\\b', 'i').test(text)) {
            score *= 1.5;
        }
        
        // Bonus for phrases that start with capital letters in the original text
        if (new RegExp('\\b' + phrase.split(' ')[0] + '\\b', 'i').test(text) && 
            text.includes(' ' + phrase.split(' ')[0].charAt(0).toUpperCase() + phrase.split(' ')[0].slice(1))) {
            score *= 1.2;
        }
        
        // Slightly prefer shorter phrases (2-grams over 3-grams)
        if (phrase.split(' ').length === 2) {
            score *= 1.1;
        }
        
        phraseScores[phrase] = score;
    }
    
    // Sort phrases by score and return top N
    const sortedPhrases = Object.entries(phraseScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, numPhrases)
        .map(([phrase, score]) => ({
            text: phrase,
            score: score
        }));
    
    return sortedPhrases;
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

// Placeholder function for LSA updates
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
    
    // Skip if not enough terms
    if (terms.length < 3) {
        lsaVectors[docId] = {};
        return;
    }

    // Create a simple term frequency vector for now
    const termFreq = {};
    terms.forEach(term => {
        termFreq[term] = (termFreq[term] || 0) + 1;
        vocabulary.add(term);
    });
    
    // Store simple term frequency for now
    lsaVectors[docId] = termFreq;
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

            if (cluster.length > 2) {
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

    return clusters.filter(cluster => cluster.length > 2);
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
    const maxLength = Math.max(1, (settings && typeof settings.maxGroupNameLength === 'number')
        ? settings.maxGroupNameLength
        : 15);
    
    // Separate URLs and titles for better analysis
    const urls = [];
    const titles = [];
    const urlTitleRegex = /^(https?:\/\/[^\s]+)\s+(.+)$/i;
    
    for (const doc of clusterDocs) {
        const match = doc.match(urlTitleRegex);
        if (match) {
            urls.push(match[1]);
            titles.push(match[2]);
        }
    }
    
    // Extract domain names for potential use in group naming
    const domains = [];
    const urlRegex = /https?:\/\/([^\/]+)/i;
    
    for (const url of urls) {
        const match = url.match(urlRegex);
        if (match && match[1]) {
            // Extract domain without www. and .com/.org/etc.
            let domain = match[1].replace(/^www\./, '').split('.')[0];
            if (domain && domain.length > 2) {
                domains.push(domain.toLowerCase());
            }
        }
    }
    
    // Process all terms from the TITLES only (more meaningful)
    const combinedTerms = titles.join(' ')
        .toLowerCase()
        .replace(/[^\w\s-]/g, ' ')
        .split(/\s+/)
        .filter(term => term.length > 3 && !isStopWord(term));
    
    // Count term frequencies
    const termFreq = {};
    combinedTerms.forEach(term => {
        termFreq[term] = (termFreq[term] || 0) + 1;
    });
    
    // Extract keyphrases from titles (2-3 word combinations)
    const keyphrases = extractKeyphrases(titles.join(' '));
    
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
    
    // Extract page types/categories from titles
    const pageTypes = extractPageTypes(titles);
    
    // Generate name based on multiple factors
    let name = "Group";
    
    // If we have high-quality keyphrases, use them first
    if (keyphrases.length > 0) {
        const topKeyphrase = keyphrases[0].text;
        if (topKeyphrase && topKeyphrase.length > 3 && topKeyphrase.length <= maxLength) {
            return topKeyphrase.charAt(0).toUpperCase() + topKeyphrase.slice(1);
        }
    }
    
    // Special case for GitHub repositories with programming languages
    const programmingLanguages = ['javascript', 'python', 'java', 'css', 'html', 'ruby', 'php', 'swift', 'kotlin', 'rust', 'go'];
    for (const lang of programmingLanguages) {
        if (combinedTerms.includes(lang) && (commonDomain === 'github' || titles.some(t => t.toLowerCase().includes('repository')))) {
            return `${lang.charAt(0).toUpperCase() + lang.slice(1)} Code`;
        }
    }
    
    // Special case for learning/tutorial content
    if (pageTypes.includes('Learning') && sortedTerms.length > 0) {
        return `Learn: ${sortedTerms[0]}`.slice(0, maxLength);
    }
    
    // Special case for React components
    if (titles.some(t => t.toLowerCase().includes('react')) && 
        titles.some(t => t.toLowerCase().includes('component'))) {
        return 'React Components';
    }
    
    // Strategy 1: Use Page Type + meaningful term
    if (pageTypes.length > 0 && sortedTerms.length > 0) {
        name = `${pageTypes[0]}: ${sortedTerms[0]}`;
    }
    // Strategy 2: Multiple meaningful terms (we prefer multiple terms over domain names)
    else if (sortedTerms.length >= 2) {
        name = `${sortedTerms[0]} & ${sortedTerms[1]}`;
    }
    // Strategy 3: Domain + Top Term (only if we can't find enough meaningful terms)
    else if (commonDomain && sortedTerms.length > 0) {
        const topTerm = sortedTerms[0];
        if (topTerm !== commonDomain) {
            name = `${commonDomain.charAt(0).toUpperCase() + commonDomain.slice(1)}: ${topTerm}`;
        } else {
            name = commonDomain.charAt(0).toUpperCase() + commonDomain.slice(1);
        }
    }
    // Strategy 4: Single Term or Domain as last resort
    else if (sortedTerms.length > 0) {
        name = sortedTerms[0].charAt(0).toUpperCase() + sortedTerms[0].slice(1);
    } else if (commonDomain) {
        name = commonDomain.charAt(0).toUpperCase() + commonDomain.slice(1);
    }
    
    // Strictly enforce maxLength
    return name.slice(0, maxLength);
}

/**
 * Extracts potential page types or categories from titles
 * @param {Array<string>} titles - Array of tab titles
 * @returns {Array<string>} - Array of potential page types
 */
function extractPageTypes(titles) {
    const pageTypePatterns = [
        { regex: /\b(news|article|blog|post|update)\b/i, type: 'News' },
        { regex: /\b(shop|product|store|buy|price|purchase|cart|checkout)\b/i, type: 'Shopping' },
        { regex: /\b(video|watch|stream|movie|film|episode|show|youtube)\b/i, type: 'Videos' },
        { regex: /\b(doc|document|pdf|spreadsheet|presentation|slides|report)\b/i, type: 'Documents' },
        { regex: /\b(research|paper|study|journal|science|analysis|theory)\b/i, type: 'Research' },
        { regex: /\b(social|profile|timeline|feed|post|status|tweet)\b/i, type: 'Social' },
        { regex: /\b(forum|discussion|thread|comment|reply|community|answers|question)\b/i, type: 'Discussion' },
        { regex: /\b(tutorial|guide|how-to|learn|course|lesson|education|training)\b/i, type: 'Learning' },
        { regex: /\b(review|rating|opinion|compare|comparison|versus|vs)\b/i, type: 'Reviews' },
        { regex: /\b(travel|hotel|flight|booking|reservation|vacation|destination|trip)\b/i, type: 'Travel' },
        { regex: /\b(recipe|food|cooking|ingredient|meal|baking|dish|cuisine)\b/i, type: 'Recipes' },
        { regex: /\b(code|programming|developer|github|repository|script|software|app)\b/i, type: 'Development' },
        { regex: /\b(game|gaming|play|player|walkthrough|strategy|cheats|steam)\b/i, type: 'Gaming' },
        { regex: /\b(health|medical|doctor|symptom|treatment|medicine|wellness|fitness)\b/i, type: 'Health' },
        { regex: /\b(finance|bank|money|invest|stock|market|trading|crypto|portfolio)\b/i, type: 'Finance' },
        { regex: /\b(music|song|album|artist|playlist|spotify|band|concert)\b/i, type: 'Music' },
        { regex: /\b(weather|forecast|temperature|climate|storm|rain|snow)\b/i, type: 'Weather' },
        { regex: /\b(sports|team|player|match|game|score|stats|standings)\b/i, type: 'Sports' },
        { regex: /\b(email|inbox|message|mail|gmail|outlook)\b/i, type: 'Email' },
        { regex: /\b(map|direction|location|address|place|navigation)\b/i, type: 'Maps' },
        { regex: /\b(chat|message|conversation|ai|bot|assistant)\b/i, type: 'Chat' },
        { regex: /\b(work|job|career|resume|linkedin|salary|interview)\b/i, type: 'Work' }
    ];
    
    const typeFreq = {};
    const combinedTitles = titles.join(' ').toLowerCase();
    
    // First check for common patterns in the combined titles
    for (const pattern of pageTypePatterns) {
        if (pattern.regex.test(combinedTitles)) {
            typeFreq[pattern.type] = (typeFreq[pattern.type] || 0) + 2; // Give higher weight to patterns found in combined text
        }
    }
    
    // Then check each title individually
    for (const title of titles) {
        const lowerTitle = title.toLowerCase();
        for (const pattern of pageTypePatterns) {
            if (pattern.regex.test(lowerTitle)) {
                typeFreq[pattern.type] = (typeFreq[pattern.type] || 0) + 1;
            }
        }
    }
    
    // Return page types sorted by frequency
    return Object.entries(typeFreq)
        .sort((a, b) => b[1] - a[1])
        .map(([type]) => type);
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
        
        // Build basic features
        let features = `${domain} ${path} ${queryParams} ${cleanTitle}`.toLowerCase();
        
        // Check if we have cached content for this URL
        if (settings.useHistoricalData && tabContentCache[tab.url]) {
            // Check if the cache entry is still valid
            const now = Date.now();
            if (now - tabContentCache[tab.url].timestamp < settings.contentCacheExpiry * 60 * 1000) {
                // Reuse cached features
                features = tabContentCache[tab.url].features;
            }
        }
        
        // Apply historical weight if this domain has been grouped before
        if (settings.useHistoricalData && tabInteractionHistory[domain]) {
            const historyEntry = tabInteractionHistory[domain];
            
            // Add metadata about historical weighting
            features = {
                text: features,
                historyWeight: historyEntry.weight,
                interactionCount: historyEntry.count,
                domain: domain
            };
        }
        
        return features;
    } catch (error) {
        console.error(`Error extracting features from tab ${tab.id}:`, error);
        return null;
    }
}

// Add function to cache tab content
function cacheTabContent(url, features) {
    if (!settings.useHistoricalData) {
        return;
    }
    
    tabContentCache[url] = {
        features: features,
        timestamp: Date.now()
    };
    
    // Prune cache if it gets too large (keep under 1000 entries)
    const urls = Object.keys(tabContentCache);
    if (urls.length > 1000) {
        // Sort by timestamp and remove oldest entries
        const sortedUrls = urls.sort((a, b) => 
            tabContentCache[a].timestamp - tabContentCache[b].timestamp);
        
        // Remove oldest 20% of entries
        const toRemove = Math.floor(sortedUrls.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
            delete tabContentCache[sortedUrls[i]];
        }
    }
}

// Add function to track tab interactions
function trackTabInteraction(tabId, action) {
    if (!settings.useHistoricalData) {
        return;
    }
    
    chrome.tabs.get(tabId, (tab) => {
        if (!tab || !isGroupableTab(tab)) {
            return;
        }
        
        try {
            const url = new URL(tab.url);
            const domain = url.hostname;
            
            if (!tabInteractionHistory[domain]) {
                tabInteractionHistory[domain] = { 
                    count: 0, 
                    weight: 1.0,
                    lastInteraction: Date.now() 
                };
            }
            
            const history = tabInteractionHistory[domain];
            
            // Update based on action type
            switch (action) {
                case 'group-navigation':
                    // User navigated between tabs in the same group
                    history.count++;
                    history.weight = Math.min(2.0, 1.0 + history.count/10);
                    break;
                    
                case 'manual-grouping':
                    // User manually grouped this tab
                    history.count += 2;
                    history.weight = Math.min(2.0, 1.0 + history.count/10);
                    break;
                    
                case 'group-ungrouped':
                    // User removed tab from group
                    history.count = Math.max(0, history.count - 1);
                    history.weight = Math.max(0.8, 1.0 + history.count/10);
                    break;
                    
                default:
                    // General interaction
                    history.count++;
                    history.weight = Math.min(2.0, 1.0 + history.count/10);
            }
            
            history.lastInteraction = Date.now();
            
            // Save history periodically
            debounceHistorySave();
        } catch (error) {
            console.error('Error tracking tab interaction:', error);
        }
    });
}

// Debounced history save function
let historySaveTimeout = null;
function debounceHistorySave() {
    if (historySaveTimeout) {
        clearTimeout(historySaveTimeout);
    }
    
    historySaveTimeout = setTimeout(() => {
        saveTabInteractionHistory();
    }, 5000); // Save after 5 seconds of inactivity
}

// Function to save tab interaction history
async function saveTabInteractionHistory() {
    if (!settings.useHistoricalData) {
        return;
    }
    
    try {
        // Prune old entries first (older than 30 days)
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        
        for (const domain in tabInteractionHistory) {
            if (tabInteractionHistory[domain].lastInteraction < thirtyDaysAgo) {
                delete tabInteractionHistory[domain];
            }
        }
        
        // Save to storage
        await chrome.storage.local.set({ tabInteractionHistory });
    } catch (error) {
        console.error('Error saving tab interaction history:', error);
    }
}

// Function to load tab interaction history
async function loadTabInteractionHistory() {
    if (!settings.useHistoricalData) {
        return;
    }
    
    try {
        const result = await chrome.storage.local.get('tabInteractionHistory');
        if (result.tabInteractionHistory) {
            tabInteractionHistory = result.tabInteractionHistory;
        }
    } catch (error) {
        console.error('Error loading tab interaction history:', error);
    }
}

// Learn from manual group creation and naming
function learnFromManualGrouping(tabs, groupTitle) {
    if (!settings.useHistoricalData || !tabs || tabs.length < 2 || !groupTitle) {
        return;
    }
    
    // Extract domains from tabs
    const domains = tabs.map(tab => {
        try {
            return new URL(tab.url).hostname;
        } catch (e) {
            return null;
        }
    }).filter(Boolean);
    
    // Record these domains as having a strong relationship
    for (let i = 0; i < domains.length; i++) {
        const domain1 = domains[i];
        if (!domain1) continue;
        
        if (!tabInteractionHistory[domain1]) {
            tabInteractionHistory[domain1] = {
                count: 0,
                weight: 1.0,
                lastInteraction: Date.now(),
                coOccurrences: {},
                negativeRelations: {}
            };
        }
        
        const history = tabInteractionHistory[domain1];
        history.count += 2; // Stronger signal from manual grouping
        history.coOccurrences = history.coOccurrences || {};
        
        // Record strong co-occurrences with other domains
        for (let j = 0; j < domains.length; j++) {
            if (i !== j) {
                const domain2 = domains[j];
                if (!domain2) continue;
                
                // Stronger signal for manual grouping
                history.coOccurrences[domain2] = (history.coOccurrences[domain2] || 0) + 3;
                
                // Remove negative relations if they exist
                if (history.negativeRelations && history.negativeRelations[domain2]) {
                    delete history.negativeRelations[domain2];
                }
            }
        }
        
        // Update the weight and timestamp
        history.weight = Math.min(2.0, 1.0 + history.count/10);
        history.lastInteraction = Date.now();
    }
    
    // Save the updated history
    debounceHistorySave();
}

// Learn from tab being added to a group
function learnFromGroupChange(tabId, groupId) {
    chrome.tabs.get(tabId, (tab) => {
        if (!tab || !settings.useHistoricalData) {
            return;
        }
        
        // Get other tabs in the same group
        chrome.tabs.query({ groupId: groupId }, (groupTabs) => {
            if (groupTabs.length < 2) {
                return;
            }
            
            // Process this as a manual grouping
            learnFromManualGrouping(groupTabs);
        });
    });
}

// Function to process explicit user feedback about groupings
function processUserFeedback(feedback, tabIds) {
    if (!settings.useHistoricalData || !tabIds || tabIds.length < 2) {
        return;
    }
    
    // Get the actual tab objects
    chrome.tabs.query({}, (allTabs) => {
        const tabs = allTabs.filter(tab => tabIds.includes(tab.id));
        
        if (tabs.length < 2) {
            return;
        }
        
        if (feedback === 'positive') {
            // User likes this grouping - learn from it
            learnFromManualGrouping(tabs);
        } else if (feedback === 'negative') {
            // User doesn't like this grouping - learn to avoid it
            learnFromNegativeFeedback(tabs);
        }
    });
}

// Learn from negative feedback
function learnFromNegativeFeedback(tabs) {
    if (!settings.useHistoricalData || tabs.length < 2) {
        return;
    }
    
    // Extract domains
    const domains = tabs.map(tab => {
        try {
            return new URL(tab.url).hostname;
        } catch (e) {
            return null;
        }
    }).filter(Boolean);
    
    // Record negative relationship between these domains
    for (let i = 0; i < domains.length; i++) {
        const domain1 = domains[i];
        if (!domain1) continue;
        
        if (!tabInteractionHistory[domain1]) {
            tabInteractionHistory[domain1] = {
                count: 0,
                weight: 1.0,
                lastInteraction: Date.now(),
                coOccurrences: {},
                negativeRelations: {}
            };
        }
        
        const history = tabInteractionHistory[domain1];
        history.negativeRelations = history.negativeRelations || {};
        
        // Record negative relationships with other domains
        for (let j = 0; j < domains.length; j++) {
            if (i !== j) {
                const domain2 = domains[j];
                if (!domain2) continue;
                
                history.negativeRelations[domain2] = (history.negativeRelations[domain2] || 0) + 1;
                
                // If we have a positive co-occurrence, reduce it
                if (history.coOccurrences && history.coOccurrences[domain2]) {
                    history.coOccurrences[domain2] = Math.max(0, history.coOccurrences[domain2] - 2);
                }
            }
        }
    }
    
    // Save the updated history
    debounceHistorySave();
}

// Function to group tabs
async function groupTabs() {
    console.log('🔍 groupTabs function called - starting tab grouping process');
    try {
        // Get existing tab groups before making changes
        const existingGroups = await getExistingGroups();
        const previousGroupsCount = existingGroups.length;
        const previousGroupSizes = existingGroups.map(group => group.tabCount || 0);
        console.log(`📊 Current state: ${previousGroupsCount} existing groups`);
        
        const tabs = await chrome.tabs.query({ currentWindow: true });
        console.log(`🔢 Found ${tabs.length} total tabs in current window`);
        let clusters = [];

        // Handle QCO algorithm separately as it doesn't use tabVectors
        if (settings.groupingAlgorithm === 'qco') {
            console.log('🧠 Using QCO algorithm for grouping');
            // Filter out pinned tabs and non-groupable tabs before passing to QCO
            const groupableTabs = tabs.filter(tab => !tab.pinned && isGroupableTab(tab));
            
            console.log(`📑 ${groupableTabs.length} tabs are eligible for grouping`);
            
            if (groupableTabs.length < 3) {
                console.log('⚠️ No groupable tabs found or not enough for meaningful groups');
                return;
            }

            try {
                // Call QCO algorithm with filtered tabs
                console.log('⚙️ Calling QCO algorithm with groupable tabs');
                
                // Direct function call (no need to check if it exists since we defined it inline)
                const qcoGroups = groupTabsQuantumChaosOrganizer(groupableTabs);
                console.log(`🧩 QCO returned ${qcoGroups?.length || 0} potential groups`);
                
                if (qcoGroups && Array.isArray(qcoGroups) && qcoGroups.length > 0) {
                    // Extract tab IDs from the groups
                    clusters = qcoGroups
                        .filter(group => Array.isArray(group) && group.length > 1)
                        .map(group => group.map(tab => tab.id));
                    console.log(`🔗 Created ${clusters.length} clusters from QCO groups`);
                } else {
                    console.log('⚠️ QCO returned no valid groups');
                }
            } catch (error) {
                console.error('❌ Error in groupTabs: QCO algorithm failed', error);
                return;
            }
        } else if (settings.groupingAlgorithm === 'topic') {
            // Topic modeling approach
            console.log('🧠 Using Topic Modeling algorithm for grouping');
            try {
                clusters = await groupTabsByTopics(tabs);
                console.log(`🔗 Topic modeling created ${clusters.length} clusters`);
            } catch (error) {
                console.error('❌ Error in topic-based tab grouping:', error);
                return;
            }
        } else {
            // Handle other algorithms that use tabVectors
            console.log(`🧠 Using ${settings.groupingAlgorithm} algorithm for grouping`);
            const tabIds = [];
            const tabVectors = {};

            for (const tab of tabs) {
                if (isGroupableTab(tab)) {
                    try {
                        const features = await extractTabFeatures(tab);
                        if (features) {
                            // Cache the extracted features for future use
                            if (typeof features === 'string') {
                                cacheTabContent(tab.url, features);
                            } else if (features.text) {
                                cacheTabContent(tab.url, features.text);
                            }
                            
                            const tabId = tab.id.toString();
                            switch (settings.groupingAlgorithm) {
                                case 'tfidf':
                                    const featureText = typeof features === 'string' ? features : features.text;
                                    updateTFIDF(featureText, tabId);
                                    tabVectors[tabId] = tfidf[tabId];
                                    
                                    // Apply historical weight if available
                                    if (typeof features === 'object' && features.historyWeight) {
                                        applyHistoricalWeight(tabVectors[tabId], features.historyWeight);
                                    }
                                    break;
                                case 'bm25':
                                    const bm25Text = typeof features === 'string' ? features : features.text;
                                    updateBM25(bm25Text, tabId);
                                    tabVectors[tabId] = bm25[tabId].termFreq;
                                    
                                    // Apply historical weight if available
                                    if (typeof features === 'object' && features.historyWeight) {
                                        applyHistoricalWeight(tabVectors[tabId], features.historyWeight);
                                    }
                                    break;
                                case 'keyphrase':
                                    const keyphraseText = typeof features === 'string' ? features : features.text;
                                    updateKeyphrases(keyphraseText, tabId);
                                    tabVectors[tabId] = keyphrases[tabId];
                                    
                                    // For keyphrase, we'll add domain-specific terms if historical weight is high
                                    if (typeof features === 'object' && features.historyWeight > 1.5 && features.domain) {
                                        tabVectors[tabId].push(features.domain);
                                    }
                                    break;
                                case 'lsa':
                                    const lsaText = typeof features === 'string' ? features : features.text;
                                    updateLSA(lsaText, tabId);
                                    tabVectors[tabId] = lsaVectors[tabId];
                                    
                                    // Apply historical weight if available
                                    if (typeof features === 'object' && features.historyWeight) {
                                        applyHistoricalWeight(tabVectors[tabId], features.historyWeight);
                                    }
                                    break;
                                case 'hac':
                                    // HAC just uses the same vectors as TFIDF
                                    const hacText = typeof features === 'string' ? features : features.text;
                                    updateTFIDF(hacText, tabId);
                                    tabVectors[tabId] = tfidf[tabId];
                                    break;
                                default:
                                    // Fallback to TFIDF
                                    console.warn(`⚠️ Unrecognized algorithm ${settings.groupingAlgorithm}, falling back to TFIDF`);
                                    const fallbackText = typeof features === 'string' ? features : features.text;
                                    updateTFIDF(fallbackText, tabId);
                                    tabVectors[tabId] = tfidf[tabId];
                            }
                            tabIds.push(tab.id);
                        }
                    } catch (error) {
                        console.error(`❌ Error processing tab ${tab.id}:`, error);
                    }
                }
            }

            console.log(`📊 Created feature vectors for ${Object.keys(tabVectors).length} tabs`);
            
            // Debug similarity thresholds
            console.log(`🎯 Current similarity threshold: ${settings.similarityThreshold}`);
            
            // If we have at least 2 tabs, log a sample similarity calculation
            const tabIdArray = Object.keys(tabVectors);
            if (tabIdArray.length >= 2) {
                const id1 = tabIdArray[0];
                const id2 = tabIdArray[1];
                let sampleSimilarity;
                
                if (settings.groupingAlgorithm === 'keyphrase') {
                    sampleSimilarity = jaccardSimilarity(
                        new Set(tabVectors[id1]), 
                        new Set(tabVectors[id2])
                    );
                } else {
                    sampleSimilarity = cosineSimilarity(tabVectors[id1], tabVectors[id2]);
                }
                
                console.log(`🔍 Sample similarity between tabs ${id1} and ${id2}: ${sampleSimilarity}`);
                console.log(`   Will be clustered? ${sampleSimilarity > settings.similarityThreshold}`);
            }

            clusters = clusterTabs(tabVectors);
            console.log(`🔗 Clustering algorithm created ${clusters.length} clusters`);
        }

        // Fallback: If no clusters were found and we have enough tabs, try a simple grouping
        if (clusters.length === 0 && tabs.length >= 5) {
            console.log('⚠️ No clusters found, applying fallback grouping');
            
            // Try to lower the threshold temporarily for this grouping
            const originalThreshold = settings.similarityThreshold;
            const lowerThreshold = Math.max(0.1, originalThreshold - 0.15);
            
            console.log(`🔧 Temporarily lowering threshold from ${originalThreshold} to ${lowerThreshold}`);
            settings.similarityThreshold = lowerThreshold;
            
            // Try again with the same algorithm
            if (settings.groupingAlgorithm !== 'qco' && settings.groupingAlgorithm !== 'topic') {
                const tabIds = [];
                const tabVectors = {};
                
                // Only process a subset of tabs for efficiency
                const eligibleTabs = tabs.filter(tab => isGroupableTab(tab)).slice(0, 15);
                
                for (const tab of eligibleTabs) {
                    try {
                        const features = await extractTabFeatures(tab);
                        if (features) {
                            const tabId = tab.id.toString();
                            const featureText = typeof features === 'string' ? features : features.text;
                            
                            // Use TFIDF as fallback regardless of original algorithm
                            updateTFIDF(featureText, tabId);
                            tabVectors[tabId] = tfidf[tabId];
                            tabIds.push(tab.id);
                        }
                    } catch (error) {
                        // No need to log this error again
                    }
                }
                
                clusters = clusterTabs(tabVectors);
                console.log(`🔗 Fallback created ${clusters.length} clusters`);
            }
            
            // Reset the threshold to its original value
            settings.similarityThreshold = originalThreshold;
        }

        // Group tabs based on clusters
        console.log(`🎯 Will attempt to create ${clusters.length} tab groups`);
        for (const cluster of clusters) {
            if (cluster.length > 1) {
                try {
                    // Convert all tab IDs to numbers to ensure compatibility
                    const numericTabIds = cluster.map(tabId => 
                        typeof tabId === 'string' ? parseInt(tabId, 10) : tabId
                    );
                    
                    console.log(`🔄 Creating group with ${numericTabIds.length} tabs: ${numericTabIds.join(', ')}`);
                    
                    // Verify all tab IDs exist before grouping
                    const validTabs = await chrome.tabs.query({});
                    const validTabIds = validTabs.map(tab => tab.id);
                    const filteredTabIds = numericTabIds.filter(id => validTabIds.includes(id));
                    
                    if (filteredTabIds.length < 2) {
                        console.warn('⚠️ Not enough valid tabs for grouping');
                        continue;
                    }
                    
                    const groupId = await chrome.tabs.group({ tabIds: filteredTabIds });
                    const groupName = generateGroupName(filteredTabIds.map(tabId => {
                        const tab = tabs.find(t => t.id === tabId);
                        return tab ? `${tab.url} ${tab.title}` : '';
                    }).filter(Boolean));
                    
                    console.log(`✅ Group created with ID ${groupId}, naming as "${groupName}"`);
                    try {
                        // Before updating, verify the group still exists
                        const groups = await chrome.tabGroups.query({});
                        if (groups.some(g => g.id === groupId)) {
                            await chrome.tabGroups.update(groupId, { title: groupName });
                        } else {
                            console.warn(`⚠️ Group ${groupId} no longer exists, cannot update name`);
                        }
                    } catch (updateError) {
                        console.warn(`⚠️ Could not update group ${groupId}: ${updateError.message}`);
                        // Continue anyway - the group was created but couldn't be renamed
                    }
                    
                    // Record that these tabs were grouped together for learning
                    recordTabGrouping(filteredTabIds, tabs);
                } catch (error) {
                    console.error('❌ Error creating or updating tab group:', error);
                    console.error('Tab IDs in cluster:', cluster);
                }
            }
        }

        // Get current tab groups after making changes
        const updatedGroups = await getExistingGroups();
        console.log(`📊 After grouping: ${updatedGroups.length} groups exist`);
        
        // Analyze grouping effectiveness and adjust threshold if needed
        if (settings.adaptiveThreshold) {
            const effectiveness = calculateGroupingEffectiveness(
                previousGroupsCount, 
                previousGroupSizes,
                updatedGroups.length,
                updatedGroups.map(group => group.tabCount || 0),
                tabs.length
            );
            
            console.log(`📈 Grouping effectiveness: ${effectiveness.toFixed(2)}`);
            adjustSimilarityThreshold(effectiveness);
        }

        // Save the current state
        await saveState();
        console.log('✅ Tab grouping completed successfully');
    } catch (error) {
        console.error('❌ Error in groupTabs:', error);
    }
}

// Function to get existing tab groups
async function getExistingGroups() {
    try {
        if (!chrome.tabGroups || !chrome.tabGroups.query) {
            return [];
        }
        
        return await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    } catch (error) {
        console.error('Error getting existing groups:', error);
        return [];
    }
}

// Calculate grouping effectiveness based on various metrics
function calculateGroupingEffectiveness(
    previousGroupCount, 
    previousGroupSizes, 
    currentGroupCount, 
    currentGroupSizes,
    totalTabs
) {
    // Skip if we don't have enough data
    if (!previousGroupSizes.length && !currentGroupSizes.length) {
        return 0.5; // Neutral score
    }
    
    // Calculate metrics for grouping quality
    const metrics = {
        // Metric 1: Group size distribution - penalize very small or very large groups
        groupSizeScore: calculateGroupSizeScore(currentGroupSizes),
        
        // Metric 2: Group count change - reward modest growth in groups
        groupCountScore: calculateGroupCountChangeScore(previousGroupCount, currentGroupCount, totalTabs),
        
        // Metric 3: Coverage ratio - percentage of tabs in groups
        coverageScore: calculateCoverageScore(currentGroupSizes, totalTabs),
        
        // Metric 4: Stability - reward not changing groups too drastically
        stabilityScore: calculateStabilityScore(previousGroupSizes, currentGroupSizes)
    };
    
    // Weighted average of metrics
    const weights = {
        groupSizeScore: 0.35,
        groupCountScore: 0.25,
        coverageScore: 0.25,
        stabilityScore: 0.15
    };
    
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const [metric, score] of Object.entries(metrics)) {
        totalScore += score * weights[metric];
        totalWeight += weights[metric];
    }
    
    return totalWeight === 0 ? 0.5 : totalScore / totalWeight;
}

// Calculate score based on group sizes - reward groups close to target size
function calculateGroupSizeScore(groupSizes) {
    if (!groupSizes.length) return 0.5;
    
    const targetSize = settings.targetGroupSize || 4;
    
    // Calculate how close each group is to the target size
    const sizeDeviations = groupSizes.map(size => {
        const deviation = Math.abs(size - targetSize) / targetSize;
        return Math.max(0, 1 - deviation);
    });
    
    // Average the scores
    return sizeDeviations.reduce((sum, score) => sum + score, 0) / sizeDeviations.length;
}

// Calculate score based on change in group count
function calculateGroupCountChangeScore(previousCount, currentCount, totalTabs) {
    // If no previous data, give neutral score
    if (previousCount === 0) return 0.5;
    
    // Calculate ideal group count based on total tabs
    const idealGroupCount = Math.ceil(totalTabs / (settings.targetGroupSize || 4));
    
    // Calculate how close current count is to ideal count
    const currentDeviation = Math.abs(currentCount - idealGroupCount) / idealGroupCount;
    const currentScore = Math.max(0, 1 - currentDeviation);
    
    // Calculate how close previous count was to ideal count
    const previousDeviation = Math.abs(previousCount - idealGroupCount) / idealGroupCount;
    const previousScore = Math.max(0, 1 - previousDeviation);
    
    // Reward improvement, penalize regression
    return previousScore === 0 ? currentScore : currentScore / previousScore;
}

// Calculate score based on percentage of tabs in groups
function calculateCoverageScore(groupSizes, totalTabs) {
    if (totalTabs === 0) return 0.5;
    
    const tabsInGroups = groupSizes.reduce((sum, size) => sum + size, 0);
    return tabsInGroups / totalTabs;
}

// Calculate score based on stability between groupings
function calculateStabilityScore(previousSizes, currentSizes) {
    if (!previousSizes.length || !currentSizes.length) {
        return 0.5; // Neutral score if no previous data
    }
    
    // Calculate size change percentage
    const previousTotal = previousSizes.reduce((sum, size) => sum + size, 0);
    const currentTotal = currentSizes.reduce((sum, size) => sum + size, 0);
    
    if (previousTotal === 0) return 0.5;
    
    const changeRatio = Math.abs(currentTotal - previousTotal) / previousTotal;
    
    // More stability (less change) gets higher score
    return Math.max(0, 1 - changeRatio);
}

// Function to adjust similarity threshold based on effectiveness
function adjustSimilarityThreshold(effectiveness) {
    if (!settings.adaptiveThreshold) {
        return;
    }
    
    // Calculate adjustment - if effectiveness > 0.5, increase threshold
    // if effectiveness < 0.5, decrease threshold
    const adjustment = (effectiveness - 0.5) * settings.thresholdAdjustmentRate;
    
    // Apply adjustment with bounds
    const newThreshold = Math.max(
        settings.minThreshold,
        Math.min(settings.maxThreshold, settings.similarityThreshold + adjustment)
    );
    
    // Only update if there's a meaningful change
    if (Math.abs(newThreshold - settings.similarityThreshold) > 0.01) {
        settings.similarityThreshold = newThreshold;
        
        // Save the new threshold to sync storage
        chrome.storage.sync.set({ similarityThreshold: settings.similarityThreshold });
        
        console.log(`Adjusted similarity threshold to ${settings.similarityThreshold.toFixed(2)} (effectiveness: ${effectiveness.toFixed(2)})`);
    }
}

// Helper function to apply historical weight to a vector
function applyHistoricalWeight(vector, weight) {
    if (!vector || typeof weight !== 'number') {
        return;
    }
    
    // Apply the weight to each term in the vector
    Object.keys(vector).forEach(term => {
        vector[term] *= weight;
    });
}

// Function to record tab grouping for learning
function recordTabGrouping(tabIds, allTabs) {
    if (!settings.useHistoricalData || !tabIds || tabIds.length <= 1) {
        return;
    }
    
    // Get the domains of the grouped tabs
    const domains = tabIds.map(tabId => {
        const tab = allTabs.find(t => t.id === tabId);
        if (!tab || !tab.url) return null;
        
        try {
            return new URL(tab.url).hostname;
        } catch (e) {
            return null;
        }
    }).filter(Boolean);
    
    // Record each domain's co-occurrence with other domains
    for (const domain of domains) {
        if (!tabInteractionHistory[domain]) {
            tabInteractionHistory[domain] = {
                count: 0,
                weight: 1.0,
                lastInteraction: Date.now(),
                coOccurrences: {}
            };
        }
        
        // Record this domain's association with other domains in the same group
        const history = tabInteractionHistory[domain];
        history.count++;
        
        // Record co-occurrences with other domains
        for (const otherDomain of domains) {
            if (domain !== otherDomain) {
                history.coOccurrences = history.coOccurrences || {};
                history.coOccurrences[otherDomain] = (history.coOccurrences[otherDomain] || 0) + 1;
            }
        }
        
        // Update the weight based on count
        history.weight = Math.min(2.0, 1.0 + history.count/10);
        history.lastInteraction = Date.now();
    }
    
    // Save the updated history
    debounceHistorySave();
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
            lsaTerms: lsaTerms,
            tabContentCache: tabContentCache,
            topicModels: topicModels,
            documentTopics: documentTopics
        });
    } catch (error) {
        console.error('Error saving state:', error);
    }
}

// Function to load the saved state
async function loadState() {
    try {
        const state = await chrome.storage.local.get([
            'tfidf', 'bm25', 'keyphrases', 'idf', 'vocabulary', 
            'lsaVectors', 'lsaTermMatrix', 'lsaTerms', 'tabContentCache',
            'topicModels', 'documentTopics'
        ]);
        if (state.tfidf) tfidf = state.tfidf;
        if (state.bm25) bm25 = state.bm25;
        if (state.keyphrases) keyphrases = state.keyphrases;
        if (state.idf) idf = state.idf;
        if (state.vocabulary) vocabulary = new Set(state.vocabulary);
        if (state.lsaVectors) lsaVectors = state.lsaVectors;
        if (state.lsaTermMatrix) lsaTermMatrix = state.lsaTermMatrix;
        if (state.lsaTerms) lsaTerms = state.lsaTerms;
        if (state.tabContentCache) tabContentCache = state.tabContentCache;
        if (state.topicModels) topicModels = state.topicModels;
        if (state.documentTopics) documentTopics = state.documentTopics;
        
        // Also load interaction history
        await loadTabInteractionHistory();
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
    
    // Listen for tab activation to track user interaction patterns
    chrome.tabs.onActivated.addListener((activeInfo) => {
        trackTabInteraction(activeInfo.tabId, 'activation');
        
        // Check if this tab is part of a group
        chrome.tabs.get(activeInfo.tabId, (tab) => {
            if (tab && tab.groupId && tab.groupId !== -1) {
                // Find other tabs in the same group and record navigation within the group
                chrome.tabs.query({ groupId: tab.groupId }, (groupTabs) => {
                    for (const groupTab of groupTabs) {
                        if (groupTab.id !== activeInfo.tabId) {
                            trackTabInteraction(groupTab.id, 'group-navigation');
                        }
                    }
                });
            }
        });
    });
    
    // Listen for tab group changes
    if (chrome.tabGroups) {
        // Listen for tab group updates
        chrome.tabGroups.onUpdated.addListener((group) => {
            // Record manual group renaming as a signal
            if (group.title) {
                chrome.tabs.query({ groupId: group.id }, (groupTabs) => {
                    for (const tab of groupTabs) {
                        trackTabInteraction(tab.id, 'manual-grouping');
                    }
                    
                    // Learn from this manual grouping
                    learnFromManualGrouping(groupTabs, group.title);
                });
            }
        });
        
        // Listen for tabs being grouped or ungrouped
        chrome.tabs.onGroupChanged && chrome.tabs.onGroupChanged.addListener((tabId, details) => {
            if (details.groupId) {
                // Tab was added to a group
                chrome.tabs.get(tabId, (tab) => {
                    if (tab) {
                        trackTabInteraction(tab.id, 'manual-grouping');
                        
                        // Learn from this grouping action
                        setTimeout(() => {
                            learnFromGroupChange(tabId, details.groupId);
                        }, 500); // Small delay to ensure group is fully updated
                    }
                });
            } else {
                // Tab was removed from a group
                chrome.tabs.get(tabId, (tab) => {
                    if (tab) {
                        trackTabInteraction(tab.id, 'group-ungrouped');
                    }
                });
            }
        });
    }

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
            sendResponse({ success: true });
        } else if (request.action === 'groupTabs') {
            groupTabs();
            sendResponse({ success: true });
        } else if (request.action === 'userFeedback') {
            // Handle explicit user feedback
            processUserFeedback(request.feedback, request.tabIds);
            sendResponse({ success: true });
        } else if (request.action === 'getStatus') {
            // Return current status to popup
            sendResponse({
                settings: settings,
                groupCount: Object.keys(documentTopics).length,
                lastGrouped: new Date().toISOString()
            });
            return true; // Required for asynchronous response
        }
    });
}

// Export functions for testing
export {
  cosineSimilarity,
  jaccardSimilarity,
  generateGroupName,
  extractKeyphrases,
  extractPageTypes,
  groupTabs,
  isGroupableTab,
  clusterTabs,
  hierarchicalAgglomerativeClustering
};

// Run initialization when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('🔄 Extension installed or updated');
  initializeExtension();
});

// Also run initialization when service worker starts
initializeExtension();
