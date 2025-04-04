// Import utilities
// Import utilities
import { isStopWord, tokenize, preprocessDocument } from './src/utils/preprocessing.js';
import { cosineSimilarity } from './src/utils/math.js';
// Import quantum chaos organizer module
import { groupTabsQuantumChaosOrganizer } from './src/quantumChaosOrganizer.js';


// Calculate a deterministic but chaotic entropy value for a URL
function calculateTabEntropy(url) {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        console.warn('⚠️ QCO: Not enough tabs for meaningful analysis');
        return [];
    }

    try {
        // Step 1: Extract basic features from tabs with controlled randomness
        const tabFeatures = tabs.map(tab => {
            // Extract text content
            const text = `${tab.url} ${tab.title}`;
            
            // Set a controlled randomness factor unique to each tab
            // This is deterministic but appears random, based on hashing the URL
            const entropy = calculateTabEntropy(tab.url);
            
            // Generate a chaos factor between 0.5 and 1.0
            // Higher values mean more randomness in grouping decisions
            const chaosFactor = 0.5 + (entropy * 0.5);
            // Use tokenize from preprocessing.js
            const terms = tokenize(text, {
                removeStopWords: true,
                removeWebStopWords: true,
                minWordLength: 3,
                toLowerCase: true
            });

            const termFreq = {};
            terms.forEach(term => {
                termFreq[term] = (termFreq[term] || 0) + 1;
            });
            
            return {
                id: tab.id,
                url: tab.url,
                title: tab.title,
                terms: termFreq,
                entropy: entropy,
                chaosFactor: chaosFactor
            };
        });
        
        console.log('🔀 QCO: Feature extraction complete with entropy factors');
        
        // Step 2: Calculate similarity matrix with quantum-inspired randomness
        const similarityMatrix = calculateQuantumSimilarityMatrix(tabFeatures);
        
        // Step 3: Apply clustering with chaos influence
        const groups = quantumClustering(tabFeatures, similarityMatrix, settings.similarityThreshold);
        console.log(`🧩 QCO: Created ${groups.length} groups`);
        
        return groups;
    } catch (error) {
        console.error('❌ QCO algorithm error:', error);
        
        // Fallback to a simple grouping if an error occurs
        console.log('⚠️ QCO: Using fallback grouping method');
        return fallbackGrouping(tabs);
// Simple fallback grouping (keep if used outside QCO)
function fallbackGrouping(tabs) {
    const groups = [];
    const groupSize = 3;
    
    for (let i = 0; i < tabs.length; i += groupSize) {
        const group = tabs.slice(i, i + groupSize);
        if (group.length >= 2) {
            groups.push(group);
        }
    }
    
    return groups;
}


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
async function loadSettings() {
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
    // Use tokenize from preprocessing.js
    const terms = tokenize(newDocument, {
        removeStopWords: true,
        removeWebStopWords: true,
        minWordLength: 3,
        toLowerCase: true
    });
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


// Updated BM25 tokenization (similar to TF-IDF)
function updateBM25(newDocument, docId) {
    // Use tokenize from preprocessing.js
    const terms = tokenize(newDocument, {
        removeStopWords: true,
        removeWebStopWords: true,
        minWordLength: 3,
        toLowerCase: true
    });
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
    // Use tokenize:
    const words = tokenize(cleanText, {
        removeStopWords: true,
        removeWebStopWords: true,
        minWordLength: 3,
        toLowerCase: false // Keep original case for potential capitalization bonus logic
    });

    // Build n-grams (2-word and 3-word phrases)
    const ngrams = [];
    const ngramFreq = {};
    
    // Generate 2-grams and 3-grams
    for (let n of [2, 3]) {
        for (let i = 0; i <= words.length - n; i++) {
            const phrase = words.slice(i, i + n).join(' ');

            // Skip phrases that are all stopwords or too short
            // Replace with a check using the imported isStopWord:
            const phraseWords = phrase.split(' ');
            if (phraseWords.every(word => isStopWord(word)) || phrase.length < 5) continue;

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
    // Use tokenize:
    const terms = tokenize(newDocument, {
        removeStopWords: true,
        removeWebStopWords: true,
        minWordLength: 3,
        toLowerCase: true
    });

    // Skip if not enough terms
    if (terms.length < 3) {
        lsaVectors[docId] = {};
        return;
    }

    // Create a term frequency vector
    const termFreq = {};
    terms.forEach(term => {
        termFreq[term] = (termFreq[term] || 0) + 1;
        vocabulary.add(term);
    });
    
    // Store term frequency vector
    documents[docId] = termFreq;
    
    // Only perform LSA if we have enough documents (at least 3)
    if (Object.keys(documents).length >= 3) {
        console.log(`🔄 Running LSA on ${Object.keys(documents).length} documents`);
        performLSA();
    } else {
        // Not enough documents yet, just use term frequency
        lsaVectors[docId] = termFreq;
    }
}

// Performs Latent Semantic Analysis on the document collection
function performLSA() {
    const numDocs = Object.keys(documents).length;
    if (numDocs < 3) return; // Need at least 3 documents for meaningful LSA
    
    // Create a list of all terms across all documents
    const allTerms = Array.from(vocabulary);
    
    // Create the term-document matrix
    const termDocMatrix = [];
    for (let i = 0; i < allTerms.length; i++) {
        const term = allTerms[i];
        const row = [];
        
        for (const docId in documents) {
            // Get the TF-IDF weight for this term in this document
            const tf = documents[docId][term] || 0;
            // Use log-entropy weighting - log(1 + tf) * idf 
            row.push(tf > 0 ? (1 + Math.log(tf)) * (idf[term] || 1) : 0);
        }
        
        termDocMatrix.push(row);
    }
    
    // Compute SVD (simplified implementation)
    const { U, S, V } = computeSVD(termDocMatrix);
    
    // Get the number of dimensions to keep (k)
    const k = Math.min(
        Math.min(settings.lsaDimensions || 25, Math.floor(numDocs / 2)),
        Math.min(U.length, V.length) // Can't have more dimensions than we have data
    );
    
}
