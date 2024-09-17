document.getElementById('groupNow').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'groupTabs' });
});

document.getElementById('openSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

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

    document.getElementById('totalTabs').textContent = totalTabs;
    document.getElementById('groupedTabs').textContent = groupedTabs;
    document.getElementById('groupCount').textContent = groups.size;
  });
}

// Update stats when popup is opened
document.addEventListener('DOMContentLoaded', updateStats);

// Listen for tab updates and refresh stats
chrome.tabs.onUpdated.addListener(updateStats);
chrome.tabs.onRemoved.addListener(updateStats);
chrome.tabGroups.onCreated.addListener(updateStats);
chrome.tabGroups.onRemoved.addListener(updateStats);
