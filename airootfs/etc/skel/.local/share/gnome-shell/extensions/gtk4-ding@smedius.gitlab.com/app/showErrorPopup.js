/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2022, 2024 Sundeep Mediratta (smedius@gmail.com) gtk4 port
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
import {Gtk, Gdk, Gio} from '../dependencies/gi.js';
import {_} from '../dependencies/gettext.js';

export {ShowErrorPopup};

const ShowErrorPopup = class {
    constructor(text, secondaryText, modal, textEntryAccelsTurnOff, textEntryAccelsTurnOn, DesktopIconsUtil, helpURL = null) {
        this.DesktopIconsUtil = DesktopIconsUtil;
        this._applicationId = this.DesktopIconsUtil.getApplicationID();
        this._window = this._applicationId.get_active_window();
        this._textEntryAccelsTurnOff = textEntryAccelsTurnOff;
        this._textEntryAccelsTurnOn = textEntryAccelsTurnOn;
        this._dialog = new Gtk.AlertDialog();
        if (text)
            this._dialog.set_message(text);
        if (secondaryText)
            this._dialog.set_detail(secondaryText);
        this._dialog.set_modal(modal);
        if (helpURL) {
            this._helpURL = helpURL;
            this._dialog.buttons = [_('Cancel'), _('More Information')];
            this._dialog.set_cancel_button(0);
            this._dialog.set_default_button(1);
        } else {
            this._dialog.buttons = [_('Cancel')];
            this._dialog.set_cancel_button(0);
            this._dialog.set_default_button(0);
        }
        this._cancellable = null;

        this._show = () => {
            return new Promise((resolve, reject) => {
                this._dialog.choose(this._window, this._cancellable, (actor, choice) => {
                    try {
                        const buttonpress = actor.choose_finish(choice);
                        if (buttonpress === 1) {
                            if (this._helpURL)
                                this._launchUri(this._helpURL);
                        }
                        this._cancellable = null;
                        this._textEntryAccelsTurnOn();
                    } catch (e) {
                        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                            console.error('Error showing Alert Dialog');
                            reject(e);
                        }
                    }
                    resolve(true);
                });
            });
        };
    }

    async run() {
        if (this._cancellable)
            return;
        this._cancellable = Gio.Cancellable.new();
        await this._show().catch(e => logError(e));
    }

    async runAutoClose(time) {
        if (this._cancellable)
            return;
        this._cancellable = Gio.Cancellable.new();
        this._show().catch(e => logError(e));
        await this.timeoutClose(time);
    }

    close() {
        if (this._cancellable)
            this._cancellable.cancel();
        this._cancellable = null;
        this._textEntryAccelsTurnOn();
    }

    async timeoutClose(time) {
        await this.DesktopIconsUtil.waitDelayMs(time);
        this.close();
    }

    _launchUri(uri) {
        const context = Gdk.Display.get_default().get_app_launch_context();
        context.set_timestamp(Gdk.CURRENT_TIME);
        Gio.AppInfo.launch_default_for_uri(uri, context);
    }
};
