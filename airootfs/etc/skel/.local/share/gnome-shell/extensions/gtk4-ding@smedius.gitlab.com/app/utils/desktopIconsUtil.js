/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2022 Sundeep Mediratta - eslint fix errors and format GJS/Gnome guidelines
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
import {Gio, GLib, Gdk} from '../../dependencies/gi.js';
import {_} from '../../dependencies/gettext.js';

export {DesktopIconsUtil};

const DesktopIconsUtil = class {
    constructor(Data, Utils) {
        this.applicationid = Data.dingApp;
        this.Enums = Data.Enums;
        this.FileUtils = Utils.FileUtils;
        this.Prefs = Utils.Preferences;
    }


    /**
     * Returs the Gtk Application ID
     */
    getApplicationID() {
        return this.applicationid;
    }


    usingX11() {
        return Gdk.Display.get_default().constructor.$gtype.name === 'GdkX11Display';
    }

    /**
     *
     * Returns the user desktop directory as a Gio.File
     */
    getDesktopDir() {
        let desktopPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
        return Gio.File.new_for_commandline_arg(desktopPath);
    }


    /**
     *
     * Returns the Nautilus scripts directory as a Gio.File
     */
    getScriptsDir() {
        let scriptsDir =  GLib.build_filenamev([GLib.get_home_dir(), this.Enums.NAUTILUS_SCRIPTS_DIR]);
        return Gio.File.new_for_commandline_arg(scriptsDir);
    }

    getUserTerminalConfFile() {
        const xdgUserConfigFolder = GLib.get_user_config_dir();
        const xdgUserTerminalListFile = GLib.build_filenamev([xdgUserConfigFolder,
            this.Enums.XDG_TERMINAL_LIST_FILE]);
        return Gio.File.new_for_commandline_arg(xdgUserTerminalListFile);
    }

    getSystemTerminalConfFile() {
        const xdgEtcConfigFolder = GLib.get_system_config_dirs();
        const systemTerminalConfFiles = [];
        xdgEtcConfigFolder.forEach(f => {
            const xdgSystemTerminalListFile = GLib.build_filenamev([f,
                this.Enums.XDG_TERMINAL_LIST_FILE]);
            const gioFile = Gio.File.new_for_commandline_arg(xdgSystemTerminalListFile);
            systemTerminalConfFiles.push(gioFile);
        });
        return systemTerminalConfFiles;
    }

    getUserDataTerminalDir() {
        const userDataDir = GLib.get_user_data_dir();
        const terminalDir = GLib.build_filenamev([userDataDir, this.Enums.XDG_TERMINAL_DIR]);
        return Gio.File.new_for_commandline_arg(terminalDir);
    }

    getSystemDataTerminalDirs() {
        const systemDataDirs = this.Enums.SYSTEM_DATA_DIRS;
        const systemDataTerminalFiles = [];
        systemDataDirs.forEach(f => {
            const file = GLib.build_filenamev([f, this.Enums.XDG_TERMINAL_DIR]);
            const gioFile = Gio.File.new_for_commandline_arg(file);
            systemDataTerminalFiles.push(gioFile);
        });
        return systemDataTerminalFiles;
    }

    /**
     *
     * Returns the users Templates directory as a Gio.File
     */
    getTemplatesDir() {
        let templatesDir = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_TEMPLATES);
        if ((templatesDir === GLib.get_home_dir()) || (templatesDir === null))
            return null;

        return Gio.File.new_for_commandline_arg(templatesDir);
    }


    /**
     *
     * @param {float} value number
     * @param {integer}  min number
     * @param {integer} max number
     */
    clamp(value, min, max) {
        return Math.max(Math.min(value, max), min);
    }


    /**
     *
     */
    getFilteredEnviron() {
        let environ = [];
        for (let env of GLib.get_environ()) {
            /* It's a must to remove the WAYLAND_SOCKET environment variable
                because, under Wayland, DING uses an specific socket to allow the
                extension to detect its windows. But the scripts must run under
                the normal socket */
            if (env.startsWith('WAYLAND_SOCKET='))
                continue;

            environ.push(env);
        }
        return environ;
    }


    /**
     *
     * @param {string} commandLine command to execute
     * @param {Array} environ child's environment, or <code>null</code> to inherit parent's
     */
    spawnCommandLine(commandLine, environ = null) {
        try {
            const [, argv] = GLib.shell_parse_argv(commandLine);
            this.trySpawn(null, argv, environ);
        } catch (e) {
            console.error(e, `${commandLine} failed with ${e}`);
        }
    }

    /**
     *
     * @param {string} workdir working directory path
     * @param  {Array(String)} argv child's argument vector
     * @param {Array} environ child's environment, or <code>null</code> to inherit parent's
     * @param {bool}  async or async execution
     */
    trySpawn(workdir, argv, environ = null, async = true) {
        /* The following code has been extracted from GNOME Shell's
         * source code in Misc.Util.trySpawn function and modified to
         * set the working directory.
         *
         * https://gitlab.gnome.org/GNOME/gnome-shell/blob/gnome-3-30/js/misc/util.js
         */
        const exec = async ? GLib.spawn_async : GLib.spawn_sync;
        const flags = async ? GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD
            : GLib.SpawnFlags.SEARCH_PATH;
        var pid;
        try {
            [, pid] = exec(workdir, argv, environ, flags,
                () => {});
        } catch (err) {
            /* Rewrite the error in case of ENOENT */
            if (err.matches(GLib.SpawnError, GLib.SpawnError.NOENT)) {
                throw new GLib.SpawnError({
                    code: GLib.SpawnError.NOENT,
                    message: _('Command not found'),
                });
            } else if (err instanceof GLib.Error) {
                // The exception from gjs contains an error string like:
                //   Error invoking GLib.spawn_command_line_async: Failed to
                //   execute child process "foo" (No such file or directory)
                // We are only interested in the part in the parentheses. (And
                // we can't pattern match the text, since it gets localized.)
                let message = err.message.replace(/.*\((.+)\)/, '$1');
                throw new err.constructor({
                    code: err.code,
                    message,
                });
            } else {
                throw err;
            }
        }

        if (!async)
            return;

        // Dummy child watch; we don't want to double-fork internally
        // because then we lose the parent-child relationship, which
        // can break polkit.  See https://bugzilla.redhat.com//show_bug.cgi?id=819275
        GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, () => {});
    }


    /**
     *
     * @param {float} x first x coordinate
     * @param {float} y first y coordinate
     * @param {float} x2 second x coordinate
     * @param {float} y2 second y coordinate
     * @returns {float} Distance between points
     */
    distanceBetweenPoints(x, y, x2, y2) {
        return Math.pow(x - x2, 2) + Math.pow(y - y2, 2);
    }


    /**
     *
     */
    getExtraFolders() {
        const extraFolders = [];
        if (this.Prefs.desktopSettings.get_boolean('show-home'))
            extraFolders.push([Gio.File.new_for_commandline_arg(GLib.get_home_dir()), this.Enums.FileType.USER_DIRECTORY_HOME]);

        if (this.Prefs.desktopSettings.get_boolean('show-trash'))
            extraFolders.push([Gio.File.new_for_uri('trash:///'), this.Enums.FileType.USER_DIRECTORY_TRASH]);

        return extraFolders;
    }


    /**
     *
     * @param {Gio.VolumeMonitor} volumeMonitor A Gio.VolumeMonitor
     */
    getMounts(volumeMonitor) {
        const showVolumes = this.Prefs.desktopSettings.get_boolean('show-volumes');
        const showNetwork = this.Prefs.desktopSettings.get_boolean('show-network-volumes');
        var mountedFileSystems;

        try {
            mountedFileSystems = volumeMonitor.get_mounts();
        } catch (e) {
            console.log(`Failed to get the list of mounts with ${e}`);
            return [];
        }

        let result = [];
        let uris = [];
        for (let mount of mountedFileSystems) {
            try {
                let isDrive = (mount.get_drive() !== null) || (mount.get_volume() !== null);
                let uri = mount.get_default_location().get_uri();
                if (((isDrive && showVolumes) || (!isDrive && showNetwork)) && !uris.includes(uri)) {
                    result.push([mount.get_default_location(), this.Enums.FileType.EXTERNAL_DRIVE, mount]);
                    uris.push(uri);
                }
            } catch (e) {
                console.log(`Failed with ${e} while getting volume`);
            }
        }
        return result;
    }


    /**
     *
     * @param {string} filename Name of file
     * @param {object} opts Oject with boolean option keys
     */
    getFileExtensionOffset(filename, opts = {'isDirectory': false}) {
        let offset = filename.length;
        let extension = '';
        if (!opts.isDirectory) {
            const doubleExtensions = ['.gz', '.bz2', '.sit', '.Z', '.bz', '.xz'];
            for (const item of doubleExtensions) {
                if (filename.endsWith(item)) {
                    offset -= item.length;
                    extension = filename.substring(offset);
                    filename = filename.substring(0, offset);
                    break;
                }
            }
            let lastDot = filename.lastIndexOf('.');
            if (lastDot > 0) {
                offset = lastDot;
                extension = filename.substring(offset) + extension;
                filename = filename.substring(0, offset);
            }
        }
        return {offset, 'basename': filename, extension};
    }


    /**
     *
     * @param {Gio.File} file a file Gio
     * @param {stirng} contents file contents
     * @param {Gio.Cancellable} cancellable gio cancellable
     */
    replaceFileContentsAsync(file, contents, cancellable) {
        /* Promisify doesn't work with this */
        const textCoder = new TextEncoder();
        const byteArray = new GLib.Bytes(textCoder.encode(contents));

        return new Promise((resolve, reject) => {
            file.replace_contents_bytes_async(byteArray, null,
                true, Gio.FileCreateFlags.REPLACE_DESTINATION, cancellable, (sourceObject, res) => {
                    try {
                        resolve(file.replace_contents_finish(res));
                    } catch (e) {
                        reject(e);
                    }
                });
        });
    }

    /**
     *
     * @param {Gio.File} file a file Gio
     * @param {Gio.Cancellable} cancellable gio cancellable
     */
    readFileContentsAsync(file, cancellable = null) {
        return new Promise((resolve, reject) => {
            try {
                file.read_async(GLib.PRIORITY_DEFAULT, cancellable, (actor, result) => {
                    try {
                        let inputstream = actor.read_finish(result);
                        let dataInputstream = Gio.DataInputStream.new(inputstream);
                        let [string, number] = dataInputstream.read_upto('', 0, cancellable);
                        if (number)
                            resolve(string);
                        else
                            reject(Error.new('Empty String'));
                    } catch (e) {
                        reject(e);
                    }
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     *
     * @param {string} fileList text with list of Terminals, new line terminated
     * @returns {Array} an array of Gio.DesktopAppInfo for each desktop entry in file
     */
    parseTerminalList(fileList) {
        const regexpattern = /^[/\\*#]/;
        const terminalGioDesktopAppInfoArray = [];
        if (fileList.endsWith('\n'))
            fileList = fileList.slice(0, -1);
        const fileListArray = fileList.split('\n').filter(f => !f.match(regexpattern));
        if (fileListArray.length) {
            fileListArray.forEach(f => {
                const appinfo = Gio.DesktopAppInfo.new(f);
                if (appinfo)
                    terminalGioDesktopAppInfoArray.push(appinfo);
            });
        }
        return terminalGioDesktopAppInfoArray;
    }

    /**
     *
     * @param {string} text text to write in the file
     * @param {string} destinationDir path
     * @param {string} filename name of file
     * @param {Array(integer)} dropCoordinates coordiantes for the dropped file
     * @param {Gio.Cancellable} cancellable a Gio.Cancellable
     */
    async writeTextFileToPath(text, destinationDir, filename,
        dropCoordinates, cancellable = null) {
        const file = destinationDir.get_child(filename);

        try {
            await this.FileUtils.recursivelyMakeDir(destinationDir, cancellable);

            const info = new Gio.FileInfo();
            info.set_attribute_uint32(Gio.FILE_ATTRIBUTE_UNIX_MODE, 0o700);
            await destinationDir.set_attributes_async(info,
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_NORMAL,
                cancellable);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
                throw e;
        }

        await this.replaceFileContentsAsync(file, text, cancellable);

        if (dropCoordinates !== null) {
            const info = new Gio.FileInfo();
            info.set_attribute_string('metadata::nautilus-drop-position',
                `${dropCoordinates.join(',')}`);

            await file.set_attributes_async(info,
                Gio.FileQueryInfoFlags.NONE,
                GLib.PRIORITY_LOW,
                cancellable);
        }
    }

    /**
     *
     * @param {string} fileUri The system file URI of the .desktop file of the installed application
     * @param {Array} dropCoordinates the drop cooordinates of the .desktop file
     *
     * Makes an executable .desktop file on the desktop with metadata set trusted.
     */
    copyDesktopFileToDesktop(fileUri, dropCoordinates) {
        return new Promise((resolve, reject) => {
            let gioFile = Gio.File.new_for_uri(fileUri);
            let destinationGioFile = Gio.File.new_for_path(
                GLib.build_filenamev(
                    [GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP), gioFile.get_basename()]
                )
            );
            let gioFileCopyFlags = Gio.FileCopyFlags.OVERWRITE | Gio.FileCopyFlags.TARGET_DEFAULT_PERMS;
            gioFile.copy_async(
                destinationGioFile,
                gioFileCopyFlags,
                GLib.PRIORITY_LOW,
                null,
                null,
                (source, result) => {
                    try {
                        let res = source.copy_finish(result);
                        if (res) {
                            let info = new Gio.FileInfo();
                            if (dropCoordinates !== null)
                                info.set_attribute_string('metadata::nautilus-drop-position', `${dropCoordinates[0]},${dropCoordinates[1]}`);
                            let newUnixMode = this.Enums.UnixPermissions.S_IRUSR | this.Enums.UnixPermissions.S_IWUSR |
                                this.Enums.UnixPermissions.S_IXUSR | this.Enums.UnixPermissions.S_IRGRP |
                                this.Enums.UnixPermissions.S_IWGRP | this.Enums.UnixPermissions.S_IROTH;
                            info.set_attribute_uint32(Gio.FILE_ATTRIBUTE_UNIX_MODE, newUnixMode);
                            info.set_attribute_string('metadata::trusted', 'true');
                            destinationGioFile.set_attributes_async(
                                info,
                                Gio.FileQueryInfoFlags.NONE,
                                GLib.PRIORITY_LOW,
                                null,
                                (sour, resul) => {
                                    try {
                                        resolve(sour.set_attributes_finish(resul));
                                    } catch (error) {
                                        console.log(`Failed to make executable .desktop File: ${error.message}`);
                                        reject(error);
                                    }
                                }
                            );
                        }
                    } catch (e) {
                        console.error(e);
                        reject(e);
                    }
                }
            );
        });
    }

    /**
     *
     * @param {Gtk.Window} window The window
     * @param {boolean} modal If the window should be modal
     */
    windowHidePagerTaskbarModal(window, modal) {
        window.set_application(this.applicationid);
        let title = window.get_title();
        if (title === null)
            title = '';

        if (modal)
            title += '  ';
        else
            title += ' ';

        window.set_title(title);

        if (modal) {
            window.set_modal(true);
            window.grab_focus();
        }
    }

    /**
     *
     * @param {integer} ms milliseconds
     */
    waitDelayMs(ms) {
        return new Promise(resolve => {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
                resolve();
                return false;
            });
        });
    }


    /**
     * Coordiantes are the same
     *
     * @param {Array(integer)} coordA coordinates
     * @param {Array(integer)} coordB coordinates
     * @returns {boolean} true or false
     */
    coordinatesEqual(coordA, coordB) {
        if (coordA === coordB)
            return true;

        if (coordA && coordB)
            return (coordA[0] === coordB[0]) && (coordA[1] === coordB[1]);

        return false;
    }

    checkAppOpensFileType(gioDesktopAppInfo, fileUri = null, attributeContentType = null) {
        let Appname = gioDesktopAppInfo.get_name();
        let gioFileInfo;
        let AppsSupportingOpen = [];
        if (fileUri) {
            gioFileInfo = Gio.File.new_for_uri(fileUri).query_info(this.Enums.DEFAULT_ATTRIBUTES,
                Gio.FileQueryInfoFlags.NONE,
                null);
            AppsSupportingOpen = Gio.AppInfo.get_all_for_type(gioFileInfo.get_content_type());
        } else if (attributeContentType) {
            AppsSupportingOpen = Gio.AppInfo.get_all_for_type(attributeContentType);
        } else {
            return {canopenFile: false, Appname: 'None'};
        }
        AppsSupportingOpen = AppsSupportingOpen.map(f => f.get_name());
        let canopenFile;
        if (AppsSupportingOpen.includes(Appname))
            canopenFile = true;
        else
            canopenFile = false;
        return {canopenFile, Appname};
    }
};
