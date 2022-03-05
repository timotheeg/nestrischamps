export default class ArrayView {
	constructor(array, start_index = 0, length = null) {
		this._source = array;
		this._start_index = start_index;

		if (length === null) {
			this.length = array.length - start_index;
		} else if (
			typeof length != 'number' ||
			length % 1 ||
			length < start_index
		) {
			throw new RangeError(
				`Invalid ArrayView definition: ${start_index} ${length}`
			);
		} else {
			this.length = length;
		}

		return (this._proxy = new Proxy({}, this));
	}

	get(target, prop) {
		const requested_index = parseInt(prop, 10);

		if (!isNaN(requested_index)) {
			if (requested_index < 0 || requested_index >= this.length) {
				return undefined;
			}

			return this._source[this._start_index + requested_index];
		}

		switch (prop) {
			case 'length':
				return this.length;

			case 'slice':
			case 'join':
			case 'find':
			case 'filter':
			case 'reduce':
				throw new Error(`ArrayView TODO: implement ${prop}()`);

			case 'at':
			case 'every':
			case 'some':
			case 'forEach':
			case 'map':
			case 'includes':
				// lazy binding of methods
				if (!this[prop].bound) {
					this[prop] = this[prop].bind(this);
					this[prop].bound = true;
				}
				return this[prop];

			case 'reverse':
			case 'push':
			case 'pop':
			case 'shift':
			case 'unshift':
			case 'fill':
			case 'unshift':
				throw new Error(
					`Forbidden (${prop}): ArrayView instances are immutable`
				);
		}

		throw new Error(`Error (${prop}): Not understood`);
	}

	set(target, prop) {
		throw new Error('Forbidden: ArrayView instances are immutable');
	}

	at(idx) {
		return this._source[this._start_index + idx];
	}

	forEach(cb) {
		for (let idx = 0; idx < this.length; idx++) {
			cb(this.at(idx), idx, this._proxy);
		}
	}

	map(cb) {
		const res = Array(this.length);

		for (let idx = 0; idx < this.length; idx++) {
			res[idx] = cb(this.at(idx), idx, this._proxy);
		}

		return res;
	}

	every(cb) {
		for (let idx = 0; idx < this.length; idx++) {
			if (!cb(this.at(idx), idx, this._proxy)) return false;
		}

		return true;
	}

	some(cb) {
		for (let idx = 0; idx < this.length; idx++) {
			if (cb(this.at(idx), idx, this._proxy)) return true;
		}

		return false;
	}

	includes(item, from_index = 0) {
		for (let idx = from_index; idx < this.length; idx++) {
			if (this.at(idx) === item) return true;
		}

		return false;
	}
}
