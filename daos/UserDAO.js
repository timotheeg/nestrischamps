const User = require('../domains/User');
const dbPool = require('../modules/db');

class UserDAO {
	users_by_id = new Map();
	users_by_login = new Map();
	users_by_secret = new Map();

	constructor() {}

	addUser(user) {
		this.users_by_id    .set(user.id,     user);
		this.users_by_login .set(user.login,  user);
		this.users_by_secret.set(user.secret, user);
	}

	removeUser(user) {
		this.users_by_id    .delete(user.id);
		this.users_by_login .delete(user.login);
		this.users_by_secret.delete(user.secret);
	}

	async createUser(user_data) {
		const db_client = await dbPool.connect();
		const insert_result = await db_client.query(
			`INSERT INTO twitch_users
			(id, login, email, secret, type, description, display_name, profile_image_url, created_on, last_login)
			VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
			ON CONFLICT(id)
			DO UPDATE SET login=$2, email=$3, type=$5, description=$6, display_name=$7, profile_image_url=$8, last_login=NOW();
			`,
			[
				user_data.id,
				user_data.login,
				user_data.email,
				user_data.secret,
				user_data.type,
				user_data.description,
				user_data.display_name,
				user_data.profile_image_url,
			]
		);

		// we force fetch to:
		// 1) get the correct data shape
		// 2) ensure we get the latest secret
		return await this.getUserById(user_data.id);
	}

	async deleteUser(user) {
		this.removeUser(user);

		const db_client = await dbPool.connect();
		const insert_result = await db_client.query(
			'DELETE FROM twitch_users WHERE id=$1;',
			[ user.id ]
		);
	}

	async updateSecret(user, new_secret) {
		// WARNING: potential race condition in this method
		// WARNING: deal with it later
		const old_secret = user.secret;

		// update local memory store
		this.users_by_secret.delete(user.secret);
		user.secret = new_secret;
		this.users_by_secret.set(user.secret, user);

		// then update DB ... dubious order ...
		const db_client = await dbPool.connect();
		const insert_result = await db_client.query(
			`UPDATE twitch_users
			set secret=$1
			WHERE id=$2
			`,
			[ user.secret, user.id ]
		);

		return user;
	}

	async getUserById(id, force_fetch = false) {
		let user = this.users_by_id.get(id);

		if (!user || force_fetch) {
			const db_client = await dbPool.connect();
			const result = await db_client.query(
				'SELECT * FROM twitch_users WHERE id=$1',
				[ id ]
			);
			user = new User(result.rows[0]);

			this.addUser(user);
		}

		return user;
	}

	async getUserByLogin(login) {
		let user = this.users_by_login.get(login);

		if (!user) {
			const db_client = await dbPool.connect();
			const result = await db_client.query(
				'SELECT * FROM twitch_users WHERE login=$1',
				[ login ]
			);
			user = new User(result.rows[0]);

			this.addUser(user);
		}

		return user;
	}

	async getUserBySecret(secret) {
		let user = this.users_by_secret.get(secret);

		if (!user) {
			const db_client = await dbPool.connect();
			const result = await db_client.query(
				'SELECT * FROM twitch_users WHERE secret=$1',
				[ secret ]
			);
			user = new User(result.rows[0]);

			this.addUser(user);
		}

		return user;
	}
}

module.exports = new UserDAO();

