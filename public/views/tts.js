// Browser based TTS, leveraging the SpeechSynthesis API
// https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis

const speak = (function () {
	const URL_RE = /\bhttps?:\/\/[^\s]+\b/g;
	const SPEECH_PAUSE = 1000;
	const VOICES_DELAY = 25;

	const synth = window.speechSynthesis;
	const lang = QueryString.get('lang') || 'en';
	const voice_map = {};
	const speak_queue = []; // TODO can we just use SpeechSynthesis built-in queue instead of our own queue?

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

		// Assign Daniel UK as system voice
		voice_map._system = all_voices.find(v => v.name === 'Daniel');
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

	function speakNow(chatter) {
		const voice = getUserVoice(chatter.username);
		const utterance = new SpeechSynthesisUtterance(
			(chatter.message || '').replace(URL_RE, 'link')
		);

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
			speaking = false;

			try {
				callback();
			} catch (err) {}

			setTimeout(speakNext, SPEECH_PAUSE);
		};

		const utterance = speakNow(chatter);
	}

	function noop() {}

	function speak(chatter, { now = false, callback = noop } = {}) {
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

	getVoices();

	return speak;
})();
