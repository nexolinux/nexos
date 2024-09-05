/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Gtk4 Port Copyright (C) 2022 Sundeep Mediratta (smedius@gmail.com)
 * Copyright (C) 2021 Sergio Costas (rastersoft@gmail.com)
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
import {Gtk, Gdk, Gio, GLib} from '../dependencies/gi.js';
import {_, Gettext} from '../dependencies/gettext.js';

export {FileItemMenu};

const FileItemMenu = class {
    constructor(desktopManager) {
        this._desktopManager = desktopManager;
        this._codePath = this._desktopManager._codePath;
        this.appChooser = this._desktopManager.appChooser;
        this._mainApp = this._desktopManager.mainApp;
        this.Prefs = this._desktopManager.Prefs;
        this.Enums = this._desktopManager.Enums;
        this.DesktopIconsUtil = this._desktopManager.DesktopIconsUtil;
        this.DBusUtils = desktopManager.DBusUtils;
        this._Enums = desktopManager.Enums;
        this._templatesScriptsManager = this._desktopManager.templatesScriptsManager;
        this._decompressibleTypes = [];
        this.archiveConnectionId = this.DBusUtils.RemoteFileOperations.gnomeArchiveManager.connect('changed-status', (actor, available) => {
            if (available) {
                // wait a second to ensure that everything has settled
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                    try {
                        this._getExtractionSupportedTypes();
                    } catch (e) {}
                    return false;
                });
            } else {
                this._decompressibleTypes = [];
            }
        });
        if (this.DBusUtils.RemoteFileOperations.gnomeArchiveManager.isAvailable)
            this._getExtractionSupportedTypes();


        this.scriptsMonitor = new this._templatesScriptsManager.TemplatesScriptsManager(
            this.DesktopIconsUtil.getScriptsDir(),
            this._onScriptClicked.bind(this),
            this._scriptsDirSelectionFilter.bind(this),
            {
                mainApp: this._mainApp,
                appName: 'scriptapp',
                FileUtils: this._desktopManager.FileUtils,
                Enums: this._desktopManager.Enums,
            }
        );
        this.activeFileItem = null;
        this._createFileItemMenuActions();
    }

    destroy() {
        this.DBusUtils.RemoteFileOperations.gnomeArchiveManager.disconnect(this.archiveConnectionId);
        this.archiveConnectionId = 0;
    }

    _getExtractionSupportedTypes() {
        this._decompressibleTypes = [];
        const archiveProxy = this.DBusUtils.GnomeArchiveManager.proxy;
        try {
            archiveProxy?.GetSupportedTypesRemote('extract',
                (result, error) => {
                    if (error) {
                        console.log(`Can't get the extractable types: ${error.message}. Ensure that File-Roller is installed.\n${error}.`);
                        return;
                    }
                    for (let key of result.values()) {
                        for (let type of key.values())
                            this._decompressibleTypes.push(Object.values(type)[0]);
                    }
                }
            );
        } catch (e) {}
    }

    _scriptsDirSelectionFilter(fileinfo) {
        let name = fileinfo.get_name();
        let hidden = name.substring(0, 1) === '.';
        let executable = fileinfo.get_attribute_boolean('access::can-execute');
        if (!hidden && executable)
            return name;
        else
            return null;
    }

    _createFileItemMenuActions() {
        let openMultipleFileAction = Gio.SimpleAction.new('openMultipleFileAction', null);
        openMultipleFileAction.connect('activate', () => {
            this._doMultiOpen();
        });
        this._mainApp.add_action(openMultipleFileAction);

        let openOneFileAction = Gio.SimpleAction.new('openOneFileAction', null);
        openOneFileAction.connect('activate', () => {
            if (this.activeFileItem) {
                if (this.activeFileItem.isStackMarker)
                    this._desktopManager.onToggleStackUnstackThisTypeClicked(this.activeFileItem.attributeContentType);
                else
                    this.activeFileItem.doOpen();
            }
        });
        this._mainApp.add_action(openOneFileAction);
        this._mainApp.set_accels_for_action('app.openOneFileAction', ['Return']);

        let stackunstack = Gio.SimpleAction.new('stackunstack', GLib.VariantType.new('s'));
        stackunstack.connect('activate', (action, paramenter) => {
            this._desktopManager.onToggleStackUnstackThisTypeClicked(paramenter.unpack());
        });
        this._mainApp.add_action(stackunstack);

        let doopenwith = Gio.SimpleAction.new('doopenwith', null);
        doopenwith.connect('activate', this._doOpenWith.bind(this, null));
        this._mainApp.add_action(doopenwith);

        let graphicslaunch = Gio.SimpleAction.new('graphicslaunch', null);
        graphicslaunch.connect('activate', () => {
            this.activeFileItem.doDiscreteGpu();
        });
        this._mainApp.add_action(graphicslaunch);

        let runasaprogram = Gio.SimpleAction.new('runasaprogram', null);
        runasaprogram.connect('activate', () => {
            this.DesktopIconsUtil.spawnCommandLine(`"${this.activeFileItem.execLine}"`);
        });
        this._mainApp.add_action(runasaprogram);

        this._docut = Gio.SimpleAction.new('docut', null);
        this._docut.connect('activate', () => {
            this._desktopManager.doCut();
        });
        this._mainApp.add_action(this._docut);
        this._mainApp.set_accels_for_action('app.docut', ['<Control>X']);

        this._docopy = Gio.SimpleAction.new('docopy', null);
        this._docopy.connect('activate',  () => {
            this._desktopManager.doCopy();
        });
        this._mainApp.add_action(this._docopy);
        this._mainApp.set_accels_for_action('app.docopy', ['<Control>C']);

        let dorename = Gio.SimpleAction.new('dorename', null);
        dorename.connect('activate', () => {
            this._desktopManager.doRename(this.activeFileItem, false).catch(e => logError(e));
        });
        this._mainApp.add_action(dorename);
        this._mainApp.set_accels_for_action('app.dorename', ['F2']);

        this.moveToTrash = Gio.SimpleAction.new('movetotrash', null);
        this.moveToTrash.connect('activate', () => {
            this._desktopManager.doTrash();
        });
        this._mainApp.add_action(this.moveToTrash);
        this._mainApp.set_accels_for_action('app.movetotrash', ['Delete']);

        this.deletePermanantly = Gio.SimpleAction.new('deletepermanantly', null);
        this.deletePermanantly.connect('activate', () => {
            this._desktopManager.doDeletePermanently();
        });
        this._mainApp.add_action(this.deletePermanantly);
        this._mainApp.set_accels_for_action('app.deletepermanantly', ['<Shift>Delete']);

        let emptytrash = Gio.SimpleAction.new('emptytrash', null);
        emptytrash.connect('activate', () => {
            this._desktopManager.doEmptyTrash();
        });
        this._mainApp.add_action(emptytrash);

        let allowdisallowlaunching = Gio.SimpleAction.new('allowdisallowlaunching', null);
        allowdisallowlaunching.connect('activate', () => {
            this.activeFileItem.onAllowDisallowLaunchingClicked().catch(e => console.error(e));
        });
        this._mainApp.add_action(allowdisallowlaunching);

        let eject = Gio.SimpleAction.new('eject', null);
        eject.connect('activate', () => {
            this.activeFileItem.eject().catch(e => console.error(e));
        });
        this._mainApp.add_action(eject);

        let unmount = Gio.SimpleAction.new('unmount', null);
        unmount.connect('activate', () => {
            this.activeFileItem.unmount().catch(e => console.error(e));
        });
        this._mainApp.add_action(unmount);

        let extractautoar = Gio.SimpleAction.new('extractautoar', null);
        extractautoar.connect('activate', () => this._desktopManager.getCurrentSelection(false).forEach(f =>
            this._desktopManager.autoAr.extractFile(f.fileName)));
        this._mainApp.add_action(extractautoar);

        let extracthere = Gio.SimpleAction.new('extracthere', null);
        extracthere.connect('activate', () => {
            this._extractFileFromSelection(true);
        });
        this._mainApp.add_action(extracthere);

        let extractto = Gio.SimpleAction.new('extractto', null);
        extractto.connect('activate', () => {
            this._extractFileFromSelection(false);
        });
        this._mainApp.add_action(extractto);

        let sendto = Gio.SimpleAction.new('sendto', null);
        sendto.connect('activate', this._mailFilesFromSelection.bind(this, null));
        this._mainApp.add_action(sendto);

        let compressfiles = Gio.SimpleAction.new('compressfiles', null);
        compressfiles.connect('activate', this._doCompressFilesFromSelection.bind(this, null));
        this._mainApp.add_action(compressfiles);

        let newfolderfromselection = Gio.SimpleAction.new('newfolderfromselection', null);
        newfolderfromselection.connect('activate', () => {
            const event = {
                'parentWindow': this.activeFileItem._grid._window,
                'timestamp': Gdk.CURRENT_TIME,
            };
            this._doNewFolderFromSelection(this.activeFileItem.savedCoordinates, this.activeFileItem, event).catch(e => console.error(e));
        });
        this._mainApp.add_action(newfolderfromselection);

        let properties = Gio.SimpleAction.new('properties', null);
        properties.connect('activate', () => {
            this._onPropertiesClicked();
        });
        this._mainApp.add_action(properties);
        this._mainApp.set_accels_for_action('app.properties', ['<Control>I', '<Alt>Return']);

        let showinfiles = Gio.SimpleAction.new('showinfiles', null);
        showinfiles.connect('activate', this._onShowInFilesClicked.bind(this, null));
        this._mainApp.add_action(showinfiles);

        let openinterminal = Gio.SimpleAction.new('openinterminal', null);
        openinterminal.connect('activate', () => {
            this.launchTerminal(this.activeFileItem.path, null);
        });
        this._mainApp.add_action(openinterminal);

        let makeLinks = Gio.SimpleAction.new('makeLinks', null);
        makeLinks.connect('activate', () => {
            this._makeLinks();
        });
        this._mainApp.add_action(makeLinks);
        this._mainApp.set_accels_for_action('app.makeLinks', ['<Shift><Control>M']);

        let bulkCopy = Gio.SimpleAction.new('bulkCopy', null);
        bulkCopy.connect('activate', () => {
            this._bulkCopy();
        });
        this._mainApp.add_action(bulkCopy);

        let bulkMove = Gio.SimpleAction.new('bulkMove', null);
        bulkMove.connect('activate', () => {
            this._bulkMove();
        });
        this._mainApp.add_action(bulkMove);
    }

    /* Shows all possible values that can be assigned to this function */

    // eslint-disable-next-line no-unused-vars
    showMenu(fileItem, button = null, X = null, Y = null, x = null, y = null, shiftSelected = false, controlSelected = false) {
        this.activeFileItem = this._desktopManager.activeFileItem = fileItem;
        const selectedItemsNum = this._desktopManager.getNumberOfSelectedItems();
        const scriptsSubmenu = this.scriptsMonitor.getGioMenu();
        const menulocation = X ? new Gdk.Rectangle({x, y, width: 1, height: 1}) : fileItem._grid.getGlobaltoLocalRectangle(fileItem.iconRectangle);

        this._menu = Gio.Menu.new();
        let makeFolderMenu = Gio.Menu.new();
        let openMenu = Gio.Menu.new();
        let runAsProgram = Gio.Menu.new();
        let cutCopyPasteMenu = Gio.Menu.new();
        let trashMenu = Gio.Menu.new();
        let allowLaunchingMenu = Gio.Menu.new();
        let emptyTrashMenu = Gio.Menu.new();
        let driveMenu = Gio.Menu.new();
        let propertiesMenu = Gio.Menu.new();
        let showInFilesMenu = Gio.Menu.new();
        let openInTerminalMenu = Gio.Menu.new();

        if (fileItem.isAllSelectable && !this._desktopManager.checkIfSpecialFilesAreSelected() && (selectedItemsNum >= 2)) {
            makeFolderMenu.append(
                Gettext.ngettext('New Folder with {0} item', 'New Folder with {0} items', selectedItemsNum).replace('{0}', selectedItemsNum),
                'app.newfolderfromselection'
            );
        }

        if (!this.activeFileItem.isStackMarker) {
            if (selectedItemsNum > 1) {
                openMenu.append(_('Open All...'), 'app.openMultipleFileAction');
            } else {
                let app;
                if (this.activeFileItem.attributeContentType === 'inode/directory' &&
                    Gio.AppInfo.get_all_for_type('inode/directory').length > 1
                )
                    app = Gio.AppInfo.get_default_for_type(this.activeFileItem.attributeContentType, false)?.get_name();
                else
                    app = Gio.AppInfo.get_default_for_type(this.activeFileItem.attributeContentType, true)?.get_name();
                let menuLabel;
                if (this.activeFileItem.executableContentType && this.activeFileItem.isExecutable && !this.activeFileItem.fileContainsText)
                    menuLabel = _('Run');
                else if (app && !this.activeFileItem.isValidDesktopFile)
                    menuLabel = _('Open with {foo}');
                else
                    menuLabel = _('Open');
                openMenu.append(menuLabel.replace('{foo}', app), 'app.openOneFileAction');
            }
        }

        if (fileItem.isAllSelectable && !this._desktopManager.checkIfSpecialFilesAreSelected() && (selectedItemsNum >= 1)) {
            let addedExtractHere = false;
            if (this._getExtractableAutoAr()) {
                addedExtractHere = true;
                openMenu.append(_('Extract Here'), 'app.extractautoar');
            }
            if (selectedItemsNum === 1 && this._getExtractable()) {
                if (!addedExtractHere)
                    openMenu.append(_('Extract Here'), 'app.extracthere');

                openMenu.append(_('Extract To...'), 'app.extractto');
            }
        }

        if (fileItem.isDirectory && selectedItemsNum === 1)
            openMenu.append(_('Open With...'), 'app.doopenwith');

        if (!this.activeFileItem.isStackMarker && !fileItem.isDirectory) {
            openMenu.append(selectedItemsNum > 1 ? _('Open All With Other Application...') : _('Open With...'), 'app.doopenwith');

            if (this.DBusUtils.discreteGpuAvailable && fileItem.trustedDesktopFile)
                openMenu.append(_('Launch using Dedicated Graphics Card'), 'app.graphicslaunch');
        }

        let keepStacked = this.Prefs.desktopSettings.get_boolean('keep-stacked');
        if (keepStacked && !fileItem.stackUnique) {
            if (!fileItem.isSpecial && !fileItem.isDirectory && !fileItem.isValidDesktopFile) {
                let typeInList = this.Prefs.UnstackList.includes(fileItem.attributeContentType);
                let menuitem = Gio.MenuItem.new(typeInList ? _('Stack This Type') : _('Unstack This Type'), null);
                let variant = GLib.Variant.new('s', fileItem.attributeContentType);
                menuitem.set_action_and_target_value('app.stackunstack', variant);
                openMenu.append_item(menuitem);
            }
        }

        // fileExtra == NONE

        if (fileItem.isAllSelectable &&  !fileItem.isStackMarker) {
            if (fileItem.attributeCanExecute && !fileItem.isDirectory && !fileItem.isValidDesktopFile && fileItem.execLine && Gio.content_type_can_be_executable(fileItem.attributeContentType))
                runAsProgram.append(_('Run as a Program'), 'app.runasaprogram');

            if (scriptsSubmenu !== null)
                openMenu.append_submenu(_('Scripts'), scriptsSubmenu);

            let allowCutCopyTrash = this._desktopManager.checkIfSpecialFilesAreSelected();
            cutCopyPasteMenu.append(_('Cut'), 'app.docut');
            this._docut.set_enabled(!allowCutCopyTrash);
            cutCopyPasteMenu.append(_('Copy'), 'app.docopy');
            this._docopy.set_enabled(!allowCutCopyTrash);

            if (!this._desktopManager.checkIfSpecialFilesAreSelected()) {
                cutCopyPasteMenu.append(_('Move to...'), 'app.bulkMove');
                cutCopyPasteMenu.append(_('Copy to...'), 'app.bulkCopy');
            }

            if (fileItem.canRename && (selectedItemsNum === 1))
                trashMenu.append(_('Rename…'), 'app.dorename');

            if (fileItem.isAllSelectable && !this._desktopManager.checkIfSpecialFilesAreSelected() && (selectedItemsNum >= 1)) {
                trashMenu.append(_('Create Link...'), 'app.makeLinks');

                if (this._desktopManager.getCurrentSelection().every(f => f.isDirectory)) {
                    trashMenu.append(
                        Gettext.ngettext(
                            'Compress {0} folder', 'Compress {0} folders', selectedItemsNum).replace(
                            '{0}', selectedItemsNum),
                        'app.compressfiles'
                    );
                } else {
                    trashMenu.append(
                        Gettext.ngettext(
                            'Compress {0} file', 'Compress {0} files', selectedItemsNum).replace(
                            '{0}', selectedItemsNum),
                        'app.compressfiles'
                    );
                }

                trashMenu.append(_('Email to...'), 'app.sendto');

                if (!this._desktopManager.checkIfDirectoryIsSelected()) {
                    let gsconnectsubmenu = this.DBusUtils.RemoteSendFileOperations.create_gsconnect_menu(this._desktopManager.getCurrentSelection());
                    if (gsconnectsubmenu)
                        trashMenu.append_submenu(_('Send to Mobile Device'), gsconnectsubmenu);
                }
            }

            trashMenu.append(_('Move to Trash'), 'app.movetotrash');
            this.moveToTrash.set_enabled(!allowCutCopyTrash);
            if (this.Prefs.nautilusSettings.get_boolean('show-delete-permanently')) {
                trashMenu.append(_('Delete permanently'), 'app.deletepermanantly');
                this.deletePermanantly.set_enabled(!allowCutCopyTrash);
            }

            if (fileItem.isValidDesktopFile && !this._desktopManager.writableByOthers && !fileItem.writableByOthers && (selectedItemsNum === 1))
                allowLaunchingMenu.append(fileItem.trustedDesktopFile ? _("Don't Allow Launching") : _('Allow Launching'), 'app.allowdisallowlaunching');
        }

        // fileExtra == TRASH

        if (fileItem.isTrash)
            emptyTrashMenu.append(_('Empty Trash'), 'app.emptytrash');

        // fileExtra == EXTERNAL_DRIVE

        if (fileItem.isDrive) {
            if (fileItem.canEject)
                driveMenu.append(_('Eject'), 'app.eject');

            if (fileItem.canUnmount)
                driveMenu.append(_('Unmount'), 'app.unmount');
        }

        if (!fileItem.isStackMarker) {
            propertiesMenu.append(selectedItemsNum > 1 ? _('Common Properties')
                : _('Properties'), 'app.properties');

            const nautilusName = this.Prefs.NautilusName;
            showInFilesMenu.append(selectedItemsNum > 1 ? _('Show All in {0}').replace('{0}', nautilusName)
                : _('Show in {0}').replace('{0}', nautilusName), 'app.showinfiles');
        }

        if (fileItem.isDirectory && (fileItem.path !== null) && (selectedItemsNum === 1)) {
            const terminalstring = this.Prefs.TerminalName;
            openInTerminalMenu.append(_('Open in {0}').replace('{0}', terminalstring), 'app.openinterminal');
        }

        this._menu.append_section(null, makeFolderMenu);
        this._menu.append_section(null, openMenu);
        this._menu.append_section(null, runAsProgram);
        this._menu.append_section(null, cutCopyPasteMenu);
        this._menu.append_section(null, trashMenu);
        this._menu.append_section(null, allowLaunchingMenu);
        this._menu.append_section(null, emptyTrashMenu);
        if (fileItem.canEject || fileItem.canUnmount)
            this._menu.append_section(null, driveMenu);
        this._menu.append_section(null, showInFilesMenu);
        this._menu.append_section(null, openInTerminalMenu);
        this._menu.append_section(null, propertiesMenu);

        this.popupmenu = Gtk.PopoverMenu.new_from_model(this._menu);
        this.popupmenu.set_parent(fileItem._grid._container);
        this.popupmenu.set_pointing_to(menulocation);
        const menuGtkPosition = fileItem._grid.getIntelligentPosition(menulocation);
        if (menuGtkPosition)
            this.popupmenu.set_position(menuGtkPosition);

        this.popupmenu.popup();
        this.popupmenu.connect('closed', async () => {
            await this.DesktopIconsUtil.waitDelayMs(50);
            this.popupmenu.unparent();
            this.popupmenu = null;
            if (this._desktopManager.popupmenuclosed)
                this._desktopManager.popupmenuclosed(true);
        });
    }

    showToolTip(fileItem) {
        if (this._toolTipPopup)
            return;
        if (this.popupmenu && (fileItem.uri === this.activeFileItem.uri))
            return;
        this._toolTipPopup = Gtk.Popover.new();
        this._toolTipPopup.set_pointing_to(fileItem.iconRectangle);
        this._toolTipPopup.set_autohide(false);
        this._toolTipLabel = Gtk.Label.new(fileItem._currentFileName);
        this._toolTipPopup.set_child(this._toolTipLabel);
        this._toolTipPopup.set_parent(fileItem._grid._window);
        const popupLocation = new Gdk.Rectangle({x: fileItem.iconRectangle.x, y: fileItem.iconRectangle.y, width: 1, height: 1});
        const popupGtkPosition = fileItem._grid.getIntelligentPosition(popupLocation);
        if (popupGtkPosition)
            this._toolTipPopup.set_position(popupGtkPosition);
        this._toolTipPopup.popup();
        this._toolTipPopup.connect('closed', () => {
            this._toolTipPopup.unparent();
            this._toolTipPopup = null;
        });
    }

    hideToolTip() {
        if (this._toolTipPopup)
            this._toolTipPopup.popdown();
    }

    _onPropertiesClicked() {
        let propertiesFileList = this._desktopManager.getCurrentSelection(true);
        const timestamp = Gdk.CURRENT_TIME;
        this.DBusUtils.RemoteFileOperations.ShowItemPropertiesRemote(propertiesFileList, timestamp);
    }

    _onShowInFilesClicked() {
        let showInFilesList = this._desktopManager.getCurrentSelection(true);
        if (this.Prefs.useNemo) {
            try {
                for (let element of showInFilesList)
                    this.DesktopIconsUtil.trySpawn(GLib.get_home_dir(), ['nemo', element], this.DesktopIconsUtil.getFilteredEnviron());

                return;
            } catch (err) {
                console.log(`Error trying to launch Nemo: ${err.message}\n${err}`);
            }
        }
        const timestamp = Gdk.CURRENT_TIME;
        this.DBusUtils.RemoteFileOperations.ShowItemsRemote(showInFilesList, timestamp);
    }

    _doMultiOpen() {
        for (let fileItem of this._desktopManager.getCurrentSelection(false)) {
            fileItem.unsetSelected();
            fileItem.doOpen();
        }
    }

    async _doOpenWith() {
        let fileItems = this._desktopManager.getCurrentSelection(false);
        if (!this.activeFileItem)
            this.activeFileItem = fileItems[0];
        if (fileItems) {
            const context = Gdk.Display.get_default().get_app_launch_context();
            context.set_timestamp(Gdk.CURRENT_TIME);
            let chooser = new this.appChooser.AppChooserDialog(this._codePath, fileItems, this.activeFileItem, this._desktopManager.dbusManager,
                this._desktopManager.DesktopIconsUtil);
            this._desktopManager.textEntryAccelsTurnOff();
            chooser.show();
            const appInfo = await chooser.getApplicationSelected().catch(e => console.error(e));
            if (appInfo) {
                let fileList = [];
                for (let item of fileItems)
                    fileList.push(item.file);

                appInfo.launch(fileList, context);
            }
            this._desktopManager.textEntryAccelsTurnOn();
            chooser.hide();
            chooser.finalize();
            chooser = null;
        }
    }

    async _extractFileFromSelection(extractHere) {
        let extractFileItemURI;
        let extractFolderName;
        let position;
        const header = _('Extraction Cancelled');
        const text = _('Unable to extract File, no destination folder');

        for (let fileItem of this._desktopManager.getCurrentSelection(false)) {
            extractFileItemURI = fileItem.file.get_uri();
            extractFolderName = fileItem.fileName;
            position = fileItem.getCoordinates().slice(0, 2);
            fileItem.unsetSelected();
        }

        if (extractHere) {
            extractFolderName = this.DesktopIconsUtil.getFileExtensionOffset(extractFolderName).basename;
            const targetURI = await this._desktopManager.doNewFolder(position, extractFolderName, {rename: false});
            if (targetURI)
                this.DBusUtils.RemoteFileOperations.ExtractRemote(extractFileItemURI, targetURI, true);
            else
                this._desktopManager.dbusManager.doNotify(header, text);

            return;
        }

        let folder = await this.getSelectedFolderGio().catch(e => console.error(e));
        if (folder)
            this.DBusUtils.RemoteFileOperations.ExtractRemote(extractFileItemURI, folder.get_uri(), true);
        else
            this._desktopManager.dbusManager.doNotify(header, text);
    }


    async _bulkMove() {
        if (this._desktopManager.checkIfSpecialFilesAreSelected())
            return;
        let moveList = this._desktopManager.getCurrentSelection(true);
        const header = _('Move Cancelled');
        const text = _('Unable to move Files, no destination folder');
        let folder = await this.getSelectedFolderGio().catch(e => console.error(e));
        if (folder)
            this.DBusUtils.RemoteFileOperations.MoveURIsRemote(moveList, folder.get_uri());
        else
            this._desktopManager.dbusManager.doNotify(header, text);
    }


    getSelectedFolderGioNewMethod(dialogTitle = null, selectionText = null) {
        return new Promise(resolve => {
            if (!dialogTitle)
                dialogTitle =  _('Select Destination');
            const window = this.DesktopIconsUtil.getApplicationID().get_active_window();
            if (!selectionText)
                selectionText = _('Select');
            const dialog = new Gtk.FileDialog({
                title: dialogTitle,
                accept_label: selectionText,
                modal: true,
                initial_folder: this.DesktopIconsUtil.getDesktopDir(),
            });
            dialog.select_folder(window, null, (actor, gioasyncresponse) => {
                let folder;
                try {
                    folder = actor.select_folder_finish(gioasyncresponse);
                } catch (e) {
                    resolve(false);
                }
                if (folder)
                    resolve(folder);
                else
                    resolve(false);
            });
        });
    }


    getSelectedFolderGioOldMethod(dialogTitle = null, selectionText = null) {
        return new Promise(resolve => {
            if (!dialogTitle)
                dialogTitle =  _('Select Destination');
            if (!selectionText)
                selectionText = _('Select');
            let returnValue = null;
            const window = this.DesktopIconsUtil.getApplicationID().get_active_window();
            const dialog = new Gtk.FileChooserDialog({title: dialogTitle});
            dialog.set_action(Gtk.FileChooserAction.SELECT_FOLDER);
            dialog.set_create_folders(true);
            dialog.set_current_folder(this.DesktopIconsUtil.getDesktopDir());
            dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
            dialog.add_button(selectionText, Gtk.ResponseType.ACCEPT);
            dialog.set_transient_for(window);
            const modal = true;
            dialog.set_modal(modal);
            this.DesktopIconsUtil.windowHidePagerTaskbarModal(dialog, modal);
            this._desktopManager.textEntryAccelsTurnOff();
            dialog.show();
            dialog.present_with_time(Gdk.CURRENT_TIME);
            dialog.connect('close', () => {
                dialog.response(Gtk.ResponseType.CANCEL);
            });
            dialog.connect('response', (actor, response) => {
                if (response === Gtk.ResponseType.ACCEPT) {
                    const folder = dialog.get_file();
                    if (folder)
                        returnValue = folder;
                    else
                        returnValue = false;
                }
                this._desktopManager.textEntryAccelsTurnOn();
                dialog.destroy();
                resolve(returnValue);
            });
        });
    }

    async getSelectedFolderGio(dialogTitle = null, selectionText = null) {
        let result;
        try {
            result = await this.getSelectedFolderGioNewMethod(dialogTitle, selectionText);
        } catch (e) {
            console.log('Reverting to old method of selecting');
            result = await this.getSelectedFolderGioOldMethod(dialogTitle, selectionText);
        }
        return result;
    }

    async _bulkCopy() {
        if (this._desktopManager.checkIfSpecialFilesAreSelected())
            return;
        let copyList = this._desktopManager.getCurrentSelection(true);
        const header = _('Copy Cancelled');
        const text = _('Unable to copy Files, no destination folder');
        let folder = await this.getSelectedFolderGio().catch(e => console.error(e));
        if (folder)
            this.DBusUtils.RemoteFileOperations.CopyURIsRemote(copyList, folder.get_uri());
        else
            this._desktopManager.dbusManager.doNotify(header, text);
    }

    _getExtractableAutoAr() {
        let fileList = this._desktopManager.getCurrentSelection(false);
        if (this.DBusUtils.GnomeArchiveManager.isAvailable && (fileList.length === 1))
            return false;

        for (let item of fileList) {
            if (!this._desktopManager.autoAr.fileIsCompressed(item.fileName))
                return false;
        }
        return true;
    }

    _getExtractable() {
        let item = this._desktopManager.getCurrentSelection(false)[0];
        if (item)
            return this._decompressibleTypes.includes(item.attributeContentType);
        else
            return false;
    }

    _mailFilesFromSelection() {
        if (this._desktopManager.checkIfSpecialFilesAreSelected())
            return;
        const pathnameArray = [];
        this._desktopManager.getCurrentSelection(false).forEach(f => {
            pathnameArray.push(f.file.get_path());
        });

        if (this._desktopManager.checkIfDirectoryIsSelected()) {
            this._mailzippedFilesFromSelection(pathnameArray).catch(e => console.error(e));
            return;
        }
        this._xdgEmailFiles(pathnameArray);
        this._desktopManager.unselectAll();
    }

    _xdgEmailFiles(pathnameArray) {
        const xdgEmailCommand = GLib.find_program_in_path(this.Enums.XDG_EMAIL_CMD);
        if (!xdgEmailCommand) {
            console.log('xdg-email command not installed, cannot send email');
            const header = _('Mail Error');
            const text = _('Unable to find xdg-email, please install the program');
            this.dbusManager.doNotify(header, text);
            return;
        }
        const args = [xdgEmailCommand, this.Enums.XDG_EMAIL_CMD_OPTIONS];
        try {
            this.DesktopIconsUtil.trySpawn(null, args.concat(pathnameArray));
        } catch (e) {
            console.log(`Error emailing Files, ${e}`);
            const header = _('Mail Error');
            const text = _('There was an error in emailing Files');
            this.dbusManager.doNotify(header, text);
        }
    }

    _makezippedArchive(pathnameArray) {
        const zipCommand = GLib.find_program_in_path(this.Enums.ZIP_CMD);
        if (!zipCommand) {
            console.log('zip command not installed, cannot send email');
            const header = _('Mail Error');
            const text = _('Unable to find zip command, please install the program');
            this.dbusManager.doNotify(header, text);
            return null;
        }

        // Translators - basename for a zipped archive created for mailing
        const archiveName = _('Archive.zip');

        let archiveFile;
        let checkDir;
        do {
            const randomString = GLib.uuid_string_random().slice(0, 5);
            const dir = `/tmp/gtk4-ding-${randomString}`;
            archiveFile = `${dir}/${archiveName}`;
            checkDir = Gio.File.new_for_commandline_arg(dir);
        } while (!checkDir.make_directory(null));

        const args = [zipCommand, this.Enums.ZIP_CMD_OPTIONS, archiveFile];
        try {
            const async = false;
            const env = null;
            const workdir = this.DesktopIconsUtil.getDesktopDir().get_path();
            const relativePathArray = pathnameArray.map(f => GLib.path_get_basename(f));
            this.DesktopIconsUtil.trySpawn(workdir, args.concat(relativePathArray), env, async);
        } catch (e) {
            console.log(`Error Zipping Files, ${e}`);
            const header = _('Mail Error');
            const text = _('There was an error in creating a zip archive');
            this.dbusManager.doNotify(header, text);
        }

        if (Gio.File.new_for_commandline_arg(archiveFile).query_exists(null))
            return archiveFile;
        else
            return null;
    }

    async _mailzippedFilesFromSelection(pathnameArray) {
        this._textEntryAccelsTurnOff();
        const chooser = new Gtk.AlertDialog();
        chooser.set_message(_('Can not email a Directory'));
        chooser.set_detail(_('Selection includes a Directory, compress to a .zip file first?'));
        chooser.buttons = [_('Cancel'), _('OK')];
        chooser.set_modal(true);
        chooser.set_cancel_button(0);
        chooser.set_default_button(1);
        await chooser.choose(this.activeFileItem._grid._window, null, (actor, choice) => {
            const buttonpress = actor.choose_finish(choice);
            if (buttonpress === 1) {
                const archive = this._makezippedArchive(pathnameArray);
                if (archive)
                    this._xdgEmailFiles([archive]);
            }
            this._desktopManager.unselectAll();
        });
        this._textEntryAccelsTurnOn();
    }

    _doCompressFilesFromSelection() {
        let desktopFolder = this.DesktopIconsUtil.getDesktopDir();
        if (desktopFolder) {
            if (this.DBusUtils.GnomeArchiveManager.isAvailable) {
                const toCompress = this._desktopManager.getCurrentSelection(true);
                this.DBusUtils.RemoteFileOperations.CompressRemote(toCompress, desktopFolder.get_uri(), true);
            } else {
                const toCompress = this._desktopManager.getCurrentSelection(false);
                this._desktopManager.autoAr.compressFileItems(toCompress, desktopFolder.get_path());
            }
        }
        this._desktopManager.unselectAll();
    }

    async _doNewFolderFromSelection(assignedposition = null, clickedItem, event) {
        if (!clickedItem)
            return;

        let position = assignedposition ? assignedposition  : clickedItem.savedCoordinates;
        let newFolderFileItems = this._desktopManager.getCurrentSelection(true);
        this._desktopManager.unselectAll();
        clickedItem.removeFromGrid({callOnDestroy: false});
        const newFolder = await this._desktopManager.doNewFolder(position);
        if (newFolder) {
            this.DBusUtils.RemoteFileOperations.pushEvent(event);
            this.DBusUtils.RemoteFileOperations.MoveURIsRemote(newFolderFileItems, newFolder);
        }
    }

    _makeLinks() {
        let desktopFolder = this.DesktopIconsUtil.getDesktopDir();
        const toLink = this._desktopManager.getCurrentSelection(true);
        let [X, Y] = this.activeFileItem.getCoordinates().slice(0, 2);
        if (!this._desktopManager.checkIfSpecialFilesAreSelected() && toLink.length)
            this._desktopManager.makeLinks(toLink, desktopFolder.get_uri(), X, Y);
    }

    _onScriptClicked(menuItemPath) {
        let pathList = 'NAUTILUS_SCRIPT_SELECTED_FILE_PATHS=';
        let uriList = 'NAUTILUS_SCRIPT_SELECTED_URIS=';
        let currentUri = `NAUTILUS_SCRIPT_CURRENT_URI=${this.DesktopIconsUtil.getDesktopDir().get_uri()}`;
        let params = [menuItemPath];
        for (let item of this._desktopManager.getCurrentSelection(false)) {
            if (!item.isSpecial) {
                pathList += `${item.file.get_path()}\n`;
                uriList += `${item.file.get_uri()}\n`;
                params.push(item.file.get_path());
            }
        }

        let environ = this.DesktopIconsUtil.getFilteredEnviron();
        environ.push(pathList);
        environ.push(uriList);
        environ.push(currentUri);
        this.DesktopIconsUtil.trySpawn(null, params, environ);
    }

    launchTerminal(fileItemPath = null, commandLine = null) {
        let workingdir = fileItemPath ? fileItemPath : this.DesktopIconsUtil.getDesktopDir().get_path();
        const xdgTerminalExec = GLib.find_program_in_path(this._Enums.XDG_TERMINAL_EXEC);
        let success = false;

        if (xdgTerminalExec) {
            try {
                commandLine = commandLine ? commandLine : '';
                const [args] = GLib.shell_parse_argv(`${xdgTerminalExec} ${commandLine}`).slice(1);
                this.DesktopIconsUtil.trySpawn(workingdir, args, null);
                console.log('Executed xdg-terminal-exec');
                success = true;
            } catch (e) {
                console.log(`Error opening xdg-terminal-exec ${e}`);
                success = false;
            }
        }

        if (success)
            return;

        if (this.Prefs.Terminal) {
            this.Prefs.TerminalGioList.some(t => {
                const exec = t.get_string(this._Enums.DESKTOPFILE_TERMINAL_EXEC_KEY);
                let execswitch = t.get_string(this._Enums.DESKTOPFILE_TERMINAL_EXEC_SWITCH);
                execswitch = execswitch ? execswitch : '-e';
                commandLine = commandLine ? `${execswitch} ${commandLine}` : '';
                let [args] = GLib.shell_parse_argv(`${exec} ${commandLine}`).slice(1);
                try {
                    this.DesktopIconsUtil.trySpawn(workingdir, args, null);
                    success = true;
                } catch (e) {
                    console.log(`{Error opening ${t.get_string('Name')}, ${e}`);
                    success = false;
                }
                return success;
            });
        } else {
            const header = _('Unable to Open in Gnome Console');
            const text = _('Please Install Gnome Console or other Terminal Program');
            this._desktopManager.dbusManager.doNotify(header, text);
        }

        if (success)
            return;

        const header = _('Unable to Open {0}').replace('{0}', this.Prefs.TerminalName);
        const text = _('Please Install {0}').replace('{0}', this.Prefs.TerminalName);
        this._desktopManager.dbusManager.doNotify(header, text);
    }

    _textEntryAccelsTurnOff() {
        this._desktopManager.textEntryAccelsTurnOff();
    }

    _textEntryAccelsTurnOn() {
        this._desktopManager.textEntryAccelsTurnOn();
    }
};
