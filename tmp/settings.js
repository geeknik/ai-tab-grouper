// Function to save settings
function saveSettings() {
    const settings = {
        groupingAlgorithm: document.getElementById('groupingAlgorithm').value,
        similarityThreshold: parseFloat(document.getElementById('similarityThreshold').value),
        groupingInterval: parseInt(document.getElementById('groupingInterval').value),
        maxGroupNameLength: parseInt(document.getElementById('maxGroupNameLength').value),
        bm25k1: parseFloat(document.getElementById('bm25k1').value),
        bm25b: parseFloat(document.getElementById('bm25b').value)
    };

    chrome.storage.sync.set(settings, function() {
        console.log('Settings saved');
        // Notify the background script to update its settings
        chrome.runtime.sendMessage({action: 'updateSettings'});
    });
}

// Function to load settings
function loadSettings() {
    chrome.storage.sync.get({
        groupingAlgorithm: 'tfidf',
        similarityThreshold: 0.3,
        groupingInterval: 5,
        maxGroupNameLength: 15,
        bm25k1: 1.5,
        bm25b: 0.75
    }, function(items) {
        document.getElementById('groupingAlgorithm').value = items.groupingAlgorithm;
        document.getElementById('similarityThreshold').value = items.similarityThreshold;
        document.getElementById('similarityThresholdValue').textContent = items.similarityThreshold;
        document.getElementById('groupingInterval').value = items.groupingInterval;
        document.getElementById('maxGroupNameLength').value = items.maxGroupNameLength;
        document.getElementById('bm25k1').value = items.bm25k1;
        document.getElementById('bm25b').value = items.bm25b;
        toggleBM25Settings();
    });
}

// Function to toggle BM25 settings visibility
function toggleBM25Settings() {
    const bm25Settings = document.getElementById('bm25Settings');
    if (document.getElementById('groupingAlgorithm').value === 'bm25') {
        bm25Settings.style.display = 'block';
    } else {
        bm25Settings.style.display = 'none';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', loadSettings);
document.getElementById('saveSettings').addEventListener('click', saveSettings);
document.getElementById('similarityThreshold').addEventListener('input', function() {
    document.getElementById('similarityThresholdValue').textContent = this.value;
});
document.getElementById('groupingAlgorithm').addEventListener('change', toggleBM25Settings);
