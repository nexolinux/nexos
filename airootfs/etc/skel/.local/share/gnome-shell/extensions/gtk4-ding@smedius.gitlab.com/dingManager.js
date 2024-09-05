/* eslint-disable no-undef */
/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright(C) 2023 Sundeep Mediratta (smedius@gmail.com)
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
/* exported init, enable, disable */
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';

import * as EmulateX11 from './emulateX11WindowType.js';
import * as GnomeShellOverride from './gnomeShellOverride.js';
import * as VisibleArea from './visibleArea.js';
import * as FileUtils from './utils/fileUtils.js';

const GnomeShellVersion = parseInt(Config.PACKAGE_VERSION.split('.')[0]);

Gio._promisify(Gio.DataInputStream.prototype, 'read_line_async', 'read_line_finish_utf8');
Gio._promisify(Gio.Subprocess.prototype, 'wait_async');

const fileProto = imports.system.version >= 17200
    ? Gio.File.prototype : Gio._LocalFilePrototype;
Gio._promisify(fileProto, 'enumerate_children_async');
Gio._promisify(Gio.FileEnumerator.prototype, 'close_async');
Gio._promisify(Gio.FileEnumerator.prototype, 'next_files_async');
Gio._promisify(fileProto, 'load_bytes_async');

const ifaceXml = `
<node>
  <interface name="com.desktop.dingextension.service">
    <method name="updateDesktopGeometry"/>
    <method name="getDropTargetAppInfoDesktopFile">
      <arg type="ad" direction="in" name="Global Drop Coordinates"/>
      <arg type="s" direction="out" name=".desktop Application File Path or 'null'"/>
    </method>
    <method name="getShellGlobalCoordinates">
        <arg type="ai" direction="out" name="Global pointer Coordinates"/>
    </method>
    <method name="setDragCursor">
    <arg type="s" direction="in" name="Set Shell Cursor"/>
    </method>
    <method name="showShellBackgroundMenu"/>
  </interface>
</node>`;

const ShellDropCursor = {
    DEFAULT: 'default',
    NODROP: 'dndNoDropCursor',
    COPY: 'dndCopyCursor',
    MOVE: 'dndMoveCursor',
};

export {DingManager};

const DingManager = class {
    constructor(extensionpath, version, uuid) {
        this.path = extensionpath;
        this.version = version;
        this.uuid = uuid;
        this._init();
    }

    /**
     * Inits the Class
     */
    _init() {
        this.isEnabled = false;
        this.launchDesktop = 0;
        this.waylandClient = null;
        this.DesktopIconsUsableArea = null;
        this.dingExtensionServiceImplementation = null;
        this.dingExtensionServiceInterface = null;

        this.GnomeShellOverride = null;
        this.GnomeShellVersion = GnomeShellVersion;

        /* The constructor of the EmulateX11 class only initializes some
         * internal properties, but nothing else. In fact, it has its own
         * enable() and disable() methods. That's why it could have been
         * created here, in init(). But since the rule seems to be NO CLASS
         * CREATION IN INIT UNDER NO CIRCUMSTANCES...
         */
        this.x11Manager = null;
        this.visibleArea = null;

        /* Ensures that there aren't "rogue" processes.
         * This is a safeguard measure for the case of Gnome Shell being
         * relaunched (for example, under X11, with Alt+F2 and R), to kill
         * any old DING instance. That's why it must be here, in init(),
         * and not in enable() or disable() (disable already guarantees that
         * the current instance is killed).
         */
        this.killingProcess = true;
        this._doKillAllOldDesktopProcesses().catch(e => console.error(e)).finally(() => (this.killingProcess = false));
    }


    /**
     * Enables the extension
     */
    enable() {
        if (!this.GnomeShellOverride)
            this.GnomeShellOverride = new GnomeShellOverride.GnomeShellOverride();
        this.GnomeShellOverride.enable();

        if (!this.x11Manager)
            this.x11Manager = new EmulateX11.EmulateX11WindowType();

        if (!this.DesktopIconsUsableArea) {
            this.DesktopIconsUsableArea = new VisibleArea.VisibleArea();
            this.visibleArea = this.DesktopIconsUsableArea;
        }

        // If the desktop is still starting up, we wait until it is ready
        if (Main.layoutManager._startingUp) {
            this.startupPreparedId = Main.layoutManager.connect('startup-complete', this._activateDelayedLaunch.bind(this));
        } else {
            this.startupPrepareId = null;
            this._activateDelayedLaunch();
        }
    }

    /**
     * The true code that configures everything and launches the desktop program
     */
    _activateDelayedLaunch() {
        if (this.killingProcess) {
            this.startupProcessKillWaitId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                if (this.killingProcess)
                    return GLib.SOURCE_CONTINUE;

                this.startupProcessKillWaitId = 0;
                this._activateDelayedLaunch();
                return GLib.SOURCE_REMOVE;
            });
            return;
        }

        if (this.starupPrepareId) {
            Main.layoutManager.disconnect(this.startupPreparedId);
            this.startupPreparedId = null;
        }

        // under X11 we now need to cheat, so now do all this under wayland as well as X
        this.x11Manager.enable();

        /*
         * If the desktop geometry changes (because a new monitor has been added, for example),
         */
        this.monitorsChangedId = Main.layoutManager.connect('monitors-changed', this._updateDesktopGeometry.bind(this));

        /*
         * Any change in the workareas must be detected too, for example if the used size changes.
         */
        this.workareasChangedId = global.display.connect('workareas-changed', this._updateDesktopGeometry.bind(this));

        /*
         * This callback allows to detect a change in the working area (like when changing the Scale value)
         */
        this.visibleAreaId = this.visibleArea.connect('updated-usable-area', this._updateDesktopGeometry.bind(this));

        this.dbusConnectionId = this._acquireDBusName();

        this.lockSignalhandlerId = Gio.DBus.session.signal_subscribe(
            'org.gnome.ScreenSaver',
            'org.gnome.ScreenSaver',
            'ActiveChanged',
            '/org/gnome/ScreenSaver',
            null,
            Gio.DBusSignalFlags.NONE,
            this._onActiveChanged.bind(this)
        );

        this.isEnabled = true;
        if (this.launchDesktop)
            GLib.source_remove(this.launchDesktop);

        this._launchDesktop().catch(e => console.error(e));

        this.remoteDingActions = Gio.DBusActionGroup.get(
            Gio.DBus.session,
            'com.desktop.ding',
            '/com/desktop/ding/actions'
        );

        this.remoteGeometryUpdateRequestedId = Gio.DBus.session.signal_subscribe(
            'com.desktop.ding',
            'com.desktop.ding.geometrycontrol',
            'updategeometry',
            '/com/desktop/ding/geometrycontrol',
            null,
            Gio.DBusSignalFlags.NONE,
            this._updateDesktopGeometry.bind(this)
        );

        console.log('gtk4-DING enabled.');
    }

    /**
     * Disables the extension. For Gnome > 42 the extension runs with the session mode 'unlock-dialog'.
     * This allows the extension to keep running when the lock screen comes on. The advantage is that
     * the Gtk4 programs that are spawned by this extension keep running, rendering all the file icons
     * on the desktop. When the user logs back in the desktop is already rendered and running, the
     * desktop program does not need to be first killed on the lock-screen and then launced again on
     * unlock.
     *
     * If disable is called, it explictly kill the desktop program. This will hapen on log out.
     */
    disable() {
        this.isEnabled = false;
        this.DesktopIconsUsableArea = null;
        this._killCurrentProcess();
        this.GnomeShellOverride.disable();
        this.x11Manager.disable();
        this.visibleArea.disable();

        if (this.startupProcessKillWaitId) {
            GLib.source_remove(this.startupProcessKillWaitId);
            this.startupProcessKillWaitId = 0;
        }
        if (this.startupPreparedId) {
            Main.layoutManager.disconnect(this.startupPreparedId);
            this.startupPreparedId = 0;
        }
        if (this.monitorsChangedId) {
            Main.layoutManager.disconnect(this.monitorsChangedId);
            this.monitorsChangedId = 0;
        }
        if (this.workareasChangedId) {
            global.display.disconnect(this.workareasChangedId);
            this.workareasChangedId = 0;
        }
        if (this.visibleAreaId) {
            this.visibleArea.disconnect(this.visibleAreaId);
            this.visibleAreaId = 0;
        }
        if (this.dbusConnectionId)
            this._stopDbusService();

        if (this.lockSignalhandlerId) {
            Gio.DBus.session.signal_unsubscribe(this.lockSignalhandlerId);
            this.lockSignalhandlerId = 0;
        }
        if (this.remoteGeometryUpdateRequestedId) {
            Gio.DBus.session.signal_unsubscribe(this.remoteGeometryUpdateRequestedId);
            this.remoteGeometryUpdateRequestedId = 0;
        }
        console.log('gtk4-DING disabled.');
    }

    /**
     * Acquire the DBus Name on the Session Bus
     *
     */
    _acquireDBusName() {
        let ID = Gio.bus_own_name(
            Gio.BusType.SESSION,
            'com.desktop.dingextension',
            Gio.BusNameOwnerFlags.NONE,
            this._onBusAcquired.bind(this),
            (connection, name) => {
                console.log(`${name} DBus Name Acquired`);
                this.dbusConnectionName = name;
            },
            (connection, name) => {
                console.log(`${name} DBus and Name Lost`);
                this.dbusConnectionName = null;
            }
        );
        return ID;
    }

    /**
     * Start the Dbus Service
     *
     * @param {GObject} connection the Dbus Connection
     *
     */
    _onBusAcquired(connection) {
        this.dingExtensionServiceImplementation = new DingExtensionService(this._updateDesktopGeometry.bind(this));
        this.dingExtensionServiceInterface = Gio.DBusExportedObject.wrapJSObject(ifaceXml,
            this.dingExtensionServiceImplementation);
        this.dingExtensionServiceImplementation._impl = this.dingExtensionServiceInterface;
        this.dingExtensionServiceInterface.export(connection, '/com/desktop/dingextension/service');
    }

    _stopDbusService() {
        if (this.dingExtensionServiceInterface)
            this.dingExtensionServiceInterface.unexport();
        this.dingExtensionServiceInterface = null;
        if (this.dingExtensionServiceImplementation)
            this.dingExtensionServiceImplementation.disable();
        this.dingExtensionServiceImplementation = null;
        Gio.bus_unown_name(this.dbusConnectionId);
        this.dbusConnectionId = 0;
        if (this.dbusConnectionName)
            console.log(`${this.dbusConnectionName} DBus Name Relinquished`);
        this.dbusConnectionName = null;
    }


    /**
     * Start stop needed functions with screen locks and unlocks
     *
     * @param {GObject} connection the Dbus Connection
     * @param {string} sender the numeric Dbus Sender address
     * @param {string} path the Dbus Sender path
     * @param {string} iface the Sender Dbus interface
     * @param {string} signal the signal name
     * @param {GLib.variant} params the GLib.variant with parameters
     */
    _onActiveChanged(connection, sender, path, iface, signal, params) {
        const value = params.get_child_value(0);
        const locked = value.get_boolean();
        if (!locked)
            this.x11Manager.refreshWindows();
    }

    /**
     * Sends updated geometry data to the DING desktop program over DBus
     */
    _updateDesktopGeometry() {
        if (this.remoteDingActions && (Main.layoutManager.monitors.length !== 0))
            this.remoteDingActions.activate_action('updateGridWindows', this._getDesktopGeometry());
    }

    /**
     * Gets current desktop Geometry from visibleArea.js
     */
    _getDesktopGeometry() {
        let desktopList = [];
        let ws = global.workspace_manager.get_workspace_by_index(0);
        for (let monitorIndex = 0; monitorIndex < Main.layoutManager.monitors.length; monitorIndex++) {
            let area = this.visibleArea.getMonitorGeometry(ws, monitorIndex);
            let desktopListElement = new GLib.Variant('a{sd}', {
                'x': area.x,
                'y': area.y,
                'width': area.width,
                'height': area.height,
                'zoom': area.scale,
                'marginTop': area.marginTop,
                'marginBottom': area.marginBottom,
                'marginLeft': area.marginLeft,
                'marginRight': area.marginRight,
                monitorIndex,
                'primaryMonitor': Main.layoutManager.primaryIndex,
            });
            desktopList.push(desktopListElement);
        }
        return new GLib.Variant('av', desktopList);
    }

    /**
     * Kills the current desktop program
     */
    _killCurrentProcess() {
        if (this.launchDesktop) {
            GLib.source_remove(this.launchDesktop);
            this.launchDesktop = 0;
        }

        // kill the desktop program. It will be reloaded automatically.
        if (this.waylandClient && this.waylandClient.subprocess) {
            this.waylandClient.cancellable.cancel();
            this.waylandClient.subprocess.send_signal(15);
        }
        this.waylandClient = null;
        this.x11Manager.set_wayland_client(null);
    }

    /**
     * This function checks all the processes in the system and kills those
     * that are a desktop manager from the current user (but not others).
     * This allows to avoid having several ones in case gnome shell resets,
     * or other odd cases. It requires the /proc virtual filesystem, but
     * doesn't fail if it doesn't exist.
     */
    async _doKillAllOldDesktopProcesses() {
        const procFolder = Gio.File.new_for_path('/proc');
        const processes = await FileUtils.enumerateDir(procFolder);
        const thisPath = `gjs ${GLib.build_filenamev([
            this.path,
            'app',
            'ding.js',
        ])}`;

        const killPromises = processes.map(async info => {
            const filename = info.get_name();
            const processPath = GLib.build_filenamev(['/proc', filename, 'cmdline']);
            const processUser = Gio.File.new_for_path(processPath);

            try {
                const [binaryData] = await processUser.load_bytes_async(null);
                const readData = binaryData.get_data();
                let contents = '';

                for (let i = 0; i < readData.length; i++) {
                    if (readData[i] < 32)
                        contents += ' ';
                    else
                        contents += String.fromCharCode(readData[i]);
                }

                if (contents.startsWith(thisPath)) {
                    let proc = new Gio.Subprocess({argv: ['/bin/kill', filename]});
                    proc.init(null);
                    console.log(`Killing old DING process ${filename}`);
                    await proc.wait_async(null);
                }
            } catch (e) {

            }
        });

        await Promise.all(killPromises);
    }

    /**
     *
     * @param {integer} reloadTime Relaunch time after crash in ms
     */
    _doRelaunch(reloadTime) {
        this.waylandClient = null;
        this.x11Manager.set_wayland_client(null);
        if (this.isEnabled) {
            if (this.launchDesktop)
                GLib.source_remove(this.launchDesktop);

            this.launchDesktop = GLib.timeout_add(GLib.PRIORITY_DEFAULT, reloadTime, () => {
                this.launchDesktop = 0;
                this._launchDesktop().catch(e => console.error(e));
                return false;
            });
        }
    }

    /**
     * Launches the desktop program, passing to it the current desktop geometry for each monitor
     * and the path where it is stored. It also monitors it, to relaunch it in case it dies or is
     * killed. Finally, it reads STDOUT and STDERR and redirects them to the journal, to help to
     * debug it.
     */
    async _launchDesktop() {
        console.log('Launching Gtk4-DING process');
        let argv = [];
        argv.push(GLib.build_filenamev([this.path, 'app', 'ding.js']));
        // Specify that it must work as true desktop
        argv.push('-E');
        // The path. Allows the program to find translations, settings and modules.
        argv.push('-P');
        argv.push(this.path);
        // The current Gnome Shell Version for correct operation of clipboard with Gtk4.
        argv.push('-V');
        argv.push(`${this.GnomeShellVersion}`);
        // The current version of the Extension
        argv.push('-v');
        argv.push(`${this.version}`);
        // Give the uuid of the extension
        argv.push('-U');
        argv.push(`${this.uuid}`);

        this.waylandClient = new LaunchSubprocess(0, 'Gtk4-DING');
        this.waylandClient.set_cwd(GLib.get_home_dir());
        this.x11Manager.set_wayland_client(this.waylandClient);

        const launchTime = GLib.get_monotonic_time();
        let subprocess;

        try {
            subprocess = await this.waylandClient.spawnv(argv);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                console.error(e, `Error while trying to launch DING process: ${e.message}`);
                this._doRelaunch(1000);
            }
            return;
        }

        /*
        * If the desktop process dies, wait 100ms and relaunch it, unless the exit status is different than
        * zero, in which case it will wait one second. This is done this way to avoid relaunching the desktop
        * too fast if it has a bug that makes it fail continuously, avoiding filling the journal too fast.
        */
        const delta = GLib.get_monotonic_time() - launchTime;
        let reloadTime;
        if (delta < 1000000) {
            // If the process is dying over and over again, ensure that it isn't respawn faster than once per second
            reloadTime = 1000;
        } else {
            // but if the process just died after having run for at least one second, reload it ASAP
            reloadTime = 1;
        }

        if (!this.waylandClient || subprocess !== this.waylandClient.subprocess)
            return;


        if (subprocess.get_if_exited())
            subprocess.get_exit_status();

        this._doRelaunch(reloadTime);
    }
};

/**
 * This class encapsulates the code to launch a subprocess that can detect whether a window belongs to it
 * It only accepts to do it under Wayland, because under X11 there is no need to do these tricks
 *
 * It is compatible with https://gitlab.gnome.org/GNOME/mutter/merge_requests/754 to simplify the code
 *
 * @param {int} flags Flags for the SubprocessLauncher class
 * @param {string} process_id An string id for the debug output
 */
var LaunchSubprocess = class {
    constructor(flags, processId) {
        this._processID = processId;
        this._launcher = new Gio.SubprocessLauncher({flags: flags | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE});
        if (Meta.is_wayland_compositor()) {
            try {
                this._waylandClient = Meta.WaylandClient.new(this._launcher);
            } catch (e) {
                this._waylandClient = Meta.WaylandClient.new(global.context, this._launcher);
            }

            if (Config.PACKAGE_VERSION === '3.38.0') {
                // workaround for bug in 3.38.0
                this._launcher.ref();
            }
        }
        this.subprocess = null;
        this.process_running = false;
    }

    async spawnv(argv) {
        try {
            if (Meta.is_wayland_compositor())
                this.subprocess = this._waylandClient.spawnv(global.display, argv);
            else
                this.subprocess = this._launcher.spawnv(argv);
        } catch (e) {
            this.subprocess = null;
            throw e;
        }

        if (this.cancellable)
            this.cancellable.cancel();

        const cancellable = new Gio.Cancellable();
        this.cancellable = cancellable;

        // This is for GLib 2.68 or greater
        if (this._launcher.close)
            this._launcher.close();

        this._launcher = null;

        /*
         * It reads STDOUT and STDERR and sends it to the journal using global.log(). This allows to
         * have any error from the desktop app in the same journal than other extensions. Every line from
         * the desktop program is prepended with the "process_id" parameter sent in the constructor.
         */
        const dataInputStream = Gio.DataInputStream.new(this.subprocess.get_stdout_pipe());
        this.readOutput(dataInputStream, cancellable).catch(e => console.error(e));

        try {
            this.process_running = true;
            await this.subprocess.wait_async(cancellable);
        } finally {
            cancellable.cancel();
            this.process_running = false;

            if (this.cancellable === cancellable)
                this.cancellable = null;
        }
        return this.subprocess;
    }

    set_cwd(cwd) {
        this._launcher.set_cwd(cwd);
    }

    async readOutput(dataInputStream, cancellable) {
        let textDecoder = new TextDecoder();
        try {
            const [output, length] = await dataInputStream.read_line_async(
                GLib.PRIORITY_DEFAULT, cancellable);
            if (length)
                console.log(`${this._processID}: ${textDecoder.decode(output)}`);
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return;

            console.error(e, `${this._processID}_Error`);
        }

        await this.readOutput(dataInputStream, cancellable);
    }

    /**
     * Queries whether the passed window belongs to the launched subprocess or not.
     *
     * @param {MetaWindow} window The window to check.
     */
    query_window_belongs_to(window) {
        if (!Meta.is_wayland_compositor())
            return false;

        if (!this.process_running)
            return false;

        try {
            return this._waylandClient.owns_window(window);
        } catch (e) {
            return false;
        }
    }

    query_pid_of_program() {
        if (!this.process_running)
            return false;

        return this.subprocess.get_identifier();
    }

    show_in_window_list(window) {
        if (Meta.is_wayland_compositor() && this.process_running)
            this._waylandClient.show_in_window_list(window);
    }

    hide_from_window_list(window) {
        if (Meta.is_wayland_compositor() && this.process_running)
            this._waylandClient.hide_from_window_list(window);
    }

    make_desktop_window(window) {
        if (window.window_type === Meta.WindowType.DESKTOP)
            return true;
        if (Meta.is_wayland_compositor() && this.process_running) {
            try {
                this._waylandClient.make_desktop(window);
                console.log('Making Wayland window type Desktop');
                return true;
            } catch (e) {
                console.log('Meta.WaylandClient make_desktop() method not available yet!');
            }
        }
        return false;
    }
};

/**
 * This class implements the Dbus Services Provided for the extension
 */
var DingExtensionService = class {
    constructor(updateDesktopGeometryCB) {
        this.geometryUpdate = updateDesktopGeometryCB;
        this.synthesizeHover = new SynthesizeHover();
    }

    disable() {
        this.synthesizeHover.disable();
    }

    updateDesktopGeometry() {
        this.geometryUpdate();
    }

    showShellBackgroundMenu() {
        const [X, Y] = global.get_pointer().slice(0, 2);
        const rect = new Mtk.Rectangle({x: X, y: Y, width: 1, height: 1});
        const monitorIndex = global.display.get_monitor_index_for_rect(rect);
        const backgroundManager = Main.layoutManager._bgManagers[monitorIndex];
        const backgroundMenu = backgroundManager?.backgroundActor?._backgroundMenu;
        if (!backgroundMenu)
            return;
        Main.layoutManager.setDummyCursorGeometry(X, Y, 0, 0);
        backgroundMenu.open(BoxPointer.PopupAnimation.FULL);
    }

    getDropTargetAppInfoDesktopFile([dropX, dropY]) {
        let droptarget = null;
        let actor = null;
        if (!dropX || !dropY)
            [dropX, dropY] = global.get_pointer().slice(0, 2);

        actor = global.get_stage().get_actor_at_pos(Clutter.PickMode.REACTIVE, dropX, dropY);
        let i = 0;
        let checkactor;

        while (actor && (i < 10)) {
            if (actor._delegate)
                checkactor = actor._delegate;
            else
                checkactor = actor;

            if (checkactor?.app?.appInfo?.get_filename()) {
                droptarget = checkactor.app.appInfo.get_filename();
                break;
            }

            if (checkactor?.location?.get_uri()) {
                droptarget = checkactor.location.get_uri();
                break;
            }

            i += 1;
            actor = actor.get_parent();
        }

        if (droptarget) {
            this.synthesizeHover.hoverOver(checkactor);
            return droptarget;
        } else {
            return 'null';
        }
    }

    setDragCursor(cursor) {
        switch (cursor) {
        case ShellDropCursor.MOVE:
            global.display.set_cursor(Meta.Cursor.DND_MOVE);
            break;
        case ShellDropCursor.COPY:
            global.display.set_cursor(Meta.Cursor.DND_COPY);
            break;
        case ShellDropCursor.NODROP:
            global.display.set_cursor(Meta.Cursor.DND_UNSUPPORTED_TARGET);
            break;
        default:
            global.display.set_cursor(Meta.Cursor.DEFAULT);
        }
    }

    getShellGlobalCoordinates() {
        let x = global.get_pointer();
        return x;
    }
};

/** This class simulates a hover on the Dock so thet the dock app items
 * can be visible and scroll automatically on drops.
 */
var SynthesizeHover = class {
    constructor() {
        this._hoveredActor = null;
        this._hoverTimeoutID = 0;
    }

    disable() {
        this._cancelCurrentTimer();
        if (this._hoveredActor)
            this._hoveredActor.set_hover(false);
        this._hoveredActor = null;
    }

    hoverOver(newactor) {
        // eslint-disable-next-line eqeqeq
        if (newactor == this._hoveredActor) {
            this._resetHoverTimer();
            return;
        }
        if (this._hoveredActor)
            this._hoveredActor.set_hover(false);
        this._cancelCurrentTimer();
        this._hoveredActor = newactor;
        this._hoveredActor.sync_hover();
        this._setNewHoverTimer();
    }

    _resetHoverTimer() {
        this._cancelCurrentTimer();
        this._setNewHoverTimer();
    }

    _cancelCurrentTimer() {
        if (this._hoverTimeoutID)
            GLib.source_remove(this._hoverTimeoutID);
        this._hoverTimeoutID = 0;
    }

    _setNewHoverTimer() {
        this._hoverTimeoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            if (this._hoveredActor)
                this._hoveredActor.set_hover(false);
            this._hoveredActor = null;
            this._hoverTimeoutID = 0;
            return false;
        });
    }
};
