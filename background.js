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
        groupingAlgorithm: 'tfidf', // 'tfidf', 'bm25', 'keyphrase', 'hac', or 'lsa'
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

        // Expanded stop words list for better phrase boundary detection
        const stopWords = new Set([
            'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'this', 'about', 'that', 'and', 'or', 'but', 'from', 'as', 'it',
            'are', 'was', 'be', 'being', 'been', 'has', 'have', 'had', 'do', 'does', 'did',
            'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can',
            'you', 'your', 'yours', 'we', 'our', 'ours', 'they', 'their', 'theirs',
            'he', 'his', 'him', 'she', 'her', 'hers', 'its', 'my', 'mine', 'i', 'me',
            'who', 'whom', 'whose', 'which', 'what', 'where', 'when', 'why', 'how'
        ]);
        
        // Improved sentence splitting with better handling of punctuation
        const sentences = text.toLowerCase()
            .replace(/\s+/g, ' ')
            .split(/[.!?;]+/)
            .filter(s => s.trim().length > 0);
        
        const phraseList = [];

        // Extract candidate phrases
        sentences.forEach(sentence => {
            const words = sentence.trim().split(/\s+/);
            let phrase = [];
            
            words.forEach(word => {
                // Clean the word of non-alphanumeric characters
                word = word.replace(/[^\w]/g, '');
                
                // Add word to current phrase if it's not a stop word and has sufficient length
                if (!stopWords.has(word) && word.length > 1) {
                    phrase.push(word);
                } else if (phrase.length > 0) {
                    // End of a phrase
                    if (phrase.length >= 1 && phrase.length <= 5) {
                        // Only keep phrases of reasonable length (1-5 words)
                        phraseList.push(phrase);
                    }
                    phrase = [];
                }
            });
            
            // Add the last phrase if it exists
            if (phrase.length >= 1 && phrase.length <= 5) {
                phraseList.push(phrase);
            }
        });

        // Skip further processing if no phrases were found
        if (phraseList.length === 0) {
            return [];
        }

        // Calculate word statistics
        const wordFreq = {};
        const wordDegree = {};

        phraseList.forEach(phrase => {
            // Degree is based on phrase length - longer phrases give higher degree
            const degree = phrase.length - 1;
            
            phrase.forEach(word => {
                wordFreq[word] = (wordFreq[word] || 0) + 1;
                wordDegree[word] = (wordDegree[word] || 0) + degree;
            });
        });

        // Calculate word scores using the RAKE formula
        const wordScore = {};
        for (const word in wordFreq) {
            // RAKE score: word degree + word frequency / word frequency
            wordScore[word] = (wordDegree[word] + wordFreq[word]) / wordFreq[word];
        }

        // Score phrases by summing the scores of their constituent words
        const phraseScores = phraseList.map(phrase => {
            const score = phrase.reduce((sum, word) => sum + wordScore[word], 0);
            return [phrase.join(' '), score, phrase.length];
        });

        // Sort by score and then prefer shorter phrases when scores are close
        phraseScores.sort((a, b) => {
            const scoreDiff = b[1] - a[1];
            // If scores are very close, prefer the shorter phrase
            if (Math.abs(scoreDiff) < 0.5) {
                return a[2] - b[2]; // Sort by length (ascending)
            }
            return scoreDiff; // Otherwise sort by score (descending)
        });

        // Return unique keyphrases
        const uniquePhrases = new Set();
        const result = [];
        
        for (const [phrase, score] of phraseScores) {
            if (!uniquePhrases.has(phrase)) {
                uniquePhrases.add(phrase);
                result.push(phrase);
                if (result.length >= numPhrases) break;
            }
        }
        
        return result;
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
            return "Grouped Tabs";
        }
        
        // Expanded stop words list for better name generation
        const stopWords = new Set([
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'is', 'this', 'about', 'that', 'as', 'it', 'from', 'are', 'was', 'be', 'been',
            'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
            'may', 'might', 'must', 'can', 'you', 'your', 'we', 'our', 'they', 'their',
            'he', 'his', 'she', 'her', 'its', 'my', 'i', 'me', 'com', 'org', 'net', 'www',
            'http', 'https', 'html', 'htm', 'php', 'asp', 'jsp', 'xml', 'css', 'js'
        ]);
        
        // Extract domain names for potential use in group naming
        const domains = [];
        const urlRegex = /https?:\/\/([^\/]+)/i;
        
        for (const doc of clusterDocs) {
            const match = doc.match(urlRegex);
            if (match && match[1]) {
                // Extract domain without www. and .com/.org/etc.
                let domain = match[1].replace(/^www\./, '').split('.')[0];
                if (domain && domain.length > 2 && !stopWords.has(domain)) {
                    domains.push(domain);
                }
            }
        }
        
        // Process all terms from the documents
        const combinedTerms = clusterDocs.join(' ')
            .toLowerCase()
            .replace(/[^\w\s-]/g, ' ')  // Replace non-word chars with spaces
            .split(/\s+/)
            .filter(term => term.length > 3 && !stopWords.has(term));
        
        // Count term frequencies
        const termFreq = {};
        combinedTerms.forEach(term => {
            termFreq[term] = (termFreq[term] || 0) + 1;
        });
        
        // Sort terms by frequency
        const sortedTerms = Object.entries(termFreq)
            .sort((a, b) => b[1] - a[1])
            .filter(([term]) => !term.match(/^\d+$/)); // Remove purely numeric terms
        
        // Prioritize domain names if they're common across the cluster
        const domainFreq = {};
        domains.forEach(domain => {
            domainFreq[domain] = (domainFreq[domain] || 0) + 1;
        });
        
        const commonDomains = Object.entries(domainFreq)
            .filter(([_, count]) => count > 1)
            .sort((a, b) => b[1] - a[1])
            .map(([domain]) => domain);
        
        // Generate name based on common domains or top terms
        let groupName = "";
        
        if (commonDomains.length > 0) {
            // Use the most common domain as the primary identifier
            groupName = commonDomains[0].charAt(0).toUpperCase() + commonDomains[0].slice(1);
            
            // Add a descriptive term if available
            if (sortedTerms.length > 0) {
                const topTerm = sortedTerms[0][0];
                // Only add if it's not too similar to the domain
                if (!commonDomains[0].includes(topTerm) && !topTerm.includes(commonDomains[0])) {
                    groupName += ": " + topTerm.charAt(0).toUpperCase() + topTerm.slice(1);
                }
            }
        } else if (sortedTerms.length > 0) {
            // Use top 2 terms if no common domains
            const topTerms = sortedTerms.slice(0, 2).map(([term]) => 
                term.charAt(0).toUpperCase() + term.slice(1)
            );
            groupName = topTerms.join(" ");
        } else {
            // Fallback if no good terms found
            groupName = "Grouped Tabs";
        }
        
        // Ensure the name isn't too long
        return groupName.substring(0, settings.maxGroupNameLength);
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

            const clusters = clusterTabs(tabVectors);

            // Group tabs based on clusters
            for (const cluster of clusters) {
                if (cluster.length > 1) {
                    try {
                        const groupId = await chrome.tabs.group({ tabIds: cluster.map(Number) });
                        const groupName = generateGroupName(cluster.map(tabId => {
                            const tab = tabs.find(t => t.id === Number(tabId));
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
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = {
        cosineSimilarity,
        jaccardSimilarity,
        generateGroupName,
        extractKeyphrases,
      };
    }
