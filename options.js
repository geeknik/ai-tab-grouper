// Function to save settings
function saveSettings() {
    const settings = {
        groupingAlgorithm: document.getElementById('groupingAlgorithm').value,
        similarityThreshold: parseFloat(document.getElementById('similarityThreshold').value),
        groupingInterval: parseInt(document.getElementById('groupingInterval').value),
        maxGroupNameLength: parseInt(document.getElementById('maxGroupNameLength').value),
        bm25k1: parseFloat(document.getElementById('bm25k1').value),
        bm25b: parseFloat(document.getElementById('bm25b').value),
        lsaDimensions: parseInt(document.getElementById('lsaDimensions').value || 50)
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
        
        // Notify the background script to update its settings
        chrome.runtime.sendMessage({action: 'updateSettings'}, response => {
            // Handle potential error with the background page not being ready
            if (chrome.runtime.lastError) {
                console.warn('Could not notify background script:', chrome.runtime.lastError.message);
                // Continue anyway - settings will be loaded next time background runs
            } else if (response && response.success) {
                console.log('Background script acknowledged settings update');
            }
        });
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
        
        // Update UI based on loaded settings
        toggleAlgorithmSettings();
        showAlgorithmDescription(items.groupingAlgorithm);
    });
}

// Function to toggle algorithm-specific settings visibility
function toggleAlgorithmSettings() {
    const algorithm = document.getElementById('groupingAlgorithm').value;
    
    // Hide all algorithm-specific settings first
    document.getElementById('bm25Settings').style.display = 'none';
    document.getElementById('lsaSettings').style.display = 'none';
    
    // Show settings for the selected algorithm
    if (algorithm === 'bm25') {
        document.getElementById('bm25Settings').style.display = 'block';
    } else if (algorithm === 'lsa') {
        document.getElementById('lsaSettings').style.display = 'block';
    }
}

// Function to show the description for the selected algorithm
function showAlgorithmDescription(algorithm) {
    // Hide all descriptions first
    const descriptions = document.querySelectorAll('.algorithm-description');
    descriptions.forEach(desc => {
        desc.style.display = 'none';
    });
    
    // Show the selected algorithm's description
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

// Update UI when algorithm changes
document.getElementById('groupingAlgorithm').addEventListener('change', function() {
    toggleAlgorithmSettings();
    showAlgorithmDescription(this.value);
});
