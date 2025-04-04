/*
 * Quantum Chaos Organizer (QCO) Algorithm
 * 
 * This module provides an experimental implementation of the Quantum Chaos Organizer (QCO),
 * a groundbreaking algorithm that leverages principles from chaos theory and quantum mechanics
 * to organize browser tabs. It operates entirely locally to respect user privacy.
 *
 * Key principles and potential enhancements:
 * - Introduces randomness and non-linearity into grouping decisions.
 * - Emulates quantum uncertainty (e.g., superposition and decoherence) via stochastic processes.
 * - Balances deterministic content analysis with chaotic, adaptive grouping.
 * - May use historical user interaction data for refined probabilistic predictions (future work).
 *
 * Potential trade-offs:
 * - Higher computational complexity compared to traditional algorithms.
 * - Non-deterministic outcomes may require user calibration.
 *
 * Usage Example:
 *
 *   const tabs = [
 *     { id: 1, title: "News Article", url: "https://news.com/article" },
 *     { id: 2, title: "Research Paper", url: "https://example.edu/paper" },
 *     // ... more tabs
 *   ];
 *
 *   const groups = groupTabsQuantumChaosOrganizer(tabs);
 *   console.log(groups);
 *
 * Future enhancements may include integration with real user interaction data, tuning
 * of randomness parameters, and fallback mechanisms to traditional algorithms.
 */

// Import utilities
import { isStopWord } from '../utils/preprocessing.js';
import { cosineSimilarity } from '../utils/math.js';


/**
 * Simulates the Quantum Chaos Organizer (QCO) algorithm to group browser tabs.
 * @param {Array<Object>} tabs - Array of tab objects, each containing at least an id, title, and url.
 * @returns {Array<Array<Object>>} - Array of tab groups (each group is an array of tab objects).
 */
export function groupTabsQuantumChaosOrganizer(tabs) {
  console.log('🧪 QCO algorithm started with', tabs.length, 'tabs');
  
  if (!tabs || !Array.isArray(tabs) || tabs.length === 0) {
    console.warn('⚠️ QCO received invalid or empty tabs array');
    return [];
  }

  // Filter out any pinned tabs (defensive programming)
  const unpinnedTabs = tabs.filter(tab => !tab.pinned);
  console.log('📑 QCO processing', unpinnedTabs.length, 'unpinned tabs');
  
  if (unpinnedTabs.length === 0) {
    console.warn('⚠️ QCO: No unpinned tabs to process');
    return [];
  }
  
  // Skip processing if we don't have enough tabs to form a reasonable group
  if (unpinnedTabs.length < 3) {
    console.log('📊 Not enough tabs for QCO to form meaningful groups');
    return [];
  }

  try {
    // Step 1: Extract basic features from tabs and add controlled randomness
    const tabFeatures = unpinnedTabs.map(tab => {
      // Ensure tab has required properties
      if (!tab.url || !tab.title) {
        console.warn(`⚠️ QCO: Tab missing required properties:`, tab);
        return {
          ...tab,
          features: {},
          chaosFactor: Math.random() * 0.4 + 0.6
        };
      }
      
      return {
        ...tab,
        features: extractBasicFeatures(tab.url, tab.title),
        chaosFactor: Math.random() * 0.4 + 0.6 // Controlled randomness (0.6-1.0)
      };
    });
    
    console.log('🔀 QCO: Feature extraction complete with chaos factors');
    
    // Step 2: Calculate similarity matrix with chaos influence
    const similarityMatrix = calculateSimilarityMatrix(tabFeatures);
    console.log('📊 QCO: Similarity matrix created');
    
    // Step 3: Apply clustering with chaos-weighted edges
    const groups = chaosWeightedClustering(tabFeatures, similarityMatrix);
    console.log(`🧩 QCO: Created ${groups.length} groups`);
    
    return groups;
  } catch (error) {
    console.error('❌ QCO algorithm error:', error);
    
    // Fallback to a simple fixed-size grouping if an error occurs
    console.log('⚠️ QCO: Using fallback grouping method');
    
    // Create simple groups of 3-4 tabs
    const groupSize = 3;
    const groups = [];
    
    for (let i = 0; i < unpinnedTabs.length; i += groupSize) {
      const group = unpinnedTabs.slice(i, i + groupSize).map(tab => ({
        id: tab.id,
        pinned: tab.pinned,
        url: tab.url,
        title: tab.title
      }));
      
      if (group.length >= 3) {
        groups.push(group);
      }
    }
    
    console.log(`🧩 QCO fallback: Created ${groups.length} groups`);
    return groups;
  }
}

/**
 * Extracts basic features from URL and title
 * @param {string} url - The URL of the tab
 * @param {string} title - The title of the tab
 * @returns {Object} - Object with terms as keys and frequencies as values
 */
function extractBasicFeatures(url, title) {
  try {
    // Simple keyword extraction from URL and title
    const text = `${url} ${title}`.toLowerCase();
    const terms = (text.match(/\b\w{3,}\b/g) || [])
      .filter(word => !isStopWord(word));
    
    // If very few terms, return empty object to rely more on chaos
    if (terms.length < 3) {
      return {};
    }
    
    // Use imported isStopWord
    const terms = (text.match(/\b\w{3,}\b/g) || [])
      .filter(word => !isStopWord(word)); // Use imported function here

    // If very few terms, return empty object to rely more on chaos
    if (terms.length < 3) {
      return {};
    }

    // Convert to term frequency map
    return terms.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});
  } catch (error) {
    console.error('❌ Error extracting features:', error);
    return {};
  }
}


/**
 * Calculate similarity matrix between tabs
 * @param {Array<Object>} tabFeatures - Array of tab objects with features
 * @returns {Array<Array<number>>} - 2D similarity matrix
 */
function calculateSimilarityMatrix(tabFeatures) {
  try {
    const n = tabFeatures.length;
    const matrix = Array(n).fill().map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      // A tab is perfectly similar to itself
      matrix[i][i] = 1;
      
      for (let j = i + 1; j < n; j++) {
        try {
          // Calculate content similarity
          // Use imported cosineSimilarity
          const contentSimilarity = cosineSimilarity(
            tabFeatures[i].features,
            tabFeatures[j].features
          );
          
          // Apply chaos factor to similarity
          const chaosFactor = (tabFeatures[i].chaosFactor + tabFeatures[j].chaosFactor) / 2;
          
          // Blend deterministic similarity with chaos factor
          // Higher chaos weight (0.4) means more randomness in grouping
          const chaosWeight = 0.4;
          matrix[i][j] = (1 - chaosWeight) * contentSimilarity + chaosWeight * chaosFactor;
          matrix[j][i] = matrix[i][j]; // Symmetric matrix
        } catch (error) {
          console.error(`❌ Error calculating similarity between tabs ${i} and ${j}:`, error);
          // Use just chaos factor if similarity calculation fails
          const chaosFactor = (tabFeatures[i].chaosFactor + tabFeatures[j].chaosFactor) / 2;
          matrix[i][j] = chaosFactor;
          matrix[j][i] = chaosFactor;
        }
      }
    }
    
    return matrix;
  } catch (error) {
    console.error('❌ Error building similarity matrix:', error);
    
    // Return a default matrix with random values
    const n = tabFeatures.length;
    const defaultMatrix = Array(n).fill().map(() => Array(n).fill(0));
    
    // Fill with random values weighted toward keeping tabs separate
    for (let i = 0; i < n; i++) {
      defaultMatrix[i][i] = 1; // Identical to self
      for (let j = i + 1; j < n; j++) {
        const val = Math.random() * 0.3; // Low similarity
        defaultMatrix[i][j] = val;
        defaultMatrix[j][i] = val;
      }
    }
    
    return defaultMatrix;
  }
}


/**
 * Apply chaos-weighted clustering to form tab groups
 * @param {Array<Object>} tabFeatures - Array of tab objects with features
 * @param {Array<Array<number>>} similarityMatrix - 2D similarity matrix
 * @returns {Array<Array<Object>>} - Array of tab groups
 */
function chaosWeightedClustering(tabFeatures, similarityMatrix) {
  try {
    const n = tabFeatures.length;

    // If we have very few tabs, apply simpler grouping logic
    if (n < 3) { // Changed from <= 3 to < 3 as QCO already checks for < 3 earlier
      console.log('📊 Not enough tabs for complex clustering, applying simple grouping');
      return n === 0 ? [] : [tabFeatures.map(tab => ({
        id: tab.id,
        pinned: tab.pinned,
        url: tab.url,
        title: tab.title
      }))];
    }
    
    // Determine similarity threshold with some randomness for quantum-inspired behavior
    const baseSimilarityThreshold = 0.35;
    const randomThresholdFactor = Math.random() * 0.1 - 0.05; // +/- 0.05
    const similarityThreshold = baseSimilarityThreshold + randomThresholdFactor;
    
    console.log(`🎯 QCO using similarity threshold: ${similarityThreshold.toFixed(2)}`);
    
    // Step 1: Initialize each tab as its own cluster
    // Ensure 'index' is correctly assigned based on the input tabFeatures array
    let clusters = tabFeatures.map((tab, idx) => ({
      tabs: [{...tab, index: idx}], // Store index within the tab object itself for consistency
      index: idx // Keep top-level index for initial mapping if needed elsewhere
    }));
    
    // Step 2: Merge clusters based on similarity until no more merges are possible
    let mergeOccurred = true;
    let iterationCount = 0;
    const maxIterations = Math.min(100, n * 2); // Safety limit to prevent infinite loops
    
    while (mergeOccurred && clusters.length > 1 && iterationCount < maxIterations) {
      mergeOccurred = false;
      iterationCount++;
      
      // Find best pair to merge
      let bestSimilarity = similarityThreshold;
      let mergePair = [-1, -1];
      
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          try {
            const similarity = calculateClusterSimilarity(
              clusters[i], 
              clusters[j], 
              similarityMatrix
            );
            
            if (similarity > bestSimilarity) {
              bestSimilarity = similarity;
              mergePair = [i, j];
              mergeOccurred = true;
            }
          } catch (error) {
            console.error(`❌ Error calculating similarity between clusters ${i} and ${j}:`, error);
          }
        }
      }
      
      // Merge the best pair if found
      if (mergeOccurred) {
        const [i, j] = mergePair;
        console.log(`🔗 QCO merging clusters with similarity ${bestSimilarity.toFixed(2)}`);
        clusters[i].tabs = clusters[i].tabs.concat(clusters[j].tabs);
        clusters.splice(j, 1);
      }
    }
    
    console.log(`📊 QCO clustering completed after ${iterationCount} iterations with ${clusters.length} clusters`);
    
    // Step 3: Convert cluster objects to tab arrays and filter out small groups
    const finalGroups = clusters
      .map(cluster => cluster.tabs.map(tab => ({
        id: tab.id,
        pinned: tab.pinned,
        url: tab.url,
        title: tab.title
      })))
      .filter(group => group.length > 2);
    
    console.log(`🧩 QCO produced ${finalGroups.length} groups after filtering small ones`);
    
    // If no groups were created, try an alternative approach by lowering the threshold
    if (finalGroups.length === 0 && tabFeatures.length >= 5) {
      console.log('⚠️ QCO produced no groups, trying with lower threshold');
      
      // Create groups based on a lower similarity threshold
      const lowerThreshold = Math.max(0.15, similarityThreshold - 0.2);
      console.log(`🎯 Trying again with lower threshold: ${lowerThreshold.toFixed(2)}`);
      
      // Initialize clusters again
      clusters = tabFeatures.map((tab, index) => ({
        tabs: [tab],
        index: index
      }));
      
      // Do one pass with lower threshold
      let anyMerges = false;
      
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          try {
            const similarity = calculateClusterSimilarity(
              clusters[i], 
              clusters[j], 
              similarityMatrix
            );
            
            if (similarity > lowerThreshold) {
              // Merge these clusters
              clusters[i].tabs = clusters[i].tabs.concat(clusters[j].tabs);
              clusters.splice(j, 1);
              j--; // Adjust index after removal
              anyMerges = true;
            }
          } catch (error) {
            // Ignore errors in fallback approach
          }
        }
      }
      
      if (anyMerges) {
        // Convert to final format
        const fallbackGroups = clusters
          .map(cluster => cluster.tabs.map(tab => ({
            id: tab.id,
            pinned: tab.pinned,
            url: tab.url,
            title: tab.title
          })))
          .filter(group => group.length > 2);
        
        console.log(`🧩 QCO fallback produced ${fallbackGroups.length} groups`);
        return fallbackGroups;
      }
    }
    
    return finalGroups;
  } catch (error) {
    console.error('❌ Error in chaosWeightedClustering:', error);
    
    // Internal QCO fallback logic (previously in background.js or similar)
    console.log('⚠️ QCO: Using internal fallback grouping method due to clustering error');
    const groupSize = 3;
    const fallbackGroups = [];
    // Use tabFeatures which contains the unpinned tabs
    for (let i = 0; i < tabFeatures.length; i += groupSize) {
      const group = tabFeatures.slice(i, i + groupSize).map(tab => ({
        id: tab.id,
        pinned: tab.pinned, // Keep original pinned status if needed downstream
        url: tab.url,
        title: tab.title
      }));
      // Filter groups by size *after* mapping
      if (group.length >= 2) { // Use a minimum size, e.g., 2 or 3
        fallbackGroups.push(group);
      }
    }
    console.log(`🧩 QCO internal fallback (error recovery): Created ${fallbackGroups.length} groups`);
    return fallbackGroups;
  }
}

/**
 * Calculate similarity between two clusters
 * @param {Object} cluster1 - First cluster
 * @param {Object} cluster2 - Second cluster
 * @param {Array<Array<number>>} similarityMatrix - 2D similarity matrix
 * @returns {number} - Average similarity between clusters
 */
function calculateClusterSimilarity(cluster1, cluster2, similarityMatrix) {
  try {
    let totalSimilarity = 0;
    let comparisonCount = 0;
    
    // Calculate average similarity between all pairs of tabs in the two clusters
    for (const tab1 of cluster1.tabs) {
      // Use the index property stored on the tab feature object
      const index1 = tab1.index;

      for (const tab2 of cluster2.tabs) {
        const index2 = tab2.index;

        // Check bounds using the matrix dimensions directly
        if (index1 === undefined || index2 === undefined ||
            index1 < 0 || index1 >= similarityMatrix.length ||
            index2 < 0 || index2 >= similarityMatrix.length ||
            !similarityMatrix[index1]) { // Check row existence
          console.warn(`⚠️ Invalid indices or matrix access: ${index1}, ${index2} for matrix size ${similarityMatrix.length}`);
          continue;
        }

        // Ensure the column index is also valid for the specific row
        if (index2 >= similarityMatrix[index1].length) {
             console.warn(`⚠️ Invalid column index: ${index2} for row ${index1} with length ${similarityMatrix[index1].length}`);
             continue;
        }

        totalSimilarity += similarityMatrix[index1][index2];
        comparisonCount++;
      }
    }
    
    return comparisonCount === 0 ? 0 : totalSimilarity / comparisonCount;
  } catch (error) {
    console.error('❌ Error calculating cluster similarity:', error);
    return 0; // Return no similarity on error
  }
} 
