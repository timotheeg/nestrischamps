const TetrisOCR = (function() {

const PATTERN_MAX_INDEXES = {
	B: 3,  // null, 0, 1 (Binary)
	T: 4,  // null, 0, 1, 2 (Ternary)
	Q: 5,  // null, 0, 1, 2, 3 (Quaternary)
	D: 11, // null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 (Digits)
	A: 16, // null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, A, B, C, D, E, F (Alphanums)
};

const PERF_METHODS = [
	'getSourceImageData',
	'scanScore',
	'scanLevel',
	'scanLines',
	'scanColor1',
	'scanColor2',
	'scanPreview',
	'scanField',
	'scanPieceStats',

	'scanInstantDas',
	'scanCurPieceDas',
	'scanCurPiece',
];

function getDigitsWidth(n) {
	// width per digit is 8px times 2
	// and for last digit, we ignore the 1px (times 2)
	// border on the right, hence -2
	return 16 * n - 2;
}

// Resize areas based on logical NES pixels (2x for digits)
const TASK_RESIZE = {
	score:         [getDigitsWidth(6), 14],
	level:         [getDigitsWidth(2), 14],
	lines:         [getDigitsWidth(3), 14],
	field:         [79, 159],
	preview:       [31, 15],
	cur_piece:     [23, 12],
	instant_das:   [getDigitsWidth(2), 14],
	cur_piece_das: [getDigitsWidth(2), 14],
	color1:        [5, 5],
	color2:        [5, 5],
	stats:         [getDigitsWidth(3), 14 * 7 + 14 * 7], // height captures all the individual stats...
	piece_count:   [getDigitsWidth(3), 14],
};


class TetrisOCR extends EventTarget {
	static TASK_RESIZE = TASK_RESIZE;

	constructor(templates, palettes, config) {
		super();

		this.templates = templates;
		this.palettes = palettes;
		this.setConfig(config);

		this.digit_img = new ImageData(14, 14); // 2x for better matching
		this.block_img = new ImageData(7, 7);
		this.small_block_img = new ImageData(5, 5);

		// decorate relevant methods to capture timings
		PERF_METHODS
			.forEach(name => {
				const method = this[name].bind(this);
				this[name] = timingDecorator(name, method);
			});
	}

	/*
	 * processConfig()
	 * 1. Calculate the overal crop area based on the individual task crop areas
	 * 2. Instantiate ImageData objects for each cropped and resize job, so they can:
	 *    a. be reused without memory allocation
	 *    b. be shared via the config reference with client app (say for display of the areas)
	 *
	 */
	setConfig(config) {
		this.config = config;
		this.palette = this.palettes && this.palettes[config.palette]; // will reset to undefined when needed

		const bounds = {
			top:    0xFFFFFFFF,
			left:   0xFFFFFFFF,
			bottom: -1,
			right:  -1,
		};

		// This create a lot of imageData objects of similar sizes
		// Somecould be shared because they are the same dimensions (e.g. 3 digits for lines, and piece stats)
		// but if we share them, we wouldnotbe able to display them individually in the debug UI
		for (const [name, task] of Object.entries(this.config.tasks)) {
			if (this.palette && name.startsWith('color')) continue;

			const { crop: [x, y, w, h] } = task;

			bounds.top    = Math.min(bounds.top,    y);
			bounds.left   = Math.min(bounds.left,   x);
			bounds.bottom = Math.max(bounds.bottom, y + h);
			bounds.right  = Math.max(bounds.right,  x + w);

			let resize_tuple;

			if (name.length === 1) {
				resize_tuple = TASK_RESIZE.piece_count;
			}
			else {
				resize_tuple = TASK_RESIZE[name];
			}

			task.crop_img = new ImageData(w, h);
			task.scale_img = new ImageData(...resize_tuple);
		}

		this.config.capture_bounds = bounds;
		this.config.capture_area = {
			x: bounds.left,
			y: bounds.top,
			w: bounds.right - bounds.left,
			h: bounds.bottom - bounds.top,
		};
	}

	getDigit(pixel_data, max_check_index, is_red) {
		const sums = new Float64Array(max_check_index);
		const size = pixel_data.length >>> 2;
		const red_scale = 255/155; // scale red values as if capped at 155

		for (let p_idx = size; p_idx--; ) {
			const offset_idx = p_idx << 2;
			const pixel_luma = is_red
				? Math.min(pixel_data[offset_idx] * red_scale, 255) // only consider red component for luma, with scaling and capped
				: luma(
					pixel_data[offset_idx],
					pixel_data[offset_idx + 1],
					pixel_data[offset_idx + 2],
				);

			for (let t_idx=max_check_index; t_idx--; ) {
				const diff = pixel_luma - this.templates[t_idx][p_idx];
				sums[t_idx] += diff * diff;
			}
		}

		let min_val = 0xFFFFFFFF;
		let min_idx = -1;

		for (let s_idx=sums.length; s_idx--; ) {
			if (sums[s_idx] < min_val) {
				min_val = sums[s_idx];
				min_idx = s_idx;
			}
		}

		return min_idx;
	}

	initCaptureContext(frame) {
		this.capture_canvas = document.createElement('canvas');

		this.capture_canvas.width = frame.width;
		this.capture_canvas.height = frame.height;

		this.capture_canvas_ctx = this.capture_canvas.getContext('2d', { alpha: false });
		this.capture_canvas_ctx.imageSmoothingEnabled = 'false';

		// On top of the capture context, we need one more canvas for the scaled field
		// because the performance of OffScreenCanvas are horrible, and same gvoes for the bicubic lib for any image that's not super small :(


		// TODO: get rid of this additional canvas when we can T_T
		this.scaled_field_canvas = document.createElement('canvas');

		this.scaled_field_canvas.width = TASK_RESIZE.field[0];
		this.scaled_field_canvas.height = TASK_RESIZE.field[1];

		this.scaled_field_canvas_ctx = this.scaled_field_canvas.getContext('2d', { alpha: false });
		this.scaled_field_canvas_ctx.imageSmoothingEnabled = 'false';
	}

	async processFrame(frame) {
		if (!this.capture_canvas_ctx) {
			this.initCaptureContext(frame);
		}

		const res = {};

		performance.mark('start');
		this.capture_canvas_ctx.drawImage(frame, 0, 0, frame.width, frame.height);
		performance.mark('draw_end');
		performance.measure('draw_frame', 'start', 'draw_end');

		const source_img = this.getSourceImageData();

		res.score = this.scanScore(source_img);
		res.level = this.scanLevel(source_img);
		res.lines = this.scanLines(source_img);

		let colors;

		// color are either supplied from palette or read, there's no other choice
		if (this.palette) {
			// WARNING: level *may* be read incorrectly on transition frames
			// Also: we haven't gone through the sanitization and correction pipeline here :(
			let level;

			if (res.level) {
				level = res.level[0] * 10 + res.level[1];
			}
			else {
				level = 0;
			}

			colors = this.palette[level % 10];
		}
		else {
			// assume tasks color1 and color2 are set
			res.color1 = this.scanColor1(source_img);
			res.color2 = this.scanColor2(source_img);
			colors = [res.color1, res.color2];
		}

		res.field = await this.scanField(source_img, colors);
		res.preview = this.scanPreview(source_img);

		if (this.config.tasks.instant_das) { // assumes all 3 das tasks are a unit
			res.instant_das = this.scanInstantDas(source_img);
			res.cur_piece_das = this.scanCurPieceDas(source_img);
			res.cur_piece = this.scanCurPiece(source_img);
		}

		if (this.config.tasks.T) {
			Object.assign(res, this.scanPieceStats(source_img));
		}


		this.onMessage(res);
	}

	scanScore(source_img) {
		return this.ocrDigits(source_img, this.config.tasks.score);
	}

	scanLevel(source_img) {
		return this.ocrDigits(source_img, this.config.tasks.level);
	}

	scanLines(source_img) {
		return this.ocrDigits(source_img, this.config.tasks.lines);
	}

	scanColor1(source_img) {
		return this.scanColor(source_img, this.config.tasks.color1);
	}

	scanColor2(source_img) {
		return this.scanColor(source_img, this.config.tasks.color2);
	}

	scanInstantDas(source_img) {
		return this.ocrDigits(source_img, this.config.tasks.instant_das);
	}

	scanCurPieceDas(source_img) {
		return this.ocrDigits(source_img, this.config.tasks.cur_piece_das);
	}

	scanPieceStats(source_img) {
		return {
			T: this.ocrDigits(source_img, this.config.tasks.T),
			J: this.ocrDigits(source_img, this.config.tasks.J),
			Z: this.ocrDigits(source_img, this.config.tasks.Z),
			O: this.ocrDigits(source_img, this.config.tasks.O),
			S: this.ocrDigits(source_img, this.config.tasks.S),
			L: this.ocrDigits(source_img, this.config.tasks.L),
			I: this.ocrDigits(source_img, this.config.tasks.I),
		};
	}

	getSourceImageData() {
		const pixels = this.capture_canvas_ctx.getImageData(
			this.config.capture_area.x, this.config.capture_area.y,
			this.config.capture_area.w, this.config.capture_area.h
		);

		/*
		const pixels_per_rows = this.config.capture_area.w * 4;
		const max_rows = this.config.capture_bounds.bottom;

		for (let row_idx = 1; row_idx < max_rows; row_idx++) {
			pixels.data.copyWithin(
				pixels_per_rows * row_idx,
				pixels_per_rows * row_idx * 2,
				pixels_per_rows * (row_idx * 2 + 1)
			);
		}
		/**/

		this.config.source_img = pixels;

		return pixels;
	}

	getCropCoordinates(task) {
		const [raw_x, raw_y, w, h] = task.crop;

		return [
			raw_x - this.config.capture_area.x,
			raw_y - this.config.capture_area.y,
			w,
			h,
		];
	}

	ocrDigits(source_img, task) {
		const [x, y, w, h] = this.getCropCoordinates(task);
		const digits = Array(task.pattern.length);

		crop(source_img, x, y, w, h, task.crop_img);
		bicubic(task.crop_img, task.scale_img);

		for (let idx=digits.length; idx--; ) {
			const char = task.pattern[idx];

			crop(task.scale_img, idx * 16, 0, 14, 14, this.digit_img);

			const digit = this.getDigit(this.digit_img.data, PATTERN_MAX_INDEXES[char], task.red);

			if (!digit) return null;

			digits[idx] = digit - 1;
		}

		return digits;
	}

	/*
	 * Returns true if 70% of the pixels in the supplied image are not black.
	 */
	static isBlock(img, block_presence_threshold=0.7) {
		const pixel_count = img.width * img.height;
		const black_luma_limit = 15.0;
		const img_data = img.data;

		let sum = 0;

		for (let idx=pixel_count; idx--; ) {
			const offset_idx = idx << 2;
			sum += luma(
				img_data[offset_idx],
				img_data[offset_idx + 1],
				img_data[offset_idx + 2],
			) <  black_luma_limit ? 0 : 1;
		};

		return sum >= (pixel_count * block_presence_threshold);
	}

	scanPreview(source_img) {
		const task = this.config.tasks.preview;
		const [x, y, w, h] = this.getCropCoordinates(task);

		crop(source_img, x, y, w, h, task.crop_img);
		bicubic(task.crop_img, task.scale_img);

		// Trying side i blocks
		if (TetrisOCR.isBlock(crop(task.scale_img, 0, 3, 4, 7), 0.5)
			&& TetrisOCR.isBlock(crop(task.scale_img, 27, 3, 4, 7), 0.5)
		) {
			return 'I';
		}

		// now trying the 3x2 matrix for T, L, J, S, Z
		const top_row = [
			TetrisOCR.isBlock(crop(task.scale_img, 4, 0, 7, 7, this.block_img)),
			TetrisOCR.isBlock(crop(task.scale_img, 12, 0, 7, 7, this.block_img)),
			TetrisOCR.isBlock(crop(task.scale_img, 20, 0, 7, 7, this.block_img))
		];

		if (top_row[0] && top_row[1] && top_row[2]) { // J, T, L
			if (TetrisOCR.isBlock(crop(task.scale_img, 4, 8, 7, 7, this.block_img))) {
				return 'L';
			}
			if (TetrisOCR.isBlock(crop(task.scale_img, 12, 8, 7, 7, this.block_img))) {
				return 'T';
			}
			if (TetrisOCR.isBlock(crop(task.scale_img, 20, 8, 7, 7, this.block_img))) {
				return 'J';
			}

			return null;
		}

		if (top_row[1] && top_row[2]) {
			if (TetrisOCR.isBlock(crop(task.scale_img, 4, 8, 7, 7, this.block_img))
				&& TetrisOCR.isBlock(crop(task.scale_img, 12, 8, 7, 7, this.block_img))
			) {
				return 'S';
			}
		}

		if (top_row[0] && top_row[1]) {
			if (TetrisOCR.isBlock(crop(task.scale_img, 12, 8, 7, 7, this.block_img))
				&& TetrisOCR.isBlock(crop(task.scale_img, 20, 8, 7, 7, this.block_img))
			) {
				return 'Z';
			}
		}

		// lastly check for O
		if (
			TetrisOCR.isBlock(crop(task.scale_img, 8, 0, 7, 7, this.block_img))
			&& TetrisOCR.isBlock(crop(task.scale_img, 16, 0, 7, 7, this.block_img))
			&& TetrisOCR.isBlock(crop(task.scale_img, 8, 8, 7, 7, this.block_img))
			&& TetrisOCR.isBlock(crop(task.scale_img, 16, 8, 7, 7, this.block_img))
		) {
			return 'O';
		}

		return null;
	}

	scanCurPiece(source_img) {
		const task = this.config.tasks.cur_piece;
		const [x, y, w, h] = this.getCropCoordinates(task);

		// curPieces are not vertically aligned on the op row
		// L and J are rendered 1 pixel higher
		// than S, Z, T, O

		crop(source_img, x, y, w, h, task.crop_img);
		bicubic(task.crop_img, task.scale_img);

		// Trying side i blocks
		if (TetrisOCR.isBlock(crop(task.scale_img, 0, 4, 2, 5), 0.5)
			&& TetrisOCR.isBlock(crop(task.scale_img, 20, 4, 3, 5), 0.5)
		) {
			return 'I';
		}

		// now trying for L, J (top pixel alignment)
		let top_row = [
			TetrisOCR.isBlock(crop(task.scale_img, 2, 0, 5, 5, this.small_block_img)),
			TetrisOCR.isBlock(crop(task.scale_img, 8, 0, 5, 5, this.small_block_img)),
			TetrisOCR.isBlock(crop(task.scale_img, 14, 0, 5, 5, this.small_block_img))
		];

		if (top_row[0] && top_row[1] && top_row[2]) {
			if (TetrisOCR.isBlock(crop(task.scale_img, 2, 6, 5, 5, this.small_block_img))) {
				return 'L';
			}
			if (TetrisOCR.isBlock(crop(task.scale_img, 14, 6, 5, 5, this.small_block_img))) {
				return 'J';
			}
		}

		// checking S, Z, T
		top_row = [
			TetrisOCR.isBlock(crop(task.scale_img, 2, 1, 5, 5, this.small_block_img)),
			TetrisOCR.isBlock(crop(task.scale_img, 8, 1, 5, 5, this.small_block_img)),
			TetrisOCR.isBlock(crop(task.scale_img, 14, 1, 5, 5, this.small_block_img))
		];

		if (top_row[0] && top_row[1] && top_row[2]) {
			if (TetrisOCR.isBlock(crop(task.scale_img, 8, 7, 5, 5, this.small_block_img))) {
				return 'T';
			}

			return null;
		}

		if (top_row[1] && top_row[2]) {
			if (TetrisOCR.isBlock(crop(task.scale_img, 2, 7, 5, 5, this.small_block_img))
				&& TetrisOCR.isBlock(crop(task.scale_img, 8, 7, 5, 5, this.small_block_img))
			) {
				return 'S';
			}
		}

		if (top_row[0] && top_row[1]) {
			if (TetrisOCR.isBlock(crop(task.scale_img, 8, 7, 5, 5, this.small_block_img))
				&& TetrisOCR.isBlock(crop(task.scale_img, 14, 7, 5, 5, this.small_block_img))
			) {
				return 'Z';
			}
		}

		// lastly check for O
		if (
			TetrisOCR.isBlock(crop(task.scale_img, 5, 1, 5, 5, this.small_block_img))
			&& TetrisOCR.isBlock(crop(task.scale_img, 11, 1, 5, 5, this.small_block_img))
			&& TetrisOCR.isBlock(crop(task.scale_img, 5, 7, 5, 5, this.small_block_img))
			&& TetrisOCR.isBlock(crop(task.scale_img, 11, 7, 5, 5, this.small_block_img))
		) {
			return 'O';
		}

		return null;
	}

	scanColor(source_img, task) {
		const [x, y, w, h] = this.getCropCoordinates(task);

		crop(source_img, x, y, w, h, task.crop_img);
		bicubic(task.crop_img, task.scale_img);

		const pix_refs = [
			[3, 2],
			[3, 3],
			[2, 3]
		];

		return pix_refs
			.map(([x, y]) => {
				const col_idx = y * 5 * 4 + x * 4;
				return task.scale_img.data.subarray(col_idx, col_idx + 3);
			})
			.reduce((acc, col) => {
				acc[0] += col[0];
				acc[1] += col[1];
				acc[2] += col[2];
				return acc;
			}, [0, 0, 0])
			.map(v => Math.round(v / pix_refs.length));
	}

	async scanField(source_img, _colors) {
		const task = this.config.tasks.field;
		const [x, y, w, h] = this.getCropCoordinates(task);
		const colors = [
			[0, 0, 0],
			[0xFF, 0xFF, 0xFF],
			..._colors
		];

		// crop is not needed, but done anyway to share task captured area with caller app
		crop(source_img, x, y, w, h, task.crop_img);

		/*
		bicubic(task.crop_img, task.scale_img);
		const field_img = task.scale_img;
		/**/

		/**/
		// crop and scale with canva
		const resized = await createImageBitmap(
			source_img,
			x, y, w, h,
			{
				resizeWidth: TASK_RESIZE.field[0],
				resizeHeight: TASK_RESIZE.field[1],
				resizeQuality: 'medium'
			}
		);

		this.scaled_field_canvas_ctx.drawImage(resized, 0, 0);
		const field_img = this.scaled_field_canvas_ctx.getImageData(0, 0, ...TASK_RESIZE.field);

		// writing into scale_img is not needed, but done anyway to share area with caller app
		task.scale_img.data.set(field_img.data);
		/**/

		// Make a memory efficient array for our needs
		const field = new Uint8Array(200);

		// we read 4 judiciously positionned logical pixels per block
		const pix_refs = [
			[2, 4],
			[3, 3],
			[4, 4],
			[4, 2]
		];

		/*
		for (let ridx = 0; ridx < 20; ridx++) {
			for (let cidx = 0; cidx < 10; cidx++) {
				const blockX = cidx * 8;
				const blockY = ridx * 8;
				const destCoords = pix_refs.map(([dx, dy]) => [blockX + dx, blockY + dy]);

				const channels = getBicubicPixels(task.crop_img, TASK_RESIZE.field, destCoords)
					.reduce((acc, col) => {
						acc[0] += col[0];
						acc[1] += col[1];
						acc[2] += col[2];
						return acc;
					}, [0, 0, 0])
					.map(v => Math.round(v / pix_refs.length));

				let min_diff = 0xFFFFFFFF;
				let min_idx = -1;

				colors.forEach((col, col_idx) => {
					const sum = col.reduce((sum, c, idx) => sum += (c - channels[idx]) * (c - channels[idx]), 0);

					if (sum < min_diff) {
						min_diff = sum;
						min_idx = col_idx;
					}
				})

				field.push(min_idx);
			}
		}
		/**/

		/**/
		const row_width = 9 * 8 + 7; // the last block in a row is one pixel less!

		for (let ridx = 0; ridx < 20; ridx++) {
			for (let cidx = 0; cidx < 10; cidx++) {
				const block_offset = ((ridx * row_width * 8) + cidx * 8) * 4;

				const channels = pix_refs
					.map(([x, y]) => {
						const col_idx = block_offset + y * row_width * 4 + x * 4;
						return field_img.data.subarray(col_idx, col_idx + 3);
					})
					.reduce((acc, col) => {
						acc[0] += col[0];
						acc[1] += col[1];
						acc[2] += col[2];
						return acc;
					}, [0, 0, 0])
					.map(v => Math.round(v / pix_refs.length));

				let min_diff = 0xFFFFFFFF;
				let min_idx = -1;

				colors.forEach((col, col_idx) => {
					const sum = col.reduce((sum, c, idx) => sum += (c - channels[idx]) * (c - channels[idx]), 0);

					if (sum < min_diff) {
						min_diff = sum;
						min_idx = col_idx;
					}
				})

				field[ridx * 10 + cidx] = min_idx;
			}
		}
		/**/

		return field;
	}
}

return TetrisOCR;

})();
