// minimalistic Query String parsing

const QueryString = (function () {

	const store = {};

	location.search.slice(1)
		.split('&')
		.forEach(token => {
			const eq_pos = token.indexOf('=');

			let key, value;

			if (eq_pos <= -1) {
				key = decodeURIComponent(token);
				value = true;
			}
			else {
				key = decodeURIComponent(token.slice(0, eq_pos));
				value = decodeURIComponent(token.slice(eq_pos + 1));
			}

			store[key] = value;
		});

	return store;

})();