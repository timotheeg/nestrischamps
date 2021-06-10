const glob = require('glob');

const layouts = {};

['1p', 'mp'].forEach(type => {
	glob(`public/views/${type}/*.html`, (err, files) => {
		if (err) {
			console.error(err);
			// terminate server
			return;
		}

		files.forEach(filename => {
			const file = filename.split(/[\\/]/).pop().split('.')[0];

			layouts[file] = { file, type };
		});
	});
});

module.exports = layouts;
