// ---------------------------------------------------------------- [end import]
/**
 * This class is used to manager signal and handles of a object
 */
export class Connections {
    // -------------------------------------------------------- [public methods]
    /**
     * Map object to store signal sources and their handlers
     * @type {Map<GObject.Object, { [signal_name: string]: number }>}
     */
    connections = new Map();
    /**
     * Handler signal for a GObject
     *
     * ### Example:
     *
     * ```typescript
     * const manager = new Connections ()
     * manager.connect (global.window_manager, 'destroy', (wm, actor) =>
     *     console.log (`${actor} has been removed`)
     * )
     * ```
     * @param source - Signal source
     * @param args - Arguments pass into GObject.Object.connect()
     *
     * biome-ignore lint/suspicious/noExplicitAny: this will make life easier
     */
    connect(source, ...args) {
        const signal = args[0];
        const id = source.connect(args[0], args[1]);
        // Source has been added into manager
        {
            const handlers = this.connections.get(source);
            if (handlers !== undefined) {
                if (handlers[signal] !== undefined) {
                    handlers[signal].push(id);
                    return;
                }
                handlers[signal] = [id];
                return;
            }
        }
        // Source is first time register signal
        const handlers = {};
        handlers[signal] = [id];
        this.connections.set(source, handlers);
    }
    /** Disconnect signal for source */
    disconnect(source, signal) {
        const handlers = this.connections.get(source);
        if (handlers !== undefined) {
            const handler = handlers[signal];
            if (handler !== undefined) {
                for (const id of handler) {
                    source.disconnect(id);
                }
                delete handlers[signal];
                if (Object.keys(handler).length === 0) {
                    this.connections.delete(source);
                }
                return;
            }
        }
    }
    disconnect_all(source) {
        // If provide source,  disconnect all signal of it
        if (source !== undefined) {
            const handlers = this.connections.get(source);
            if (handlers !== undefined) {
                for (const signal in handlers) {
                    for (const id of handlers[signal]) {
                        source.disconnect(id);
                    }
                    delete handlers[signal];
                }
                this.connections.delete(source);
            }
            return;
        }
        // otherwise clear signal for all objects.
        this.connections.forEach((handlers, source) => {
            for (const signal in handlers) {
                for (const id of handlers[signal]) {
                    source.disconnect(id);
                }
                delete handlers[signal];
            }
        });
        this.connections.clear();
    }
}
/** A singleton of connections */
let _connections = null;
export const connections = {
    get: () => {
        if (_connections === null) {
            _connections = new Connections();
        }
        return _connections;
    },
    del: () => {
        _connections = null;
    },
};
