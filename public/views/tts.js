// Browser based TTS, leveraging the SpeechSynthesis API
// https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis

const speak = (async function() {

const noop = () => {};

if (QueryString.tts != '1') {
	return noop;
}

const URL_RE = /\bhttps?:\/\/[^\s]+\b/g;
const SPEECH_PAUSE = 1000;

const synth = window.speechSynthesis;
const lang = QueryString.lang || 'en';
const voices = shuffle(window.speechSynthesis.getVoices().filter(v => v.lang.split('-')[0] == 'en'));

if (voices.length <= 0) {
	console.log(`Warning: TTS requested for language ${lang}, but no language available`);
	return noop;
}

const voice_map = {};
const speak_queue = [];

let cur_voice_index = 0;
let speaking = false;

function hasVoice(username) {
	return !!voice_map[username];
}

function getUserVoice(username) {
	let voice = voice_map[username];

	if (!voice) {
		voice = voices[cur_voice_index];
		cur_voice_index = ++cur_voice_index % voices.length;
	}

	return voice;
}

function speakNext() {
	if (speaking) return;
	if (speak_queue.lenth <= 0) return;

	speaking = true;

	const chatter = speak_queue.shift();
	const voice = getUserVoice(chatter.username);
	const utterance = new SpeechSynthesisUtterance((chatter.message || '').replace(URL, 'link'));

	utterance.voice = voice;

	utterance.onend = utterance.onerror = () => {
		delete utterance.onend;
		delete utterance.onerror;

		speaking = false;

		setTimeout(speakNext, SPEECH_PAUSE);
	};

	synth.speak(utterance)
}

function speak(chatter) {
	if (chatter.username == "classictetrisbot") return;

	if (!hasVoice(chatter.username)) {
		speak_queue.push({ ...chatter, message: `${chatter.display_name} is now chatting with this voice.` });
	}

	speak_queue.push(chatter);
	speakNext();
}

return speak;

})();