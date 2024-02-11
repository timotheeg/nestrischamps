import QueryString from '/js/QueryString.js';
import { assignUserVoice, speak } from '/views/tts.js';

const botName = '_ntc_commentator_bot';
const lang = /^[a-z]{2}(-[A-Z]{2})?$/.test(QueryString.get('lang'))
	? QueryString.get('lang')
	: navigator.languages?.[0] || 'en';
const voiceNameRe =
	QueryString.get('botvoice') && /^[a-z]+$/i.test(QueryString.get('botvoice'))
		? new RegExp(`^${QueryString.get('botvoice')}`, 'i')
		: /^(daniel|thomas)/i;
const botInterval = /^\d+$/.test(QueryString.get('botinterval'))
	? parseInt(QueryString.get('botinterval'), 10) * 1000
	: 30 * 1000;
const botRate = lang.startsWith('en') ? 1.15 : 1; // speed up is not the same in all browsers :'(

export class MatchCommentatorBot {
	constructor(players) {
		if (players.length > 2) {
			console.warning(`commentator bot is only supports 2-player matches`);
			return;
		}

		assignUserVoice(botName, { voiceNameRe });

		this.players = players;

		this.intervalId = setInterval(() => this.#scoreUpdate(), botInterval);

		players.forEach((player, idx) => {
			player.on('gamestart', () => this.gameStart(idx));
			player.on('gameover', () => this.gameOver(idx));
		});
	}

	gameStart(_playerIdx) {
		if (this.intervalId) {
			this.intervalId = clearInterval(this.intervalId);
		}

		this.intervalId = setInterval(() => this.#scoreUpdate(), botInterval);
	}

	gameOver(playerIdx) {
		this.intervalId = clearInterval(this.intervalId);

		const player = this.players[playerIdx];
		const otherPlayerIdx = (playerIdx + 1) % 2;
		const otherPlayer = this.players[otherPlayerIdx];

		if (!otherPlayer.game) return;
		if (otherPlayer.game.over) {
			if (player.getScore() > otherPlayer.getScore()) {
				speak(
					{
						username: botName,
						rate: botRate,
						message: lang.startsWith('fr')
							? `Player ${
									playerIdx + 1
							  } takes the game with ${this.#getEnglishScore(
									player.getScore()
							  )}.`
							: `Joueur ${playerIdx + 1} gagne avec ${this.#getFrenchScore(
									player.getScore()
							  )}.`,
					},
					{
						now: true,
					}
				);
			}
		} else if (player.getScore() > otherPlayer.getScore()) {
			const upperThousand = Math.floor(player.getScore() / 1000) + 1; // not using ceil because we need a strict +1
			speak(
				{
					username: botName,
					rate: botRate,
					message: lang.startsWith('fr')
						? `CHASE DOWN! Player ${
								otherPlayerIdx + 1
						  } needs ${this.#getEnglishScore(upperThousand * 1000)}.`
						: `COURSE! Joueur ${
								otherPlayerIdx + 1
						  } a besoin de ${this.#getFrenchScore(upperThousand * 1000)}.`,
				},
				{
					now: true,
				}
			);

			this.intervalId = setInterval(() => {
				speak(
					{
						username: botName,
						rate: botRate,
						message: this.#getPlayerScoreUpdate(otherPlayerIdx),
					},
					{
						now: true,
					}
				);
			}, botInterval);
		}
	}

	#getEnglishScore(score) {
		const kScore = Math.floor(score / 1000);
		return kScore >= 1000
			? `${(kScore / 1000).toFixed(3)} millions`
			: `${kScore}k`;
	}

	#getFrenchScore(score) {
		const kScore = Math.floor(score / 1000) * 1000;
		return `${kScore}`;
	}

	#getPlayerScoreUpdate(playerIdx) {
		const score = this.players[playerIdx].getScore();
		if (lang.startsWith('fr')) {
			const frScore = this.#getFrenchScore(score);
			return `joueur ${playerIdx + 1}: ${frScore}`;
		}

		const enScore = this.#getEnglishScore(score);
		return `player ${playerIdx + 1}: ${enScore}`;
	}

	#scoreUpdate() {
		speak(
			{
				username: botName,
				rate: botRate,
				message: lang.startsWith('fr') ? 'Les scores' : 'Score update',
			},
			{
				now: true,
				callback: () => this.#reportPlayer1Score(),
			}
		);
	}

	#reportPlayer1Score() {
		speak(
			{
				username: botName,
				rate: botRate,
				message: this.#getPlayerScoreUpdate(0),
			},
			{
				now: true,
				callback: () => this.#reportPlayer2Score(),
			}
		);
	}

	#reportPlayer2Score() {
		speak(
			{
				username: botName,
				rate: botRate,
				message: this.#getPlayerScoreUpdate(1),
			},
			{
				now: true,
			}
		);
	}
}
