/* GsConnect Proxy
 *
 * Copyright (C) 2021 Sundeep Mediratta (smedius@gmail.com)
 * Translation to javascript of python file with tweaks for DING
 * Based on nautilus-gsconnect.py - A Nautilus extension for sending files via GSConnect by Andy Holmes
 * A great deal of credit and appreciation is owed to the indicator-kdeconnect
 * developers for the sister Python script 'kdeconnect-send-nautilus.py':
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
import {Gio, GLib} from '../../dependencies/gi.js';

export {GsConnectSendFileOperationsManager};

var GsConnectSendFileOperationsManager =  class {
    constructor(GsConnectManager, applicationid) {
        this._mainApp = applicationid;
        this.gsConnectDevices = {};
        this.devices = {};
        this.gsConnectServiceName = 'org.gnome.Shell.Extensions.GSConnect';
        this.gsConnectServicePath = '/org/gnome/Shell/Extensions/GSConnect';
        this.GsConnectManager = GsConnectManager;
        this.GsConnectManager.connect('changed-status', () => {
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                this._startGsConnectService();
                return false;
            });
        });
        this._startGsConnectService();
        this._createSendAction();
    }

    _startGsConnectService() {
        if (this.GsConnectManager.isAvailable) {
            this.gsConnectProxy = this.GsConnectManager.proxy;
            if (!this.gsConnectProxy) {
                this._stopService();
                return;
            }
            this.signalID = this.gsConnectProxy.connect('g-signal', this._on_g_signal.bind(this));
            this._on_name_owner_changed();
        } else {
            this._stopService();
        }
    }

    _stopService() {
        this.gsConnectDevices = {};
        this.devices = {};
        if (this.signalID) {
            this.gsConnectProxy.disconnect(this.signalID);
            this.signalID = null;
        }
    }

    _on_g_signal(proxy, senderName, signalName, parameters) {
        // Wait until the service is ready
        if (!this.gsConnectProxy.get_name_owner())
            return;

        let objects = parameters.recursiveUnpack();
        if (signalName === 'InterfacesAdded') {
            for (let [objectPath, props] of Object.entries(objects)) {
                props = props['org.gnome.Shell.Extensions.GSConnect.Device'];
                if (!props)
                    continue;
                let action = Gio.DBusActionGroup.get(this.gsConnectProxy.get_connection(), this.gsConnectServiceName, objectPath);
                this.gsConnectDevices[objectPath] = [props['Name'], action];
            }
        } else if (signalName === 'InterfacesRemoved') {
            for (const objectPath of Object.keys(objects)) {
                try {
                    delete this.gsConnectDevices[objectPath];
                } catch (e) {}
            }
        }
        this._update_devices();
    }

    _on_name_owner_changed() {
        // Wait until the service is ready
        if (!this.gsConnectProxy.get_name_owner()) {
            this.gsConnectDevices = {};
        } else {
            this.gsConnectProxy.call('GetManagedObjects',
                null,
                Gio.DBusCallFlags.NO_AUTO_START,
                -1,
                null,
                this._get_managed_objects.bind(this)
            );
        }
    }

    _get_managed_objects(proxy, res) {
        let objects = this.gsConnectProxy.call_finish(res).recursiveUnpack()[0];
        if (objects) {
            for (let [objectPath, props] of Object.entries(objects)) {
                props = props['org.gnome.Shell.Extensions.GSConnect.Device'];
                if (!Object.keys(props).length > 0)
                    continue;

                let action = Gio.DBusActionGroup.get(this.gsConnectProxy.get_connection(), this.gsConnectServiceName, objectPath);
                this.gsConnectDevices[objectPath] = [props['Name'], action];
            }
            this._update_devices();
        }
    }

    _createSendAction() {
        let sendfiles = new Gio.SimpleAction({
            name: 'sendfiles',
            parameter_type: new GLib.VariantType('s'),
        });
        sendfiles.connect('activate', (action, parameter) => {
            let device = parameter.recursiveUnpack();
            this._send_files(device);
        });
        this._mainApp.add_action(sendfiles);
    }

    _send_files(device) {
        // send files to shareFile action in actiongroup for the devices actiongroup
        let actionGroup = this.devices[device];
        for (let file of this.sendablefiles) {
            let variant = GLib.Variant.new('(sb)', [file.get_uri(), false]);
            actionGroup.activate_action('shareFile', variant);
        }
    }

    _update_devices() {
        this.devices = {};
        for (let [name, actionGroup] of Object.values(this.gsConnectDevices)) {
            if (actionGroup.get_action_enabled('shareFile'))
                this.devices[name] = actionGroup;
        }
    }

    _get_devices() {
        // No capable devices
        if (!Object.keys(this.devices).length > 0)
            return null;
        else
            return true;
    }

    _sendable_file_items(files) {
        // Return a list of select files to be sent
        // Only accept regular files
        for (let f of files) {
            if (f.get_uri_scheme() !== 'file')
                return null;
        }
        return true;
    }

    create_gsconnect_menu(files) {
        this.sendablefiles = files.map(f => f.file);
        this._update_devices();
        if (this._sendable_file_items(this.sendablefiles) && this._get_devices()) {
            this._menu = new Gio.Menu();
            for (let device of Object.keys(this.devices)) {
                let menuitem = Gio.MenuItem.new(`${device}`, null);
                menuitem.set_action_and_target_value('app.sendfiles', GLib.Variant.new('s', `${device}`));
                this._menu.append_item(menuitem);
            }
            return this._menu;
        } else {
            return null;
        }
    }
};
