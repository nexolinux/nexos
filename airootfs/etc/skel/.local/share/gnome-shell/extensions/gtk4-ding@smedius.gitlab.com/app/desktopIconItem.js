
/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Gtk4 Port Copyright (C) 2022 Sundeep Mediratta (smedius@gmail.com)
 * Copyright (C) 2021 Sundeep Mediratta (smedius@gmail.com)
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
import {Gtk, Gdk, Gio, GLib, Pango, GdkPixbuf} from '../dependencies/gi.js';
import {_} from '../dependencies/gettext.js';

export {DesktopIconItem};

const Signals = imports.signals;

const PIXBUF_CONTENT_TYPES = new Set();
GdkPixbuf.Pixbuf.get_formats().forEach(f => PIXBUF_CONTENT_TYPES.add(...f.get_mime_types()));

const DesktopIconItem = class {
    constructor(desktopManager, fileExtra) {
        this._desktopManager = desktopManager;
        this.DesktopIconsUtil = desktopManager.DesktopIconsUtil;
        this.FileUtils = desktopManager.FileUtils;
        this.Prefs = desktopManager.Prefs;
        this.Enums = desktopManager.Enums;
        this._fileExtra = fileExtra;
        this._queryFileInfoCancellable = null;
        this._grid = null;
        this._lastClickTime = 0;
        this._lastClickButton = 0;
        this._clickCount = 0;
        this._isSelected = false;
        this._isSpecial = false;
        this._savedCoordinates = null;
        this._dropCoordinates = null;
        this._destroyed = false;
        this.thumbnailFile = null;
    }

    /** *********************
     * Destroyers *
     ***********************/

    removeFromGrid(opts = {callOnDestroy: false}) {
        if (this._grid) {
            this._grid.removeItem(this);
            this._grid = null;
        }
        if (opts.callOnDestroy)
            this.onDestroy();
    }

    _destroy() {
        /* Regular file data */
        if (this._queryFileInfoCancellable)
            this._queryFileInfoCancellable.cancel();

        /* Icons update */
        if (this._updateIconCancellable)
            this._updateIconCancellable.cancel();

        /* Container */
        if (this._containerId) {
            this.container.disconnect(this._containerId);
            this._containerId = 0;
        }
        /* DragItem */
        if (this.dragIconSignal)
            this.dragIcon.disconnect(this.dragIconSignal);

        if (this._iconStateFlag)
            this._iconContainer.disconnect(this._iconStateFlag);

        if (this._labelStateFlag)
            this._labelContainer.disconnect(this._labelStateFlag);

        this._destroyToolTip();
    }

    onDestroy() {
        this._destroy();
        this._destroyed = true;
    }

    /** *********************
     * Creators *
     ***********************/

    _createIconActor() {
        this.container = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            halign: Gtk.Align.CENTER,
            focusable: true,
            can_focus: true,
            accessible_role: Gtk.AccessibleRole.LABEL,
        });
        this._containerId = this.container.connect('destroy', () => this.onDestroy());

        this._icon = new Gtk.Picture({
            can_shrink: false,
            keep_aspect_ratio: true,
            halign: Gtk.Align.CENTER,
        });

        this._iconContainer = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            halign: Gtk.Align.CENTER,
            hexpand: false,
            baseline_position: Gtk.BaselinePosition.CENTER,
        });
        this._iconContainer.append(this._icon);

        this._label = new Gtk.Label({
            halign: Gtk.Align.CENTER,
            natural_wrap_mode: Gtk.NaturalWrapMode.NONE,
            ellipsize: Pango.EllipsizeMode.END,
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD_CHAR,
            yalign: 0.0,
            xalign: 0.0,
            justify: Gtk.Justification.CENTER,
            lines: 2,
        });
        if (this.Prefs.darkText)
            this._label.add_css_class('file-label-dark');
        else
            this._label.add_css_class('file-label');

        this._labelContainer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            name: 'file-item',
        });

        this.iconRectangle = new Gdk.Rectangle();
        this.iconLocalWindowRectangle = new Gdk.Rectangle();
        this.labelRectangle = new Gdk.Rectangle();

        this._iconContainerEventController = new Gtk.EventControllerMotion({
            propagation_phase: Gtk.PropagationPhase.CAPTURE,
        });
        this._icon.add_controller(this._iconContainerEventController);
        this._iconContainerEventController.connect('enter', () => {
            this._showToolTip();
        });
        this._iconContainerEventController.connect('leave', () => {
            this._destroyToolTip();
        });

        // This controls how the icons look - Rectangular or skinny trapezoid

        if (!this.Prefs.freePositionIcons) {
            this._labelContainer.append(this._iconContainer);
            this._label.add_css_class('file-label-vertical');
            this._labelContainer.append(this._label);
            this.container.append(this._labelContainer);
        } else {
            this._labelContainer.append(this._label);
            this.container.append(this._iconContainer);
            this.container.append(this._labelContainer);
            this._iconStateFlag = this._iconContainer.connect('state-flags-changed', () => {
                if (this._checkHasHoveredPointer(this._iconContainer)) {
                    this._onEnter();
                    this._labelContainer.add_css_class('mimic-hovered');
                } else {
                    this._onLeave();
                    this._labelContainer.remove_css_class('mimic-hovered');
                }
            });
            this._iconContainer.set_name('file-item');
        }

        this._labelStateFlag = this._labelContainer.connect('state-flags-changed', () => {
            if (this._checkHasHoveredPointer(this._labelContainer)) {
                this._onEnter();
                if (this.Prefs.freePositionIcons)
                    this._iconContainer.add_css_class('mimic-hovered');
            } else {
                this._onLeave();
                if (this.Prefs.freePositionIcons)
                    this._iconContainer.remove_css_class('mimic-hovered');
            }
        });

        this.dragIcon = Gtk.WidgetPaintable.new(this.container);
        this.dragIconSignal = this.dragIcon.connect('invalidate-size', () => {
            this._doIconSizeAllocated();
        });

        this.container.show();
    }

    _doIconSizeAllocated() {
        // If icons are hidden during stacking, they are not assigned a grid //
        if (!this._grid)
            return;

        this._calculateIconRectangle();
        this._calculateLabelRectangle();
        this.iconPlacedPromiseResolve(true);
    }

    iconPlaced = new Promise(resolve => {
        this.iconPlacedPromiseResolve = resolve;
    });

    _calculateIconRectangle() {
        this.iconwidth = this._iconContainer.get_allocated_width();
        this.iconheight = this._iconContainer.get_allocated_height();
        let [x, y] = this._grid.coordinatesLocalToGlobal(0, 0, this._iconContainer);
        this.iconRectangle.x = x;
        this.iconRectangle.y = y;
        this.iconRectangle.width = this.iconwidth;
        this.iconRectangle.height = this.iconheight;
        this._calculateLocalWindowRectangle();
    }

    _calculateLocalWindowRectangle() {
        let [x, y] = this._grid.coordinatesLocalToWindow(0, 0, this._iconContainer);
        this.iconLocalWindowRectangle.x = x;
        this.iconLocalWindowRectangle.y = y;
        this.iconLocalWindowRectangle.width = this.iconwidth;
        this.iconLocalWindowRectangle.height = this.iconheight;
    }

    _calculateLabelRectangle() {
        this.labelwidth = this._labelContainer.get_allocated_width();
        this.labelheight = this._labelContainer.get_allocated_height();
        let [x, y] = this._grid.coordinatesLocalToGlobal(0, 0, this._labelContainer);
        this.labelRectangle.x = x;
        this.labelRectangle.y = y;
        this.labelRectangle.width = this.labelwidth;
        this.labelRectangle.height = this.labelheight;
    }

    setCoordinates(x, y, width, height, margin, grid) {
        this._x1 = x;
        this._y1 = y;
        this.width = width;
        this.height = height;
        this._grid = grid;
        this.container.set_size_request(width, height);
        this._label.margin_start = margin;
        this._label.margin_end = margin;
        this._label.margin_bottom = margin;
        this._iconContainer.margin_top = margin;
        this._calculateIconRectangle();
        this._calculateLabelRectangle();
    }

    getCoordinates() {
        this._x2 = this._x1 + this.container.get_allocated_width() - 1;
        this._y2 = this._y1 + this.container.get_allocated_height() - 1;
        return [this._x1, this._y1, this._x2, this._y2, this._grid];
    }

    _setLabelName(text) {
        this._currentFileName = text;
        this._label.label = text;
    }

    /** *********************
     * Button Clicks *
     ***********************/

    _checkHasHoveredPointer(widget) {
        let stateFlags = widget.get_state_flags();
        if ((stateFlags & Gtk.StateFlags.PRELIGHT) === Gtk.StateFlags.PRELIGHT)
            return true;
        else
            return false;
    }

    _updateClickState(button, eventtime) {
        const settings = Gtk.Settings.get_default();
        let doubleClickTime = settings.gtk_double_click_time;

        // Workaround for X11
        if (this.DesktopIconsUtil.usingX11) {
            eventtime = GLib.get_monotonic_time();
            doubleClickTime *= 1000;
        }

        if ((button === this._lastClickButton) &&
            ((eventtime - this._lastClickTime) < doubleClickTime))
            this._clickCount++;
        else
            this._clickCount = 1;

        this._lastClickTime = eventtime;
        this._lastClickButton = button;
    }

    getClickCount() {
        return this._clickCount;
    }

    _onPressButton(actor, X, Y, x, y, shiftPressed, controlPressed) {
        let button = actor.get_current_button();
        let eventtime = actor.get_current_event_time();
        this._updateClickState(button, eventtime);
        this._buttonPressInitialX = x - this._x1;
        this._buttonPressInitialY = y - this._y1;
        this._desktopManager.activeFileItem = this._desktopManager.fileItemMenu.activeFileItem = this;
        if (button === 3)
            this._doButtonThreePressed(button, X, Y, x, y, shiftPressed, controlPressed);
        else if (button === 1)
            this._doButtonOnePressed(button, X, Y, x, y, shiftPressed, controlPressed);
    }

    _onReleaseButton(actor, X, Y, x, y, shiftPressed, controlPressed) {
        let button = actor.get_current_button();
        this._grid?.makeTopLayerOnGrid(this);
        if (button === 1)
            this._doButtonOneReleased(button, X, Y, x, y, shiftPressed, controlPressed);
    }

    _doButtonThreePressed(button, X, Y, x, y, shiftPressed, controlPressed) {
        if (!this._isSelected)
            this._desktopManager.selected(this, this.Enums.Selection.RIGHT_BUTTON);
        this._destroyToolTip();
        this._desktopManager.fileItemMenu.showMenu(this, button, X, Y, x, y, shiftPressed, controlPressed);
    }

    _doButtonOnePressed(button, X, Y, x, y, shiftPressed, controlPressed) {
        if (this.getClickCount() === 1) {
            if (shiftPressed || controlPressed)
                this._desktopManager.selected(this, this.Enums.Selection.WITH_SHIFT);
            else
                this._desktopManager.selected(this, this.Enums.Selection.ALONE);
        }
    }

    // eslint-disable-next-line no-unused-vars
    _doButtonOneReleased(button, X, Y, x, y, shiftPressed, controlPressed) {
    }

    /** *********************
     * Drag and Drop *
     ***********************/

    _onEnter() {
        if (!this._grid)
            return true;
        if (this.Prefs.CLICK_POLICY_SINGLE) {
            let window = this._grid._window;
            if (window)
                window.set_cursor(Gdk.Cursor.new_from_name('hand', null));
        }
        return false;
    }

    _onLeave() {
        if (!this._grid)
            return true;
        if (this.Prefs.CLICK_POLICY_SINGLE) {
            let window = this._grid._window;
            if (window)
                window.set_cursor(Gdk.Cursor.new_from_name('default', null));
        }
        return false;
    }

    _showToolTip() {
        if (this._toolTipTimer)
            return;
        this._toolTipTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.Enums.TOOLTIP_HOVER_TIMEOUT, () => {
            this._desktopManager.fileItemMenu.showToolTip(this);
            this._toolTipTimer = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _destroyToolTip() {
        if (this._toolTipTimer) {
            GLib.Source.remove(this._toolTipTimer);
            this._toolTipTimer = 0;
        }
        this._desktopManager.fileItemMenu.hideToolTip(this);
    }

    _hasToRouteDragToGrid() {
        if (this._grid)
            return true;
        else
            return false;
    }

    _updateDragStatus(context, time) {
        if (this.DesktopIconsUtil.getModifiersInDnD(context, Gdk.ModifierType.CONTROL_MASK))
            Gdk.drag_status(context, Gdk.DragAction.COPY, time);
        else
            Gdk.drag_status(context, Gdk.DragAction.MOVE, time);
    }

    setHightLighted() {
        if (!this._iconContainer.get_css_classes().includes('desktop-icons-selected'))
            this._iconContainer.add_css_class('desktop-icons-selected');
        if (!this._labelContainer.get_css_classes().includes('desktop-icons-selected'))
            this._labelContainer.add_css_class('desktop-icons-selected');
    }

    setUnHighLighted() {
        if (this._iconContainer.get_css_classes().includes('desktop-icons-selected'))
            this._iconContainer.remove_css_class('desktop-icons-selected');
        if (this._labelContainer.get_css_classes().includes('desktop-icons-selected'))
            this._labelContainer.remove_css_class('desktop-icons-selected');
    }

    highLightDropTarget() {
        if (this._hasToRouteDragToGrid()) {
            this._grid.receiveMotion(this._x1, this._y1, true);
            return;
        }
        this.setHightLighted();
        this._grid.highLightGridAt(this._x1, this._y1);
    }

    unHighLightDropTarget() {
        if (this._hasToRouteDragToGrid()) {
            this._grid?.receiveLeave();
            return;
        }
        this.setUnHighLighted();
        this._grid?.unHighLightGrids();
    }

    setSelected() {
        this._isSelected = true;
        this._setSelectedStatus();
    }

    unsetSelected() {
        this._isSelected = false;
        this._setSelectedStatus();
    }

    toggleSelected() {
        this._isSelected = !this._isSelected;
        this._setSelectedStatus();
    }

    _setSelectedStatus() {
        if (this._isSelected) {
            this.setHightLighted();
            this.container.grab_focus();
        }
        if (!this._isSelected)
            this.setUnHighLighted();
    }

    // eslint-disable-next-line no-unused-vars
    receiveDrop(x, y, selection, info) {
    }

    _dropCapable() {
        return false;
    }

    /** *********************
     * Icon Rendering *
     ***********************/

    async updateIcon() {
        await this._updateIcon().catch(e => {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                console.error(e, `Exception while updating ${this._getVisibleName
                    ? this._getVisibleName() : 'an icon'}: ${e.message}`);
            }
        });
    }

    async _updateIcon(cancellable) {
        if ((cancellable && cancellable.is_cancelled()) || this._destroyed) {
            throw new GLib.Error(Gio.IOErrorEnum,
                Gio.IOErrorEnum.CANCELLED,
                'Operation was cancelled');
        } else if (!cancellable) {
            cancellable = new Gio.Cancellable();
        }

        if (this._updateIconCancellable)
            this._updateIconCancellable.cancel();

        this._updateIconCancellable = cancellable;

        try {
            let customIcon = this._fileInfo.get_attribute_as_string('metadata::custom-icon');
            if (customIcon && (customIcon !== '')) {
                let customIconFile = Gio.File.new_for_uri(customIcon);
                if (await this._loadImageAsIcon(customIconFile, cancellable))
                    return;
            }
            if (this.thumbnailFile && (this.thumbnailFile !== '')) {
                let customIconFile = Gio.File.new_for_path(this.thumbnailFile);
                if (await this.FileUtils.queryExists(customIconFile)) {
                    let loadedImage = await this._loadImageAsIcon(customIconFile, cancellable);
                    if (loadedImage | this._destroyed)
                        return;
                }
            }
        } catch (error) {
            if (error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                throw error;

            console.error(error, `Error while updating icon: ${error.message}`);
        }

        if (this._fileExtra === this.Enums.FileType.USER_DIRECTORY_TRASH) {
            let pixbuf = this._createEmblemedIcon(this._fileInfo.get_icon(), null);
            if (cancellable.is_cancelled())
                return;
            this._icon.set_paintable(pixbuf);
            return;
        }

        let iconSet = false;

        if (this.Prefs.showImageThumbnails) {
            try {
                const thumbnail = await this._desktopManager.thumbnailLoader.getThumbnail(
                    this, cancellable);
                if (thumbnail !== null) {
                    let thumbnailFile = Gio.File.new_for_path(thumbnail);
                    iconSet = await this._loadImageAsIcon(thumbnailFile, cancellable);
                }
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    throw e;

                console.error(e, `Error while generating thumbnail: ${e.message}`);
            }
        }

        if (!iconSet &&
            this.Prefs.showImageThumbnails &&
            this.fileSize < 5242880 &&
            PIXBUF_CONTENT_TYPES.has(this._fileInfo.get_content_type())) {
            try {
                iconSet = await this._loadImageAsIcon(
                    Gio.File.new_for_uri(this.uri), cancellable);
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    throw e;

                console.error(e, `Error while generating icon image: ${e.message}`);
            }
        }

        if (!iconSet) {
            let iconPaintable;
            if (this._isBrokenSymlink)
                iconPaintable = this._createEmblemedIcon(null, 'text-x-generic');
            else if (this._desktopFile && this._desktopFile.has_key('Icon'))
                iconPaintable = this._createEmblemedIcon(null, this._desktopFile.get_string('Icon'));
            else
                iconPaintable = this._createEmblemedIcon(this._getDefaultIcon(), null);

            if (cancellable.is_cancelled())
                return;
            this._icon.set_paintable(iconPaintable);
        }

        if (cancellable === this._updateIconCancellable)
            this._updateIconCancellable = null;
    }

    _getDefaultIcon() {
        if (this._fileExtra === this.Enums.FileType.EXTERNAL_DRIVE)
            return this._custom.get_icon();

        return this._fileInfo.get_icon();
    }

    async _loadImageAsIcon(imageFile, cancellable) {
        try {
            const [thumbnailData] = await imageFile.load_bytes_async(cancellable);
            const iconTexture = Gdk.Texture.new_from_bytes(thumbnailData);
            let width = this.Prefs.DesiredWidth - 8;
            let height = this.Prefs.IconSize - 8;
            const aspectRatio = iconTexture.width / iconTexture.height;
            if ((width / height) > aspectRatio)
                width = height * aspectRatio;
            else
                height = width / aspectRatio;
            let iconPaintableSnapshot = Gtk.Snapshot.new();
            iconTexture.snapshot(iconPaintableSnapshot, Math.floor(width), Math.floor(height));
            let icon = iconPaintableSnapshot.to_paintable(null);
            icon = this._addEmblemsToIconIfNeeded(icon);
            this._icon.set_paintable(icon);

            return true;
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                throw e;

            console.error(e, `Error while loading ${imageFile.get_uri()}`);
            return false;
        }
    }

    _addEmblemsToIconIfNeeded(iconPaintable) {
        let emblem = null;
        if (this._isDesktopFile && (!this._isValidDesktopFile || !this.trustedDesktopFile))
            emblem = Gio.ThemedIcon.new('emblem-unreadable');

        if (this._isSymlink && (this.Prefs.showLinkEmblem || this._isBrokenSymlink)) {
            if (this._isBrokenSymlink)
                emblem = Gio.ThemedIcon.new('emblem-unreadable');
            else
                emblem = Gio.ThemedIcon.new('emblem-symbolic-link');
        }

        if (this.isStackTop && !this.stackUnique)
            emblem = Gio.ThemedIcon.new('list-add');

        if (emblem) {
            const scale = this._icon.get_scale_factor();
            let finalSize = Math.floor(this.Prefs.IconSize / 3) * scale;
            let theme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
            let emblemIcon = theme.lookup_by_gicon(emblem, finalSize / scale, scale, Gtk.TextDirection.NONE, Gtk.IconLookupFlags.FORCE_SIZE);
            let emblemSnapshot = Gtk.Snapshot.new();
            let iconPaintableSnapshot = Gtk.Snapshot.new();
            emblemIcon.snapshot(emblemSnapshot, emblemIcon.get_intrinsic_width(), emblemIcon.get_intrinsic_height());
            iconPaintable.snapshot(iconPaintableSnapshot, iconPaintable.get_intrinsic_width(), iconPaintable.get_intrinsic_height());
            iconPaintableSnapshot.append_node(emblemSnapshot.to_node());
            return iconPaintableSnapshot.to_paintable(null);
        } else {
            return iconPaintable;
        }
    }

    _createEmblemedIcon(icon, iconName) {
        if (icon === null) {
            if (GLib.path_is_absolute(iconName)) {
                try {
                    let iconFile = Gio.File.new_for_commandline_arg(iconName);
                    icon = new Gio.FileIcon({file: iconFile});
                } catch (e) {
                    icon = Gio.ThemedIcon.new_with_default_fallbacks(iconName);
                }
            } else {
                try {
                    icon = Gio.Icon.new_for_string(iconName);
                } catch (e) {
                    icon = Gio.ThemedIcon.new_with_default_fallbacks(iconName);
                }
            }
        }
        let theme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
        const scale = this._icon.get_scale_factor();
        let iconPaintable = null;
        try {
            iconPaintable = theme.lookup_by_gicon(icon, this.Prefs.IconSize, scale, Gtk.TextDirection.NONE, Gtk.IconLookupFlags.FORCE_SIZE);
        } catch (e) {
            iconPaintable = theme.lookup_icon('text-x-generic', [], this.Prefs.IconSize, scale, Gtk.TextDirection.NONE, Gtk.IconLookupFlags.FORCE_SIZE);
        }
        return this._addEmblemsToIconIfNeeded(iconPaintable);
    }

    /** *********************
     * Getters and setters *
     ***********************/

    get state() {
        return this._state;
    }

    set state(state) {
        if (state === this._state)
            return;

        this._state = state;
    }

    get dropCapable() {
        return this._dropCapable();
    }

    get isDrive() {
        return this._fileExtra === this.Enums.FileType.EXTERNAL_DRIVE;
    }

    get isSelected() {
        return this._isSelected;
    }

    get isSpecial() {
        return this._isSpecial;
    }

    get dropCoordinates() {
        return this._dropCoordinates;
    }

    set dropCoordinates(pos) {
        this._dropCoordinates = pos;
    }
};
Signals.addSignalMethods(DesktopIconItem.prototype);
