/**
 * Internationalization utilities
 */

import de from './lang/de.js';
import en from './lang/en.js';

// Language files
const languages = { de, en };

// Current language (default: English)
let currentLanguage = 'en';

// Get current language from localStorage or browser
export function initLanguage() {
	// Try to get from localStorage first
	const savedLang = localStorage.getItem('graetzlmap-language');
	if (savedLang === 'de' || savedLang === 'en') {
		currentLanguage = savedLang;
		return;
	}

	// Otherwise, detect from browser
	const browserLang = navigator.language.split('-')[0];
	currentLanguage = (browserLang === 'de' || browserLang === 'en') ? browserLang : 'en';
	localStorage.setItem('graetzlmap-language', currentLanguage);
}

// Get current language
export function getCurrentLanguage() {
	return currentLanguage;
}

// Set current language
export function setLanguage(lang) {
	if (lang === 'de' || lang === 'en') {
		currentLanguage = lang;
		localStorage.setItem('graetzlmap-language', lang);
		// Dispatch event for UI updates
		window.dispatchEvent(new CustomEvent('languagechange', { detail: { language: lang } }));
	}
}

// Get translated text from multilingual object or string
// Falls back to English if current language not available
export function getTranslated(textObj) {
	if (!textObj) return '';
	if (typeof textObj === 'string') return textObj;
	if (typeof textObj === 'object') {
		return textObj[currentLanguage] || textObj.en || textObj.de || '';
	}
	return '';
}

// Helper function to translate a key path
export function t(keyPath) {
	const keys = keyPath.split('.');
	let value = languages[currentLanguage];

	for (const key of keys) {
		value = value?.[key];
		if (value === undefined) {
			console.warn(`Translation key not found: ${keyPath}`);
			return keyPath;
		}
	}

	return value;
}

export default {
	initLanguage,
	getCurrentLanguage,
	setLanguage,
	getTranslated,
	t
};
