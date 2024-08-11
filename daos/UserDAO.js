import User from '../domains/User.js';
import dbPool from '../modules/db.js';
import ULID from 'ulid';

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

		// TODO: wrap all the queries here in a transaction

		const identity = await dbPool.query(
			`INSERT INTO user_identities
			(provider, provider_user_id, login, email)
			VALUES
			($1, $2, $3, $4)
			ON CONFLICT(provider, provider_user_id)
			DO UPDATE SET last_login_at=NOW()
			RETURNING user_id
			`,
			[
				options.provider,
				user_data.id,
				user_data.login || null,
				(user_data.email || '').toLowerCase() || null,
			]
		);

		let user_id = identity.rows?.[0]?.user_id;

		do {
			if (user_id) {
				// we already have a user mapping
				// so we take the opportunity to update it with the lastest values - should we though? what if the data had been updated from another provider, or manually by the user?
				if (options.provider === 'twitch') {
					await dbPool.query(
						`UPDATE users
						SET type=$1, description=$2, display_name=$3, profile_image_url=$4, last_login_at=NOW();
						`,
						[
							user_data.type,
							user_data.description,
							user_data.display_name,
							user_data.profile_image_url,
						]
					);
				} else if (options.provider === 'google') {
					await dbPool.query(
						`UPDATE users
						SET profile_image_url=$1, last_login_at=NOW();
						`,
						[user_data.profile_image_url]
					);
				}
			} else {
				// no existing user mapped, which means we just created a new identity
				// let's see if we can find a user that has the email that came in
				if (user_data.email) {
					console.log('trying to find user', {
						email: user_data.email.toLowerCase(),
					});

					const res = await dbPool.query(
						`SELECT user_id
						FROM user_emails
						WHERE email=$1
						`,
						[user_data.email.toLowerCase()]
					);

					console.log(res.rows);

					if (res.rows.length === 1) {
						console.log(`Found one matching user`);
						// verify that user is not already linked to an identity from the same provider.
						// If he/she was, then it's a case of different accounts from one provider using the same email
						// and we should not link the 2 identities to the same user.

						const temp_user_id = res.rows[0].user_id;

						const res2 = await dbPool.query(
							`SELECT count(*)
							FROM user_identities
							WHERE user_id = $1 AND provider = $2
							`,
							[temp_user_id, options.provider]
						);

						if (parseInt(res2.rows[0]?.count, 10) <= 0) {
							user_id = temp_user_id;

							// bingo, only one user has this email address, we link the identity to that user
							// still... is it safe/desirable to do even so in this case?? What if the user does not want to auto link the same email from different provider? 🤔
							await dbPool.query(
								`UPDATE user_identities
								SET user_id=$1 
								WHERE provider=$2 AND provider_user_id=$3
								`,
								[user_id, options.provider, user_data.id]
							);

							// TODO: verify one row was modified as expected
							// TODO: should we update the user record with latest login info? 🤔

							break; // everything is done! Identity, User, Email are all set
						}
					}
				}

				console.log('creating user');
				// user is not already mapped, we must create a new user now, and link it to the identity
				if (options.provider === 'twitch') {
					const res = await dbPool.query(
						`INSERT INTO users
						(login, secret, type, description, display_name, profile_image_url)
						VALUES
						($1, $2, $3, $4, $5, $6)
						ON CONFLICT(login) DO NOTHING
						RETURNING id
						`,
						[
							user_data.login,
							user_data.secret,
							user_data.type,
							user_data.description,
							user_data.display_name,
							user_data.profile_image_url,
						]
					);

					user_id = res.rows?.[0]?.id;

					if (!user_id) {
						const res = await dbPool.query(
							`INSERT INTO users
							(login, secret, type, description, display_name, profile_image_url)
							VALUES
							($1, $2, $3, $4, $5, $6)
							ON CONFLICT(login) DO NOTHING
							RETURNING id
							`,
							[
								ULID.ulid(), // this means the user cannot share his room via his twitch login 🥲. User should go update his login later to something more easily usable
								user_data.secret,
								user_data.type,
								user_data.description,
								user_data.display_name,
								user_data.profile_image_url,
							]
						);

						user_id = res.rows?.[0]?.id;

						if (!user_id) {
							throw new Error(
								`Error: Unable to create twitch user ${user_data.login}`
							);
						}
					}
				} else if (options.provider === 'google') {
					const res = await dbPool.query(
						`INSERT INTO users
						(login, secret, type, description, display_name, profile_image_url)
						VALUES
						($1, $2, $3, $4, $5, $6)
						ON CONFLICT(login) DO NOTHING
						RETURNING id
						`,
						[
							user_data.login,
							user_data.secret,
							user_data.type,
							user_data.description,
							user_data.display_name,
							user_data.profile_image_url,
						]
					);

					user_id = res.rows?.[0]?.id;
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

			// if email is supplied, we save it now too
			if (user_data.email) {
				await dbPool.query(
					`INSERT INTO user_emails
					(user_id, email)
					VALUES
					($1, $2)
					ON CONFLICT DO NOTHING
					`,
					[user_id, user_data.email.toLowerCase()]
				);
			}
		} while (false);

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
