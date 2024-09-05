import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { AppRowClass } from './app_row.js';
import { PaddingsRow } from './paddings_row.js';
import './app_row.js';
import { gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
export class CustomEffectRowClass extends AppRowClass {
    enabled_row = new Adw.SwitchRow({
        title: _('Enabled'),
    });
    corner_radius_row = new Adw.ActionRow({
        title: _('Corner radius'),
    });
    corner_radius = new Gtk.Adjustment({
        lower: 0,
        upper: 40,
        step_increment: 1,
        page_increment: 1,
    });
    corner_smoothing_row = new Adw.ActionRow({
        title: _('Corner smoothing'),
    });
    corner_smoothing = new Gtk.Adjustment({
        lower: 0,
        upper: 1,
        step_increment: 0.1,
        page_increment: 0.1,
    });
    keep_for_maximized = new Adw.SwitchRow({
        title: _('Keep rounded corners when maximized'),
        subtitle: _('Always clip rounded corners even if window is maximized or tiled'),
    });
    keep_for_fullscreen = new Adw.SwitchRow({
        title: _('Keep rounded corners when in fullscreen'),
        subtitle: _('Always clip rounded corners even for fullscreen window'),
    });
    paddings = new PaddingsRow();
    constructor(cb) {
        super(cb);
        this.corner_radius_row.add_suffix(new Gtk.Scale({
            valign: Gtk.Align.CENTER,
            hexpand: true,
            draw_value: true,
            value_pos: Gtk.PositionType.LEFT,
            round_digits: 0,
            digits: 0,
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: this.corner_radius,
        }));
        this.corner_smoothing_row.add_suffix(new Gtk.Scale({
            valign: Gtk.Align.CENTER,
            hexpand: true,
            draw_value: true,
            value_pos: Gtk.PositionType.LEFT,
            round_digits: 1,
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: this.corner_smoothing,
        }));
        this.add_row(this.enabled_row);
        this.add_row(this.corner_radius_row);
        this.add_row(this.corner_smoothing_row);
        this.add_row(this.keep_for_maximized);
        this.add_row(this.keep_for_fullscreen);
        this.add_row(this.paddings);
        this.check_state();
    }
    check_state() {
        if (!this.enabled_row.get_active()) {
            this.toggle_sensetive(false);
            return;
        }
        if (this.subtitle === '') {
            this.toggle_sensetive(false);
            return;
        }
        this.toggle_sensetive(true);
    }
    toggle_sensetive(state) {
        this.corner_radius_row.set_sensitive(state);
        this.corner_smoothing_row.set_sensitive(state);
        this.keep_for_maximized.set_sensitive(state);
        this.keep_for_fullscreen.set_sensitive(state);
        this.paddings.set_sensitive(state);
    }
}
export const CustomEffectRow = GObject.registerClass({
    GTypeName: 'CustomEffectRow',
}, CustomEffectRowClass);
