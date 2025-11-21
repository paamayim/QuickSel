chrome.action.onClicked.addListener(async (tab) => {
	await chrome.scripting.executeScript({
		target: { tabId: tab.id },
		func: togglePanel
	});
});

function togglePanel() {
	if (typeof window.quickSelToggle === 'function') {
		window.quickSelToggle();
	}
}