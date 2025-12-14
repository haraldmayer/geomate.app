/**
 * Map initialization and interaction logic for Grätzlmap
 */

import geoquery from './geoquery.js';
import {
	findGraetzlBySlug,
	getGraetzlSlugFromPath,
	updateUrlForGraetzl,
	getListSlugFromPath,
	updateUrlForList,
	nameToSlug
} from './slug-utils.js';
import {
	initLanguage,
	getCurrentLanguage,
	setLanguage,
	t
} from './i18n.js';

window.addEventListener('load', async function() {
	// Initialize map centered on Vienna
	const map = L.map('map').setView([48.2082, 16.3738], 12);

	// Add greyscale tile layer
	L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
		subdomains: 'abcd',
		maxZoom: 19
	}).addTo(map);

	// Load data
	let geoData = null;
	let graetzlData = null;
	try {
		geoData = await geoquery.loadGeoData();
		graetzlData = await geoquery.loadGraetzlData();
		console.log('POI data loaded:', geoData.features.length, 'features');
		console.log('Grätzl data loaded:', graetzlData.features.length, 'features');
	} catch (error) {
		console.error('Error loading data:', error);
		return;
	}

	// Category definitions (icons and metadata)
	let categories = {};

	let currentPolygon = null;
	let currentMarkers = [];
	let currentGraetzlId = null; // Track currently selected Grätzl
	let selectedCategories = new Set(); // Track selected categories
	let walkthroughArrows = []; // Store walkthrough arrow layers
	let currentList = null; // Track currently active list
	let listData = []; // Store list data (includes walks with showAsWalk flag)
	let listMarkers = []; // Store list number markers

	// References to activate functions (set by setup functions)
	let activateListFn = null;

	// Initialize language system
	initLanguage();

	// Helper function to get translated text
	function getTranslated(text, fallbackLang = 'de') {
		if (!text) return '';
		if (typeof text === 'string') return text;
		const lang = getCurrentLanguage();
		return text[lang] || text[fallbackLang] || Object.values(text)[0] || '';
	}

	// Function to load categories
	async function loadCategories() {
		try {
			const response = await fetch('/data/categories.json');
			if (!response.ok) {
				throw new Error('Failed to load categories');
			}
			const data = await response.json();
			categories = data.categories;
		} catch (error) {
			console.error('Error loading categories:', error);
		}
	}

	// Helper function to sort lists by order field, then alphabetically
	function sortLists() {
		listData.sort((a, b) => {
			// If both have order field, sort by order
			if (a.order !== undefined && b.order !== undefined) {
				return a.order - b.order;
			}
			// If only one has order, prioritize it
			if (a.order !== undefined) return -1;
			if (b.order !== undefined) return 1;
			// Otherwise sort alphabetically by title
			const titleA = getTranslated(a.title).toLowerCase();
			const titleB = getTranslated(b.title).toLowerCase();
			return titleA.localeCompare(titleB, getCurrentLanguage());
		});
	}

	// Function to load lists
	async function loadLists() {
		try {
			const response = await fetch('/api/lists');
			if (!response.ok) {
				throw new Error('Failed to load lists');
			}
			listData = await response.json();

			// Sort lists by order field (if exists), then by title
			sortLists();

			console.log('Lists loaded:', listData.length, listData);

			// Debug: log each list
			listData.forEach((list, i) => {
				console.log(`List ${i}:`, list.id, getTranslated(list.title), 'order:', list.order, 'showAsWalk:', list.showAsWalk);
			});
		} catch (error) {
			console.error('Error loading lists:', error);
			listData = [];
		}
	}

	// Function to get icon for category
	function getCategoryIcon(category) {
		// Fallback if categories not loaded yet
		if (!categories || Object.keys(categories).length === 0) {
			console.warn('Categories not loaded yet');
			return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>';
		}
		const cat = categories[category];
		if (!cat) {
			console.warn(`Category "${category}" not found, using default`);
			return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>';
		}
		// Use icon (SVG) if available, otherwise fall back to emoji
		return cat.icon || cat.emoji;
	}

	// Function to get background color for category
	function getCategoryColor(category) {
		if (!categories || Object.keys(categories).length === 0) {
			return '#FFFFFF';
		}
		const cat = categories[category];
		return cat?.color || '#FFFFFF';
	}

	// Function to calculate marker size based on zoom level
	function getMarkerSize(zoom) {
		return Math.max(10, Math.min(50, 10 + (zoom - 10) * 3.33));
	}

	// Function to create custom icon
	function createCustomIcon(category, zoom) {
		const icon = getCategoryIcon(category);
		const color = getCategoryColor(category);
		const size = getMarkerSize(zoom || map.getZoom());
		return L.divIcon({
			html: `<div class="custom-marker" style="width: ${size}px; height: ${size}px; font-size: ${size * 0.7}px; line-height: ${size}px; background-color: ${color};">${icon}</div>`,
			className: 'custom-icon',
			iconSize: [size, size],
			iconAnchor: [size / 2, size],
			popupAnchor: [0, -size]
		});
	}

	// Function to update marker sizes based on current zoom
	function updateMarkerSizes() {
		const currentZoom = map.getZoom();
		const size = getMarkerSize(currentZoom);

		currentMarkers.forEach((marker) => {
			const iconElement = marker._icon;
			if (iconElement) {
				const markerDiv = iconElement.querySelector('.custom-marker');
				if (markerDiv) {
					markerDiv.style.width = size + 'px';
					markerDiv.style.height = size + 'px';
					markerDiv.style.fontSize = (size * 0.7) + 'px';
					markerDiv.style.lineHeight = size + 'px';
				}

				iconElement.style.width = size + 'px';
				iconElement.style.height = size + 'px';
				iconElement.style.marginLeft = (-size / 2) + 'px';
				iconElement.style.marginTop = (-size) + 'px';
			}
		});
	}

	// Function to create category filter UI
function createCategoryFilters() {
	const container = document.getElementById('category-filters');
	const dropdown = document.getElementById('category-dropdown');
	const toggle = document.getElementById('category-toggle');
	const toggleText = toggle.querySelector('.category-toggle-text');
	const searchInput = document.getElementById('category-search');
	const selectAllBtn = document.getElementById('select-all-categories');
	const deselectAllBtn = document.getElementById('deselect-all-categories');

	const allCategories = geoquery.getAllCategories(geoData);

	// Create category checkboxes
	allCategories.forEach(categoryId => {
		const categoryInfo = categories[categoryId];
		if (!categoryInfo) return;

		const label = document.createElement('label');
		label.className = 'category-filter';
		label.dataset.categoryId = categoryId;
		label.dataset.categoryName = getTranslated(categoryInfo.name).toLowerCase();

		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.value = categoryId;
		checkbox.checked = true; // All selected by default
		checkbox.addEventListener('change', () => {
			updateCategorySelection();
		});

		const icon = document.createElement('span');
		icon.className = 'category-icon';
		icon.innerHTML = categoryInfo.icon || categoryInfo.emoji;

		const name = document.createElement('span');
		name.className = 'category-name';
		name.textContent = getTranslated(categoryInfo.name);

		label.appendChild(checkbox);
		label.appendChild(icon);
		label.appendChild(name);
		container.appendChild(label);
	});

	// Update category selection and markers
	function updateCategorySelection() {
		const allCheckboxes = container.querySelectorAll('input[type="checkbox"]');
		selectedCategories.clear();

		let checkedCount = 0;
		allCheckboxes.forEach(cb => {
			if (cb.checked) {
				checkedCount++;
				selectedCategories.add(cb.value);
			}
		});

		// If all are checked, clear the set (means "show all")
		if (checkedCount === allCheckboxes.length) {
			selectedCategories.clear();
		}

		// Update toggle button text
		if (checkedCount === 0) {
			toggleText.textContent = t('category.noCategories');
		} else if (checkedCount === allCheckboxes.length) {
			toggleText.textContent = t('category.allCategories');
		} else {
			toggleText.textContent = `${checkedCount} ${t('category.of')} ${allCheckboxes.length} ${t('category.categoriesCount')}`;
		}

		updateMarkers();
	}

	// Toggle dropdown
	toggle.addEventListener('click', (e) => {
		e.stopPropagation();
		const isVisible = dropdown.style.display === 'block';
		dropdown.style.display = isVisible ? 'none' : 'block';
		if (!isVisible) {
			searchInput.focus();
		}
	});

	// Select all button
	selectAllBtn.addEventListener('click', () => {
		const checkboxes = container.querySelectorAll('input[type="checkbox"]');
		checkboxes.forEach(cb => cb.checked = true);
		updateCategorySelection();
	});

	// Deselect all button
	deselectAllBtn.addEventListener('click', () => {
		const checkboxes = container.querySelectorAll('input[type="checkbox"]');
		checkboxes.forEach(cb => cb.checked = false);
		updateCategorySelection();
	});

	// Search functionality
	searchInput.addEventListener('input', (e) => {
		const searchTerm = e.target.value.toLowerCase();
		const labels = container.querySelectorAll('.category-filter');

		labels.forEach(label => {
			const categoryName = label.dataset.categoryName;
			if (categoryName.includes(searchTerm)) {
				label.style.display = 'flex';
			} else {
				label.style.display = 'none';
			}
		});
	});

	// Close dropdown when clicking outside
	document.addEventListener('click', (e) => {
		if (!e.target.closest('.category-filter-container')) {
			dropdown.style.display = 'none';
		}
	});

	// Prevent dropdown from closing when clicking inside
	dropdown.addEventListener('click', (e) => {
		e.stopPropagation();
	});

	// Initial text update
	updateCategorySelection();
}

	// Function to show all POIs (default view)
	function showAllPOIs() {
		currentGraetzlId = null;

		// Remove polygon if exists
		if (currentPolygon) {
			map.removeLayer(currentPolygon);
			currentPolygon = null;
		}

		// Reset to Vienna center view
		map.setView([48.2082, 16.3738], 14); // Zoom 14 ≈ 1km radius

		// Update markers based on current category filter
		updateMarkers();

		// Update search input
		const searchInput = document.getElementById('graetzl-search');
		searchInput.value = '';
		searchInput.placeholder = t('placeholder.allGraetzl');
		searchInput.dataset.selected = 'false';
		selectedGraetzl = null;
	}

	// Function to show specific Grätzl
	function showGraetzl(graetzlId) {
		if (!graetzlId) {
			showAllPOIs();
			return;
		}

		currentGraetzlId = graetzlId;

		// Get Grätzl feature from graetzl data
		const graetzlFeature = geoquery.getGraetzl(graetzlData, parseInt(graetzlId));
		if (!graetzlFeature) {
			console.error(`Grätzl "${graetzlId}" not found`);
			return;
		}

		// Remove previous polygon
		if (currentPolygon) {
			map.removeLayer(currentPolygon);
		}

		// Convert GeoJSON polygon to Leaflet coordinates
		const bounds = geoquery.featureToLeafletCoords(graetzlFeature);

		// Add polygon overlay for the neighborhood
		currentPolygon = L.polygon(bounds, {
			color: '#FF6B6B',
			fillColor: '#FF6B6B',
			fillOpacity: 0.2,
			weight: 3
		}).addTo(map);

		// Fit map to polygon bounds
		map.fitBounds(currentPolygon.getBounds(), { padding: [50, 50] });

		// Update markers (will filter by Grätzl and categories)
		updateMarkers();

		// Dropdown is updated by selectGraetzl function
	}

	// Function to update markers based on filters
	function updateMarkers() {
		// Remove all current markers
		currentMarkers.forEach(marker => map.removeLayer(marker));
		currentMarkers = [];

		let poiFeatures = [];

		// If in list/walk mode, only show list POIs
		if (currentList && currentList.pois && currentList.pois.length > 0) {
			// Filter to only show POIs in the list/walk
			poiFeatures = geoData.features.filter(feature =>
				currentList.pois.includes(feature.properties.id)
			);
		} else {
			// Build filter
			const filters = {};
			if (currentGraetzlId) {
				filters.graetzlId = parseInt(currentGraetzlId);
			}
			if (selectedCategories.size > 0) {
				filters.categories = Array.from(selectedCategories);
			}

			// Get filtered POIs using spatial query
			poiFeatures = geoquery.filterPOIsWithGraetzl(geoData, graetzlData, filters);
		}

		// Add markers
		poiFeatures.forEach(poiFeature => {
			const poi = poiFeature.properties;
			const coords = geoquery.featureToLeafletCoords(poiFeature);
			const icon = getCategoryIcon(poi.category);

			const marker = L.marker(coords, {
				icon: createCustomIcon(poi.category, map.getZoom())
			}).addTo(map);

			// Store POI ID on marker for later reference
			marker.poiId = poi.id;

			// Add tooltip with POI name
			marker.bindTooltip(poi.name, {
				direction: 'top',
				offset: [0, -10],
				opacity: 0.9
			});

			// Create popup content
			const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}`;
			const learnMoreLink = poi.link ? `<a href="${poi.link}" target="_blank" class="poi-link">${t('poi.website')} →</a>` : '';

			// Get category info
			const categoryInfo = categories[poi.category];
			const categoryName = categoryInfo ? `${categoryInfo.emoji} ${getTranslated(categoryInfo.name)}` : '';

			// Format tags if available
			const tags = poi.tags || [];
			const tagsHtml = tags.length > 0
				? `<div class="poi-tags">${tags.map(tag => `<span class="poi-tag">${tag}</span>`).join('')}</div>`
				: '';

			// Format photo if available
			const photoHtml = poi.photo
				? `<img src="${poi.photo}" alt="${poi.name}" class="poi-photo" />`
				: '';

			const popupContent = `
				<div class="poi-popup">
					<div class="poi-icon">${icon}</div>
					<h3>${poi.name}</h3>
					${categoryName ? `<div class="poi-category-label">${categoryName}</div>` : ''}
					${photoHtml}
					<p>${getTranslated(poi.description)}</p>
					${tagsHtml}
					<div class="poi-actions">
						${learnMoreLink}
						<a href="${googleMapsUrl}" target="_blank" class="poi-link poi-link-secondary">${t('poi.route')}</a>
					</div>
				</div>
			`;

			marker.bindPopup(popupContent, {
				maxWidth: 300,
				className: 'custom-popup'
			});

			currentMarkers.push(marker);
		});
	}

	// Dropdown interactions are handled in populateGraetzlDropdown()

	// Update marker sizes when zoom changes
	map.on('zoomend', updateMarkerSizes);

	// Handle map clicks to activate Grätzl
	/*map.on('click', (e) => {
		// Convert Leaflet coords [lat, lng] to GeoJSON [lng, lat]
		const point = [e.latlng.lng, e.latlng.lat];

		// Find which Grätzl contains this point
		const graetzl = geoquery.findGraetzlAtPoint(graetzlData, point);

		if (graetzl) {
			// Activate the clicked Grätzl and update URL
			selectGraetzl(graetzl);
		}
	});*/

	// Searchable dropdown state
	let allGraetzls = [];
	let selectedGraetzl = null;
	let focusedIndex = -1;

	// Function to update clear button visibility
	function updateClearButton() {
		const searchInput = document.getElementById('graetzl-search');
		const clearButton = document.getElementById('clear-graetzl');

		// Show button if there's text or a selection
		if (searchInput.value || searchInput.dataset.selected === 'true') {
			clearButton.style.display = 'flex';
		} else {
			clearButton.style.display = 'none';
		}
	}

	// Function to populate Grätzl dropdown
	function populateGraetzlDropdown() {
		const dropdown = document.getElementById('graetzl-dropdown');
		const searchInput = document.getElementById('graetzl-search');
		const clearButton = document.getElementById('clear-graetzl');
		allGraetzls = geoquery.getGraetzlFeatures(graetzlData);

		// Filter to only show active Grätzl
		allGraetzls = allGraetzls.filter(g => g.properties.active === 1);

		// Sort by name
		allGraetzls.sort((a, b) =>
			a.properties.Graetzl_Name.localeCompare(b.properties.Graetzl_Name, 'de')
		);

		// Add "Show all" option
		const allOption = document.createElement('div');
		allOption.className = 'graetzl-option';
		allOption.dataset.id = '';
		allOption.dataset.name = t('dropdown.showAll');
		allOption.textContent = t('dropdown.showAll');
		allOption.addEventListener('click', () => selectGraetzl(null));
		dropdown.appendChild(allOption);

		// Add all Grätzl options
		allGraetzls.forEach(graetzl => {
			const option = document.createElement('div');
			option.className = 'graetzl-option';
			option.dataset.id = graetzl.properties.Graetzl_ID;
			option.dataset.name = graetzl.properties.Graetzl_Name;
			option.textContent = graetzl.properties.Graetzl_Name;
			option.addEventListener('click', () => selectGraetzl(graetzl));
			dropdown.appendChild(option);
		});

		// Clear button functionality
		clearButton.addEventListener('click', () => {
			selectGraetzl(null);
		});

		// Search functionality
		searchInput.addEventListener('input', (e) => {
			focusedIndex = -1; // Reset focus when typing
			filterDropdown(e.target.value);
			updateClearButton();
		});

		// Show dropdown on focus
		searchInput.addEventListener('focus', () => {
			// Clear input if showing default state
			if (searchInput.dataset.selected === 'false' || !searchInput.dataset.selected) {
				searchInput.value = '';
			} else if (selectedGraetzl) {
				// Select the text if a Grätzl is selected
				searchInput.select();
			}
			// Always show all options when focused
			filterDropdown('');
			dropdown.style.display = 'block';
		});

		// Keyboard navigation
		searchInput.addEventListener('keydown', (e) => {
			const options = Array.from(dropdown.querySelectorAll('.graetzl-option:not([style*="display: none"])'));

			if (e.key === 'ArrowDown') {
				e.preventDefault();
				focusedIndex = Math.min(focusedIndex + 1, options.length - 1);
				updateFocusedOption(options);
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				focusedIndex = Math.max(focusedIndex - 1, -1);
				updateFocusedOption(options);
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (focusedIndex >= 0 && options[focusedIndex]) {
					options[focusedIndex].click();
				}
			} else if (e.key === 'Escape') {
				dropdown.style.display = 'none';
				searchInput.blur();
			}
		});

		// Close dropdown when clicking outside
		document.addEventListener('click', (e) => {
			if (!e.target.closest('.searchable-select')) {
				dropdown.style.display = 'none';
			}
		});

		console.log('Populated dropdown with', allGraetzls.length, 'Grätzl');
	}

	function filterDropdown(searchTerm) {
		const dropdown = document.getElementById('graetzl-dropdown');
		const options = dropdown.querySelectorAll('.graetzl-option');
		const term = searchTerm.toLowerCase();

		let visibleCount = 0;
		options.forEach(option => {
			const name = option.dataset.name.toLowerCase();
			if (name.includes(term)) {
				option.style.display = 'block';
				visibleCount++;
			} else {
				option.style.display = 'none';
			}
		});

		// Show/hide dropdown based on visible options
		if (visibleCount > 0) {
			dropdown.style.display = 'block';
		} else {
			dropdown.style.display = 'none';
		}
	}

	function updateFocusedOption(options) {
		options.forEach((opt, idx) => {
			if (idx === focusedIndex) {
				opt.classList.add('focused');
				opt.scrollIntoView({ block: 'nearest' });
			} else {
				opt.classList.remove('focused');
			}
		});
	}

	function selectGraetzl(graetzl) {
		const searchInput = document.getElementById('graetzl-search');
		const dropdown = document.getElementById('graetzl-dropdown');

		if (graetzl) {
			selectedGraetzl = graetzl;
			searchInput.value = graetzl.properties.Graetzl_Name;
			searchInput.dataset.selected = 'true';
			showGraetzl(graetzl.properties.Graetzl_ID.toString());

			// Update URL
			updateUrlForGraetzl(graetzl);
		} else {
			selectedGraetzl = null;
			searchInput.value = '';
			searchInput.placeholder = t('placeholder.allGraetzl');
			searchInput.dataset.selected = 'false';
			showAllPOIs();

			// Update URL to root
			updateUrlForGraetzl(null);
		}

		dropdown.style.display = 'none';
		focusedIndex = -1;
		updateClearButton();
	}

	// Initialize: load categories and show all POIs or selected Grätzl from URL
	async function initialize() {
		try {
			console.log('Loading categories...');
			await loadCategories();
			console.log('Categories loaded:', Object.keys(categories).length);

			console.log('Loading lists and walks...');
			await loadLists();

			// Populate Grätzl dropdown
			populateGraetzlDropdown();

			// Create category filter UI
			createCategoryFilters();

			// Setup list selector (now handles both lists and walks)
			setupListSelector();

			// Ensure sidebar is hidden by default
			document.querySelector('.container').classList.remove('sidebar-active');

			// Check URL for Grätzl or List
			const graetzlSlug = getGraetzlSlugFromPath();
			const listSlug = getListSlugFromPath();

			// Check for /l/ (list/walk) URL
			if (listSlug) {
				console.log('List slug from URL:', listSlug);
				// Find list by slug, or generate slug from title if missing
				const list = listData.find(l => {
					const slug = l.slug || nameToSlug(l.title);
					return slug === listSlug;
				});
				if (list) {
					console.log('Found List:', list);
					// Wait for next tick to ensure everything is ready
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							console.log('Activating list with', list.pois.length, 'POIs');
							if (activateListFn) {
								activateListFn(list.id);
							}
						});
					});
				} else {
					console.warn('List not found for slug:', listSlug);
					showAllPOIs();
				}
			} else if (graetzlSlug) {
				console.log('Grätzl slug from URL:', graetzlSlug);
				const graetzl = findGraetzlBySlug(graetzlData, graetzlSlug);
				if (graetzl) {
					console.log('Found Grätzl:', graetzl.properties.Graetzl_Name);
					selectGraetzl(graetzl);
				} else {
					console.warn('Grätzl not found for slug:', graetzlSlug);
					showAllPOIs();
				}
			} else {
				console.log('Showing all POIs...');
				showAllPOIs();
			}
		} catch (error) {
			console.error('Initialization error:', error);
		}
	}

	// POI Search functionality
	function setupPOISearch() {
		const searchInput = document.getElementById('poi-search');
		const dropdown = document.getElementById('poi-dropdown');
		const clearButton = document.getElementById('clear-poi');

		if (!searchInput || !dropdown) return;

		let searchTimeout;
		let selectedPOI = null;
		let focusedIndex = -1;

		// Update clear button visibility
		function updateClearButton() {
			if (searchInput.value || searchInput.dataset.selected === 'true') {
				clearButton.style.display = 'flex';
			} else {
				clearButton.style.display = 'none';
			}
		}

		// Search and filter POIs
		function searchPOIs(searchTerm) {
			if (!searchTerm) {
				dropdown.style.display = 'none';
				return;
			}

			const results = geoData.features.filter(poi => {
				const name = (poi.properties.name || '').toLowerCase();
				const description = getTranslated(poi.properties.description).toLowerCase();

				// Get category name for searching
				const category = categories[poi.properties.category];
				const categoryName = category ? getTranslated(category.name).toLowerCase() : '';

				return name.includes(searchTerm) ||
				       description.includes(searchTerm) ||
				       categoryName.includes(searchTerm);
			});

			displaySearchResults(results);
		}

		function displaySearchResults(results) {
			if (results.length === 0) {
				dropdown.innerHTML = `<div class="graetzl-option">${t('dropdown.noPOIsFound')}</div>`;
				dropdown.style.display = 'block';
				return;
			}

			dropdown.innerHTML = results.slice(0, 10).map(poi => {
				const category = categories[poi.properties.category];
				const categoryLabel = category ? `${category.emoji} ${getTranslated(category.name)}` : poi.properties.category;

				return `
					<div class="graetzl-option" data-poi-id="${poi.properties.id}" data-name="${poi.properties.name}">
						<div style="font-weight: 600;">${poi.properties.name}</div>
						<div style="font-size: 0.85rem; color: #666; margin-top: 2px;">${categoryLabel}</div>
					</div>
				`;
			}).join('');

			// Add click handlers
			dropdown.querySelectorAll('.graetzl-option').forEach(option => {
				option.addEventListener('click', () => {
					const poiId = option.dataset.poiId;
					const poi = geoData.features.find(p => p.properties.id === poiId);
					if (poi) {
						selectPOI(poi);
					}
				});
			});

			dropdown.style.display = 'block';
		}

		function selectPOI(poi) {
			selectedPOI = poi;
			searchInput.value = poi.properties.name;
			searchInput.dataset.selected = 'true';
			dropdown.style.display = 'none';
			focusedIndex = -1;
			updateClearButton();
			centerOnPOI(poi);
		}

		function clearSelection() {
			selectedPOI = null;
			searchInput.value = '';
			searchInput.dataset.selected = 'false';
			dropdown.style.display = 'none';
			focusedIndex = -1;
			updateClearButton();
		}

		// Search input handler
		searchInput.addEventListener('input', (e) => {
			const searchTerm = e.target.value.trim().toLowerCase();
			searchInput.dataset.selected = 'false';
			focusedIndex = -1;

			// Clear previous timeout
			clearTimeout(searchTimeout);

			// Debounce search
			searchTimeout = setTimeout(() => {
				searchPOIs(searchTerm);
			}, 200);

			updateClearButton();
		});

		// Show dropdown on focus
		searchInput.addEventListener('focus', () => {
			if (searchInput.dataset.selected === 'true' && selectedPOI) {
				searchInput.select();
			}
			// Always show all POIs when focused (empty search shows all)
			const searchTerm = searchInput.value.trim().toLowerCase();
			searchPOIs(searchTerm || ' ');
		});

		// Keyboard navigation
		searchInput.addEventListener('keydown', (e) => {
			const options = Array.from(dropdown.querySelectorAll('.graetzl-option'));

			if (e.key === 'ArrowDown') {
				e.preventDefault();
				focusedIndex = Math.min(focusedIndex + 1, options.length - 1);
				updateFocusedOption(options);
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				focusedIndex = Math.max(focusedIndex - 1, -1);
				updateFocusedOption(options);
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (focusedIndex >= 0 && options[focusedIndex]) {
					options[focusedIndex].click();
				}
			} else if (e.key === 'Escape') {
				dropdown.style.display = 'none';
				searchInput.blur();
			}
		});

		function updateFocusedOption(options) {
			options.forEach((opt, idx) => {
				if (idx === focusedIndex) {
					opt.classList.add('focused');
					opt.scrollIntoView({ block: 'nearest' });
				} else {
					opt.classList.remove('focused');
				}
			});
		}

		// Clear button
		clearButton.addEventListener('click', clearSelection);

		// Close dropdown when clicking outside
		document.addEventListener('click', (e) => {
			if (!e.target.closest('.searchable-select')) {
				dropdown.style.display = 'none';
			}
		});
	}

	function centerOnPOI(poi) {
		const coords = poi.geometry.coordinates;
		const latLng = [coords[1], coords[0]]; // GeoJSON uses [lng, lat]

		// Center map on POI with zoom
		map.setView(latLng, 16, {
			animate: true,
			duration: 0.5
		});

		// Find and open the marker's popup
		currentMarkers.forEach(marker => {
			const markerLatLng = marker.getLatLng();
			if (Math.abs(markerLatLng.lat - latLng[0]) < 0.0001 &&
			    Math.abs(markerLatLng.lng - latLng[1]) < 0.0001) {
				marker.openPopup();
			}
		});
	}

	// Draw arrows between walkthrough POIs
	function drawWalkthroughArrows(poiIds) {
		// Clear existing arrows
		clearWalkthroughArrows();

		if (!poiIds || poiIds.length < 2) return;

		// Get POI coordinates
		const coords = [];
		poiIds.forEach(poiId => {
			const poi = geoData.features.find(f => f.properties.id === poiId);
			if (poi) {
				const [lng, lat] = poi.geometry.coordinates;
				coords.push([lat, lng]);
			}
		});

		// Draw arrows between consecutive POIs
		for (let i = 0; i < coords.length - 1; i++) {
			const start = coords[i];
			const end = coords[i + 1];

			// Create a polyline with arrow
			const polyline = L.polyline([start, end], {
				color: '#667eea',
				weight: 3,
				opacity: 0.8,
				smoothFactor: 1
			}).addTo(map);

			// Create arrow decorator
			const arrowHead = L.polylineDecorator(polyline, {
				patterns: [
					{
						offset: '100%',
						repeat: 0,
						symbol: L.Symbol.arrowHead({
							pixelSize: 12,
							polygon: true,
							pathOptions: {
								fillColor: '#667eea',
								fillOpacity: 1,
								weight: 0,
								color: '#667eea'
							}
						})
					},
					{
						offset: '50%',
						repeat: 0,
						symbol: L.Symbol.arrowHead({
							pixelSize: 8,
							polygon: true,
							pathOptions: {
								fillColor: '#667eea',
								fillOpacity: 0.6,
								weight: 0,
								color: '#667eea'
							}
						})
					}
				]
			}).addTo(map);

			walkthroughArrows.push(polyline);
			walkthroughArrows.push(arrowHead);
		}

		// Add number markers at each POI
		coords.forEach((coord, index) => {
			const poiId = poiIds[index];
			const poi = geoData.features.find(f => f.properties.id === poiId);

			const numberMarker = L.marker(coord, {
				icon: L.divIcon({
					html: `<div class="walkthrough-number-marker" style="
						background: #667eea;
						color: white;
						width: 24px;
						height: 24px;
						border-radius: 50%;
						display: flex;
						align-items: center;
						justify-content: center;
						font-weight: bold;
						font-size: 12px;
						border: 2px solid white;
						box-shadow: 0 2px 4px rgba(0,0,0,0.3);
						cursor: pointer;
					">${index + 1}</div>`,
					className: 'walkthrough-number',
					iconSize: [24, 24],
					iconAnchor: [12, 6]
				}),
				zIndexOffset: 1000
			}).addTo(map);

			// Store POI ID on marker
			numberMarker.poiId = poiId;

			// Add tooltip and popup if POI exists
			if (poi) {
				numberMarker.bindTooltip(poi.properties.name, {
					direction: 'top',
					offset: [0, -10],
					opacity: 0.9
				});

				// Create and bind the same popup as the main marker
				const icon = getCategoryIcon(poi.properties.category);
				const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coord[0]},${coord[1]}`;
				const learnMoreLink = poi.properties.link ? `<a href="${poi.properties.link}" target="_blank" class="poi-link">${t('poi.website')} →</a>` : '';
				const categoryInfo = categories[poi.properties.category];
				const categoryName = categoryInfo ? `${categoryInfo.emoji} ${getTranslated(categoryInfo.name)}` : '';
				const tags = poi.properties.tags || [];
				const tagsHtml = tags.length > 0
					? `<div class="poi-tags">${tags.map(tag => `<span class="poi-tag">${tag}</span>`).join('')}</div>`
					: '';
				const photoHtml = poi.properties.photo
					? `<img src="${poi.properties.photo}" alt="${poi.properties.name}" class="poi-photo" />`
					: '';

				const popupContent = `
					<div class="poi-popup">
						<div class="poi-icon">${icon}</div>
						<h3>${poi.properties.name}</h3>
						${categoryName ? `<div class="poi-category-label">${categoryName}</div>` : ''}
						${photoHtml}
						<p>${getTranslated(poi.properties.description)}</p>
						${tagsHtml}
						<div class="poi-actions">
							${learnMoreLink}
							<a href="${googleMapsUrl}" target="_blank" class="poi-link poi-link-secondary">${t('poi.route')}</a>
						</div>
					</div>
				`;

				numberMarker.bindPopup(popupContent, {
					maxWidth: 300,
					className: 'custom-popup'
				});

				// Add click handler to open popup
				numberMarker.on('click', () => {
					numberMarker.openPopup();
				});
			}

			walkthroughArrows.push(numberMarker);
		});
	}

	// Clear walkthrough arrows
	function clearWalkthroughArrows() {
		walkthroughArrows.forEach(layer => {
			map.removeLayer(layer);
		});
		walkthroughArrows = [];
	}

	// Draw number markers for list POIs (without arrows)
	function drawListNumbers(poiIds) {
		// Clear existing markers
		clearListMarkers();

		if (!poiIds || poiIds.length === 0) return;

		// Get POI coordinates
		const coords = [];
		poiIds.forEach(poiId => {
			const poi = geoData.features.find(f => f.properties.id === poiId);
			if (poi) {
				const [lng, lat] = poi.geometry.coordinates;
				coords.push([lat, lng]);
			}
		});

		// Add number markers at each POI
		coords.forEach((coord, index) => {
			const poiId = poiIds[index];
			const poi = geoData.features.find(f => f.properties.id === poiId);

			const numberMarker = L.marker(coord, {
				icon: L.divIcon({
					html: `<div class="list-number-marker" style="
						background: #2563eb;
						color: white;
						width: 24px;
						height: 24px;
						border-radius: 50%;
						display: flex;
						align-items: center;
						justify-content: center;
						font-weight: bold;
						font-size: 12px;
						border: 2px solid white;
						box-shadow: 0 2px 4px rgba(0,0,0,0.3);
						cursor: pointer;
					">${index + 1}</div>`,
					className: 'list-number',
					iconSize: [24, 24],
					iconAnchor: [12, 14]
				}),
				zIndexOffset: 1000
			}).addTo(map);

			// Store POI ID on marker
			numberMarker.poiId = poiId;

			// Add tooltip and popup if POI exists
			if (poi) {
				numberMarker.bindTooltip(poi.properties.name, {
					direction: 'top',
					offset: [0, -10],
					opacity: 0.9
				});

				// Create and bind the same popup as the main marker
				const icon = getCategoryIcon(poi.properties.category);
				const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coord[0]},${coord[1]}`;
				const learnMoreLink = poi.properties.link ? `<a href="${poi.properties.link}" target="_blank" class="poi-link">${t('poi.website')} →</a>` : '';
				const categoryInfo = categories[poi.properties.category];
				const categoryName = categoryInfo ? `${categoryInfo.emoji} ${getTranslated(categoryInfo.name)}` : '';
				const tags = poi.properties.tags || [];
				const tagsHtml = tags.length > 0
					? `<div class="poi-tags">${tags.map(tag => `<span class="poi-tag">${tag}</span>`).join('')}</div>`
					: '';
				const photoHtml = poi.properties.photo
					? `<img src="${poi.properties.photo}" alt="${poi.properties.name}" class="poi-photo" />`
					: '';

				const popupContent = `
					<div class="poi-popup">
						<div class="poi-icon">${icon}</div>
						<h3>${poi.properties.name}</h3>
						${categoryName ? `<div class="poi-category-label">${categoryName}</div>` : ''}
						${photoHtml}
						<p>${getTranslated(poi.properties.description)}</p>
						${tagsHtml}
						<div class="poi-actions">
							${learnMoreLink}
							<a href="${googleMapsUrl}" target="_blank" class="poi-link poi-link-secondary">${t('poi.route')}</a>
						</div>
					</div>
				`;

				numberMarker.bindPopup(popupContent, {
					maxWidth: 300,
					className: 'custom-popup'
				});

				// Add click handler to open popup
				numberMarker.on('click', () => {
					numberMarker.openPopup();
				});
			}

			listMarkers.push(numberMarker);
		});
	}

	// Clear list markers
	function clearListMarkers() {
		listMarkers.forEach(marker => {
			map.removeLayer(marker);
		});
		listMarkers = [];
	}

	// Zoom map to fit list POIs
	function zoomToListPOIs(poiIds) {
		if (!poiIds || poiIds.length === 0) return;

		const bounds = [];
		poiIds.forEach(poiId => {
			const poi = geoData.features.find(f => f.properties.id === poiId);
			if (poi) {
				const [lng, lat] = poi.geometry.coordinates;
				bounds.push([lat, lng]);
			}
		});

		if (bounds.length > 0) {
			map.fitBounds(bounds, {
				padding: [50, 50],
				maxZoom: 16
			});
		}
	}

	// List selector functionality
	function setupListSelector() {
		const searchInput = document.getElementById('list-search');
		const dropdown = document.getElementById('list-dropdown');
		const clearButton = document.getElementById('clear-list');
		const sidebarDiv = document.getElementById('poi-sidebar');
		const sidebarTitle = document.getElementById('poi-sidebar-title');
		const sidebarDescription = document.getElementById('poi-sidebar-description');
		const sidebarItems = document.getElementById('poi-sidebar-items');
		const closeSidebar = document.getElementById('close-poi-sidebar');
		const categoryToggle = document.getElementById('category-toggle');
		const categoryDropdown = document.getElementById('category-dropdown');

		if (!searchInput || !dropdown || !sidebarDiv) {
			console.warn('List UI elements not found');
			return;
		}

		let selectedList = null;
		let focusedListIndex = -1;

		// Update clear button visibility
		function updateClearButtonList() {
			if (searchInput.value || searchInput.dataset.selected === 'true') {
				clearButton.style.display = 'flex';
			} else {
				clearButton.style.display = 'none';
			}
		}

		// Populate list dropdown
		function populateLists() {
			dropdown.innerHTML = '';

			// Add "No list" option
			const noneOption = document.createElement('div');
			noneOption.className = 'graetzl-option';
			noneOption.dataset.id = '';
			noneOption.dataset.name = t('dropdown.noList');
			noneOption.textContent = t('dropdown.noList');
			noneOption.addEventListener('click', () => selectList(null));
			dropdown.appendChild(noneOption);

			// Add all list options
			listData.forEach(list => {
				const option = document.createElement('div');
				option.className = 'graetzl-option';
				option.dataset.id = list.id;
				const prefix = list.showAsWalk ? '🚶 ' : '📋 ';
				const title = getTranslated(list.title);
				option.dataset.name = title;
				option.textContent = prefix + title;
				option.addEventListener('click', () => selectList(list));
				dropdown.appendChild(option);
			});
		}

		// Filter dropdown based on search
		function filterListDropdown(searchTerm) {
			const options = dropdown.querySelectorAll('.graetzl-option');
			const term = searchTerm.toLowerCase();

			let visibleCount = 0;
			options.forEach(option => {
				const name = option.dataset.name.toLowerCase();
				if (name.includes(term)) {
					option.style.display = 'block';
					visibleCount++;
				} else {
					option.style.display = 'none';
				}
			});

			if (visibleCount > 0) {
				dropdown.style.display = 'block';
			} else {
				dropdown.style.display = 'none';
			}
		}

		// Update focused option
		function updateFocusedListOption(options) {
			options.forEach((opt, idx) => {
				if (idx === focusedListIndex) {
					opt.classList.add('focused');
					opt.scrollIntoView({ block: 'nearest' });
				} else {
					opt.classList.remove('focused');
				}
			});
		}

		// Select a list
		function selectList(list) {
			if (list) {
				selectedList = list;
				const prefix = list.showAsWalk ? '🚶 ' : '📋 ';
				searchInput.value = prefix + getTranslated(list.title);
				searchInput.dataset.selected = 'true';
				activateList(list.id);
			} else {
				selectedList = null;
				searchInput.value = '';
				searchInput.placeholder = t('placeholder.noList');
				searchInput.dataset.selected = 'false';
				deactivateList();
			}

			dropdown.style.display = 'none';
			focusedListIndex = -1;
			updateClearButtonList();
		}

		// Search input handlers
		searchInput.addEventListener('input', (e) => {
			focusedListIndex = -1;
			filterListDropdown(e.target.value);
			updateClearButtonList();
		});

		searchInput.addEventListener('focus', () => {
			if (searchInput.dataset.selected === 'false' || !searchInput.dataset.selected) {
				searchInput.value = '';
			} else if (selectedList) {
				searchInput.select();
			}
			// Always show all options when focused
			filterListDropdown('');
			dropdown.style.display = 'block';
		});

		// Keyboard navigation
		searchInput.addEventListener('keydown', (e) => {
			const options = Array.from(dropdown.querySelectorAll('.graetzl-option:not([style*="display: none"])'));

			if (e.key === 'ArrowDown') {
				e.preventDefault();
				focusedListIndex = Math.min(focusedListIndex + 1, options.length - 1);
				updateFocusedListOption(options);
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				focusedListIndex = Math.max(focusedListIndex - 1, -1);
				updateFocusedListOption(options);
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (focusedListIndex >= 0 && options[focusedListIndex]) {
					options[focusedListIndex].click();
				}
			} else if (e.key === 'Escape') {
				dropdown.style.display = 'none';
				searchInput.blur();
			}
		});

		// Clear button
		clearButton.addEventListener('click', () => {
			selectList(null);
		});

		// Close dropdown when clicking outside
		document.addEventListener('click', (e) => {
			if (!e.target.closest('.searchable-select') || e.target.closest('#graetzl-search')) {
				dropdown.style.display = 'none';
			}
		});

		// Update sidebar with list POIs
		function updateSidebar(list) {
			sidebarTitle.textContent = getTranslated(list.title);
			const description = getTranslated(list.description);
			sidebarDescription.textContent = description;
			sidebarDescription.style.display = description ? 'block' : 'none';
			sidebarItems.innerHTML = '';

			list.pois.forEach((poiId, index) => {
				const poi = geoData.features.find(f => f.properties.id === poiId);
				if (!poi) return;

				const category = categories[poi.properties.category];
				const categoryIcon = category ? category.emoji : '';
				const description = getTranslated(poi.properties.description);

				const item = document.createElement('div');
				item.className = 'poi-sidebar-item';
				item.dataset.poiId = poiId;
				item.innerHTML = `
					<div class="list-item-number">${index + 1}</div>
					<div class="list-item-content">
						<div class="list-item-name">${categoryIcon} ${poi.properties.name}</div>
						${description ? `<div class="list-item-description">${description}</div>` : ''}
						${poi.properties.link ? `<a href="${poi.properties.link}" target="_blank" class="list-item-link">${t('poi.website')}</a>` : ''}
						${poi.properties.instagram ? `<a href="${poi.properties.instagram}" target="_blank" class="list-item-link">${t('poi.instagram')}</a>` : ''}
					</div>
				`;

				// Click handler to center map on POI
				item.addEventListener('click', () => {
					const coords = poi.geometry.coordinates;
					const latLng = [coords[1], coords[0]];

					// Ensure we're at the right zoom level
					if (map.getZoom() !== 17) {
						map.setView(latLng, 17, { animate: true });
					} else {
						// Pan to center exactly on the POI
						map.panTo(latLng, { animate: true, duration: 0.5 });
					}

					// Find and open the marker popup after animation
					setTimeout(() => {
						const marker = currentMarkers.find(m => m.poiId === poiId);
						if (marker) {
							marker.openPopup();
						}
					}, 300);

					// Highlight the item
					document.querySelectorAll('.poi-sidebar-item').forEach(el => el.classList.remove('active'));
					item.classList.add('active');
				});

				// Add hover effect to highlight corresponding marker
				item.addEventListener('mouseenter', () => {
					const marker = currentMarkers.find(m => m.poiId === poiId);
					if (marker && marker._icon) {
						const markerElement = marker._icon.querySelector('.custom-marker');
						if (markerElement) {
							markerElement.classList.add('marker-highlighted');
						}
					}
				});

				item.addEventListener('mouseleave', () => {
					const marker = currentMarkers.find(m => m.poiId === poiId);
					if (marker && marker._icon) {
						const markerElement = marker._icon.querySelector('.custom-marker');
						if (markerElement) {
							markerElement.classList.remove('marker-highlighted');
						}
					}
				});

				sidebarItems.appendChild(item);
			});
		}

		// Activate list
		function activateList(listId) {
			console.log('=== Activating list ===');
			console.log('List ID:', listId);
			console.log('Available lists:', listData.length);

			// Clear any existing arrows/numbers
			clearWalkthroughArrows();
			clearListMarkers();

			const list = listData.find(l => l.id === listId);
			if (!list) {
				console.error('List not found:', listId);
				console.error('Available list IDs:', listData.map(l => l.id));
				return;
			}

			console.log('Found list:', getTranslated(list.title), 'POIs:', list.pois.length, 'showAsWalk:', list.showAsWalk);
			currentList = list;

			// Show sidebar
			updateSidebar(list);
			document.querySelector('.container').classList.add('sidebar-active');

			// Disable category filter toggle
			if (categoryToggle) {
				categoryToggle.disabled = true;
				categoryToggle.style.opacity = '0.5';
				categoryToggle.style.cursor = 'not-allowed';
			}

			// Close category dropdown if open
			if (categoryDropdown) {
				categoryDropdown.style.display = 'none';
			}

			// Update markers to show only list POIs
			updateMarkers();

			// Wait for sidebar animation to complete, then invalidate map size and zoom
			setTimeout(() => {
				// Invalidate map size so it recalculates based on new container dimensions
				map.invalidateSize();

				// Zoom map to fit all list POIs
				zoomToListPOIs(list.pois);

				// Draw arrows if showAsWalk is true, otherwise just numbers
				if (list.showAsWalk) {
					drawWalkthroughArrows(list.pois);
				} else {
					drawListNumbers(list.pois);
				}
			}, 350); // Wait for CSS transition (0.3s) plus a small buffer

			// Update URL
			updateUrlForList(list);

			console.log('List activated:', list.title, 'showAsWalk:', list.showAsWalk);
		}

		// Deactivate list
		function deactivateList() {
			console.log('=== Deactivating list ===');
			currentList = null;

			// Hide sidebar
			document.querySelector('.container').classList.remove('sidebar-active');

			// Wait for sidebar animation to complete, then invalidate map size
			setTimeout(() => {
				// Invalidate map size so it recalculates based on new container dimensions
				map.invalidateSize();
			}, 350); // Wait for CSS transition (0.3s) plus a small buffer

			// Clear sidebar content
			if (sidebarTitle) sidebarTitle.textContent = '';
			if (sidebarDescription) {
				sidebarDescription.textContent = '';
				sidebarDescription.style.display = 'none';
			}
			if (sidebarItems) sidebarItems.innerHTML = '';

			// Re-enable category filter toggle
			if (categoryToggle) {
				categoryToggle.disabled = false;
				categoryToggle.style.opacity = '1';
				categoryToggle.style.cursor = 'pointer';
			}

			// Clear both list markers and walkthrough arrows
			clearListMarkers();
			clearWalkthroughArrows();

			// Update markers to show filtered POIs
			updateMarkers();

			// Update URL (go back to root)
			updateUrlForList(null);

			console.log('List deactivated');
		}

		// Handle close button
		if (closeSidebar) {
			closeSidebar.addEventListener('click', () => {
				deactivateList();
			});
		}

		// Initial population
		populateLists();

		// Store reference to activate function for URL initialization
		activateListFn = activateList;
	}

	// Handle browser back/forward buttons
	window.addEventListener('popstate', () => {
		const graetzlSlug = getGraetzlSlugFromPath();
		if (graetzlSlug) {
			const graetzl = findGraetzlBySlug(graetzlData, graetzlSlug);
			if (graetzl) {
				selectGraetzl(graetzl);
			}
		} else {
			selectGraetzl(null);
		}
	});

	// Setup POI search
	setupPOISearch();

	// Function to update all UI text based on current language
	function updateUILanguage() {
		// Header
		const headerSubtitle = document.getElementById('header-subtitle');
		if (headerSubtitle) {
			headerSubtitle.textContent = t('header.subtitle');
		}

		// Navigation sections
		const navSections = {
			'list-select': { parent: 'h2', text: t('nav.list') },
			'walkthrough-select': { parent: 'h2', text: t('nav.walkthrough') },
			'graetzl-search': { parent: 'h2', text: t('nav.selectGraetzl') },
			'poi-search': { parent: 'h2', text: t('nav.searchPOI') }
		};

		Object.entries(navSections).forEach(([id, config]) => {
			const element = document.getElementById(id);
			if (element) {
				const heading = element.closest('.nav-section')?.querySelector('h2');
				if (heading) {
					heading.textContent = config.text;
				}
			}
		});

		// Placeholders
		const listSearch = document.getElementById('list-search');
		if (listSearch && !listSearch.dataset.selected) {
			listSearch.placeholder = t('placeholder.noList');
		}

		const graetzlSearch = document.getElementById('graetzl-search');
		if (graetzlSearch) {
			graetzlSearch.placeholder = t('placeholder.allGraetzl');
		}

		const poiSearch = document.getElementById('poi-search');
		if (poiSearch) {
			poiSearch.placeholder = t('placeholder.searchPOI');
		}

		const categorySearch = document.getElementById('category-search');
		if (categorySearch) {
			categorySearch.placeholder = t('placeholder.searchCategories');
		}

		// Category buttons
		const categoryToggleText = document.querySelector('.category-toggle-text');
		if (categoryToggleText) {
			categoryToggleText.textContent = t('category.allCategories');
		}

		const selectAllBtn = document.getElementById('select-all-categories');
		if (selectAllBtn) {
			selectAllBtn.textContent = t('button.selectAll');
		}

		const deselectAllBtn = document.getElementById('deselect-all-categories');
		if (deselectAllBtn) {
			deselectAllBtn.textContent = t('button.deselectAll');
		}

		// Clear buttons
		document.querySelectorAll('.clear-button').forEach(btn => {
			btn.title = t('button.clearSelection');
		});

		// Language switcher button
		const langSwitcherText = document.getElementById('language-switcher-text');
		if (langSwitcherText) {
			langSwitcherText.textContent = getCurrentLanguage() === 'de' ? 'EN' : 'DE';
		}

		// Update list/walk dropdown
		const listSearchEl = document.getElementById('list-search');
		const listDropdownEl = document.getElementById('list-dropdown');
		if (listSearchEl && listDropdownEl && listData.length > 0) {
			const currentSelected = currentList;

			// Re-sort lists based on new language (for alphabetical fallback)
			sortLists();

			// Re-populate dropdown with translated titles
			listDropdownEl.innerHTML = '';

			const noneOption = document.createElement('div');
			noneOption.className = 'graetzl-option';
			noneOption.textContent = t('placeholder.noList');
			listDropdownEl.appendChild(noneOption);

			listData.forEach(list => {
				const option = document.createElement('div');
				option.className = 'graetzl-option';
				const prefix = list.showAsWalk ? '🚶 ' : '📋 ';
				option.textContent = prefix + getTranslated(list.title);
				listDropdownEl.appendChild(option);
			});

			// Update current selection if active
			if (currentSelected) {
				const prefix = currentSelected.showAsWalk ? '🚶 ' : '📋 ';
				listSearchEl.value = prefix + getTranslated(currentSelected.title);
			}
		}

		// Update sidebar if active
		if (currentList) {
			const sidebarTitle = document.getElementById('poi-sidebar-title');
			const sidebarDescription = document.getElementById('poi-sidebar-description');
			if (sidebarTitle) {
				sidebarTitle.textContent = getTranslated(currentList.title);
			}
			if (sidebarDescription) {
				const description = getTranslated(currentList.description);
				sidebarDescription.textContent = description;
			}
		}
	}

	// Setup language switcher
	function setupLanguageSwitcher() {
		const languageSwitcher = document.getElementById('language-switcher');
		const languageSwitcherText = document.getElementById('language-switcher-text');

		if (!languageSwitcher || !languageSwitcherText) {
			console.warn('Language switcher elements not found');
			return;
		}

		// Set initial text
		languageSwitcherText.textContent = getCurrentLanguage() === 'de' ? 'EN' : 'DE';

		// Handle click
		languageSwitcher.addEventListener('click', () => {
			const newLang = getCurrentLanguage() === 'de' ? 'en' : 'de';
			setLanguage(newLang);
		});

		// Listen for language changes
		window.addEventListener('languagechange', () => {
			updateUILanguage();
		});
	}

	// Setup language system
	setupLanguageSwitcher();
	updateUILanguage();

	initialize();
});
