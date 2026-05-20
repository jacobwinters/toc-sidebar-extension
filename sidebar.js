let myWindowId = (await browser.windows.getCurrent()).id;
let port;

async function update(tabId) {
	port?.disconnect();
	try {
		let [success] = await browser.tabs.executeScript(tabId, {
			runAt: "document_start",
			file: "/content-script.js"
		});
		if (!success) throw null;
	} catch {
		document.body.replaceChildren();
		document.documentElement.style.backgroundColor = document.body.style.color = null;
	}
}

browser.runtime.onConnect.addListener((newPort) => {
	if (newPort.sender.tab.id !== currentTabId) return;
	port = newPort;

	port.onMessage.addListener((message) => {
		if (message.outline) {
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

			let [bgColorL, colorL] = parseColors(message.backgroundColor, message.color).map(luminance);
			document.documentElement.style.backgroundColor = message.backgroundColor;
			document.body.style.color = (Math.max(colorL, bgColorL) + 0.05) / (Math.min(colorL, bgColorL) + 0.05) > 7
				? message.color
				: `contrast-color(${message.backgroundColor})`;
		} else {
			for (let el of document.querySelectorAll(".active")) {
				el.classList.remove("active");
			}
		}
		for (let i of message.activeHeadings) {
			document.body.children[i].classList.add("active");
			document.body.children[i].scrollIntoView({ block: "nearest" });
		}
	});
});

// TODO Make sure this is perfectly in sync with native link behavior. Different OSes, mice vs trackpads, etc.
function linkClick(e) {
	if (!(e.button > 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) {
		browser.tabs.update({ url: e.target.href });
		e.preventDefault();
	}
}

let currentTabId = (await browser.tabs.query({ windowId: myWindowId, active: true }))[0].id;
update(currentTabId);

browser.webNavigation.onCommitted.addListener(({ tabId, frameId }) => {
	if (tabId === currentTabId && frameId === 0) {
		update(currentTabId);
	}
});

browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
	if (windowId === myWindowId && tabId !== currentTabId) {
		currentTabId = tabId;
		update(tabId);
	}
});


function parseColors(bg, fg) {
	let ctx = new OffscreenCanvas(1, 1).getContext("2d");
	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, 1, 1);
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, 1, 1);
	let bgRgba = ctx.getImageData(0, 0, 1, 1).data;
	ctx.fillStyle = fg;
	ctx.fillRect(0, 0, 1, 1);
	let fgRgba = ctx.getImageData(0, 0, 1, 1).data;
	return [bgRgba, fgRgba];
}

function luminance(rgb) {
	let [r, g, b] = [...rgb].map(x => x / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
