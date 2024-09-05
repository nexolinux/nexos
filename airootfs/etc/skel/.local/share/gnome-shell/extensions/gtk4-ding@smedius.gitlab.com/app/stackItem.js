
/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2021, Gtk4 port 2022 Sundeep Mediratta (smedius@gmail.com)
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 * Based on code original (C) Carlos Soriano
 * SwitcherooControl code based on code original from Marsch84
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
import {_} from '../dependencies/gettext.js';
import {Gtk} from '../dependencies/gi.js';
import * as DesktopIconItem from './desktopIconItem.js';

export {StackItem};

const Signals = imports.signals;

const StackItem = class extends DesktopIconItem.DesktopIconItem {
    constructor(desktopManager, file, attributeContentType, fileExtra) {
        super(desktopManager, fileExtra);
        this._isSpecial = false;
        this._file = file;
        this.isStackTop = true;
        this.stackUnique = false;
        this._size = null;
        this._modifiedTime = null;
        this._attributeContentType = attributeContentType;
        this._createIconActor();
        this._createStackTopIcon();
        const stackName = this._file;
        /** TRANSLATORS: when using a screen reader, this is the text read when a stack is
        selected. Example: if a stack named "pictures" is selected, it will say "Stack pictures" */
        const accessibleName = _('Stack');
        this._setLabelName(stackName);
        this.container.update_property([Gtk.AccessibleProperty.LABEL], [`${accessibleName} ${stackName}`]);
        this._savedCoordinates = null;
    }

    _createStackTopIcon() {
        let iconPaintable;
        let folder = 'folder';
        if (this.Prefs.UnstackList.includes(this._attributeContentType))
            folder = 'folder-open';

        iconPaintable = this._createEmblemedIcon(null, `${folder}`);
        this._icon.set_paintable(iconPaintable);
    }

    // eslint-disable-next-line no-unused-vars
    _doButtonOnePressed(button, X, Y, x, y, shiftPressed, controlPressed) {
        this._desktopManager.onToggleStackUnstackThisTypeClicked(this.attributeContentType);
    }

    setSelected() {
        this.container.grab_focus();
    }

    unsetSelected() {
        this._keyboardUnSelected();
    }

    updateIcon() {
        this._createStackTopIcon();
    }

    keyboardSelected() {
        if (!this._iconContainer.get_css_classes().includes('mimic-hovered')) {
            this._iconContainer.add_css_class('mimic-hovered');
            this._labelContainer.add_css_class('mimic-hovered');
        }
    }

    _keyboardUnSelected() {
        if (this._iconContainer.get_css_classes().includes('mimic-hovered')) {
            this._iconContainer.remove_css_class('mimic-hovered');
            this._labelContainer.remove_css_class('mimic-hovered');
        }
    }

    /** *********************
     * Getters and setters *
     ***********************/

    get attributeContentType() {
        return this._attributeContentType;
    }

    get displayName() {
        return this._file;
    }

    get file() {
        return this._file;
    }

    get fileName() {
        return this._file;
    }

    get fileSize() {
        return this._size;
    }

    get isAllSelectable() {
        return false;
    }

    get modifiedTime() {
        return this._modifiedTime;
    }

    get path() {
        return `/tmp/${this._file}`;
    }

    get uri() {
        return `file:///tmp/${this._file}`;
    }

    get isStackMarker() {
        return true;
    }

    get savedCoordinates() {
        return this._savedCoordinates;
    }

    get x() {
        return this._x1;
    }

    get y() {
        return this._y1;
    }

    get X() {
        return this._savedCoordinates[0];
    }

    get Y() {
        return this._savedCoordinates[1];
    }

    set savedCoordinates(pos) {
        this._savedCoordinates = pos;
    }

    set size(size) {
        this._size = size;
    }

    set time(time) {
        this._modifiedTime = time;
    }
};
Signals.addSignalMethods(StackItem.prototype);
