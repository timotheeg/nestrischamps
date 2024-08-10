import User from '../domains/User.js';
import dbPool from '../modules/db.js';

class UserDAO {
	constructor() {
		this.users_by_id = new Map();
		this.users_by_login = new Map();
		this.users_by_secret = new Map();
	}

	addUserFromData(user_data) {
		const user = new User(user_data);

		user.on('expired', () => {
			this.removeUser(user);
		});

		this.addUser(user);

		return user;
	}

	addUser(user) {
		this.users_by_id.set(user.id, user);
		this.users_by_login.set(user.login, user);
		this.users_by_secret.set(user.secret, user);
	}

	removeUser(user) {
		this.users_by_id.delete(user.id);
		this.users_by_login.delete(user.login);
		this.users_by_secret.delete(user.secret);
	}

	async createUser(user_data, options) {
		console.log('createUser', user_data, options);

		const identity = await dbPool.query(
			`INSERT INTO user_identities
			(provider, provider_user_id)
			VALUES
			($1, $2)
			ON CONFLICT(provider, provider_user_id)
			DO UPDATE SET last_login_at=NOW()
			RETURNING user_id
			`,
			[options.provider, user_data.id]
		);

		let user_id = identity.rows?.[0]?.user_id;

		console.log({ user_id });

		if (user_id) {
			// we already have a user mapping, so we take the opportunity to update it with the lastest values, depending on the provider
			if (options.provider === 'twitch') {
				await dbPool.query(
					`UPDATE users
					SET email=$1, type=$2, description=$3, display_name=$4, profile_image_url=$5, last_login_at=NOW();
					`,
					[
						user_data.email,
						user_data.type,
						user_data.description,
						user_data.display_name,
						user_data.profile_image_url,
					]
				);
			} else if (options.provider === 'google') {
				// TODO: including finding a login
			}
		} else {
			console.log('creating user');
			// user is not already mapped, we must create a new user now, and link it to the identity
			if (options.provider === 'twitch') {
				const res = await dbPool.query(
					`INSERT INTO users
					(login, email, secret, type, description, display_name, profile_image_url)
					VALUES
					($1, $2, $3, $4, $5, $6, $7)
					ON CONFLICT(login)
					DO UPDATE SET login=concat('t_', $1), email=$2, type=$4, description=$5, display_name=$6, profile_image_url=$7, last_login_at=NOW()
					RETURNING id
					`,
					[
						user_data.login,
						user_data.email,
						user_data.secret,
						user_data.type,
						user_data.description,
						user_data.display_name,
						user_data.profile_image_url,
					]
				);

				user_id = res.rows?.[0]?.id;
			} else if (provider === 'google') {
				// TODO: including finding a login
			}

			console.log('updating user_identities', [
				user_id,
				options.provider,
				user_data.id,
			]);

			await dbPool.query(
				`UPDATE user_identities
				SET user_id=$1
				WHERE
				provider=$2 AND provider_user_id=$3
				`,
				[user_id, options.provider, user_data.id]
			);
		}

		// we force fetch to:
		// 1) get the correct data shape
		// 2) ensure we get the latest secret
		return this.getUserById(user_id);
	}

	async deleteUser(user) {
		this.removeUser(user);

		await dbPool.query('DELETE FROM users WHERE id=$1;', [user.id]);
	}

	async updateSecret(user, new_secret) {
		// WARNING: potential re-entrancy problem with this method
		// WARNING: deal with it later

		try {
			// then update DB ... dubious order, the whole thing should be a transaction
			await dbPool.query(
				`UPDATE users
				set secret=$1
				WHERE id=$2
				`,
				[new_secret, user.id]
			);

			// TODO: add greater processing safety here
			this.users_by_secret.delete(user.secret);
			user.secret = new_secret;
			this.users_by_secret.set(user.secret, user);
		} catch (err) {
			console.log(`Unable to update secret for user ${user.login}`);
		}

		return user;
	}

	async getUserById(id, force_fetch = false) {
		let user = this.users_by_id.get(id);

		if (!user || force_fetch) {
			const result = await dbPool.query('SELECT * FROM users WHERE id=$1', [
				id,
			]);

			if (result.rows.length) {
				// we have the latest data, but another process may have
				// created the user object since we last checked
				// async double-check for sanity
				user = this.users_by_id.get(id);

				if (!user) {
					user = this.addUserFromData(result.rows[0]);
				} else {
					user.updateUserFields(result.rows[0]);
				}
			}
		}

		return user;
	}

	async getUserByLogin(login, force_fetch = false) {
		let user = this.users_by_login.get(login);

		if (!user || force_fetch) {
			const result = await dbPool.query('SELECT * FROM users WHERE login=$1', [
				login,
			]);

			if (result.rows.length) {
				// async double-check for sanity
				user = this.users_by_login.get(login);

				if (!user) {
					user = this.addUserFromData(result.rows[0]);
				} else {
					user.updateUserFields(result.rows[0]);
				}
			}
		}

		return user;
	}

	async getUserBySecret(secret) {
		let user = this.users_by_secret.get(secret);

		if (!user) {
			const result = await dbPool.query('SELECT * FROM users WHERE secret=$1', [
				secret,
			]);

			if (result.rows.length) {
				// async double-check for sanity
				user = this.users_by_secret.get(secret);

				if (!user) {
					user = this.addUserFromData(result.rows[0]);
				}
			}
		}

		return user;
	}

	async updateProfile(user_id, update) {
		await dbPool.query(
			`UPDATE users
			SET dob=$1, country_code=$2, city=$3, style=$4, interests=$5, timezone=$6
			WHERE id=$7;
			`,
			[
				update.dob,
				update.country_code,
				update.city,
				update.style,
				update.interests,
				update.timezone || 'UTC',
				user_id,
			]
		);

		const user = await this.getUserById(user_id);

		// Always assign a date to user's dob
		update.dob = update.dob ? new Date(update.dob) : null;

		// In case user was already in memory, we update its data
		// Note: small risk that DB changed something (e.g. truncate)
		// and the assignment here is not consistent, but we'll live with it for now

		Object.assign(user, update);

		return user;
	}

	async getAssignableUsers() {
		const results = await dbPool.query(`
			SELECT id, login, display_name
			FROM users
			WHERE id > 32
		`);

		return results.rows;
	}
}

export default new UserDAO();
