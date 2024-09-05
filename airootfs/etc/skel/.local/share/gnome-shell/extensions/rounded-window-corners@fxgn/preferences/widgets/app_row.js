import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { on_picked, pick } from '../../dbus/client.js';
import { connections } from '../../utils/connections.js';
export class AppRowClass extends Adw.ExpanderRow {
    callbacks;
    remove_btn = new Gtk.Button({
        icon_name: 'window-close-symbolic',
        css_classes: ['flat', 'circular'],
        valign: Gtk.Align.CENTER,
    });
    apply_btn = new Gtk.Button({
        icon_name: 'object-select-symbolic',
        css_classes: ['flat', 'circular'],
        valign: Gtk.Align.CENTER,
    });
    pick_btn = new Gtk.Button({
        icon_name: 'find-location-symbolic',
        css_classes: ['flat', 'circular'],
        valign: Gtk.Align.CENTER,
    });
    wm_class_entry = new Adw.EntryRow({
        title: _('Window class'),
    });
    constructor(cb) {
        super();
        this.callbacks = cb;
        this.wm_class_entry.add_prefix(this.apply_btn);
        this.wm_class_entry.add_prefix(this.pick_btn);
        this.add_row(this.wm_class_entry);
        this.add_suffix(this.remove_btn);
        this.bind_property('subtitle', this.wm_class_entry, 'text', GObject.BindingFlags.DEFAULT);
        this.add_css_class('property');
        this.set_title(_('Expand this row, to pick a window'));
        const c = connections.get();
        c.connect(this.remove_btn, 'clicked', () => {
            connections.get().disconnect_all(this.remove_btn);
            connections.get().disconnect_all(this.apply_btn);
            connections.get().disconnect_all(this.pick_btn);
            this.on_delete();
        });
        c.connect(this.pick_btn, 'clicked', () => {
            this.on_pick(this.wm_class_entry);
        });
        c.connect(this.apply_btn, 'clicked', () => {
            this.on_title_change(this.wm_class_entry);
        });
    }
    on_title_change(entry) {
        if (!this.callbacks?.on_title_changed ||
            this.subtitle === entry.text ||
            entry.text === '') {
            return;
        }
        if (this.callbacks.on_title_changed(this, this.subtitle || '', entry.text || '')) {
            this.set_subtitle(entry.text || '');
        }
    }
    on_pick(entry) {
        on_picked(wm_instance_class => {
            if (wm_instance_class === 'window-not-found') {
                const win = this.root;
                win.add_toast(new Adw.Toast({
                    title: _("Can't pick window from this position"),
                }));
                return;
            }
            entry.text = wm_instance_class;
        });
        pick();
    }
    on_delete() {
        this.callbacks?.on_delete(this);
    }
}
export const AppRow = GObject.registerClass({
    GTypeName: 'AppRow',
}, AppRowClass);
