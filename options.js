/**
 * Save settings to chrome.storage.sync and notify background script
 */
function saveSettings() {
    const settings = {
        groupingAlgorithm: document.getElementById('groupingAlgorithm').value,
        similarityThreshold: parseFloat(document.getElementById('similarityThreshold').value),
        groupingInterval: parseInt(document.getElementById('groupingInterval').value, 10),
        maxGroupNameLength: parseInt(document.getElementById('maxGroupNameLength').value, 10),
        bm25k1: parseFloat(document.getElementById('bm25k1').value),
        bm25b: parseFloat(document.getElementById('bm25b').value),
        lsaDimensions: parseInt(document.getElementById('lsaDimensions').value, 10)
    };

    chrome.storage.sync.set(settings, function() {
        console.log('Settings saved');
        // Show a brief confirmation message
        const saveButton = document.getElementById('saveSettings');
        const originalText = saveButton.textContent;
        saveButton.textContent = 'Settings Saved!';
        saveButton.style.backgroundColor = '#2E7D32';
        setTimeout(() => {
            saveButton.textContent = originalText;
            saveButton.style.backgroundColor = '#4CAF50';
        }, 2000);

        // Notify background script, but suppress error if not connected
        try {
            chrome.runtime.sendMessage({action: 'updateSettings'}, function(response) {
                if (chrome.runtime.lastError) {
                    console.warn('Could not notify background script:', chrome.runtime.lastError.message);
                } else if (response && response.success) {
                    console.log('Background script acknowledged settings update');
                } else {
                    console.warn('Could not notify background script: No receiving end');
                }
            });
        } catch (e) {
            console.warn('Could not notify background script:', e.message);
        }
    });
}

/**
 * Load settings from chrome.storage.sync and update UI
 */
function loadSettings() {
    chrome.storage.sync.get({
        groupingAlgorithm: 'tfidf',
        similarityThreshold: 0.3,
        groupingInterval: 5,
        maxGroupNameLength: 15,
        bm25k1: 1.5,
        bm25b: 0.75,
        lsaDimensions: 50
    }, function(items) {
        document.getElementById('groupingAlgorithm').value = items.groupingAlgorithm;
        document.getElementById('similarityThreshold').value = items.similarityThreshold;
        document.getElementById('similarityThresholdValue').textContent = items.similarityThreshold;
        document.getElementById('groupingInterval').value = items.groupingInterval;
        document.getElementById('maxGroupNameLength').value = items.maxGroupNameLength;
        document.getElementById('bm25k1').value = items.bm25k1;
        document.getElementById('bm25b').value = items.bm25b;
        document.getElementById('lsaDimensions').value = items.lsaDimensions;

        toggleAlgorithmSettings();
        showAlgorithmDescription(items.groupingAlgorithm);
    });
}

/**
 * Toggle visibility of algorithm-specific settings sections
 */
function toggleAlgorithmSettings() {
    const algorithm = document.getElementById('groupingAlgorithm').value;

    document.getElementById('bm25Settings').style.display = 'none';
    document.getElementById('lsaSettings').style.display = 'none';

    if (algorithm === 'bm25') {
        document.getElementById('bm25Settings').style.display = 'block';
    } else if (algorithm === 'lsa') {
        document.getElementById('lsaSettings').style.display = 'block';
    }
}

/**
 * Show the description panel for the selected algorithm
 */
function showAlgorithmDescription(algorithm) {
    const descriptions = document.querySelectorAll('.algorithm-description');
    descriptions.forEach(desc => {
        desc.style.display = 'none';
    });

    const selectedDesc = document.getElementById(`${algorithm}-description`);
    if (selectedDesc) {
        selectedDesc.style.display = 'block';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', loadSettings);
document.getElementById('saveSettings').addEventListener('click', saveSettings);
document.getElementById('similarityThreshold').addEventListener('input', function() {
    document.getElementById('similarityThresholdValue').textContent = this.value;
});
document.getElementById('groupingAlgorithm').addEventListener('change', function() {
    toggleAlgorithmSettings();
    showAlgorithmDescription(this.value);
});
