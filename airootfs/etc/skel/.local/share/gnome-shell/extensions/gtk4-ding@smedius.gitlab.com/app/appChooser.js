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
import {Gtk, Gdk, Gio, GLib, Adw} from '../dependencies/gi.js';
import {_} from '../dependencies/gettext.js';

export {AppChooserDialog};

const AppChooserDialog = class {
    constructor(codepath, fileItems, activeFileItem = null, dbusUtils, desktopIconsUtil) {
        if (!activeFileItem)
            activeFileItem = fileItems[0];
        if (fileItems.length === 1) {
            this.fileName = activeFileItem.displayName;
            this.singleContentType = true;
        } else {
            this.fileName = null;
            this.singleContentType = this._detectSingleContentType(fileItems);
        }
        this._dbusUtils = dbusUtils;
        this._desktopIconsUtil = desktopIconsUtil;
        this.mimeType = activeFileItem.attributeContentType;
        const appwindow = this._desktopIconsUtil.getApplicationID().get_active_window();
        let appChooserDialogUiPath = GLib.build_filenamev([codepath, 'app', 'resources', 'ui', 'ding-app-chooser.ui']);
        this.builderObject = Gtk.Builder.new_from_file(appChooserDialogUiPath);
        this.builderObject.set_translation_domain('gtk4-ding');
        this.appChooserDialog = this.builderObject.get_object('DingAppChooser');
        this.appChooserDialog.set_transient_for(appwindow);
        this.appChooserDialog.set_title('DingAppChooser');
        this.appChooserDialog.set_name('DingAppChooser');
        const modal = true;
        this._desktopIconsUtil.windowHidePagerTaskbarModal(this.appChooserDialog, modal);
        this.appChooserBox = this.builderObject.get_object('app_chooser_widget_box');
        this.appChooserWidget = Gtk.AppChooserWidget.new(this.mimeType);
        this.appChooserWidget.set_show_default(true);
        this.appChooserWidget.set_show_fallback(true);
        this.appChooserWidget.set_show_other(true);
        this.appChooserBox.append(this.appChooserWidget);
        this.appChooserWidget.set_vexpand(true);
        if (this.fileName !== null) {
            let description = _('Choose an application to open <b>{foo}</b>').replace('{foo}', this.fileName);
            this.appChooserLabel = this.builderObject.get_object('label_description');
            this.appChooserLabel.set_markup(description);
        }
        let headerTitle;
        this.appChooserDialogHeaderBar = this.appChooserDialog.get_header_bar();
        this.mimeTypeIsDirectory = this.mimetype === 'inode/directory';
        if (!this.singleContentType)
            headerTitle = _('Open Items');
        else if (this.mimeTypeIsDirectory)
            headerTitle = _('Open Folder');
        else
            headerTitle = _('Open File');
        this.appChooserDialogHeaderBar.set_title_widget(Adw.WindowTitle.new(headerTitle, ''));

        this.appChooserRowBox = this.builderObject.get_object('set_default_box');
        this.appChooserRow = this.builderObject.get_object('set_default_row');
        this.appChooserRowSwitch = this.builderObject.get_object('set_as_default_switch');

        this.selectedAppInfo = this.appChooserWidget.get_app_info();
        if (this.selectedAppInfo !== null)
            this._onApplicationSelected(this.appChooserWidget, this.selectedAppInfo);
        this.appChooserWidget.connect('application-activated', this._onApplicationActivated.bind(this));
        this.appChooserWidget.connect('application-selected', this._onApplicationSelected.bind(this));
        if (this.singleContentType && !this.mimeTypeIsDirectory) {
            let description = Gio.content_type_get_description(this.mimeType);
            this.appChooserRow.set_subtitle(description);
        } else {
            this.appChooserRowBox.set_visible(false);
        }
        this.appChooserDialog.connect('close', () => {
            this.appChooserDialog.response(Gtk.ResponseType.CANCEL);
        });
        this.appChooserDialog.connect('response', (actor, retval) => {
            if (retval === Gtk.ResponseType.OK) {
                this._checkUpdateDefaultAppForMimeType();
                this.applicationSelectionComplete(this.selectedAppInfo);
            } else {
                this.applicationSelectionComplete(null);
            }
        });
    }

    _checkUpdateDefaultAppForMimeType() {
        if (!this.singleContentType)
            return;
        let newAppSelected = false;
        if (this.appChooserRowSwitch.get_sensitive())
            newAppSelected = this.appChooserRowSwitch.get_active();
        if (newAppSelected) {
            let success = this.selectedAppInfo.set_as_default_for_type(this.mimeType);
            if (!success) {
                let header = _('Error changing default application');
                let message = _('Error while setting {foo} as default application for {mimetype}');
                message = message.replace('{foo}', this.selectedAppInfo.get_display_name());
                message = message.replace('{mimetype}', Gio.content_type_get_description(this.mimeType));
                this._dbusUtils.doNotify(header, message);
            }
        }
    }

    _onApplicationActivated(actor, appInfo) {
        this.selectedAppInfo = appInfo;
        this.appChooserDialog.response(Gtk.ResponseType.OK);
    }

    _onApplicationSelected(actor, appInfo) {
        if (!this.appChooserDialog)
            return;
        this.selectedAppInfo = appInfo;
        this.appChooserDialog.set_response_sensitive(Gtk.ResponseType.OK, this.selectedAppInfo !== null);
        let defaultAppInfo = Gio.AppInfo.get_default_for_type(this.mimeType, false);
        let defaultSelected = false;
        if (defaultAppInfo)
            defaultSelected = defaultAppInfo.equal(this.selectedAppInfo);
        this.appChooserRowSwitch.set_state(defaultSelected);
        this.appChooserRowSwitch.set_sensitive(!defaultSelected);
    }

    _detectSingleContentType(fileItems) {
        let mimetype = fileItems[0].attributeContentType;
        for (let fileItem of fileItems) {
            if (fileItem.attributeContentType !== mimetype)
                return false;
        }
        return true;
    }

    show() {
        this.appChooserDialog.show();
        this.appChooserDialog.present_with_time(Gdk.CURRENT_TIME);
    }

    hide() {
        this.appChooserDialog.hide();
    }

    finalize() {
        this.appChooserDialog = null;
        this.builderObject = null;
    }

    getApplicationSelected() {
        return new Promise(resolve => {
            this.applicationSelectionComplete = resolve;
        });
    }
};
