document.getElementById('groupNow').addEventListener('click', () => {
  console.log('🔍 Group Now button clicked, sending message to background');
  chrome.runtime.sendMessage({ action: 'groupTabs' }, (response) => {
    const resultElement = document.getElementById('groupResult');
    if (resultElement) {
      if (chrome.runtime.lastError) {
        resultElement.textContent = 'Error: ' + chrome.runtime.lastError.message;
        resultElement.style.color = 'red';
      } else {
        resultElement.textContent = 'Grouping process initiated!';
        resultElement.style.color = 'green';
      }
    }
    // Update stats after a short delay to reflect changes
    setTimeout(updateStats, 1000);
  });
});

document.getElementById('openSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Add diagnostics button
const diagBtn = document.createElement('button');
diagBtn.textContent = 'Run Diagnostics';
diagBtn.className = 'button-diag';
diagBtn.addEventListener('click', runDiagnostics);

// Add to the body instead of looking for .controls which doesn't exist
document.body.appendChild(diagBtn);

// Create result section
const resultSection = document.createElement('div');
resultSection.id = 'groupResult';
resultSection.style.marginTop = '10px';
resultSection.style.fontWeight = 'bold';
document.body.appendChild(resultSection);

function updateStats() {
  chrome.tabs.query({currentWindow: true}, (tabs) => {
    const totalTabs = tabs.length;
    let groupedTabs = 0;
    const groups = new Set();

    tabs.forEach(tab => {
      if (tab.groupId !== chrome.tabs.TAB_ID_NONE) {
        groupedTabs++;
        groups.add(tab.groupId);
      }
    });

    // Safely update stats elements
    const safeUpdateElement = (id, value) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    };

    safeUpdateElement('totalTabs', totalTabs);
    safeUpdateElement('groupedTabs', groupedTabs);
    safeUpdateElement('groupCount', groups.size);
  });
}

// Diagnostic function to test tab grouping functionality
async function runDiagnostics() {
  const diagResultElem = document.getElementById('groupResult');
  diagResultElem.textContent = 'Running diagnostics...';
  diagResultElem.style.color = 'blue';
  
  try {
    // 1. Check permissions
    const permissions = ['tabs', 'tabGroups'];
    const hasPermissions = await chrome.permissions.contains({permissions});
    
    if (!hasPermissions) {
      diagResultElem.textContent = 'Error: Required permissions are missing';
      diagResultElem.style.color = 'red';
      return;
    }
    
    // 2. Check settings
    chrome.storage.sync.get(null, (settings) => {
      console.log('📊 Current settings:', settings);
      
      // 3. Check current tabs
      chrome.tabs.query({currentWindow: true}, async (tabs) => {
        const groupableTabs = tabs.filter(tab => !tab.pinned && !tab.url.startsWith('chrome:'));
        
        console.log(`📑 Found ${tabs.length} tabs (${groupableTabs.length} groupable)`);
        
        if (groupableTabs.length < 3) {
          diagResultElem.textContent = 'Diagnostic: Not enough groupable tabs (need at least 3)';
          diagResultElem.style.color = 'orange';
          return;
        }
        
        // 4. Try a forced simple grouping of 3 tabs
        try {
          // Only try this if we have enough ungrouped tabs
          const ungroupedTabs = groupableTabs.filter(tab => tab.groupId === chrome.tabs.TAB_ID_NONE);
          
          if (ungroupedTabs.length >= 3) {
            const testGroupTabs = ungroupedTabs.slice(0, 3).map(tab => tab.id);
            
            diagResultElem.textContent = 'Testing tab grouping API...';
            
            // Create a simple test group
            const groupId = await chrome.tabs.group({tabIds: testGroupTabs});
            console.log(`✅ Created test group with ID ${groupId}`);
            
            // Name the group
            await chrome.tabGroups.update(groupId, {title: 'Test Group'});
            
            diagResultElem.textContent = 'Diagnostics passed! Tab grouping API is working';
            diagResultElem.style.color = 'green';
            
            // Clean up by ungrouping
            setTimeout(async () => {
              await chrome.tabs.ungroup(testGroupTabs);
              console.log('🧹 Cleaned up test group');
            }, 3000);
          } else {
            diagResultElem.textContent = 'Diagnostic: All tabs are already grouped!';
            diagResultElem.style.color = 'orange';
          }
        } catch (error) {
          console.error('❌ Tab grouping API error:', error);
          diagResultElem.textContent = `API Error: ${error.message}`;
          diagResultElem.style.color = 'red';
        }
      });
    });
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    diagResultElem.textContent = `Diagnostic error: ${error.message}`;
    diagResultElem.style.color = 'red';
  }
}

// Update stats when popup is opened
document.addEventListener('DOMContentLoaded', () => {
  // First ensure all required elements are present
  const elementsToCheck = ['totalTabs', 'groupedTabs', 'groupCount', 'groupNow', 'openSettings'];
  let allElementsPresent = true;
  
  for (const id of elementsToCheck) {
    if (!document.getElementById(id)) {
      console.error(`Missing required element: ${id}`);
      allElementsPresent = false;
    }
  }
  
  if (allElementsPresent) {
    updateStats();
  } else {
    console.error('Cannot initialize popup due to missing elements');
  }
  
  // Add CSS for diagnostic button
  const style = document.createElement('style');
  style.textContent = `
    .button-diag {
      background-color: #f0f0f0;
      border: 1px solid #999;
      color: #333;
      padding: 8px 12px;
      margin-top: 8px;
      border-radius: 4px;
      cursor: pointer;
    }
    .button-diag:hover {
      background-color: #e0e0e0;
    }
  `;
  document.head.appendChild(style);
});

// Listen for tab updates and refresh stats
chrome.tabs.onUpdated.addListener(updateStats);
chrome.tabs.onRemoved.addListener(updateStats);
chrome.tabGroups.onCreated.addListener(updateStats);
chrome.tabGroups.onRemoved.addListener(updateStats);
