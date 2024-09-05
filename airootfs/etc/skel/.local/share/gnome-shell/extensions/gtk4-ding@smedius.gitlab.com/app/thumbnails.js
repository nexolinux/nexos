/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2022 Sundeep Mediratta (smedius@gmail.com) port to work with
 * gnome desktop 3 or 4 so as to communicate over dbus.
 *
 * Code cherry picked from Marco Trevisan for async methods to generate icons.
 *
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
import {GLib, Gio, GnomeDesktop} from '../dependencies/gi.js';

export {ThumbnailLoader};

const useAsyncAPI =
    !!GnomeDesktop.DesktopThumbnailFactory.prototype.generate_thumbnail_async;

if (useAsyncAPI) {
    Gio._promisify(GnomeDesktop.DesktopThumbnailFactory.prototype,
        'generate_thumbnail_async',
        'generate_thumbnail_finish');
    Gio._promisify(GnomeDesktop.DesktopThumbnailFactory.prototype,
        'create_failed_thumbnail_async',
        'create_failed_thumbnail_finish');
    Gio._promisify(GnomeDesktop.DesktopThumbnailFactory.prototype,
        'save_thumbnail_async',
        'save_thumbnail_finish');
}

const ThumbnailLoader = class {
    constructor(codePath, FileUtils) {
        this.FileUtils = FileUtils;
        this._timeoutValue = 5000;
        this._codePath = codePath;
        this._thumbnailFactory = GnomeDesktop.DesktopThumbnailFactory.new(GnomeDesktop.DesktopThumbnailSize.LARGE);
        if (useAsyncAPI)
            console.log('Detected async api for thumbnails');
        else
            console.log('Failed to detected async api for thumbnails');
        this.standardThumbnailsFolder = GLib.build_filenamev([GLib.get_home_dir(), '.cache/thumbnails']);
        this.standardThumbnailSubFolders = ['large', 'normal'];
        this.gimpSnapThumbnailsFolder = GLib.build_filenamev([GLib.get_home_dir(), 'snap/common/gimp', '.cache/thumbnails']);
        this.gimpFlatPackThumbnailsFolder = GLib.build_filenamev([GLib.get_home_dir(), '.var/app/org.gimp.GIMP', 'cache/thumbnails']);
        this.md5Hasher = GLib.Checksum.new(GLib.ChecksumType.MD5);
        this.textCoder = new TextEncoder();
    }

    async _generateThumbnail(file, cancellable) {
        if (!await this.FileUtils.queryExists(file.file))
            return null;

        if (this._thumbnailFactory.has_valid_failed_thumbnail(file.uri, file.modifiedTime))
            return null;

        if (useAsyncAPI) {
            if (!await this._createThumbnailAsync(file, cancellable))
                return null;
        } else if (!await this._createThumbnailSubprocess(file, cancellable)) {
            return null;
        }

        if (cancellable.is_cancelled())
            return null;

        return this._thumbnailFactory.lookup(file.uri, file.modifiedTime);
    }

    async _createThumbnailAsync(file, cancellable) {
        let gotTimeout = false;
        let timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._timeoutValue, () => {
            console.log(`Timeout while generating thumbnail for ${file.displayName}`);
            timeoutId = 0;
            gotTimeout = true;
            cancellable.cancel();
            return GLib.SOURCE_REMOVE;
        });

        let modifiedTime;
        let fileInfo;
        try {
            fileInfo = await file.file.query_info_async('standard::content-type,time::modified',
                Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, cancellable);
            modifiedTime = fileInfo.get_attribute_uint64('time::modified');
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                console.error(e, `Error while creating thumbnail: ${e.message}`);
            return false;
        }

        try {
            const thumbnailPixbuf = await this._thumbnailFactory.generate_thumbnail_async(
                file.uri, fileInfo.get_content_type(), cancellable);
            await this._thumbnailFactory.save_thumbnail_async(thumbnailPixbuf,
                file.uri, modifiedTime, cancellable);
            return true;
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                console.error(e, `Error while creating thumbnail: ${e.message}`);
            await this._createFailedThumbnailAsync(file, modifiedTime,
                gotTimeout && cancellable.is_cancelled() ? null : cancellable);
        } finally {
            if (timeoutId)
                GLib.source_remove(timeoutId);
        }

        return false;
    }

    async _createFailedThumbnailAsync(file, modifiedTime, cancellable) {
        try {
            await this._thumbnailFactory.create_failed_thumbnail_async(file.uri,
                modifiedTime, cancellable);
        } catch (e) {
            console.error(e, `Error while creating failed thumbnail: ${e.message}`);
        }
    }

    async _createThumbnailSubprocess(file, cancellable) {
        const args = [];
        args.push(GLib.build_filenamev([this._codePath, 'createThumbnail.js']));
        args.push(file.path);
        const proc = new Gio.Subprocess({argv: args});

        let timeoutID = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._timeoutValue, () => {
            console.log(`Timeout while generating thumbnail for ${file.displayName}`);
            timeoutID = 0;
            proc.force_exit();
            this._thumbnailFactory.create_failed_thumbnail(file.uri, file.modifiedTime);
            return GLib.SOURCE_REMOVE;
        });

        proc.init(null);

        try {
            await proc.wait_check_async(cancellable);
            return proc.get_status() === 0;
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                console.error(e, `Failed to generate thumbnail for ${file.displayName}: ${e.message}`);
        } finally {
            if (timeoutID)
                GLib.source_remove(timeoutID);
        }

        return false;
    }

    /*
     * ExtraCode to find thumbnail in the thumbnail Folder
     * Was Used to find GIMP thumbnails, however ThumbnailFactoryNormal can now find it.
     * However to do that you have to start two ThumbnailFactories, this is simpler and lighter
     * Can be used to search arbitrary folders for thumbnails in Futre if necessary, not just Subfolders
    */

    _findThumbnail(file, basePath, subFolders = null, cancellable) {
        if (!basePath)
            return null;

        let md5FileUriHash = this._getMD5Hash(file.uri);
        if (!md5FileUriHash)
            return null;

        let thumbnailMD5Name = `${md5FileUriHash}.png`;
        let thumbnailFilePath = null;
        let thumbnailFileSearchPath = null;

        if (subFolders) {
            for (const subfolder of subFolders) {
                thumbnailFileSearchPath = GLib.build_filenamev([basePath, subfolder, thumbnailMD5Name]);
                if (Gio.File.new_for_path(thumbnailFileSearchPath).query_exists(cancellable)) {
                    thumbnailFilePath = thumbnailFileSearchPath;
                    break;
                }
            }
            return thumbnailFilePath;
        }

        thumbnailFileSearchPath = GLib.build_filenamev([basePath, thumbnailMD5Name]);
        if (Gio.File.new_for_path(thumbnailFileSearchPath).query_exists(cancellable))
            thumbnailFilePath = thumbnailFileSearchPath;
        return thumbnailFilePath;
    }

    _getMD5Hash(string) {
        let hashString = null;
        this.md5Hasher.update(this.textCoder.encode(string));
        hashString = this.md5Hasher.get_string();
        this.md5Hasher.reset();
        return hashString;
    }

    canThumbnail(file) {
        return this._thumbnailFactory.can_thumbnail(file.uri,
            file.attributeContentType,
            file.modifiedTime);
    }

    _lookupThumbnail(file, cancellable) {
        let thumbnail = null;
        // do searches for only special cases to conserve resources //
        if (file.attributeContentType === 'image/x-xcf') {
            // lets do a local search in thumbnails dir, look only in normal subfolder as we already searched large
            thumbnail = this._findThumbnail(file, this.standardThumbnailsFolder, ['normal'], cancellable);
            if (thumbnail)
                return thumbnail;

            // we can now search far and wide in snaps and flatpacks if we want.
            thumbnail = this._findThumbnail(file, this.gimpSnapThumbnailsFolder, this.standardThumbnailSubFolders, cancellable);
            if (!thumbnail)
                thumbnail = this._findThumbnail(file, this.gimpFlatPackThumbnailsFolder, this.standardThumbnailSubFolders, cancellable);
            return thumbnail;
        }
        return thumbnail;
    }

    hasThumbnail(file, cancellable) {
        let thumbnail = this._thumbnailFactory.lookup(file.uri, file.modifiedTime);
        if (thumbnail)
            return thumbnail;
        thumbnail = this._lookupThumbnail(file, cancellable);
        if (thumbnail)
            return thumbnail;
        else
            return null;
    }

    async getThumbnail(file, cancellable) {
        try {
            let thumbnail = this.hasThumbnail(file, cancellable);
            if (!thumbnail && this.canThumbnail(file))
                thumbnail = await this._generateThumbnail(file, cancellable);
            return thumbnail;
        } catch (error) {
            console.log(`Error when asking for a thumbnail for ${file.displayName}: ${error.message}\n${error.stack}`);
        }
        return null;
    }
};
