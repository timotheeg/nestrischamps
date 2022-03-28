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
		let requested_index = NaN;

		try {
			requested_index = parseInt(prop, 10);
		} catch (err) {}

		if (!isNaN(requested_index)) {
			return this.at(requested_index);
		}

		switch (prop) {
			case 'length':
				return this.length;

			case 'reduce':
				throw new Error(`ArrayView TODO: implement ${prop}()`);

			case 'at':
			case 'find':
			case 'filter':
			case 'every':
			case 'some':
			case 'forEach':
			case 'map':
			case 'includes':
			case 'slice':
			case 'join':
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

		throw new Error(`Error: Property not understood`, prop);
	}

	set(target, prop) {
		throw new Error('Forbidden: ArrayView instances are immutable');
	}

	at(idx) {
		if (idx < 0 || idx >= this.length) {
			return undefined;
		}

		return this._source[this._start_index + idx];
	}

	forEach(cb, thisArg = null) {
		for (let idx = 0; idx < this.length; idx++) {
			if (thisArg) {
				cb.call(thisArg, this.at(idx), idx, this._proxy);
			} else {
				cb(this.at(idx), idx, this._proxy);
			}
		}
	}

	map(cb, thisArg = null) {
		const res = Array(this.length);

		for (let idx = 0; idx < this.length; idx++) {
			if (thisArg) {
				res[idx] = cb.call(thisArg, this.at(idx), idx, this._proxy);
			} else {
				res[idx] = cb(this.at(idx), idx, this._proxy);
			}
		}

		return res;
	}

	every(cb, thisArg = null) {
		for (let idx = 0; idx < this.length; idx++) {
			if (thisArg) {
				if (cb.call(thisArg, this.at(idx), idx, this._proxy)) return false;
			} else {
				if (cb(this.at(idx), idx, this._proxy)) return false;
			}
		}

		return true;
	}

	some(cb, thisArg = null) {
		for (let idx = 0; idx < this.length; idx++) {
			if (thisArg) {
				if (cb.call(thisArg, this.at(idx), idx, this._proxy)) return true;
			} else {
				if (cb(this.at(idx), idx, this._proxy)) return true;
			}
		}

		return false;
	}

	includes(item, from_index = 0) {
		for (let idx = from_index; idx < this.length; idx++) {
			if (this.at(idx) === item) return true;
		}

		return false;
	}

	find(cb, thisArg = null) {
		for (let idx = from_index; idx < this.length; idx++) {
			if (thisArg) {
				if (cb.call(thisArg, this.at(idx), idx, this._proxy))
					return this.at(idx);
			} else {
				if (cb(this.at(idx), idx, this._proxy)) return this.at(idx);
			}
		}
	}

	filter(cb, thisArg = null) {
		const res = [];

		for (let idx = from_index; idx < this.length; idx++) {
			if (thisArg) {
				if (cb.call(thisArg, this.at(idx), idx, this._proxy))
					res.push(this.at(idx));
			} else {
				if (cb(this.at(idx), idx, this._proxy)) res.push(this.at(idx));
			}
		}

		return res;
	}

	slice(start, end) {
		// normalizes indexes before calling the native slice
		if (end === undefined || end > this.length) {
			end = this.length;
		} else if (end < 0) {
			end = this.length + end;
			if (end <= 0) return [];
		}

		if (start < 0) {
			start = this.length + start;
			if (start < 0) start = 0;
		}

		if (start >= end) return [];

		return this._source.slice(
			this._start_index + start,
			this._start_index + end
		);
	}

	join(separator) {
		return this.slice(0, this.length).join(separator);
	}

	toString() {
		return this.join(',');
	}

	[Symbol.toPrimitive]() {
		return this.toString();
	}
}
