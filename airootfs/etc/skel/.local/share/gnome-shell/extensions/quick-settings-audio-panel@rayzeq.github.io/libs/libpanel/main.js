// Documentation: https://github.com/Rayzeq/libpanel/wiki
// Useful links:
//   - Drag & Drop example: https://gitlab.com/justperfection.channel/how-to-create-a-gnome-shell-extension/-/blob/master/example11%40example11.com/extension.js

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import { BoxPointer, PopupAnimation } from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { PopupMenu } from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { QuickSettingsMenu } from 'resource:///org/gnome/shell/ui/quickSettings.js';

import { Patcher } from './patcher.js';
import {
	add_named_connections,
	array_insert,
	array_remove,
	find_panel,
	get_extension_uuid,
	get_settings,
	rsplit,
	set_style,
	split
} from './utils.js';

const MenuManager = Main.panel.menuManager;
const QuickSettings = Main.panel.statusArea.quickSettings;
const QuickSettingsLayout = QuickSettings.menu._grid.layout_manager.constructor;

const VERSION = 1;
// The spacing between elements of the grid, in pixels.
const GRID_SPACING = 5;

function registerClass(metadata, klass) {
	if (klass === undefined) {
		klass = metadata;
		metadata = {};
	}

	metadata.GTypeName = `${metadata.GTypeName || `LibPanel_${klass.name}`}_${get_extension_uuid().replace(/[^A-Za-z_-]/g, '-')}`;

	return GObject.registerClass(metadata, klass);
}

const AutoHidable = superclass => {
	// We need to cache the created classes or else we would register the same class name multiple times
	if (AutoHidable.cache === undefined) AutoHidable.cache = {};
	if (AutoHidable.cache[superclass.name] !== undefined) return AutoHidable.cache[superclass.name];

	const klass = registerClass({
		GTypeName: `LibPanel_AutoHidable_${superclass.name}`,
	}, class extends superclass {
		constructor(...args) {
			const container = args.at(-1).container;
			delete args.at(-1).container;
			super(...args);

			// We need to accept `null` as valid value here
			// which is why we don't do `container || this`
			this.container = container === undefined ? this : container;
		}

		get container() {
			return this._lpah_container;
		}

		set container(value) {
			if (this._lpah_container !== undefined) this.disconnect_named(this._lpah_container);
			if (value !== null) {
				this._lpah_container = value;
				this.connect_named(this._lpah_container, 'child-added', (_container, child) => {
					this.connect_named(child, 'notify::visible', this._update_visibility.bind(this));
					this._update_visibility();
				});
				this.connect_named(this._lpah_container, 'child-removed', (_container, child) => {
					this.disconnect_named(child);
					this._update_visibility();
				});
				this._update_visibility();
			}
		}

		_get_ah_children() {
			return this._lpah_container.get_children();
		}

		_update_visibility() {
			for (const child of this._get_ah_children()) {
				if (child.visible) {
					this.show();
					return;
				}
			}

			this.hide();
			// Force the widget to take no space when hidden (this fixes some bugs but I don't know why)
			this.queue_relayout();
		}
	});
	AutoHidable.cache[superclass.name] = klass;
	return klass;
};

const Semitransparent = superclass => {
	// We need to cache the created classes or else we would register the same class name multiple times
	if (Semitransparent.cache === undefined) Semitransparent.cache = {};
	if (Semitransparent.cache[superclass.name] !== undefined) return Semitransparent.cache[superclass.name];

	const klass = registerClass({
		GTypeName: `LibPanel_Semitransparent_${superclass.name}`,
		Properties: {
			'transparent': GObject.ParamSpec.boolean(
				'transparent',
				'Transparent',
				'Whether this widget is transparent to pointer events',
				GObject.ParamFlags.READWRITE,
				true
			),
		},
	}, class extends superclass {
		get transparent() {
			if (this._transparent === undefined)
				this._transparent = true;

			return this._transparent;
		}

		set transparent(value) {
			this._transparent = value;
			this.notify('transparent');
		}

		vfunc_pick(context) {
			if (!this.transparent) {
				super.vfunc_pick(context);
			}
			for (const child of this.get_children()) {
				child.pick(context);
			}
		}
	});
	Semitransparent.cache[superclass.name] = klass;
	return klass;
};

const GridItem = superclass => {
	// We need to cache the created classes or else we would register the same class name multiple times
	if (GridItem.cache === undefined) GridItem.cache = {};
	if (GridItem.cache[superclass.name] !== undefined) return GridItem.cache[superclass.name];

	const klass = registerClass({
		GTypeName: `LibPanel_GridItem_${superclass.name}`,
		Properties: {
			'draggable': GObject.ParamSpec.boolean(
				'draggable',
				'draggable',
				'Whether this widget can be dragged',
				GObject.ParamFlags.READWRITE,
				true
			),
		},
	}, class extends superclass {
		constructor(panel_name, ...args) {
			super(...args);

			this.is_grid_item = true;
			this.panel_name = panel_name;

			this._drag_handle = DND.makeDraggable(this);
			this.connect_named(this._drag_handle, 'drag-begin', () => {
				QuickSettings.menu.transparent = false;

				// Prevent the first column from disapearing if it only contains `this`
				const column = this.get_parent()._delegate;
				const alignment = column.get_parent()._delegate._alignment;
				this._source_column = column;
				if (column._inner.get_children().length === 1
					&& ((alignment == "left" && column.get_previous_sibling() === null)
						|| (alignment == "right" && column.get_next_sibling() === null))) {
					column._width_constraint.source = this;
					column._inhibit_constraint_update = true;
				}

				this._dnd_placeholder?.destroy();
				this._dnd_placeholder = new DropZone(this);

				this._drag_monitor = {
					dragMotion: this._on_drag_motion.bind(this),
				};
				DND.addDragMonitor(this._drag_monitor);

				this._drag_orig_index = this.get_parent().get_children().indexOf(this);
				// dirty fix for Catppuccin theme (because it relys on CSS inheriting)
				// this may not work with custom grid items
				this.add_style_class_name?.("popup-menu");
			});
			// This is emited BEFORE drag-end, which means that this._dnd_placeholder is still available
			this.connect_named(this._drag_handle, 'drag-cancelled', () => {
				// This stop the dnd system from doing anything with `this`, we want to manage ourselves what to do.
				this._drag_handle._dragState = 2 /* DND.DragState.CANCELLED (this enum is private) */;

				if (this._dnd_placeholder.get_parent() !== null) {
					this._dnd_placeholder.acceptDrop(this);
				} else { // We manually reset the position of the panel because the dnd system will set it at the end of the column
					this.get_parent().remove_child(this);
					this._drag_handle._dragOrigParent.insert_child_at_index(this, this._drag_orig_index);
				}
			});
			// This is called when the drag ends with a drop and when it's cancelled
			this.connect_named(this._drag_handle, 'drag-end', (_drag_handle, _time, _cancelled) => {
				QuickSettings.menu.transparent = true;

				if (this._drag_monitor !== undefined) {
					DND.removeDragMonitor(this._drag_monitor);
					this._drag_monitor = undefined;
				}

				this._dnd_placeholder?.destroy();
				this._dnd_placeholder = null;

				const column = this._source_column;
				if (!column._is_destroyed && column._width_constraint.source == this) {
					column._width_constraint.source = column.get_next_sibling();
					column._inhibit_constraint_update = false;
				}

				// Something, somewhere is setting a forced width & height for this actor,
				// so we undo that
				this.width = -1;
				this.height = -1;
				this.remove_style_class_name?.("popup-menu");
			});
			this.connect_named(this, 'destroy', () => {
				if (this._drag_monitor !== undefined) {
					DND.removeDragMonitor(this._drag_monitor);
					this._drag_monitor = undefined;
				}
			});
		}

		get draggable() {
			return this._drag_handle._disabled || false;
		}

		set draggable(value) {
			this._drag_handle._disabled = value;
			this.notify('draggable');
		}

		_on_drag_motion(event) {
			if (event.source !== this) return DND.DragMotionResult.CONTINUE;
			if (event.targetActor === this._dnd_placeholder) return DND.DragMotionResult.COPY_DROP;

			const panel = find_panel(event.targetActor);

			const previous_sibling = panel?.get_previous_sibling();
			const target_pos = panel?.get_transformed_position();
			const self_size = this.get_transformed_size();

			this._dnd_placeholder.get_parent()?.remove_child(this._dnd_placeholder);

			if (event.targetActor.is_panel_column) {
				const column = event.targetActor._delegate._inner;
				if (column.y_align == Clutter.ActorAlign.START) {
					column.add_child(this._dnd_placeholder);
				} else {
					column.insert_child_at_index(this._dnd_placeholder, 0); 
				}
			} else if (panel !== undefined) {
				const column = panel.get_parent();
				if (previous_sibling === this._dnd_placeholder || event.y > (target_pos[1] + self_size[1])) {
					column.insert_child_above(this._dnd_placeholder, panel);
				} else {
					column.insert_child_below(this._dnd_placeholder, panel);
				}
			}

			return DND.DragMotionResult.NO_DROP;
		}
	});
	GridItem.cache[superclass.name] = klass;
	return klass;
};

const DropZone = registerClass(class DropZone extends St.Widget {
	constructor(source) {
		super({ style_class: source._drag_actor?.style_class || source.style_class, opacity: 127 });
		this._delegate = this;

		this._height_constraint = new Clutter.BindConstraint({
			coordinate: Clutter.BindCoordinate.WIDTH,
			source: source,
		});
		this._width_constraint = new Clutter.BindConstraint({
			coordinate: Clutter.BindCoordinate.HEIGHT,
			source: source,
		});
		this.add_constraint(this._height_constraint);
		this.add_constraint(this._width_constraint);
	}

	acceptDrop(source, _actor, _x, _y, _time) {
		if (!source.is_grid_item) return false;

		source.get_parent().remove_child(source);

		const column = this.get_parent();
		column.replace_child(this, source);

		column._delegate.get_parent()._delegate._cleanup();
		LibPanel.get_instance()._save_layout();
		return true;
	}
});

const AlignedBoxpointer = registerClass(class AlignedBoxpointer extends Semitransparent(BoxPointer) {
	constructor(arrowSide, binProperties) {
		super(arrowSide, binProperties);
		this._alignment = "right";
	}

	_reposition(allocationBox) {
		// code copied and modified from: https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/boxpointer.js#L463
		let sourceActor = this._sourceActor;
		let alignment = this._arrowAlignment;
		let monitorIndex = Main.layoutManager.findIndexForActor(sourceActor);

		this._sourceExtents = sourceActor.get_transformed_extents();
		this._workArea = Main.layoutManager.getWorkAreaForMonitor(monitorIndex);

		// Position correctly relative to the sourceActor
		const sourceAllocation = sourceActor.get_allocation_box();
		const sourceContentBox = sourceActor instanceof St.Widget
			? sourceActor.get_theme_node().get_content_box(sourceAllocation)
			: new Clutter.ActorBox({
				x2: sourceAllocation.get_width(),
				y2: sourceAllocation.get_height(),
			});
		let sourceTopLeft = this._sourceExtents.get_top_left();
		let sourceBottomRight = this._sourceExtents.get_bottom_right();
		let sourceCenterX = sourceTopLeft.x + sourceContentBox.x1 + (sourceContentBox.x2 - sourceContentBox.x1) * this._sourceAlignment;
		let sourceCenterY = sourceTopLeft.y + sourceContentBox.y1 + (sourceContentBox.y2 - sourceContentBox.y1) * this._sourceAlignment;
		let [, , natWidth, natHeight] = this.get_preferred_size();

		// We also want to keep it onscreen, and separated from the
		// edge by the same distance as the main part of the box is
		// separated from its sourceActor
		let workarea = this._workArea;
		let themeNode = this.get_theme_node();
		let borderWidth = themeNode.get_length('-arrow-border-width');
		let arrowBase = themeNode.get_length('-arrow-base');
		let borderRadius = themeNode.get_length('-arrow-border-radius');
		let margin = 4 * borderRadius + borderWidth + arrowBase;

		let gap = themeNode.get_length('-boxpointer-gap');
		let padding = themeNode.get_length('-arrow-rise');

		let resX, resY;

		switch (this._arrowSide) {
			case St.Side.TOP:
				// `gap` is 0
				// the thing that creates a gap is `padding`
				// it's added to allocation of the children of this actor, see BoxPointer.vfunc_allocate
				resY = sourceBottomRight.y + gap;
				allocationBox.set_size(allocationBox.get_width(), workarea.height - 2 * gap - padding);
				break;
			case St.Side.BOTTOM:
				// needs to be relative to `sourceTopLeft.y` to correctly support multi-monitor setups
				resY = sourceTopLeft.y - workarea.height + gap + padding;
				allocationBox.set_size(allocationBox.get_width(), workarea.height - 2 * gap - padding);
				break;
			case St.Side.LEFT:
				resX = sourceBottomRight.x + gap;
				break;
			case St.Side.RIGHT:
				resX = sourceTopLeft.x - natWidth - gap;
				break;
		}

		// Now align and position the pointing axis, making sure it fits on
		// screen. If the arrowOrigin is so close to the edge that the arrow
		// will not be isosceles, we try to compensate as follows:
		//   - We skip the rounded corner and settle for a right angled arrow
		//     as shown below. See _drawBorder for further details.
		//     |\_____
		//     |
		//     |
		//   - If the arrow was going to be acute angled, we move the position
		//     of the box to maintain the arrow's accuracy.

		let arrowOrigin;
		let halfBase = Math.floor(arrowBase / 2);
		let halfBorder = borderWidth / 2;
		let halfMargin = margin / 2;
		let [x1, y1] = [halfBorder, halfBorder];
		let [x2, y2] = [natWidth - halfBorder, natHeight - halfBorder];

		switch (this._arrowSide) {
			case St.Side.TOP:
			case St.Side.BOTTOM:
				if (this.text_direction === Clutter.TextDirection.RTL)
					alignment = 1.0 - alignment;

				resX = sourceCenterX - (halfMargin + (natWidth - margin) * alignment);

				if (this._alignment == "right") {
					resX = Math.max(resX, workarea.x + padding);
					resX = Math.min(resX, workarea.x + workarea.width - (padding + natWidth));
				} else if (this._alignment == "left") {
					resX = Math.min(resX, workarea.x + workarea.width - (padding + natWidth));
					resX = Math.max(resX, workarea.x + padding);
				}

				arrowOrigin = sourceCenterX - resX;
				if (arrowOrigin <= (x1 + (borderRadius + halfBase))) {
					if (arrowOrigin > x1)
						resX += arrowOrigin - x1;
					arrowOrigin = x1;
				} else if (arrowOrigin >= (x2 - (borderRadius + halfBase))) {
					if (arrowOrigin < x2)
						resX -= x2 - arrowOrigin;
					arrowOrigin = x2;
				}
				break;

			case St.Side.LEFT:
			case St.Side.RIGHT:
				resY = sourceCenterY - (halfMargin + (natHeight - margin) * alignment);

				resY = Math.max(resY, workarea.y + padding);
				resY = Math.min(resY, workarea.y + workarea.height - (padding + natHeight));

				arrowOrigin = sourceCenterY - resY;
				if (arrowOrigin <= (y1 + (borderRadius + halfBase))) {
					if (arrowOrigin > y1)
						resY += arrowOrigin - y1;
					arrowOrigin = y1;
				} else if (arrowOrigin >= (y2 - (borderRadius + halfBase))) {
					if (arrowOrigin < y2)
						resY -= y2 - arrowOrigin;
					arrowOrigin = y2;
				}
				break;
		}

		this.setArrowOrigin(arrowOrigin);

		let parent = this.get_parent();
		let success, x, y;
		while (!success) {
			[success, x, y] = parent.transform_stage_point(resX, resY);
			parent = parent.get_parent();
		}

		// Actually set the position
		allocationBox.set_origin(Math.floor(x), Math.floor(y));
	}
});

class PanelGrid extends PopupMenu {
	constructor(sourceActor, alignment) {
		super(sourceActor, 0, St.Side.TOP);
		this._valign = "top";

		// ==== We replace the BoxPointer with our own because we want to make it transparent ====
		global.focus_manager.remove_group(this._boxPointer);
		this._boxPointer.bin.set_child(null); // prevent `this.box` from being destroyed
		this._boxPointer.destroy();
		// The majority of this code has been copied from here:
		// https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/popupMenu.js#L801

		// We want to make the actor transparent
		this._boxPointer = new AlignedBoxpointer(this._arrowSide);
		this.actor = this._boxPointer;
		this.actor._delegate = this;
		this.actor.style_class = 'popup-menu-boxpointer';

		this._boxPointer.bin.set_child(this.box);
		this.actor.add_style_class_name('popup-menu');
		this.actor.add_style_class_name('QSAP-panel-grid');

		global.focus_manager.add_group(this.actor);
		this.actor.reactive = true;
		// =======================================================================================

		this.box._delegate = this;  // this used so columns can get `this` using `column.get_parent()._delegate`
		this.box.vertical = false;
		this._panel_style_class = this.box.style_class; // we save the style class that's used to make a nice panel
		this.box.style_class = ''; // and we remove it so it's invisible
		this.box.style = `spacing: ${GRID_SPACING}px`;
		this._set_alignment(alignment);

		this.actor.connect_after('notify::allocation', () => {
			// The `setTimeout` fixes the following warning:
			// Can't update stage views actor ... is on because it needs an allocation.
			if ((this._alignment == "right" && this.actor.x > 0)
				|| (this._alignment == "left" && this.actor.x + this.actor.width < this.actor.get_parent().allocation.x2))
				this._timeout_id = setTimeout(() => {
					this._timeout_id = null;
					this._add_column();
				}, 0);

			// this may invalidate the allocation, so this must be after the size checks
			if (this._boxPointer._sourceActor.get_transformed_position()[1] > (this._boxPointer.get_parent().allocation.y2 / 2)) {
				this._set_valign("bottom");
			} else {
				this._set_valign("top");
			}
		});
		this.actor.connect('destroy', () => {
			if (this._timeout_id) clearTimeout(this._timeout_id);
		});
	}

	_set_alignment(alignment) {
		if (alignment != this._alignment) {
			for (const column of this.box.get_children().toReversed()) {
				this.box.remove_child(column);
				// remove placeholder columns, they'll be recreated automatically
				if (!column.get_constraints().includes(column._width_constraint)) {
					this.box.add_child(column);
				}
			}
		}

		this._alignment = alignment;
		this._boxPointer._alignment = alignment;
	}

	_set_valign(alignment) {
		this._valign = alignment;
		for (const column of this.box.get_children()) {
			column._set_valign(alignment);
		}
	}

	get transparent() {
		return this.actor.transparent;
	}

	set transparent(value) {
		this.actor.transparent = value;
	}

	close(animate) {
		for (const column of this.box.get_children()) {
			column._close();
		}
		super.close(animate);
	}

	_add_panel(panel) {
		if (this.box.get_children().length === 0) {
			this._add_column()._add_panel(panel);
			return;
		}

		for (const column of this.box.get_children()) {
			if (column._panel_layout.indexOf(panel.panel_name) > -1) {
				column._add_panel(panel);
				return;
			}
		}

		// Everything here is really approximated because we can't have the allocations boxes at this point
		// Most notably, `max_height` will be wrong
		const max_height = this._boxPointer.get_parent()?.height || this.actor.height;
		let column;
		for (const children of this.box.get_children().reverse()) {
			if (this._get_column_height(children) < max_height) {
				column = children;
				break;
			}
		}
		if (!column) column = this.box.first_child;
		if (this._get_column_height(column) > max_height) {
			column = this._add_column();
		}
		column._add_panel(panel);
	}

	_get_column_height(column) {
		return column.get_children().reduce((acc, widget) => acc + widget.height, 0);
	}

	_add_column(layout = []) {
		const column = new PanelColumn(this._valign, layout);
		this.actor.bind_property('transparent', column, 'transparent', GObject.BindingFlags.SYNC_CREATE);
		if (this._alignment == "left") {
			this.box.add_child(column);
		} else if (this._alignment == "right") {
			this.box.insert_child_at_index(column, 0);
		}
		return column;
	}

	_get_panel_layout() {
		const layout = this.box.get_children().map(column => column._panel_layout);
		if (this._alignment == "left") layout.reverse();
		return layout;
	}

	_cleanup() {
		if (this._alignment == "left") {
			while (this.box.first_child._inner.get_children().length === 0) this.box.first_child.destroy();
		} else if (this._alignment == "right") {
			while (this.box.last_child._inner.get_children().length === 0) this.box.last_child.destroy();
		}
	}

	_get_panels() {
		return this.box.get_children().map(column => column.get_children()).flat();
	}
}

const PanelColumn = registerClass(class PanelColumn extends Semitransparent(St.BoxLayout) {
	constructor(valign, layout = []) {
		super({ y_align: Clutter.ActorAlign.FILL, vertical: true });
		this._delegate = this;
		this.is_panel_column = true; // since we can't use instanceof, we use this attribute
		this._panel_layout = layout;

		// `this` takes up the whole screen height, while `this._inner` is vertically aligned and contains items
		this._inner = new St.BoxLayout({ y_expand: true, vertical: true, style: `spacing: ${GRID_SPACING}px` });
		this._inner._delegate = this;
		this.add_child(this._inner);
		this._set_valign(valign);

		this._inhibit_constraint_update = false;
		this._width_constraint = new Clutter.BindConstraint({
			coordinate: Clutter.BindCoordinate.WIDTH,
			source: null,
		});
		this.add_constraint(this._width_constraint);

		this.connect_after_named(this._inner, 'child-added', (_self, child) => {
			if (this._inner.get_children().length === 1) this.remove_constraint(this._width_constraint);
			if (!child.is_grid_item) return;

			const prev_index = this._panel_layout.indexOf(child.get_previous_sibling()?.panel_name);
			const index = this._panel_layout.indexOf(child.panel_name);
			const next_index = this._panel_layout.indexOf(child.get_next_sibling()?.panel_name);
			// `child` is in the layout but is misplaced
			if (index > -1 && ((prev_index > -1 && index < prev_index) || (next_index > -1 && next_index < index))) {
				array_remove(this._panel_layout, child.panel_name);
				index = -1;
			}
			if (index < 0) { // `child` is not in the layout
				if (prev_index > -1)
					array_insert(this._panel_layout, prev_index + 1, child.panel_name);
				else if (next_index > 0)
					array_insert(this._panel_layout, next_index - 1, child.panel_name);
				else
					array_insert(this._panel_layout, 0, child.panel_name);
			}
		});
		this.connect_after_named(this._inner, 'child-removed', (_self, child) => {
			if (this._inner.get_children().length === 0) this.add_constraint(this._width_constraint);
			if (child._keep_layout || !child.is_grid_item) return;

			array_remove(this._panel_layout, child.panel_name);
		});

		this.connect('destroy', () => this._is_destroyed = true);
		this.connect_after_named(this, 'parent-set', (_self, old_parent) => {
			if (old_parent !== null) this.disconnect_named(old_parent);

			const parent = this.get_parent();
			if (parent === null) return;
			const update_source = (_parent, _actor) => {
				// clutter is being dumb and emit this signal even though `_parent` and `this` are destroyed
				// this fix it
				if (this._is_destroyed || this._inhibit_constraint_update) return;

				const alignment = this.get_parent()._delegate._alignment;
				if (alignment == "left") {
					this._width_constraint.source = this.get_previous_sibling();
				} else if (alignment == "right") {
					this._width_constraint.source = this.get_next_sibling();
				}
			};
			this.connect_after_named(parent, 'child-added', update_source);
			this.connect_after_named(parent, 'child-removed', update_source);

			update_source();
		});
	}

	_set_valign(alignment) {
		if (alignment == "top") {
			this._inner.y_align = Clutter.ActorAlign.START;
		} else {
			this._inner.y_align = Clutter.ActorAlign.END;
		}
	}

	_close() {
		for (const panel of this._inner.get_children()) {
			panel._close();
		}
	}

	_add_panel(panel) {
		const index = this._panel_layout.indexOf(panel.panel_name);
		if (index > -1) {
			const panels = this._inner.get_children().map(children => children.panel_name);
			for (const panel_name of this._panel_layout.slice(0, index).reverse()) {
				const children_index = panels.indexOf(panel_name);
				if (children_index > -1) {
					this._inner.insert_child_at_index(panel, children_index + 1);
					return;
				}
			}
			this._inner.insert_child_at_index(panel, 0);
		} else {
			this._inner.add_child(panel);
		}
	}
});

export var Panel = registerClass(class Panel extends GridItem(AutoHidable(St.Widget)) {
	constructor(panel_name, nColumns = 2) {
		super(`${get_extension_uuid()}/${panel_name}`, {
			// I have no idea why, but sometimes, a panel (not all of them) gets allocated too much space (behavior similar to `y-expand`)
			// This prevent it from taking all available space
			y_align: Clutter.ActorAlign.START,
			// Enable this so the menu block any click event from propagating through
			reactive: true,
			// We want to set this later
			container: null,
		});
		this._delegate = this;

		// Overlay layer that will hold sub-popups
		this._overlay = new Clutter.Actor({ layout_manager: new Clutter.BinLayout() });

		// Placeholder to make empty space when opening a sub-popup
		const placeholder = new Clutter.Actor({
			// The placeholder have the same height as the overlay, which means
			// it have the same height as the opened sub-popup
			constraints: new Clutter.BindConstraint({
				coordinate: Clutter.BindCoordinate.HEIGHT,
				source: this._overlay,
			}),
		});

		// The grid holding every element
		this._grid = new St.Widget({
			style_class: LibPanel.get_instance()._panel_grid._panel_style_class + ' quick-settings quick-settings-grid',
			layout_manager: new QuickSettingsLayout(placeholder, { nColumns }),
		});
		// Force the grid to take up all the available width. I'm using a constraint because x_expand don't work
		this._grid.add_constraint(new Clutter.BindConstraint({
			coordinate: Clutter.BindCoordinate.WIDTH,
			source: this,
		}));
		this.add_child(this._grid);
		this.container = this._grid;
		this._drag_actor = this._grid;
		this._grid.add_child(placeholder);

		this._dimEffect = new Clutter.BrightnessContrastEffect({ enabled: false });
		this._grid.add_effect_with_name('dim', this._dimEffect);

		this._overlay.add_constraint(new Clutter.BindConstraint({
			coordinate: Clutter.BindCoordinate.WIDTH,
			source: this._grid,
		}));

		this.add_child(this._overlay);
	}

	getItems() {
		// Every child except the placeholder
		return this._grid.get_children().filter(item => item != this._grid.layout_manager._overlay);
	}

	getFirstItem() {
		return this.getItems[0];
	}

	addItem(item, colSpan = 1) {
		this._grid.add_child(item);
		this._completeAddItem(item, colSpan);
	}

	insertItemBefore(item, sibling, colSpan = 1) {
		this._grid.insert_child_below(item, sibling);
		this._completeAddItem(item, colSpan);
	}

	_completeAddItem(item, colSpan) {
		this.setColumnSpan(item, colSpan);

		if (item.menu) {
			this._overlay.add_child(item.menu.actor);

			this.connect_named(item.menu, 'open-state-changed', (_, isOpen) => {
				this._setDimmed(isOpen);
				this._activeMenu = isOpen ? item.menu : null;
				// The sub-popup for the power menu is too high.
				// I don't know if it's the real source of the issue, but I suspect that the constraint that fixes its y position
				// isn't accounting for the padding of the grid, so we add it to the offset manually
				// Later: I added the name check because it breaks on the audio panel
				// so I'm almost certain that this is not a proper fix
				if (isOpen && this.getItems().indexOf(item) == 0 && this.panel_name == "gnome@main") {
					const constraint = item.menu.actor.get_constraints()[0];
					constraint.offset = 
						// the offset is normally bound to the height of the source
						constraint.source.height
						+ this._grid.get_theme_node().get_padding(St.Side.TOP);
					// note: we don't reset this property when the item is removed from this panel because
					// we hope that it will reset itself (because it's bound to the height of the source),
					// which in the case in my tests, but maybe some issue will arise because of this
				}
			});
		}
		if (item._menuButton) {
			item._menuButton._libpanel_y_expand_backup = item._menuButton.y_expand;
			item._menuButton.y_expand = false;
		}
	}

	removeItem(item) {
		if (!this._grid.get_children().includes(item)) console.error(`[LibPanel] ${get_extension_uuid()} tried to remove an item not in the panel`);

		item.get_parent().remove_child(item);
		if (item.menu) {
			this.disconnect_named(item.menu);
			item.menu.actor?.get_parent()?.remove_child(item.menu.actor);
		}
		if (item._menuButton) {
			item._menuButton.y_expand = item._menuButton._libpanel_y_expand_backup;
			item._menuButton._libpanel_y_expand_backup = undefined;
		}
	}

	getColumnSpan(item) {
		if (!this._grid.get_children().includes(item)) console.error(`[LibPanel] ${get_extension_uuid()} tried to get the column span of an item not in the panel`);

		const value = new GObject.Value();
		this._grid.layout_manager.child_get_property(this._grid, item, 'column-span', value);
		const column_span = value.get_int();
		value.unset();
		return column_span;
	}

	setColumnSpan(item, colSpan) {
		if (!this._grid.get_children().includes(item)) console.error(`[LibPanel] ${get_extension_uuid()} tried to set the column span of an item not in the panel`);

		this._grid.layout_manager.child_set_property(this._grid, item, 'column-span', colSpan);
	}

	_close() {
		this._activeMenu?.close(PopupAnimation.NONE);
	}

	_get_ah_children() {
		return this.getItems();
	}

	_setDimmed(dim) {
		// copied from https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/quickSettings.js
		const DIM_BRIGHTNESS = -0.4;
		const POPUP_ANIMATION_TIME = 400;

		const val = 127 * (1 + (dim ? 1 : 0) * DIM_BRIGHTNESS);
		const color = Clutter.Color.new(val, val, val, 255);

		this._grid.ease_property('@effects.dim.brightness', color, {
			mode: Clutter.AnimationMode.LINEAR,
			duration: POPUP_ANIMATION_TIME,
			onStopped: () => (this._dimEffect.enabled = dim),
		});
		this._dimEffect.enabled = true;
	}
});

// Patching the default to menu to have the exact same api as the one from `Panel`.
// This way, extensions can use them the same way.
QuickSettingsMenu.prototype.getItems = function () {
	return this._grid.get_children().filter(item => item != this._grid.layout_manager._overlay);
};
QuickSettingsMenu.prototype.removeItem = function (item) {
	this._grid.remove_child(item);
	if (item.menu) {
		// it seems that some menus don't have _signalConnectionsByName (probably custom menus)
		// we check it exists before using it
		if (item.menu._signalConnectionsByName) {
			// Manually remove the connection since we don't have its id.
			for (const id of item.menu._signalConnectionsByName["open-state-changed"]) {
				if (item.menu._signalConnections[id].callback.toString().includes("this._setDimmed")) {
					item.menu.disconnect(id);
				}
			}
		}

		this._overlay.remove_child(item.menu.actor);
	}
};
QuickSettingsMenu.prototype.getColumnSpan = function (item) {
	const value = new GObject.Value();
	this._grid.layout_manager.child_get_property(this._grid, item, 'column-span', value);
	const column_span = value.get_int();
	value.unset();
	return column_span;
};
QuickSettingsMenu.prototype.setColumnSpan = function (item, colSpan) {
	this._grid.layout_manager.child_set_property(this._grid, item, 'column-span', colSpan);
};

export class LibPanel {
	static _AutoHidable = AutoHidable;
	static _Semitransparent = Semitransparent;
	static _GridItem = GridItem;

	static _DropZone = DropZone;
	static _PanelGrid = PanelGrid;
	static _PanelColumn = PanelColumn;

	static get_instance() {
		return Main.panel._libpanel;
	}

	static get VERSION() {
		return LibPanel.get_instance()?.VERSION || VERSION;
	}

	// make the main panel available whether it's the gnome one or the libpanel one
	static get main_panel() {
		return LibPanel.get_instance()?._main_panel || QuickSettings.menu;
	}

	static get enabled() {
		return LibPanel.enablers.length !== 0;
	}

	static get enablers() {
		return LibPanel.get_instance()?._enablers || [];
	}

	static enable() {
		let instance = LibPanel.get_instance();
		if (!instance) {
			instance = Main.panel._libpanel = new LibPanel();
			instance._enable();
		};
		if (instance.constructor.VERSION != VERSION)
			console.warn(`[LibPanel] ${get_extension_uuid()} depends on libpanel ${VERSION} but libpanel ${instance.constructor.VERSION} is loaded`);

		const uuid = get_extension_uuid();
		if (instance._enablers.indexOf(uuid) < 0) instance._enablers.push(uuid);
	}

	static disable() {
		const instance = LibPanel.get_instance();
		if (!instance) return;

		const index = instance._enablers.indexOf(get_extension_uuid());
		if (index > -1) instance._enablers.splice(index, 1);

		if (instance._enablers.length === 0) {
			instance._disable();
			Main.panel._libpanel = undefined;
		};
	}

	static addPanel(panel) {
		const instance = LibPanel.get_instance();
		if (!instance)
			console.error(`[LibPanel] ${get_extension_uuid()} tried to add a panel, but the library is disabled.`);

		if (instance._settings.get_boolean('padding-enabled'))
			set_style(panel._grid, 'padding', `${instance._settings.get_int('padding')}px`);
		if (instance._settings.get_boolean('row-spacing-enabled'))
			set_style(panel._grid, 'spacing-rows', `${instance._settings.get_int('row-spacing')}px`);
		if (instance._settings.get_boolean('column-spacing-enabled'))
			set_style(panel._grid, 'spacing-columns', `${instance._settings.get_int('column-spacing')}px`);
		instance._panel_grid._add_panel(panel);
		instance._save_layout();
	}

	static removePanel(panel) {
		panel._keep_layout = true;
		panel.get_parent()?.remove_child(panel);
		panel._keep_layout = undefined;
	}

	constructor() {
		this._enablers = [];

		this._patcher = null;
		this._settings = null;
		this._panel_grid = null;
		this._old_menu = null;
	}

	_enable() {
		const this_path = '/' + split(rsplit(import.meta.url, '/', 1)[0], '/', 3)[3];;
		this._settings = get_settings(`${this_path}/org.gnome.shell.extensions.libpanel.gschema.xml`);

		// ======================== Patching ========================
		this._patcher = new Patcher();
		// Permit disabling widget dragging
		const _Draggable = DND.makeDraggable(new St.Widget()).constructor;
		this._patcher.replace_method(_Draggable, function _grabActor(wrapped, device, touchSequence) {
			if (this._disabled) return;
			wrapped(device, touchSequence);
		});
		// Add named connections to objects
		add_named_connections(this._patcher, GObject.Object);

		// =================== Replacing the popup ==================
		this._settings.connect('changed::alignment', () => {
			this._panel_grid._set_alignment(this._settings.get_string('alignment'));
		});

		this._panel_grid = new PanelGrid(QuickSettings, this._settings.get_string('alignment'));
		for (const column of this._settings.get_value("layout").recursiveUnpack().reverse()) {
			this._panel_grid._add_column(column);
		}

		this._old_menu = this._replace_menu(this._panel_grid);

		const new_menu = new Panel('', 2);
		// we do that to prevent the name being this: `quick-settings-audio-panel@rayzeq.github.io/gnome@main`
		new_menu.panel_name = 'gnome@main';
		this._move_quick_settings(this._old_menu, new_menu);
		LibPanel.addPanel(new_menu);
		this._main_panel = new_menu;

		// =================== Compatibility code ===================
		//this._panel_grid.box = new_menu.box; // this would override existing properties
		//this._panel_grid.actor =  = new_menu.actor;
		this._panel_grid._dimEffect = new_menu._dimEffect;
		this._panel_grid._grid = new_menu._grid;
		this._panel_grid._overlay = new_menu._overlay;
		this._panel_grid._setDimmed = new_menu._setDimmed.bind(new_menu);
		this._panel_grid.getFirstItem = new_menu.getFirstItem.bind(new_menu);
		this._panel_grid.addItem = new_menu.addItem.bind(new_menu);
		this._panel_grid.insertItemBefore = new_menu.insertItemBefore.bind(new_menu);
		this._panel_grid._completeAddItem = new_menu._completeAddItem.bind(new_menu);

		// ================== Visual customization ==================
		const set_style_for_panels = (name, value) => {
			for (const panel of this._panel_grid._get_panels()) {
				set_style(panel._grid, name, value);
			}
		};

		this._settings.connect('changed::padding-enabled', () => {
			if (this._settings.get_boolean('padding-enabled'))
				set_style_for_panels('padding', `${this._settings.get_int('padding')}px`);
			else
				set_style_for_panels('padding', null);
		});
		this._settings.connect('changed::padding', () => {
			if (!this._settings.get_boolean('padding-enabled')) return;
			set_style_for_panels('padding', `${this._settings.get_int('padding')}px`);
		});

		this._settings.connect('changed::row-spacing-enabled', () => {
			if (this._settings.get_boolean('row-spacing-enabled'))
				set_style_for_panels('spacing-rows', `${this._settings.get_int('row-spacing')}px`);
			else
				set_style_for_panels('spacing-rows', null);
		});
		this._settings.connect('changed::row-spacing', () => {
			if (!this._settings.get_boolean('row-spacing-enabled')) return;
			set_style_for_panels('spacing-rows', `${this._settings.get_int('row-spacing')}px`);
		});

		this._settings.connect('changed::column-spacing-enabled', () => {
			if (this._settings.get_boolean('column-spacing-enabled'))
				set_style_for_panels('spacing-columns', `${this._settings.get_int('column-spacing')}px`);
			else
				set_style_for_panels('spacing-columns', null);
		});
		this._settings.connect('changed::column-spacing', () => {
			if (!this._settings.get_boolean('column-spacing-enabled')) return;
			set_style_for_panels('spacing-columns', `${this._settings.get_int('column-spacing')}px`);
		});
		// https://gjs-docs.gnome.org/gio20~2.0/gio.settings#signal-changed
		// "Note that @settings only emits this signal if you have read key at
		// least once while a signal handler was already connected for key."
		this._settings.get_boolean('padding-enabled');
		this._settings.get_boolean('row-spacing-enabled');
		this._settings.get_boolean('column-spacing-enabled');
		this._settings.get_int('padding');
		this._settings.get_int('row-spacing');
		this._settings.get_int('column-spacing');
	};

	_disable() {
		this._move_quick_settings(this._main_panel, this._old_menu);
		this._replace_menu(this._old_menu);
		this._old_menu = null;

		this._panel_grid.destroy();
		this._panel_grid = null;

		this._settings = null;

		this._patcher.unpatch_all();
		this._patcher = null;
	}

	_replace_menu(new_menu) {
		const old_menu = QuickSettings.menu;

		MenuManager.removeMenu(old_menu);
		Main.layoutManager.disconnectObject(old_menu);

		QuickSettings.menu = null; // prevent old_menu from being destroyed
		QuickSettings.setMenu(new_menu);
		old_menu.actor.get_parent().remove_child(old_menu.actor);

		MenuManager.addMenu(new_menu);
		Main.layoutManager.connectObject('system-modal-opened', () => new_menu.close(), new_menu);

		return old_menu;
	}

	_move_quick_settings(old_menu, new_menu) {
		for (const item of old_menu.getItems()) {
			const column_span = old_menu.getColumnSpan(item);
			const visible = item.visible;

			old_menu.removeItem(item);

			new_menu.addItem(item, column_span);
			item.visible = visible; // force reset of visibility
		}
	}

	_save_layout() {
		const layout = this._panel_grid._get_panel_layout();

		// Remove leading empty columns
		while (layout[0]?.length === 0) layout.shift();
		this._settings.set_value(
			"layout",
			GLib.Variant.new_array(
				GLib.VariantType.new('as'),
				layout.map(column => GLib.Variant.new_strv(column))
			)
		);
	}
};
