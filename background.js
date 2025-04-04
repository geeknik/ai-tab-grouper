/* global chrome */

// Import utilities
import { isStopWord, tokenize, preprocessDocument } from './src/utils/preprocessing.js';
import { cosineSimilarity } from './src/utils/math.js';

// Calculate a deterministic but chaotic entropy value for a URL
function calculateTabEntropy(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        hash = ((hash << 5) - hash) + url.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    // Normalize to 0..1
    return Math.abs(hash) / 0x7FFFFFFF;
}

// Placeholder for QCO similarity matrix calculation
function calculateQuantumSimilarityMatrix(tabFeatures) {
    const n = tabFeatures.length;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        matrix[i][i] = 1;
    }
    return matrix;
}

// Placeholder for QCO clustering
function quantumClustering(tabFeatures, similarityMatrix, threshold) {
    // For now, just group all tabs together
    return [tabFeatures.map(f => ({ id: f.id, url: f.url, title: f.title }))];
}

// Simple fallback grouping
function fallbackGrouping(tabs) {
    const groups = [];
    const groupSize = 3;
    for (let i = 0; i < tabs.length; i += groupSize) {
        const group = tabs.slice(i, i + groupSize);
        if (group.length >= 2) groups.push(group);
    }
    return groups;
}

// TF-IDF based grouping
function groupTabsTFIDF(tabs) {
    const docs = tabs.map(tab => preprocessDocument(`${tab.title} ${tab.url}`));
    const vectors = docs.map(d => d.normalizedFreq);

    const groups = [];
    const assigned = new Set();

    for (let i = 0; i < tabs.length; i++) {
        if (assigned.has(i)) continue;
        const group = [tabs[i]];
        assigned.add(i);

        for (let j = 0; j < tabs.length; j++) {
            if (i === j || assigned.has(j)) continue;
            const sim = cosineSimilarity(vectors[i], vectors[j]);
            if (sim >= settings.similarityThreshold) {
                group.push(tabs[j]);
                assigned.add(j);
            }
        }
        if (group.length >= 2) groups.push(group);
    }
    return groups;
}

// Generate a group title from the most common term in the group
function generateGroupTitle(tabs) {
    const termCounts = {};
    for (const tab of tabs) {
        const tokens = tokenize(`${tab.title} ${tab.url}`, {
            removeStopWords: true,
            removeWebStopWords: true,
            minWordLength: 3,
            toLowerCase: true
        });
        for (const token of tokens) {
            termCounts[token] = (termCounts[token] || 0) + 1;
        }
    }
    const sortedTerms = Object.entries(termCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([term]) => term);

    let title = sortedTerms[0] || 'Group';
    if (title.length > settings.maxGroupNameLength) {
        title = title.slice(0, settings.maxGroupNameLength);
    }
    return title.charAt(0).toUpperCase() + title.slice(1);
}

// Main QCO grouping function
function groupTabsQuantumChaosOrganizer(tabs) {
    if (!tabs || tabs.length < 2) {
        console.warn('⚠️ QCO: Not enough tabs for meaningful analysis');
        return [];
    }

    try {
        const tabFeatures = tabs.map(tab => {
            const text = `${tab.url} ${tab.title}`;
            const entropy = calculateTabEntropy(tab.url);
            const chaosFactor = 0.5 + (entropy * 0.5);
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
                entropy,
                chaosFactor
            };
        });

        console.log('🔀 QCO: Feature extraction complete with entropy factors');

        const similarityMatrix = calculateQuantumSimilarityMatrix(tabFeatures);

        const groups = quantumClustering(tabFeatures, similarityMatrix, settings.similarityThreshold);

        console.log(`🧩 QCO: Created ${groups.length} groups`);

        return groups;
    } catch (error) {
        console.error('❌ QCO algorithm error:', error);
        console.log('⚠️ QCO: Using fallback grouping method');
        return fallbackGrouping(tabs);
    }
}

// Log extension startup
console.log('🚀 AI Tab Grouper extension starting up');

let settings = {
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

async function loadSettings() {
    try {
        const items = await chrome.storage.sync.get(settings);
        settings = { ...settings, ...items };
        console.log('📊 Loaded settings:', settings);
        resetAlarm();
    } catch (e) {
        console.error('❌ Failed to load settings:', e);
    }
}

function resetAlarm() {
    chrome.alarms.clear('groupTabs', () => {
        if (settings.groupingInterval > 0) {
            chrome.alarms.create('groupTabs', { periodInMinutes: settings.groupingInterval });
        }
    });
}

async function groupTabs() {
    console.log('🔄 Grouping tabs using algorithm:', settings.groupingAlgorithm);
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const groupableTabs = tabs.filter(isGroupableTab);

    let groups = [];
    switch (settings.groupingAlgorithm) {
        case 'tfidf':
            groups = groupTabsTFIDF(groupableTabs);
            break;
        case 'qco':
            groups = groupTabsQuantumChaosOrganizer(groupableTabs);
            break;
        default:
            groups = [groupableTabs];
    }

    for (const group of groups) {
        if (group.length < 2) continue;
        const tabIds = group.map(t => t.id);
        try {
            const groupId = await chrome.tabs.group({ tabIds });
            const title = generateGroupTitle(group);
            await chrome.tabGroups.update(groupId, { title });
        } catch (e) {
            console.warn('⚠️ Could not group tabs:', e);
        }
    }
}

function isGroupableTab(tab) {
    if (tab.pinned) return false;
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) return false;
    return true;
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('🆕 Extension installed');
    loadSettings();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 Extension startup');
    loadSettings();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'updateSettings') {
        loadSettings().then(() => sendResponse({ success: true }));
        return true;
    }
    if (msg.action === 'groupTabs') {
        groupTabs().then(() => sendResponse({ success: true }));
        return true;
    }
});

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'groupTabs') {
        groupTabs();
    }
});

// Initialize immediately
loadSettings();
