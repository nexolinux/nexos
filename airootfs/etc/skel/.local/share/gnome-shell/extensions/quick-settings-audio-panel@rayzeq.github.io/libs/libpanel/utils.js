import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

const Config = await import("resource:///org/gnome/shell/misc/config.js").catch(async () =>
	await import("resource:///org/gnome/Shell/Extensions/js/misc/config.js")
);

export function split(string, sep, maxsplit) {
	const splitted = string.split(sep);
	return maxsplit ? splitted.slice(0, maxsplit).concat([splitted.slice(maxsplit).join(sep)]) : splitted;
}

export function rsplit(string, sep, maxsplit) {
	const splitted = string.split(sep);
	return maxsplit ? [splitted.slice(0, -maxsplit).join(sep)].concat(splitted.slice(-maxsplit)) : splitted;
}

export function array_remove(array, item) {
	const index = array.indexOf(item);
	if (index > -1) {
		array.splice(index, 1);
		return true;
	}
	return false;
}

export function array_insert(array, index, ...items) {
	array.splice(index, 0, ...items);
}

export function get_stack() {
	return new Error().stack.split('\n').slice(1).map(l => l.trim()).filter(Boolean).map(frame => {
		const [func, remaining] = split(frame, '@', 1);
		const [file, line, column] = rsplit(remaining, ':', 2);
		return { func, file, line, column };
	});
}

export function get_extension_uuid() {
	const stack = get_stack();
	for (const frame of stack.reverse()) {
		if (frame.file.includes('/gnome-shell/extensions/')) {
			const [left, right] = frame.file.split('@').slice(-2);
			return `${left.split('/').at(-1)}@${right.split('/')[0]}`;
		}
	}
		
	return undefined;
}

export function get_shell_version() {
	const [major, minor] = Config.PACKAGE_VERSION.split('.').map(s => Number(s));
	return { major, minor };
}

export function add_named_connections(patcher, object) {
	// this is used to debug things
	/*function _get_address(object) {
		return object.toString().slice(1, 15);
	}*/

	function set_signal(object, source, signal, callback, id) {
		// Add the source map
		if (object._lp_connections === undefined) {
			object._lp_connections = new Map();
			if (object instanceof GObject.Object) {
				object.connect('destroy', () => {
					/*console.log(`${object}: removing connections`,
						JSON.stringify(object._lp_connections, function simplify(key, value) {
							if (value instanceof Map)
								return Object.fromEntries(Array.from(value, ([k, v]) => [simplify(null, k), v]));
							else if (value instanceof GObject.Object)
								return _get_address(value);
							else if (value instanceof Function)
								return "<function>";
							else
								return value;
						})
					);*/
					object.disconnect_named();
				});
			}
		}
		const source_map = object._lp_connections;

		// Add the signal map
		if (!source_map.has(source)) {
			source_map.set(source, new Map());
			source.connect('destroy', () => {
				//console.log(`REMOVING ${_get_address(source)} FROM ${_get_address(object)}`);
				source_map.delete(source);
			});
		}
		const signal_map = source_map.get(source);

		// Add the callback map
		if (!signal_map.has(signal)) signal_map.set(signal, new Map());
		const callback_map = signal_map.get(signal);

		//console.log(`CONNECT ${_get_address(source)}::${signal} -> ${_get_address(object)}::${id}`);
		//console.log(`Fake connections are ${Object.fromEntries(Object.entries(source?._signalConnections))}`);

		// Add the id
		callback_map.set(callback, id);
		return id + 100000; // this is just here to prevent any accidental usage of this id with normal disconnect
	}

	patcher.replace_method(object, function connect_named(_wrapped, source, signal, callback) {
		return set_signal(this, source, signal, callback, source.connect(signal, callback));
	});
	patcher.replace_method(object, function connect_after_named(_wrapped, source, signal, callback) {
		return set_signal(this, source, signal, callback, source.connect_after(signal, callback));
	});
	patcher.replace_method(object, function disconnect_named(_wrapped, source = undefined, signal = undefined, callback = undefined) {
		if (typeof source === 'number') {
			// The function was called with an id.
			const id_to_remove = source - 100000;

			const source_map = this._lp_connections;
			if (!source_map) return;
			for (const [source, signal_map] of source_map.entries()) {
				for (const [signal, callback_map] of signal_map.entries()) {
					for (const [callback, id] of callback_map.entries()) {
						if (id === id_to_remove) {
							this.disconnect_named(source, signal, callback);
						}
					}
				}
			}

			return;
		}

		if (callback !== undefined) {
			// Every argments have been provided
			const source_map = this._lp_connections;
			if (!source_map) return;
			const signal_map = source_map.get(source);
			if (!signal_map) return;
			const callback_map = signal_map.get(signal);
			if (!callback_map) return;
			const id = callback_map.get(callback);
			if (id === undefined) return;

			// console.log(`Disconnecting ${signal} on ${source} with id ${id}`);
			// console.log(`Fake connections are ${Object.fromEntries(Object.entries(source?._signalConnections))}`);
			if (source.signalHandlerIsConnected?.(id) || (source instanceof GObject.Object && GObject.signal_handler_is_connected(source, id)))
				source.disconnect(id);
			callback_map.delete(callback);
		} else if (signal !== undefined) {
			// Only source and signal have been provided
			// console.log(`Disconnecting ${signal} on ${source}`);
			const source_map = this._lp_connections;
			if (!source_map) return;
			const signal_map = source_map.get(source);
			if (!signal_map) return;
			const callback_map = signal_map.get(signal);
			if (!callback_map) return;

			for (const callback of callback_map.keys()) {
				this.disconnect_named(source, signal, callback);
			}
			signal_map.delete(signal);
		} else if (source !== undefined) {
			// Only source have been provided
			// console.log(`Disconnecting ${source}`);
			const source_map = this._lp_connections;
			if (!source_map) return;
			const signal_map = source_map.get(source);
			if (!signal_map) return;

			for (const signal of signal_map.keys()) {
				this.disconnect_named(source, signal);
			}
			source_map.delete(source);
		} else {
			// Nothing have been provided
			// console.log("Disconnecting everything");
			const source_map = this._lp_connections;
			if (!source_map) return;

			for (const source of source_map.keys()) {
				this.disconnect_named(source);
			}
			this._lp_connections.clear();
		}
	});
}

export function find_panel(widget) {
	const panels = [];

	do {
		if (widget.is_grid_item) {
			panels.push(widget);
		}
	} while ((widget = widget.get_parent()) !== null);

	return panels.at(-1);
}

export function get_settings(path) {
	const [parent_path, file] = rsplit(path, '/', 1);
	const id = rsplit(file, '.', 2)[0];
	const source = Gio.SettingsSchemaSource.new_from_directory(
		parent_path,
		Gio.SettingsSchemaSource.get_default(),
		false
	);
	return new Gio.Settings({ settings_schema: source.lookup(id, true) });
}

export function get_style(widget) {
	return widget.style
		?.split(';')
		.map(x => {
			const [name, value] = split(x, ':', 1).map(x => x.trim());
			return { name, value };
		})
		.filter(x => x.name !== '') || [];
}

export function set_style(widget, name, value) {
	let style = get_style(widget).filter(x => x.name !== name);

	if (value !== null)
		style.push({ name, value });

	widget.style = style
		.map(({ name, value }) => `${name}: ${value}`)
		.join(';');
}