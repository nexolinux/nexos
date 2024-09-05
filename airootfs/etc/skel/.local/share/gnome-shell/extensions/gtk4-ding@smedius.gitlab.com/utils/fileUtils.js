/* eslint-disable jsdoc/require-param-type */
/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2022 Marco Trevisan <marco.trevisan@canonical.com>
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
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const DEFAULT_ENUMERATE_BATCH_SIZE = 100;
const DEFAULT_QUERY_ATTRIBUTES = [
    Gio.FILE_ATTRIBUTE_STANDARD_NAME,
    Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
].join(',');

/**
 *
 * @param dir
 * @param cancellable
 * @param priority
 * @param queryAttributes
 */
export async function enumerateDir(dir, cancellable = null, priority = GLib.PRIORITY_DEFAULT,
    queryAttributes = DEFAULT_QUERY_ATTRIBUTES) {
    const childrenEnumerator = await dir.enumerate_children_async(queryAttributes,
        Gio.FileQueryInfoFlags.NONE, priority, cancellable);

    try {
        const children = [];
        while (true) {
            // The enumerator doesn't support multiple async calls, nor
            // we can predict how many they will be, so using Promise.all
            // isn't an option here, thus we just need to await each batch
            // eslint-disable-next-line no-await-in-loop
            const batch = await childrenEnumerator.next_files_async(
                DEFAULT_ENUMERATE_BATCH_SIZE, priority, cancellable);

            if (!batch.length)
                return children;

            children.push(...batch);
        }
    } finally {
        if (!childrenEnumerator.is_closed())
            await childrenEnumerator.close_async(priority, null);
    }
}

/**
 *
 * @param dir
 * @param deleteParent
 * @param cancellable
 * @param priority
 */
export async function recursivelyDeleteDir(dir, deleteParent, cancellable = null,
    priority = GLib.PRIORITY_DEFAULT) {
    const children = await enumerateDir(dir, cancellable, priority);
    for (let info of children)
        // eslint-disable-next-line no-await-in-loop
        await deleteFile(dir.get_child(info.get_name()), info, cancellable, priority);


    if (deleteParent)
        await dir.delete_async(priority, cancellable);
}

/**
 *
 * @param file
 * @param info
 * @param cancellable
 * @param priority
 */
export async function deleteFile(file, info = null, cancellable = null,
    priority = GLib.PRIORITY_DEFAULT) {
    if (!info) {
        info = await file.query_info_async(
            Gio.FILE_ATTRIBUTE_STANDARD_TYPE, Gio.FileQueryInfoFlags.NONE,
            priority, cancellable);
    }

    const type = info.get_file_type();
    if (type === Gio.FileType.REGULAR || type === Gio.FileType.SYMBOLIC_LINK) {
        await file.delete_async(priority, cancellable);
    } else if (type === Gio.FileType.DIRECTORY) {
        await recursivelyDeleteDir(file, true, cancellable, priority);
    } else {
        throw new GLib.Error(Gio.IOErrorEnum,
            Gio.IOErrorEnum.NOT_SUPPORTED,
            `${file.get_path()} of type ${type} cannot be removed`);
    }
}

/**
 *
 * @param file
 * @param cancellable
 * @param priority
 */
export async function queryExists(file, cancellable = null,
    priority = GLib.PRIORITY_DEFAULT) {
    try {
        await file.query_info_async(Gio.FILE_ATTRIBUTE_STANDARD_TYPE,
            Gio.FileQueryInfoFlags.NONE, priority, cancellable);
        return true;
    } catch (e) {
        if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
            throw e;
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            console.error(e);
        return false;
    }
}

/**
 *
 * @param dir
 * @param cancellable
 * @param priority
 */
export async function recursivelyMakeDir(dir, cancellable = null,
    priority = GLib.PRIORITY_DEFAULT) {
    try {
        await dir.make_directory_async(priority, cancellable);
    } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            throw e;
    }

    const missingDirs = [dir];
    for (let parent = dir.get_parent(); parent; parent = parent.get_parent()) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await parent.make_directory_async(priority, cancellable);
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
                break;
            else if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                missingDirs.unshift(parent);
            else
                throw e;
        }
    }

    // Sadly we must be sequential here, so we can't use Promise.all
    missingDirs.forEach(async direct => {
        try {
            await direct.make_directory_async(priority, cancellable);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
                throw e;
        }
    });
}
