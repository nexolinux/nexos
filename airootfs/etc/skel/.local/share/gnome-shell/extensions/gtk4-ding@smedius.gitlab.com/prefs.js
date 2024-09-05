
/* Desktop Icons GNOME Shell extension
 *
 * Copyright (C) 2022 Sundeep Mediratta (smedius@gmail.com)
 * Copyright (C) 2019 Sergio Costas (rastersoft@gmail.com)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
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

import * as Enums from './app/enums.js';
import * as  adwPreferencesWindow from './app/adwPreferencesWindow.js';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class dingPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const desktopSettings = this.getSettings();
        const GioSSS = Gio.SettingsSchemaSource;
        const schemaSource = GioSSS.get_default();
        const schemaGtk = schemaSource.lookup(Enums.SCHEMA_GTK, true);
        const gtkSettings = new Gio.Settings({settings_schema: schemaGtk});
        const schemaNautilus = schemaSource.lookup(Enums.SCHEMA_NAUTILUS, true);
        const version = this.metadata['version-name'];
        let nautilusSettings;
        if (!schemaNautilus)
            nautilusSettings = null;
        else
            nautilusSettings = new Gio.Settings({settings_schema: schemaNautilus});

        const preferencesWindow = new adwPreferencesWindow.AdwPreferencesWindow(desktopSettings, nautilusSettings, gtkSettings, this.path, version);
        preferencesWindow.getAdwPreferencesWindow(window);
    }
}
