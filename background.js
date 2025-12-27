chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Try to send message to existing content script
    await chrome.tabs.sendMessage(tab.id, { action: "toggle_panel" });
  } catch (error) {
    // Content script not loaded yet - inject it first
    if (tab.url && tab.url.includes("web.whatsapp.com")) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["style.css"]
      });
      // Now send the toggle message
      await chrome.tabs.sendMessage(tab.id, { action: "toggle_panel" });
    }
  }
});