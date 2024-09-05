/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Gtk4 Port Copyright (C) 2023 Sundeep Mediratta (smedius@gmail.com)
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
import {Gdk, Gio, GLib} from '../dependencies/gi.js';
import {_} from '../dependencies/gettext.js';

export {GnomeShellDrag};

const GnomeShellDrag = class {
    constructor(desktopManager) {
        this._DBusUtils = desktopManager.DBusUtils;
        if (!this._DBusUtils.RemoteExtensionControl.isAvailable)
            return;
        this._desktopManager = desktopManager;
        this._dragItem = desktopManager.dragItem;
        this._DesktopIconsUtil = desktopManager.DesktopIconsUtil;
        this._Enums = desktopManager.Enums;
        this._Prefs = desktopManager.Prefs;
        this._selectedFiles = desktopManager.getCurrentSelection();
        let Uris = true;
        this._selectedFilesURI = desktopManager.getCurrentSelection(Uris);
        this._desktopDir = this._DesktopIconsUtil.getDesktopDir();
        this._dockSpringOpenFile = null;
        this._currentDesktopFileAppPath = null;
        this._dockSpringOpenTime = GLib.get_monotonic_time();
        this._dockSpringOpenComplete = false;
        this._startMonitoringDockUriNavigation();
    }

    destroy() {
        this._stopMonitoringDockUriNavigation();
    }

    _startMonitoringDockUriNavigation() {
        // Careful, we have to and are calling an async function in the timer, which will always return true,
        // therefore the function has to kill itself if not killed by drag end...
        this._dockUriSpringTimerID =  GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._Enums.DND_SHELL_HOVER_POLL,
            async () => {
                try {
                    await this._dockUriSpringTimerFunction();
                } catch (e) {
                    console.error(e);
                }
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    async _lookOffLeftEdgeForDrop(shellDropCoordinates) {
        let leftEdge = shellDropCoordinates;
        // look upto 50 pixels away for a drop target, off the drag cursor to the left
        for (let i = 0; i <= 50; i += 10) {
            leftEdge[0] -= i;
            // eslint-disable-next-line no-await-in-loop
            this._currentDesktopFileAppPath = await this._DBusUtils.RemoteExtensionControl.getDropTargetAppInfoDesktopFile(leftEdge).catch(e => console.error(e));
            if (this._currentDesktopFileAppPath)
                break;
        }
        this._setShellDropCursor();
    }

    async _dockUriSpringTimerFunction() {
        // Failsafe kill the function - remove the timer if going on for too long, default 30 seconds
        if (!this._dragItem || (GLib.get_monotonic_time() - this._dockSpringOpenTime) > this._Enums.DND_SHELL_HOVER_POLL * 150000) {
            let stopID = this._dockUriSpringTimerID;
            this._dockUriSpringTimerID = 0;
            this._setShellDropCursor(this._Enums.ShellDropCursor.DEFAULT);
            if (stopID)
                GLib.Source.remove(stopID);
            return GLib.SOURCE_REMOVE;
        }

        let shellDropCoordinates = await this._DBusUtils.RemoteExtensionControl.getDropTargetCoordinates().catch(e => console.error(e));

        this._lookOffLeftEdgeForDrop(shellDropCoordinates);

        if (!this._currentDesktopFileAppPath ||
                !(this._currentDesktopFileAppPath.endsWith('Nautilus.desktop') ||
                this._currentDesktopFileAppPath.startsWith('file://') ||
                this._currentDesktopFileAppPath.startsWith('davs://')))
            return GLib.SOURCE_CONTINUE;


        // On a URI, start hover timing and reset timer
        if (!this._dockSpringOpenFile) {
            this._dockSpringOpenFile = this._currentDesktopFileAppPath;
            this._dockSpringOpenTime = GLib.get_monotonic_time();
            return GLib.SOURCE_CONTINUE;
        }

        // Open the URI, got here after hover timing started
        if (this._dockSpringOpenFile === this._currentDesktopFileAppPath && !this._dockSpringOpenComplete &&
              ((GLib.get_monotonic_time() - this._dockSpringOpenTime) > this._Enums.DND_HOVER_TIMEOUT * 1000)) {
            const context = Gdk.Display.get_default().get_app_launch_context();
            context.set_timestamp(Gdk.CURRENT_TIME);
            let uri;
            try {
                if (this._dockSpringOpenFile.endsWith('Nautilus.desktop'))
                    uri = this._desktopDir.get_uri();
                else
                    uri = this._dockSpringOpenFile;
                if (this._Prefs.openFolderOnDndHover)
                    Gio.AppInfo.launch_default_for_uri(uri, context);
                this._dockSpringOpenComplete = true;
            } catch (e) {
                console.error(e, `Error opening ${uri} in GNOME Files: ${e.message}`);
            }
            return GLib.SOURCE_CONTINUE;
        }

        // URI is the same, window is opened, do nothing
        if (this._dockSpringOpenFile === this._currentDesktopFileAppPath && this._dockSpringOpenComplete)
            return GLib.SOURCE_CONTINUE;

        // If still alive, window is opened and uri is changed, reset
        if (this._dockSpringOpenFile !== this._currentDesktopFileAppPath && this._dockSpringOpenComplete) {
            this._dockSpringOpenFile = null;
            this._dockSpringOpenComplete = false;
            return GLib.SOURCE_CONTINUE;
        }
        return GLib.SOURCE_REMOVE;
    }

    _stopMonitoringDockUriNavigation() {
        if (this._dockUriSpringTimerID) {
            GLib.Source.remove(this._dockUriSpringTimerID);
            this._currentDesktopFileAppPath = null;
            this._setShellDropCursor(this._Enums.ShellDropCursor.DEFAULT);
        }
        this._dockUriSpringTimerID = 0;
    }

    _setShellDropCursor(cursor = null) {
        if (!this._DBusUtils.RemoteExtensionControl.isAvailable)
            return;
        if (cursor) {
            this._DBusUtils.RemoteExtensionControl.setDragCursor(cursor);
            return;
        }
        if (!this._currentDesktopFileAppPath) {
            this._DBusUtils.RemoteExtensionControl.setDragCursor(this._Enums.ShellDropCursor.NODROP);
            return;
        }
        try {
            if (this._currentDesktopFileAppPath.endsWith('.desktop')) {
                let desktopFile = Gio.DesktopAppInfo.new_from_filename(GLib.build_filenamev([this._currentDesktopFileAppPath]));
                if (!desktopFile) {
                    console.log('Could not parse desktopFile as a desktop file, cannot set shell cursor');
                    this._DBusUtils.RemoteExtensionControl.setDragCursor(this._Enums.ShellDropCursor.NODROP);
                    return;
                }
                let object = this._DesktopIconsUtil.checkAppOpensFileType(desktopFile, null, this._selectedFiles[0].attributeContentType);
                if (object.canopenFile) {
                    this._DBusUtils.RemoteExtensionControl.setDragCursor(this._Enums.ShellDropCursor.COPY);
                    return;
                } else if (this._currentDesktopFileAppPath.endsWith('Nautilus.desktop') && this._Prefs.openFolderOnDndHover) {
                    this._DBusUtils.RemoteExtensionControl.setDragCursor(this._Enums.ShellDropCursor.MOVE);
                    return;
                } else {
                    this._DBusUtils.RemoteExtensionControl.setDragCursor(this._Enums.ShellDropCursor.NODROP);
                }
            } else if (this._currentDesktopFileAppPath.startsWith('file://') ||
                this._currentDesktopFileAppPath.startsWith('davs://') ||
                this._currentDesktopFileAppPath.startsWith('trash://')) {
                this._DBusUtils.RemoteExtensionControl.setDragCursor(this._Enums.ShellDropCursor.MOVE);
                return;
            } else {
                this._DBusUtils.RemoteExtensionControl.setDragCursor(this._Enums.ShellDropCursor.NODROP);
                return;
            }
        } catch (e) {
            console.error(e, 'Error reading desktop file. Cannot set shell Cursor');
        }
        this._DBusUtils.RemoteExtensionControl.setDragCursor(this._Enums.ShellDropCursor.NODROP);
    }

    async completeGnomeShellDrop() {
        if  (!this._currentDesktopFileAppPath)
            return false;
        if (this._currentDesktopFileAppPath.endsWith('.desktop')) {
            try {
                let desktopFile = Gio.DesktopAppInfo.new_from_filename(GLib.build_filenamev([this._currentDesktopFileAppPath]));
                if (!desktopFile) {
                    console.log('Could not parse desktopFile as a desktop file');
                    return false;
                }
                let object = this._DesktopIconsUtil.checkAppOpensFileType(desktopFile, null, this._selectedFiles[0].attributeContentType);
                if (object.canopenFile) {
                    const context = Gdk.Display.get_default().get_app_launch_context();
                    context.set_timestamp(Gdk.CURRENT_TIME);
                    desktopFile.launch_uris_as_manager(this._selectedFilesURI, context, GLib.SpawnFlags.SEARCH_PATH, null, null);
                    return true;
                } else {
                    this._showAppCannotOpenError(object.Appname);
                    return false;
                }
            } catch (e) {
                console.error(e, 'Error reading desktop file. Cannot launch application.');
                return false;
            }
        }
        if (this._currentDesktopFileAppPath === 'trash:///') {
            this._desktopManager.doTrash();
            return true;
        }
        if (this._currentDesktopFileAppPath.startsWith('file:///') || this._currentDesktopFileAppPath.startsWith('davs://')) {
            await this._desktopManager.copyOrMoveUris(this._selectedFilesURI, this._currentDesktopFileAppPath, {}, {}).catch(e => console.error(e));
            return true;
        }
        return false;
    }

    _textEntryAccelsTurnOff() {
        this._desktopManager.textEntryAccelsTurnOff();
    }

    _textEntryAccelsTurnOn() {
        this._desktopManager.textEntryAccelsTurnOn();
    }

    _showAppCannotOpenError(Appname) {
        const modal = true;
        const timeout = 3000; // In ms
        const errorDialog = this._desktopManager.showError(
            _('Could not open File'),
            // eslint-disable-next-line no-template-curly-in-string
            _('${appName} can not open files of this Type!').replace('${appName}', Appname),
            modal
        );
        errorDialog.timeoutClose(timeout);
        return false;
    }
};
