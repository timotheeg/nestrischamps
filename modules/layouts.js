const fs = require('fs');
const glob = require('glob');

const layouts = {
	_types: {
		'1p': [],
		'mp': [],
	},
};

function byFilename(a, b) {
	return a.file > b.file ? 1 : -1;
}

const start = Date.now();

['1p', 'mp'].forEach(type => {
	glob.sync(`public/views/${type}/*.html`).forEach(filename => {
		const screenshot = filename.replace(/\.html$/, '.jpg');
		const file = filename.split(/[\\/]/).pop().split('.')[0];
		const layout_data = {
			file,
			type,
			has_screenshot: fs.existsSync(screenshot),
		};

		layouts[file] = layout_data;
		layouts._types[type].push(layout_data);
	});
});

layouts._types['1p'].sort(byFilename);
layouts._types['mp'].sort(byFilename);

const elapsed = Date.now() - start;

console.log(`Populated layouts data from filesystem in ${elapsed} ms.`);

module.exports = layouts;
