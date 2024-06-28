import QueryString from '/js/QueryString.js';
import { shuffle } from '/views/utils.js';

// Browser based TTS, leveraging the SpeechSynthesis API
// https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis

const URL_RE = /\bhttps?:\/\/[^\s]+\b/g;
const SPEECH_PAUSE = 1000;
const VOICES_DELAY = 50;

const synth = window.speechSynthesis;
const _lang = /^[a-z]{2}(-[A-Z]{2})?$/.test(QueryString.get('lang'))
	? QueryString.get('lang')
	: navigator.languages?.[0] || 'en-GB';
const voice_map = {};
const speak_queue = []; // TODO can we just use SpeechSynthesis built-in queue instead of our own queue?

const pending_voice_assignements = [];

let all_voices = [];
let acquire_voices_tries = 20;
let cur_voice_index = 0;
let speaking = false;
let voices = [];

function langMatch(targetLang, checkLang) {
	return targetLang.includes('-')
		? checkLang === targetLang || checkLang === targetLang.replace('-', '_') // omg v.lang on mobile is en_US, while on desktop en-US 🤦
		: checkLang.startsWith(targetLang);
}

function getVoice(nameRe, lang) {
	const voices = window.speechSynthesis.getVoices();
	let voice = voices.find(v => nameRe.test(v.name) && langMatch(lang, v.lang));

	if (!voice) {
		const filteredVoices = voices.filter(
			v => v.default && langMatch(lang, v.lang)
		);
		voice = shuffle(filteredVoices)[0];
	}

	if (!voice && lang.includes('-')) {
		const filteredVoices = voices.filter(
			v => v.default && langMatch(lang.split('-')[0], v.lang)
		);
		voice = shuffle(filteredVoices)[0];
	}

	console.log(`Voice Selected`, voice);
	return voice;
}

function getVoices() {
	if (all_voices.length) return; // run only once!

	all_voices.push(...window.speechSynthesis.getVoices());

	if (all_voices.length <= 0) {
		if (acquire_voices_tries--) {
			setTimeout(getVoices, VOICES_DELAY);
		} else {
			console.warn('Unable to get voices');
		}

		return;
	}

	while (pending_voice_assignements.length) {
		const { username, voiceNameRe, lang } = pending_voice_assignements.shift(); // note: lang is guaranteed to be provided
		const voice = getVoice(voiceNameRe, lang);
		console.log(
			`delayed voice assignment for ${username}:`,
			voice,
			voiceNameRe
		);
		voice_map[username] = voice;
	}

	voices = shuffle(all_voices.filter(v => langMatch(_lang, v.lang)));

	if (voices.length <= 0 && _lang.includes('-')) {
		voices = shuffle(
			all_voices.filter(v => langMatch(_lang.split('-')[0], v.lang))
		);
	}

	// Assign Daniel UK as system voice
	voice_map._system = getVoice(/^daniel/i, _lang);
}

function hasVoice(username) {
	return !!voice_map[username];
}

export function assignUserVoice(username, { voice, voiceNameRe, lang }) {
	if (lang) console.warn();
	lang = lang || _lang;

	if (voice) {
		voice_map[username] = voice;
	} else if (voiceNameRe) {
		if (all_voices.length <= 0) {
			pending_voice_assignements.push({ username, voiceNameRe, lang });
		} else {
			voice_map[username] = getVoice(voiceNameRe, lang);
		}
	} else {
		console.warn(
			`assignUserVoice(): called with invalid parameters for user (${username})`
		);
	}
}

function getUserVoice(username) {
	let voice = voice_map[username];

	if (!voice) {
		voice = voices[cur_voice_index];
		cur_voice_index = ++cur_voice_index % voices.length;

		assignUserVoice(username, { voice, lang: _lang });
	}

	return voice;
}

function speakNow(chatter) {
	const voice = getUserVoice(chatter.username);
	const utterance = new SpeechSynthesisUtterance(
		(chatter.message || '').replace(URL_RE, 'link')
	);

	utterance.rate = chatter.rate ?? 1;

	if (voice) {
		utterance.voice = voice;
		console.log(
			`SpeechSynthesis: ${chatter.username} (as ${voice.name}): ${chatter.message}`
		);
	} else {
		console.log(`SpeechSynthesis: ${chatter.username}: ${chatter.message}`);
	}

	utterance.onend = utterance.onerror = () => {
		delete utterance.onend;
		delete utterance.onerror;

		chatter.callback();
	};

	synth.speak(utterance);
}

function speakNext() {
	if (speaking) return;
	if (speak_queue.length <= 0) return;

	speaking = true;

	const chatter = speak_queue.shift();

	// wrap callback to add flow controls
	const callback = chatter.callback;

	chatter.callback = () => {
		try {
			callback();
		} catch (err) {}

		setTimeout(() => {
			speaking = false;
			speakNext();
		}, SPEECH_PAUSE);
	};

	const utterance = speakNow(chatter);
}

getVoices();

function noop() {}

export function speak(chatter, { now = false, callback = noop } = {}) {
	if (voices.length <= 0) return;
	if (chatter.username == 'classictetrisbot') return;

	if (!hasVoice(chatter.username)) {
		speak_queue.push({
			...chatter,
			message: `${chatter.display_name} is now chatting with this voice.`,
			callback: noop,
		});
	}

	const augmented_chatter = {
		...chatter,
		callback,
	};

	if (now) {
		speakNow(augmented_chatter);
	} else {
		speak_queue.push(augmented_chatter);
		speakNext();
	}
}

export default speak;
