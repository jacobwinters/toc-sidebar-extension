(function() {
	let port = browser.runtime.connect();
	let headings;

	function sendOutline() {
		headings = document.querySelectorAll(":is(h1, h2, h3, h4, h5, h6):not(nav *)");
		let outline = [];
		for (let heading of headings) {
			outline.push({ level: +heading.tagName.substring(1), text: heading.textContent, id: heading.id });
		}
		sendUpdate({ url: location.href, outline: outline });
	}

	function sendUpdate(message) {
		let activeHeadings = [];
		let thisTop;
		let nextTop = headings[0]?.getBoundingClientRect().top;
		for (let i = 0; i < headings.length; i++) {
			thisTop = nextTop;
			let active = thisTop < document.documentElement.clientHeight;
			if (i + 1 < headings.length) {
				nextTop = headings[i + 1].getBoundingClientRect().top;
				active &&= nextTop > 0;
			}
			if (active) {
				activeHeadings.push(i);
			}
		}
		port.postMessage({ ...message, activeHeadings: activeHeadings });
	}

	function updateActiveHeading() {
		sendUpdate({});
	}

	let observer = new MutationObserver(sendOutline);
	observer.observe(document, { childList: true, subtree: true });
	addEventListener("scroll", updateActiveHeading, { passive: true });
	addEventListener("resize", updateActiveHeading);

	sendOutline();

	port.onMessage.addListener((message) => {
		if (message.type === "scroll") {
			headings[message.heading].scrollIntoView();
		}
	});

	port.onDisconnect.addListener(() => {
		observer.disconnect();
		removeEventListener("scroll", updateActiveHeading);
		removeEventListener("resize", updateActiveHeading);
	});

	return true;
}());
