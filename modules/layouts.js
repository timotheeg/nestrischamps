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

// Layout directory is local checkout so it's controlled by us
// we assume the files therein are correct with these 2 rules:
// 1) every jpg MUST have a html layout for it
// 2) html layouts may not have any jpg
//
// NOTE: If we have trust issue on the directory, after collecting files via glob,
// the structures should be inspected for cleanliness

['1p', 'mp'].forEach(type => {
	glob.sync(`public/views/${type}/*.*`).forEach(filename => {
		const file = filename.split(/[\\/]/).pop().split('.')[0];

		let layout_data = layouts[file];

		if (!layout_data) {
			layout_data = {
				file,
				type,
				info: null,
				screenshot_uris: [],
			};

			layouts[file] = layout_data;
			layouts._types[type].push(layout_data);
		}

		if (/\.jpg$/.test(filename)) {
			layout_data.screenshot_uris.push(filename.replace(/^public\//, ''));
		} else if (/\.json$/.test(filename)) {
			try {
				layout_data.info = JSON.parse(fs.readFileSync(filename));
				console.log(type, layout_data.info);
			} catch (err) {
				// ignore
			}
		}
	});

	layouts._types[type].forEach(data => data.screenshot_uris.sort());
	layouts._types[type].sort(byFilename);
});

const elapsed = Date.now() - start;

console.log(`Populated layouts data from filesystem in ${elapsed} ms.`);

module.exports = layouts;
