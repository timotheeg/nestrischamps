is_touch_detected = false;
touch_button_elements = [];
dpad_elements = [];
active_touches = {};

stickiness_radius = 5; // pixels, ish

dpad_inner_deadzone_percent = 0.25;
dpad_extra_radius_percent = 0.1;
dpad_sticky_degrees = 5;
dpad_cardinal_priority_degrees = 10;

function register_touch_button(querystring) {
	var button_element = document.querySelector(querystring);
	if (button_element) {
		touch_button_elements.push(button_element);
	} else {
		console.log('Could not find element ', querystring);
	}
}

function register_d_pad(querystring) {
	var dpad_element = document.querySelector(querystring);
	if (dpad_element) {
		dpad_elements.push(dpad_element);
	} else {
		console.log('Could not find element ', querystring);
	}
}

// Relative to the viewport
function element_centerpoint(element) {
	let rect = element.getBoundingClientRect();
	let cx = rect.left + rect.width / 2;
	let cy = rect.top + rect.height / 2;
	return [cx, cy];
}

function element_radius(element) {
	let rect = element.getBoundingClientRect();
	let longest_side = Math.max(rect.width, rect.height);
	return longest_side / 2;
}

function angle_to_element(touch, element) {
	let [cx, cy] = element_centerpoint(element);
	let tx = touch.clientX;
	let ty = touch.clientY;
	let dx = tx - cx;
	let dy = ty - cy;
	let angle_radians = Math.atan2(dy * -1, dx);
	let angle_degrees = (angle_radians * 180) / Math.PI;
	if (angle_degrees < 0) {
		angle_degrees += 360.0;
	}
	return angle_degrees;
}

function is_inside_button(touch, element) {
	let [cx, cy] = element_centerpoint(element);
	let radius = element_radius(element);
	let tx = touch.clientX;
	let ty = touch.clientY;
	let dx = tx - cx;
	let dy = ty - cy;
	let distance_squared = dx * dx + dy * dy;
	let radius_squared = radius * radius;
	return distance_squared < radius_squared;
}

function is_stuck_to_button(touch, element) {
	// Very similar to is_inside_element, but with the stickiness radius applied
	let [cx, cy] = element_centerpoint(element);
	let radius = element_radius(element) + stickiness_radius;
	let tx = touch.clientX;
	let ty = touch.clientY;
	let dx = tx - cx;
	let dy = ty - cy;
	let distance_squared = dx * dx + dy * dy;
	let radius_squared = radius * radius;
	return distance_squared < radius_squared;
}

function is_inside_dpad(touch, element) {
	let [cx, cy] = element_centerpoint(element);
	let base_radius = element_radius(element) + stickiness_radius;
	let outer_radius = base_radius + base_radius * dpad_extra_radius_percent;
	let deadzone_radius = base_radius * dpad_inner_deadzone_percent;
	let tx = touch.clientX;
	let ty = touch.clientY;
	let dx = tx - cx;
	let dy = ty - cy;
	let distance_squared = dx * dx + dy * dy;
	let outer_radius_squared = outer_radius * outer_radius;
	let deadzone_radius_squared = deadzone_radius * deadzone_radius;
	return (
		distance_squared > deadzone_radius_squared &&
		distance_squared < outer_radius_squared
	);
}

function is_sticky_dpad(angle) {
	// (ordered counter-clockwise, starting with 0 degrees "east")

	// East is split along the X axis
	if (angle < 22.5 + dpad_cardinal_priority_degrees - dpad_sticky_degrees) {
		return false;
	}
	if (angle > 337.5 - dpad_cardinal_priority_degrees + dpad_sticky_degrees) {
		return false;
	}

	// North East
	if (
		angle > 22.5 + dpad_cardinal_priority_degrees + dpad_sticky_degrees &&
		angle < 67.5 - dpad_cardinal_priority_degrees - dpad_sticky_degrees
	) {
		return false;
	}

	// North
	if (
		angle > 67.5 - dpad_cardinal_priority_degrees + dpad_sticky_degrees &&
		angle < 112.5 + dpad_cardinal_priority_degrees - dpad_sticky_degrees
	) {
		return false;
	}

	// North West
	if (
		angle > 112.5 + dpad_cardinal_priority_degrees + dpad_sticky_degrees &&
		angle < 157.5 - dpad_cardinal_priority_degrees - dpad_sticky_degrees
	) {
		return false;
	}

	// West
	if (
		angle > 157.5 - dpad_cardinal_priority_degrees + dpad_sticky_degrees &&
		angle < 202.5 + dpad_cardinal_priority_degrees - dpad_sticky_degrees
	) {
		return false;
	}

	// South West
	if (
		angle > 202.5 + dpad_cardinal_priority_degrees + dpad_sticky_degrees &&
		angle < 247.5 - dpad_cardinal_priority_degrees - dpad_sticky_degrees
	) {
		return false;
	}

	// South
	if (
		angle > 247.5 - dpad_cardinal_priority_degrees + dpad_sticky_degrees &&
		angle < 292.5 + dpad_cardinal_priority_degrees - dpad_sticky_degrees
	) {
		return false;
	}

	// South East
	if (
		angle > 292.5 + dpad_cardinal_priority_degrees + dpad_sticky_degrees &&
		angle < 337.5 - dpad_cardinal_priority_degrees - dpad_sticky_degrees
	) {
		return false;
	}

	return true;
}

function dpad_directions(touch, element, old_directions) {
	let has_previous_directions = old_directions.length > 0;
	let dpad_angle = angle_to_element(touch, element);
	if (has_previous_directions && is_sticky_dpad(dpad_angle)) {
		return old_directions;
	}

	// East is split along the X axis
	if (dpad_angle < 22.5 + dpad_cardinal_priority_degrees) {
		return ['right'];
	}
	if (dpad_angle > 337.5 - dpad_cardinal_priority_degrees) {
		return ['right'];
	}

	// North East
	if (
		dpad_angle > 22.5 + dpad_cardinal_priority_degrees &&
		dpad_angle < 67.5 - dpad_cardinal_priority_degrees
	) {
		return ['up', 'right'];
	}

	// North
	if (
		dpad_angle > 67.5 - dpad_cardinal_priority_degrees &&
		dpad_angle < 112.5 + dpad_cardinal_priority_degrees
	) {
		return ['up'];
	}

	// North West
	if (
		dpad_angle > 112.5 + dpad_cardinal_priority_degrees &&
		dpad_angle < 157.5 - dpad_cardinal_priority_degrees
	) {
		return ['up', 'left'];
	}

	// West
	if (
		dpad_angle > 157.5 - dpad_cardinal_priority_degrees &&
		dpad_angle < 202.5 + dpad_cardinal_priority_degrees
	) {
		return ['left'];
	}

	// South West
	if (
		dpad_angle > 202.5 + dpad_cardinal_priority_degrees &&
		dpad_angle < 247.5 - dpad_cardinal_priority_degrees
	) {
		return ['down', 'left'];
	}

	// South
	if (
		dpad_angle > 247.5 - dpad_cardinal_priority_degrees &&
		dpad_angle < 292.5 + dpad_cardinal_priority_degrees
	) {
		return ['down'];
	}

	// South East
	if (
		dpad_angle > 292.5 + dpad_cardinal_priority_degrees &&
		dpad_angle < 337.5 - dpad_cardinal_priority_degrees
	) {
		return ['down', 'right'];
	}

	// We really *shouldn't* get here, but... in case floating point gnargles, return old directions,
	// just so we don't have glitchy dropped inputs on boundaries
	return old_directions;
}

function initialize_touch(querystring) {
	var touch_root_element = document.querySelector(querystring);
	touch_root_element.addEventListener('touchstart', handleTouchEvent);
	touch_root_element.addEventListener('touchend', handleTouchEvent);
	touch_root_element.addEventListener('touchmove', handleTouchEvent);
	touch_root_element.addEventListener('touchcancel', handleTouchEvent);
}

function handleTouches(touches, event) {
	// First, prune any touches that got released, and add (empty) touches for
	// new identifiers
	pruned_touches = {};
	for (let touch of touches) {
		if (active_touches.hasOwnProperty(touch.identifier)) {
			// If this touch is previously tracked, copy that info
			pruned_touches[touch.identifier] = active_touches[touch.identifier];
		} else {
			// Otherwise this is a new touch; initialize it accordingly
			pruned_touches[touch.identifier] = {
				button: null,
				dpad: null,
				directions: [],
			};
		}

		// For buttons, first check for and handle the sticky radius. If we're still inside this,
		// do not attempt to switch to a new button
		if (pruned_touches[touch.identifier].button != null) {
			let button_element = document.getElementById(
				pruned_touches[touch.identifier].button
			);
			if (!is_stuck_to_button(touch, button_element)) {
				pruned_touches[touch.identifier].button = null;
			}
		}

		// If we have no active button for this touch, check all buttons and see if we can't find
		// a new one. If so, activate it
		if (pruned_touches[touch.identifier].button == null) {
			for (let button_element of touch_button_elements) {
				if (is_inside_button(touch, button_element)) {
					pruned_touches[touch.identifier].button = button_element.id;
					event.preventDefault();
				}
			}
		}

		// D-pads are slightly more complicated. First, if we have an active D-Pad but we've left
		// its area, deactivate it
		if (pruned_touches[touch.identifier].dpad != null) {
			let dpad_element = document.getElementById(
				pruned_touches[touch.identifier].dpad
			);
			if (!is_inside_dpad(touch, dpad_element)) {
				pruned_touches[touch.identifier].dpad = null;
			}
		}

		// If we do *not* have an active D-pad, check to see if we are inside one and, if so,
		// activate it with no direction
		if (pruned_touches[touch.identifier].dpad == null) {
			for (let dpad_element of dpad_elements) {
				if (is_inside_dpad(touch, dpad_element)) {
					pruned_touches[touch.identifier].dpad = dpad_element.id;
					event.preventDefault();
				}
			}
		}

		// Finally, with our active D-pad, collect and set the directions
		if (pruned_touches[touch.identifier].dpad != null) {
			let dpad_element = document.getElementById(
				pruned_touches[touch.identifier].dpad
			);
			let old_directions = pruned_touches[touch.identifier].directions;
			pruned_touches[touch.identifier].directions = dpad_directions(
				touch,
				dpad_element,
				old_directions
			);
			event.preventDefault();
		}
	}
	// At this point any released touch points should not have been copied to the list,
	// so swapping lists will prune them
	active_touches = pruned_touches;

	process_active_touch_regions();
}

function clear_active_classes() {
	for (let el of touch_button_elements) {
		el.classList.remove('active');
	}
	for (let el of dpad_elements) {
		for (let direction of ['up', 'down', 'left', 'right']) {
			let pad_element = document.getElementById(el.id + '_' + direction);
			pad_element.classList.remove('active');
		}
	}
}

function process_active_touch_regions() {
	clear_active_classes();
	for (let touch_identifier in active_touches) {
		active_touch = active_touches[touch_identifier];
		if (active_touch.button != null) {
			let button_element = document.getElementById(active_touch.button);
			button_element.classList.add('active');
		}
		if (active_touch.dpad != null) {
			for (let direction of active_touch.directions) {
				let pad_element = document.getElementById(
					active_touch.dpad + '_' + direction
				);
				pad_element.classList.add('active');
			}
		}
	}
}

function handleTouchEvent(event) {
	is_touch_detected = true;
	handleTouches(event.touches, event);
}
