/* eslint-disable no-unused-vars */
/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2024 Sundeep Mediratta (smedius@gmail.com)
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

export const ICON_SIZE = {'tiny': 36, 'small': 48, 'standard': 64, 'large': 96};
export const ICON_WIDTH = {'tiny': 70, 'small': 90, 'standard': 120, 'large': 130};
export const ICON_HEIGHT = {'tiny': 80, 'small': 90, 'standard': 106, 'large': 138};

export const START_CORNER = {
    'top-left': [false, false],
    'top-right': [true, false],
    'bottom-left': [false, true],
    'bottom-right': [true, true],
};

export const FileType = {
    NONE: null,
    USER_DIRECTORY_HOME: 'show-home',
    USER_DIRECTORY_TRASH: 'show-trash',
    EXTERNAL_DRIVE: 'external-drive',
    STACK_TOP: 'stack-top',
};

export const StoredCoordinates = {
    PRESERVE: 0,
    OVERWRITE: 1,
    ASSIGN: 2,
};

export const Selection = {
    ALONE: 0,
    WITH_SHIFT: 1,
    RIGHT_BUTTON: 2,
    ENTER: 3,
    LEAVE: 4,
    RELEASE: 5,
};

/* From NautilusFileUndoManagerState */
export const UndoStatus = {
    NONE: 0,
    UNDO: 1,
    REDO: 2,
};

export const FileExistOperation = {
    ASK: 0,
    OVERWRITE: 1,
    RENAME: 2,
    SKIP: 3,
};

export const WhatToDoWithExecutable = {
    EXECUTE: 0,
    EXECUTE_IN_TERMINAL: 1,
    DISPLAY: 2,
    CANCEL: 3,
};

export const SortOrder = {
    ORDER: 'arrangeorder',
    NAME: 1,
    DESCENDINGNAME: 2,
    MODIFIEDTIME: 3,
    KIND: 4,
    SIZE: 5,
};

export const CompressionType = {
    ZIP: 0,
    TAR_XZ: 1,
    SEVEN_ZIP: 2,
    ENCRYPTED_ZIP: 3,
};

export const DndTargetInfo = {
    DING_ICON_LIST: 'x-special/ding-icon-list',
    GNOME_ICON_LIST: 'x-special/gnome-icon-list',
    URI_LIST: 'text/uri-list',
    TEXT_PLAIN: 'text/plain;charset=utf-8',
    GDKFILELIST: 'GdkFileList',
    GCHARARRAY: 'gchararray',
    GFILE: 'GFile',
    MIME_TYPES: ['x-special/ding-icon-list', 'x-special/gnome-icon-list', 'text/uri-list', 'text/plain;charset=utf-8'],
};

export const ShellDropCursor = {
    DEFAULT: 'default',
    NODROP: 'dndNoDropCursor',
    COPY: 'dndCopyCursor',
    MOVE: 'dndMoveCursor',
};

export const DEFAULT_ATTRIBUTES = 'metadata::*,standard::*,access::*,time::modified,unix::mode';
export const TERMINAL_SCHEMA = 'org.gnome.desktop.default-applications.terminal';
export const SCHEMA_NAUTILUS = 'org.gnome.nautilus.preferences';
export const SCHEMA_NAUTILUS_COMPRESSION = 'org.gnome.nautilus.compression';
export const SCHEMA_GTK = 'org.gtk.Settings.FileChooser';
export const SCHEMA = 'org.gnome.shell.extensions.gtk4-ding';
export const SCHEMA_MUTTER = 'org.gnome.mutter';
export const SCHEMA_GNOME_SETTINGS = 'org.gnome.desktop.interface';
export const DCONF_TERMINAL_EXEC_KEY = 'exec';
export const DCONF_TERMINAL_EXEC_STRING = 'exec-arg';
export const DESKTOPFILE_TERMINAL_EXEC_KEY = 'Exec';
export const DESKTOPFILE_TERMINAL_EXEC_SWITCH = 'X-ExecArg';
export const NAUTILUS_SCRIPTS_DIR = '.local/share/nautilus/scripts';
export const THUMBNAILS_DIR = '.cache/thumbnails';
export const DND_HOVER_TIMEOUT = 1500; // In milliseconds
export const DND_SHELL_HOVER_POLL = 200; // In milliseconds
export const TOOLTIP_HOVER_TIMEOUT = 1000; // In milliseconds
export const XDG_EMAIL_CMD = 'xdg-email';
export const XDG_EMAIL_CMD_OPTIONS = '--attach';
export const ZIP_CMD = 'zip';
export const ZIP_CMD_OPTIONS = '-r';
export const XDG_TERMINAL_LIST_FILE = 'xdg-terminals.list';
export const XDG_TERMINAL_DIR = 'xdg-terminals';
export const SYSTEM_DATA_DIRS = ['/usr/local/share', '/usr/share'];
export const XDG_TERMINAL_EXEC = 'xdg-terminal-exec';
export const GRID_ELEMENT_SPACING = 2;
export const GRID_PADDING = 0;
export const UnixPermissions = {
    S_ISUID: 0o04000, // set-user-ID bit
    S_ISGID: 0o02000, // set-group-ID bit (see below)
    S_ISVTX: 0o01000, // sticky bit (see below)

    S_IRWXU: 0o00700, // mask for file owner permissions
    S_IRUSR: 0o00400, // owner has read permission
    S_IWUSR: 0o00200, // owner has write permission
    S_IXUSR: 0o00100, // owner has execute permission

    S_IRWXG: 0o00070, // mask for group permissions
    S_IRGRP: 0o00040, // group has read permission
    S_IWGRP: 0o00020, // group has write permission
    S_IXGRP: 0o00010, // group has execute permission

    S_IRWXO: 0o00007, // mask for permissions for others (not in group)
    S_IROTH: 0o00004, // others have read permission
    S_IWOTH: 0o00002, // others have write permission
    S_IXOTH: 0o00001, // others have execute permission
    // From https://www.commandlinux.com/man-page/man2/lstat.2.html
};
export const IgnoreKeys = [
    'KEY_space', 'KEY_Shift_L', 'KEY_Shift_R', 'KEY_Control_L',
    'KEY_Control_R', 'KEY_Caps_Lock', 'KEY_Shift_Lock', 'KEY_Meta_L',
    'KEY_Meta_R', 'KEY_Alt_L', 'KEY_Alt_R', 'KEY_Super_L',
    'KEY_Super_R', 'KEY_ISO_Level3_Shift', 'KEY_ISO_Level5_Shift',
];
