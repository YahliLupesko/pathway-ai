import { useEffect, useRef, useState } from 'react';
import { twMerge } from 'tailwind-merge'

export default function VisualEditAgent() {
	// this functions job is to receive first a message from the parent window, to set or unset visual edits mode. 
	// once in visual edits mode, every hover over an elelmnt that has linenumbers should show an overlay, when clicked - it should stick the overlay and send a message to the parent window with the selected element
	// then, the parent window will have an editor, allow for changes to the tailwind css classes of the selected element, and send the updated css classes back to the iframe. 
	// the iframe will then update the css classes of the selected element.

	// State and refs
	const [isVisualEditMode, setIsVisualEditMode] = useState(false);
	const isVisualEditModeRef = useRef(false);
	const [isPopoverDragging, setIsPopoverDragging] = useState(false);
	const isPopoverDraggingRef = useRef(false);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const isDropdownOpenRef = useRef(false);
	const hoverOverlaysRef = useRef([]); // Multiple overlays for hover
	const selectedOverlaysRef = useRef([]); // Multiple overlays for selection
	const currentHighlightedElementsRef = useRef([]); // Multiple elements for hover
	const selectedElementIdRef = useRef(null); // Store the visual selector ID

	// Create overlay element
	const createOverlay = (isSelected = false) => {
		const overlay = document.createElement('div');
		overlay.style.position = 'absolute';
		overlay.style.pointerEvents = 'none';
		overlay.style.transition = 'all 0.1s ease-in-out';
		overlay.style.zIndex = '9999';

		// Use different styles for hover vs selected
		if (isSelected) {
			overlay.style.border = '2px solid #2563EB';
		} else {
			overlay.style.border = '2px solid #95a5fc';
			overlay.style.backgroundColor = 'rgba(99, 102, 241, 0.05)';
		}

		return overlay;
	};

	// Position overlay relative to element
	const positionOverlay = (overlay, element, isSelected = false) => {
		if (!element || !isVisualEditModeRef.current) return;

		// Force layout recalculation
		void element.offsetWidth;

		const rect = element.getBoundingClientRect();
		overlay.style.top = `${rect.top + window.scrollY}px`;
		overlay.style.left = `${rect.left + window.scrollX}px`; // weird bug with the offset
		overlay.style.width = `${rect.width}px`;
		overlay.style.height = `${rect.height}px`;

		// Check if label already exists in overlay
		let label = overlay.querySelector('div');

		if (!label) {
			// Create new label if it doesn't exist
			label = document.createElement('div');
			label.textContent = element.tagName.toLowerCase();
			label.style.position = 'absolute';
			label.style.top = '-27px';
			label.style.left = '-2px';
			label.style.padding = '2px 8px';
			label.style.fontSize = '11px';
			label.style.fontWeight = isSelected ? '500' : '400';
			label.style.color = isSelected ? '#ffffff' : '#526cff';
			label.style.backgroundColor = isSelected ? '#526cff' : '#DBEAFE';
			label.style.borderRadius = '3px';
			label.style.boxShadow = isSelected ? 'none' : 'none';
			label.style.minWidth = '24px';
			label.style.textAlign = 'center';
			overlay.appendChild(label);
		}
		// If label exists, we preserve its existing styling (don't recreate or modify)
	};

	// Find elements by ID - first try data-source-location, fallback to data-visual-selector-id
	const findElementsById = (id) => {
		if (!id) return [];
		const sourceElements = [...document.querySelectorAll(`[data-source-location="${id}"]`)];
		if (sourceElements.length > 0) {
			return sourceElements;
		}
		return [...document.querySelectorAll(`[data-visual-selector-id="${id}"]`)];
	};

	// Clear hover overlays
	const clearHoverOverlays = () => {
		hoverOverlaysRef.current.forEach(overlay => {
			if (overlay && overlay.parentNode) {
				overlay.remove();
			}
		});
		hoverOverlaysRef.current = [];
		currentHighlightedElementsRef.current = [];
	};

	// Handle mouse over event
	const handleMouseOver = (e) => {
		if (!isVisualEditModeRef.current || isPopoverDraggingRef.current) return;

		// Prevent hover effects when a dropdown is open
		if (isDropdownOpenRef.current) {
			clearHoverOverlays();
			return;
		}

		// Prevent hover effects on SVG path elements
		if (e.target.tagName.toLowerCase() === 'path') {
			clearHoverOverlays();
			return;
		}

		// Support both data-source-location and data-visual-selector-id
		const element = e.target.closest('[data-source-location], [data-visual-selector-id]');
		if (!element) {
			clearHoverOverlays();
			return;
		}

		// Prefer data-source-location, fallback to data-visual-selector-id  
		const selectorId = element.dataset.sourceLocation || element.dataset.visualSelectorId;
		const useSourceLocation = !!element.dataset.sourceLocation;

		// Skip if this element is already selected
		if (selectedElementIdRef.current === selectorId) {
			clearHoverOverlays();
			return;
		}

		// Find all elements with the same ID
		const elements = findElementsById(selectorId, useSourceLocation);

		// Clear previous hover overlays
		clearHoverOverlays();

		// Create overlays for all matching elements
		elements.forEach(el => {
			const overlay = createOverlay(false);
			document.body.appendChild(overlay);
			hoverOverlaysRef.current.push(overlay);
			positionOverlay(overlay, el);
		});

		currentHighlightedElementsRef.current = elements;
	};

	// Handle mouse out event
	const handleMouseOut = () => {
		if (isPopoverDraggingRef.current) return;
		clearHoverOverlays();
	};

	// Handle element click
	const handleElementClick = (e) => {
		if (!isVisualEditModeRef.current) return;

		// Close dropdowns when clicking anywhere in iframe if a dropdown is open
		if (isDropdownOpenRef.current) {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();

			// Send message to parent to close all dropdowns
			window.parent.postMessage({
				type: 'close-dropdowns'
			}, '*');
			return;
		}

		// Prevent clicking on SVG path elements
		if (e.target.tagName.toLowerCase() === 'path') {
			return;
		}

		// Prevent default behavior immediately when in visual edit mode
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();

		// Support both data-source-location and data-visual-selector-id
		const element = e.target.closest('[data-source-location], [data-visual-selector-id]');
		if (!element) {
			return;
		}

		// Prefer data-source-location, fallback to data-visual-selector-id
		const visualSelectorId = element.dataset.sourceLocation || element.dataset.visualSelectorId;
		const useSourceLocation = !!element.dataset.sourceLocation;

		// Clear any existing selected overlays
		selectedOverlaysRef.current.forEach(overlay => {
			if (overlay && overlay.parentNode) {
				overlay.remove();
			}
		});
		selectedOverlaysRef.current = [];

		// Find all elements with the same ID
		const elements = findElementsById(visualSelectorId, useSourceLocation);

		// Create selected overlays for all matching elements
		elements.forEach(el => {
			const overlay = createOverlay(true);
			document.body.appendChild(overlay);
			selectedOverlaysRef.current.push(overlay);
			positionOverlay(overlay, el, true);
		});

		selectedElementIdRef.current = visualSelectorId;

		// Clear hover overlays
		clearHoverOverlays();

		// Calculate element position for popover positioning
		const rect = element.getBoundingClientRect();
		const elementPosition = {
			top: rect.top,
			left: rect.left,
			right: rect.right,
			bottom: rect.bottom,
			width: rect.width,
			height: rect.height,
			centerX: rect.left + rect.width / 2,
			centerY: rect.top + rect.height / 2
		};

		// Send message to parent window with element info including position
		const elementData = {
			type: 'element-selected',
			tagName: element.tagName,
			classes: element.className?.baseVal || element.className || '',
			visualSelectorId: visualSelectorId,
			content: element.innerText,
			dataSourceLocation: element.dataset.sourceLocation,
			isDynamicContent: element.dataset.dynamicContent === 'true',
			linenumber: element.dataset.linenumber, // Keep for backward compatibility
			filename: element.dataset.filename, // Keep for backward compatibility
			position: elementPosition // Add position data for popover
		};
		window.parent.postMessage(elementData, '*');
	};

	// Unselect the current element
	const unselectElement = () => {
		// Clear selected overlays
		selectedOverlaysRef.current.forEach(overlay => {
			if (overlay && overlay.parentNode) {
				overlay.remove();
			}
		});
		selectedOverlaysRef.current = [];

		selectedElementIdRef.current = null;
	};

	// Update element classes by visual selector ID
	const updateElementClasses = (visualSelectorId, classes, replace = false) => {
		// Find all elements with the same visual selector ID
		const elements = findElementsById(visualSelectorId);

		if (elements.length === 0) {
			return;
		}

		// Update classes for all matching elements
		elements.forEach(element => {
			if (replace) {
				// For reverts, replace classes completely
				element.className = classes;
			} else {
				// For normal updates, merge with existing classes
				const currentClasses = element.className?.baseVal || element.className || '';
				element.className = twMerge(currentClasses, classes);
			}
		});

		// Use a small delay to allow the browser to recalculate layout before repositioning
		setTimeout(() => {
			// Reposition selected overlays
			if (selectedElementIdRef.current === visualSelectorId) {
				selectedOverlaysRef.current.forEach((overlay, index) => {
					if (index < elements.length) {
						positionOverlay(overlay, elements[index]);
					}
				});
			}

			// Reposition hover overlays if needed
			if (currentHighlightedElementsRef.current.length > 0) {
				const hoveredId = currentHighlightedElementsRef.current[0]?.dataset?.visualSelectorId;
				if (hoveredId === visualSelectorId) {
					hoverOverlaysRef.current.forEach((overlay, index) => {
						if (index < currentHighlightedElementsRef.current.length) {
							positionOverlay(overlay, currentHighlightedElementsRef.current[index]);
						}
					});
				}
			}
		}, 50); // Small delay to ensure the browser has time to recalculate layout
	};

	// Update element content by visual selector ID
	const updateElementContent = (visualSelectorId, content) => {
		// Find all elements with the same visual selector ID
		const elements = findElementsById(visualSelectorId);

		if (elements.length === 0) {
			return;
		}

		// Update content for all matching elements
		elements.forEach((element) => {
			element.innerText = content;
		});

		// Use a small delay to allow the browser to recalculate layout before repositioning
		setTimeout(() => {
			// Reposition selected overlays
			if (selectedElementIdRef.current === visualSelectorId) {
				selectedOverlaysRef.current.forEach((overlay, index) => {
					if (index < elements.length) {
						positionOverlay(overlay, elements[index]);
					}
				});
			}
		}, 50); // Small delay to ensure the browser has time to recalculate layout
	};

	// Toggle visual edit mode
	const toggleVisualEditMode = (isEnabled) => {
		setIsVisualEditMode(isEnabled);
		isVisualEditModeRef.current = isEnabled;

		if (!isEnabled) {
			// Clear hover overlays
			clearHoverOverlays();

			// Clear selected overlays
			selectedOverlaysRef.current.forEach(overlay => {
				if (overlay && overlay.parentNode) {
					overlay.remove();
				}
			});
			selectedOverlaysRef.current = [];

			currentHighlightedElementsRef.current = [];
			selectedElementIdRef.current = null;
			document.body.style.cursor = 'default';

			// Remove event listeners
			document.removeEventListener('mouseover', handleMouseOver);
			document.removeEventListener('mouseout', handleMouseOut);
			document.removeEventListener('click', handleElementClick, true);
		} else {
			// Set cursor and add event listeners
			document.body.style.cursor = 'crosshair';
			document.addEventListener('mouseover', handleMouseOver);
			document.addEventListener('mouseout', handleMouseOut);
			document.addEventListener('click', handleElementClick, true); // Use capture mode
		}
	};

	// Listen for messages from parent window
	useEffect(() => {
		// Add IDs to elements that don't have them but have linenumbers
		const elementsWithLineNumber = document.querySelectorAll('[data-linenumber]:not([data-visual-selector-id])');
		elementsWithLineNumber.forEach((el, index) => {
			const id = `visual-id-${el.dataset.filename}-${el.dataset.linenumber}-${index}`;
			el.dataset.visualSelectorId = id;
		});

		// Handle scroll events to update popover position
		const handleScroll = () => {
			if (selectedElementIdRef.current) {
				// Find the element using the stored ID
				const elements = findElementsById(selectedElementIdRef.current);
				if (elements.length > 0) {
					const element = elements[0];
					const rect = element.getBoundingClientRect();

					// Check if element is in viewport
					const viewportHeight = window.innerHeight;
					const viewportWidth = window.innerWidth;
					const isInViewport = (
						rect.top < viewportHeight &&
						rect.bottom > 0 &&
						rect.left < viewportWidth &&
						rect.right > 0
					);

					const elementPosition = {
						top: rect.top,
						left: rect.left,
						right: rect.right,
						bottom: rect.bottom,
						width: rect.width,
						height: rect.height,
						centerX: rect.left + rect.width / 2,
						centerY: rect.top + rect.height / 2
					};

					window.parent.postMessage({
						type: 'element-position-update',
						position: elementPosition,
						isInViewport: isInViewport,
						visualSelectorId: selectedElementIdRef.current
					}, '*');
				}
			}
		};

		const handleMessage = (event) => {
			// Check origin if desired
			//if (event.origin !== 'parent-origin') return;

			const message = event.data;

			switch (message.type) {
				case 'toggle-visual-edit-mode':
					toggleVisualEditMode(message.data.enabled);
					break;

				case 'update-classes':
					if (message.data && message.data.classes !== undefined) {
						// Update with the visual selector ID
						// Pass replace flag if provided (used for reverts)
						updateElementClasses(
							message.data.visualSelectorId,
							message.data.classes,
							message.data.replace || false
						);
					} else {
						console.warn('[Agent] Invalid update-classes message:', message);
					}
					break;

				case 'unselect-element':
					unselectElement();
					break;

				case 'refresh-page':
					window.location.reload();
					break;

				case 'update-content':
					if (message.data && message.data.content !== undefined) {
						updateElementContent(
							message.data.visualSelectorId,
							message.data.content
						);
					} else {
						console.warn('[Agent] Invalid update-content message:', message);
					}
					break;

				case 'request-element-position':
					// Send current position of selected element for popover repositioning
					if (selectedElementIdRef.current) {
						// Find the element using the stored ID
						const elements = findElementsById(selectedElementIdRef.current);
						if (elements.length > 0) {
							const element = elements[0];
							const rect = element.getBoundingClientRect();

							// Check if element is in viewport
							const viewportHeight = window.innerHeight;
							const viewportWidth = window.innerWidth;
							const isInViewport = (
								rect.top < viewportHeight &&
								rect.bottom > 0 &&
								rect.left < viewportWidth &&
								rect.right > 0
							);

							const elementPosition = {
								top: rect.top,
								left: rect.left,
								right: rect.right,
								bottom: rect.bottom,
								width: rect.width,
								height: rect.height,
								centerX: rect.left + rect.width / 2,
								centerY: rect.top + rect.height / 2
							};

							window.parent.postMessage({
								type: 'element-position-update',
								position: elementPosition,
								isInViewport: isInViewport,
								visualSelectorId: selectedElementIdRef.current
							}, '*');
						}
					}
					break;

				case 'popover-drag-state':
					// Handle popover drag state to prevent mouseover conflicts
					if (message.data && message.data.isDragging !== undefined) {
						setIsPopoverDragging(message.data.isDragging);
						isPopoverDraggingRef.current = message.data.isDragging;

						// Clear hover overlays when dragging starts
						if (message.data.isDragging) {
							clearHoverOverlays();
						}
					}
					break;

				case 'dropdown-state':
					// Handle dropdown open/close state
					if (message.data && message.data.isOpen !== undefined) {
						setIsDropdownOpen(message.data.isOpen);
						isDropdownOpenRef.current = message.data.isOpen;

						// Clear hover overlays when dropdown opens
						if (message.data.isOpen) {
							clearHoverOverlays();
						}
					}
					break;

				default:
					break;
			}
		};

		window.addEventListener('message', handleMessage);
		window.addEventListener('scroll', handleScroll, true); // Use capture to catch all scroll events
		document.addEventListener('scroll', handleScroll, true); // Also listen on document

		// Send ready message to parent
		window.parent.postMessage({ type: 'visual-edit-agent-ready' }, '*');

		return () => {
			window.removeEventListener('message', handleMessage);
			window.removeEventListener('scroll', handleScroll, true);
			document.removeEventListener('scroll', handleScroll, true);
			document.removeEventListener('mouseover', handleMouseOver);
			document.removeEventListener('mouseout', handleMouseOut);
			document.removeEventListener('click', handleElementClick, true);

			// Clean up all overlays
			clearHoverOverlays();

			selectedOverlaysRef.current.forEach(overlay => {
				if (overlay && overlay.parentNode) {
					overlay.remove();
				}
			});
		};
	}, []);

	// Keep the refs in sync with state changes
	useEffect(() => {
		isVisualEditModeRef.current = isVisualEditMode;
	}, [isVisualEditMode]);

	useEffect(() => {
		isPopoverDraggingRef.current = isPopoverDragging;
	}, [isPopoverDragging]);

	useEffect(() => {
		isDropdownOpenRef.current = isDropdownOpen;
	}, [isDropdownOpen]);

	// Handle window resize and scroll to reposition overlays
	useEffect(() => {
		const handleResize = () => {
			// Reposition selected overlays
			if (selectedElementIdRef.current) {
				const elements = findElementsById(selectedElementIdRef.current);
				selectedOverlaysRef.current.forEach((overlay, index) => {
					if (index < elements.length) {
						positionOverlay(overlay, elements[index]);
					}
				});
			}

			// Reposition hover overlays
			if (currentHighlightedElementsRef.current.length > 0) {
				hoverOverlaysRef.current.forEach((overlay, index) => {
					if (index < currentHighlightedElementsRef.current.length) {
						positionOverlay(overlay, currentHighlightedElementsRef.current[index]);
					}
				});
			}
		};

		// Create a mutation observer to detect changes in the DOM
		const mutationObserver = new MutationObserver((mutations) => {
			// Check if mutations affect relevant elements
			const needsUpdate = mutations.some(mutation => {
				// Check if the target or its children have data-visual-selector-id
				const hasVisualId = (node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						if (node.dataset && node.dataset.visualSelectorId) {
							return true;
						}
						// Check children
						for (let i = 0; i < node.children.length; i++) {
							if (hasVisualId(node.children[i])) {
								return true;
							}
						}
					}
					return false;
				};

				// Check if this is a style or attribute mutation that might affect layout
				const isLayoutChange = mutation.type === 'attributes' &&
					(mutation.attributeName === 'style' ||
						mutation.attributeName === 'class' ||
						mutation.attributeName === 'width' ||
						mutation.attributeName === 'height');

				// Check if target is or contains an element with visual selector ID
				return isLayoutChange && hasVisualId(mutation.target);
			});

			if (needsUpdate) {
				// Use timeout to let browser calculate layout
				setTimeout(handleResize, 50);
			}
		});

		// Start observing
		mutationObserver.observe(document.body, {
			attributes: true,
			childList: true,
			subtree: true,
			attributeFilter: ['style', 'class', 'width', 'height']
		});

		window.addEventListener('resize', handleResize);
		window.addEventListener('scroll', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('scroll', handleResize);
			mutationObserver.disconnect();
		};
	}, []);

	// No visible UI - all functionality is handled through event listeners and message passing
	return null;
}