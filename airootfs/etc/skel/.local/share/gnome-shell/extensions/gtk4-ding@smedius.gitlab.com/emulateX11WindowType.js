/* Emulate X11WindowType
 *
 * Copyright (C) 2022 Sundeep Mediratta (smedius@gmail.com)
 * Copyright (C) 2020 Sergio Costas (rastersoft@gmail.com)
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
/* global global */
/* exported EmulateX11WindowType */
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import * as Utils from 'resource:///org/gnome/shell/misc/util.js';

export {EmulateX11WindowType};
class ManageWindow {
    /* This class is added to each managed window, and it's used to
       make it behave like an X11 Desktop window.

       Trusted windows will set in the title the characters @!, followed
       by the coordinates where to put the window separated by a colon, and
       ended in semicolon. After that, it can have one or more of these letters-

       * B : put and always keep this window at the bottom of the stack of windows on screen
       * T : put and always keep this window at the top of the stack of windows the screen
       * D : show this window in all desktops
       * H : hide this window from window list

       Using the title is generally not a problem because the desktop windows
       do not have a title. But some other windows may have and still need to
       set a title and use this class, so adding a single blank space at the end of the
       title is equivalent to @!H, and having two blank spaces at the end of the
       title is equivalent to @!HTD. This allows use of these flags for decorated or titled windows.
    */

    constructor(window, waylandClient, changedStatusCB) {
        this._isX11 = !Meta.is_wayland_compositor();
        this._waylandClient = waylandClient;
        this._window = window;
        this._signalIDs = [];
        this._onIdleChangedStatusCallback = changedStatusCB;

        this._titleID = this._window.connect('notify::title', () => {
            this.refreshProperties();
        });

        this._parseTitle();
        this._attachControllers();
    }

    disconnect() {
        this._disconnetSignalsAndTimeouts();

        if (this._titleID)
            this._window.disconnect(this._titleID);
        this._titleID = 0;

        if (this._keepAtTop)
            this._window.unmake_above();

        this._window = null;
        this._waylandClient = null;
    }

    _disconnetSignalsAndTimeouts() {
        for (let signalID of this._signalIDs) {
            if (signalID)
                this._window.disconnect(signalID);
        }
        this._signalIDs = [];

        if (this._checkOnAllWorkspacesID)
            GLib.source_remove(this._checkOnAllWorkspacesID);
        this._checkOnAllWorkspacesID = 0;

        if (this._moveIntoPlaceID)
            GLib.source_remove(this._moveIntoPlaceID);
        this._moveIntoPlaceID = 0;

        if (this._restackedBottomID)
            global.display.disconnect(this._restackedBottomID);
        this._restackedBottomID = 0;

        if (this._showDesktopID)
            global.workspace_manager.disconnect(this._showDesktopID);
        this._showDesktopID = 0;

        if (this._restackedTopID)
            global.display.disconnect(this._restackedTopID);
        this._restackedTopID = 0;
    }

    set_wayland_client(client) {
        this._waylandClient = client;
    }

    _parseTitle() {
        this._x = null;
        this._y = null;
        this._keepAtBottom = false;
        this._keepAtTop = false;
        this._showInAllDesktops = false;
        this._hideFromWindowList = false;
        this._fixed = false;
        this._desktopWindow = false;
        let title = this._window.get_title();

        if (!title && !!this._window.get_transient_for()) {
            // Transient dialog window
            // Does not have title, hide from windowlist
            title = '@!H';
        }

        if (title !== null) {
            if ((title.length > 0) && (title[title.length - 1] === ' ')) {
                if ((title.length > 1) && (title[title.length - 2] === ' '))
                    title = '@!HTD';
                else
                    title = '@!H';
            }
            let pos = title.search('@!');
            if (pos !== -1) {
                let pos2 = title.search(';', pos);
                let coords;
                if (pos2 !== -1)
                    coords = title.substring(pos + 2, pos2).trim().split(',');
                else
                    coords = title.substring(pos + 2).trim().split(',');

                try {
                    this._x = parseInt(coords[0]);
                    this._y = parseInt(coords[1]);
                } catch (e) {
                    global.log(`Exception ${e.message}.\n${e.stack}`);
                }
                try {
                    let extraChars = title.substring(pos + 2).trim().toUpperCase();
                    for (let char of extraChars) {
                        switch (char) {
                        case 'B':
                            this._keepAtBottom = true;
                            this._keepAtTop = false;
                            break;
                        case 'T':
                            this._keepAtTop = true;
                            this._keepAtBottom = false;
                            break;
                        case 'D':
                            this._showInAllDesktops = true;
                            break;
                        case 'H':
                            this._hideFromWindowList = true;
                            break;
                        case 'F':
                            this._fixed = true;
                            break;
                        }
                    }
                    this._desktopWindow = this._keepAtBottom && !this._keepAtTop && this._showInAllDesktops && this._hideFromWindowList;
                } catch (e) {
                    global.log(`Exception ${e.message}.\n${e.stack}`);
                }
            }
        }
    }

    _attachControllers() {
        if (this._fixed)
            this._keepFixedWindowPosition();

        if (this._hideFromWindowList)
            this._keepWindowHidden();
        else
            this._unhideWindow();

        if (this._keepAtTop)
            this._keepWindowOnTop();
        else if (this._window.above)
            this._window.unmake_above();

        if (this._keepAtBottom & !this._desktopWindow)
            this._keepWindowAtBottom();

        if (this._showInAllDesktops & !this._desktopWindow)
            this._showWindowOnAllDesktops();
        else if (this._window.on_all_workspaces)
            this._window.unstick();

        if (this._desktopWindow)
            this._makeWindowTypeDesktop();
    }

    _keepFixedWindowPosition() {
        this._signalIDs.push(this._window.connect('position-changed', () => {
            if (this._fixed && (this._x !== null) && (this._y !== null)) {
                this._window.move_frame(true, this._x, this._y);
                if (this._window.fullscreen)
                    this._window.unmake_fullscreen();
            }
        }));

        this._signalIDs.push(this._window.connect('notify::minimized', () => {
            this._window.unminimize();
        }));

        this._signalIDs.push(this._window.connect('notify::maximized-vertically', () => {
            if (!this._window.maximized_vertically)
                this._window.maximize(Meta.MaximizeFlags.VERTICAL);
            this._moveIntoPlace();
        }));

        this._signalIDs.push(this._window.connect('notify::maximized-horizontally', () => {
            if (!this._window.maximized_horizontally)
                this._window.maximize(Meta.MaximizeFlags.HORIZONTAL);
            this._moveIntoPlace();
        }));

        if ((this._x !== null) && (this._y !== null))
            this._window.move_frame(true, this._x, this._y);
    }

    _moveIntoPlace() {
        if (this._moveIntoPlaceID)
            GLib.source_remove(this._moveIntoPlaceID);

        this._moveIntoPlaceID = GLib.timeout_add(GLib.PRIORITY_LOW, 250, () => {
            if (this._fixed && (this._x !== null) && (this._y !== null))
                this._window.move_frame(true, this._x, this._y);
            this._moveIntoPlaceID = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _keepWindowHidden() {
        if (!this._isX11 && this._waylandClient) {
            this._waylandClient.hide_from_window_list(this._window);
        } else {
            const xid = this._window.xwindow;
            this._setX11windowSkipTaskbar(xid);
        }
    }

    _unhideWindow() {
        if (!this._isX11 && this._waylandClient) {
            this._waylandClient.show_in_window_list(this._window);
        } else {
            const xid = this._window.xwindow;
            this._unSetX11windowSkipTaskbar(xid);
        }
    }

    _keepWindowAtBottom() {
        this._signalIDs.push(this._window.connect('notify::above', () => {
            if (this._keepAtBottom && this._window.above)
                this._window.unmake_above();
        }));

        this._signalIDs.push(this._window.connect_after('raised', () => {
            if (this._keepAtBottom)
                this._window.lower();
        }));

        /* If a window is lowered below us with shortcuts, detect and fix DING window */
        this._restackedBottomID = global.display.connect('restacked',
            this._syncToBottomOfStack.bind(this)
        );

        /* If the desktop is shown with keyboard gnome shortcuts, detect and put
           DING window back, seems to be needed for X11, works without on Wayland
        */
        if (this._isX11) {
            this._showDesktopID = global.workspace_manager.connect('showing-desktop-changed',
                this._activateDesktopWindow.bind(this)
            );
        }

        if (this._window.above)
            this._window.unmake_above();
        this._window.lower();
    }

    _keepWindowUnFullScreen() {
        this._signalIDs.push(this._window.connect('notify::fullscreen', () => {
            if (this._window.fullscreen)
                this._window.unmake_fullscreen();
        }));
        if (this._window.fullscreen)
            this._window.unmake_fullscreen();
    }

    _activateDesktopWindow() {
        if (this._desktopWindow)
            this._window.activate(Meta.CURRENT_TIME);
    }

    _syncToBottomOfStack() {
        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, global.workspace_manager.get_active_workspace());
        windows = global.display.sort_windows_by_stacking(windows);
        if (windows.length > 1 && !windows[0].customJS_ding)
            this._moveDesktopWindowToBottom();
    }

    _moveDesktopWindowToBottom() {
        if (this._window.fullscreen)
            this._window.unmake_fullscreen();

        if (this._keepAtBottom)
            this._window.lower();
    }

    _keepWindowOnTop() {
        this._restackedTopID = global.display.connect('restacked', () => {
            if (!this._window.above)
                this._window.make_above();
        });
        if (!this._window.above)
            this._window.make_above();
    }

    _showWindowOnAllDesktops() {
        this._signalIDs.push(this._window.connect('notify::on-all-workspaces',
            this._checkOnAllWorkspaces.bind(this)
        ));

        this._signalIDs.push(this._window.connect('workspace-changed',
            this._checkOnAllWorkspaces.bind(this)
        ));

        this._window.stick();
    }

    _checkOnAllWorkspaces() {
        if (this._checkOnAllWorkspacesID)
            GLib.source_remove(this._checkOnAllWorkspacesID);

        this._checkOnAllWorkspacesID = GLib.idle_add(GLib.PRIORITY_LOW, () => {
            if (this._showInAllDesktops && !this._window.on_all_workspaces) {
                this._window.stick();
                this._onIdleActivateTopWindowOnActiveWorkspace();
            }
            this._checkOnAllWorkspacesID = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _makeWindowTypeDesktop() {
        if (!this._isX11 && this._waylandClient) {
            const desktopWindowTypeSetOnWindow = this._waylandClient.make_desktop_window(this._window);
            if (!desktopWindowTypeSetOnWindow) {
                this._emulateDesktopWindow();
                return;
            }
        } else {
            const xid = this._window.xwindow;
            try {
                this._setX11windowTypeDesktop(xid);
            } catch (e) {
                logError(e);
                this._emulateDesktopWindow();
                return;
            }
        }

        // Window manager bug - it treats request to resize window
        // to monitor size as a fullscreen window request as well and makes
        // the window fullscreen, more so for legacy X11 apps.
        // This makes intellihide for docks/panels hide from desktop window
        this._keepWindowUnFullScreen();

        const activateTopWindowOnWorkspace = true;
        this._onIdleChangedStatusCallback({activateTopWindowOnWorkspace});
    }

    _emulateDesktopWindow() {
        console.log('Emulating window type Desktop');
        this._window.get_window_type = function () {
            return Meta.WindowType.DESKTOP;
        };

        this._keepWindowAtBottom();
        this._showWindowOnAllDesktops();
        const moveDesktopWindowToBottom = true;
        const activateTopWindowOnWorkspace = true;
        this._onIdleChangedStatusCallback({moveDesktopWindowToBottom, activateTopWindowOnWorkspace});
    }

    _onIdleActivateTopWindowOnActiveWorkspace() {
        const activateTopWindowOnWorkspace = true;
        this._onIdleChangedStatusCallback({activateTopWindowOnWorkspace});
    }

    _setX11windowSkipTaskbar(xid) {
        // Unfortunately xprop can set only one of the properties in the state, not multiple
        // Stick to setting only skip-taskbar, we can otherwirse also set the property for pager,
        // _NET_WM_STATE_SKIP_PAGER
        const commandline = `xprop -id ${xid}` +
        ' -f _NET_WM_STATE 32a' +
        ' -set _NET_WM_STATE' +
        ' _NET_WM_STATE_SKIP_TASKBAR';
        console.log('Making X11 windowtype type skip-taskbar');
        Utils.spawnCommandLine(commandline);
    }

    _unSetX11windowSkipTaskbar(xid) {
        const commandline = `xprop -id ${xid}` +
        ' -f _NET_WM_STATE 32a' +
        ' -remove _NET_WM_STATE' +
        ' _NET_WM_STATE_SKIP_TASKBAR';
        console.log('Making X11 windowtype type NOT skip-taskbar');
        Utils.spawnCommandLine(commandline);
    }

    _setX11windowTypeDesktop(xid) {
        const commandline = `xprop -id ${xid}` +
            ' -f _NET_WM_WINDOW_TYPE 32a' +
            ' -set _NET_WM_WINDOW_TYPE' +
            ' _NET_WM_WINDOW_TYPE_DESKTOP';
        console.log('Making X11 windowtype type Desktop');
        Utils.trySpawnCommandLine(commandline);
    }

    refreshProperties() {
        this._disconnetSignalsAndTimeouts();
        this._parseTitle();
        this._attachControllers();
    }

    get hideFromWindowList() {
        return this._hideFromWindowList;
    }

    get keepAtBottom() {
        return this._keepAtBottom;
    }

    get desktopWindow() {
        return this._desktopWindow;
    }
}

var EmulateX11WindowType = class {
    /*
     This class does all the heavy lifting for emulating WindowType.
     Just make one instance of it, call enable(), and whenever a window
     that you want to give "superpowers" is mapped, add it with the
     "addWindowManagedCustomJS_ding" method. That's all.
     */
    constructor() {
        this._isX11 = !Meta.is_wayland_compositor();
        this._windowList = new Set();
        this._overviewHiding = true;
        this._waylandClient = null;
    }

    set_wayland_client(client) {
        this._waylandClient = client;
        for (let window of this._windowList) {
            if (window.customJS_ding)
                window.customJS_ding.set_wayland_client(this._waylandClient);
        }
    }

    enable() {
        this._idMap = global.window_manager.connect_after('map', (obj, windowActor) => {
            let window = windowActor.get_meta_window();

            if (window.get_window_type() > Meta.WindowType.DIALOG)
                return;

            if (this._waylandClient && this._waylandClient.query_window_belongs_to(window))
                this._addWindowManagedCustomJS_ding(window, windowActor);

            if (this._isX11) {
                let appid = window.get_gtk_application_id();
                let windowpid = window.get_pid();
                let mypid = parseInt(this._waylandClient.query_pid_of_program());
                if ((appid === 'com.desktop.ding') && (windowpid === mypid))
                    this._addWindowManagedCustomJS_ding(window, windowActor);
            }
        });

        this._idDestroy = global.window_manager.connect_after('destroy', (wm, windowActor) => {
            // if a window is closed, ensure that the desktop doesn't receive the focus
            let window = windowActor.get_meta_window();
            if (window && (window.get_window_type() >= Meta.WindowType.DROPDOWN_MENU))
                return;

            this.onIdleReStackActivteWindows({activateTopWindowOnWorkspace: true});
        });

        /* But in Overview mode it is paramount to not change the workspace to emulate
           "stick", or the windows will appear
         */
        this._showingId = Main.overview.connect('showing', () => {
            this._overviewHiding = false;
        });

        this._hidingId = Main.overview.connect('hiding', () => {
            this._overviewHiding = true;
            this.onIdleReStackActivteWindows({activateTopWindowOnWorkspace: true});
        });
    }

    disable() {
        if (this._activate_window_ID) {
            GLib.source_remove(this._activate_window_ID);
            this._activate_window_ID = null;
        }
        for (let window of this._windowList)
            this._clearWindow(window);

        this._windowList.clear();

        // disconnect signals
        if (this._idMap) {
            global.window_manager.disconnect(this._idMap);
            this._idMap = null;
        }
        if (this._idDestroy) {
            global.window_manager.disconnect(this._idDestroy);
            this._idDestroy = null;
        }
        if (this._showingId) {
            Main.overview.disconnect(this._showingId);
            this._showingId = null;
        }
        if (this._hidingId) {
            Main.overview.disconnect(this._hidingId);
            this._hidingId = null;
        }
    }

    _addWindowManagedCustomJS_ding(window, windowActor) {
        if (window.get_meta_window) { // it is a MetaWindowActor
            window = window.get_meta_window();
        }

        if (this._windowList.has(window))
            return;

        window.customJS_ding = new ManageWindow(window, this._waylandClient, this.onIdleReStackActivteWindows.bind(this));
        window.actor = windowActor;
        windowActor._delegate = new HandleDragActors(windowActor);
        this._windowList.add(window);
        window.customJS_ding.unmanagedID = window.connect('unmanaged', win => {
            this._clearWindow(win);
            this._windowList.delete(window);
        });
    }

    _clearWindow(window) {
        window.disconnect(window.customJS_ding.unmanagedID);
        window.customJS_ding.disconnect();
        window.customJS_ding = null;
        window.actor._delegate = null;
        window.actor = null;
    }

    _activateTopWindowOnActiveWorkspace() {
        let windows = global.display.get_tab_list(Meta.TabList.NORMAL, global.workspace_manager.get_active_workspace());
        windows = global.display.sort_windows_by_stacking(windows);
        if (windows.length) {
            let topWindow = windows[windows.length - 1];
            topWindow.focus(Clutter.CURRENT_TIME);
        }
    }

    _moveDesktopWindowToBottom() {
        for (let window of this._windowList)
            window.customJS_ding._moveDesktopWindowToBottom();
    }

    onIdleReStackActivteWindows(action = {activateTopWindowOnWorkspace: true}) {
        if (!this._activate_window_ID) {
            this._activate_window_ID = GLib.idle_add(GLib.PRIORITY_LOW, () => {
                if (this._overviewHiding) {
                    if (action.moveDesktopWindowToBottom)
                        this._moveDesktopWindowToBottom();

                    if (action.activateTopWindowOnWorkspace)
                        this._activateTopWindowOnActiveWorkspace();
                }
                this._activate_window_ID = null;
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    // After shell unlock, window seems to lose stick property, refresh window properties
    refreshWindows() {
        for (let window of this._windowList)
            window.customJS_ding.refreshProperties();
    }
};

class HandleDragActors {
    /* This class is added to each managed windowActor, and it's used to
       make it behave like a shell Actor that can accept drops from Gnome Shell dnd.
    */

    constructor(windowActor) {
        this.windowActor = windowActor;
        this.remoteDingActions = Gio.DBusActionGroup.get(
            Gio.DBus.session,
            'com.desktop.ding',
            '/com/desktop/ding/actions'
        );
    }

    _getModifierKeys() {
        let [, , state] = global.get_pointer();
        state &= Clutter.ModifierType.MODIFIER_MASK;
        this.isControl = (state & Clutter.ModifierType.CONTROL_MASK) !== 0;
        this.isShift = (state & Clutter.ModifierType.SHIFT_MASK) !== 0;
    }

    handleDragOver(source) {
        if ((source.app ?? null) === null)
            return DND.DragMotionResult.NO_DROP;
        this._getModifierKeys();
        if (this.isShift) {
            global.display.set_cursor(Meta.Cursor.DND_COPY);
            return DND.DragMotionResult.COPY_DROP;
        }
        if (this.isControl) {
            global.display.set_cursor(Meta.Cursor.DND_MOVE);
            return DND.DragMotionResult.MOVE_DROP;
        }
        return DND.DragMotionResult.CONTINUE;
    }

    acceptDrop(source, actor, x, y) {
        if ((source.app ?? null) === null)
            return false;

        let appFavorites = AppFavorites.getAppFavorites();
        let sourceAppId = source.app.get_id();
        let sourceAppPath = source.app.appInfo.get_filename();
        let appIsFavorite = appFavorites.isFavorite(sourceAppId);
        this._getModifierKeys();
        if (appIsFavorite && !this.isShift)
            appFavorites.removeFavorite(sourceAppId);
        if (sourceAppPath && (this.isControl || this.isShift)) {
            this.remoteDingActions.activate_action('createDesktopShortcut',
                new GLib.Variant('a{sv}', {
                    uri: GLib.Variant.new_string(`file://${sourceAppPath}`),
                    X: new GLib.Variant('i', parseInt(x)),
                    Y: new GLib.Variant('i', parseInt(y)),
                })
            );
        }
        appFavorites.emit('changed');
        return true;
    }
}
