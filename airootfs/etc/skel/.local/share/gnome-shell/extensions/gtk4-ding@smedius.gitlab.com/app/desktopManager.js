/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Gtk4 Port Copyright (C) 2022 Sundeep Mediratta (smedius@gmail.com)
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
import {
    FileItem,
    DesktopGrid,
    AskRenamePopup,
    ShowErrorPopup,
    TemplatesScriptsManager,
    FileItemMenu,
    AutoAr,
    AppChooser,
    GnomeShellDragDrop,
    Thumbnails,
    StackItem
} from '../dependencies/localFiles.js';

import {Gtk, Gdk, Gio, GLib, GLibUnix} from '../dependencies/gi.js';
import {_} from '../dependencies/gettext.js';

export {DesktopManager};

const DesktopManager = class {
    constructor(Data, Utils, desktopList, codePath, asDesktop, primaryIndex) {
        // Inherit
        this.mainApp = Data.dingApp;
        this._codePath = codePath;
        this._asDesktop = asDesktop;
        if (asDesktop) {
            this.mainApp.hold(); // Don't close the application if there are no desktops
            this._hold_active = true;
        }

        this._primaryIndex = primaryIndex;
        if (primaryIndex < desktopList.length)
            this._primaryScreen = desktopList[primaryIndex];
        else
            this._primaryScreen = null;

        this.GnomeShellVersion = Data.gnomeversion;

        this.uuid = Data.uuid;

        // Init and import Scripts and classes
        this.DesktopIconsUtil = Utils.DesktopIconsUtil;
        this.FileUtils = Utils.FileUtils;
        this.Enums = Data.Enums;
        this.DBusUtils = Utils.DBusUtils;
        this.dbusManager = Utils.DBusUtils.dbusManagerObject;
        this.Prefs = Utils.Preferences;
        this.showErrorPopup = ShowErrorPopup;
        this.templatesScriptsManager = TemplatesScriptsManager;
        this.autoAr = new AutoAr.AutoAr(this);
        this.appChooser = AppChooser;
        this.fileItemMenu = new FileItemMenu.FileItemMenu(this);

        // Init Variables
        this._selectedFiles = null;
        this._clickX = null;
        this._clickY = null;
        this.pointerX = 0;
        this.pointerY = 0;
        this._dragList = null;
        this.dragItem = null;
        this._desktopList = desktopList;
        this._desktops = [];
        this._desktopFilesChanged = false;
        this._readingDesktopFiles = false;
        this._desktopDir = this.DesktopIconsUtil.getDesktopDir();
        this.rubberBand = false;
        this.localDragOffset = [0, 0];
        this._allFileList = null;
        this._fileList = [];
        this._forcedExit = false;
        this._scriptsList = [];
        this._pendingDropFiles = {};
        this._pendingSelfCopyFiles = {};
        this.ignoreKeys = this.Enums.IgnoreKeys.map(_k => Gdk._k);
        // init methods
        this._initLocalCSSprovider();
        this._configureSelectionColor();
        this._startMonitoringTemplatesDir();
        this._createMenuActionGroup();
        this._updateWritableByOthers().catch(e => console.error(e));
        this._monitorDesktopChanges();
        this.Prefs.init(this);
        this._monitorVolumes();

        // create grid windows
        this._getPremultiplied();
        this._createGridWindows();

        // Start Dbus Services
        this._intDBusSignalMonitoring();
        this._dbusAdvertiseUpdate();

        this._initDbusThumbnailing();

        // Check if Gnome Files is available and executable, otherwise give warning
        // Check and make sure Gnome Files is registered with xdg-utils to handle inode/directory
        this._performSanityChecks();

        // setup gracefull termination
        if (this._asDesktop) {
            this._sigtermID = GLibUnix.signal_add_full(GLib.PRIORITY_DEFAULT, 15, () => {
                GLib.source_remove(this._sigtermID);
                this.terminateProgram();
                if (this._hold_active) {
                    this.mainApp.release();
                    this._hold_active = false;
                }
                return false;
            });
        }
    }

    async _performSanityChecks() {
        const inodeHandlers = Gio.AppInfo.get_all_for_type('inode/directory');
        if (!GLib.find_program_in_path('nautilus')) {
            const modal = true;
            const helpURL = null;
            const dontShow = true;
            const errorWindow = this.showError(
                _('GNOME Files not found'),
                _('The GNOME Files application is required by Gtk4 Desktop Icons NG.'),
                modal,
                helpURL,
                dontShow
            );
            await errorWindow.run();
        }
        if (!inodeHandlers.length) {
            const modal = true;
            const helpURL = 'https://gitlab.com/smedius/desktop-icons-ng/-/issues/73';
            const dontShow = true;
            const errorWindow = this.showError(
                _('There is no default File Manager'),
                _('There is no application that handles mimetype "inode/directory"'),
                modal,
                helpURL,
                dontShow
            );
            await errorWindow.run();
        }
        if (!inodeHandlers.map(a => a.get_id()).includes('org.gnome.Nautilus.desktop')) {
            const modal = true;
            const helpURL = 'https://gitlab.com/smedius/desktop-icons-ng/-/issues/73';
            const dontShow = true;
            const errorWindow = this.showError(
                _('Gnome Files is not registered as a File Manager'),
                _('The Gnome Files application is not programmed to open Folders!\nCheck your xdg-utils installation\nCheck Gnome Files .desktop File installation'),
                modal,
                helpURL,
                dontShow
            );
            await errorWindow.run();
        }
    }

    showError(text, secondaryText, modal, helpURL = null, dontShow = false) {
        const _errorDialog = new ShowErrorPopup.ShowErrorPopup(
            text,
            secondaryText,
            modal,
            this.textEntryAccelsTurnOff.bind(this),
            this.textEntryAccelsTurnOn.bind(this),
            this.DesktopIconsUtil,
            helpURL
        );

        if (!dontShow)
            _errorDialog.run();

        return _errorDialog;
    }

    _initDbusThumbnailing() {
        this.thumbnailLoader = new Thumbnails.ThumbnailLoader(this._codePath, this.FileUtils);
        this._updateDesktop().catch(e => {
            console.log(`Exception while initiating desktop: ${e.message}\n${e.stack}`);
        });
    }

    terminateProgram() {
        if (this._allFileList && (this._allFileList.length > 0)) {
            this._fileList.forEach(f => {
                if (f.isStackMarker)
                    f.onDestroy();
            });
            this._allFileList.forEach(f => f.onDestroy());
        } else {
            this._fileList.forEach(f => f.onDestroy());
        }
        for (let desktop of this._desktops)
            desktop.destroy();

        this._desktops = [];
        this._forcedExit = true;
        if (this._desktopEnumerateCancellable)
            this._desktopEnumerateCancellable.cancel();

        this.fileItemMenu.destroy();

        if (this.thumbnailApp)
            this.thumbnailApp.send_signal(15);
    }

    _startMonitoringTemplatesDir() {
        this.templatesMonitor = new TemplatesScriptsManager.TemplatesScriptsManager(
            this.DesktopIconsUtil.getTemplatesDir(),
            this._newDocument.bind(this),
            this._templatesDirSelectionFilter.bind(this),
            {
                mainApp: this.mainApp,
                appName: 'templateapp',
                FileUtils: this.FileUtils,
                Enums: this.Enums,
            }
        );
    }

    _intDBusSignalMonitoring() {
        this.DBusUtils.RemoteFileOperations.fileOperationsManager.connectToProxy('g-properties-changed', this._undoStatusChanged.bind(this));

        this.DBusUtils.RemoteFileOperations.fileOperationsManager.connect('changed-status', (actor, available) => {
            if (available)
                this._syncUndoRedo();
            else
                this._syncUndoRedo(true);
        });

        if (this.DBusUtils.RemoteFileOperations.fileOperationsManager.isAvailable)
            this._syncUndoRedo();

        this.DBusUtils.GtkVfsMetadata.connectSignalToProxy('AttributeChanged', this._metadataChanged.bind(this));
    }

    _initLocalCSSprovider() {
        const cssProvider = new Gtk.CssProvider();
        cssProvider.load_from_file(
            Gio.File.new_for_path(
                GLib.build_filenamev(
                    [this._codePath, 'app', 'resources', 'stylesheet.css']
                )));
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            cssProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
    }

    _configureSelectionColor() {
        const box = new Gtk.Label();
        this._styleContext = box.get_style_context();
        this._styleContext.add_class('view');
        this._setSelectionColor();
    }

    _setSelectionColor() {
        let [exists, color] = this._styleContext.lookup_color('accent_bg_color');
        if (exists) {
            this.selectColor = color;
        } else {
            this.selectColor =  new Gdk.RGBA({
                red: 0,
                green: 0,
                blue: 0.9,
                alpha: 1.0,
            });
        }
        [exists, color] = this._styleContext.lookup_color('accent_fg_color');
        if (exists) {
            this.hoverColor = color;
        } else {
            this.hoverColor =  new Gdk.RGBA({
                red: 0.9,
                green: 0.9,
                blue: 0.9,
                alpha: 1.0,
            });
        }

        let cssColorDefinition =
            `@define-color desktop_icons_bg_color ${this.selectColor.to_string()};\n`;
        cssColorDefinition +=
            `@define-color desktop_icons_fg_color ${this.hoverColor.to_string()};`;
        this._cssColorProviderSelection = new Gtk.CssProvider();
        // fix for api change Gtk 4.9
        try {
            this._cssColorProviderSelection.load_from_data(cssColorDefinition);
        } catch (e) {
            const gsizeLength = -1; // NULL terminated string
            this._cssColorProviderSelection.load_from_data(
                cssColorDefinition,
                gsizeLength
            );
        }
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            this._cssColorProviderSelection,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
    }

    _monitorDesktopChanges() {
        this._monitorDesktopDir = this._desktopDir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        this._monitorDesktopDir.set_rate_limit(1000);
        this._monitorDesktopDir.connect('changed', (obj, file, otherFile, eventType) =>
            this._updateDesktopIfChanged(file, otherFile, eventType).catch(e => console.error(e)));
    }

    _metadataChanged(proxy, nameOwner, args) {
        let filepath = GLib.build_filenamev([GLib.get_home_dir(), args[1]]);
        if (this._desktopDir.get_path() === GLib.path_get_dirname(filepath)) {
            for (let fileItem of this.updateFileList()) {
                if (fileItem.path === filepath) {
                    fileItem.updatedMetadata();
                    break;
                }
            }
        }
    }

    updateFileList() {
        let updateFileList;
        if (this._allFileList && (this._allFileList.length > 0))
            updateFileList = this._allFileList;
        else
            updateFileList = this._fileList;

        return updateFileList;
    }

    _templatesDirSelectionFilter(fileinfo) {
        const name = this.DesktopIconsUtil.getFileExtensionOffset(fileinfo.get_name()).basename;
        const hiddenfile = name.substring(0, 1) === '.';

        if (!this.Prefs.showHidden && hiddenfile)
            return null;

        return name;
    }

    _dbusAdvertiseUpdate() {
        let updateGridWindows = new Gio.SimpleAction({
            name: 'updateGridWindows',
            parameter_type: new GLib.VariantType('av'),
        });
        updateGridWindows.connect('activate', (action, parameter) => {
            this.updateGridWindows(parameter.recursiveUnpack());
        });
        let createDesktopShortcut = new Gio.SimpleAction({
            name: 'createDesktopShortcut',
            parameter_type: new GLib.VariantType('a{sv}'),
        });
        createDesktopShortcut.connect('activate', (action, parameter) => {
            this.createDesktopShortcut(parameter.recursiveUnpack());
        });
        let actionGroup = new Gio.SimpleActionGroup();
        actionGroup.add_action(updateGridWindows);
        actionGroup.add_action(createDesktopShortcut);
        this._busname = this.mainApp.get_dbus_object_path();
        this._connection = Gio.DBus.session;
        this._dbusConnectionGroupId = this._connection.export_action_group(
            `${this._busname}/actions`,
            actionGroup
        );
        if (this._asDesktop) {
            const signalXml = `
                <node>
                  <interface name="com.desktop.ding.geometrycontrol">
                    <signal name="updategeometry">
                      <arg name="type" type="s"/>
                      <arg name="value" type="b"/>
                    </signal>
                  </interface>
                </node>`;
            let geometryIface = Gio.DBusExportedObject.wrapJSObject(signalXml, this);
            geometryIface.export(this._connection, `${this._busname}/geometrycontrol`);
            this._requestGeometryUpdate();
        }
    }

    async createDesktopShortcut(shortcutinfo) {
        let fileList = [shortcutinfo.uri];
        let X = parseInt(shortcutinfo.X);
        let Y = parseInt(shortcutinfo.Y);
        await this.clearFileCoordinates(fileList, [X, Y], {doCopy: true});
        await this.DesktopIconsUtil.copyDesktopFileToDesktop(shortcutinfo.uri, [X, Y]);
    }

    _getPremultiplied() {
        this._premultiplied = false;
        try {
            for (let f of this.Prefs.mutterSettings.get_strv('experimental-features')) {
                if (f === 'scale-monitor-framebuffer') {
                    this._premultiplied = true;
                    break;
                }
            }
        } catch (e) {
        }
    }

    _requestGeometryUpdate() {
        let variant = new GLib.Variant('(sb)', ['updategeometry', true]);
        this._connection.emit_signal(null, `${this._busname}/geometrycontrol`, 'com.desktop.ding.geometrycontrol', 'updategeometry', variant);
    }

    updateGridWindows(newdesktoplist) {
        let newPrimaryIndex;
        let indexChanged = false;
        if ((newdesktoplist.length > 0) && ('primaryMonitor' in newdesktoplist[0]))
            newPrimaryIndex = newdesktoplist[0].primaryMonitor;
        if (newPrimaryIndex !== this._primaryIndex)
            indexChanged = true;

        if (newdesktoplist.length !== this._desktopList.length) {
            this._fileList.forEach(x => x.removeFromGrid());
            if (indexChanged)
                this._primaryIndex = newPrimaryIndex;
            this._desktopList = newdesktoplist;
            if (this._primaryIndex < this._desktopList.length)
                this._primaryScreen = this._desktopList[this._primaryIndex];
            else
                this._primaryScreen = null;

            this._createGridWindows();
            this._placeAllFilesOnGrids({redisplay: true});
            return;
        }

        let monitorschanged = [];
        let gridschanged = [];
        for (let index = 0; index < newdesktoplist.length; index++) {
            let area = newdesktoplist[index];
            let area2 = this._desktopList[index];
            if ((area.x !== area2.x) ||
                (area.y !== area2.y) ||
                (area.width !== area2.width) ||
                (area.height !== area2.height) ||
                (area.zoom !== area2.zoom) ||
                (area.monitorIndex !== area2.monitorIndex)) {
                monitorschanged.push(index);
                gridschanged.push(index);
                continue;
            }
            if ((area.marginTop !== area2.marginTop) ||
                (area.marginBottom !== area2.marginBottom) ||
                (area.marginLeft !== area2.marginLeft) ||
                (area.marginRight !== area2.marginRight)) {
                if (!gridschanged.includes(index))
                    gridschanged.push(index);
            }
        }
        if (gridschanged.length || indexChanged) {
            this._fileList.forEach(x => x.removeFromGrid());
            if (gridschanged.length) {
                for (let gridindex of gridschanged) {
                    let desktop = this._desktops[gridindex];
                    desktop.updateGridDescription(newdesktoplist[gridindex]);
                    if (monitorschanged.includes(gridindex))
                        desktop.resizeWindow();

                    desktop.resizeGrid();
                }
            }
            if (indexChanged)
                this._primaryIndex = newPrimaryIndex;
            this._desktopList = newdesktoplist;
            if (this._primaryIndex < this._desktopList.length)
                this._primaryScreen = this._desktopList[this._primaryIndex];
            else
                this._primaryScreen = null;
            this._placeAllFilesOnGrids({redisplay: true, gridschanged: true});
        }
    }

    _createGridWindows() {
        var desktopName;
        for (let desktop of this._desktops)
            desktop.destroy();

        this._desktops = [];
        for (let desktopIndex in this._desktopList) {
            let desktop = this._desktopList[desktopIndex];
            if (this._asDesktop)
                desktopName = `@!${desktop.x},${desktop.y};BDHF`;
            else
                desktopName = `DING ${desktopIndex}`;

            this._desktops.push(new DesktopGrid.DesktopGrid(this, desktopName, desktop, this._asDesktop, this._premultiplied));
        }
    }

    _setPendingDropCoordinates(file, dropCoordinates) {
        if (!dropCoordinates)
            return;
        const basename = file.get_basename();

        let selfCopy = false;
        this.updateFileList().forEach(fileItem => {
            if (fileItem.fileName === basename) {
                this._pendingDropFiles[`${basename}COPYEXPECTED`] = dropCoordinates;
                this._pendingSelfCopyFiles[basename] = fileItem.savedCoordinates;
                selfCopy = true;
            }
        });

        if (!selfCopy)
            this._pendingDropFiles[basename] = dropCoordinates;
    }

    saveCurrentFileCoordinatesForUndo() {
        if (this.Prefs.keepArranged || this.Prefs.keepStacked)
            return;

        this._pendingDropFiles = {};
        this._pendingSelfCopyFiles = {};

        this.getCurrentSelection().forEach(f => {
            this._pendingSelfCopyFiles[f.fileName] = f.savedCoordinates;
        });
    }

    async clearFileCoordinates(fileList, dropCoordinates, opts = {doCopy: false}) {
        if (this.Prefs.keepArranged || this.Prefs.keepStacked)
            return;

        this._pendingDropFiles = {};
        this._pendingSelfCopyFiles = {};

        await Promise.all(fileList.map(async element => {
            let file = Gio.File.new_for_uri(element);

            if (!file.is_native()) {
                this._setPendingDropCoordinates(file, dropCoordinates);
                return;
            }

            let info = new Gio.FileInfo();
            info.set_attribute_string('metadata::nautilus-icon-position', '');
            if (dropCoordinates !== null) {
                if (!opts.doCopy) {
                    info.set_attribute_string('metadata::nautilus-drop-position', `${dropCoordinates[0]},${dropCoordinates[1]}`);
                } else {
                    this._setPendingDropCoordinates(file, dropCoordinates);
                    return;
                }
            }

            try {
                await file.set_attributes_async(info,
                    Gio.FileQueryInfoFlags.NONE,
                    GLib.PRIORITY_LOW,
                    null);
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                    this._setPendingDropCoordinates(file, dropCoordinates);
            }
        }));
    }

    doMoveWithDragAndDrop(xOrigin, yOrigin, xDestination, yDestination) {
        const keepArranged = this.Prefs.keepArranged || this.Prefs.keepStacked;
        if (this.Prefs.sortSpecialFolders && keepArranged)
            return;

        let deltaX;
        let deltaY;

        if (!this.Prefs.freePositionIcons) {
            deltaX = xDestination - xOrigin;
            deltaY = yDestination - yOrigin;
        } else {
            deltaX = xDestination - xOrigin - this.localDragOffset[0] * 2;
            deltaY = yDestination - yOrigin - this.localDragOffset[1];
        }

        const fileItems = [];
        for (let item of this._fileList) {
            if (item.isSelected) {
                if (keepArranged) {
                    if (item.isSpecial) {
                        fileItems.push(item);
                        item.removeFromGrid({callOnDestroy: false});
                        let [x, y] = item.getCoordinates().slice(0, 3);
                        item.temporarySavedPosition = [x + deltaX, y + deltaY];
                    } else {
                        continue;
                    }
                } else {
                    fileItems.push(item);
                    item.removeFromGrid({callOnDestroy: false});
                    let [x, y] = item.getCoordinates().slice(0, 3);
                    item.temporarySavedPosition = [x + deltaX, y + deltaY];
                }
            }
        }
        // force to store the new coordinates
        this._addFilesToDesktop(fileItems, this.Enums.StoredCoordinates.OVERWRITE);
        if (keepArranged) {
            this._updateDesktop().catch(e => {
                console.log(`Exception while doing move with drag and drop and "Keep arranged…": ${e.message}\n${e.stack}`);
            });
        }
    }

    onDragBegin(item) {
        this.saveCurrentFileCoordinatesForUndo();
        this.dragItem = item;
        this._stopGnomeShellDrag();
    }

    onDragMotion(X, Y) {
        if (this.dragItem === null) {
            for (let desktop of this._desktops)
                desktop.refreshDrag([[0, 0]], X, Y);

            return;
        }
        if (this._dragList === null) {
            let itemList = this.getCurrentSelection(false);
            if (!itemList)
                return;

            let [x1, y1] = this.dragItem.getCoordinates().slice(0, 3);
            let oX = x1;
            let oY = y1;
            this._dragList = [];
            for (let item of itemList) {
                [x1, y1] = item.getCoordinates().slice(0, 3);
                this._dragList.push([x1 - oX, y1 - oY]);
            }
        }
        for (let desktop of this._desktops)
            desktop.refreshDrag(this._dragList, X, Y);
        this._stopGnomeShellDrag();
    }

    onDragLeave() {
        this._dragList = null;
        for (let desktop of this._desktops)
            desktop.refreshDrag(null, 0, 0);
        // Synthesise, extrapolate drag motion on a shell actor
        this._startGnomeShellDrag();
    }

    onDragEnd() {
        this.dragItem = null;
        this._stopGnomeShellDrag();
    }

    _startGnomeShellDrag() {
        if (!this._localDrag() && this.dragItem && !this.gnomeShellDrag)
            this.gnomeShellDrag = new GnomeShellDragDrop.GnomeShellDrag(this);
    }

    _stopGnomeShellDrag() {
        this.gnomeShellDrag?.destroy();
        this.gnomeShellDrag = null;
    }

    makeFileListFromSelection(dropData, acceptFormat) {
        if (!dropData)
            return null;
        if (acceptFormat === this.Enums.DndTargetInfo.TEXT_PLAIN)
            return null;

        let fileList;

        if (acceptFormat === this.Enums.DndTargetInfo.GNOME_ICON_LIST) {
            fileList = GLib.Uri.list_extract_uris(dropData);
        } else if (acceptFormat === this.Enums.DndTargetInfo.DING_ICON_LIST) {
            fileList = dropData.get_files().map(f => f.get_uri());
        } else {
            const spaceSlashParse = /\s\//;
            fileList = dropData.slice(1).split(spaceSlashParse).map(f => `file:///${f}`);
        }

        if (fileList && fileList.length)
            return fileList;
        else
            return null;
    }

    _localDrag() {
        let localDrag = false;
        this._desktops.forEach(d => {
            if (d.localDrag)
                localDrag = true;
        });
        return localDrag;
    }

    _positiveOffsetGridAim(xGlobalDestination, yGlobalDestination) {
        // Find the grid where the destination lies and aim towards the positive side, middle of grid to ensure drop in the grid
        for (let desktop of this._desktops) {
            let grid = desktop.getCoordinatesOfGridContaining(xGlobalDestination, yGlobalDestination, true);
            if (grid !== null) {
                xGlobalDestination = grid[0] + desktop._elementWidth / 2;
                yGlobalDestination = grid[1] + desktop._elementHeight / 2;
                break;
            }
        }
        return [xGlobalDestination, yGlobalDestination];
    }

    async onDragDataReceived(xGlobalDestination, yGlobalDestination, xlocalDestination, ylocalDestination, dropData, acceptFormat, gdkDropAction, localDrop, event, dragItem) {
        this.onDragLeave();

        let dropCoordinates;
        let xOrigin;
        let yOrigin;
        const forceCopy = gdkDropAction === Gdk.DragAction.COPY;
        const fileList = this.makeFileListFromSelection(dropData, acceptFormat);

        if (!this.Prefs.freePositionIcons)
            [xGlobalDestination, yGlobalDestination] = this._positiveOffsetGridAim(xGlobalDestination, yGlobalDestination);

        let returnAction;
        switch (acceptFormat) {
        case this.Enums.DndTargetInfo.DING_ICON_LIST:
            [xOrigin, yOrigin] = dragItem.getCoordinates().slice(0, 3);
            if (gdkDropAction === Gdk.DragAction.MOVE) {
                this.doMoveWithDragAndDrop(xOrigin, yOrigin, xGlobalDestination, yGlobalDestination);
                returnAction = Gdk.DragAction.MOVE;
                break;
            }
        // eslint-disable-next-line no-fallthrough
        case this.Enums.DndTargetInfo.GNOME_ICON_LIST:
        case this.Enums.DndTargetInfo.URI_LIST:
            if (!fileList)
                return;
            if (gdkDropAction === Gdk.DragAction.MOVE || gdkDropAction === Gdk.DragAction.COPY) {
                try {
                    if (!localDrop)
                        await this.clearFileCoordinates(fileList, [xGlobalDestination, yGlobalDestination], {doCopy: forceCopy});
                    returnAction = await this.copyOrMoveUris(fileList,
                        this._desktopDir.get_uri(), event, {forceCopy});
                } catch (e) {
                    console.error(e);
                }
            } else {
                if (gdkDropAction >= Gdk.DragAction.LINK)
                    returnAction = Gdk.DragAction.LINK;
                else
                    returnAction = Gdk.DragAction.COPY;
                this.askWhatToDoWithFiles(fileList, this._desktopDir.get_uri(),
                    xGlobalDestination, yGlobalDestination, xlocalDestination, ylocalDestination, event).catch(e => {
                    logError(e);
                });
            }
            break;
        case this.Enums.DndTargetInfo.TEXT_PLAIN:
            returnAction = Gdk.DragAction.COPY;
            dropCoordinates = [xGlobalDestination, yGlobalDestination];
            this.detectURLorText(dropData, dropCoordinates);
            break;
        default:
            returnAction = Gdk.DragAction.COPY;
        }
        // eslint-disable-next-line consistent-return
        return returnAction;
    }

    onTextDrop(dropData, [xGlobalDestination, yGlobalDestination]) {
        this.detectURLorText(dropData, [xGlobalDestination, yGlobalDestination]);
    }

    async askWhatToDoWithFiles(fileList, destinationuri, X, Y, x, y, event, opts = {desktopactions: true}) {
        const window = this.mainApp.get_active_window();
        this.textEntryAccelsTurnOff();
        const chooser = new Gtk.AlertDialog();
        chooser.set_message(_('Choose Action for Files'));
        chooser.buttons = [_('Move'), _('Copy'), _('Link'), _('Cancel')];
        chooser.set_modal(false);
        chooser.set_cancel_button(3);
        chooser.set_default_button(3);
        const cancellable = Gio.Cancellable.new();
        if (this.dialogCancellable)
            this.dialogCancellable.cancel();
        this.dialogCancellable = cancellable;
        const showdialog = new Promise(resolve => {
            chooser.choose(window, cancellable, async (actor, choice) => {
                let retval = Gtk.ResponseType.CANCEL;
                try {
                    const buttonpress = actor.choose_finish(choice);
                    switch (buttonpress) {
                    case 0:
                        retval = Gdk.DragAction.MOVE;
                        try {
                            if (opts.desktopactions)
                                await this.clearFileCoordinates(fileList, [X, Y]);

                            let forceCopy = false;
                            await this.copyOrMoveUris(fileList,
                                destinationuri, event, {forceCopy});
                        } catch {
                            console.error('Error moving files');
                        }
                        break;
                    case 1:
                        retval = Gdk.DragAction.COPY;
                        try {
                            if (opts.desktopactions)
                                await this.clearFileCoordinates(fileList, [X, Y], {dopCopy: true});

                            let forceCopy = true;
                            await this.copyOrMoveUris(fileList,
                                destinationuri, event, {forceCopy});
                        } catch {
                            console.error('Error copying files');
                        }
                        break;
                    case 2:
                        retval = Gdk.DragAction.LINK;
                        try {
                            if (opts.desktopactions)
                                await this.makeLinks(fileList, destinationuri, X, Y);
                            else
                                this.makeFileSystemLinks(fileList, destinationuri);
                        } catch {
                            console.error('Error making links');
                        }
                        break;
                    default:
                        retval = Gtk.ResponseType.CANCEL;
                    }
                    resolve(retval);
                } catch (e) {
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        console.error(e, `Error asking choosing what to do with Files ${e.message}`);
                    resolve(retval);
                }
            });
        });
        const retval = await showdialog.catch(e => logError(e));
        this.dialogCancellable = null;
        this.textEntryAccelsTurnOn();
        return retval;
    }

    makeFileSystemLinks(fileList, destination) {
        let gioDestination = Gio.File.new_for_uri(destination);
        fileList.forEach(file => {
            const fileGio = Gio.File.new_for_uri(file);
            const baseNameParts = this.DesktopIconsUtil.getFileExtensionOffset(fileGio.get_basename());
            let i = 0;
            let newSymlinkName = fileGio.get_basename();
            let checkSymlinkGio;
            do {
                checkSymlinkGio = Gio.File.new_for_commandline_arg(GLib.build_filenamev([gioDestination.get_path(), newSymlinkName]));
                try {
                    checkSymlinkGio.make_symbolic_link(GLib.build_filenamev([fileGio.get_path()]), null);
                    break;
                } catch (e) {
                    if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
                        i += 1;
                        newSymlinkName = `${baseNameParts.basename} ${i}${baseNameParts.extension}`;
                    } else {
                        console.error(e, 'Error making file-system links');
                        const header = _('Making SymLink Failed');
                        const text = _('Could not create symbolic link');
                        this.dbusManager.doNotify(header, text);
                        break;
                    }
                }
            } while (true);
        });
    }

    async makeLinks(fileList, destination, X, Y) {
        let gioDestination = Gio.File.new_for_uri(destination);
        await Promise.all(fileList.map(async file => {
            const fileGio = Gio.File.new_for_uri(file);
            const newSymlinkName = this.getDesktopUniqueFileName(fileGio.get_basename());
            const symlinkGio = Gio.File.new_for_commandline_arg(GLib.build_filenamev([gioDestination.get_path(), newSymlinkName]));
            try {
                if (symlinkGio.make_symbolic_link(GLib.build_filenamev([fileGio.get_path()]), null)) {
                    let info = new Gio.FileInfo();
                    info.set_attribute_string('metadata::nautilus-drop-position', `${X},${Y}`);
                    info.set_attribute_string('metadata::nautilus-icon-position', '');
                    try {
                        await symlinkGio.set_attributes_async(info,
                            Gio.FileQueryInfoFlags.NONE,
                            GLib.PRIORITY_LOW,
                            null);
                    } catch (e) {
                        console.error(e, 'Error setting link FileInfo');
                    }
                }
            } catch {
                console.error('Error making desktop links');
                const header = _('Making SymLink Failed');
                const text = _('Could not create symbolic link');
                this.dbusManager.doNotify(header, text);
            }
        }));
    }

    async _getFsId(file) {
        const info = await file.query_info_async('id::filesystem',
            Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null);
        return info.get_attribute_string('id::filesystem');
    }

    async desktopFsId() {
        if (this._desktopFsId === undefined)
            this._desktopFsId = await this._getFsId(this._desktopDir);

        return this._desktopFsId;
    }

    async copyOrMoveUris(uriList, destinationUri, event, params = {}) {
        if (params.forceCopy) {
            this.DBusUtils.RemoteFileOperations.pushEvent(event);
            this.DBusUtils.RemoteFileOperations.CopyURIsRemote(uriList, destinationUri);
            return Gdk.DragAction.COPY;
        }

        const moveFiles = [];
        const copyFiles = [];
        await Promise.all(uriList.map(async uri => {
            const f = Gio.File.new_for_uri(uri);
            if (await this.desktopFsId() === await this._getFsId(f))
                moveFiles.push(uri);
            else
                copyFiles.push(uri);
        }));

        if (moveFiles.length) {
            this.DBusUtils.RemoteFileOperations.pushEvent(event);
            this.DBusUtils.RemoteFileOperations.MoveURIsRemote(moveFiles, destinationUri);
        }

        if (copyFiles.length) {
            this.DBusUtils.RemoteFileOperations.pushEvent(event);
            this.DBusUtils.RemoteFileOperations.CopyURIsRemote(copyFiles, destinationUri);
        }

        return moveFiles.length ? Gdk.DragAction.MOVE : Gdk.DragAction.COPY;
    }

    async detectURLorText(dropData, dropCoordinates) {
        /**
         * Checks to see if a string is a URL
         *
         * @param {string} str A text URL
         * @returns {boolean} if the string is a URL
         */
        function isValidURL(str) {
            var pattern = new RegExp('^(https|http|ftp|rtsp|mms)?:\\/\\/?' +
            '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
            '((\\d{1,3}\\.){3}\\d{1,3}))' +
            '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
            '(\\?[;&a-z\\d%_.~+=-]*)?' +
            '(\\#[-a-z\\d_]*)?$', 'i');
            return !!pattern.test(str);
        }
        let text = dropData.toString();
        if (text === '')
            return;
        if (isValidURL(text)) {
            await this.writeURLlinktoDesktop(text, dropCoordinates);
        } else {
            let filename = 'Dragged Text';
            let now = Date().valueOf().split(' ').join('').replace(/:/g, '-');
            filename = `${filename}-${now}`;
            await this.DesktopIconsUtil.writeTextFileToPath(text, this._desktopDir,
                filename, dropCoordinates);
        }
    }

    async writeURLlinktoDesktop(link, dropCoordinates) {
        let filename = link.split('?')[0];
        filename = filename.split('//')[1];
        filename = filename.split('/')[0];
        let now = Date().valueOf().split(' ').join('').replace(/:/g, '-');
        filename = `${filename}-${now}`;
        await this.writeHTMLTypeLink(filename, link, dropCoordinates);
    }


    async writeHTMLTypeLink(filename, link, dropCoordinates) {
        filename += '.html';
        let body = ['<html>', '<head>', `<meta http-equiv="refresh" content="0; url=${link}" />`, '</head>', '<body>', '</body>', '</html>'];
        body = body.join('\n');
        await this.DesktopIconsUtil.writeTextFileToPath(body, this._desktopDir,
            filename, dropCoordinates);
    }

    fillDragDataGet(info) {
        let fileList = this.getCurrentSelection(false);
        if (fileList === null)
            return null;

        let data = '';
        for (let fileItem of fileList) {
            data += fileItem.uri;
            if (info === this.Enums.DndTargetInfo.GNOME_ICON_LIST) {
                let coordinates = fileItem.getCoordinates();
                if (coordinates !== null)
                    data += `\r${coordinates[0]}:${coordinates[1]}:${coordinates[2] - coordinates[0] + 1}:${coordinates[3] - coordinates[1] + 1}`;
            }
            data += '\r\n';
        }
        return data;
    }

    closePopUps() {
        if (this._renameWindow) {
            this._renameWindow.close();
            return true;
        }
        if (this.dialogCancellable) {
            this.dialogCancellable.cancel();
            this.dialogCancellable = null;
            return true;
        }
        return false;
    }

    async onPressButton(X, Y, x, y, button, shiftPressed, controlPressed, grid) {
        this._clickX = Math.floor(X);
        this._clickY = Math.floor(Y);

        if (button === 1) {
            if (!shiftPressed && !controlPressed) {
                // clear selection
                this.unselectAll();
            }
            this._startRubberband(X, Y);
        }

        if (button === 3) {
            await this._updateClipboard().catch(e => console.error(e, 'Error updating Clipboard'));
            this._createDesktopBackgroundGioMenu();
            this.popupmenu = Gtk.PopoverMenu.new_from_model(this.desktopBackgroundGioMenu);
            this.popupmenu.set_parent(grid._container);
            const menuLocation = new Gdk.Rectangle({x, y, width: 1, height: 1});
            this.popupmenu.set_pointing_to(menuLocation);
            const menuGtkPosition = grid.getIntelligentPosition(menuLocation);
            if (menuGtkPosition)
                this.popupmenu.set_position(menuGtkPosition);

            this.popupmenu.set_has_arrow(false);
            this.popupmenu.popup();
            this.popupmenu.connect('closed', async () => {
                await this.DesktopIconsUtil.waitDelayMs(50);
                this.popupmenu.unparent();
                this.popupmenu = null;
                if (this.popupmenuclosed)
                    this.popupmenuclosed(true);
            });
        }
    }

    _updateClipboard() {
        return new Promise(resolve => {
            let clipboard = Gdk.Display.get_default().get_clipboard();
            this._isCut = false;
            this._clipboardFiles = null;
            /*
             * Before Gnome Shell 40, St API couldn't access binary data in the clipboard, only text data. Also, the
             * original Desktop Icons was a pure extension, so it was limited to what Clutter and St offered. That was
             * the reason why Nautilus accepted a text format for CUT and COPY operations in the form
             *
             *     x-special/nautilus-clipboard
             *     OPERATION
             *     FILE_URI
             *     [FILE_URI]
             *     [...]
             *
             * In Gnome Shell 40, St was enhanced and now it supports binary data; that's why Nautilus migrated to a
             * binary format identified by the atom 'x-special/gnome-copied-files', where the CUT or COPY operation is
             * shared.
             *
             * To maintain compatibility, we first check if there's binary data in that atom, and if not, we check if
             * there is text data in the old format.
             */
            let text = null;
            let textDecoder = new TextDecoder();
            if (clipboard.get_formats()) {
                let mimetypes = clipboard.get_formats().to_string();
                if (mimetypes.includes('x-special/gnome-copied-files')) {
                    try {
                        clipboard.read_async(['x-special/gnome-copied-files'], GLib.PRIORITY_DEFAULT, null, (actor, result) => {
                            try {
                                let success = actor.read_finish(result);
                                let bytes = success[0].read_bytes(8192, null);
                                text = textDecoder.decode(bytes.get_data());
                                text = `x-special/nautilus-clipboard\n${text}\n`;
                                this._setClipboardContent(text);
                                resolve(true);
                            } catch (e) {
                                console.log(`Exception while reading clipboard: ${e.message}\n${e.stack}`);
                                this._setClipboardContent(text);
                                resolve(false);
                            }
                        });
                    } catch (e) {
                        console.log(`Exception while reading clipboard mimetype x-special/gnome-copied-files: ${e.message}\n${e.stack}`);
                        this._setClipboardContent(text);
                        resolve(false);
                    }
                } else if (mimetypes.includes('text/plain')) {
                    try {
                        clipboard.read_async(['text/plain'], GLib.PRIORITY_DEFAULT, null, (actor, result) => {
                            try {
                                let success = actor.read_finish(result);
                                let bytes = success[0].read_bytes(8192, null);
                                text = textDecoder.decode(bytes.get_data());
                                if (text && !text.endsWith('\n'))
                                    text += '\n';

                                this._setClipboardContent(text);
                                resolve(true);
                            } catch (e) {
                                this._setClipboardContent(text);
                                resolve(false);
                            }
                        });
                    } catch (e) {
                        console.log(`Exception while reading clipboard media-type "text/plain": ${e.message}\n${e.stack}`);
                        this._setClipboardContent(text);
                        resolve(false);
                    }
                } else {
                    this._setClipboardContent(text);
                    resolve(false);
                }
            } else {
                this._setClipboardContent(text);
                resolve(false);
            }
        });
    }

    _setClipboardContent(text) {
        let [valid, isCut, files] = this._parseClipboardText(text);
        if (valid) {
            this._isCut = isCut;
            this._clipboardFiles = files;
        }
        this.doPasteSimpleAction.set_enabled(valid);
    }

    _syncUndoRedo(hide = false) {
        if (hide) {
            this._undoMenuItem.hide();
            this._redoMenuItem.hide();
            return;
        }
        switch (this.DBusUtils.RemoteFileOperations.UndoStatus()) {
        case this.Enums.UndoStatus.UNDO:
            this.doUndoSimpleAction.set_enabled(true);
            this.doRedoSimpleAction.set_enabled(false);
            break;
        case this.Enums.UndoStatus.REDO:
            this.doUndoSimpleAction.set_enabled(false);
            this.doRedoSimpleAction.set_enabled(true);
            break;
        default:
            this.doUndoSimpleAction.set_enabled(false);
            this.doRedoSimpleAction.set_enabled(false);
            break;
        }
    }

    _undoStatusChanged(proxy, properties) {
        if ('UndoStatus' in properties.deep_unpack())
            this._syncUndoRedo();
    }

    _doUndo() {
        this.DBusUtils.RemoteFileOperations.UndoRemote();
    }

    _doRedo() {
        this.DBusUtils.RemoteFileOperations.RedoRemote();
    }

    onKeyPress(keyval, keycode, state, grid) {
        this.keyEventGrid = grid;
        if (this.popupmenu || this.fileItemMenu.popupmenu)
            return true;

        if (this.ignoreKeys.includes(keyval))
            return true;

        let key = String.fromCharCode(Gdk.keyval_to_unicode(keyval));
        if (this.keypressTimeoutID && this.searchString)
            this.searchString = this.searchString.concat(key);
        else
            this.searchString = key;

        if (this.searchString !== '') {
            let found = this.scanForFiles(this.searchString, false);
            if (found) {
                if ((this.getNumberOfSelectedItems() >= 1) && !this.keypressTimeoutID) {
                    const secondaryText = null;
                    const modal = true;
                    const timoutClose = 2000; // In ms
                    const errorDialog = this.showError(
                        _('Clear current selection before new search'),
                        secondaryText,
                        modal
                    );
                    errorDialog.timeoutClose(timoutClose);
                    return true;
                }
                this.searchEventTime = GLib.get_monotonic_time();
                if (!this.keypressTimeoutID) {
                    this.keypressTimeoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                        if (GLib.get_monotonic_time() - this.searchEventTime < 1500000)
                            return true;

                        this.searchString = null;
                        this.keypressTimeoutID = null;
                        if (this._findFileWindow)
                            this._findFileWindow.response(Gtk.ResponseType.OK);

                        return false;
                    });
                }
                this.findFiles(this.searchString);
            }
            return true;
        } else {
            return false;
        }
    }

    unselectAll() {
        this._fileList.map(f => f.unsetSelected());
        this.activeFileItem = this.fileItemMenu.activeFileItem = null;
    }

    findFiles(text) {
        const activeWindow = this.mainApp.get_active_window();
        this._findFileWindow = new Gtk.Dialog({
            use_header_bar: true,
            resizable: false,
        });
        this._findFileButton = this._findFileWindow.add_button(_('OK'), Gtk.ResponseType.OK);
        this._findFileButton.sensitive = false;
        this._findFileWindow.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        this._findFileWindow.set_modal(true);
        this._findFileWindow.set_title(_('Find Files on Desktop'));
        const modal = true;
        this.DesktopIconsUtil.windowHidePagerTaskbarModal(this._findFileWindow, modal);
        this._findFileWindow.set_transient_for(activeWindow);
        let contentArea = this._findFileWindow.get_content_area();
        this._findFileTextArea = new Gtk.Entry();
        this._findFileTextArea.set_margin_top(5);
        this._findFileTextArea.set_margin_bottom(5);
        this._findFileTextArea.set_margin_start(5);
        this._findFileTextArea.set_margin_end(5);
        contentArea.append(this._findFileTextArea);
        contentArea.set_homogeneous(true);
        contentArea.set_baseline_position(Gtk.BaselinePosition.CENTER);
        this._findFileTextArea.connect('activate', () => {
            if (this._findFileButton.sensitive)
                this._findFileWindow.response(Gtk.ResponseType.OK);
        });
        this._findFileTextArea.connect('changed', () => {
            let context = this._findFileTextArea.get_style_context();
            if (this.scanForFiles(this._findFileTextArea.text, true)) {
                this._findFileButton.sensitive = true;
                if (context.has_class('not-found'))
                    context.remove_class('not-found');
            } else {
                this._findFileButton.sensitive = false;
                this._findFileTextArea.error_bell();
                if (!context.has_class('not-found'))
                    context.add_class('not-found');
            }
            this.searchEventTime = GLib.get_monotonic_time();
        });
        this._findFileTextArea.grab_focus_without_selecting();
        if (text) {
            this._findFileTextArea.set_text(text);
            this._findFileTextArea.set_position(text.length);
        } else {
            this.scanForFiles(null);
        }
        this._findFileWindow.show();
        this.textEntryAccelsTurnOff();
        this._findFileWindow.connect('close', () => {
            this._findFileWindow.response(Gtk.ResponseType.CANCEL);
        });
        this._findFileWindow.connect('response', (actor, retval) => {
            if (retval === Gtk.ResponseType.CANCEL)
                this.unselectAll();

            this.textEntryAccelsTurnOn();
            this._findFileWindow.destroy();
            this._findFileWindow = null;
        });
    }

    scanForFiles(text, setselected) {
        let found = [];
        if (text && (text !== ''))
            found = this._fileList.filter(f => f.fileName.toLowerCase().includes(text.toLowerCase()) || f._label.get_text().toLowerCase().includes(text.toLowerCase()));

        if (found.length !== 0) {
            if (setselected) {
                this.unselectAll();
                found.map(f => f.setSelected());
            }
            return true;
        } else {
            return false;
        }
    }

    _createMenuActionGroup() {
        let newFolder = Gio.SimpleAction.new('doNewFolder', null);
        newFolder.connect('activate', () => {
            this.doNewFolder().catch(e => console.error(e));
        });
        this.mainApp.add_action(newFolder);
        this.mainApp.set_accels_for_action('app.doNewFolder', ['<Control><Shift>N']);

        this.doPasteSimpleAction = Gio.SimpleAction.new('doPaste', null);
        this.doPasteSimpleAction.connect('activate', async () => {
            try {
                if (!(this.popupmenu || this.fileItemMenu.popupmenu))
                    await this._updateClipboard().catch(e => logError(e));

                this._doPaste();
            } catch (e) {
                console.error(e, 'Paste action failed');
            }
        });
        this.mainApp.add_action(this.doPasteSimpleAction);
        this.mainApp.set_accels_for_action('app.doPaste', ['<Control>V']);

        this.doUndoSimpleAction = Gio.SimpleAction.new('doUndo', null);
        this.doUndoSimpleAction.connect('activate', () => {
            this._doUndo();
        });
        this.mainApp.add_action(this.doUndoSimpleAction);
        this.mainApp.set_accels_for_action('app.doUndo', ['<Control>Z']);

        this.doRedoSimpleAction = Gio.SimpleAction.new('doRedo', null);
        this.doRedoSimpleAction.connect('activate', () => {
            this._doRedo();
        });
        this.mainApp.add_action(this.doRedoSimpleAction);
        this.mainApp.set_accels_for_action('app.doRedo', ['<Control><Shift>Z']);

        let selectAll = Gio.SimpleAction.new('selectAll', null);
        selectAll.connect('activate', () => {
            this._selectAll();
        });
        this.mainApp.add_action(selectAll);
        this.mainApp.set_accels_for_action('app.selectAll', ['<Control>A']);

        let showDesktopInFiles = Gio.SimpleAction.new('showDesktopInFiles', null);
        showDesktopInFiles.connect('activate', this._onOpenDesktopInFilesClicked.bind(this));
        this.mainApp.add_action(showDesktopInFiles);

        let openInTerminal = Gio.SimpleAction.new('openInTerminal', null);
        openInTerminal.connect('activate', this._onOpenTerminalClicked.bind(this));
        this.mainApp.add_action(openInTerminal);

        let changeBackGround = Gio.SimpleAction.new('changeBackGround', null);
        changeBackGround.connect('activate', () => {
            let desktopFile = Gio.DesktopAppInfo.new('gnome-background-panel.desktop');
            const context = Gdk.Display.get_default().get_app_launch_context();
            context.set_timestamp(Gdk.CURRENT_TIME);
            desktopFile.launch([], context);
        });
        this.mainApp.add_action(changeBackGround);

        let changeDisplaySettings = Gio.SimpleAction.new('changeDisplaySettings', null);
        changeDisplaySettings.connect('activate', () => {
            let desktopFile = Gio.DesktopAppInfo.new('gnome-display-panel.desktop');
            const context = Gdk.Display.get_default().get_app_launch_context();
            context.set_timestamp(Gdk.CURRENT_TIME);
            desktopFile.launch([], context);
        });
        this.mainApp.add_action(changeDisplaySettings);

        let changeDesktopIconSettings = Gio.SimpleAction.new('changeDesktopIconSettings', null);
        changeDesktopIconSettings.connect('activate', this._showPreferences.bind(this));
        this.mainApp.add_action(changeDesktopIconSettings);

        let cleanUpIconsAction = Gio.SimpleAction.new('cleanUpIcons', null);
        cleanUpIconsAction.connect('activate', () => this._sortAllFilesFromGridsByPosition());
        this.mainApp.add_action(cleanUpIconsAction);

        let keepArrangedAction = this.Prefs.desktopSettings.create_action('keep-arranged');
        this.mainApp.add_action(keepArrangedAction);
        this.Prefs.desktopSettings.bind('keep-arranged', cleanUpIconsAction, 'enabled', 16);
        this.mainApp.add_action(this.Prefs.desktopSettings.create_action('keep-stacked'));
        this.mainApp.add_action(this.Prefs.desktopSettings.create_action('sort-special-folders'));
        this.mainApp.add_action(this.Prefs.desktopSettings.create_action('arrangeorder'));

        let findFilesAction = Gio.SimpleAction.new('findFiles', null);
        findFilesAction.connect('activate', () => {
            this.findFiles(null);
        });
        this.mainApp.add_action(findFilesAction);
        this.mainApp.set_accels_for_action('app.findFiles', ['<Control>F']);

        let updateDesktop = Gio.SimpleAction.new('updateDesktop', null);
        updateDesktop.connect('activate', () => {
            this._updateDesktop().catch(e => {
                console.log(`Exception while updating desktop after pressing "F5": ${e.message}\n${e.stack}`);
            });
        });
        this.mainApp.add_action(updateDesktop);
        this.mainApp.set_accels_for_action('app.updateDesktop', ['F5']);

        let showHideHiddenFiles = Gio.SimpleAction.new('showHideHiddenFiles', null);
        showHideHiddenFiles.connect('activate', () => {
            this.Prefs.gtkSettings.set_boolean('show-hidden', !this.Prefs.showHidden);
        });
        this.mainApp.add_action(showHideHiddenFiles);
        this.mainApp.set_accels_for_action('app.showHideHiddenFiles', ['<Control>H']);

        let unselectAll = Gio.SimpleAction.new('unselectAll', null);
        unselectAll.connect('activate', () => {
            this.unselectAll();
            if (this.searchString)
                this.searchString = null;
        });
        this.mainApp.add_action(unselectAll);
        this.mainApp.set_accels_for_action('app.unselectAll', ['Escape']);

        let previewAction = Gio.SimpleAction.new('previewAction', null);
        previewAction.connect('activate', () => {
            if (this.popupmenu || this.fileItemMenu.popupmenu || !this.activeFileItem)
                return;

            this.DBusUtils.RemoteFileOperations.ShowFileRemote(this.activeFileItem.uri, 0, true);
        });
        this.mainApp.add_action(previewAction);
        this.mainApp.set_accels_for_action('app.previewAction', ['space']);

        let chooseIconLeft = Gio.SimpleAction.new('chooseIconLeft', null);
        chooseIconLeft.connect('activate', () => {
            this._selectFileItemInDirection(Gdk.KEY_Left);
        });
        this.mainApp.add_action(chooseIconLeft);
        this.mainApp.set_accels_for_action('app.chooseIconLeft', ['Left']);

        let chooseIconRight = Gio.SimpleAction.new('chooseIconRight', null);
        chooseIconRight.connect('activate', () => {
            this._selectFileItemInDirection(Gdk.KEY_Right);
        });
        this.mainApp.add_action(chooseIconRight);
        this.mainApp.set_accels_for_action('app.chooseIconRight', ['Right']);

        let chooseIconUp = Gio.SimpleAction.new('chooseIconUp', null);
        chooseIconUp.connect('activate', () => {
            this._selectFileItemInDirection(Gdk.KEY_Up);
        });
        this.mainApp.add_action(chooseIconUp);
        this.mainApp.set_accels_for_action('app.chooseIconUp', ['Up']);

        let chooseIconDown = Gio.SimpleAction.new('chooseIconDown', null);
        chooseIconDown.connect('activate', () => {
            this._selectFileItemInDirection(Gdk.KEY_Down);
        });
        this.mainApp.add_action(chooseIconDown);
        this.mainApp.set_accels_for_action('app.chooseIconDown', ['Down']);

        let menuKeyPressed = Gio.SimpleAction.new('menuKeyPressed', null);
        menuKeyPressed.connect('activate', () => {
            this._menuKeyPressed();
        });
        this.mainApp.add_action(menuKeyPressed);
        this.mainApp.set_accels_for_action('app.menuKeyPressed', ['Menu']);

        let displayShellBackgroundMenu = Gio.SimpleAction.new('displayShellBackgroundMenu', null);
        displayShellBackgroundMenu.connect('activate', () => {
            this.DBusUtils.RemoteExtensionControl.showShellBackgroundMenu();
        });
        this.mainApp.add_action(displayShellBackgroundMenu);
    }

    textEntryAccelsTurnOn() {
        this.mainApp.set_accels_for_action('app.previewAction', ['space']);
        this.mainApp.set_accels_for_action('app.unselectAll', ['Escape']);
        this.mainApp.set_accels_for_action('app.openOneFileAction', ['Return']);
        this.mainApp.set_accels_for_action('app.movetotrash', ['Delete']);
        this.mainApp.set_accels_for_action('app.chooseIconLeft', ['Left']);
        this.mainApp.set_accels_for_action('app.chooseIconRight', ['Right']);
        this.mainApp.set_accels_for_action('app.chooseIconUp', ['Up']);
        this.mainApp.set_accels_for_action('app.chooseIconDown', ['Down']);
        this.mainApp.set_accels_for_action('app.menuKeyPressed', ['Menu']);
    }

    textEntryAccelsTurnOff() {
        this.mainApp.set_accels_for_action('app.previewAction', ['']);
        this.mainApp.set_accels_for_action('app.unselectAll', ['']);
        this.mainApp.set_accels_for_action('app.openOneFileAction', ['']);
        this.mainApp.set_accels_for_action('app.movetotrash', ['']);
        this.mainApp.set_accels_for_action('app.chooseIconLeft', ['']);
        this.mainApp.set_accels_for_action('app.chooseIconRight', ['']);
        this.mainApp.set_accels_for_action('app.chooseIconUp', ['']);
        this.mainApp.set_accels_for_action('app.chooseIconDown', ['']);
        this.mainApp.set_accels_for_action('app.menuKeyPressed', ['']);
    }

    _createDesktopBackgroundGioMenu() {
        this.sortingRadioMenu = Gio.Menu.new();
        this.sortingRadioMenu.append(_('Name'), 'app.arrangeorder::NAME');
        this.sortingRadioMenu.append(_('Name Z-A'), 'app.arrangeorder::DESCENDINGNAME');
        this.sortingRadioMenu.append(_('Modified Time'), 'app.arrangeorder::MODIFIEDTIME');
        this.sortingRadioMenu.append(_('Type'), 'app.arrangeorder::KIND');
        this.sortingRadioMenu.append(_('Size'), 'app.arrangeorder::SIZE');

        this.sortingSubMenu = Gio.Menu.new();
        this.keepArrangedMenuItem = Gio.MenuItem.new(_('Keep Arranged…'), 'app.keep-arranged');
        if (!this.Prefs.keepStacked)
            this.sortingSubMenu.append_item(this.keepArrangedMenuItem);

        this.sortingSubMenu.append(_('Keep Stacked by Type…'), 'app.keep-stacked');
        this.sortingSubMenu.append(_('Sort Home/Drives/Trash…'), 'app.sort-special-folders');
        this.sortingSubMenu.append_section(null, this.sortingRadioMenu);

        this.desktopBackgroundGioMenu = Gio.Menu.new();

        this.desktopBackgroundGioMenu.append(_('New Folder'), 'app.doNewFolder');

        let templates = this.templatesMonitor.getGioMenu();
        if (!(templates === null))
            this.desktopBackgroundGioMenu.append_submenu(_('New Document'), templates);


        this.pasteUndoRedoMenu = Gio.Menu.new();
        this.pasteUndoRedoMenu.append(_('Paste'), 'app.doPaste');
        this.pasteUndoRedoMenu.append(_('Undo'), 'app.doUndo');
        this.pasteUndoRedoMenu.append(_('Redo'), 'app.doRedo');

        this.desktopBackgroundGioMenu.append_section(null, this.pasteUndoRedoMenu);

        this.selectAllMenu = Gio.Menu.new();
        this.selectAllMenu.append(_('Select All'), 'app.selectAll');

        this.desktopBackgroundGioMenu.append_section(null, this.selectAllMenu);

        this.sortingMenu = Gio.Menu.new();
        this.cleanUpMenuItem = Gio.MenuItem.new(_('Arrange Icons'), 'app.cleanUpIcons');
        if (!this.Prefs.keepStacked)
            this.sortingMenu.append_item(this.cleanUpMenuItem);

        this.arrangeSubMenuItem = Gio.MenuItem.new_submenu(_('Arrange By…'), this.sortingSubMenu);
        this.sortingMenu.append_item(this.arrangeSubMenuItem);
        this.desktopBackgroundGioMenu.append_section(null, this.sortingMenu);

        this.desktopTerminalMenu = Gio.Menu.new();
        const nautilusName = this.Prefs.NautilusName;
        this.desktopTerminalMenu.append(_('Show Desktop In {0}').replace('{0}', nautilusName),
            'app.showDesktopInFiles');
        const terminalString = this.Prefs.TerminalName;
        this.desktopTerminalMenu.append(_('Open In {0}').replace('{0}', terminalString),
            'app.openInTerminal');

        this.desktopBackgroundGioMenu.append_section(null, this.desktopTerminalMenu);

        this.settingsMenu = Gio.Menu.new();
        this.settingsMenu.append(_('Desktop Icon Settings'), 'app.changeDesktopIconSettings');

        this.desktopBackgroundGioMenu.append_section(null, this.settingsMenu);

        this.backgroundMenu = Gio.Menu.new();
        this.backgroundMenu.append(_('Shell Menu…'), 'app.displayShellBackgroundMenu');
        // Following deprectiated, Shell Menu has these options anyway
        // this.backgroundMenu.append(_('Change Background…'), 'app.changeBackGround');
        // this.backgroundMenu.append(_('Display Settings'), 'app.changeDisplaySettings');

        this.desktopBackgroundGioMenu.append_section(null, this.backgroundMenu);
    }

    _selectAll() {
        for (let fileItem of this._fileList) {
            if (fileItem.isAllSelectable)
                fileItem.setSelected();
        }
    }

    async _onOpenDesktopInFilesClicked() {
        const context = Gdk.Display.get_default().get_app_launch_context();
        context.set_timestamp(Gdk.CURRENT_TIME);
        try {
            await Gio.AppInfo.launch_default_for_uri_async(
                this._desktopDir.get_uri(), context, null);
        } catch (e) {
            console.error(e, `Error opening desktop in GNOME Files: ${e.message}`);
        }
    }

    _showPreferences() {
        if (this.preferencesWindow)
            return;

        let success = false;
        let completed = false;
        let process;
        let argv = ['/usr/bin/gnome-extensions', 'prefs', `${this.uuid}`];

        try {
            process = GLib.spawn_sync(null, argv, null,
                GLib.SpawnFlags.DEFAULT,
                () => {});
            completed = GLib.spawn_check_exit_status(process[3]);
            success = process[0];
        } catch (e) {
            let textDecoder = new TextDecoder();
            let errortext = textDecoder.decode(process[2]);
            let windowopen = errortext.includes('Already showing a prefs dialog');
            if (windowopen) {
                this.dbusManager.doNotify(_('Preferences Window is Open'), _('This Window is open. Please switch to the active window.'));
                return;
            } else {
                completed = false;
            }
        }

        if (success && completed)
            return;

        this.preferencesWindow = this.Prefs.getAdwPreferencesWindow();
        this.preferencesWindow.connect('close-request', () => {
            this.preferencesWindow = null;
        });
        this.preferencesWindow.set_title(_('Settings'));
        const modal = true;
        this.DesktopIconsUtil.windowHidePagerTaskbarModal(this.preferencesWindow, modal);
        this.preferencesWindow.show();
    }

    _onOpenTerminalClicked() {
        this.fileItemMenu.launchTerminal(null, null);
    }

    _selectFileItemInDirection(symbol) {
        var index;
        var multiplier;
        let selection = this.getCurrentSelection(false);
        if (!selection) {
            if (this.activeFileItem && this.activeFileItem.isStackMarker)
                selection = [this.activeFileItem];
            else
                selection = this._fileList;
        }
        if (!selection)
            return false;

        let selected = selection[0];
        let selectedCoordinates = selected.getCoordinates();
        if (!this.isShift)
            this.unselectAll();
        if (selection.length > 1) {
            for (let item of selection) {
                let itemCoordinates = item.getCoordinates();
                if (itemCoordinates[0] > selectedCoordinates[0])
                    continue;

                if (symbol === Gdk.KEY_Down || symbol === Gdk.KEY_Right) {
                    if ((itemCoordinates[0] > selectedCoordinates[0]) ||
                        (itemCoordinates[1] > selectedCoordinates[1])) {
                        selected = item;
                        selectedCoordinates = itemCoordinates;
                        continue;
                    }
                } else if ((itemCoordinates[0] < selectedCoordinates[0]) ||
                        (itemCoordinates[1] < selectedCoordinates[1])) {
                    selected = item;
                    selectedCoordinates = itemCoordinates;
                    continue;
                }
            }
        }
        switch (symbol) {
        case Gdk.KEY_Left:
            index = 0;
            multiplier = -1;
            break;
        case Gdk.KEY_Right:
            index = 0;
            multiplier = 1;
            break;
        case Gdk.KEY_Up:
            index = 1;
            multiplier = -1;
            break;
        case Gdk.KEY_Down:
            index = 1;
            multiplier = 1;
            break;
        }
        let newDistance = null;
        let newItem = null;
        for (let item of this._fileList) {
            let itemCoordinates = item.getCoordinates();
            if ((selectedCoordinates[index] * multiplier) >= (itemCoordinates[index] * multiplier))
                continue;

            let distance = Math.pow(selectedCoordinates[0] - itemCoordinates[0], 2) + Math.pow(selectedCoordinates[1] - itemCoordinates[1], 2);
            if ((newDistance === null) || (newDistance > distance)) {
                newDistance = distance;
                newItem = item;
            }
        }
        if (newItem === null)
            newItem = selected;

        newItem.setSelected();
        if (newItem.isStackMarker)
            newItem.keyboardSelected();

        this.activeFileItem = this.fileItemMenu.activeFileItem = newItem;
        return true;
    }

    _menuKeyPressed() {
        let selection = this.getCurrentSelection(false);
        if (selection) {
            let fileItem = selection[0];
            let X = fileItem.iconRectangle.x + fileItem.iconRectangle.width / 2;
            let Y = fileItem.iconRectangle.y + fileItem.iconRectangle.height / 2;
            this.fileItemMenu.showMenu(fileItem, 3, 0, 0, X, Y, false, false);
        } else {
            let grid = this._desktops.filter(f => f.coordinatesBelongToThisGrid(this.pointerX, this.pointerY));
            this.onPressButton(null, null, this.pointerX, this.pointerY, 3, false, false, grid[0]);
        }
    }

    _doPaste() {
        if (this._clipboardFiles === null)
            return;
        if (!this._clickX && !this._clickY)
            return;
        let pasteCoordinates = [this._clickX, this._clickY];
        let desktopDir = this._desktopDir.get_uri();

        if (this._isCut) {
            // This pops up GNOME Files error dialog, which is what we want.
            this.DBusUtils.RemoteFileOperations.MoveURIsRemote(this._clipboardFiles, desktopDir);
        } else {
            this.clearFileCoordinates(this._clipboardFiles, pasteCoordinates, {doCopy: true});
            this.DBusUtils.RemoteFileOperations.CopyURIsRemote(this._clipboardFiles, desktopDir);
        }
    }

    _parseClipboardText(text) {
        if (text === null)
            return [false, false, null];

        let lines = text.split('\n');
        let [mime, action, ...files] = lines;

        if (mime !== 'x-special/nautilus-clipboard')
            return [false, false, null];
        if (!['copy', 'cut'].includes(action))
            return [false, false, null];
        let isCut = action === 'cut';

        /* Last line is empty due to the split */
        if (files.length <= 1)
            return [false, false, null];
        /* Remove last line */
        files.pop();

        return [true, isCut, files];
    }

    drawSelectionRectangles() {
        for (let grid of this._desktops)
            grid.drawRubberBand();
    }

    onMotion(X, Y) {
        this.pointerX = X;
        this.pointerY = Y;
        if (this.rubberBand) {
            this.x1 = Math.min(X, this.rubberBandInitX);
            this.x2 = Math.max(X, this.rubberBandInitX);
            this.y1 = Math.min(Y, this.rubberBandInitY);
            this.y2 = Math.max(Y, this.rubberBandInitY);
            this.selectionRectangle = new Gdk.Rectangle({'x': this.x1, 'y': this.y1, 'width': this.x2 - this.x1, 'height': this.y2 - this.y1});
            this.drawSelectionRectangles();
            for (let item of this._fileList) {
                let labelintersect = item.labelRectangle.intersect(this.selectionRectangle)[0];
                let iconintersect = item.iconRectangle.intersect(this.selectionRectangle)[0];
                if (labelintersect || iconintersect) {
                    item.setSelected();
                    item.touchedByRubberband = true;
                } else if (item.touchedByRubberband) {
                    item.unsetSelected();
                }
            }
        }
    }

    onReleaseButton() {
        if (this.rubberBand) {
            this.rubberBand = false;
            this.selectionRectangle = null;
        }
        for (let grid of this._desktops)
            grid.drawRubberBand();

        return false;
    }

    _startRubberband(X, Y) {
        this.rubberBandInitX = X;
        this.rubberBandInitY = Y;
        this.rubberBand = true;
        for (let item of this._fileList)
            item.touchedByRubberband = false;
    }

    unHighLightDropTarget() {
        this._fileList.forEach(item => item.unHighLightDropTarget());
    }

    selected(fileItem, action) {
        switch (action) {
        case this.Enums.Selection.ALONE:
            if (!fileItem.isSelected) {
                for (let item of this._fileList) {
                    if (item === fileItem)
                        item.setSelected();
                    else
                        item.unsetSelected();
                }
            }
            break;
        case this.Enums.Selection.WITH_SHIFT:
            fileItem.toggleSelected();
            break;
        case this.Enums.Selection.RIGHT_BUTTON:
            if (!fileItem.isSelected) {
                for (let item of this._fileList) {
                    if (item === fileItem)
                        item.setSelected();
                    else
                        item.unsetSelected();
                }
            }
            break;
        case this.Enums.Selection.ENTER:
            if (this.rubberBand)
                fileItem.setSelected();

            break;
        case this.Enums.Selection.RELEASE:
            for (let item of this._fileList) {
                if (item === fileItem) {
                    if (item.isSelected)
                        item.setSelected();
                    else
                        item.unsetSelected();
                }
            }
            break;
        }
    }

    _removeAllFilesFromGrids() {
        for (let fileItem of this._fileList)
            fileItem.removeFromGrid({callOnDestroy: true});

        this._fileList = [];
    }

    async _updateDesktop() {
        if (this._readingDesktopFiles) {
            // just notify that the files changed while being read from the disk.
            this._desktopFilesChanged = true;
            if (this._desktopEnumerateCancellable && !this._forceDraw) {
                this._desktopEnumerateCancellable.cancel();
                this._desktopEnumerateCancellable = null;
            }
            return;
        }

        this._readingDesktopFiles = true;
        this._forceDraw = false;
        this._lastDesktopUpdateRequest = GLib.get_monotonic_time();
        let fileList;
        while (true) {
            this._desktopFilesChanged = false;
            try {
                // eslint-disable-next-line no-await-in-loop
                fileList = await this._doReadAsync();
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) {
                    fileList = [];
                    break;
                }

                throw e;
            }
            if (this._forcedExit)
                return;

            if (fileList !== null) {
                if (!this._desktopFilesChanged)
                    break;

                if (this._forceDraw) {
                    this._drawDesktop(fileList).catch(e => console.error(e));
                    this._lastDesktopUpdateRequest = GLib.get_monotonic_time();
                }
            }
            // eslint-disable-next-line no-await-in-loop
            await this.DesktopIconsUtil.waitDelayMs(500);
            if ((GLib.get_monotonic_time() - this._lastDesktopUpdateRequest) > 1000000)
                this._forceDraw = true;
            else
                this._forceDraw = false;
        }
        this._readingDesktopFiles = false;
        this._forceDraw = false;
        this._drawDesktop(fileList).catch(e => console.error(e));
    }

    async _doReadAsync() {
        if (this._desktopEnumerateCancellable)
            this._desktopEnumerateCancellable.cancel();


        const cancellable = new Gio.Cancellable();
        this._desktopEnumerateCancellable = cancellable;

        try {
            const fileList = [];

            const extraFoldersItems = this.DesktopIconsUtil.getExtraFolders().map(async ([newFolder, extras]) => {
                try {
                    if (imports.system.version < 17200)
                        Gio._promisify(newFolder.constructor.prototype, 'query_info_async');
                    const newFolderInfo = await newFolder.query_info_async(
                        this.Enums.DEFAULT_ATTRIBUTES, Gio.FileQueryInfoFlags.NONE,
                        GLib.PRIORITY_DEFAULT, cancellable);
                    fileList.push(new FileItem.FileItem(this,
                        newFolder,
                        newFolderInfo,
                        extras,
                        null));
                } catch (e) {
                    if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        throw e;
                    console.error(e, `Failed with ${e.message} while adding extra folder ${newFolder.get_uri()}`);
                }
            });

            const getLocalFilesInfos = async () => {
                const childrenInfo = await this.FileUtils.enumerateDir(this._desktopDir,
                    cancellable, GLib.PRIORITY_DEFAULT, this.Enums.DEFAULT_ATTRIBUTES);

                childrenInfo.forEach(info => {
                    const fileItem = new FileItem.FileItem(this,
                        this._desktopDir.get_child(info.get_name()),
                        info,
                        this.Enums.FileType.NONE,
                        null);
                    if (fileItem.isHidden && !this.Prefs.showHidden) {
                        /* if there are hidden files in the desktop and the user doesn't want to
                            show them, remove the coordinates. This ensures that if the user enables
                            showing them, they won't fight with other icons for the same place
                        */
                        if (fileItem.savedCoordinates) {
                            // only overwrite them if needed
                            fileItem.savedCoordinates = null;
                        }
                        return;
                    }
                    fileItem.savedCoordinates = fileItem.savedCoordinates ?? null;
                    fileItem.dropCoordinates = fileItem.dropCoordinates ?? null;
                    if (fileItem.savedCoordinates === null || fileItem.dropCoordinates === null) {
                        const basename = fileItem.file.get_basename();
                        this._checkBasenameInPending(fileItem, basename);
                    }
                    fileList.push(fileItem);
                });
            };

            const mountsItems = this.DesktopIconsUtil.getMounts(this._volumeMonitor).map(async ([newFolder, extras, volume]) => {
                try {
                    if (imports.system.version < 17200)
                        Gio._promisify(newFolder.constructor.prototype, 'query_info_async');
                    const newFolderInfo = await newFolder.query_info_async(
                        this.Enums.DEFAULT_ATTRIBUTES, Gio.FileQueryInfoFlags.NONE,
                        GLib.PRIORITY_DEFAULT, cancellable);
                    fileList.push(new FileItem.FileItem(this,
                        newFolder,
                        newFolderInfo,
                        extras,
                        volume));
                } catch (e) {
                    if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        throw e;
                    console.error(e, `Failed with ${e.message} while adding volume ${newFolder}`);
                }
            });

            await Promise.all([getLocalFilesInfos(), ...extraFoldersItems, ...mountsItems]);

            if (this._desktopFilesChanged && !this._forceDraw)
                return null;

            return fileList;
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                console.error(e, `Failed to read contents of ${this._desktopDir.get_path()}`);
            return null;
        } finally {
            if (cancellable === this._desktopEnumerateCancellable)
                this._desktopEnumerateCancellable = null;
        }
    }

    _checkBasenameInPending(fileItem, basename) {
        if (basename in this._pendingSelfCopyFiles) {
            if (fileItem.savedCoordinates === null)
                fileItem.savedCoordinates = this._pendingSelfCopyFiles[basename];
            delete this._pendingSelfCopyFiles[basename];
            return;
        }
        if (basename in this._pendingDropFiles) {
            fileItem.dropCoordinates = this._pendingDropFiles[basename];
            delete this._pendingDropFiles[basename];
            return;
        }
        const regex = /\(.*\)[^()]*$/;
        let basenameStart;
        let lastParenthesisPosition = basename.search(regex);
        if (lastParenthesisPosition > 1) {
            basenameStart = basename.slice(0, lastParenthesisPosition - 1);
            if (basenameStart) {
                for (let fileName of Object.keys(this._pendingDropFiles)) {
                    if (fileName.startsWith(basenameStart)) {
                        fileItem.dropCoordinates = this._pendingDropFiles[fileName];
                        delete this._pendingDropFiles[fileName];
                    }
                }
            }
        }
    }

    async _drawDesktop(fileList) {
        const selectedFiles = this.getCurrentSelection(true);

        //* Update the Icon before placing on Desktop to prevent flickering Icons *//
        const updateUI = fileList.map(async fileItem => {
            await fileItem.updateIcon();
            if (selectedFiles) {
                if (selectedFiles.includes(fileItem.uri))
                    fileItem.setSelected();
            }
        });
        await Promise.all([...updateUI]);

        this._removeAllFilesFromGrids();
        this._fileList = fileList;

        this._placeAllFilesOnGrids();

        //* Detect all Icon sizes are allocated and Icons are now shown and placed on Grid *//
        //* Desktop draw/paint is now complete *//
        const drawComplete = this._fileList.map(async fileItem => {
            await fileItem.iconPlaced;
        });
        await Promise.all([...drawComplete]);

        //* Reposition open Menus, renameFileItem pop up's **//
        //* Any task after complete desktop draw can now be done *//
        this._refreshMenus();
    }

    _refreshMenus() {
        if ((this.newItemDoRename && this.newItemDoRename.size) || this.fileItemMenu.popupmenu || this.activeFileItem) {
            let activeItem = false;
            let newItemDoRename = false;
            this._fileList.forEach(f => {
                if (this.activeFileItem && (f.fileName === this.activeFileItem.fileName))
                    this.fileItemMenu.activeFileItem = this.activeFileItem = activeItem = f;

                if (this.newItemDoRename && this.newItemDoRename.has(f.fileName))
                    newItemDoRename = f;
            });
            if (this._renameWindow)
                this._renameWindow.close();
            if (newItemDoRename) {
                newItemDoRename.setSelected();
                const allowReturnOnSameName = true;
                this.doRename(newItemDoRename, allowReturnOnSameName).catch(e => logError(e));
            }
            if (this.fileItemMenu.popupmenu) {
                if (!activeItem)
                    this.fileItemMenu.popupmenu.popdown();
            }
        }
    }

    _placeAllFilesOnGrids(opts = {redisplay: false}) {
        if (this.Prefs.keepStacked) {
            this.doStacks(opts);
            return;
        }
        if (this.Prefs.keepArranged) {
            this.doSorts(opts);
            return;
        }
        if (opts.redisplay)
            this._sortByCurrentPosition();
        const storeMode = this.Enums.StoredCoordinates.PRESERVE;
        this._addFilesToDesktop(this._fileList, storeMode);
    }

    _addFilesToDesktop(fileList, storeMode) {
        let preferredDesktop = this._getPreferredDisplayDesktop();
        if (!preferredDesktop)
            return;
        let outOfDesktops = [];
        let notAssignedYet = [];
        let droppedFiles = [];

        // First, add those icons that have saved coordinates and fit in the current desktops
        for (let fileItem of fileList) {
            if (fileItem.savedCoordinates === null) {
                if (fileItem.dropCoordinates !== null)
                    droppedFiles.push(fileItem);
                else
                    notAssignedYet.push(fileItem);
                continue;
            }
            if (fileItem.dropCoordinates !== null)
                fileItem.dropCoordinates = null;

            let [itemX, itemY] = fileItem.savedCoordinates;
            let addedToDesktop = false;
            for (let desktop of this._desktops) {
                if (desktop.fileItemRectangleFitsThisGrid(itemX, itemY) &&
                        desktop.isAvailable()) {
                    addedToDesktop = true;
                    desktop.addFileItemCloseTo(fileItem, itemX, itemY, storeMode);
                    break;
                }
            }

            if (!addedToDesktop)
                outOfDesktops.push(fileItem);
        }

        // Now, assign icons that have landed in changed margins, belong to monitor
        // and the window, however no longer fit on the grid as they overlap margins.

        if (outOfDesktops.length) {
            const unassigned = [];
            for (let fileItem of outOfDesktops) {
                let addedToDesktop = false;
                let [itemX, itemY] = fileItem.savedCoordinates;
                for (let desktop of this._desktops) {
                    if (desktop.coordinatesBelongToThisGridWindow &&
                            desktop.isAvailable()) {
                        addedToDesktop = true;
                        desktop.addFileItemCloseTo(fileItem, itemX, itemY, storeMode);
                        break;
                    }
                }

                if (!addedToDesktop)
                    unassigned.push(fileItem);
            }

            // Now, assign those icons that are outside the all current monitors, or do not
            // have space on current monitor, but have assigned saved coordinates
            if (unassigned.length)
                this._addFilesCloseToAssignedDesktop(unassigned, storeMode, preferredDesktop);
            outOfDesktops = [];
        }

        // Now assign those icons that have dropped coordinates
        for (let fileItem of droppedFiles) {
            let [x, y] = fileItem.dropCoordinates;
            storeMode = this.Enums.StoredCoordinates.OVERWRITE;
            let addedToDesktop = false;

            for (let desktop of this._desktops) {
                if (desktop.coordinatesBelongToThisGrid(x, y) && desktop.isAvailable()) {
                    fileItem.dropCoordinates = null;
                    desktop.addFileItemCloseTo(fileItem, x, y, storeMode);
                    addedToDesktop = true;
                    break;
                }
            }

            if (!addedToDesktop)
                outOfDesktops.push(fileItem);
        }

        // Now, try again assign those icons that had dropped coordinates and
        // did not fit on dropped desktop, to the preferred or closest desktop
        if (outOfDesktops.length) {
            this._addFilesCloseToAssignedDesktop(outOfDesktops, storeMode, preferredDesktop);
            outOfDesktops = [];
        }

        // Finally, assign coordinates of preferred desktop to those new icons
        // that still don't have coordinates and place on preferred desktop or the next closest one
        for (let fileItem of notAssignedYet) {
            let x = preferredDesktop.gridGlobalRectangle.x;
            let y = preferredDesktop.gridGlobalRectangle.y;
            storeMode = this.Enums.StoredCoordinates.ASSIGN;

            // try first in the designated desktop
            let assigned = false;
            if (preferredDesktop.coordinatesBelongToThisGrid(x, y) && preferredDesktop.isAvailable()) {
                preferredDesktop.addFileItemCloseTo(fileItem, x, y, storeMode);
                assigned = true;
            }

            if (!assigned)
                outOfDesktops.push(fileItem);
        }

        // if there was no space in the preferred desktop, place on the desktop closest to preferred
        if (outOfDesktops.length)
            this._addFilesCloseToAssignedDesktop(outOfDesktops, storeMode, preferredDesktop);
    }

    _addFilesCloseToAssignedDesktop(fileList, storeMode, preferredDesktop) {
        for (let fileItem of fileList) {
            let minDistance = -1;
            let desktopX;
            let x = desktopX = preferredDesktop.gridGlobalRectangle.x;
            let desktopY = preferredDesktop.gridGlobalRectangle.y;
            if (fileItem.savedCoordinates) {
                x = fileItem.savedCoordinates[0];
                storeMode = this.Enums.StoredCoordinates.ASSIGN;
            } else if (fileItem.droppedCoordinates) {
                x = fileItem.droppedCoordinates[0];
                storeMode = this.Enums.StoredCoordinates.OVERWRITE;
            }

            // Find the closest desktop to given position
            let newDesktop = null;
            for (let desktop of this._desktops) {
                if (!desktop.isAvailable())
                    continue;

                let distance = desktop.getDistance(x);

                if ((minDistance === -1) || (distance < minDistance)) {
                    minDistance = distance;
                    newDesktop = desktop;
                    desktopX = newDesktop.gridGlobalRectangle.x;
                    desktopY = newDesktop.gridGlobalRectangle.y;
                }
            }

            if (newDesktop) {
                if (fileItem.droppedCoordinates)
                    fileItem.droppedCoordinates = null;
                newDesktop.addFileItemCloseTo(fileItem, desktopX, desktopY, storeMode);
            } else {
                console.log('Not enough space to add icons');
            }
        }
    }

    _getPreferredDisplayDesktop() {
        if (!this._desktops.length)
            return null;

        if (this._desktops.length === 1)
            return this._desktops[0];

        if (!this.Prefs.showOnSecondaryMonitor) {
            if (this._primaryScreen)
                return this._desktops[this._primaryIndex];
            else
                return this._desktops[0];
        }

        if (this._desktops.length > 1) {
            if (!this._primaryScreen)
                return this._desktops(this._desktops.length - 1);
            let tempDesktops = this._desktops.filter((desktop, index) => index !== this._primaryIndex);
            if (tempDesktops.length === 1)
                return tempDesktops[0];

            if (tempDesktops.length <= this._primaryIndex)
                return tempDesktops[0];
            else
                return tempDesktops[tempDesktops.length - 1];
        }

        // Catch All if everything fails
        return this._desktops[0];
    }

    async _updateWritableByOthers() {
        const info = await this._desktopDir.query_info_async(Gio.FILE_ATTRIBUTE_UNIX_MODE,
            Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_LOW, null);
        this.unixMode = info.get_attribute_uint32(Gio.FILE_ATTRIBUTE_UNIX_MODE);
        let writableByOthers = (this.unixMode & this.Enums.UnixPermissions.S_IWOTH) !== 0;
        if (writableByOthers !== this.writableByOthers) {
            this.writableByOthers = writableByOthers;
            if (this.writableByOthers)
                console.log('desktop-icons: The desktop is writable by others. Not allowing launching any desktop files.');

            return true;
        } else {
            return false;
        }
    }

    async _updateDesktopIfChanged(file, otherFile, eventType) {
        if (eventType === Gio.FileMonitorEvent.CHANGED) {
            // use only CHANGES_DONE_HINT
            return;
        }
        if (!this.Prefs.showHidden && (file.get_basename()[0] === '.')) {
            // If the file is not visible, we don't need to refresh the desktop
            // Unless it is a hidden file being renamed to visible
            if (!otherFile || (otherFile.get_basename()[0] === '.'))
                return;
        }
        switch (eventType) {
        case Gio.FileMonitorEvent.MOVED_IN:
        case Gio.FileMonitorEvent.MOVED_CREATED:
            /* Remove the coordinates that could exist to avoid conflicts between
                   files that are already in the desktop and the new one
                 */
            try {
                let info = new Gio.FileInfo();
                info.set_attribute_string('metadata::nautilus-icon-position', '');
                file.set_attributes_async(info, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_LOW, null);
            } catch (e) {} // can happen if a file is created and deleted very fast
            break;
        case Gio.FileMonitorEvent.ATTRIBUTE_CHANGED:
            /* The desktop is what changed, and not a file inside it */
            if (file.get_uri() === this._desktopDir.get_uri()) {
                if (await this._updateWritableByOthers()) {
                    try {
                        await this._updateDesktop();
                    } catch (e) {
                        console.error(e, `Exception while updating desktop from Directory Monitor attribute change: ${e.message}`);
                    }
                }
                return;
            }
            break;
        }

        try {
            await this._updateDesktop();
        } catch (e) {
            console.error(e, `Exception while updating desktop from Directory Monitor: ${e.message}`);
        }
    }

    /*
     * Before Gnome Shell 40, St API couldn't access binary data in the clipboard, only text data. Also, the
     * original Desktop Icons was a pure extension, so it was limited to what Clutter and St offered. That was
     * the reason why Nautilus accepted a text format for CUT and COPY operations in the form
     *
     *     x-special/nautilus-clipboard
     *     OPERATION
     *     FILE_URI
     *     [FILE_URI]
     *     [...]
     *
     * In Gnome Shell 40, St was enhanced and now it supports binary data; that's why Nautilus migrated to a
     * binary format identified by the atom 'x-special/gnome-copied-files', where the CUT or COPY operation is
     * shared.
     *
     * To maintain compatibility, we check the current Gnome Shell version and, based on that, we use the
     * binary or the text clipboards.
     */

    _manageCutCopy(action) {
        let clipboard = Gdk.Display.get_default().get_clipboard();
        let content = '';
        if (this.GnomeShellVersion < 40)
            content = 'x-special/nautilus-clipboard\n';

        if (action === 'doCut')
            content += 'cut\n';
        else
            content += 'copy\n';


        let first = true;
        if (!this.getCurrentSelection(true))
            return;

        for (let file of this.getCurrentSelection(true)) {
            if (!first)
                content += '\n';

            first = false;
            content += file;
        }

        let contentProvider;
        let textCoder = new TextEncoder();
        if (this.GnomeShellVersion < 40)
            contentProvider = Gdk.ContentProvider.new_for_bytes('text/plain', textCoder.encode(content));
        else
            contentProvider = Gdk.ContentProvider.new_for_bytes('x-special/gnome-copied-files', textCoder.encode(content));

        clipboard.set_content(contentProvider);
    }

    doCopy() {
        this._manageCutCopy('doCopy');
    }

    doCut() {
        this._manageCutCopy('doCut');
    }

    doTrash(localDrag = false, event = null) {
        const selectionItems = this._fileList.filter(i => i.isSelected && !i.isSpecial);

        if (!selectionItems.length)
            return;

        const selectionURIs = [];
        if (!localDrag) {
            this._pendingDropFiles = {};
            this._pendingSelfCopyFiles = {};
        }

        selectionItems.forEach(f => {
            selectionURIs.push(f.file.get_uri());
            if (!localDrag)
                this._pendingSelfCopyFiles[f.fileName] = f.savedCoordinates;
        });
        if (event)
            this.DBusUtils.RemoteFileOperations.pushEvent(event);
        this.DBusUtils.RemoteFileOperations.TrashURIsRemote(selectionURIs);
    }

    doDeletePermanently() {
        const toDelete = this._fileList.filter(i => i.isSelected && !i.isSpecial).map(i =>
            i.file.get_uri());

        if (!toDelete.length) {
            if (this._fileList.some(i => i.isSelected && i.isTrash))
                this.doEmptyTrash();
            return;
        }

        this.DBusUtils.RemoteFileOperations.DeleteURIsRemote(toDelete);
    }

    doEmptyTrash(askConfirmation = true) {
        this.DBusUtils.RemoteFileOperations.EmptyTrashRemote(askConfirmation);
    }

    checkIfSpecialFilesAreSelected() {
        for (let item of this._fileList) {
            if (item.isSelected && item.isSpecial)
                return true;
        }
        return false;
    }

    checkIfDirectoryIsSelected() {
        for (let item of this._fileList) {
            if (item.isSelected && item.isDirectory)
                return true;
        }
        return false;
    }

    getCurrentSelection(getUri) {
        let listToTrash = [];
        for (let fileItem of this._fileList) {
            if (fileItem.isSelected) {
                if (getUri)
                    listToTrash.push(fileItem.file.get_uri());
                else
                    listToTrash.push(fileItem);
            }
        }
        if (listToTrash.length !== 0)
            return listToTrash;
        else
            return null;
    }

    getNumberOfSelectedItems() {
        let count = 0;
        for (let item of this._fileList) {
            if (item.isSelected)
                count++;
        }
        return count;
    }

    menuclosed = () => {
        return new Promise(resolve => {
            this.popupmenuclosed = resolve;
        });
    };

    async doRename(fileItem, allowReturnOnSameName = false) {
        let selection = this.getCurrentSelection(false);
        if (!(selection && (selection.length === 1)))
            return;

        if (fileItem === null) {
            fileItem = selection[0];
            allowReturnOnSameName = false;
        }
        if (!fileItem.canRename)
            return;

        if (!this._renameWindow) {
            this.textEntryAccelsTurnOff();
            if (!this.newItemDoRename)
                this.newItemDoRename = new Set();

            this.newItemDoRename.add(fileItem.fileName);
            if (this.popupmenu || this.fileItemMenu.popupmenu)
                await this.menuclosed().catch(e => logError(e));
            this._renameWindow = new AskRenamePopup.AskRenamePopup(
                fileItem,
                allowReturnOnSameName,
                () => {
                    this.mainApp.get_active_window().grab_focus();
                    this.textEntryAccelsTurnOn();
                    if (this.newItemDoRename)
                        this.newItemDoRename.delete(fileItem.fileName);
                    this._renameWindow = null;
                },
                this._setPendingDropCoordinates.bind(this),
                {
                    FileUtils: this.FileUtils,
                    DesktopIconsUtil: this.DesktopIconsUtil,
                    DBusUtils: this.DBusUtils,
                }
            );
        }
    }

    fileExistsOnDesktop(searchName) {
        const listOfFileNamesOnDesktop = this.updateFileList().map(f => f.fileName);
        if (listOfFileNamesOnDesktop.includes(searchName))
            return true;
        else
            return false;
    }

    getDesktopUniqueFileName(fileName) {
        let fileParts = this.DesktopIconsUtil.getFileExtensionOffset(fileName);
        let i = 0;
        let newName = fileName;

        while (this.fileExistsOnDesktop(newName)) {
            i += 1;
            newName = `${fileParts.basename} ${i}${fileParts.extension}`;
        }
        return newName;
    }

    async doNewFolder(position = null, suggestedName = null, opts = {rename: true}) {
        this.unselectAll();

        if (!position)
            position = [this._clickX, this._clickY];


        const baseName = suggestedName ? suggestedName :  _('New Folder');
        let newName = this.getDesktopUniqueFileName(baseName);

        if (newName) {
            const dir = this.DesktopIconsUtil.getDesktopDir().get_child(newName);
            try {
                await dir.make_directory_async(GLib.PRIORITY_DEFAULT, null);

                const info = new Gio.FileInfo();
                info.set_attribute_string('metadata::nautilus-drop-position', `${position.join(',')}`);
                info.set_attribute_string('metadata::nautilus-icon-position', '');
                info.set_attribute_uint32(Gio.FILE_ATTRIBUTE_UNIX_MODE, 0o700);

                try {
                    await dir.set_attributes_async(info,
                        Gio.FileQueryInfoFlags.NONE,
                        GLib.PRIORITY_LOW,
                        null);
                } catch (e) {
                    console.error(e, `Failed to set attributes to ${dir.get_path()}`);
                }
            } catch (e) {
                console.error(e, `Failed to create folder ${e.message}`);
                const header = _('Folder Creation Failed');
                const text = _('Could not create folder');
                this.dbusManager.doNotify(header, text);
                if (position || suggestedName)
                    return null;

                return null;
            }

            if (opts.rename) {
                if (!this.newItemDoRename)
                    this.newItemDoRename = new Set();

                this.newItemDoRename.add(newName);
            }
            if (position || suggestedName)
                return dir.get_uri();
        }
        return null;
    }

    async _newDocument(template) {
        if (!template)
            return;

        const file = Gio.File.new_for_path(template);
        const finalName = this.getDesktopUniqueFileName(file.get_basename());
        const destination = this.DesktopIconsUtil.getDesktopDir().get_child(finalName);

        try {
            await file.copy(destination, Gio.FileCopyFlags.NONE, null, null);

            try {
                const info = new Gio.FileInfo();
                info.set_attribute_string('metadata::nautilus-drop-position', `${this._clickX},${this._clickY}`);
                info.set_attribute_string('metadata::nautilus-icon-position', '');
                info.set_attribute_uint32(Gio.FILE_ATTRIBUTE_UNIX_MODE, 0o600);
                await destination.set_attributes_async(info, Gio.FileQueryInfoFlags.NONE,
                    GLib.PRIORITY_DEFAULT, null);
            } catch (e) {
                console.error(e, `Failed to set template metadata ${e.message}`);
            }
        } catch (e) {
            console.error(e, `Failed to create template ${e.message}`);
            const header = _('Template Creation Error');
            const text = _('Could not create document');
            this.dbusManager.doNotify(header, text);
        }
    }

    onToggleStackUnstackThisTypeClicked(type, typeInList = null, unstackList = null) {
        if (!unstackList) {
            unstackList = this.Prefs.UnstackList;
            typeInList = unstackList.includes(type);
        }
        if (typeInList) {
            let index = unstackList.indexOf(type);
            unstackList.splice(index, 1);
        } else {
            unstackList.push(type);
        }
        this.Prefs.UnstackList = unstackList;
    }

    doStacks(opts = {redisplay: false}) {
        if (opts.redisplay) {
            for (let fileItem of this._fileList)
                fileItem.removeFromGrid();
        }

        if (!this.stackInitialCoordinates && !this._allFileList) {
            this._allFileList = [];
            this._saveStackInitialCoordinates();
            if (this.sortingSubMenu && this.sortingMenu) {
                this.sortingSubMenu.remove(0);
                this.sortingMenu.remove(0);
            }
            opts.redisplay = false;
        }

        this._sortAllFilesFromGridsByKindStacked(opts);

        this._reassignFilesToDesktop();
    }

    _unstack() {
        if (this.stackInitialCoordinates && this._allFileList) {
            this._fileList.forEach(f => {
                f.removeFromGrid();
                if (f.isStackMarker)
                    f.onDestroy();
            });
            this._restoreStackInitialCoordinates();
            this._fileList = this._allFileList;
            this._allFileList = null;
            if (this.sortingSubMenu && this.sortingMenu) {
                this.sortingSubMenu.prepend_item(this.keepArrangedMenuItem);
                this.sortingMenu.prepend_item(this.cleanUpMenuItem);
            }
            if (this.Prefs.keepArranged)
                this.doSorts();
            else
                this._addFilesToDesktop(this._fileList, this.Enums.StoredCoordinates.PRESERVE);
        }
    }

    _saveStackInitialCoordinates() {
        this.stackInitialCoordinates = [];
        for (let fileItem of this._fileList)
            this.stackInitialCoordinates.push([fileItem.fileName, fileItem.savedCoordinates]);
    }

    _restoreStackInitialCoordinates() {
        if (this.stackInitialCoordinates && this.stackInitialCoordinates.length !== 0) {
            this._allFileList.forEach(fileItem => {
                this.stackInitialCoordinates.forEach(savedItem => {
                    if (savedItem[0] === fileItem.fileName)
                        fileItem.savedCoordinates = savedItem[1];
                });
            });
        }
        this.stackInitialCoordinates = null;
    }

    _makeStackTopMarkerFolder(type, list) {
        let stackAttribute = type.split('/')[1];
        let fileItem = new StackItem.StackItem(
            this,
            stackAttribute,
            type,
            this.Enums.FileType.STACK_TOP
        );
        list.push(fileItem);
    }

    _sortAllFilesFromGridsByKindStacked(opts = {redisplay: false}) {
        /**
         * Looks through the generated fileItems
         */
        function determineStackTopSizeOrTime() {
            for (let item of otherFiles) {
                if (item.isStackMarker) {
                    for (let unstackitem of stackedFiles) {
                        if (item.attributeContentType === unstackitem.attributeContentType) {
                            item.size = unstackitem.fileSize;
                            item.time = unstackitem.modifiedTime;
                            break;
                        }
                    }
                }
            }
        }

        /**
         * Sorts fileItems by file size
         *
         * @param {integer} a the first file size
         * @param {integer} b the secondfile size
         */
        function bySize(a, b) {
            return  a.fileSize - b.fileSize;
        }

        /**
         * Sorts fileItems by time
         *
         * @param {integer} a the first file timestamp
         * @param {integer} b the second file timestamp
         */
        function byTime(a, b) {
            return  a._modifiedTime - b._modifiedTime;
        }

        let specialFiles = [];
        let directoryFiles = [];
        let validDesktopFiles = [];
        let otherFiles = [];
        let stackedFiles = [];
        let newFileList = [];
        let stackTopMarkerFolderList = [];
        let unstackList = this.Prefs.UnstackList;
        if (this._allFileList && opts.redisplay) {
            this._fileList.forEach(f => {
                if (f.isStackMarker)
                    f.onDestroy();
            });
            this._fileList = this._allFileList;
        }
        this._sortByName(this._fileList);
        for (let fileItem of this._fileList) {
            if (fileItem.isSpecial) {
                specialFiles.push(fileItem);
                continue;
            }
            if (fileItem.isDirectory) {
                directoryFiles.push(fileItem);
                continue;
            }
            if (fileItem._isValidDesktopFile) {
                validDesktopFiles.push(fileItem);
                continue;
            } else {
                let type = fileItem.attributeContentType;
                let stacked = false;
                for (let item of otherFiles) {
                    if (type === item.attributeContentType) {
                        stackedFiles.push(fileItem);
                        stacked = true;
                    }
                }
                if (!stacked) {
                    fileItem.isStackTop = true;
                    otherFiles.push(fileItem);
                }
                continue;
            }
        }
        for (let a of otherFiles) {
            let instack = false;
            for (let c of stackedFiles) {
                if (c.attributeContentType === a.attributeContentType) {
                    instack = true;
                    break;
                }
            }
            if (!instack)
                a.stackUnique = true;

            continue;
        }
        for (let item of otherFiles) {
            if (!item.stackUnique) {
                this._makeStackTopMarkerFolder(item.attributeContentType, stackTopMarkerFolderList);
                item.isStackTop = false;
                stackedFiles.push(item);
            }
            if (item.stackUnique)
                stackTopMarkerFolderList.push(item);

            item._updateIcon().catch(e => console.error(e, 'Error loading stackMarker icon'));
        }
        otherFiles = [];
        this._sortByName(specialFiles);
        this._sortByName(directoryFiles);
        this._sortByName(validDesktopFiles);
        this._sortByKindByName(stackedFiles);
        this._sortByKindByName(stackTopMarkerFolderList);
        otherFiles.push(...specialFiles);
        otherFiles.push(...validDesktopFiles);
        otherFiles.push(...directoryFiles);
        otherFiles.push(...stackTopMarkerFolderList);

        switch (this.Prefs.sortOrder) {
        case this.Enums.SortOrder.NAME:
            this._sortByName(otherFiles);
            break;
        case this.Enums.SortOrder.DESCENDINGNAME:
            this._sortByName(otherFiles);
            otherFiles.reverse();
            this._sortByName(stackedFiles);
            stackedFiles.reverse();
            break;
        case this.Enums.SortOrder.MODIFIEDTIME:
            stackedFiles.sort(byTime);
            determineStackTopSizeOrTime();
            otherFiles.sort(byTime);
            break;
        case this.Enums.SortOrder.KIND:
            break;
        case this.Enums.SortOrder.SIZE:
            stackedFiles.sort(bySize);
            determineStackTopSizeOrTime();
            otherFiles.sort(bySize);
            break;
        default:
            break;
        }
        for (let item of otherFiles) {
            newFileList.push(item);
            let itemtype = item.attributeContentType;
            for (let unstackitem of stackedFiles) {
                if (unstackList.includes(unstackitem.attributeContentType) && (unstackitem.attributeContentType === itemtype))
                    newFileList.push(unstackitem);
            }
        }
        if (this._allFileList)
            this._allFileList = this._fileList;

        this._fileList = newFileList;
    }

    _sortByName(fileList) {
        /**
         * @param {string} a fileItem filename for A
         * @param {string} b fileItem filename for B
         */
        function byName(a, b) {
            // sort by label name instead of the the fileName or displayName so that the "Home" folder is sorted in the correct order
            // alphabetical sort taking into account accent characters & locale, natural language sort for numbers, ie 10.etc before 2.etc
            // other options for locale are best fit, or by specifying directly in function below for translators
            return a._label.get_text().localeCompare(b._label.get_text(), {sensitivity: 'accent', numeric: 'true', localeMatcher: 'lookup'});
        }
        fileList.sort(byName);
    }

    _sortByKindByName(fileList) {
        /**
         * Sort by Kind, then by name
         *
         * @param {string} a fileItem
         * @param {string} b fileItem
         */
        function byKindByName(a, b) {
            return a.attributeContentType.localeCompare(b.attributeContentType) ||
             a._label.get_text().localeCompare(b._label.get_text(), {sensitivity: 'accent', numeric: 'true', localeMatcher: 'lookup'});
        }
        fileList.sort(byKindByName);
    }

    _sortAllFilesFromGridsByName(order) {
        this._sortByName(this._fileList);
        if (order === this.Enums.SortOrder.DESCENDINGNAME)
            this._fileList.reverse();

        this._reassignFilesToDesktop();
    }

    _sortByOriginalPosition() {
        let cornerInversion = this.Prefs.StartCorner;
        if (!cornerInversion[0] && !cornerInversion[1]) {
            this._fileList.sort((a, b) =>   {
                if (a.X < b.X)
                    return -1;
                if (a.X > b.X)
                    return 1;
                if (a.Y < b.Y)
                    return -1;
                if (a.Y > b.Y)
                    return 1;
                return 0;
            });
        }
        if (cornerInversion[0] && cornerInversion[1]) {
            this._fileList.sort((a, b) =>   {
                if (a.X < b.X)
                    return 1;
                if (a.X > b.X)
                    return -1;
                if (a.Y < b.Y)
                    return 1;
                if (a.Y > b.Y)
                    return -1;
                return 0;
            });
        }
        if (cornerInversion[0] && !cornerInversion[1]) {
            this._fileList.sort((a, b) =>   {
                if (a.X < b.X)
                    return 1;
                if (a.X > b.X)
                    return -1;
                if (a.Y < b.Y)
                    return -1;
                if (a.Y > b.Y)
                    return 1;
                return 0;
            });
        }
        if (!cornerInversion[0] && cornerInversion[1]) {
            this._fileList.sort((a, b) =>   {
                if (a.X < b.X)
                    return -1;
                if (a.X > b.X)
                    return 1;
                if (a.Y < b.Y)
                    return 1;
                if (a.Y > b.Y)
                    return -1;
                return 0;
            });
        }
    }

    _sortByCurrentPosition() {
        let cornerInversion = this.Prefs.StartCorner;
        if (!cornerInversion[0] && !cornerInversion[1]) {
            this._fileList.sort((a, b) =>   {
                if (a.x < b.x)
                    return -1;
                if (a.x > b.x)
                    return 1;
                if (a.y < b.y)
                    return -1;
                if (a.y > b.y)
                    return 1;
                return 0;
            });
        }
        if (cornerInversion[0] && cornerInversion[1]) {
            this._fileList.sort((a, b) =>   {
                if (a.x < b.x)
                    return 1;
                if (a.x > b.x)
                    return -1;
                if (a.y < b.y)
                    return 1;
                if (a.y > b.y)
                    return -1;
                return 0;
            });
        }
        if (cornerInversion[0] && !cornerInversion[1]) {
            this._fileList.sort((a, b) =>   {
                if (a.x < b.x)
                    return 1;
                if (a.x > b.x)
                    return -1;
                if (a.y < b.y)
                    return -1;
                if (a.y > b.y)
                    return 1;
                return 0;
            });
        }
        if (!cornerInversion[0] && cornerInversion[1]) {
            this._fileList.sort((a, b) =>   {
                if (a.x < b.x)
                    return -1;
                if (a.x > b.x)
                    return 1;
                if (a.y < b.y)
                    return 1;
                if (a.y > b.y)
                    return -1;
                return 0;
            });
        }
    }

    _sortAllFilesFromGridsByPosition() {
        if (this.Prefs.keepArranged)
            return;
        this._fileList.map(f => f.removeFromGrid({callOnDestroy: false}));
        this._sortByCurrentPosition();
        this._reassignFilesToDesktop();
    }

    _sortAllFilesFromGridsByModifiedTime() {
        /**
         * @param {integer} a fileItem file modified time
         * @param {integer} b fileItem file modified time
         */
        function byTime(a, b) {
            return  a._modifiedTime - b._modifiedTime;
        }
        this._fileList.sort(byTime);
        this._reassignFilesToDesktop();
    }

    _sortAllFilesFromGridsBySize() {
        /**
         * @param {integer} a fileItem fileSize
         * @param {integer} b fileItem fileSize
         */
        function bySize(a, b) {
            return  a.fileSize - b.fileSize;
        }
        this._fileList.sort(bySize);
        this._reassignFilesToDesktop();
    }

    _sortAllFilesFromGridsByKind() {
        let specialFiles = [];
        let directoryFiles = [];
        let validDesktopFiles = [];
        let otherFiles = [];
        let newFileList = [];
        for (let fileItem of this._fileList) {
            if (fileItem._isSpecial) {
                specialFiles.push(fileItem);
                continue;
            }
            if (fileItem._isDirectory) {
                directoryFiles.push(fileItem);
                continue;
            }
            if (fileItem._isValidDesktopFile) {
                validDesktopFiles.push(fileItem);
                continue;
            } else {
                otherFiles.push(fileItem);
                continue;
            }
        }
        this._sortByName(specialFiles);
        this._sortByName(directoryFiles);
        this._sortByName(validDesktopFiles);
        this._sortByKindByName(otherFiles);
        newFileList.push(...specialFiles);
        newFileList.push(...validDesktopFiles);
        newFileList.push(...directoryFiles);
        newFileList.push(...otherFiles);
        if (this._fileList.length === newFileList.length)
            this._fileList = newFileList;

        this._reassignFilesToDesktop();
    }

    _reassignFilesToDesktop() {
        if (!this.Prefs.sortSpecialFolders) {
            this._reassignFilesToDesktopPreserveSpecialFiles();
            return;
        }
        for (let fileItem of this._fileList) {
            fileItem.temporarySavedPosition = null;
            fileItem.dropCoordinates = null;
        }
        this._addFilesToDesktop(this._fileList, this.Enums.StoredCoordinates.ASSIGN);
    }

    _reassignFilesToDesktopPreserveSpecialFiles() {
        let specialFiles = [];
        let otherFiles = [];
        let newFileList = [];
        for (let fileItem of this._fileList) {
            if (fileItem._isSpecial) {
                specialFiles.push(fileItem);
                continue;
            }
            if (!fileItem._isSpecial) {
                otherFiles.push(fileItem);
                fileItem.temporarySavedPosition = null;
                fileItem.dropCoordinates = null;
                continue;
            }
        }
        newFileList.push(...specialFiles);
        newFileList.push(...otherFiles);
        if (this._fileList.length === newFileList.length)
            this._fileList = newFileList;

        this._addFilesToDesktop(this._fileList, this.Enums.StoredCoordinates.PRESERVE);
    }

    doSorts(opts = {redisplay: false}) {
        if (opts.redisplay)
            this._fileList.map(f => f.removeFromGrid());

        switch (this.Prefs.sortOrder) {
        case this.Enums.SortOrder.NAME:
            this._sortAllFilesFromGridsByName();
            break;
        case this.Enums.SortOrder.DESCENDINGNAME:
            this._sortAllFilesFromGridsByName(this.Enums.SortOrder.DESCENDINGNAME);
            break;
        case this.Enums.SortOrder.MODIFIEDTIME:
            this._sortAllFilesFromGridsByModifiedTime();
            break;
        case this.Enums.SortOrder.KIND:
            this._sortAllFilesFromGridsByKind();
            break;
        case this.Enums.SortOrder.SIZE:
            this._sortAllFilesFromGridsBySize();
            break;
        default:
            this._addFilesToDesktop(this._fileList, this.Enums.StoredCoordinates.PRESERVE);
            break;
        }
    }

    _monitorVolumes() {
        this._volumeMonitor = Gio.VolumeMonitor.get();
        this._volumeMonitor.connect('mount-added', () => {
            this.onMountAdded();
        });
        this._volumeMonitor.connect('mount-removed', () => {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this.onMountRemoved();
                return GLib.SOURCE_REMOVE;
            });
        });
    }

    onMutterSettingsChanged() {
        this._getPremultiplied();
        for (let desktop of this._desktops)
            desktop._premultiplied = this._premultiplied;
        this._requestGeometryUpdate();
    }

    onSettingsChanged() {
        this._updateDesktop().catch(e => {
            console.log(`Exception while updating Desktop after the settings changed: ${e.message}\n${e.stack}`);
        });
    }

    onShowLinkEmblemschanged() {
        this._desktopManager._updateDesktop().catch(e => {
            console.log(`Exception while updating desktop after "Show Emblems" changed: ${e.message}\n${e.stack}`);
        });
    }

    onMountAdded() {
        this._updateDesktop().catch(e => {
            console.log(`Exception while updating Desktop after a mount was added: ${e.message}\n${e.stack}`);
        });
    }

    onMountRemoved() {
        this._updateDesktop().catch(e => {
            console.log(`Exception while updating Desktop after a mount was removed: ${e.message}\n${e.stack}`);
        });
    }

    onGtkIconThemeChange() {
        this._updateDesktop().catch(e => {
            console.log(`Exception while updating desktop after an GTK icon-theme change: ${e.message}\n${e.stack}`);
        });
        if (this.cssColorDefinitionChangeID)
            GLib.source_remove(this.cssColorDefinitionChangeID)
        this.cssColorDefinitionChangeID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this.onGtkThemeChange();
            this.cssColorDefinitionChangeID = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    onGnomeFilesSettingsChanged() {
        this._updateDesktop().catch(e => {
            console.log(`Exception while updating Desktop after the GNOME Files settings changed: ${e.message}\n${e.stack}`);
        });
    }

    onGtkSettingsChanged() {
        this._updateDesktop().catch(e => {
            console.log(`Exception while updating desktop after the hidden settings changed: ${e.message}\n${e.stack}`);
        });
        this.templatesMonitor.updateEntries();
    }

    onKeepArrangedChanged() {
        if (this.Prefs.keepArranged)
            this.doSorts({redisplay: true});
    }

    onUnstackedTypesChanged() {
        if (this.Prefs.keepStacked)
            this.doStacks({redisplay: true});
    }

    onkeepStackedChanged() {
        if (!this.Prefs.keepStacked)
            this._unstack();
        else
            this.doStacks({redisplay: true});
    }

    onSortOrderChanged() {
        if (this.Prefs.keepStacked)
            this.doStacks({redisplay: true});
        else
            this.doSorts({redisplay: true});
    }

    onIconSizeChanged() {
        this._fileList.forEach(x => x.removeFromGrid());
        for (let desktop of this._desktops)
            desktop.resizeGrid();

        this._fileList.forEach(x => x.updateIcon());
        this._placeAllFilesOnGrids({redisplay: true});
    }

    onGtkThemeChange() {
        Gtk.StyleContext.remove_provider_for_display(Gdk.Display.get_default(), this._cssColorProviderSelection);
        this._configureSelectionColor();
    }
};
