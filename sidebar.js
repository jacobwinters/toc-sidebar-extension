let myWindowId = (await browser.windows.getCurrent()).id;
let port;

function update(tabId) {
	port?.disconnect();
	if (!tabId) return;
	port = browser.tabs.connect(tabId);

	document.body.replaceChildren();

	port.onMessage.addListener((message) => {
		if (message.type === "outline") {
			document.body.replaceChildren(...message.outline.map((entry, i) => {
				let el = document.createElement("a");
				el.textContent = entry.text;
				el.style.paddingLeft = entry.level * 16 + "px";
				if (entry.id) {
					el.href = message.url;
					el.hash = entry.id;
					el.addEventListener("click", linkClick);
				} else {
					el.addEventListener("click", () => {
						port.postMessage({ type: "scroll", heading: i });
					});
				}
				return el;
			}));
		} else if (message.type === "scroll") {
			for (let el of document.querySelectorAll(".active")) {
				el.classList.remove("active");
			}
			for (let i of message.activeHeadings) {
				document.body.children[i].classList.add("active");
				document.body.children[i].scrollIntoView({ block: "nearest" });
			}
		}
	});
}

// TODO Make sure this is perfectly in sync with native link behavior. Different OSes, mice vs trackpads, etc.
function linkClick(e) {
	if (!(e.button > 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) {
		browser.tabs.update({ url: e.target.href });
		e.preventDefault();
	}
}

let hasLoaded;
function tabUpdated(tabId, changeInfo) {
	if (changeInfo.status === "loading") {
		hasLoaded = false;
	}
	if (changeInfo.status === "complete" && !hasLoaded) {
		update(currentTabId);
		hasLoaded = true;
	}
}

function tabSwitched(tabId) {
	hasLoaded = false;
	update(tabId);
	browser.tabs.onUpdated.removeListener(tabUpdated);
	browser.tabs.onUpdated.addListener(tabUpdated, { tabId: tabId, properties: ["status"] });
}

let currentTabId = (await browser.tabs.query({ windowId: myWindowId, active: true }))[0].id;
tabSwitched(currentTabId);
browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
	if (windowId === myWindowId && tabId !== currentTabId) {
		currentTabId = tabId;
		tabSwitched(tabId);
	}
});
