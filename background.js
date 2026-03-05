// Clean up storage when a window is closed to prevent memory leaks
chrome.windows.onRemoved.addListener((windowId) => {
  chrome.storage.local.remove(windowId.toString());
});

// Handle a tab being dragged into a new window
chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
  const newWinId = attachInfo.newWindowId;
  
  // Check if the new window has a color assigned
  const data = await chrome.storage.local.get(newWinId.toString());
  const windowConfig = data[newWinId];

  // Send the config (or a reset command if no config exists) to the dragged tab
  if (windowConfig) {
    chrome.tabs.sendMessage(tabId, { action: "UPDATE_FOOTER", data: windowConfig }).catch(() => {});
  } else {
    chrome.tabs.sendMessage(tabId, { action: "UPDATE_FOOTER", data: { color: null, label: "" } }).catch(() => {});
  }
});

// Add to background.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const winId = sender.tab ? sender.tab.windowId : null;
  
  if (msg.action === "INIT_TAB" && winId) {
    Promise.all([
      chrome.storage.local.get(winId.toString()),
      chrome.storage.local.get('footerHeight')
    ]).then(([winData, heightData]) => {
      sendResponse({
        data: winData[winId],
        height: heightData.footerHeight || 25
      });
    });
    return true; // Keep message channel open for async response
  }
  
  if (msg.action === "SAVE_LABEL" && winId) {
    chrome.storage.local.get(winId.toString()).then(data => {
      const currentConfig = data[winId] || {};
      const newConfig = { ...currentConfig, label: msg.label };
      chrome.storage.local.set({ [winId]: newConfig });
      
      // Broadcast label to other tabs in window
      chrome.tabs.query({ windowId: winId }).then(tabs => {
        tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { action: "UPDATE_FOOTER", data: newConfig }).catch(()=>{}));
      });
    });
  }
});