
function dragElement($$elmnt, $$top) {
	let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
	$$top.onmousedown = dragMouseDown;

	function dragMouseDown(e) {
		e = e || window.event;
		e.preventDefault();
		// get the mouse cursor position at startup:
		pos3 = e.clientX;
		pos4 = e.clientY;
		document.addEventListener("mouseup", closeDragElement, false)
		// document.addEventListener("mouseout", closeDragElement, false)
		document.addEventListener("mousemove", elementDrag, false)
	}

	function elementDrag(e) {
		e = e || window.event;
		e.preventDefault();
		// calculate the new cursor position:
		pos1 = pos3 - e.clientX;
		pos2 = pos4 - e.clientY;
		pos3 = e.clientX;
		pos4 = e.clientY;
		// set the element's new position:
		let new_top = ($$elmnt.offsetTop - pos2)
		if(new_top < 8)
			new_top = 8
		$$elmnt.style.top = new_top + "px";
		$$elmnt.style.left = ($$elmnt.offsetLeft - pos1) + "px";
	}

	function closeDragElement() {
		// stop moving when mouse button is released:
		document.removeEventListener("mouseup", closeDragElement, false)
		// document.removeEventListener("mouseout", closeDragElement, false)
		document.removeEventListener("mousemove", elementDrag, false)
	}
}

(function() {
	'use strict';

	if (window.quickSelInjected)
		return;
	window.quickSelInjected = true;

	let isSelecting = false;
	let currentElement = null;
	let highlight = null;
	let shadowHost = null;
	let shadowRoot = null;
	let selectedElement = null
	let $$panel = null
	let $$top = null
	let $$status = null
	let $$format = null
	let $$min_tc = null
	let $$max_tc = null
	let $$max_per = null
	let $$results_body = null
	let $$start = null
	let $$controls_inputs = null

	async function init() {
		createHighlight();
		await injectPanel();
		setupEventListeners();
	}

	async function injectPanel() {
		shadowHost = document.createElement('div');
		shadowHost.id = 'quickSelShadowHost';
		shadowHost.style.all = 'initial';
		document.body.appendChild(shadowHost);
		shadowRoot = shadowHost.attachShadow({ mode: 'closed' });
		
		let [htmlResponse, cssResponse] = await Promise.all([
			fetch(chrome.runtime.getURL('content_scripts/panel.html')),
			fetch(chrome.runtime.getURL('content_scripts/panel.css'))
		]);
		let html = await htmlResponse.text();
		let css = await cssResponse.text();
		
		shadowRoot.innerHTML = `<style>${css}</style>${html}`;

		$$panel = shadowRoot.getElementById('quickSelPanel')
		$$top = shadowRoot.querySelector('.quickSel-header')
		$$status = shadowRoot.querySelector('.quickSel-status')
		$$format = shadowRoot.querySelector('.quickSel-format')
		$$min_tc = shadowRoot.querySelector('.quickSel-min-tc')
		$$max_tc = shadowRoot.querySelector('.quickSel-max-tc')
		$$max_per = shadowRoot.querySelector('.quickSel-max-per')
		$$results_body = shadowRoot.querySelector('.quickSel-results-body')
		$$start = shadowRoot.querySelector('.quickSel-start')
		$$controls_inputs = shadowRoot.querySelectorAll('.quickSel-controls input')
		dragElement($$panel, $$top)
	}

	function setupEventListeners() {
		$$start.addEventListener('click', toggleSelection);

		for(let $$controls_input of $$controls_inputs)
			$$controls_input.addEventListener("change", updateResults, false)
	}

	function getIntOrDefault(el, def){
		if(isNaN(el.value))
			return def
		return parseInt(el.value)
	}

	function updateResults() {
		if(selectedElement){
			$$status.textContent = 'Generating selectors...';

			try {
				let format = $$format.value;
				let mintc = getIntOrDefault($$min_tc, 1);
				let maxtc = getIntOrDefault($$max_tc, 1000);
				let maxper = getIntOrDefault($$max_per, 8);
				if(maxtc < mintc){
					maxtc = mintc
					$$max_tc.value = maxtc
				}
				let selectors = window.quicksel.getSelectors(selectedElement, format, mintc, maxtc, 100, maxper);
				displayResults(selectors);
				$$status.textContent = `Found ${Object.keys(selectors).length} selector groups`;
			} catch (error) {
				$$status.textContent = `Error: ${error.message}`;
				$$results_body.innerHTML = 
					'<tr><td colspan="3" class="quickSel-empty">Error generating selectors</td></tr>';
			}
			clearXPathHighlights()
		}
	}

	function createHighlight() {
		highlight = document.createElement('div');
		highlight.className = 'quickSel-highlight';
		document.body.appendChild(highlight);
	}

	function toggleSelection() {
		isSelecting ? stopSelection() : startSelection();
	}

	function startSelection() {
		isSelecting = true;
		
		$$start.textContent = 'Cancel Selection';
		$$start.classList.add('active');
		$$status.textContent = 'Move your mouse over elements to highlight them, then click to select';
		$$status.classList.add('active');
		
		$$results_body.innerHTML = '<tr><td colspan="3" class="quickSel-empty">Select an element...</td></tr>';

		document.addEventListener('mousemove', handleMouseMove, true);
		document.addEventListener('click', handleClick, true);

		clearXPathHighlights()
	}

	function stopSelection() {
		isSelecting = false;
		
		$$start.textContent = 'Select Element';
		$$start.classList.remove('active');
		$$status.classList.remove('active');
		
		document.removeEventListener('mousemove', handleMouseMove, true);
		document.removeEventListener('click', handleClick, true);
		
		highlight.style.display = 'none';
		currentElement = null;

		clearXPathHighlights()
	}

	function handleMouseMove(e) {
		if (!isSelecting)
			return;
		let element = e.target;
		
		if (element === shadowHost || shadowHost.contains(element)) {
			highlight.style.display = 'none';
			currentElement = null;
			return;
		}

		e.stopPropagation()

		if (element && element.nodeType === 1 && 
				element.tagName !== 'HTML' && element.tagName !== 'BODY' &&
				!element.classList.contains('quickSel-highlight')) {
			currentElement = element;
			updateHighlight(element);
		}
	}

	function updateHighlight(element) {
		let rect = element.getBoundingClientRect();
		highlight.style.display = 'block';
		highlight.style.left = rect.left + 'px';
		highlight.style.top = rect.top + 'px';
		highlight.style.width = rect.width + 'px';
		highlight.style.height = rect.height + 'px';
	}

	function handleClick(e) {
		if (!isSelecting || e.target == shadowHost)
			return;
		
		e.preventDefault();
		e.stopImmediatePropagation();
	
		if (e.target && typeof e.target.preventDefault === 'function')
			e.target.preventDefault();

		if (e.target === shadowHost || shadowHost.contains(e.target))
			return;

		if (!currentElement) {
			stopSelection();
			return;
		}

		selectedElement = currentElement

		stopSelection();
		clearXPathHighlights()
		updateResults();
	}

	function highlightXPathElements(selector) {
		let result = document.evaluate(
			selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
		);
		for (let i = 0; i < result.snapshotLength; i++){
			let $$item = result.snapshotItem(i)
			if ($$item !== shadowHost && !shadowHost.contains($$item))
				$$item.classList.add('quickSel-tmp');
		}
	}

	function clearXPathHighlights() {
		let elements = document.querySelectorAll('.quickSel-tmp');
		for(let element of elements)
			element.classList.remove('quickSel-tmp');
	}

	function displayResults(selectors) {
		if (!selectors || Object.keys(selectors).length === 0) {
			$$results_body.innerHTML = '<tr><td colspan="3" class="quickSel-empty">No selectors found</td></tr>';
			return;
		}

		let counts = Object.keys(selectors).map(Number).sort((a, b) => a - b);
		let html = '';

		for (let count of counts) {
			selectors[count].forEach(([selectorCount, selector]) => {
				html += `
					<tr class="quickSel-row" data-selector="${selector}">
						<td class="quickSel-count">${selectorCount}</td>
						<td class="quickSel-selector">${selector}</td>
						<td><button class="quickSel-copy" data-selector="${selector}">Copy</button></td>
					</tr>
				`;
			});
		}

		$$results_body.innerHTML = html;

		$$results_body.querySelectorAll(".quickSel-row").forEach(btn => {
			btn.addEventListener('mouseover', function() {
				clearXPathHighlights()
				let selector = btn.querySelector(".quickSel-selector").textContent.trim()
				highlightXPathElements(selector)
			});
		});

		$$results_body.querySelectorAll('.quickSel-copy').forEach(btn => {
			btn.addEventListener('click', function() {
				let selector = btn.parentNode.parentNode.querySelector(".quickSel-selector").textContent.trim()
				navigator.clipboard.writeText(selector).then(() => {
					this.textContent = 'Copied!';
					this.classList.add('copied');
					setTimeout(() => {
						this.textContent = 'Copy';
						this.classList.remove('copied');
					}, 2000);
				});
			});
		});
	}

	window.quickSelToggle = function() {
		$$panel.classList.toggle('open');
		
		if (isSelecting)
			stopSelection();
		clearXPathHighlights()
	};

	init();
})();