// src/components/layout/Layout.ts
var Layout = class {
  id;
  tiles;
  constructor(tiles, id) {
    this.tiles = tiles;
    this.id = id;
  }
};

// src/components/layout/Tile.ts
import GObject from "gi://GObject";
var Tile2 = class {
  // @ts-expect-error "GObject has TYPE_JSOBJECT"
  static $gtype = GObject.TYPE_JSOBJECT;
  x;
  y;
  width;
  height;
  groups;
  constructor({
    x,
    y,
    width,
    height,
    groups
  }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.groups = groups;
  }
};

// src/settings/settings.ts
import Gio from "gi://Gio";
var ActivationKey = /* @__PURE__ */ ((ActivationKey2) => {
  ActivationKey2[ActivationKey2["NONE"] = -1] = "NONE";
  ActivationKey2[ActivationKey2["CTRL"] = 0] = "CTRL";
  ActivationKey2[ActivationKey2["ALT"] = 1] = "ALT";
  ActivationKey2[ActivationKey2["SUPER"] = 2] = "SUPER";
  return ActivationKey2;
})(ActivationKey || {});
var Settings = class _Settings {
  static _settings;
  static _is_initialized = false;
  static SETTING_LAST_VERSION_NAME_INSTALLED = "last-version-name-installed";
  static SETTING_OVERRIDDEN_SETTINGS = "overridden-settings";
  static SETTING_TILING_SYSTEM = "enable-tiling-system";
  static SETTING_TILING_SYSTEM_ACTIVATION_KEY = "tiling-system-activation-key";
  static SETTING_SNAP_ASSIST = "enable-snap-assist";
  static SETTING_SHOW_INDICATOR = "show-indicator";
  static SETTING_INNER_GAPS = "inner-gaps";
  static SETTING_OUTER_GAPS = "outer-gaps";
  static SETTING_SPAN_MULTIPLE_TILES = "enable-span-multiple-tiles";
  static SETTING_SPAN_MULTIPLE_TILES_ACTIVATION_KEY = "span-multiple-tiles-activation-key";
  static SETTING_LAYOUTS_JSON = "layouts-json";
  static SETTING_SELECTED_LAYOUTS = "selected-layouts";
  static SETTING_RESTORE_WINDOW_ORIGINAL_SIZE = "restore-window-original-size";
  static SETTING_RESIZE_COMPLEMENTING_WINDOWS = "resize-complementing-windows";
  static SETTING_ENABLE_BLUR_SNAP_ASSISTANT = "enable-blur-snap-assistant";
  static SETTING_ENABLE_BLUR_SELECTED_TILEPREVIEW = "enable-blur-selected-tilepreview";
  static SETTING_ENABLE_MOVE_KEYBINDINGS = "enable-move-keybindings";
  static SETTING_ACTIVE_SCREEN_EDGES = "active-screen-edges";
  static SETTING_TOP_EDGE_MAXIMIZE = "top-edge-maximize";
  static SETTING_OVERRIDE_WINDOW_MENU = "override-window-menu";
  static SETTING_SNAP_ASSISTANT_THRESHOLD = "snap-assistant-threshold";
  static SETTING_QUARTER_TILING_THRESHOLD = "quarter-tiling-threshold";
  static SETTING_MOVE_WINDOW_RIGHT = "move-window-right";
  static SETTING_MOVE_WINDOW_LEFT = "move-window-left";
  static SETTING_MOVE_WINDOW_UP = "move-window-up";
  static SETTING_MOVE_WINDOW_DOWN = "move-window-down";
  static initialize(settings) {
    if (this._is_initialized)
      return;
    this._is_initialized = true;
    this._settings = settings;
  }
  static destroy() {
    if (this._is_initialized) {
      this._is_initialized = false;
      this._settings = null;
    }
  }
  static bind(key, object, property, flags = Gio.SettingsBindFlags.DEFAULT) {
    this._settings?.bind(key, object, property, flags);
  }
  static get_last_version_installed() {
    return this._settings?.get_string(
      this.SETTING_LAST_VERSION_NAME_INSTALLED
    ) ?? "0";
  }
  static get_tiling_system_enabled() {
    return this._settings?.get_boolean(this.SETTING_TILING_SYSTEM) ?? false;
  }
  static get_snap_assist_enabled() {
    return this._settings?.get_boolean(this.SETTING_SNAP_ASSIST) ?? false;
  }
  static get_show_indicator() {
    if (!this._settings)
      return true;
    return this._settings.get_boolean(this.SETTING_SHOW_INDICATOR);
  }
  static get_inner_gaps(scaleFactor = 1) {
    const value = (this._settings?.get_uint(this.SETTING_INNER_GAPS) ?? 0) * scaleFactor;
    return {
      top: value,
      bottom: value,
      left: value,
      right: value
    };
  }
  static get_outer_gaps(scaleFactor = 1) {
    const value = (this._settings?.get_uint(this.SETTING_OUTER_GAPS) ?? 0) * scaleFactor;
    return {
      top: value,
      bottom: value,
      left: value,
      right: value
    };
  }
  static get_span_multiple_tiles() {
    return this._settings?.get_boolean(this.SETTING_SPAN_MULTIPLE_TILES) ?? false;
  }
  static get_layouts_json() {
    try {
      const layouts = JSON.parse(
        this._settings?.get_string(this.SETTING_LAYOUTS_JSON) || "[]"
      );
      if (layouts.length === 0)
        throw new Error("At least one layout is required");
      return layouts.filter((layout) => layout.tiles.length > 0);
    } catch (ex) {
      this.reset_layouts_json();
      return JSON.parse(
        this._settings?.get_string(this.SETTING_LAYOUTS_JSON) || "[]"
      );
    }
  }
  static get_selected_layouts() {
    return this._settings?.get_strv(_Settings.SETTING_SELECTED_LAYOUTS) || [];
  }
  static get_restore_window_original_size() {
    return this._settings?.get_boolean(
      _Settings.SETTING_RESTORE_WINDOW_ORIGINAL_SIZE
    ) ?? false;
  }
  static get_resize_complementing_windows() {
    return this._settings?.get_boolean(
      _Settings.SETTING_RESIZE_COMPLEMENTING_WINDOWS
    ) ?? false;
  }
  static get_tiling_system_activation_key() {
    const val = this._settings?.get_strv(
      this.SETTING_TILING_SYSTEM_ACTIVATION_KEY
    );
    if (!val || val.length === 0)
      return 0 /* CTRL */;
    return Number(val[0]);
  }
  static get_span_multiple_tiles_activation_key() {
    const val = this._settings?.get_strv(
      this.SETTING_SPAN_MULTIPLE_TILES_ACTIVATION_KEY
    );
    if (!val || val.length === 0)
      return 1 /* ALT */;
    return Number(val[0]);
  }
  static get_enable_blur_snap_assistant() {
    return this._settings?.get_boolean(
      this.SETTING_ENABLE_BLUR_SNAP_ASSISTANT
    ) ?? false;
  }
  static get_enable_blur_selected_tilepreview() {
    return this._settings?.get_boolean(
      this.SETTING_ENABLE_BLUR_SELECTED_TILEPREVIEW
    ) ?? false;
  }
  static get_enable_move_keybindings() {
    return this._settings?.get_boolean(this.SETTING_ENABLE_MOVE_KEYBINDINGS) ?? false;
  }
  static get_overridden_settings() {
    return this._settings?.get_string(this.SETTING_OVERRIDDEN_SETTINGS) ?? "{}";
  }
  static get_active_screen_edges() {
    return this._settings?.get_boolean(this.SETTING_ACTIVE_SCREEN_EDGES) ?? false;
  }
  static get_top_edge_maximize() {
    return this._settings?.get_boolean(this.SETTING_TOP_EDGE_MAXIMIZE) ?? false;
  }
  static get_override_window_menu() {
    return this._settings?.get_boolean(this.SETTING_OVERRIDE_WINDOW_MENU) ?? false;
  }
  static get_quarter_tiling_threshold() {
    return this._settings?.get_uint(this.SETTING_QUARTER_TILING_THRESHOLD) ?? 40;
  }
  static set_last_version_installed(version) {
    this._settings?.set_string(
      this.SETTING_LAST_VERSION_NAME_INSTALLED,
      version
    );
  }
  static set_tiling_system_activation_key(key) {
    this._settings?.set_strv(this.SETTING_TILING_SYSTEM_ACTIVATION_KEY, [
      String(key)
    ]);
  }
  static set_span_multiple_tiles_activation_key(key) {
    this._settings?.set_strv(
      this.SETTING_SPAN_MULTIPLE_TILES_ACTIVATION_KEY,
      [String(key)]
    );
  }
  static set_show_indicator(value) {
    this._settings?.set_boolean(this.SETTING_SHOW_INDICATOR, value);
  }
  static set_quarter_tiling_threshold(value) {
    this._settings?.set_uint(this.SETTING_QUARTER_TILING_THRESHOLD, value);
  }
  static set_overridden_settings(newVal) {
    return this._settings?.set_string(
      this.SETTING_OVERRIDDEN_SETTINGS,
      newVal
    ) ?? false;
  }
  static set_kb_move_window_right(newVal) {
    return this._settings?.set_strv(this.SETTING_MOVE_WINDOW_RIGHT, [
      newVal
    ]) ?? false;
  }
  static set_kb_move_window_left(newVal) {
    return this._settings?.set_strv(this.SETTING_MOVE_WINDOW_LEFT, [newVal]) ?? false;
  }
  static set_kb_move_window_up(newVal) {
    return this._settings?.set_strv(this.SETTING_MOVE_WINDOW_UP, [newVal]) ?? false;
  }
  static set_kb_move_window_down(newVal) {
    return this._settings?.set_strv(this.SETTING_MOVE_WINDOW_DOWN, [newVal]) ?? false;
  }
  static reset_layouts_json() {
    this.save_layouts_json([
      new Layout(
        [
          new Tile2({
            x: 0,
            y: 0,
            height: 0.5,
            width: 0.22,
            groups: [1, 2]
          }),
          // top-left
          new Tile2({
            x: 0,
            y: 0.5,
            height: 0.5,
            width: 0.22,
            groups: [1, 2]
          }),
          // bottom-left
          new Tile2({
            x: 0.22,
            y: 0,
            height: 1,
            width: 0.56,
            groups: [2, 3]
          }),
          // center
          new Tile2({
            x: 0.78,
            y: 0,
            height: 0.5,
            width: 0.22,
            groups: [3, 4]
          }),
          // top-right
          new Tile2({
            x: 0.78,
            y: 0.5,
            height: 0.5,
            width: 0.22,
            groups: [3, 4]
          })
          // bottom-right
        ],
        "Layout 1"
      ),
      new Layout(
        [
          new Tile2({
            x: 0,
            y: 0,
            height: 1,
            width: 0.22,
            groups: [1]
          }),
          new Tile2({
            x: 0.22,
            y: 0,
            height: 1,
            width: 0.56,
            groups: [1, 2]
          }),
          new Tile2({
            x: 0.78,
            y: 0,
            height: 1,
            width: 0.22,
            groups: [2]
          })
        ],
        "Layout 2"
      ),
      new Layout(
        [
          new Tile2({
            x: 0,
            y: 0,
            height: 1,
            width: 0.33,
            groups: [1]
          }),
          new Tile2({
            x: 0.33,
            y: 0,
            height: 1,
            width: 0.67,
            groups: [1]
          })
        ],
        "Layout 3"
      ),
      new Layout(
        [
          new Tile2({
            x: 0,
            y: 0,
            height: 1,
            width: 0.67,
            groups: [1]
          }),
          new Tile2({
            x: 0.67,
            y: 0,
            height: 1,
            width: 0.33,
            groups: [1]
          })
        ],
        "Layout 4"
      )
    ]);
  }
  static save_layouts_json(layouts) {
    this._settings?.set_string(
      this.SETTING_LAYOUTS_JSON,
      JSON.stringify(layouts)
    );
  }
  static save_selected_layouts_json(ids) {
    this._settings?.set_strv(_Settings.SETTING_SELECTED_LAYOUTS, ids);
  }
  static get_kb_move_window_right() {
    return this._settings?.get_strv(this.SETTING_MOVE_WINDOW_RIGHT)[0] ?? "";
  }
  static get_kb_move_window_left() {
    return this._settings?.get_strv(this.SETTING_MOVE_WINDOW_LEFT)[0] ?? "";
  }
  static get_kb_move_window_up() {
    return this._settings?.get_strv(this.SETTING_MOVE_WINDOW_UP)[0] ?? "";
  }
  static get_kb_move_window_down() {
    return this._settings?.get_strv(this.SETTING_MOVE_WINDOW_DOWN)[0] ?? "";
  }
  static connect(key, func) {
    return this._settings?.connect(`changed::${key}`, func) || -1;
  }
  static disconnect(id) {
    this._settings?.disconnect(id);
  }
};

// src/utils/shell.ts
var logger = (prefix) => (...content) => console.log("[tilingshell]", `[${prefix}]`, ...content);

// src/prefs.ts
var _a;
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";
import Gio2 from "gi://Gio";
import GLib from "gi://GLib";
import Gdk from "gi://Gdk";
import GObject3 from "gi://GObject";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
var debug = logger("prefs");
function buildPrefsWidget() {
  return new Gtk.Label({
    label: "Preferences"
  });
}
var TilingShellExtensionPreferences = class extends ExtensionPreferences {
  NAME = "Tiling Shell";
  /**
   * This function is called when the preferences window is first created to fill
   * the `Adw.PreferencesWindow`.
   *
   * @param {Adw.PreferencesWindow} window - The preferences window
   */
  fillPreferencesWindow(window) {
    Settings.initialize(this.getSettings());
    const prefsPage = new Adw.PreferencesPage({
      name: "general",
      title: "General",
      iconName: "dialog-information-symbolic"
    });
    window.add(prefsPage);
    const appearenceGroup = new Adw.PreferencesGroup({
      title: "Appearance",
      description: `Configure the appearance of ${this.NAME}`
    });
    prefsPage.add(appearenceGroup);
    const showIndicatorRow = this._buildSwitchRow(
      Settings.SETTING_SHOW_INDICATOR,
      "Show Indicator",
      "Whether to show the panel indicator"
    );
    appearenceGroup.add(showIndicatorRow);
    const innerGapsRow = this._buildSpinButtonRow(
      Settings.SETTING_INNER_GAPS,
      "Inner gaps",
      "Gaps between windows"
    );
    appearenceGroup.add(innerGapsRow);
    const outerGapsRow = this._buildSpinButtonRow(
      Settings.SETTING_OUTER_GAPS,
      "Outer gaps",
      "Gaps between a window and the monitor borders"
    );
    appearenceGroup.add(outerGapsRow);
    const blur = new Adw.ExpanderRow({
      title: "Blur (experimental feature)",
      subtitle: "Apply blur effect to Snap Assistant and tile previews"
    });
    appearenceGroup.add(blur);
    const snapAssistantThresholdRow = this._buildSpinButtonRow(
      Settings.SETTING_SNAP_ASSISTANT_THRESHOLD,
      "Snap Assistant threshold",
      "Minimum distance from the Snap Assistant to the pointer to open it",
      0,
      512
    );
    appearenceGroup.add(snapAssistantThresholdRow);
    blur.add_row(
      this._buildSwitchRow(
        Settings.SETTING_ENABLE_BLUR_SNAP_ASSISTANT,
        "Snap Assistant",
        "Apply blur effect to Snap Assistant"
      )
    );
    blur.add_row(
      this._buildSwitchRow(
        Settings.SETTING_ENABLE_BLUR_SELECTED_TILEPREVIEW,
        "Selected tile preview",
        "Apply blur effect to selected tile preview"
      )
    );
    const behaviourGroup = new Adw.PreferencesGroup({
      title: "Behaviour",
      description: `Configure the behaviour of ${this.NAME}`
    });
    prefsPage.add(behaviourGroup);
    const snapAssistRow = this._buildSwitchRow(
      Settings.SETTING_SNAP_ASSIST,
      "Enable Snap Assistant",
      "Move the window on top of the screen to snap assist it"
    );
    behaviourGroup.add(snapAssistRow);
    const enableTilingSystemRow = this._buildSwitchRow(
      Settings.SETTING_TILING_SYSTEM,
      "Enable Tiling System",
      "Hold the activation key while moving a window to tile it",
      this._buildActivationKeysDropDown(
        Settings.get_tiling_system_activation_key(),
        (newVal) => Settings.set_tiling_system_activation_key(newVal)
      )
    );
    behaviourGroup.add(enableTilingSystemRow);
    const spanMultipleTilesRow = this._buildSwitchRow(
      Settings.SETTING_SPAN_MULTIPLE_TILES,
      "Span multiple tiles",
      "Hold the activation key to span multiple tiles",
      this._buildActivationKeysDropDown(
        Settings.get_span_multiple_tiles_activation_key(),
        (newVal) => Settings.set_span_multiple_tiles_activation_key(newVal)
      )
    );
    behaviourGroup.add(spanMultipleTilesRow);
    const resizeComplementingRow = this._buildSwitchRow(
      Settings.SETTING_RESIZE_COMPLEMENTING_WINDOWS,
      "Enable auto-resize of the complementing tiled windows",
      "When a tiled window is resized, auto-resize the other tiled windows near it"
    );
    behaviourGroup.add(resizeComplementingRow);
    const restoreToOriginalSizeRow = this._buildSwitchRow(
      Settings.SETTING_RESTORE_WINDOW_ORIGINAL_SIZE,
      "Restore window size",
      "Whether to restore the windows to their original size when untiled"
    );
    behaviourGroup.add(restoreToOriginalSizeRow);
    const overrideWindowMenuRow = this._buildSwitchRow(
      Settings.SETTING_OVERRIDE_WINDOW_MENU,
      "Add snap assistant and auto-tile buttons to window menu",
      "Add snap assistant and auto-tile buttons in the menu that shows up when you right click on a window title"
    );
    behaviourGroup.add(overrideWindowMenuRow);
    const activeScreenEdgesGroup = new Adw.PreferencesGroup({
      title: "Screen Edges",
      description: "Drag windows against the top, left and right screen edges to resize them",
      headerSuffix: new Gtk.Switch({
        vexpand: false,
        valign: Gtk.Align.CENTER
      })
    });
    Settings.bind(
      Settings.SETTING_ACTIVE_SCREEN_EDGES,
      activeScreenEdgesGroup.headerSuffix,
      "active"
    );
    const topEdgeMaximize = this._buildSwitchRow(
      Settings.SETTING_TOP_EDGE_MAXIMIZE,
      "Drag against top edge to maximize window",
      "Drag windows against the top edge to maximize them"
    );
    Settings.bind(
      Settings.SETTING_ACTIVE_SCREEN_EDGES,
      topEdgeMaximize,
      "sensitive"
    );
    activeScreenEdgesGroup.add(topEdgeMaximize);
    const quarterTiling = this._buildScaleRow(
      "Quarter tiling activation area",
      "Activation area to trigger quarter tiling (% of the screen)",
      (sc) => {
        Settings.set_quarter_tiling_threshold(sc.get_value());
      },
      Settings.get_quarter_tiling_threshold(),
      1,
      50,
      1
    );
    Settings.bind(
      Settings.SETTING_ACTIVE_SCREEN_EDGES,
      quarterTiling,
      "sensitive"
    );
    activeScreenEdgesGroup.add(quarterTiling);
    prefsPage.add(activeScreenEdgesGroup);
    const layoutsGroup = new Adw.PreferencesGroup({
      title: "Layouts",
      description: `Configure the layouts of ${this.NAME}`
    });
    prefsPage.add(layoutsGroup);
    const editLayoutsBtn = this._buildButtonRow(
      "Edit layouts",
      "Edit layouts",
      "Open the layouts editor",
      () => this._openLayoutEditor()
    );
    layoutsGroup.add(editLayoutsBtn);
    const exportLayoutsBtn = this._buildButtonRow(
      "Export layouts",
      "Export layouts",
      "Export layouts to a file",
      () => {
        const fc = new Gtk.FileChooserDialog({
          title: "Export layouts",
          select_multiple: false,
          action: Gtk.FileChooserAction.SAVE,
          transient_for: window,
          filter: new Gtk.FileFilter({
            suffixes: ["json"],
            name: "JSON"
          })
        });
        fc.set_current_folder(
          Gio2.File.new_for_path(GLib.get_home_dir())
        );
        fc.add_button("Cancel", Gtk.ResponseType.CANCEL);
        fc.add_button("Save", Gtk.ResponseType.OK);
        fc.connect(
          "response",
          (_source, response_id) => {
            try {
              if (response_id === Gtk.ResponseType.OK) {
                const file = _source.get_file();
                if (!file)
                  throw new Error("no file selected");
                debug(
                  `Create file with path ${file.get_path()}`
                );
                const content = JSON.stringify(
                  Settings.get_layouts_json()
                );
                file.replace_contents_bytes_async(
                  new TextEncoder().encode(content),
                  null,
                  false,
                  Gio2.FileCreateFlags.REPLACE_DESTINATION,
                  null,
                  (thisFile, res) => {
                    try {
                      thisFile?.replace_contents_finish(
                        res
                      );
                    } catch (e) {
                      debug(e);
                    }
                  }
                );
              }
            } catch (error) {
              debug(error);
            }
            _source.destroy();
          }
        );
        fc.present();
      }
    );
    layoutsGroup.add(exportLayoutsBtn);
    const importLayoutsBtn = this._buildButtonRow(
      "Import layouts",
      "Import layouts",
      "Import layouts from a file",
      () => {
        const fc = new Gtk.FileChooserDialog({
          title: "Select layouts file",
          select_multiple: false,
          action: Gtk.FileChooserAction.OPEN,
          transient_for: window,
          filter: new Gtk.FileFilter({
            suffixes: ["json"],
            name: "JSON"
          })
        });
        fc.set_current_folder(
          Gio2.File.new_for_path(GLib.get_home_dir())
        );
        fc.add_button("Cancel", Gtk.ResponseType.CANCEL);
        fc.add_button("Open", Gtk.ResponseType.OK);
        fc.connect(
          "response",
          (_source, response_id) => {
            try {
              if (response_id === Gtk.ResponseType.OK) {
                const file = _source.get_file();
                if (!file) {
                  _source.destroy();
                  return;
                }
                debug(`Selected path ${file.get_path()}`);
                const [success, content] = file.load_contents(null);
                if (success) {
                  let importedLayouts = JSON.parse(
                    new TextDecoder("utf-8").decode(
                      content
                    )
                  );
                  if (importedLayouts.length === 0) {
                    throw new Error(
                      "At least one layout is required"
                    );
                  }
                  importedLayouts = importedLayouts.filter(
                    (layout) => layout.tiles.length > 0
                  );
                  const newLayouts = Settings.get_layouts_json();
                  newLayouts.push(...importedLayouts);
                  Settings.save_layouts_json(newLayouts);
                } else {
                  debug("Error while opening file");
                }
              }
            } catch (error) {
              debug(error);
            }
            _source.destroy();
          }
        );
        fc.present();
      }
    );
    layoutsGroup.add(importLayoutsBtn);
    const resetBtn = this._buildButtonRow(
      "Reset layouts",
      "Reset layouts",
      "Bring back the default layouts",
      () => {
        Settings.reset_layouts_json();
        const layouts = Settings.get_layouts_json();
        const selected = Settings.get_selected_layouts().map(
          () => layouts[0].id
        );
        Settings.save_selected_layouts_json(selected);
      },
      "destructive-action"
    );
    layoutsGroup.add(resetBtn);
    const keybindingsGroup = new Adw.PreferencesGroup({
      title: "Keybindings",
      description: "Use hotkeys to move the focused window through the tiles of the active layout",
      headerSuffix: new Gtk.Switch({
        vexpand: false,
        valign: Gtk.Align.CENTER
      })
    });
    Settings.bind(
      Settings.SETTING_ENABLE_MOVE_KEYBINDINGS,
      keybindingsGroup.headerSuffix,
      "active"
    );
    prefsPage.add(keybindingsGroup);
    const moveRightKB = this._buildShortcutButtonRow(
      Settings.get_kb_move_window_right(),
      "Move window to right tile",
      "Move the focused window to the tile on its right",
      (_, value) => Settings.set_kb_move_window_right(value)
    );
    Settings.bind(
      Settings.SETTING_ENABLE_MOVE_KEYBINDINGS,
      moveRightKB,
      "sensitive"
    );
    keybindingsGroup.add(moveRightKB);
    const moveLeftKB = this._buildShortcutButtonRow(
      Settings.get_kb_move_window_left(),
      "Move window to left tile",
      "Move the focused window to the tile on its left",
      (_, value) => Settings.set_kb_move_window_left(value)
    );
    Settings.bind(
      Settings.SETTING_ENABLE_MOVE_KEYBINDINGS,
      moveLeftKB,
      "sensitive"
    );
    keybindingsGroup.add(moveLeftKB);
    const moveUpKB = this._buildShortcutButtonRow(
      Settings.get_kb_move_window_up(),
      "Move window to tile above",
      "Move the focused window to the tile above",
      (_, value) => Settings.set_kb_move_window_up(value)
    );
    Settings.bind(
      Settings.SETTING_ENABLE_MOVE_KEYBINDINGS,
      moveUpKB,
      "sensitive"
    );
    keybindingsGroup.add(moveUpKB);
    const moveDownKB = this._buildShortcutButtonRow(
      Settings.get_kb_move_window_down(),
      "Move window to tile below",
      "Move the focused window to the tile below",
      (_, value) => Settings.set_kb_move_window_down(value)
    );
    Settings.bind(
      Settings.SETTING_ENABLE_MOVE_KEYBINDINGS,
      moveDownKB,
      "sensitive"
    );
    keybindingsGroup.add(moveDownKB);
    const footerGroup = new Adw.PreferencesGroup();
    prefsPage.add(footerGroup);
    const buttons = new Gtk.Box({
      hexpand: false,
      spacing: 8,
      margin_bottom: 16,
      halign: Gtk.Align.CENTER
    });
    buttons.append(
      this._buildLinkButton(
        "\u2665\uFE0E Donate on ko-fi",
        "https://ko-fi.com/domferr"
      )
    );
    buttons.append(
      this._buildLinkButton(
        "Report a bug",
        "https://github.com/domferr/tilingshell/issues/new?template=bug_report.md"
      )
    );
    buttons.append(
      this._buildLinkButton(
        "Request a feature",
        "https://github.com/domferr/tilingshell/issues/new?template=feature_request.md"
      )
    );
    footerGroup.add(buttons);
    footerGroup.add(
      new Gtk.Label({
        label: "Have issues, you want to suggest a new feature or contribute?",
        margin_bottom: 4
      })
    );
    footerGroup.add(
      new Gtk.Label({
        label: 'Open a new issue on <a href="https://github.com/domferr/tilingshell">GitHub</a>!',
        useMarkup: true,
        margin_bottom: 32
      })
    );
    if (this.metadata["version-name"]) {
      footerGroup.add(
        new Gtk.Label({
          label: `\xB7 Tiling Shell v${this.metadata["version-name"]} \xB7`
        })
      );
    }
    window.searchEnabled = true;
    window.connect("close-request", () => {
      Settings.destroy();
    });
  }
  _buildSwitchRow(settingsKey, title, subtitle, suffix) {
    const gtkSwitch = new Gtk.Switch({
      vexpand: false,
      valign: Gtk.Align.CENTER
    });
    const adwRow = new Adw.ActionRow({
      title,
      subtitle,
      activatableWidget: gtkSwitch
    });
    if (suffix)
      adwRow.add_suffix(suffix);
    adwRow.add_suffix(gtkSwitch);
    Settings.bind(settingsKey, gtkSwitch, "active");
    return adwRow;
  }
  _buildSpinButtonRow(settingsKey, title, subtitle, min = 0, max = 32) {
    const spinBtn = Gtk.SpinButton.new_with_range(min, max, 1);
    spinBtn.set_vexpand(false);
    spinBtn.set_valign(Gtk.Align.CENTER);
    const adwRow = new Adw.ActionRow({
      title,
      subtitle,
      activatableWidget: spinBtn
    });
    adwRow.add_suffix(spinBtn);
    Settings.bind(settingsKey, spinBtn, "value");
    return adwRow;
  }
  _buildButtonRow(label, title, subtitle, onClick, styleClass) {
    const btn = Gtk.Button.new_with_label(label);
    if (styleClass)
      btn.add_css_class(styleClass);
    btn.connect("clicked", onClick);
    btn.set_vexpand(false);
    btn.set_valign(Gtk.Align.CENTER);
    const adwRow = new Adw.ActionRow({
      title,
      subtitle,
      activatableWidget: btn
    });
    adwRow.add_suffix(btn);
    return adwRow;
  }
  _openLayoutEditor() {
    try {
      Gio2.DBus.session.call_sync(
        "org.gnome.Shell",
        "/org/gnome/Shell/Extensions/TilingShell",
        "org.gnome.Shell.Extensions.TilingShell",
        "openLayoutEditor",
        null,
        null,
        Gio2.DBusCallFlags.NONE,
        -1,
        null
      );
    } catch (e) {
      if (e instanceof Gio2.DBusError)
        Gio2.DBusError.strip_remote_error(e);
      console.error(e);
    }
  }
  _buildActivationKeysDropDown(value, onSelected, styleClass) {
    const options = new Gtk.StringList();
    const activationKeys = [
      0 /* CTRL */,
      1 /* ALT */,
      2 /* SUPER */
    ];
    activationKeys.forEach((k) => options.append(ActivationKey[k]));
    options.append("(None)");
    const dropdown = new Gtk.DropDown({
      model: options,
      selected: value
    });
    dropdown.connect("notify::selected-item", (dd) => {
      const index = dd.get_selected();
      const selected = index < 0 || index >= activationKeys.length ? -1 /* NONE */ : activationKeys[index];
      onSelected(selected);
    });
    if (styleClass)
      dropdown.add_css_class(styleClass);
    dropdown.set_vexpand(false);
    dropdown.set_valign(Gtk.Align.CENTER);
    return dropdown;
  }
  _buildLinkButton(label, uri) {
    const btn = new Gtk.Button({
      label,
      hexpand: false
    });
    btn.connect("clicked", () => {
      Gtk.show_uri(null, uri, Gdk.CURRENT_TIME);
    });
    return btn;
  }
  _buildShortcutButtonRow(shortcut, title, subtitle, onChange, styleClass) {
    const btn = new ShortcutSettingButton(shortcut);
    if (styleClass)
      btn.add_css_class(styleClass);
    btn.set_vexpand(false);
    btn.set_valign(Gtk.Align.CENTER);
    const adwRow = new Adw.ActionRow({
      title,
      subtitle,
      activatableWidget: btn
    });
    adwRow.add_suffix(btn);
    btn.connect("changed", onChange);
    return adwRow;
  }
  _buildScaleRow(title, subtitle, onChange, initialValue, min, max, step) {
    const scale = Gtk.Scale.new_with_range(
      Gtk.Orientation.HORIZONTAL,
      min,
      max,
      step
    );
    scale.set_value(initialValue);
    scale.set_vexpand(false);
    scale.set_valign(Gtk.Align.CENTER);
    const adwRow = new Adw.ActionRow({
      title,
      subtitle,
      activatableWidget: scale
    });
    scale.connect("value-changed", onChange);
    scale.set_size_request(150, -1);
    scale.set_digits(0);
    scale.set_draw_value(true);
    adwRow.add_suffix(scale);
    return adwRow;
  }
};
var ShortcutSettingButton = (_a = class extends Gtk.Button {
  _editor;
  _label;
  shortcut;
  constructor(value) {
    super({
      halign: Gtk.Align.CENTER,
      hexpand: false,
      vexpand: false,
      has_frame: false
    });
    this._editor = null;
    this._label = new Gtk.ShortcutLabel({
      disabled_text: "New accelerator\u2026",
      valign: Gtk.Align.CENTER,
      hexpand: false,
      vexpand: false
    });
    this.set_child(this._label);
    this.connect("clicked", this._onActivated.bind(this));
    this.shortcut = value;
    this._label.set_accelerator(this.shortcut);
    this.bind_property(
      "shortcut",
      this._label,
      "accelerator",
      GObject3.BindingFlags.DEFAULT
    );
  }
  _onActivated(widget) {
    const ctl = new Gtk.EventControllerKey();
    const content = new Adw.StatusPage({
      title: "New accelerator\u2026",
      // description: this._description,
      icon_name: "preferences-desktop-keyboard-shortcuts-symbolic"
    });
    this._editor = new Adw.Window({
      modal: true,
      hide_on_close: true,
      // @ts-expect-error "widget has get_root function"
      transient_for: widget.get_root(),
      width_request: 480,
      height_request: 320,
      content
    });
    this._editor.add_controller(ctl);
    ctl.connect("key-pressed", this._onKeyPressed.bind(this));
    this._editor.present();
  }
  _onKeyPressed(_widget, keyval, keycode, state) {
    let mask = state & Gtk.accelerator_get_default_mod_mask();
    mask &= ~Gdk.ModifierType.LOCK_MASK;
    if (!mask && keyval === Gdk.KEY_Escape) {
      this._editor?.close();
      return Gdk.EVENT_STOP;
    }
    if (!this.isValidBinding(mask, keycode, keyval) || !this.isValidAccel(mask, keyval))
      return Gdk.EVENT_STOP;
    if (!keyval && !keycode) {
      this._editor?.destroy();
      return Gdk.EVENT_STOP;
    } else {
      this.shortcut = Gtk.accelerator_name_with_keycode(
        null,
        keyval,
        keycode,
        mask
      );
      this._label.set_accelerator(this.shortcut);
      this.emit("changed", this.shortcut);
    }
    this._editor?.destroy();
    return Gdk.EVENT_STOP;
  }
  // Functions from https://gitlab.gnome.org/GNOME/gnome-control-center/-/blob/main/panels/keyboard/keyboard-shortcuts.c
  keyvalIsForbidden(keyval) {
    return [
      // Navigation keys
      Gdk.KEY_Home,
      Gdk.KEY_Left,
      Gdk.KEY_Up,
      Gdk.KEY_Right,
      Gdk.KEY_Down,
      Gdk.KEY_Page_Up,
      Gdk.KEY_Page_Down,
      Gdk.KEY_End,
      Gdk.KEY_Tab,
      // Return
      Gdk.KEY_KP_Enter,
      Gdk.KEY_Return,
      Gdk.KEY_Mode_switch
    ].includes(keyval);
  }
  isValidBinding(mask, keycode, keyval) {
    return !(mask === 0 || // @ts-expect-error "Gdk has SHIFT_MASK"
    mask === Gdk.SHIFT_MASK && keycode !== 0 && (keyval >= Gdk.KEY_a && keyval <= Gdk.KEY_z || keyval >= Gdk.KEY_A && keyval <= Gdk.KEY_Z || keyval >= Gdk.KEY_0 && keyval <= Gdk.KEY_9 || keyval >= Gdk.KEY_kana_fullstop && keyval <= Gdk.KEY_semivoicedsound || keyval >= Gdk.KEY_Arabic_comma && keyval <= Gdk.KEY_Arabic_sukun || keyval >= Gdk.KEY_Serbian_dje && keyval <= Gdk.KEY_Cyrillic_HARDSIGN || keyval >= Gdk.KEY_Greek_ALPHAaccent && keyval <= Gdk.KEY_Greek_omega || keyval >= Gdk.KEY_hebrew_doublelowline && keyval <= Gdk.KEY_hebrew_taf || keyval >= Gdk.KEY_Thai_kokai && keyval <= Gdk.KEY_Thai_lekkao || keyval >= Gdk.KEY_Hangul_Kiyeog && keyval <= Gdk.KEY_Hangul_J_YeorinHieuh || keyval === Gdk.KEY_space && mask === 0 || this.keyvalIsForbidden(keyval)));
  }
  isValidAccel(mask, keyval) {
    return Gtk.accelerator_valid(keyval, mask) || keyval === Gdk.KEY_Tab && mask !== 0;
  }
}, GObject3.registerClass(
  {
    Properties: {
      shortcut: GObject3.ParamSpec.string(
        "shortcut",
        "shortcut",
        "The shortcut",
        GObject3.ParamFlags.READWRITE,
        ""
      )
    },
    Signals: {
      changed: { param_types: [GObject3.TYPE_STRING] }
    }
  },
  _a
), _a);
export {
  TilingShellExtensionPreferences as default
};
