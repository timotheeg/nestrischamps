// Browser based TTS, leveraging the SpeechSynthesis API
// https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis

const speak = (function () {
	if (!QueryString.get('tts')) {
		return function noop() {};
	}

	const URL_RE = /\bhttps?:\/\/[^\s]+\b/g;
	const SPEECH_PAUSE = 1000;
	const VOICES_DELAY = 25;

	const synth = window.speechSynthesis;
	const lang = QueryString.get('lang') || 'en';
	const voice_map = {};
	const speak_queue = [];

	let acquire_voices_tries = 5;
	let cur_voice_index = 0;
	let speaking = false;
	let voices = [];

	function getVoices() {
		const all_voices = window.speechSynthesis.getVoices();

		if (all_voices.length <= 0) {
			if (acquire_voices_tries--) {
				setTimeout(getVoices, VOICES_DELAY);
			} else {
				console.log('Unable to get voices');
			}

			return;
		}

		voices = shuffle(all_voices.filter(v => v.lang.split('-')[0] === lang));
	}

	function hasVoice(username) {
		return !!voice_map[username];
	}

	function getUserVoice(username) {
		let voice = voice_map[username];

		if (!voice) {
			voice = voices[cur_voice_index];
			cur_voice_index = ++cur_voice_index % voices.length;

			voice_map[username] = voice;
		}

		return voice;
	}

	function speakNext() {
		if (speaking) return;
		if (speak_queue.length <= 0) return;

		speaking = true;

		const chatter = speak_queue.shift();
		const voice = getUserVoice(chatter.username);
		const utterance = new SpeechSynthesisUtterance(
			(chatter.message || '').replace(URL_RE, 'link')
		);

		utterance.voice = voice;

		utterance.onend = utterance.onerror = () => {
			delete utterance.onend;
			delete utterance.onerror;

			speaking = false;

			setTimeout(speakNext, SPEECH_PAUSE);
		};

		console.log('Speaking', chatter.username, voice.name, chatter.message);

		synth.speak(utterance);
	}

	function speak(chatter) {
		if (voices.length <= 0) return;
		if (chatter.username == 'classictetrisbot') return;

		if (!hasVoice(chatter.username)) {
			speak_queue.push({
				...chatter,
				message: `${chatter.display_name} is now chatting with this voice.`,
			});
		}

		speak_queue.push(chatter);
		speakNext();
	}

	getVoices();

	return speak;
})();
