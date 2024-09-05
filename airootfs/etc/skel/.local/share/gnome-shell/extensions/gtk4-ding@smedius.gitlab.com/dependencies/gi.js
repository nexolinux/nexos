import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import GdkWayland from 'gi://GdkWayland?version=4.0';
import GdkX11 from 'gi://GdkX11?version=4.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
let GLibUnix;
GLibUnix = await import('gi://GLibUnix').then(module => module.default).catch(_e => {
    console.log('GLibUnix not found.');
});
if (!GLibUnix) {
    console.log('Falling back to GLib...');
    GLibUnix = {
        'signal_add_full': GLib.unix_signal_add,
    };
}
import GnomeDesktop from 'gi://GnomeDesktop?version=4.0';
const GnomeAutoar = await import('gi://GnomeAutoar').then(module => module.default).catch(e => console.error(e));
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gsk from 'gi://Gsk';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';

export {
    Adw,
    Gdk,
    GdkPixbuf,
    GdkX11,
    GdkWayland,
    GLib,
    GLibUnix,
    GnomeDesktop,
    GnomeAutoar,
    GObject,
    Gio,
    Graphene,
    Gsk,
    Gtk,
    Pango
};
