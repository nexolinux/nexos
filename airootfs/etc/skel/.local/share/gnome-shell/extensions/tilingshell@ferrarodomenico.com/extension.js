var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result)
    __defProp(target, key, result);
  return result;
};
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// src/utils/shell.ts
var logger = (prefix) => (...content) => console.log("[tilingshell]", `[${prefix}]`, ...content);

// src/utils/ui.ts
import St from "gi://St";
import Meta from "gi://Meta";
import Clutter from "gi://Clutter";
import Mtk from "gi://Mtk";
import Shell from "gi://Shell";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
var getMonitors = () => Main.layoutManager.monitors;
var isPointInsideRect = (point, rect) => {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
};
var clampPointInsideRect = (point, rect) => {
  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
  return {
    x: clamp(point.x, rect.x, rect.x + rect.width),
    y: clamp(point.y, rect.y, rect.y + rect.height)
  };
};
var positionRelativeTo = (actor, anchestor) => {
  if (!actor)
    return void 0;
  if (actor === anchestor)
    return { x: actor.x, y: actor.y };
  const parent = actor.get_parent();
  if (parent === null)
    return void 0;
  const parentPos = positionRelativeTo(parent, anchestor);
  if (!parentPos)
    return void 0;
  return {
    x: actor.x + parentPos.x,
    y: actor.y + parentPos.y
  };
};
var buildTileGaps = (tilePos, innerGaps, outerGaps, container, scalingFactor = 1) => {
  const almostEqual = (first, second) => Math.abs(first - second) <= 1;
  const isLeft = almostEqual(tilePos.x, container.x);
  const isTop = almostEqual(tilePos.y, container.y);
  const isRight = almostEqual(
    tilePos.x + tilePos.width,
    container.x + container.width
  );
  const isBottom = almostEqual(
    tilePos.y + tilePos.height,
    container.y + container.height
  );
  const margin = new Clutter.Margin();
  margin.top = (isTop ? outerGaps.top : innerGaps.top / 2) * scalingFactor;
  margin.bottom = (isBottom ? outerGaps.bottom : innerGaps.bottom / 2) * scalingFactor;
  margin.left = (isLeft ? outerGaps.left : innerGaps.left / 2) * scalingFactor;
  margin.right = (isRight ? outerGaps.right : innerGaps.right / 2) * scalingFactor;
  return margin;
};
var getMonitorScalingFactor = (monitorIndex) => {
  const scalingFactor = St.ThemeContext.get_for_stage(
    global.get_stage()
  ).get_scale_factor();
  if (scalingFactor === 1)
    return global.display.get_monitor_scale(monitorIndex);
  return scalingFactor;
};
var getScalingFactorOf = (widget) => {
  const [hasReference, scalingReference] = widget.get_theme_node().lookup_length("scaling-reference", true);
  if (!hasReference)
    return [true, 1];
  const [hasValue, monitorScalingFactor] = widget.get_theme_node().lookup_length("monitor-scaling-factor", true);
  if (!hasValue)
    return [true, 1];
  return [scalingReference !== 1, monitorScalingFactor / scalingReference];
};
var enableScalingFactorSupport = (widget, monitorScalingFactor) => {
  if (!monitorScalingFactor)
    return;
  widget.set_style(
    `scaling-reference: 1px; monitor-scaling-factor: ${monitorScalingFactor}px;`
  );
};
function getWindowsOfMonitor(monitor) {
  return global.workspaceManager.get_active_workspace().list_windows().filter(
    (win) => win.get_window_type() === Meta.WindowType.NORMAL && Main.layoutManager.monitors[win.get_monitor()] === monitor
  );
}
function buildMarginOf(value) {
  const margin = new Clutter.Margin();
  margin.top = value;
  margin.bottom = value;
  margin.left = value;
  margin.right = value;
  return margin;
}
function buildMargin(params) {
  const margin = new Clutter.Margin();
  if (params.top)
    margin.top = params.top;
  if (params.bottom)
    margin.bottom = params.bottom;
  if (params.left)
    margin.left = params.left;
  if (params.right)
    margin.right = params.right;
  return margin;
}
function buildRectangle(params = {}) {
  return new Mtk.Rectangle({
    x: params.x || 0,
    y: params.y || 0,
    width: params.width || 0,
    height: params.height || 0
  });
}
function getEventCoords(event) {
  return event.get_coords ? event.get_coords() : [event.x, event.y];
}
function buildBlurEffect(sigma) {
  const effect = new Shell.BlurEffect();
  effect.set_mode(Shell.BlurMode.BACKGROUND);
  effect.set_brightness(1);
  if (effect.set_radius) {
    effect.set_radius(sigma * 2);
  } else {
    effect.set_sigma(sigma);
  }
  return effect;
}
function getWindows() {
  const workspace = global.workspaceManager.get_active_workspace();
  return global.display.get_tab_list(Meta.TabList.NORMAL_ALL, workspace).map((w) => {
    const transient = w.get_transient_for();
    return w.is_attached_dialog() && transient !== null ? transient : w;
  }).filter(
    (w, i, a) => w !== null && !w.skipTaskbar && a.indexOf(w) === i
  );
}

// src/utils/gjs.ts
import GObject from "gi://GObject";
function registerGObjectClass(target) {
  if (Object.prototype.hasOwnProperty.call(target, "metaInfo")) {
    return GObject.registerClass(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      target.metaInfo,
      target
    );
  } else {
    return GObject.registerClass(target);
  }
}

// src/components/tilepreview/tilePreview.ts
import St2 from "gi://St";
import Clutter2 from "gi://Clutter";
var WINDOW_ANIMATION_TIME = 100;
var TilePreview = class extends St2.Widget {
  _rect;
  _showing;
  _gaps;
  constructor(params) {
    super(params);
    if (params.parent)
      params.parent.add_child(this);
    this._showing = false;
    this._rect = params.rect || buildRectangle({});
    this._gaps = new Clutter2.Margin();
    this.gaps = params.gaps || new Clutter2.Margin();
  }
  set gaps(gaps) {
    const [, scalingFactor] = getScalingFactorOf(this);
    this._gaps.top = gaps.top * scalingFactor;
    this._gaps.right = gaps.right * scalingFactor;
    this._gaps.bottom = gaps.bottom * scalingFactor;
    this._gaps.left = gaps.left * scalingFactor;
    if (this._gaps.top === 0 && this._gaps.bottom === 0 && this._gaps.right === 0 && this._gaps.left === 0)
      this.remove_style_class_name("custom-tile-preview");
    else
      this.add_style_class_name("custom-tile-preview");
  }
  get gaps() {
    return this._gaps;
  }
  _init() {
    super._init();
    this.set_style_class_name("tile-preview custom-tile-preview");
    this.hide();
  }
  get innerX() {
    return this._rect.x + this._gaps.left;
  }
  get innerY() {
    return this._rect.y + this._gaps.top;
  }
  get innerWidth() {
    return this._rect.width - this._gaps.right - this._gaps.left;
  }
  get innerHeight() {
    return this._rect.height - this._gaps.top - this._gaps.bottom;
  }
  get rect() {
    return this._rect;
  }
  get showing() {
    return this._showing;
  }
  open(ease = false, position) {
    if (position)
      this._rect = position;
    const fadeInMove = this._showing;
    this._showing = true;
    this.show();
    if (fadeInMove) {
      this.ease({
        x: this.innerX,
        y: this.innerY,
        width: this.innerWidth,
        height: this.innerHeight,
        opacity: 255,
        duration: ease ? WINDOW_ANIMATION_TIME : 0,
        mode: Clutter2.AnimationMode.EASE_OUT_QUAD
      });
    } else {
      this.set_position(this.innerX, this.innerY);
      this.set_size(this.innerWidth, this.innerHeight);
      this.ease({
        opacity: 255,
        duration: ease ? WINDOW_ANIMATION_TIME : 0,
        mode: Clutter2.AnimationMode.EASE_OUT_QUAD
      });
    }
  }
  openBelow(window, ease = false, position) {
    if (this.get_parent() === global.windowGroup) {
      const windowActor = window.get_compositor_private();
      if (!windowActor)
        return;
      global.windowGroup.set_child_below_sibling(this, windowActor);
    }
    this.open(ease, position);
  }
  openAbove(window, ease = false, position) {
    if (this.get_parent() === global.windowGroup) {
      const windowActor = window.get_compositor_private();
      if (!windowActor)
        return;
      global.windowGroup.set_child_above_sibling(this, windowActor);
    }
    this.open(ease, position);
  }
  close(ease = false) {
    if (!this._showing)
      return;
    this._showing = false;
    this.ease({
      opacity: 0,
      duration: ease ? WINDOW_ANIMATION_TIME : 0,
      mode: Clutter2.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => this.hide()
    });
  }
};
TilePreview = __decorateClass([
  registerGObjectClass
], TilePreview);

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
import GObject2 from "gi://GObject";
var Tile2 = class {
  // @ts-expect-error "GObject has TYPE_JSOBJECT"
  static $gtype = GObject2.TYPE_JSOBJECT;
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

// src/components/layout/TileUtils.ts
var TileUtils = class {
  static apply_props(tile, container) {
    return buildRectangle({
      x: Math.round(container.width * tile.x + container.x),
      y: Math.round(container.height * tile.y + container.y),
      width: Math.round(container.width * tile.width),
      height: Math.round(container.height * tile.height)
    });
  }
  static build_tile(rect, container) {
    return new Tile2({
      x: (rect.x - container.x) / container.width,
      y: (rect.y - container.y) / container.height,
      width: rect.width / container.width,
      height: rect.height / container.height,
      groups: []
    });
  }
};

// src/components/layout/LayoutWidget.ts
import St3 from "gi://St";
import Clutter3 from "gi://Clutter";
var debug = logger("LayoutWidget");
var LayoutWidget = class extends St3.Widget {
  _previews;
  _containerRect;
  _layout;
  _innerGaps;
  _outerGaps;
  constructor(params) {
    super({ styleClass: params.styleClass || "" });
    params.parent.add_child(this);
    if (params.scalingFactor)
      this.scalingFactor = params.scalingFactor;
    this._previews = [];
    this._containerRect = params.containerRect || buildRectangle();
    this._layout = params.layout || new Layout([], "");
    this._innerGaps = params.innerGaps || new Clutter3.Margin();
    this._outerGaps = params.outerGaps || new Clutter3.Margin();
  }
  set scalingFactor(value) {
    enableScalingFactorSupport(this, value);
  }
  get innerGaps() {
    return this._innerGaps.copy();
  }
  get outerGaps() {
    return this._outerGaps.copy();
  }
  draw_layout() {
    this._previews = this._layout.tiles.map((tile) => {
      const tileRect = TileUtils.apply_props(tile, this._containerRect);
      const tileMargin = buildTileGaps(
        tileRect,
        this._innerGaps,
        this._outerGaps,
        this._containerRect
      );
      return this.buildTile(this, tileRect, tileMargin, tile);
    });
  }
  buildTile(_parent, _rect, _margin, _tile) {
    throw new Error(
      "This class shouldn't be instantiated but it should be extended instead"
    );
  }
  relayout(params) {
    let trigger_relayout = this._previews.length === 0;
    if (params?.innerGaps) {
      this._innerGaps = params.innerGaps.copy();
      trigger_relayout = true;
    }
    if (params?.outerGaps && this._outerGaps !== params.outerGaps) {
      this._outerGaps = params.outerGaps.copy();
      trigger_relayout = true;
    }
    if (params?.layout && this._layout !== params.layout) {
      this._layout = params.layout;
      trigger_relayout = true;
    }
    if (params?.containerRect && this._containerRect !== params.containerRect) {
      this._containerRect = params.containerRect.copy();
      trigger_relayout = true;
    }
    if (!trigger_relayout) {
      debug("relayout not needed");
      return false;
    }
    this._previews?.forEach((preview) => {
      if (preview.get_parent() === this)
        this.remove_child(preview);
      preview.destroy();
    });
    this._previews = [];
    if (this._containerRect.width === 0 || this._containerRect.height === 0)
      return true;
    this.draw_layout();
    this._previews.forEach((lay) => lay.open());
    return true;
  }
};
LayoutWidget = __decorateClass([
  registerGObjectClass
], LayoutWidget);

// src/components/tilingsystem/tilingLayout.ts
import Meta3 from "gi://Meta";
import Clutter4 from "gi://Clutter";
var DynamicTilePreview = class extends TilePreview {
  _originalRect;
  _canRestore;
  _tile;
  constructor(params, canRestore) {
    super(params);
    this._canRestore = canRestore || false;
    this._originalRect = this.rect.copy();
    this._tile = params.tile;
  }
  get originalRect() {
    return this._originalRect;
  }
  get canRestore() {
    return this._canRestore;
  }
  get tile() {
    return this._tile;
  }
  restore(ease = false) {
    if (!this._canRestore)
      return false;
    this._rect = this._originalRect.copy();
    if (this.showing)
      this.open(ease);
    return true;
  }
};
DynamicTilePreview = __decorateClass([
  registerGObjectClass
], DynamicTilePreview);
var TilingLayout = class extends LayoutWidget {
  _showing;
  constructor(layout, innerGaps, outerGaps, workarea, scalingFactor) {
    super({
      containerRect: workarea,
      parent: global.windowGroup,
      layout,
      innerGaps,
      outerGaps,
      scalingFactor
    });
    this._showing = false;
    super.relayout();
  }
  _init() {
    super._init();
    this.hide();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  buildTile(parent, rect, gaps, tile) {
    return new DynamicTilePreview({ parent, rect, gaps, tile }, true);
  }
  get showing() {
    return this._showing;
  }
  openBelow(window) {
    if (this._showing)
      return;
    const windowActor = window.get_compositor_private();
    if (!windowActor)
      return;
    global.windowGroup.set_child_below_sibling(this, windowActor);
    this.open();
  }
  openAbove(window) {
    if (this._showing)
      return;
    const windowActor = window.get_compositor_private();
    if (!windowActor)
      return;
    global.windowGroup.set_child_above_sibling(this, windowActor);
    this.open();
  }
  open(ease = false) {
    if (this._showing)
      return;
    this.show();
    this._showing = true;
    this.ease({
      x: this.x,
      y: this.y,
      opacity: 255,
      duration: ease ? WINDOW_ANIMATION_TIME : 0,
      mode: Clutter4.AnimationMode.EASE_OUT_QUAD
    });
  }
  close(ease = false) {
    if (!this._showing)
      return;
    this._showing = false;
    this.ease({
      opacity: 0,
      duration: ease ? WINDOW_ANIMATION_TIME : 0,
      mode: Clutter4.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => {
        this.unhoverAllTiles();
        this.hide();
      }
    });
  }
  _isHovered(currPointerPos, preview) {
    return currPointerPos.x >= preview.x && currPointerPos.x <= preview.x + preview.width && currPointerPos.y >= preview.y && currPointerPos.y <= preview.y + preview.height;
  }
  getTileBelow(currPointerPos, reset) {
    let found = this._previews.find(
      (preview) => this._isHovered(currPointerPos, preview.rect)
    );
    if (!found || !found.canRestore && reset) {
      found = this._previews.find(
        (preview) => preview.canRestore && this._isHovered(currPointerPos, preview.originalRect)
      );
    }
    if (!found)
      return void 0;
    if (reset && found.originalRect)
      return found.originalRect;
    return found.rect;
  }
  unhoverAllTiles() {
    const newPreviewsArray = [];
    this._previews.forEach((preview) => {
      if (preview.restore(true)) {
        newPreviewsArray.push(preview);
        preview.open(true);
      } else {
        this.remove_child(preview);
        preview.destroy();
      }
    });
    this._previews = newPreviewsArray;
  }
  hoverTilesInRect(rect, reset) {
    const newPreviewsArray = [];
    this._previews.forEach((preview) => {
      const [hasIntersection, rectangles] = this._subtractRectangles(
        preview.rect,
        rect
      );
      if (hasIntersection) {
        if (rectangles.length > 0) {
          let maxIndex = 0;
          for (let i = 0; i < rectangles.length; i++) {
            if (rectangles[i].area() > rectangles[maxIndex].area())
              maxIndex = i;
          }
          for (let i = 0; i < rectangles.length; i++) {
            if (i === maxIndex)
              continue;
            const currRect = rectangles[i];
            const gaps = buildTileGaps(
              currRect,
              this._innerGaps,
              this._outerGaps,
              this._containerRect
            );
            const innerPreview = new DynamicTilePreview(
              {
                parent: this,
                rect: currRect,
                gaps,
                tile: TileUtils.build_tile(
                  currRect,
                  this._containerRect
                )
              },
              false
            );
            innerPreview.open();
            this.set_child_above_sibling(innerPreview, preview);
            newPreviewsArray.push(innerPreview);
          }
          preview.open(
            false,
            rectangles[maxIndex].union(
              preview.rect.intersect(rect)[1]
            )
          );
          preview.open(true, rectangles[maxIndex]);
          newPreviewsArray.push(preview);
        } else {
          preview.close();
          newPreviewsArray.push(preview);
        }
      } else if (reset) {
        if (preview.restore(true)) {
          preview.open(true);
          newPreviewsArray.push(preview);
        } else {
          this.remove_child(preview);
          preview.destroy();
        }
      } else {
        preview.open(true);
        newPreviewsArray.push(preview);
      }
    });
    this._previews = newPreviewsArray;
  }
  /*
          Given the source rectangle (made by A, B, C, D and Hole), subtract the hole and obtain A, B, C and D.
          Edge cases:
              - The hole may not be inside the source rect (i.e there is no interstaction).
              It returns false and an array with the source rectangle only
              - The hole intersects the source rectangle, it returns true and an array with A, B, C and D rectangles.
              Some of A, B, C and D may not be returned if they don't exist
              - The hole is equal to the source rectangle, it returns true and an empty array since A, B, C and D
              rectangles do not exist
  
          Example:
          -------------------------
          |          A            |
          |-----------------------|
          |  B  |   hole    |  C  |
          |-----------------------|
          |          D            |
          -------------------------
      */
  _subtractRectangles(sourceRect, holeRect) {
    const [hasIntersection, intersection] = sourceRect.intersect(holeRect);
    if (!hasIntersection)
      return [false, [sourceRect]];
    if (intersection.area() >= sourceRect.area() * 0.98)
      return [true, []];
    const results = [];
    const heightA = intersection.y - sourceRect.y;
    if (heightA > 0) {
      results.push(
        buildRectangle({
          x: sourceRect.x,
          y: sourceRect.y,
          width: sourceRect.width,
          height: heightA
        })
      );
    }
    const widthB = intersection.x - sourceRect.x;
    if (widthB > 0 && intersection.height > 0) {
      results.push(
        buildRectangle({
          x: sourceRect.x,
          y: intersection.y,
          width: widthB,
          height: intersection.height
        })
      );
    }
    const widthC = sourceRect.x + sourceRect.width - intersection.x - intersection.width;
    if (widthC > 0 && intersection.height > 0) {
      results.push(
        buildRectangle({
          x: intersection.x + intersection.width,
          y: intersection.y,
          width: widthC,
          height: intersection.height
        })
      );
    }
    const heightD = sourceRect.y + sourceRect.height - intersection.y - intersection.height;
    if (heightD > 0) {
      results.push(
        buildRectangle({
          x: sourceRect.x,
          y: intersection.y + intersection.height,
          width: sourceRect.width,
          height: heightD
        })
      );
    }
    return [true, results];
  }
  getNearestTile(source, direction) {
    let previewFound;
    let bestDistance = -1;
    for (let i = 0; i < this._previews.length; i++) {
      const preview = this._previews[i];
      switch (direction) {
        case Meta3.DisplayDirection.RIGHT:
          if (preview.x <= source.x)
            continue;
          break;
        case Meta3.DisplayDirection.LEFT:
          if (preview.x >= source.x)
            continue;
          break;
        case Meta3.DisplayDirection.DOWN:
          if (preview.y <= source.y)
            continue;
          break;
        case Meta3.DisplayDirection.UP:
          if (preview.y >= source.y)
            continue;
          break;
        default:
          continue;
      }
      const euclideanDistance = (preview.x - source.x) * (preview.x - source.x) + (preview.y - source.y) * (preview.y - source.y);
      if (!previewFound || euclideanDistance < bestDistance) {
        previewFound = preview;
        bestDistance = euclideanDistance;
      }
    }
    if (!previewFound)
      return void 0;
    return {
      rect: buildRectangle({
        x: previewFound.innerX,
        y: previewFound.innerY,
        width: previewFound.innerWidth,
        height: previewFound.innerHeight
      }),
      tile: previewFound.tile
    };
  }
  getRightmostTile() {
    let previewFound = this._previews[0];
    for (let i = 1; i < this._previews.length; i++) {
      const preview = this._previews[i];
      if (preview.x + preview.width < previewFound.x + previewFound.width)
        continue;
      if (preview.x + preview.width > previewFound.x + previewFound.width)
        previewFound = preview;
      else if (preview.y < previewFound.y)
        previewFound = preview;
    }
    return {
      rect: buildRectangle({
        x: previewFound.innerX,
        y: previewFound.innerY,
        width: previewFound.innerWidth,
        height: previewFound.innerHeight
      }),
      tile: previewFound.tile
    };
  }
  getLeftmostTile() {
    let previewFound = this._previews[0];
    for (let i = 1; i < this._previews.length; i++) {
      const preview = this._previews[i];
      if (preview.x > previewFound.x)
        continue;
      if (preview.x < previewFound.x)
        previewFound = preview;
      else if (preview.y < previewFound.y)
        previewFound = preview;
    }
    return {
      rect: buildRectangle({
        x: previewFound.innerX,
        y: previewFound.innerY,
        width: previewFound.innerWidth,
        height: previewFound.innerHeight
      }),
      tile: previewFound.tile
    };
  }
};
TilingLayout = __decorateClass([
  registerGObjectClass
], TilingLayout);

// src/components/snapassist/snapAssistTile.ts
import St4 from "gi://St";
var SnapAssistTile = class extends TilePreview {
  _tile;
  _styleChangedSignalID;
  constructor(params) {
    super({ parent: params.parent, rect: params.rect, gaps: params.gaps });
    this._tile = params.tile;
    const isLeft = this._tile.x <= 1e-3;
    const isTop = this._tile.y <= 1e-3;
    const isRight = this._tile.x + this._tile.width >= 0.99;
    const isBottom = this._tile.y + this._tile.height >= 0.99;
    const [alreadyScaled, scalingFactor] = getScalingFactorOf(this);
    const radiusValue = (alreadyScaled ? 1 : scalingFactor) * (this.get_theme_node().get_length("border-radius-value") / (alreadyScaled ? scalingFactor : 1));
    const radius = [2, 2, 2, 2];
    if (isTop && isLeft)
      radius[St4.Corner.TOPLEFT] = radiusValue;
    if (isTop && isRight)
      radius[St4.Corner.TOPRIGHT] = radiusValue;
    if (isBottom && isRight)
      radius[St4.Corner.BOTTOMRIGHT] = radiusValue;
    if (isBottom && isLeft)
      radius[St4.Corner.BOTTOMLEFT] = radiusValue;
    this.set_style(`
            border-radius: ${radius[St4.Corner.TOPLEFT]}px ${radius[St4.Corner.TOPRIGHT]}px ${radius[St4.Corner.BOTTOMRIGHT]}px ${radius[St4.Corner.BOTTOMLEFT]}px;`);
    this._applyStyle();
    this._styleChangedSignalID = St4.ThemeContext.get_for_stage(
      global.get_stage()
    ).connect("changed", () => {
      this._applyStyle();
    });
    this.connect("destroy", () => this.onDestroy());
  }
  _init() {
    super._init();
    this.set_style_class_name("snap-assist-tile button");
  }
  get tile() {
    return this._tile;
  }
  _applyStyle() {
    const [hasColor, { red, green, blue }] = this.get_theme_node().lookup_color("color", true);
    if (!hasColor)
      return;
    if (red * 0.299 + green * 0.587 + blue * 0.114 > 186) {
      this.remove_style_class_name("dark");
    } else {
      this.add_style_class_name("dark");
    }
  }
  onDestroy() {
    if (this._styleChangedSignalID) {
      St4.ThemeContext.get_for_stage(global.get_stage()).disconnect(
        this._styleChangedSignalID
      );
      this._styleChangedSignalID = void 0;
    }
  }
};
SnapAssistTile = __decorateClass([
  registerGObjectClass
], SnapAssistTile);

// src/components/snapassist/snapAssistLayout.ts
import Clutter6 from "gi://Clutter";
var SnapAssistLayout = class extends LayoutWidget {
  // 16:9 ratio. -> (16*this._snapAssistHeight) / 9 and then rounded to int
  constructor(parent, layout, gaps) {
    super({
      parent,
      layout,
      innerGaps: gaps.copy(),
      outerGaps: new Clutter6.Margin(),
      containerRect: buildRectangle(),
      styleClass: "snap-assist-layout"
    });
    const [, scalingFactor] = getScalingFactorOf(this);
    const width = SnapAssistLayout._snapAssistWidth * scalingFactor;
    const height = SnapAssistLayout._snapAssistHeight * scalingFactor;
    super.relayout({
      containerRect: buildRectangle({ x: 0, y: 0, width, height })
    });
  }
  buildTile(parent, rect, gaps, tile) {
    return new SnapAssistTile({ parent, rect, gaps, tile });
  }
  getTileBelow(cursorPos) {
    const [x, y] = this.get_transformed_position();
    for (let i = 0; i < this._previews.length; i++) {
      const preview = this._previews[i];
      const pos = { x: x + preview.rect.x, y: y + preview.rect.y };
      const isHovering = cursorPos.x >= pos.x && cursorPos.x <= pos.x + preview.rect.width && cursorPos.y >= pos.y && cursorPos.y <= pos.y + preview.rect.height;
      if (isHovering)
        return preview;
    }
  }
};
__publicField(SnapAssistLayout, "_snapAssistHeight", 68);
__publicField(SnapAssistLayout, "_snapAssistWidth", 120);
SnapAssistLayout = __decorateClass([
  registerGObjectClass
], SnapAssistLayout);

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

// src/utils/signalHandling.ts
var SignalHandling = class {
  _signalsIds;
  constructor() {
    this._signalsIds = {};
  }
  connect(obj, key, fun) {
    const signalId = obj.connect(key, fun);
    this._signalsIds[key] = { id: signalId, obj };
  }
  disconnect(obj) {
    if (!obj) {
      Object.keys(this._signalsIds).forEach((key) => {
        this._signalsIds[key].obj.disconnect(this._signalsIds[key].id);
        delete this._signalsIds[key];
      });
    } else {
      const keyFound = Object.keys(this._signalsIds).find(
        (key) => this._signalsIds[key].obj === obj
      );
      if (keyFound) {
        obj.disconnect(this._signalsIds[keyFound].id);
        delete this._signalsIds[keyFound];
      }
    }
  }
};

// src/utils/globalState.ts
import GObject4 from "gi://GObject";
import * as Main2 from "resource:///org/gnome/shell/ui/main.js";
var GlobalState = class extends GObject4.Object {
  _signals;
  _layouts;
  static get() {
    if (!this._instance)
      this._instance = new GlobalState();
    return this._instance;
  }
  static destroy() {
    if (this._instance) {
      this._instance._signals.disconnect();
      this._instance._layouts = [];
      this._instance = null;
    }
  }
  constructor() {
    super();
    this._signals = new SignalHandling();
    this._layouts = Settings.get_layouts_json();
    this._signals.connect(Settings, Settings.SETTING_LAYOUTS_JSON, () => {
      this._layouts = Settings.get_layouts_json();
      this.emit(GlobalState.SIGNAL_LAYOUTS_CHANGED);
    });
  }
  get layouts() {
    return this._layouts;
  }
  addLayout(newLay) {
    this._layouts.push(newLay);
    this.layouts = this._layouts;
  }
  deleteLayout(layoutToDelete) {
    const layFoundIndex = this._layouts.findIndex(
      (lay) => lay.id === layoutToDelete.id
    );
    if (layFoundIndex === -1)
      return;
    this._layouts.splice(layFoundIndex, 1);
    this.layouts = this._layouts;
    const selectedLayouts = Settings.get_selected_layouts();
    if (layoutToDelete.id === selectedLayouts[Main2.layoutManager.primaryIndex]) {
      selectedLayouts[Main2.layoutManager.primaryIndex] = this._layouts[0].id;
      Settings.save_selected_layouts_json(selectedLayouts);
    }
  }
  editLayout(newLay) {
    const layFoundIndex = this._layouts.findIndex(
      (lay) => lay.id === newLay.id
    );
    if (layFoundIndex === -1)
      return;
    this._layouts[layFoundIndex] = newLay;
    this.layouts = this._layouts;
  }
  set layouts(layouts) {
    this._layouts = layouts;
    Settings.save_layouts_json(layouts);
    this.emit(GlobalState.SIGNAL_LAYOUTS_CHANGED);
  }
  getSelectedLayoutOfMonitor(monitorIndex) {
    const selectedLayouts = Settings.get_selected_layouts();
    if (monitorIndex < 0 || monitorIndex >= selectedLayouts.length)
      monitorIndex = 0;
    return this._layouts.find(
      (lay) => lay.id === selectedLayouts[monitorIndex]
    ) || this._layouts[0];
  }
};
__publicField(GlobalState, "metaInfo", {
  Signals: {
    "layouts-changed": {
      param_types: []
    }
  },
  GTypeName: "GlobalState"
});
__publicField(GlobalState, "SIGNAL_LAYOUTS_CHANGED", "layouts-changed");
__publicField(GlobalState, "_instance");
GlobalState = __decorateClass([
  registerGObjectClass
], GlobalState);

// src/components/snapassist/snapAssist.ts
import Clutter7 from "gi://Clutter";
import St5 from "gi://St";
import Gio2 from "gi://Gio";
import GObject5 from "gi://GObject";
var SNAP_ASSIST_SIGNAL = "snap-assist";
var SNAP_ASSIST_ANIMATION_TIME = 180;
var GAPS = 4;
var SnapAssistContent = class extends St5.BoxLayout {
  _container;
  _showing;
  _signals;
  _snapAssistLayouts;
  _isEnlarged = false;
  _hoveredTile;
  _bottomPadding;
  _blur;
  _snapAssistantThreshold;
  _monitorIndex;
  constructor(container, monitorIndex) {
    super({
      name: "snap_assist_content",
      xAlign: Clutter7.ActorAlign.CENTER,
      yAlign: Clutter7.ActorAlign.CENTER,
      vertical: false,
      reactive: true,
      styleClass: "popup-menu-content snap-assistant"
    });
    this._container = container;
    this._container.add_child(this);
    this._signals = new SignalHandling();
    this._snapAssistLayouts = [];
    this._isEnlarged = false;
    this._showing = true;
    this._bottomPadding = 0;
    this._blur = false;
    this._monitorIndex = monitorIndex;
    this._snapAssistantThreshold = 54 * getMonitorScalingFactor(this._monitorIndex);
    Settings.bind(
      Settings.SETTING_ENABLE_BLUR_SNAP_ASSISTANT,
      this,
      "blur",
      Gio2.SettingsBindFlags.GET
    );
    Settings.bind(
      Settings.SETTING_SNAP_ASSISTANT_THRESHOLD,
      this,
      "snapAssistantThreshold",
      Gio2.SettingsBindFlags.GET
    );
    this._applyStyle();
    this._signals.connect(
      St5.ThemeContext.get_for_stage(global.get_stage()),
      "changed",
      () => {
        this._applyStyle();
      }
    );
    this._setLayouts(GlobalState.get().layouts);
    this._signals.connect(
      GlobalState.get(),
      GlobalState.SIGNAL_LAYOUTS_CHANGED,
      () => {
        this._setLayouts(GlobalState.get().layouts);
      }
    );
    this.connect("destroy", () => this._signals.disconnect());
    this.close();
  }
  set blur(value) {
    if (this._blur === value)
      return;
    this._blur = value;
    this.get_effect("blur")?.set_enabled(value);
    this._applyStyle();
  }
  set snapAssistantThreshold(value) {
    this._snapAssistantThreshold = value * getMonitorScalingFactor(this._monitorIndex);
  }
  get showing() {
    return this._showing;
  }
  _init() {
    super._init();
    const effect = buildBlurEffect(36);
    effect.set_name("blur");
    effect.set_enabled(this._blur);
    this.add_effect(effect);
    this.add_style_class_name("popup-menu-content snap-assistant");
  }
  _applyStyle() {
    this.set_style(null);
    const [alreadyScaled, finalScalingFactor] = getScalingFactorOf(this);
    this._bottomPadding = (alreadyScaled ? 1 : finalScalingFactor) * (this.get_theme_node().get_padding(St5.Side.BOTTOM) / (alreadyScaled ? finalScalingFactor : 1));
    const backgroundColor = this.get_theme_node().get_background_color().copy();
    const alpha = this._blur ? 0.7 : backgroundColor.alpha;
    this.set_style(`
            padding: ${this._bottomPadding}px !important;
            background-color: rgba(${backgroundColor.red}, ${backgroundColor.green}, ${backgroundColor.blue}, ${alpha}) !important;
        `);
  }
  close(ease = false) {
    if (!this._showing)
      return;
    this._showing = false;
    this._isEnlarged = false;
    this.set_x(this._container.width / 2 - this.width / 2);
    this.ease({
      y: this._desiredY,
      opacity: 0,
      duration: ease ? SNAP_ASSIST_ANIMATION_TIME : 0,
      mode: Clutter7.AnimationMode.EASE_OUT_QUAD,
      onComplete: () => {
        this.hide();
      }
    });
  }
  get _desiredY() {
    return this._isEnlarged ? Math.max(
      0,
      this._snapAssistantThreshold - this.height / 2 + this._bottomPadding
    ) : -this.height + this._bottomPadding;
  }
  open(ease = false) {
    if (!this._showing)
      this.get_parent()?.set_child_above_sibling(this, null);
    this.set_x(this._container.width / 2 - this.width / 2);
    this.show();
    this._showing = true;
    this.ease({
      y: this._desiredY,
      opacity: 255,
      duration: ease ? SNAP_ASSIST_ANIMATION_TIME : 0,
      mode: Clutter7.AnimationMode.EASE_OUT_QUAD
    });
  }
  _setLayouts(layouts) {
    this._snapAssistLayouts.forEach((lay) => lay.destroy());
    this.remove_all_children();
    const [, scalingFactor] = getScalingFactorOf(this);
    const inner_gaps = Settings.get_inner_gaps(scalingFactor);
    const layoutGaps = buildMargin({
      top: inner_gaps.top === 0 ? 0 : GAPS,
      bottom: inner_gaps.bottom === 0 ? 0 : GAPS,
      left: inner_gaps.left === 0 ? 0 : GAPS,
      right: inner_gaps.right === 0 ? 0 : GAPS
    });
    this._snapAssistLayouts = layouts.map((lay, ind) => {
      const saLay = new SnapAssistLayout(this, lay, layoutGaps);
      if (ind < layouts.length - 1) {
        this.add_child(
          new St5.Widget({ width: this._bottomPadding, height: 1 })
        );
      }
      return saLay;
    });
    this.ensure_style();
    this.set_x(this._container.width / 2 - this.width / 2);
  }
  onMovingWindow(window, ease = false, currPointerPos) {
    const wasEnlarged = this._isEnlarged;
    this.handleOpening(window, ease, currPointerPos);
    if (!this._showing || !this._isEnlarged) {
      if (this._hoveredTile)
        this._hoveredTile.set_hover(false);
      this._hoveredTile = void 0;
      if (wasEnlarged) {
        this._container.emit(
          SNAP_ASSIST_SIGNAL,
          new Tile2({ x: 0, y: 0, width: 0, height: 0, groups: [] })
        );
      }
      return;
    }
    const changed = this.handleTileHovering(currPointerPos);
    if (changed) {
      const tile = this._hoveredTile?.tile || new Tile2({ x: 0, y: 0, width: 0, height: 0, groups: [] });
      this._container.emit(SNAP_ASSIST_SIGNAL, tile);
    }
  }
  handleOpening(window, ease = false, currPointerPos) {
    if (!this._showing) {
      if (this.get_parent() === global.windowGroup) {
        const windowActor = window.get_compositor_private();
        if (!windowActor)
          return;
        global.windowGroup.set_child_above_sibling(this, windowActor);
      }
    }
    const height = this.height + (this._isEnlarged ? 0 : this._snapAssistantThreshold);
    const minY = this._container.y;
    const maxY = this._container.y + this._desiredY + height;
    const minX = this._container.x + this.x - this._snapAssistantThreshold;
    const maxX = this._container.x + this.x + this.width + this._snapAssistantThreshold;
    const isNear = this.isBetween(minX, currPointerPos.x, maxX) && this.isBetween(minY, currPointerPos.y, maxY);
    if (this._showing && this._isEnlarged === isNear)
      return;
    this._isEnlarged = isNear;
    this.open(ease);
  }
  handleTileHovering(currPointerPos) {
    if (!this._isEnlarged) {
      const changed = this._hoveredTile !== void 0;
      if (this._hoveredTile)
        this._hoveredTile.set_hover(false);
      this._hoveredTile = void 0;
      return changed;
    }
    let newTileHovered;
    for (let index = 0; index < this._snapAssistLayouts.length; index++) {
      const snapAssistLay = this._snapAssistLayouts[index];
      newTileHovered = snapAssistLay.getTileBelow(currPointerPos);
      if (newTileHovered)
        break;
    }
    const tileChanged = newTileHovered !== this._hoveredTile;
    if (tileChanged) {
      this._hoveredTile?.set_hover(false);
      this._hoveredTile = newTileHovered;
    }
    if (this._hoveredTile)
      this._hoveredTile.set_hover(true);
    return tileChanged;
  }
  isBetween(min, num, max) {
    return min <= num && num <= max;
  }
};
__publicField(SnapAssistContent, "metaInfo", {
  GTypeName: "SnapAssistContent",
  Properties: {
    blur: GObject5.ParamSpec.boolean(
      "blur",
      "blur",
      "Enable or disable the blur effect",
      GObject5.ParamFlags.READWRITE,
      false
    ),
    snapAssistantThreshold: GObject5.ParamSpec.uint(
      "snapAssistantThreshold",
      "snapAssistantThreshold",
      "Distance from the snap assistant to trigger its opening/closing",
      GObject5.ParamFlags.READWRITE,
      0,
      240,
      16
    )
  }
});
SnapAssistContent = __decorateClass([
  registerGObjectClass
], SnapAssistContent);
var SnapAssist = class extends St5.Widget {
  _content;
  constructor(parent, workArea, monitorIndex, scalingFactor) {
    super();
    parent.add_child(this);
    this.workArea = workArea;
    this.set_clip(0, 0, workArea.width, workArea.height);
    if (scalingFactor)
      enableScalingFactorSupport(this, scalingFactor);
    this._content = new SnapAssistContent(this, monitorIndex);
  }
  set workArea(newWorkArea) {
    this.set_position(newWorkArea.x, newWorkArea.y);
    this.set_width(newWorkArea.width);
    this.set_clip(0, 0, newWorkArea.width, newWorkArea.height);
  }
  onMovingWindow(window, ease = false, currPointerPos) {
    this._content.onMovingWindow(window, ease, currPointerPos);
  }
  close(ease = false) {
    this._content.close(ease);
  }
};
__publicField(SnapAssist, "metaInfo", {
  GTypeName: "SnapAssist",
  Signals: {
    "snap-assist": {
      param_types: [Tile2.$gtype]
    }
  }
});
SnapAssist = __decorateClass([
  registerGObjectClass
], SnapAssist);

// src/components/tilepreview/selectionTilePreview.ts
import St6 from "gi://St";
import Gio3 from "gi://Gio";
import GObject6 from "gi://GObject";
var SelectionTilePreview = class extends TilePreview {
  _blur;
  constructor(params) {
    super({ parent: params.parent, name: "SelectionTilePreview" });
    this._blur = false;
    Settings.bind(
      Settings.SETTING_ENABLE_BLUR_SELECTED_TILEPREVIEW,
      this,
      "blur",
      Gio3.SettingsBindFlags.GET
    );
    this._recolor();
    const styleChangedSignalID = St6.ThemeContext.get_for_stage(
      global.get_stage()
    ).connect("changed", () => {
      this._recolor();
    });
    this.connect(
      "destroy",
      () => St6.ThemeContext.get_for_stage(global.get_stage()).disconnect(
        styleChangedSignalID
      )
    );
    this._rect.width = this.gaps.left + this.gaps.right;
    this._rect.height = this.gaps.top + this.gaps.bottom;
  }
  set blur(value) {
    if (this._blur === value)
      return;
    this._blur = value;
    this.get_effect("blur")?.set_enabled(value);
    if (this._blur)
      this.add_style_class_name("blur-tile-preview");
    else
      this.remove_style_class_name("blur-tile-preview");
    this._recolor();
  }
  _init() {
    super._init();
    const effect = buildBlurEffect(48);
    effect.set_name("blur");
    effect.set_enabled(this._blur);
    this.add_effect(effect);
    this.add_style_class_name("selection-tile-preview");
  }
  _recolor() {
    this.set_style(null);
    const backgroundColor = this.get_theme_node().get_background_color().copy();
    const newAlpha = Math.max(
      Math.min(backgroundColor.alpha + 35, 255),
      160
    );
    this.set_style(`
            background-color: rgba(${backgroundColor.red}, ${backgroundColor.green}, ${backgroundColor.blue}, ${newAlpha / 255}) !important;
        `);
  }
  close(ease = false) {
    if (!this._showing)
      return;
    this._rect.width = this.gaps.left + this.gaps.right;
    this._rect.height = this.gaps.top + this.gaps.bottom;
    super.close(ease);
  }
};
__publicField(SelectionTilePreview, "metaInfo", {
  GTypeName: "SelectionTilePreview",
  Properties: {
    blur: GObject6.ParamSpec.boolean(
      "blur",
      "blur",
      "Enable or disable the blur effect",
      GObject6.ParamFlags.READWRITE,
      false
    )
  }
});
SelectionTilePreview = __decorateClass([
  registerGObjectClass
], SelectionTilePreview);

// src/components/tilingsystem/edgeTilingManager.ts
import GObject7 from "gi://GObject";
var EDGE_TILING_OFFSET = 16;
var TOP_EDGE_TILING_OFFSET = 8;
var QUARTER_PERCENTAGE = 0.5;
var EdgeTilingManager = class extends GObject7.Object {
  _workArea;
  _quarterActivationPercentage;
  // activation zones
  _topLeft;
  _topRight;
  _bottomLeft;
  _bottomRight;
  _topCenter;
  _leftCenter;
  _rightCenter;
  // current active zone
  _activeEdgeTile;
  constructor(initialWorkArea) {
    super();
    this._workArea = buildRectangle();
    this._topLeft = buildRectangle();
    this._topRight = buildRectangle();
    this._bottomLeft = buildRectangle();
    this._bottomRight = buildRectangle();
    this._topCenter = buildRectangle();
    this._leftCenter = buildRectangle();
    this._rightCenter = buildRectangle();
    this._activeEdgeTile = null;
    this.workarea = initialWorkArea;
    this._quarterActivationPercentage = Settings.get_quarter_tiling_threshold();
    Settings.bind(
      Settings.SETTING_QUARTER_TILING_THRESHOLD,
      this,
      "quarterActivationPercentage"
    );
  }
  set quarterActivationPercentage(value) {
    this._quarterActivationPercentage = value / 100;
    this._updateActivationZones();
  }
  set workarea(newWorkArea) {
    this._workArea.x = newWorkArea.x;
    this._workArea.y = newWorkArea.y;
    this._workArea.width = newWorkArea.width;
    this._workArea.height = newWorkArea.height;
    this._updateActivationZones();
  }
  _updateActivationZones() {
    const width = this._workArea.width * this._quarterActivationPercentage;
    const height = this._workArea.height * this._quarterActivationPercentage;
    this._topLeft.x = this._workArea.x;
    this._topLeft.y = this._workArea.y;
    this._topLeft.width = width;
    this._topLeft.height = height;
    this._topRight.x = this._workArea.x + this._workArea.width - this._topLeft.width;
    this._topRight.y = this._topLeft.y;
    this._topRight.width = width;
    this._topRight.height = height;
    this._bottomLeft.x = this._workArea.x;
    this._bottomLeft.y = this._workArea.y + this._workArea.height - height;
    this._bottomLeft.width = width;
    this._bottomLeft.height = height;
    this._bottomRight.x = this._topRight.x;
    this._bottomRight.y = this._bottomLeft.y;
    this._bottomRight.width = width;
    this._bottomRight.height = height;
    this._topCenter.x = this._topLeft.x + this._topLeft.width;
    this._topCenter.y = this._topRight.y;
    this._topCenter.height = this._topRight.height;
    this._topCenter.width = this._topRight.x - this._topCenter.x;
    this._leftCenter.x = this._topLeft.x;
    this._leftCenter.y = this._topLeft.y + this._topLeft.height;
    this._leftCenter.height = this._bottomLeft.y - this._leftCenter.y;
    this._leftCenter.width = this._topLeft.width;
    this._rightCenter.x = this._topRight.x;
    this._rightCenter.y = this._topRight.y + this._topRight.height;
    this._rightCenter.height = this._bottomRight.y - this._rightCenter.y;
    this._rightCenter.width = this._topRight.width;
  }
  canActivateEdgeTiling(pointerPos) {
    return pointerPos.x <= this._workArea.x + EDGE_TILING_OFFSET || pointerPos.y <= this._workArea.y + TOP_EDGE_TILING_OFFSET || pointerPos.x >= this._workArea.x + this._workArea.width - EDGE_TILING_OFFSET || pointerPos.y >= this._workArea.y + this._workArea.height - EDGE_TILING_OFFSET;
  }
  isPerformingEdgeTiling() {
    return this._activeEdgeTile !== null;
  }
  startEdgeTiling(pointerPos) {
    const { x, y } = clampPointInsideRect(pointerPos, this._workArea);
    const previewRect = buildRectangle();
    if (this._activeEdgeTile && isPointInsideRect({ x, y }, this._activeEdgeTile)) {
      return {
        changed: false,
        rect: previewRect
      };
    }
    if (!this._activeEdgeTile)
      this._activeEdgeTile = buildRectangle();
    previewRect.width = this._workArea.width * QUARTER_PERCENTAGE;
    previewRect.height = this._workArea.height * QUARTER_PERCENTAGE;
    previewRect.y = this._workArea.y;
    previewRect.x = this._workArea.x;
    if (isPointInsideRect({ x, y }, this._topCenter)) {
      previewRect.width = this._workArea.width;
      previewRect.height = this._workArea.height;
      this._activeEdgeTile = this._topCenter;
    } else if (isPointInsideRect({ x, y }, this._leftCenter)) {
      previewRect.width = this._workArea.width * QUARTER_PERCENTAGE;
      previewRect.height = this._workArea.height;
      this._activeEdgeTile = this._leftCenter;
    } else if (isPointInsideRect({ x, y }, this._rightCenter)) {
      previewRect.x = this._workArea.x + this._workArea.width - previewRect.width;
      previewRect.width = this._workArea.width * QUARTER_PERCENTAGE;
      previewRect.height = this._workArea.height;
      this._activeEdgeTile = this._rightCenter;
    } else if (x <= this._workArea.x + this._workArea.width / 2) {
      if (isPointInsideRect({ x, y }, this._topLeft)) {
        this._activeEdgeTile = this._topLeft;
      } else if (isPointInsideRect({ x, y }, this._bottomLeft)) {
        previewRect.y = this._workArea.y + this._workArea.height - previewRect.height;
        this._activeEdgeTile = this._bottomLeft;
      } else {
        return {
          changed: false,
          rect: previewRect
        };
      }
    } else {
      previewRect.x = this._workArea.x + this._workArea.width - previewRect.width;
      if (isPointInsideRect({ x, y }, this._topRight)) {
        this._activeEdgeTile = this._topRight;
      } else if (isPointInsideRect({ x, y }, this._bottomRight)) {
        previewRect.y = this._workArea.y + this._workArea.height - previewRect.height;
        this._activeEdgeTile = this._bottomRight;
      } else {
        return {
          changed: false,
          rect: previewRect
        };
      }
    }
    return {
      changed: true,
      rect: previewRect
    };
  }
  needMaximize() {
    return this._activeEdgeTile !== null && Settings.get_top_edge_maximize() && this._activeEdgeTile === this._topCenter;
  }
  abortEdgeTiling() {
    this._activeEdgeTile = null;
  }
};
__publicField(EdgeTilingManager, "metaInfo", {
  GTypeName: "EdgeTilingManager",
  Properties: {
    quarterActivationPercentage: GObject7.ParamSpec.uint(
      "quarterActivationPercentage",
      "quarterActivationPercentage",
      "Threshold to trigger quarter tiling",
      GObject7.ParamFlags.READWRITE,
      1,
      50,
      40
    )
  }
});
EdgeTilingManager = __decorateClass([
  registerGObjectClass
], EdgeTilingManager);

// src/components/tilingsystem/touchPointer.ts
var TouchPointer = class _TouchPointer {
  static _instance = null;
  _x;
  _y;
  _windowPos;
  constructor() {
    this._x = -1;
    this._y = -1;
    this._windowPos = buildRectangle();
  }
  static get() {
    if (!this._instance)
      this._instance = new _TouchPointer();
    return this._instance;
  }
  isTouchDeviceActive() {
    return this._x !== -1 && this._y !== -1 && this._windowPos.x !== -1 && this._windowPos.y !== -1;
  }
  onTouchEvent(x, y) {
    this._x = x;
    this._y = y;
  }
  updateWindowPosition(newSize) {
    this._windowPos.x = newSize.x;
    this._windowPos.y = newSize.y;
  }
  reset() {
    this._x = -1;
    this._y = -1;
    this._windowPos.x = -1;
    this._windowPos.y = -1;
  }
  get_pointer(window) {
    const currPos = window.get_frame_rect();
    this._x += currPos.x - this._windowPos.x;
    this._y += currPos.y - this._windowPos.y;
    this._windowPos.x = currPos.x;
    this._windowPos.y = currPos.y;
    return [this._x, this._y, global.get_pointer()[2]];
  }
};

// src/components/tilingsystem/tilingManager.ts
import Meta6 from "gi://Meta";
import * as Main3 from "resource:///org/gnome/shell/ui/main.js";
import GLib from "gi://GLib";
var TilingManager = class {
  _monitor;
  _selectedTilesPreview;
  _snapAssist;
  _tilingLayout;
  _edgeTilingManager;
  _workArea;
  _innerGaps;
  _outerGaps;
  _enableScaling;
  _isGrabbingWindow;
  _movingWindowTimerDuration = 15;
  _lastCursorPos = null;
  _wasSpanMultipleTilesActivated;
  _wasTilingSystemActivated;
  _isSnapAssisting;
  _movingWindowTimerId = null;
  _signals;
  _debug;
  /**
   * Constructs a new TilingManager instance.
   * @param monitor The monitor to manage tiling for.
   */
  constructor(monitor, enableScaling) {
    this._isGrabbingWindow = false;
    this._wasSpanMultipleTilesActivated = false;
    this._wasTilingSystemActivated = false;
    this._isSnapAssisting = false;
    this._enableScaling = enableScaling;
    this._monitor = monitor;
    this._signals = new SignalHandling();
    this._debug = logger(`TilingManager ${monitor.index}`);
    const layout = GlobalState.get().getSelectedLayoutOfMonitor(
      monitor.index
    );
    this._innerGaps = buildMargin(Settings.get_inner_gaps());
    this._outerGaps = buildMargin(Settings.get_outer_gaps());
    this._workArea = Main3.layoutManager.getWorkAreaForMonitor(
      this._monitor.index
    );
    this._debug(
      `Work area for monitor ${this._monitor.index}: ${this._workArea.x} ${this._workArea.y} ${this._workArea.width}x${this._workArea.height}`
    );
    this._edgeTilingManager = new EdgeTilingManager(this._workArea);
    const monitorScalingFactor = this._enableScaling ? getMonitorScalingFactor(monitor.index) : void 0;
    this._tilingLayout = new TilingLayout(
      layout,
      this._innerGaps,
      this._outerGaps,
      this._workArea,
      monitorScalingFactor
    );
    this._selectedTilesPreview = new SelectionTilePreview({
      parent: global.windowGroup
    });
    this._snapAssist = new SnapAssist(
      Main3.uiGroup,
      this._workArea,
      this._monitor.index,
      monitorScalingFactor
    );
  }
  /**
   * Enables tiling manager by setting up event listeners:
   *  - handle any window's grab begin.
   *  - handle any window's grab end.
   *  - handle grabbed window's movement.
   */
  enable() {
    this._signals.connect(
      Settings,
      Settings.SETTING_SELECTED_LAYOUTS,
      () => {
        const layout = GlobalState.get().getSelectedLayoutOfMonitor(
          this._monitor.index
        );
        this._tilingLayout.relayout({ layout });
      }
    );
    this._signals.connect(
      GlobalState.get(),
      GlobalState.SIGNAL_LAYOUTS_CHANGED,
      () => {
        const layout = GlobalState.get().getSelectedLayoutOfMonitor(
          this._monitor.index
        );
        this._tilingLayout.relayout({ layout });
      }
    );
    this._signals.connect(Settings, Settings.SETTING_INNER_GAPS, () => {
      this._innerGaps = buildMargin(Settings.get_inner_gaps());
      this._tilingLayout.relayout({ innerGaps: this._innerGaps });
    });
    this._signals.connect(Settings, Settings.SETTING_OUTER_GAPS, () => {
      this._outerGaps = buildMargin(Settings.get_outer_gaps());
      this._tilingLayout.relayout({ outerGaps: this._outerGaps });
    });
    this._signals.connect(
      global.display,
      "grab-op-begin",
      (_display, window, grabOp) => {
        const moving = (grabOp & ~1024) === 1;
        if (!moving)
          return;
        this._onWindowGrabBegin(window, grabOp);
      }
    );
    this._signals.connect(
      global.display,
      "grab-op-end",
      (_display, window) => {
        if (!this._isGrabbingWindow)
          return;
        this._onWindowGrabEnd(window);
      }
    );
    this._signals.connect(
      this._snapAssist,
      "snap-assist",
      this._onSnapAssist.bind(this)
    );
  }
  onKeyboardMoveWindow(window, direction, force = false) {
    let destination;
    if (window.get_maximized()) {
      switch (direction) {
        case Meta6.DisplayDirection.DOWN:
          window.unmaximize(Meta6.MaximizeFlags.BOTH);
          return true;
        case Meta6.DisplayDirection.UP:
          return false;
        case Meta6.DisplayDirection.LEFT:
          destination = this._tilingLayout.getLeftmostTile();
          break;
        case Meta6.DisplayDirection.RIGHT:
          destination = this._tilingLayout.getRightmostTile();
          break;
      }
    }
    const windowRect = window.get_frame_rect().copy();
    if (!destination) {
      destination = this._tilingLayout.getNearestTile(
        windowRect,
        direction
      );
    }
    if (!destination) {
      if (direction === Meta6.DisplayDirection.UP && window.can_maximize()) {
        window.maximize(Meta6.MaximizeFlags.BOTH);
        return true;
      }
      return false;
    }
    if (!window.assignedTile && !window.get_maximized())
      window.originalSize = windowRect;
    window.assignedTile = new Tile2({
      ...destination.tile
    });
    if (window.get_maximized())
      window.unmaximize(Meta6.MaximizeFlags.BOTH);
    this._easeWindowRect(window, destination.rect, false, force);
    return true;
  }
  /**
   * Destroys the tiling manager and cleans up resources.
   */
  destroy() {
    if (this._movingWindowTimerId) {
      GLib.Source.remove(this._movingWindowTimerId);
      this._movingWindowTimerId = null;
    }
    this._signals.disconnect();
    this._isGrabbingWindow = false;
    this._isSnapAssisting = false;
    this._edgeTilingManager.abortEdgeTiling();
    this._tilingLayout.destroy();
    this._snapAssist.destroy();
    this._selectedTilesPreview.destroy();
  }
  set workArea(newWorkArea) {
    if (newWorkArea.equal(this._workArea))
      return;
    this._workArea = newWorkArea;
    this._debug(
      `new work area for monitor ${this._monitor.index}: ${newWorkArea.x} ${newWorkArea.y} ${newWorkArea.width}x${newWorkArea.height}`
    );
    this._tilingLayout.relayout({ containerRect: this._workArea });
    this._snapAssist.workArea = this._workArea;
    this._edgeTilingManager.workarea = this._workArea;
  }
  _onWindowGrabBegin(window, grabOp) {
    if (this._isGrabbingWindow)
      return;
    TouchPointer.get().updateWindowPosition(window.get_frame_rect());
    this._signals.connect(
      global.stage,
      "touch-event",
      (_source, event) => {
        const [x, y] = event.get_coords();
        TouchPointer.get().onTouchEvent(x, y);
      }
    );
    if (Settings.get_enable_blur_snap_assistant() || Settings.get_enable_blur_selected_tilepreview()) {
      this._signals.connect(window, "position-changed", () => {
        if (Settings.get_enable_blur_selected_tilepreview()) {
          this._selectedTilesPreview.get_effect("blur")?.queue_repaint();
        }
        if (Settings.get_enable_blur_snap_assistant()) {
          this._snapAssist.get_first_child()?.get_effect("blur")?.queue_repaint();
        }
      });
    }
    this._isGrabbingWindow = true;
    this._movingWindowTimerId = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT_IDLE,
      this._movingWindowTimerDuration,
      this._onMovingWindow.bind(this, window, grabOp)
    );
    this._onMovingWindow(window, grabOp);
  }
  _activationKeyStatus(modifier, key) {
    if (key === -1 /* NONE */)
      return true;
    let val = 2;
    switch (key) {
      case 0 /* CTRL */:
        val = 2;
        break;
      case 1 /* ALT */:
        val = 3;
        break;
      case 2 /* SUPER */:
        val = 6;
        break;
    }
    return (modifier & 1 << val) !== 0;
  }
  _onMovingWindow(window, grabOp) {
    if (!this._isGrabbingWindow) {
      this._movingWindowTimerId = null;
      return GLib.SOURCE_REMOVE;
    }
    if (!window.allows_resize() || !window.allows_move() || !this._isPointerInsideThisMonitor(window)) {
      this._tilingLayout.close();
      this._selectedTilesPreview.close(true);
      this._snapAssist.close(true);
      this._isSnapAssisting = false;
      this._edgeTilingManager.abortEdgeTiling();
      return GLib.SOURCE_CONTINUE;
    }
    const [x, y, modifier] = TouchPointer.get().isTouchDeviceActive() ? TouchPointer.get().get_pointer(window) : global.get_pointer();
    const extWin = window;
    extWin.assignedTile = void 0;
    if (extWin.originalSize) {
      if (Settings.get_restore_window_original_size()) {
        const windowRect = window.get_frame_rect();
        const offsetX = (x - windowRect.x) / windowRect.width;
        const offsetY = (y - windowRect.y) / windowRect.height;
        const newSize = buildRectangle({
          x: x - extWin.originalSize.width * offsetX,
          y: y - extWin.originalSize.height * offsetY,
          width: extWin.originalSize.width,
          height: extWin.originalSize.height
        });
        const restartGrab = (
          // @ts-expect-error "grab is available on GNOME 42"
          global.display.end_grab_op && global.display.begin_grab_op
        );
        if (restartGrab) {
          global.display.end_grab_op(global.get_current_time());
        }
        this._easeWindowRect(window, newSize, restartGrab, restartGrab);
        TouchPointer.get().updateWindowPosition(newSize);
        if (restartGrab) {
          extWin.originalSize = void 0;
          global.display.begin_grab_op(
            window,
            grabOp,
            true,
            // pointer already grabbed
            true,
            // frame action
            -1,
            // Button
            modifier,
            global.get_current_time(),
            x,
            y
          );
        }
      }
      extWin.originalSize = void 0;
    }
    const currPointerPos = { x, y };
    const isSpanMultiTilesActivated = this._activationKeyStatus(
      modifier,
      Settings.get_span_multiple_tiles_activation_key()
    );
    const isTilingSystemActivated = this._activationKeyStatus(
      modifier,
      Settings.get_tiling_system_activation_key()
    );
    const allowSpanMultipleTiles = Settings.get_span_multiple_tiles() && isSpanMultiTilesActivated;
    const showTilingSystem = Settings.get_tiling_system_enabled() && isTilingSystemActivated;
    const changedSpanMultipleTiles = Settings.get_span_multiple_tiles() && isSpanMultiTilesActivated !== this._wasSpanMultipleTilesActivated;
    const changedShowTilingSystem = Settings.get_tiling_system_enabled() && isTilingSystemActivated !== this._wasTilingSystemActivated;
    if (!changedSpanMultipleTiles && !changedShowTilingSystem && currPointerPos.x === this._lastCursorPos?.x && currPointerPos.y === this._lastCursorPos?.y)
      return GLib.SOURCE_CONTINUE;
    this._lastCursorPos = currPointerPos;
    this._wasTilingSystemActivated = isTilingSystemActivated;
    this._wasSpanMultipleTilesActivated = isSpanMultiTilesActivated;
    if (!showTilingSystem) {
      if (this._tilingLayout.showing) {
        this._tilingLayout.close();
        this._selectedTilesPreview.close(true);
      }
      if (Settings.get_active_screen_edges() && !this._isSnapAssisting && this._edgeTilingManager.canActivateEdgeTiling(currPointerPos)) {
        const { changed, rect } = this._edgeTilingManager.startEdgeTiling(currPointerPos);
        if (changed)
          this._showEdgeTiling(window, rect, x, y);
        this._snapAssist.close(true);
      } else {
        if (this._edgeTilingManager.isPerformingEdgeTiling()) {
          this._selectedTilesPreview.close(true);
          this._edgeTilingManager.abortEdgeTiling();
        }
        if (Settings.get_snap_assist_enabled()) {
          this._snapAssist.onMovingWindow(
            window,
            true,
            currPointerPos
          );
        }
      }
      return GLib.SOURCE_CONTINUE;
    }
    if (!this._tilingLayout.showing) {
      this._tilingLayout.openAbove(window);
      this._snapAssist.close(true);
      if (this._edgeTilingManager.isPerformingEdgeTiling()) {
        this._selectedTilesPreview.close(true);
        this._edgeTilingManager.abortEdgeTiling();
      }
    }
    if (this._isSnapAssisting) {
      this._selectedTilesPreview.close(true);
      this._isSnapAssisting = false;
    }
    if (!changedSpanMultipleTiles && isPointInsideRect(currPointerPos, this._selectedTilesPreview.rect))
      return GLib.SOURCE_CONTINUE;
    let selectionRect = this._tilingLayout.getTileBelow(
      currPointerPos,
      changedSpanMultipleTiles && !allowSpanMultipleTiles
    );
    if (!selectionRect)
      return GLib.SOURCE_CONTINUE;
    selectionRect = selectionRect.copy();
    if (allowSpanMultipleTiles && this._selectedTilesPreview.showing) {
      selectionRect = selectionRect.union(
        this._selectedTilesPreview.rect
      );
    }
    this._tilingLayout.hoverTilesInRect(
      selectionRect,
      !allowSpanMultipleTiles
    );
    this._selectedTilesPreview.gaps = buildTileGaps(
      selectionRect,
      this._tilingLayout.innerGaps,
      this._tilingLayout.outerGaps,
      this._workArea,
      this._enableScaling ? getScalingFactorOf(this._tilingLayout)[1] : void 0
    );
    this._selectedTilesPreview.openAbove(window, true, selectionRect);
    return GLib.SOURCE_CONTINUE;
  }
  _onWindowGrabEnd(window) {
    this._isGrabbingWindow = false;
    this._signals.disconnect(window);
    TouchPointer.get().reset();
    this._tilingLayout.close();
    const desiredWindowRect = buildRectangle({
      x: this._selectedTilesPreview.innerX,
      y: this._selectedTilesPreview.innerY,
      width: this._selectedTilesPreview.innerWidth,
      height: this._selectedTilesPreview.innerHeight
    });
    const selectedTilesRect = this._selectedTilesPreview.rect.copy();
    this._selectedTilesPreview.close(true);
    this._snapAssist.close(true);
    this._lastCursorPos = null;
    const isTilingSystemActivated = this._activationKeyStatus(
      global.get_pointer()[2],
      Settings.get_tiling_system_activation_key()
    );
    if (!isTilingSystemActivated && !this._isSnapAssisting && !this._edgeTilingManager.isPerformingEdgeTiling())
      return;
    this._isSnapAssisting = false;
    if (this._edgeTilingManager.isPerformingEdgeTiling() && this._edgeTilingManager.needMaximize() && window.can_maximize())
      window.maximize(Meta6.MaximizeFlags.BOTH);
    this._edgeTilingManager.abortEdgeTiling();
    if (!this._isPointerInsideThisMonitor(window))
      return;
    if (desiredWindowRect.width <= 0 || desiredWindowRect.height <= 0)
      return;
    if (window.get_maximized())
      return;
    window.originalSize = window.get_frame_rect().copy();
    window.assignedTile = new Tile2({
      ...TileUtils.build_tile(selectedTilesRect, this._workArea)
    });
    this._easeWindowRect(window, desiredWindowRect);
  }
  _easeWindowRect(window, destRect, user_op = false, force = false) {
    const windowActor = window.get_compositor_private();
    const beforeRect = window.get_frame_rect();
    if (destRect.x === beforeRect.x && destRect.y === beforeRect.y && destRect.width === beforeRect.width && destRect.height === beforeRect.height)
      return;
    windowActor.remove_all_transitions();
    Main3.wm._prepareAnimationInfo(
      global.windowManager,
      windowActor,
      beforeRect.copy(),
      Meta6.SizeChange.UNMAXIMIZE
    );
    window.move_to_monitor(this._monitor.index);
    if (force)
      window.move_frame(user_op, destRect.x, destRect.y);
    window.move_resize_frame(
      user_op,
      destRect.x,
      destRect.y,
      destRect.width,
      destRect.height
    );
  }
  _onSnapAssist(_, tile) {
    if (tile.width === 0 || tile.height === 0) {
      this._selectedTilesPreview.close(true);
      this._isSnapAssisting = false;
      return;
    }
    const scaledRect = TileUtils.apply_props(tile, this._workArea);
    if (scaledRect.x + scaledRect.width > this._workArea.x + this._workArea.width) {
      scaledRect.width -= scaledRect.x + scaledRect.width - this._workArea.x - this._workArea.width;
    }
    if (scaledRect.y + scaledRect.height > this._workArea.y + this._workArea.height) {
      scaledRect.height -= scaledRect.y + scaledRect.height - this._workArea.y - this._workArea.height;
    }
    this._selectedTilesPreview.gaps = buildTileGaps(
      scaledRect,
      this._tilingLayout.innerGaps,
      this._tilingLayout.outerGaps,
      this._workArea,
      this._enableScaling ? getScalingFactorOf(this._tilingLayout)[1] : void 0
    );
    this._selectedTilesPreview.get_parent()?.set_child_above_sibling(this._selectedTilesPreview, null);
    this._selectedTilesPreview.open(true, scaledRect);
    this._isSnapAssisting = true;
  }
  /**
   * Checks if pointer is inside the current monitor
   * @returns true if the pointer is inside the current monitor, false otherwise
   */
  _isPointerInsideThisMonitor(window) {
    const [x, y] = TouchPointer.get().isTouchDeviceActive() ? TouchPointer.get().get_pointer(window) : global.get_pointer();
    return x >= this._monitor.x && x <= this._monitor.x + this._monitor.width && y >= this._monitor.y && y <= this._monitor.y + this._monitor.height;
  }
  _showEdgeTiling(window, edgeTile, pointerX, pointerY) {
    this._selectedTilesPreview.gaps = buildTileGaps(
      edgeTile,
      this._tilingLayout.innerGaps,
      this._tilingLayout.outerGaps,
      this._workArea,
      this._enableScaling ? getScalingFactorOf(this._tilingLayout)[1] : void 0
    );
    if (!this._selectedTilesPreview.showing) {
      const { left, right, top, bottom } = this._selectedTilesPreview.gaps;
      const initialRect = buildRectangle({
        x: pointerX,
        y: pointerY,
        width: left + right + 8,
        // width without gaps will be 8
        height: top + bottom + 8
        // height without gaps will be 8
      });
      initialRect.x -= initialRect.width / 2;
      initialRect.y -= initialRect.height / 2;
      this._selectedTilesPreview.open(false, initialRect);
    }
    this._selectedTilesPreview.openAbove(window, true, edgeTile);
  }
  onTileFromWindowMenu(tile, window) {
    const scaledRect = TileUtils.apply_props(tile, this._workArea);
    if (scaledRect.x + scaledRect.width > this._workArea.x + this._workArea.width) {
      scaledRect.width -= scaledRect.x + scaledRect.width - this._workArea.x - this._workArea.width;
    }
    if (scaledRect.y + scaledRect.height > this._workArea.y + this._workArea.height) {
      scaledRect.height -= scaledRect.y + scaledRect.height - this._workArea.y - this._workArea.height;
    }
    const gaps = buildTileGaps(
      scaledRect,
      this._tilingLayout.innerGaps,
      this._tilingLayout.outerGaps,
      this._workArea,
      this._enableScaling ? getScalingFactorOf(this._tilingLayout)[1] : void 0
    );
    const destinationRect = buildRectangle({
      x: scaledRect.x + gaps.left,
      y: scaledRect.y + gaps.top,
      width: scaledRect.width - gaps.left - gaps.right,
      height: scaledRect.height - gaps.top - gaps.bottom
    });
    if (destinationRect.width <= 0 || destinationRect.height <= 0)
      return;
    const rememberOriginalSize = !window.get_maximized();
    if (window.get_maximized())
      window.unmaximize(Meta6.MaximizeFlags.BOTH);
    if (rememberOriginalSize && !window.assignedTile) {
      window.originalSize = window.get_frame_rect().copy();
    }
    window.assignedTile = TileUtils.build_tile(
      buildRectangle({
        x: scaledRect.x,
        y: scaledRect.y,
        width: scaledRect.width,
        height: scaledRect.height
      }),
      this._workArea
    );
    this._easeWindowRect(window, destinationRect);
  }
};

// src/components/editor/editableTilePreview.ts
import St7 from "gi://St";
import Mtk12 from "gi://Mtk";
var EditableTilePreview = class extends TilePreview {
  _btn;
  _tile;
  _containerRect;
  _sliders;
  _signals;
  constructor(params) {
    super(params);
    this.add_style_class_name("editable-tile-preview");
    this._tile = params.tile;
    this._containerRect = params.containerRect;
    this._sliders = [null, null, null, null];
    this._signals = [null, null, null, null];
    this._btn = new St7.Button({
      styleClass: "editable-tile-preview-button",
      xExpand: true,
      trackHover: true
    });
    this.add_child(this._btn);
    this._btn.set_size(this.innerWidth, this.innerHeight);
    this._btn.set_button_mask(St7.ButtonMask.ONE | St7.ButtonMask.THREE);
    this._updateLabelText();
    this.connect("destroy", this._onDestroy.bind(this));
  }
  get tile() {
    return this._tile;
  }
  getSlider(side) {
    return this._sliders[side];
  }
  getAllSliders() {
    return [...this._sliders];
  }
  get hover() {
    return this._btn.hover;
  }
  addSlider(slider, side) {
    const sig = this._signals[side];
    if (sig)
      this._sliders[side]?.disconnect(sig);
    this._sliders[side] = slider;
    this._signals[side] = slider.connect(
      "slide",
      () => this._onSliderMove(side)
    );
    this._tile.groups = [];
    this._sliders.forEach((sl) => sl && this._tile.groups.push(sl.groupId));
  }
  removeSlider(side) {
    if (this._sliders[side] === null)
      return;
    const sig = this._signals[side];
    if (sig)
      this._sliders[side]?.disconnect(sig);
    this._sliders[side] = null;
    this._tile.groups = [];
    this._sliders.forEach((sl) => sl && this._tile.groups.push(sl.groupId));
  }
  updateTile({
    x,
    y,
    width,
    height
  }) {
    const oldSize = this._rect.copy();
    this._tile.x = x;
    this._tile.y = y;
    this._tile.width = width;
    this._tile.height = height;
    this._rect = TileUtils.apply_props(this._tile, this._containerRect);
    this.set_size(this.innerWidth, this.innerHeight);
    this.set_position(this.innerX, this.innerY);
    this._btn.set_size(this.width, this.height);
    this._updateLabelText();
    const newSize = this._rect.copy();
    this.emit("size-changed", oldSize, newSize);
  }
  connect(signal, callback) {
    if (signal === "clicked" || signal === "notify::hover" || signal === "motion-event")
      return this._btn.connect(signal, callback);
    return super.connect(signal, callback);
  }
  _updateLabelText() {
    this._btn.label = `${this.innerWidth}x${this.innerHeight}`;
  }
  _onSliderMove(side) {
    const slider = this._sliders[side];
    if (slider === null)
      return;
    const posHoriz = (slider.x + slider.width / 2 - this._containerRect.x) / this._containerRect.width;
    const posVert = (slider.y + slider.height / 2 - this._containerRect.y) / this._containerRect.height;
    switch (side) {
      case St7.Side.TOP:
        this._tile.height += this._tile.y - posVert;
        this._tile.y = posVert;
        break;
      case St7.Side.RIGHT:
        this._tile.width = posHoriz - this._tile.x;
        break;
      case St7.Side.BOTTOM:
        this._tile.height = posVert - this._tile.y;
        break;
      case St7.Side.LEFT:
        this._tile.width += this._tile.x - posHoriz;
        this._tile.x = posHoriz;
        break;
    }
    this.updateTile({ ...this._tile });
  }
  _onDestroy() {
    this._signals.forEach(
      (id, side) => id && this._sliders[side]?.disconnect(id)
    );
  }
};
__publicField(EditableTilePreview, "metaInfo", {
  Signals: {
    "size-changed": {
      param_types: [Mtk12.Rectangle.$gtype, Mtk12.Rectangle.$gtype]
      // oldSize, newSize
    }
  },
  GTypeName: "EditableTilePreview"
});
__publicField(EditableTilePreview, "MIN_TILE_SIZE", 140);
EditableTilePreview = __decorateClass([
  registerGObjectClass
], EditableTilePreview);

// src/components/editor/slider.ts
import Clutter11 from "gi://Clutter";
import St8 from "gi://St";
import Meta7 from "gi://Meta";
import GObject9 from "gi://GObject";
var Slider2 = class extends St8.Button {
  _sliderSize = 48;
  _groupId;
  _signals;
  _dragging;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _grab;
  _horizontalDir;
  _lastEventCoord;
  _previousTiles;
  _nextTiles;
  _minTileCoord;
  _maxTileCoord;
  _scalingFactor;
  constructor(parent, groupId, x, y, horizontal) {
    super({
      styleClass: "layout-editor-slider",
      canFocus: true,
      xExpand: false,
      trackHover: true
    });
    parent.add_child(this);
    this._signals = /* @__PURE__ */ new Map();
    this._groupId = groupId;
    this._horizontalDir = horizontal;
    const [, scalingFactor] = getScalingFactorOf(this);
    this._scalingFactor = scalingFactor;
    this.set_width(this.desiredWidth);
    this.set_height(this.desiredHeight);
    this._previousTiles = [];
    this._nextTiles = [];
    this._minTileCoord = Number.MAX_VALUE;
    this._maxTileCoord = Number.MIN_VALUE;
    this._dragging = false;
    this._lastEventCoord = null;
    this.set_position(
      Math.round(Math.round(x - this.width / 2)),
      Math.round(y - this.height / 2)
    );
    this.connect(
      "notify::hover",
      () => global.display.set_cursor(this.preferredCursor)
    );
    this.connect("destroy", this._onDestroy.bind(this));
  }
  get groupId() {
    return this._groupId;
  }
  get desiredWidth() {
    return (this._horizontalDir ? 12 : this._sliderSize) * this._scalingFactor;
  }
  get desiredHeight() {
    return (this._horizontalDir ? this._sliderSize : 12) * this._scalingFactor;
  }
  get preferredCursor() {
    return this.hover || this._dragging ? this._horizontalDir ? Meta7.Cursor.WEST_RESIZE : Meta7.Cursor.NORTH_RESIZE : Meta7.Cursor.DEFAULT;
  }
  addTile(tile) {
    const isNext = this._horizontalDir ? this.x <= tile.rect.x : this.y <= tile.rect.y;
    if (isNext)
      this._nextTiles.push(tile);
    else
      this._previousTiles.push(tile);
    const side = this._horizontalDir ? isNext ? St8.Side.LEFT : St8.Side.RIGHT : isNext ? St8.Side.TOP : St8.Side.BOTTOM;
    tile.addSlider(this, side);
    this._minTileCoord = Math.min(
      this._minTileCoord,
      this._horizontalDir ? tile.rect.y : tile.rect.x
    );
    this._maxTileCoord = Math.max(
      this._maxTileCoord,
      this._horizontalDir ? tile.rect.y + tile.rect.height : tile.rect.x + tile.rect.width
    );
    this._updatePosition();
    this._createTileSignals(tile);
  }
  _onTileSizeChanged(tile, oldSize, newSize) {
    if (this._horizontalDir) {
      if (this._minTileCoord !== oldSize.y && this._maxTileCoord !== oldSize.y + oldSize.height)
        return;
      if (this._minTileCoord === oldSize.y)
        this._minTileCoord = newSize.y;
      if (this._maxTileCoord === oldSize.y + oldSize.height)
        this._maxTileCoord = newSize.y + newSize.height;
    } else {
      if (this._minTileCoord !== oldSize.x && this._maxTileCoord !== oldSize.x + oldSize.width)
        return;
      if (this._minTileCoord === oldSize.x)
        this._minTileCoord = newSize.x;
      if (this._maxTileCoord === oldSize.x + oldSize.width)
        this._maxTileCoord = newSize.x + newSize.width;
    }
    this._updatePosition();
  }
  _updatePosition() {
    this.set_width(this.desiredWidth);
    this.set_height(this.desiredHeight);
    const newCoord = (this._minTileCoord + this._maxTileCoord) / 2;
    if (this._horizontalDir)
      this.set_y(Math.round(newCoord - this.height / 2));
    else
      this.set_x(Math.round(newCoord - this.width / 2));
  }
  _onTileDeleted(tile) {
    const isNext = this._horizontalDir ? this.x <= tile.rect.x : this.y <= tile.rect.y;
    const array = isNext ? this._nextTiles : this._previousTiles;
    const index = array.indexOf(tile, 0);
    if (index >= 0)
      array.splice(index, 1);
    const sig = this._signals.get(tile);
    if (sig) {
      sig.forEach((id) => tile.disconnect(id));
      this._signals.delete(tile);
    }
  }
  onTileSplit(tileToRemove, newTiles) {
    if (newTiles.length === 0)
      return;
    const isNext = this._horizontalDir ? this.x <= tileToRemove.rect.x : this.y <= tileToRemove.rect.y;
    const array = isNext ? this._nextTiles : this._previousTiles;
    const index = array.indexOf(tileToRemove);
    if (index < 0)
      return;
    const side = this._horizontalDir ? isNext ? St8.Side.LEFT : St8.Side.RIGHT : isNext ? St8.Side.TOP : St8.Side.BOTTOM;
    const sig = this._signals.get(tileToRemove);
    if (sig) {
      sig.forEach((id) => tileToRemove.disconnect(id));
      this._signals.delete(tileToRemove);
    }
    array[index] = newTiles[0];
    newTiles[0].addSlider(this, side);
    this._createTileSignals(newTiles[0]);
    for (let i = 1; i < newTiles.length; i++) {
      const tile = newTiles[i];
      array.push(tile);
      tile.addSlider(this, side);
      this._createTileSignals(tile);
    }
  }
  _createTileSignals(tile) {
    if (this._signals.has(tile))
      return;
    this._signals.set(tile, []);
    this._signals.get(tile)?.push(
      tile.connect(
        "size-changed",
        this._onTileSizeChanged.bind(this)
      )
    );
    this._signals.get(tile)?.push(tile.connect("destroy", this._onTileDeleted.bind(this)));
  }
  deleteSlider(tileToDelete) {
    const isNext = this._horizontalDir ? this.x <= tileToDelete.rect.x : this.y <= tileToDelete.rect.y;
    const array = isNext ? this._nextTiles : this._previousTiles;
    if (array.length > 1 || array[0] !== tileToDelete)
      return false;
    array.pop();
    const oppositeSide = this._horizontalDir ? isNext ? St8.Side.RIGHT : St8.Side.LEFT : isNext ? St8.Side.BOTTOM : St8.Side.TOP;
    (isNext ? this._previousTiles : this._nextTiles).forEach(
      (tileToExtend) => {
        tileToExtend.updateTile({
          x: !isNext && this._horizontalDir ? tileToDelete.tile.x : tileToExtend.tile.x,
          y: !isNext && !this._horizontalDir ? tileToDelete.tile.y : tileToExtend.tile.y,
          width: this._horizontalDir ? tileToExtend.tile.width + tileToDelete.tile.width : tileToExtend.tile.width,
          height: this._horizontalDir ? tileToExtend.tile.height : tileToExtend.tile.height + tileToDelete.tile.height
        });
        tileToExtend.removeSlider(oppositeSide);
        tileToDelete.getSlider(oppositeSide)?.addTile(tileToExtend);
      }
    );
    return true;
  }
  vfunc_button_press_event(event) {
    return this._startDragging(event);
  }
  vfunc_button_release_event() {
    if (this._dragging)
      return this._endDragging();
    return Clutter11.EVENT_PROPAGATE;
  }
  vfunc_motion_event(event) {
    if (this._dragging) {
      const [stageX, stageY] = getEventCoords(event);
      this._move(stageX, stageY);
      return Clutter11.EVENT_STOP;
    }
    return Clutter11.EVENT_PROPAGATE;
  }
  _startDragging(event) {
    if (this._dragging)
      return Clutter11.EVENT_PROPAGATE;
    this._dragging = true;
    global.display.set_cursor(this.preferredCursor);
    this._grab = global.stage.grab(this);
    const [stageX, stageY] = getEventCoords(event);
    this._move(stageX, stageY);
    return Clutter11.EVENT_STOP;
  }
  _endDragging() {
    if (this._dragging) {
      if (this._grab) {
        this._grab.dismiss();
        this._grab = null;
      }
      this._dragging = false;
      this._lastEventCoord = null;
    }
    global.display.set_cursor(this.preferredCursor);
    return Clutter11.EVENT_STOP;
  }
  _move(eventX, eventY) {
    eventX = Math.round(eventX);
    eventY = Math.round(eventY);
    if (this._lastEventCoord !== null) {
      const movement = {
        x: this._horizontalDir ? eventX - this._lastEventCoord.x : 0,
        y: this._horizontalDir ? 0 : eventY - this._lastEventCoord.y
      };
      for (const prevTile of this._previousTiles) {
        if (prevTile.rect.width + movement.x < EditableTilePreview.MIN_TILE_SIZE || prevTile.rect.height + movement.y < EditableTilePreview.MIN_TILE_SIZE)
          return;
      }
      for (const nextTile of this._nextTiles) {
        if (nextTile.rect.width - movement.x < EditableTilePreview.MIN_TILE_SIZE || nextTile.rect.height - movement.y < EditableTilePreview.MIN_TILE_SIZE)
          return;
      }
      this.set_position(this.x + movement.x, this.y + movement.y);
      this.emit("slide", this._horizontalDir ? movement.x : movement.y);
    }
    this._lastEventCoord = { x: eventX, y: eventY };
  }
  _onDestroy() {
    this._signals.forEach(
      (ids, tile) => ids.forEach((id) => tile.disconnect(id))
    );
    this._minTileCoord = Number.MAX_VALUE;
    this._maxTileCoord = Number.MIN_VALUE;
    this._previousTiles = [];
    this._nextTiles = [];
    this._lastEventCoord = null;
    this._endDragging();
  }
};
__publicField(Slider2, "metaInfo", {
  Signals: {
    slide: {
      param_types: [GObject9.TYPE_INT]
      // movement
    }
  },
  GTypeName: "Slider"
});
Slider2 = __decorateClass([
  registerGObjectClass
], Slider2);

// src/components/editor/hoverLine.ts
import St9 from "gi://St";
import GLib2 from "gi://GLib";
import Shell2 from "gi://Shell";
import Clutter12 from "gi://Clutter";
var HoverLine = class extends St9.Widget {
  _hoverTimer;
  _size;
  _hoveredTile;
  constructor(parent) {
    super({ styleClass: "hover-line" });
    parent.add_child(this);
    this._hoveredTile = null;
    const [, scalingFactor] = getScalingFactorOf(this);
    this._size = 16 * scalingFactor;
    this.hide();
    this._hoverTimer = GLib2.timeout_add(
      GLib2.PRIORITY_DEFAULT_IDLE,
      100,
      this._handleModifierChange.bind(this)
    );
    this.connect("destroy", this._onDestroy.bind(this));
  }
  handleTileDestroy(tile) {
    if (this._hoveredTile === tile) {
      this._hoveredTile = null;
      this.hide();
    }
  }
  handleMouseMove(tile, x, y) {
    this._hoveredTile = tile;
    const modifier = Shell2.Global.get().get_pointer()[2];
    const splitHorizontally = (modifier & Clutter12.ModifierType.CONTROL_MASK) === 0;
    this._drawLine(splitHorizontally, x, y);
  }
  _handleModifierChange() {
    if (!this._hoveredTile)
      return GLib2.SOURCE_CONTINUE;
    if (!this._hoveredTile.hover) {
      this.hide();
      return GLib2.SOURCE_CONTINUE;
    }
    const [x, y, modifier] = global.get_pointer();
    const splitHorizontally = (modifier & Clutter12.ModifierType.CONTROL_MASK) === 0;
    this._drawLine(
      splitHorizontally,
      x - (this.get_parent()?.x || 0),
      y - (this.get_parent()?.y || 0)
    );
    return GLib2.SOURCE_CONTINUE;
  }
  _drawLine(splitHorizontally, x, y) {
    if (!this._hoveredTile)
      return;
    if (splitHorizontally) {
      const newX = x - this._size / 2;
      if (newX < this._hoveredTile.x || newX + this._size > this._hoveredTile.x + this._hoveredTile.width)
        return;
      this.set_size(this._size, this._hoveredTile.height);
      this.set_position(newX, this._hoveredTile.y);
    } else {
      const newY = y - this._size / 2;
      if (newY < this._hoveredTile.y || newY + this._size > this._hoveredTile.y + this._hoveredTile.height)
        return;
      this.set_size(this._hoveredTile.width, this._size);
      this.set_position(this._hoveredTile.x, newY);
    }
    this.show();
  }
  _onDestroy() {
    GLib2.Source.remove(this._hoverTimer);
    this._hoveredTile = null;
  }
};
HoverLine = __decorateClass([
  registerGObjectClass
], HoverLine);

// src/components/editor/layoutEditor.ts
import Clutter13 from "gi://Clutter";
import St10 from "gi://St";
import Shell3 from "gi://Shell";
import GObject10 from "gi://GObject";
import * as Main4 from "resource:///org/gnome/shell/ui/main.js";
var LayoutEditor = class extends St10.Widget {
  _layout;
  _containerRect;
  _innerGaps;
  _outerGaps;
  _hoverWidget;
  _sliders;
  _minimizedWindows;
  constructor(layout, monitor, enableScaling) {
    super({ styleClass: "layout-editor" });
    Main4.layoutManager.addChrome(this);
    global.windowGroup.bind_property(
      "visible",
      this,
      "visible",
      GObject10.BindingFlags.DEFAULT
    );
    if (enableScaling) {
      const scalingFactor = getMonitorScalingFactor(monitor.index);
      enableScalingFactorSupport(this, scalingFactor);
    }
    const workArea = Main4.layoutManager.getWorkAreaForMonitor(
      monitor.index
    );
    this.set_position(workArea.x, workArea.y);
    this.set_size(workArea.width, workArea.height);
    this._innerGaps = buildMargin(Settings.get_inner_gaps());
    this._outerGaps = buildMargin(Settings.get_outer_gaps());
    this._sliders = [];
    this._containerRect = buildRectangle({
      x: 0,
      y: 0,
      width: workArea.width,
      height: workArea.height
    });
    this._minimizedWindows = getWindowsOfMonitor(monitor).filter(
      (win) => !win.is_hidden()
    );
    this._minimizedWindows.forEach(
      (win) => win.can_minimize() && win.minimize()
    );
    this._hoverWidget = new HoverLine(this);
    this._layout = layout;
    this._drawEditor();
    this.connect("destroy", this._onDestroy.bind(this));
  }
  get layout() {
    return this._layout;
  }
  set layout(newLayout) {
    this.destroy_all_children();
    this._sliders = [];
    this._hoverWidget = new HoverLine(this);
    this._layout = newLayout;
    this._drawEditor();
  }
  _drawEditor() {
    const groups = /* @__PURE__ */ new Map();
    this._layout.tiles.forEach((tile) => {
      const rect = TileUtils.apply_props(tile, this._containerRect);
      const prev = this._buildEditableTile(tile, rect);
      tile.groups.forEach((id) => {
        if (!groups.has(id))
          groups.set(id, []);
        groups.get(id)?.push(prev);
      });
    });
    groups.forEach((tiles, groupdId) => {
      let lines = tiles.flatMap((t) => [
        {
          c: Math.round(t.tile.x * 1e3) / 1e3,
          end: false,
          r: t.rect.x
        },
        {
          c: Math.round((t.tile.x + t.tile.width) * 1e3) / 1e3,
          end: true,
          r: t.rect.x + t.rect.width
        }
      ]).sort((a, b) => a.c - b.c !== 0 ? a.c - b.c : a.end ? -1 : 1);
      let count = 0;
      let coord = -1;
      let horizontal = false;
      for (const line of lines) {
        count += line.end ? -1 : 1;
        if (count === 0 && line !== lines[lines.length - 1]) {
          coord = line.r;
          horizontal = true;
          break;
        }
      }
      if (coord === -1) {
        lines = tiles.flatMap((t) => [
          {
            c: Math.round(t.tile.y * 1e3) / 1e3,
            end: false,
            r: t.rect.y
          },
          {
            c: Math.round((t.tile.y + t.tile.height) * 1e3) / 1e3,
            end: true,
            r: t.rect.y + t.rect.height
          }
        ]).sort(
          (a, b) => a.c - b.c !== 0 ? a.c - b.c : a.end ? -1 : 1
        );
        count = 0;
        for (const line of lines) {
          count += line.end ? -1 : 1;
          if (count === 0 && line !== lines[lines.length - 1]) {
            coord = line.r;
            break;
          }
        }
      }
      const slider = this._buildSlider(horizontal, coord, groupdId);
      this._sliders.push(slider);
      tiles.forEach((editable) => slider.addTile(editable));
    });
  }
  _buildEditableTile(tile, rect) {
    const gaps = buildTileGaps(
      rect,
      this._innerGaps,
      this._outerGaps,
      this._containerRect
    );
    const editableTile = new EditableTilePreview({
      parent: this,
      tile,
      containerRect: this._containerRect,
      rect,
      gaps
    });
    editableTile.open();
    editableTile.connect("clicked", (_, clicked_button) => {
      if (clicked_button === St10.ButtonMask.ONE)
        this.splitTile(editableTile);
      else if (clicked_button === 3)
        this.deleteTile(editableTile);
    });
    editableTile.connect("motion-event", (_, event) => {
      const [stageX, stageY] = getEventCoords(event);
      this._hoverWidget.handleMouseMove(
        editableTile,
        stageX - this.x,
        stageY - this.y
      );
      return Clutter13.EVENT_PROPAGATE;
    });
    editableTile.connect("notify::hover", () => {
      const [stageX, stageY] = Shell3.Global.get().get_pointer();
      this._hoverWidget.handleMouseMove(
        editableTile,
        stageX - this.x,
        stageY - this.y
      );
    });
    if (this._sliders.length > 0)
      this.set_child_below_sibling(editableTile, this._sliders[0]);
    return editableTile;
  }
  splitTile(editableTile) {
    const oldTile = editableTile.tile;
    const index = this._layout.tiles.indexOf(oldTile);
    if (index < 0)
      return;
    const [x, y, modifier] = global.get_pointer();
    const splitX = (x - this.x) / this._containerRect.width;
    const splitY = (y - this.y) / this._containerRect.height;
    const splitHorizontally = (modifier & Clutter13.ModifierType.CONTROL_MASK) === 0;
    const prevTile = new Tile2({
      x: oldTile.x,
      y: oldTile.y,
      width: splitHorizontally ? splitX - oldTile.x : oldTile.width,
      height: splitHorizontally ? oldTile.height : splitY - oldTile.y,
      groups: []
    });
    const nextTile = new Tile2({
      x: splitHorizontally ? splitX : oldTile.x,
      y: splitHorizontally ? oldTile.y : splitY,
      width: splitHorizontally ? oldTile.width - prevTile.width : oldTile.width,
      height: splitHorizontally ? oldTile.height : oldTile.height - prevTile.height,
      groups: []
    });
    const prevRect = TileUtils.apply_props(prevTile, this._containerRect);
    const nextRect = TileUtils.apply_props(nextTile, this._containerRect);
    if (prevRect.height < EditableTilePreview.MIN_TILE_SIZE || prevRect.width < EditableTilePreview.MIN_TILE_SIZE || nextRect.height < EditableTilePreview.MIN_TILE_SIZE || nextRect.width < EditableTilePreview.MIN_TILE_SIZE)
      return;
    this._layout.tiles[index] = prevTile;
    this._layout.tiles.push(nextTile);
    const prevEditableTile = this._buildEditableTile(prevTile, prevRect);
    const nextEditableTile = this._buildEditableTile(nextTile, nextRect);
    const slider = this._buildSlider(
      splitHorizontally,
      splitHorizontally ? nextEditableTile.rect.x : nextEditableTile.rect.y
    );
    this._sliders.push(slider);
    slider.addTile(prevEditableTile);
    slider.addTile(nextEditableTile);
    if (splitHorizontally) {
      editableTile.getSlider(St10.Side.TOP)?.onTileSplit(editableTile, [
        prevEditableTile,
        nextEditableTile
      ]);
      editableTile.getSlider(St10.Side.BOTTOM)?.onTileSplit(editableTile, [
        prevEditableTile,
        nextEditableTile
      ]);
      editableTile.getSlider(St10.Side.LEFT)?.onTileSplit(editableTile, [prevEditableTile]);
      editableTile.getSlider(St10.Side.RIGHT)?.onTileSplit(editableTile, [nextEditableTile]);
    } else {
      editableTile.getSlider(St10.Side.LEFT)?.onTileSplit(editableTile, [
        prevEditableTile,
        nextEditableTile
      ]);
      editableTile.getSlider(St10.Side.RIGHT)?.onTileSplit(editableTile, [
        prevEditableTile,
        nextEditableTile
      ]);
      editableTile.getSlider(St10.Side.TOP)?.onTileSplit(editableTile, [prevEditableTile]);
      editableTile.getSlider(St10.Side.BOTTOM)?.onTileSplit(editableTile, [nextEditableTile]);
    }
    this._hoverWidget.handleTileDestroy(editableTile);
    editableTile.destroy();
  }
  deleteTile(editableTile) {
    for (const slider of editableTile.getAllSliders()) {
      if (slider === null)
        continue;
      const success = slider.deleteSlider(editableTile);
      if (success) {
        this._layout.tiles = this._layout.tiles.filter(
          (tile) => tile !== editableTile.tile
        );
        this._sliders = this._sliders.filter((sl) => sl !== slider);
        this._hoverWidget.handleTileDestroy(editableTile);
        editableTile.destroy();
        slider.destroy();
        return;
      }
    }
  }
  _buildSlider(isHorizontal, coord, groupId) {
    if (!groupId) {
      const groups = this._sliders.map((slider) => slider.groupId).sort();
      groupId = groups.length === 0 ? 1 : groups[groups.length - 1] + 1;
      for (let i = 1; i < groups.length; i++) {
        if (groups[i - 1] + 1 < groups[i]) {
          groupId = groups[i - 1] + 1;
          break;
        }
      }
    }
    return new Slider2(this, groupId, coord, coord, isHorizontal);
  }
  _onDestroy() {
    this._minimizedWindows.forEach((win) => win.unminimize());
    this.destroy_all_children();
    this._sliders = [];
    super.destroy();
  }
};
LayoutEditor = __decorateClass([
  registerGObjectClass
], LayoutEditor);

// src/indicator/utils.ts
import St11 from "gi://St";
import Gio4 from "gi://Gio";
import Clutter14 from "gi://Clutter";
var createButton = (iconName, text, path) => {
  const btn = createIconButton(iconName, path);
  btn.child.add_child(
    new St11.Label({
      marginBottom: 4,
      marginTop: 4,
      text,
      yAlign: Clutter14.ActorAlign.CENTER
    })
  );
  return btn;
};
var createIconButton = (iconName, path) => {
  const btn = new St11.Button({
    styleClass: "message-list-clear-button button",
    canFocus: true,
    xExpand: true,
    child: new St11.BoxLayout({
      vertical: false,
      // horizontal box layout
      clipToAllocation: true,
      xAlign: Clutter14.ActorAlign.CENTER,
      yAlign: Clutter14.ActorAlign.CENTER,
      reactive: true,
      xExpand: true,
      style: "spacing: 8px"
    })
  });
  const icon = new St11.Icon({
    iconSize: 16,
    yAlign: Clutter14.ActorAlign.CENTER,
    style: "padding: 6px"
  });
  if (path)
    icon.gicon = Gio4.icon_new_for_string(`${path}/icons/${iconName}.svg`);
  else
    icon.iconName = iconName;
  btn.child.add_child(icon);
  return btn;
};

// src/indicator/layoutButton.ts
import Clutter15 from "gi://Clutter";
import St12 from "gi://St";
var LayoutButtonWidget = class extends LayoutWidget {
  constructor(parent, layout, gapSize, height, width) {
    super({
      parent,
      layout,
      containerRect: buildRectangle({ x: 0, y: 0, width, height }),
      innerGaps: buildMarginOf(gapSize),
      outerGaps: new Clutter15.Margin()
    });
    this.relayout();
  }
  buildTile(parent, rect, gaps, tile) {
    return new SnapAssistTile({ parent, rect, gaps, tile });
  }
};
LayoutButtonWidget = __decorateClass([
  registerGObjectClass
], LayoutButtonWidget);
var LayoutButton = class extends St12.Button {
  constructor(parent, layout, gapSize, height, width) {
    super({
      styleClass: "layout-button button",
      xExpand: false,
      yExpand: false
    });
    parent.add_child(this);
    const scalingFactor = getScalingFactorOf(this)[1];
    this.child = new St12.Widget();
    new LayoutButtonWidget(
      this.child,
      layout,
      gapSize,
      height * scalingFactor,
      width * scalingFactor
    );
  }
};
LayoutButton = __decorateClass([
  registerGObjectClass
], LayoutButton);

// src/indicator/defaultMenu.ts
import St13 from "gi://St";
import Clutter16 from "gi://Clutter";
import GObject11 from "gi://GObject";
import Gio5 from "gi://Gio";
import * as Main5 from "resource:///org/gnome/shell/ui/main.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
var debug2 = logger("DefaultMenu");
var LayoutsRow = class extends St13.BoxLayout {
  _layoutsBox;
  _layoutsButtons;
  _label;
  _monitor;
  constructor(parent, layouts, selectedId, showMonitorName, monitor) {
    super({
      xAlign: Clutter16.ActorAlign.CENTER,
      yAlign: Clutter16.ActorAlign.CENTER,
      xExpand: true,
      yExpand: true,
      vertical: true,
      style: "spacing: 8px"
    });
    this._layoutsBox = new St13.BoxLayout({
      xAlign: Clutter16.ActorAlign.CENTER,
      yAlign: Clutter16.ActorAlign.CENTER,
      xExpand: true,
      yExpand: true,
      vertical: false,
      // horizontal box layout
      styleClass: "layouts-box-layout"
    });
    this._monitor = monitor;
    this._label = new St13.Label({
      text: `Monitor ${this._monitor.index + 1}`,
      styleClass: "monitor-layouts-title"
    });
    this.add_child(this._label);
    if (!showMonitorName)
      this._label.hide();
    this.add_child(this._layoutsBox);
    parent.add_child(this);
    const selectedIndex = layouts.findIndex((lay) => lay.id === selectedId);
    const hasGaps = Settings.get_inner_gaps(1).top > 0;
    const layoutHeight = 36;
    const layoutWidth = 64;
    this._layoutsButtons = layouts.map((lay, ind) => {
      const btn = new LayoutButton(
        this._layoutsBox,
        lay,
        hasGaps ? 2 : 0,
        layoutHeight,
        layoutWidth
      );
      btn.connect(
        "clicked",
        () => !btn.checked && this.emit("selected-layout", lay.id)
      );
      if (ind === selectedIndex)
        btn.set_checked(true);
      return btn;
    });
  }
  selectLayout(selectedId) {
    const selectedIndex = GlobalState.get().layouts.findIndex(
      (lay) => lay.id === selectedId
    );
    this._layoutsButtons.forEach(
      (btn, ind) => btn.set_checked(ind === selectedIndex)
    );
  }
  updateMonitorName(showMonitorName, monitorsDetails) {
    if (!showMonitorName)
      this._label.hide();
    else
      this._label.show();
    const details = monitorsDetails.find(
      (m) => m.x === this._monitor.x && m.y === this._monitor.y
    );
    if (!details)
      return;
    this._label.set_text(details.name);
  }
};
__publicField(LayoutsRow, "metaInfo", {
  GTypeName: "LayoutsRow",
  Signals: {
    "selected-layout": {
      param_types: [GObject11.TYPE_STRING]
    }
  }
});
LayoutsRow = __decorateClass([
  registerGObjectClass
], LayoutsRow);
var DefaultMenu = class {
  _signals;
  _indicator;
  _layoutsRows;
  _container;
  _scalingFactor;
  _children;
  constructor(indicator, enableScalingFactor) {
    this._indicator = indicator;
    this._signals = new SignalHandling();
    this._children = [];
    const layoutsPopupMenu = new PopupMenu.PopupBaseMenuItem({
      style_class: "indicator-menu-item"
    });
    this._children.push(layoutsPopupMenu);
    this._container = new St13.BoxLayout({
      xAlign: Clutter16.ActorAlign.CENTER,
      yAlign: Clutter16.ActorAlign.CENTER,
      xExpand: true,
      yExpand: true,
      vertical: true,
      styleClass: "default-menu-container"
    });
    layoutsPopupMenu.add_child(this._container);
    this._indicator.menu.addMenuItem(
      layoutsPopupMenu
    );
    if (enableScalingFactor) {
      const monitor = Main5.layoutManager.findMonitorForActor(
        this._container
      );
      const scalingFactor = getMonitorScalingFactor(
        monitor?.index || Main5.layoutManager.primaryIndex
      );
      enableScalingFactorSupport(this._container, scalingFactor);
    }
    this._scalingFactor = getScalingFactorOf(this._container)[1];
    this._layoutsRows = [];
    this._drawLayouts();
    this._signals.connect(Settings, Settings.SETTING_LAYOUTS_JSON, () => {
      this._drawLayouts();
    });
    this._signals.connect(Settings, Settings.SETTING_INNER_GAPS, () => {
      this._drawLayouts();
    });
    this._signals.connect(
      Settings,
      Settings.SETTING_SELECTED_LAYOUTS,
      () => {
        this._updateScaling();
        if (this._layoutsRows.length !== getMonitors().length)
          this._drawLayouts();
        Settings.get_selected_layouts().forEach((selectedId, index) => {
          this._layoutsRows[index].selectLayout(selectedId);
        });
      }
    );
    this._signals.connect(Main5.layoutManager, "monitors-changed", () => {
      if (!enableScalingFactor)
        return;
      const monitor = Main5.layoutManager.findMonitorForActor(
        this._container
      );
      const scalingFactor = getMonitorScalingFactor(
        monitor?.index || Main5.layoutManager.primaryIndex
      );
      enableScalingFactorSupport(this._container, scalingFactor);
      this._updateScaling();
      if (this._layoutsRows.length !== getMonitors().length)
        this._drawLayouts();
      this._computeMonitorsDetails();
    });
    this._computeMonitorsDetails();
    const buttonsPopupMenu = this._buildEditingButtonsRow();
    this._indicator.menu.addMenuItem(
      buttonsPopupMenu
    );
    this._children.push(buttonsPopupMenu);
  }
  // compute monitors details and update labels asynchronously (if we have successful results...)
  _computeMonitorsDetails() {
    if (getMonitors().length === 1) {
      this._layoutsRows.forEach((lr) => lr.updateMonitorName(false, []));
      return;
    }
    try {
      const proc = Gio5.Subprocess.new(
        ["gjs", "-m", `${this._indicator.path}/monitorDescription.js`],
        Gio5.SubprocessFlags.STDOUT_PIPE | Gio5.SubprocessFlags.STDERR_PIPE
      );
      proc.communicate_utf8_async(
        null,
        null,
        (pr, res) => {
          if (!pr)
            return;
          const [, stdout, stderr] = pr.communicate_utf8_finish(res);
          if (pr.get_successful()) {
            debug2(stdout);
            const monitorsDetails = JSON.parse(stdout);
            this._layoutsRows.forEach(
              (lr) => lr.updateMonitorName(true, monitorsDetails)
            );
          } else {
            debug2("error:", stderr);
          }
        }
      );
    } catch (e) {
      debug2(e);
    }
  }
  _updateScaling() {
    const newScalingFactor = getScalingFactorOf(this._container)[1];
    if (this._scalingFactor === newScalingFactor)
      return;
    this._scalingFactor = newScalingFactor;
    this._drawLayouts();
  }
  _buildEditingButtonsRow() {
    const buttonsBoxLayout = new St13.BoxLayout({
      xAlign: Clutter16.ActorAlign.CENTER,
      yAlign: Clutter16.ActorAlign.CENTER,
      xExpand: true,
      yExpand: true,
      vertical: false,
      // horizontal box layout
      styleClass: "buttons-box-layout"
    });
    const editLayoutsBtn = createButton(
      "edit-symbolic",
      "Edit Layouts...",
      this._indicator.path
    );
    editLayoutsBtn.connect(
      "clicked",
      () => this._indicator.openLayoutEditor()
    );
    buttonsBoxLayout.add_child(editLayoutsBtn);
    const newLayoutBtn = createButton(
      "add-symbolic",
      "New Layout...",
      this._indicator.path
    );
    newLayoutBtn.connect(
      "clicked",
      () => this._indicator.newLayoutOnClick(true)
    );
    buttonsBoxLayout.add_child(newLayoutBtn);
    const buttonsPopupMenu = new PopupMenu.PopupBaseMenuItem({
      style_class: "indicator-menu-item"
    });
    buttonsPopupMenu.add_child(buttonsBoxLayout);
    return buttonsPopupMenu;
  }
  _drawLayouts() {
    const layouts = GlobalState.get().layouts;
    this._container.destroy_all_children();
    this._layoutsRows = [];
    const selectedIdPerMonitor = Settings.get_selected_layouts();
    const monitors = getMonitors();
    this._layoutsRows = monitors.map((monitor) => {
      const selectedId = selectedIdPerMonitor[monitor.index];
      const row = new LayoutsRow(
        this._container,
        layouts,
        selectedId,
        monitors.length > 1,
        monitor
      );
      row.connect(
        "selected-layout",
        (r, layoutId) => {
          this._indicator.selectLayoutOnClick(
            monitor.index,
            layoutId
          );
        }
      );
      return row;
    });
  }
  destroy() {
    this._signals.disconnect();
    this._layoutsRows.forEach((lr) => lr.destroy());
    this._layoutsRows = [];
    this._children.forEach((c) => c.destroy());
    this._children = [];
  }
};

// src/indicator/editingMenu.ts
import St14 from "gi://St";
import * as PopupMenu2 from "resource:///org/gnome/shell/ui/popupMenu.js";
var EditingMenu = class {
  _indicator;
  constructor(indicator) {
    this._indicator = indicator;
    const boxLayout = new St14.BoxLayout({
      vertical: true,
      styleClass: "buttons-box-layout",
      xExpand: true,
      style: "spacing: 8px"
    });
    const openMenuBtn = createButton(
      "menu-symbolic",
      "Menu  ",
      this._indicator.path
    );
    openMenuBtn.connect("clicked", () => this._indicator.openMenu(false));
    boxLayout.add_child(openMenuBtn);
    const infoMenuBtn = createButton(
      "info-symbolic",
      "Info     ",
      this._indicator.path
    );
    infoMenuBtn.connect("clicked", () => this._indicator.openMenu(true));
    boxLayout.add_child(infoMenuBtn);
    const saveBtn = createButton(
      "save-symbolic",
      "Save    ",
      this._indicator.path
    );
    saveBtn.connect("clicked", () => {
      this._indicator.menu.toggle();
      this._indicator.saveLayoutOnClick();
    });
    boxLayout.add_child(saveBtn);
    const cancelBtn = createButton(
      "cancel-symbolic",
      "Cancel",
      this._indicator.path
    );
    cancelBtn.connect("clicked", () => {
      this._indicator.menu.toggle();
      this._indicator.cancelLayoutOnClick();
    });
    boxLayout.add_child(cancelBtn);
    const menuItem = new PopupMenu2.PopupBaseMenuItem({
      style_class: "indicator-menu-item"
    });
    menuItem.add_child(boxLayout);
    this._indicator.menu.addMenuItem(menuItem);
  }
  destroy() {
    this._indicator.menu.removeAll();
  }
};

// src/components/editor/editorDialog.ts
import Clutter17 from "gi://Clutter";
import St15 from "gi://St";
import Gio6 from "gi://Gio";
import * as ModalDialog from "resource:///org/gnome/shell/ui/modalDialog.js";
import * as Main6 from "resource:///org/gnome/shell/ui/main.js";
var EditorDialog = class extends ModalDialog.ModalDialog {
  _layoutHeight = 72;
  _layoutWidth = 128;
  // 16:9 ratio. -> (16*layoutHeight) / 9 and then rounded to int
  _gapsSize = 3;
  _layoutsBoxLayout;
  constructor(params) {
    super({
      destroyOnClose: true,
      styleClass: "editor-dialog"
    });
    if (params.enableScaling) {
      const monitor = Main6.layoutManager.findMonitorForActor(this);
      const scalingFactor = getMonitorScalingFactor(
        monitor?.index || Main6.layoutManager.primaryIndex
      );
      enableScalingFactorSupport(this, scalingFactor);
    }
    this.contentLayout.add_child(
      new St15.Label({
        text: "Select the layout to edit",
        xAlign: Clutter17.ActorAlign.CENTER,
        xExpand: true,
        styleClass: "editor-dialog-title"
      })
    );
    this._layoutsBoxLayout = new St15.BoxLayout({
      vertical: false,
      // horizontal box layout
      styleClass: "layouts-box-layout",
      xAlign: Clutter17.ActorAlign.CENTER
    });
    this.contentLayout.add_child(this._layoutsBoxLayout);
    if (!params.legend) {
      this._drawLayouts({
        layouts: GlobalState.get().layouts,
        ...params
      });
    }
    this.addButton({
      label: "Close",
      default: true,
      key: Clutter17.KEY_Escape,
      action: () => params.onClose()
    });
    if (params.legend) {
      this._makeLegendDialog({
        onClose: params.onClose,
        path: params.path
      });
    }
  }
  _makeLegendDialog(params) {
    const suggestion1 = new St15.BoxLayout({ vertical: false });
    suggestion1.add_child(
      new St15.Label({
        text: "LEFT CLICK",
        xAlign: Clutter17.ActorAlign.CENTER,
        yAlign: Clutter17.ActorAlign.CENTER,
        styleClass: "button kbd",
        xExpand: false,
        pseudoClass: "active"
      })
    );
    suggestion1.add_child(
      new St15.Label({
        text: " to split a tile.",
        xAlign: Clutter17.ActorAlign.CENTER,
        yAlign: Clutter17.ActorAlign.CENTER,
        styleClass: "",
        xExpand: false
      })
    );
    const suggestion2 = new St15.BoxLayout({ vertical: false });
    suggestion2.add_child(
      new St15.Label({
        text: "LEFT CLICK",
        xAlign: Clutter17.ActorAlign.CENTER,
        yAlign: Clutter17.ActorAlign.CENTER,
        styleClass: "button kbd",
        xExpand: false,
        pseudoClass: "active"
      })
    );
    suggestion2.add_child(
      new St15.Label({
        text: " + ",
        xAlign: Clutter17.ActorAlign.CENTER,
        yAlign: Clutter17.ActorAlign.CENTER,
        styleClass: "",
        xExpand: false
      })
    );
    suggestion2.add_child(
      new St15.Label({
        text: "CTRL",
        xAlign: Clutter17.ActorAlign.CENTER,
        yAlign: Clutter17.ActorAlign.CENTER,
        styleClass: "button kbd",
        xExpand: false,
        pseudoClass: "active"
      })
    );
    suggestion2.add_child(
      new St15.Label({
        text: " to split a tile vertically.",
        xAlign: Clutter17.ActorAlign.CENTER,
        yAlign: Clutter17.ActorAlign.CENTER,
        styleClass: "",
        xExpand: false
      })
    );
    const suggestion3 = new St15.BoxLayout({ vertical: false });
    suggestion3.add_child(
      new St15.Label({
        text: "RIGHT CLICK",
        xAlign: Clutter17.ActorAlign.CENTER,
        yAlign: Clutter17.ActorAlign.CENTER,
        styleClass: "button kbd",
        xExpand: false,
        pseudoClass: "active"
      })
    );
    suggestion3.add_child(
      new St15.Label({
        text: " to delete a tile.",
        xAlign: Clutter17.ActorAlign.CENTER,
        yAlign: Clutter17.ActorAlign.CENTER,
        styleClass: "",
        xExpand: false
      })
    );
    const suggestion4 = new St15.BoxLayout({
      vertical: false,
      xExpand: true,
      margin_top: 16
    });
    suggestion4.add_child(
      new St15.Icon({
        iconSize: 16,
        yAlign: Clutter17.ActorAlign.CENTER,
        gicon: Gio6.icon_new_for_string(
          `${params.path}/icons/indicator-symbolic.svg`
        ),
        styleClass: "button kbd",
        pseudoClass: "active"
      })
    );
    suggestion4.add_child(
      new St15.Label({
        text: " use the indicator button to save or cancel.",
        xAlign: Clutter17.ActorAlign.CENTER,
        yAlign: Clutter17.ActorAlign.CENTER,
        styleClass: "",
        xExpand: false
      })
    );
    const legend = new St15.BoxLayout({
      vertical: true,
      styleClass: "legend"
    });
    legend.add_child(suggestion1);
    legend.add_child(suggestion2);
    legend.add_child(suggestion3);
    legend.add_child(suggestion4);
    this.contentLayout.destroy_all_children();
    this.contentLayout.add_child(
      new St15.Label({
        text: "How to use the editor",
        xAlign: Clutter17.ActorAlign.CENTER,
        xExpand: true,
        styleClass: "editor-dialog-title"
      })
    );
    this.contentLayout.add_child(legend);
    this.clearButtons();
    this.addButton({
      label: "Start editing",
      default: true,
      key: Clutter17.KEY_Escape,
      action: params.onClose
    });
  }
  _drawLayouts(params) {
    const gaps = Settings.get_inner_gaps(1).top > 0 ? this._gapsSize : 0;
    this._layoutsBoxLayout.destroy_all_children();
    params.layouts.forEach((lay, btnInd) => {
      const box2 = new St15.BoxLayout({
        vertical: true,
        xAlign: Clutter17.ActorAlign.CENTER,
        styleClass: "layout-button-container"
      });
      this._layoutsBoxLayout.add_child(box2);
      const btn = new LayoutButton(
        box2,
        lay,
        gaps,
        this._layoutHeight,
        this._layoutWidth
      );
      if (params.layouts.length > 1) {
        const deleteBtn = new St15.Button({
          xExpand: false,
          xAlign: Clutter17.ActorAlign.CENTER,
          styleClass: "message-list-clear-button icon-button button delete-layout-button"
        });
        deleteBtn.child = new St15.Icon({
          gicon: Gio6.icon_new_for_string(
            `${params.path}/icons/delete-symbolic.svg`
          ),
          iconSize: 16
        });
        deleteBtn.connect("clicked", () => {
          params.onDeleteLayout(btnInd, lay);
          this._drawLayouts({
            ...params,
            layouts: GlobalState.get().layouts
          });
        });
        box2.add_child(deleteBtn);
      }
      btn.connect("clicked", () => {
        params.onSelectLayout(btnInd, lay);
        this._makeLegendDialog({
          onClose: params.onClose,
          path: params.path
        });
      });
      return btn;
    });
    const box = new St15.BoxLayout({
      vertical: true,
      xAlign: Clutter17.ActorAlign.CENTER,
      styleClass: "layout-button-container"
    });
    this._layoutsBoxLayout.add_child(box);
    const newLayoutBtn = new LayoutButton(
      box,
      new Layout(
        [new Tile2({ x: 0, y: 0, width: 1, height: 1, groups: [] })],
        "New Layout"
      ),
      gaps,
      this._layoutHeight,
      this._layoutWidth
    );
    const icon = new St15.Icon({
      gicon: Gio6.icon_new_for_string(
        `${params.path}/icons/add-symbolic.svg`
      ),
      iconSize: 32
    });
    icon.set_size(newLayoutBtn.child.width, newLayoutBtn.child.height);
    newLayoutBtn.child.add_child(icon);
    newLayoutBtn.connect("clicked", () => {
      params.onNewLayout();
      this._makeLegendDialog({
        onClose: params.onClose,
        path: params.path
      });
    });
  }
};
EditorDialog = __decorateClass([
  registerGObjectClass
], EditorDialog);

// src/indicator/indicator.ts
import Gio7 from "gi://Gio";
import St16 from "gi://St";
import Shell4 from "gi://Shell";
import * as Main7 from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
var IndicatorState = /* @__PURE__ */ ((IndicatorState2) => {
  IndicatorState2[IndicatorState2["DEFAULT"] = 1] = "DEFAULT";
  IndicatorState2[IndicatorState2["CREATE_NEW"] = 2] = "CREATE_NEW";
  IndicatorState2[IndicatorState2["EDITING_LAYOUT"] = 3] = "EDITING_LAYOUT";
  return IndicatorState2;
})(IndicatorState || {});
var Indicator3 = class extends PanelMenu.Button {
  _layoutEditor;
  _editorDialog;
  _currentMenu;
  _state;
  _enableScaling;
  _path;
  constructor(path, uuid) {
    super(0.5, "Tiling Shell Indicator", false);
    Main7.panel.addToStatusArea(uuid, this, 1, "right");
    Settings.bind(
      Settings.SETTING_SHOW_INDICATOR,
      this,
      "visible",
      Gio7.SettingsBindFlags.GET
    );
    const icon = new St16.Icon({
      gicon: Gio7.icon_new_for_string(
        `${path}/icons/indicator-symbolic.svg`
      ),
      styleClass: "system-status-icon indicator-icon"
    });
    this.add_child(icon);
    this._layoutEditor = null;
    this._editorDialog = null;
    this._currentMenu = null;
    this._state = 1 /* DEFAULT */;
    this._enableScaling = false;
    this._path = path;
    this.connect("destroy", this._onDestroy.bind(this));
  }
  get path() {
    return this._path;
  }
  set enableScaling(value) {
    if (this._enableScaling === value)
      return;
    this._enableScaling = value;
    if (this._currentMenu && this._state === 1 /* DEFAULT */) {
      this._currentMenu.destroy();
      this._currentMenu = new DefaultMenu(this, this._enableScaling);
    }
  }
  enable() {
    this.menu.removeAll();
    this._currentMenu = new DefaultMenu(this, this._enableScaling);
  }
  selectLayoutOnClick(monitorIndex, layoutToSelectId) {
    const selected = Settings.get_selected_layouts();
    selected[monitorIndex] = layoutToSelectId;
    Settings.save_selected_layouts_json(selected);
    this.menu.toggle();
  }
  newLayoutOnClick(showLegendOnly) {
    this.menu.close(true);
    const newLayout = new Layout(
      [
        new Tile2({ x: 0, y: 0, width: 0.3, height: 1, groups: [1] }),
        new Tile2({ x: 0.3, y: 0, width: 0.7, height: 1, groups: [1] })
      ],
      `${Shell4.Global.get().get_current_time()}`
    );
    if (this._layoutEditor) {
      this._layoutEditor.layout = newLayout;
    } else {
      this._layoutEditor = new LayoutEditor(
        newLayout,
        Main7.layoutManager.monitors[Main7.layoutManager.primaryIndex],
        this._enableScaling
      );
    }
    this._setState(2 /* CREATE_NEW */);
    if (showLegendOnly)
      this.openMenu(true);
  }
  openMenu(showLegend) {
    if (this._editorDialog)
      return;
    this._editorDialog = new EditorDialog({
      enableScaling: this._enableScaling,
      onNewLayout: () => {
        this.newLayoutOnClick(false);
      },
      onDeleteLayout: (ind, lay) => {
        GlobalState.get().deleteLayout(lay);
        if (this._layoutEditor && this._layoutEditor.layout.id === lay.id)
          this.cancelLayoutOnClick();
      },
      onSelectLayout: (ind, lay) => {
        const layCopy = new Layout(
          lay.tiles.map(
            (t) => new Tile2({
              x: t.x,
              y: t.y,
              width: t.width,
              height: t.height,
              groups: [...t.groups]
            })
          ),
          lay.id
        );
        if (this._layoutEditor) {
          this._layoutEditor.layout = layCopy;
        } else {
          this._layoutEditor = new LayoutEditor(
            layCopy,
            Main7.layoutManager.monitors[Main7.layoutManager.primaryIndex],
            this._enableScaling
          );
        }
        this._setState(3 /* EDITING_LAYOUT */);
      },
      onClose: () => {
        this._editorDialog?.destroy();
        this._editorDialog = null;
      },
      path: this._path,
      legend: showLegend
    });
    this._editorDialog.open();
  }
  openLayoutEditor() {
    this.openMenu(false);
  }
  saveLayoutOnClick() {
    if (this._layoutEditor === null || this._state === 1 /* DEFAULT */)
      return;
    const newLayout = this._layoutEditor.layout;
    if (this._state === 2 /* CREATE_NEW */)
      GlobalState.get().addLayout(newLayout);
    else
      GlobalState.get().editLayout(newLayout);
    this.menu.toggle();
    this._layoutEditor.destroy();
    this._layoutEditor = null;
    this._setState(1 /* DEFAULT */);
  }
  cancelLayoutOnClick() {
    if (this._layoutEditor === null || this._state === 1 /* DEFAULT */)
      return;
    this.menu.toggle();
    this._layoutEditor.destroy();
    this._layoutEditor = null;
    this._setState(1 /* DEFAULT */);
  }
  _setState(newState) {
    if (this._state === newState)
      return;
    this._state = newState;
    this._currentMenu?.destroy();
    switch (newState) {
      case 1 /* DEFAULT */:
        this._currentMenu = new DefaultMenu(this, this._enableScaling);
        if (!Settings.get_show_indicator())
          this.hide();
        break;
      case 2 /* CREATE_NEW */:
      case 3 /* EDITING_LAYOUT */:
        this._currentMenu = new EditingMenu(this);
        this.show();
        break;
    }
  }
  _onDestroy() {
    this._editorDialog?.destroy();
    this._editorDialog = null;
    this._layoutEditor?.destroy();
    this._layoutEditor = null;
    this._currentMenu?.destroy();
    this._currentMenu = null;
    this.menu.removeAll();
  }
};
Indicator3 = __decorateClass([
  registerGObjectClass
], Indicator3);

// src/dbus.ts
var node = `<node>
    <interface name="org.gnome.Shell.Extensions.TilingShell">
        <method name="openLayoutEditor" />
    </interface>
</node>`;
import Gio8 from "gi://Gio";
var DBus = class {
  _dbus;
  constructor() {
    this._dbus = null;
  }
  enable(ext) {
    if (this._dbus)
      return;
    this._dbus = Gio8.DBusExportedObject.wrapJSObject(node, ext);
    this._dbus.export(
      Gio8.DBus.session,
      "/org/gnome/Shell/Extensions/TilingShell"
    );
  }
  disable() {
    this._dbus?.flush();
    this._dbus?.unexport();
    this._dbus = null;
  }
};

// src/settings/settingsOverride.ts
import Gio9 from "gi://Gio";
import GLib3 from "gi://GLib";
var SettingsOverride = class _SettingsOverride {
  // map schema_id with map of keys and old values
  _overriddenKeys;
  static _instance;
  constructor() {
    this._overriddenKeys = this._jsonToOverriddenKeys(
      Settings.get_overridden_settings()
    );
  }
  static get() {
    if (!this._instance)
      this._instance = new _SettingsOverride();
    return this._instance;
  }
  static destroy() {
    if (!this._instance)
      return;
    this._instance.restoreAll();
    this._instance = null;
  }
  /*
  json will have the following structure
  {
      "schema.id": {
          "overridden.key.one": oldvalue,
          "overridden.key.two": oldvalue
          ...
      },
      ...
  }
  */
  _overriddenKeysToJSON() {
    const obj = {};
    this._overriddenKeys.forEach((override, schemaId) => {
      obj[schemaId] = {};
      override.forEach((oldValue, key) => {
        obj[schemaId][key] = oldValue.print(true);
      });
    });
    return JSON.stringify(obj);
  }
  _jsonToOverriddenKeys(json) {
    const result = /* @__PURE__ */ new Map();
    const obj = JSON.parse(json);
    for (const schemaId in obj) {
      const schemaMap = /* @__PURE__ */ new Map();
      result.set(schemaId, schemaMap);
      const overrideObj = obj[schemaId];
      for (const key in overrideObj) {
        schemaMap.set(
          key,
          GLib3.Variant.parse(null, overrideObj[key], null, null)
        );
      }
    }
    return result;
  }
  override(giosettings, keyToOverride, newValue) {
    const schemaId = giosettings.schemaId;
    const schemaMap = this._overriddenKeys.get(schemaId) || /* @__PURE__ */ new Map();
    if (!this._overriddenKeys.has(schemaId))
      this._overriddenKeys.set(schemaId, schemaMap);
    const oldValue = schemaMap.has(keyToOverride) ? schemaMap.get(keyToOverride) : giosettings.get_value(keyToOverride);
    const res = giosettings.set_value(keyToOverride, newValue);
    if (!res)
      return null;
    if (!schemaMap.has(keyToOverride)) {
      schemaMap.set(keyToOverride, oldValue);
      Settings.set_overridden_settings(this._overriddenKeysToJSON());
    }
    return oldValue;
  }
  restoreKey(giosettings, keyToOverride) {
    const overridden = this._overriddenKeys.get(giosettings.schemaId);
    if (!overridden)
      return null;
    const oldValue = overridden.get(keyToOverride);
    if (!oldValue)
      return null;
    const res = giosettings.set_value(keyToOverride, oldValue);
    if (res) {
      overridden.delete(keyToOverride);
      if (overridden.size === 0)
        this._overriddenKeys.delete(giosettings.schemaId);
      Settings.set_overridden_settings(this._overriddenKeysToJSON());
    }
    return oldValue;
  }
  _restoreAllKeys(giosettings) {
    const overridden = this._overriddenKeys.get(giosettings.schemaId);
    if (!overridden)
      return;
    overridden.forEach((oldValue, key) => {
      const done = giosettings.set_value(key, oldValue);
      if (done)
        overridden.delete(key);
    });
    if (overridden.size === 0)
      this._overriddenKeys.delete(giosettings.schemaId);
  }
  restoreAll() {
    this._overriddenKeys.forEach(
      (overridden, schemaId) => {
        this._restoreAllKeys(new Gio9.Settings({ schemaId }));
      }
    );
    if (this._overriddenKeys.size === 0)
      this._overriddenKeys = /* @__PURE__ */ new Map();
    Settings.set_overridden_settings(this._overriddenKeysToJSON());
  }
};

// src/keybindings.ts
import * as Main8 from "resource:///org/gnome/shell/ui/main.js";
import Gio10 from "gi://Gio";
import Meta9 from "gi://Meta";
import Shell5 from "gi://Shell";
import GLib4 from "gi://GLib";
import GObject12 from "gi://GObject";
var debug3 = logger("KeyBindings");
var KeyBindings = class extends GObject12.Object {
  _signals;
  constructor(extensionSettings) {
    super();
    this._signals = new SignalHandling();
    this._signals.connect(
      Settings,
      Settings.SETTING_ENABLE_MOVE_KEYBINDINGS,
      () => {
        this._setupKeyBindings(extensionSettings);
      }
    );
    if (Settings.get_enable_move_keybindings())
      this._setupKeyBindings(extensionSettings);
  }
  _setupKeyBindings(extensionSettings) {
    const enabled = Settings.get_enable_move_keybindings();
    if (enabled)
      this._applyKeybindings(extensionSettings);
    else
      this._removeKeybindings();
  }
  _applyKeybindings(extensionSettings) {
    const mutterKeybindings = new Gio10.Settings({
      schema_id: "org.gnome.mutter.keybindings"
    });
    this._overrideKeyBinding(
      Settings.SETTING_MOVE_WINDOW_RIGHT,
      (display) => {
        this.emit("move-window", display, Meta9.DisplayDirection.RIGHT);
      },
      extensionSettings,
      mutterKeybindings,
      "toggle-tiled-right"
    );
    this._overrideKeyBinding(
      Settings.SETTING_MOVE_WINDOW_LEFT,
      (display) => {
        this.emit("move-window", display, Meta9.DisplayDirection.LEFT);
      },
      extensionSettings,
      mutterKeybindings,
      "toggle-tiled-left"
    );
    const desktopWm = new Gio10.Settings({
      schema_id: "org.gnome.desktop.wm.keybindings"
    });
    this._overrideKeyBinding(
      Settings.SETTING_MOVE_WINDOW_UP,
      (display) => {
        this.emit("move-window", display, Meta9.DisplayDirection.UP);
      },
      extensionSettings,
      desktopWm,
      "maximize"
    );
    this._overrideKeyBinding(
      Settings.SETTING_MOVE_WINDOW_DOWN,
      (display) => {
        this.emit("move-window", display, Meta9.DisplayDirection.DOWN);
      },
      extensionSettings,
      desktopWm,
      "unmaximize"
    );
  }
  _removeKeybindings() {
    SettingsOverride.get().restoreAll();
    Main8.wm.removeKeybinding(Settings.SETTING_MOVE_WINDOW_RIGHT);
    Main8.wm.removeKeybinding(Settings.SETTING_MOVE_WINDOW_LEFT);
    Main8.wm.removeKeybinding(Settings.SETTING_MOVE_WINDOW_UP);
    Main8.wm.removeKeybinding(Settings.SETTING_MOVE_WINDOW_DOWN);
  }
  _overrideKeyBinding(name, handler, extensionSettings, nativeSettings, nativeKeyName) {
    const done = SettingsOverride.get().override(
      nativeSettings,
      nativeKeyName,
      new GLib4.Variant("as", [])
    );
    if (!done) {
      debug3(`failed to override ${nativeKeyName}`);
      return;
    }
    Main8.wm.addKeybinding(
      name,
      extensionSettings,
      Meta9.KeyBindingFlags.NONE,
      Shell5.ActionMode.NORMAL,
      handler
    );
  }
  destroy() {
    this._removeKeybindings();
  }
};
__publicField(KeyBindings, "metaInfo", {
  GTypeName: "KeyBindings",
  Signals: {
    "move-window": {
      param_types: [Meta9.Display.$gtype, GObject12.TYPE_INT]
      // Meta.Display, Meta.Direction
    }
  }
});
KeyBindings = __decorateClass([
  registerGObjectClass
], KeyBindings);

// src/components/tilingsystem/resizeManager.ts
import Meta10 from "gi://Meta";
import St17 from "gi://St";
var ResizingManager = class {
  _signals;
  constructor() {
    this._signals = null;
  }
  enable() {
    if (this._signals)
      this._signals.disconnect();
    this._signals = new SignalHandling();
    this._signals.connect(
      global.display,
      "grab-op-begin",
      (_display, window, grabOp) => {
        const moving = grabOp === Meta10.GrabOp.KEYBOARD_MOVING || grabOp === Meta10.GrabOp.MOVING;
        if (moving || !Settings.get_resize_complementing_windows())
          return;
        this._onWindowResizingBegin(window, grabOp & ~1024);
      }
    );
    this._signals.connect(
      global.display,
      "grab-op-end",
      (_display, window, grabOp) => {
        const moving = grabOp === Meta10.GrabOp.KEYBOARD_MOVING || grabOp === Meta10.GrabOp.MOVING;
        if (moving)
          return;
        this._onWindowResizingEnd(window);
      }
    );
  }
  destroy() {
    if (this._signals)
      this._signals.disconnect();
  }
  _onWindowResizingBegin(window, grabOp) {
    if (!window || !window.assignedTile || !this._signals)
      return;
    const verticalSide = [false, 0];
    const horizontalSide = [false, 0];
    switch (grabOp) {
      case Meta10.GrabOp.RESIZING_N:
      case Meta10.GrabOp.RESIZING_NE:
      case Meta10.GrabOp.RESIZING_NW:
      case Meta10.GrabOp.KEYBOARD_RESIZING_N:
      case Meta10.GrabOp.KEYBOARD_RESIZING_NE:
      case Meta10.GrabOp.KEYBOARD_RESIZING_NW:
        verticalSide[0] = true;
        verticalSide[1] = St17.Side.TOP;
        break;
      case Meta10.GrabOp.RESIZING_S:
      case Meta10.GrabOp.RESIZING_SE:
      case Meta10.GrabOp.RESIZING_SW:
      case Meta10.GrabOp.KEYBOARD_RESIZING_S:
      case Meta10.GrabOp.KEYBOARD_RESIZING_SE:
      case Meta10.GrabOp.KEYBOARD_RESIZING_SW:
        verticalSide[0] = true;
        verticalSide[1] = St17.Side.BOTTOM;
        break;
    }
    switch (grabOp) {
      case Meta10.GrabOp.RESIZING_E:
      case Meta10.GrabOp.RESIZING_NE:
      case Meta10.GrabOp.RESIZING_SE:
      case Meta10.GrabOp.KEYBOARD_RESIZING_E:
      case Meta10.GrabOp.KEYBOARD_RESIZING_NE:
      case Meta10.GrabOp.KEYBOARD_RESIZING_SE:
        horizontalSide[0] = true;
        horizontalSide[1] = St17.Side.RIGHT;
        break;
      case Meta10.GrabOp.RESIZING_W:
      case Meta10.GrabOp.RESIZING_NW:
      case Meta10.GrabOp.RESIZING_SW:
      case Meta10.GrabOp.KEYBOARD_RESIZING_W:
      case Meta10.GrabOp.KEYBOARD_RESIZING_NW:
      case Meta10.GrabOp.KEYBOARD_RESIZING_SW:
        horizontalSide[0] = true;
        horizontalSide[1] = St17.Side.LEFT;
        break;
    }
    if (!verticalSide[0] && !horizontalSide[0])
      return;
    const otherTiledWindows = getWindows().filter(
      (otherWindow) => otherWindow && otherWindow.assignedTile && otherWindow !== window && !otherWindow.minimized
    );
    if (otherTiledWindows.length === 0)
      return;
    const verticalAdjacentWindows = verticalSide[0] ? this._findAdjacent(
      window,
      verticalSide[1],
      new Set(otherTiledWindows)
    ) : [];
    const horizontalAdjacentWindows = horizontalSide[0] ? this._findAdjacent(
      window,
      horizontalSide[1],
      new Set(otherTiledWindows)
    ) : [];
    const windowsMap = /* @__PURE__ */ new Map();
    verticalAdjacentWindows.forEach(([otherWin, sideOtherWin]) => {
      windowsMap.set(otherWin, [
        otherWin,
        otherWin.get_frame_rect().copy(),
        sideOtherWin,
        // resize vertically
        -1
        // resize horizontally
      ]);
    });
    horizontalAdjacentWindows.forEach(([otherWin, sideOtherWin]) => {
      const val = windowsMap.get(otherWin);
      if (val) {
        val[3] = sideOtherWin;
      } else {
        windowsMap.set(otherWin, [
          otherWin,
          otherWin.get_frame_rect().copy(),
          -1,
          // resize vertically
          sideOtherWin
          // resize horizontally
        ]);
      }
    });
    const windowsToResize = Array.from(windowsMap.values());
    this._signals.connect(
      window,
      "size-changed",
      this._onResizingWindow.bind(
        this,
        window,
        window.get_frame_rect().copy(),
        verticalSide[1],
        horizontalSide[1],
        windowsToResize
      )
    );
  }
  _oppositeSide(side) {
    switch (side) {
      case St17.Side.TOP:
        return St17.Side.BOTTOM;
      case St17.Side.BOTTOM:
        return St17.Side.TOP;
      case St17.Side.LEFT:
        return St17.Side.RIGHT;
      case St17.Side.RIGHT:
        return St17.Side.LEFT;
    }
  }
  _findAdjacent(window, side, remainingWindows) {
    const result = [];
    const adjacentWindows = [];
    const windowRect = window.get_frame_rect();
    const borderRect = windowRect.copy();
    const innerGaps = Settings.get_inner_gaps();
    if (innerGaps.top === 0)
      innerGaps.top = 2;
    if (innerGaps.bottom === 0)
      innerGaps.bottom = 2;
    if (innerGaps.left === 0)
      innerGaps.left = 2;
    if (innerGaps.right === 0)
      innerGaps.right = 2;
    const errorFactor = innerGaps.right * 4;
    switch (side) {
      case St17.Side.TOP:
        borderRect.height = innerGaps.top + errorFactor;
        borderRect.y -= innerGaps.top + errorFactor;
        break;
      case St17.Side.BOTTOM:
        borderRect.y += borderRect.height;
        borderRect.height = innerGaps.bottom + errorFactor;
        break;
      case St17.Side.LEFT:
        borderRect.width = innerGaps.left + errorFactor;
        borderRect.x -= innerGaps.left + errorFactor;
        break;
      case St17.Side.RIGHT:
        borderRect.x += borderRect.width;
        borderRect.width = innerGaps.right + errorFactor;
        break;
    }
    const oppositeSide = this._oppositeSide(side);
    const newRemainingWindows = /* @__PURE__ */ new Set();
    remainingWindows.forEach((otherWin) => {
      const otherWinRect = otherWin.get_frame_rect();
      let [hasIntersection, intersection] = otherWin.get_frame_rect().intersect(borderRect);
      switch (side) {
        case St17.Side.RIGHT:
          hasIntersection && (hasIntersection = intersection.x <= otherWinRect.x);
          break;
        case St17.Side.LEFT:
          hasIntersection && (hasIntersection = intersection.x + intersection.width >= otherWinRect.x + otherWinRect.width);
          break;
        case St17.Side.BOTTOM:
          hasIntersection && (hasIntersection = intersection.y <= otherWinRect.y);
          break;
        case St17.Side.TOP:
          hasIntersection && (hasIntersection = intersection.y + intersection.height >= otherWinRect.y + otherWinRect.height);
          break;
      }
      if (hasIntersection) {
        result.push([otherWin, oppositeSide]);
        adjacentWindows.push(otherWin);
      } else {
        newRemainingWindows.add(otherWin);
      }
    });
    adjacentWindows.forEach((otherWin) => {
      this._findAdjacent(
        otherWin,
        oppositeSide,
        newRemainingWindows
      ).forEach((recursionResult) => {
        result.push(recursionResult);
        newRemainingWindows.delete(recursionResult[0]);
      });
    });
    return result;
  }
  _onWindowResizingEnd(window) {
    if (this._signals)
      this._signals.disconnect(window);
  }
  _onResizingWindow(window, startingRect, resizeVerticalSide, resizeHorizontalSide, windowsToResize) {
    const currentRect = window.get_frame_rect();
    const resizedRect = {
      x: currentRect.x - startingRect.x,
      y: currentRect.y - startingRect.y,
      width: currentRect.width - startingRect.width,
      height: currentRect.height - startingRect.height
    };
    windowsToResize.forEach(
      ([otherWindow, otherWindowRect, verticalSide, horizontalSide]) => {
        const isSameVerticalSide = verticalSide !== -1 && verticalSide === resizeVerticalSide;
        const isSameHorizontalSide = horizontalSide !== -1 && horizontalSide === resizeHorizontalSide;
        const rect = [
          otherWindowRect.x,
          otherWindowRect.y,
          otherWindowRect.width,
          otherWindowRect.height
        ];
        if (horizontalSide === St17.Side.LEFT) {
          rect[2] = otherWindowRect.width - (isSameHorizontalSide ? resizedRect.x : resizedRect.width);
          rect[0] = otherWindowRect.x + (isSameHorizontalSide ? resizedRect.x : resizedRect.width);
        } else if (horizontalSide === St17.Side.RIGHT) {
          rect[2] = otherWindowRect.width + (isSameHorizontalSide ? resizedRect.width : resizedRect.x);
        }
        if (verticalSide === St17.Side.TOP) {
          rect[3] = otherWindowRect.height - (isSameVerticalSide ? resizedRect.y : resizedRect.height);
          rect[1] = otherWindowRect.y + (isSameVerticalSide ? resizedRect.y : resizedRect.height);
        } else if (verticalSide === St17.Side.BOTTOM) {
          rect[3] = otherWindowRect.height + (isSameVerticalSide ? resizedRect.height : resizedRect.y);
        }
        otherWindow.move_resize_frame(
          false,
          Math.max(0, rect[0]),
          Math.max(0, rect[1]),
          Math.max(0, rect[2]),
          Math.max(0, rect[3])
        );
      }
    );
  }
};

// src/components/snapassist/snapAssistTileButton.ts
import St18 from "gi://St";
var SnapAssistTileButton = class extends SnapAssistTile {
  _btn;
  constructor(params) {
    super(params);
    this._btn = new St18.Button({
      xExpand: true,
      yExpand: true,
      trackHover: true
    });
    this.add_child(this._btn);
    this._btn.set_size(this.innerWidth, this.innerHeight);
    this._btn.connect(
      "notify::hover",
      () => this.set_hover(this._btn.hover)
    );
  }
  get tile() {
    return this._tile;
  }
  get checked() {
    return this._btn.checked;
  }
  set_checked(newVal) {
    this._btn.set_checked(newVal);
  }
  connect(signal, callback) {
    if (signal === "clicked")
      return this._btn.connect(signal, callback);
    return super.connect(signal, callback);
  }
};
SnapAssistTileButton = __decorateClass([
  registerGObjectClass
], SnapAssistTileButton);

// src/components/window_menu/layoutTileButtons.ts
import Clutter19 from "gi://Clutter";
var LayoutTileButtons = class extends LayoutWidget {
  constructor(parent, layout, gapSize, height, width) {
    super({
      parent,
      layout,
      containerRect: buildRectangle(),
      innerGaps: buildMarginOf(gapSize),
      outerGaps: new Clutter19.Margin(),
      styleClass: "window-menu-layout"
    });
    const [, scalingFactor] = getScalingFactorOf(this);
    this.relayout({
      containerRect: buildRectangle({
        x: 0,
        y: 0,
        width: width * scalingFactor,
        height: height * scalingFactor
      })
    });
    this._fixFloatingPointErrors();
  }
  buildTile(parent, rect, gaps, tile) {
    return new SnapAssistTileButton({ parent, rect, gaps, tile });
  }
  get buttons() {
    return this._previews;
  }
  _fixFloatingPointErrors() {
    const xMap = /* @__PURE__ */ new Map();
    const yMap = /* @__PURE__ */ new Map();
    this._previews.forEach((prev) => {
      const tile = prev.tile;
      const newX = xMap.get(tile.x);
      if (!newX)
        xMap.set(tile.x, prev.rect.x);
      const newY = yMap.get(tile.y);
      if (!newY)
        yMap.set(tile.y, prev.rect.y);
      if (newX || newY) {
        prev.open(
          false,
          buildRectangle({
            x: newX ?? prev.rect.x,
            y: newY ?? prev.rect.y,
            width: prev.rect.width,
            height: prev.rect.height
          })
        );
      }
      xMap.set(
        tile.x + tile.width,
        xMap.get(tile.x + tile.width) ?? prev.rect.x + prev.rect.width
      );
      yMap.set(
        tile.y + tile.height,
        yMap.get(tile.y + tile.height) ?? prev.rect.y + prev.rect.height
      );
    });
  }
};
LayoutTileButtons = __decorateClass([
  registerGObjectClass
], LayoutTileButtons);

// src/components/window_menu/layoutIcon.ts
var LayoutIcon = class extends LayoutWidget {
  constructor(parent, importantTiles, tiles, innerGaps, outerGaps, width, height) {
    super({
      parent,
      layout: new Layout(tiles, ""),
      innerGaps: innerGaps.copy(),
      outerGaps: outerGaps.copy(),
      containerRect: buildRectangle(),
      styleClass: "layout-icon button"
    });
    const [, scalingFactor] = getScalingFactorOf(this);
    width *= scalingFactor;
    height *= scalingFactor;
    super.relayout({
      containerRect: buildRectangle({ x: 0, y: 0, width, height })
    });
    this.set_size(width, height);
    this.set_x_expand(false);
    this.set_y_expand(false);
    importantTiles.forEach((t) => {
      const preview = this._previews.find(
        (snap) => snap.tile.x === t.x && snap.tile.y === t.y
      );
      if (preview)
        preview.add_style_class_name("important");
    });
  }
  buildTile(parent, rect, gaps, tile) {
    return new SnapAssistTile({ parent, rect, gaps, tile });
  }
};
LayoutIcon = __decorateClass([
  registerGObjectClass
], LayoutIcon);

// src/components/window_menu/overriddenWindowMenu.ts
import * as windowMenu from "resource:///org/gnome/shell/ui/windowMenu.js";
import * as PopupMenu4 from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main9 from "resource:///org/gnome/shell/ui/main.js";
import St19 from "gi://St";
import Meta11 from "gi://Meta";
import Clutter21 from "gi://Clutter";
import GObject13 from "gi://GObject";
var LAYOUT_ICON_WIDTH = 46;
var LAYOUT_ICON_HEIGHT = 32;
function buildMenuWithLayoutIcon(title, popupMenu, importantTiles, tiles, innerGaps) {
  popupMenu.add_child(
    new St19.Label({
      text: title,
      yAlign: Clutter21.ActorAlign.CENTER,
      xExpand: true
    })
  );
  const layoutIcon = new LayoutIcon(
    popupMenu,
    importantTiles,
    tiles,
    buildMarginOf(innerGaps),
    buildMarginOf(4),
    LAYOUT_ICON_WIDTH,
    LAYOUT_ICON_HEIGHT
  );
  layoutIcon.set_x_align(Clutter21.ActorAlign.END);
}
var OverriddenWindowMenu = class extends GObject13.Object {
  static get() {
    if (this._instance === null)
      this._instance = new OverriddenWindowMenu();
    return this._instance;
  }
  static enable() {
    if (this._enabled)
      return;
    const owm = this.get();
    OverriddenWindowMenu._old_buildMenu = windowMenu.WindowMenu.prototype._buildMenu;
    windowMenu.WindowMenu.prototype._buildMenu = owm.newBuildMenu;
    this._enabled = true;
  }
  static disable() {
    if (!this._enabled)
      return;
    windowMenu.WindowMenu.prototype._buildMenu = OverriddenWindowMenu._old_buildMenu;
    this._old_buildMenu = null;
    this._enabled = false;
  }
  static destroy() {
    this.disable();
    this._instance = null;
  }
  // the function will be treated as a method of class WindowMenu
  newBuildMenu(window) {
    const oldFunction = OverriddenWindowMenu._old_buildMenu?.bind(this);
    if (oldFunction)
      oldFunction(window);
    const layouts = GlobalState.get().layouts;
    if (layouts.length === 0)
      return;
    const workArea = Main9.layoutManager.getWorkAreaForMonitor(
      window.get_monitor()
    );
    const tiledWindows = getWindows().map((otherWindow) => {
      return otherWindow && !otherWindow.minimized && otherWindow.assignedTile ? otherWindow : void 0;
    }).filter((w) => w !== void 0);
    const tiles = GlobalState.get().getSelectedLayoutOfMonitor(
      window.get_monitor()
    ).tiles;
    const vacantTiles = tiles.filter((t) => {
      const tileRect = TileUtils.apply_props(t, workArea);
      return !tiledWindows.find(
        (win) => tileRect.overlap(win.get_frame_rect())
      );
    });
    const enableScaling = window.get_monitor() === Main9.layoutManager.primaryIndex;
    const scalingFactor = getMonitorScalingFactor(window.get_monitor());
    const gaps = Settings.get_inner_gaps(1).top > 0 ? 2 : 0;
    if (vacantTiles.length > 0) {
      vacantTiles.sort((a, b) => a.x - b.x);
      let bestTileIndex = 0;
      let bestDistance = Math.abs(
        0.5 - vacantTiles[bestTileIndex].x + vacantTiles[bestTileIndex].width / 2
      );
      for (let index = 1; index < vacantTiles.length; index++) {
        const distance = Math.abs(
          0.5 - (vacantTiles[index].x + vacantTiles[index].width / 2)
        );
        if (bestDistance > distance) {
          bestTileIndex = index;
          bestDistance = distance;
        }
      }
      this.addMenuItem(new PopupMenu4.PopupSeparatorMenuItem());
      const vacantPopupMenu = new PopupMenu4.PopupBaseMenuItem();
      this.addMenuItem(vacantPopupMenu);
      if (enableScaling)
        enableScalingFactorSupport(vacantPopupMenu, scalingFactor);
      buildMenuWithLayoutIcon(
        "Move to best tile",
        vacantPopupMenu,
        [vacantTiles[bestTileIndex]],
        tiles,
        gaps
      );
      vacantPopupMenu.connect("activate", () => {
        OverriddenWindowMenu.get().emit(
          "tile-clicked",
          vacantTiles[bestTileIndex],
          window
        );
      });
    }
    if (vacantTiles.length > 1) {
      const vacantLeftPopupMenu = new PopupMenu4.PopupBaseMenuItem();
      this.addMenuItem(vacantLeftPopupMenu);
      if (enableScaling)
        enableScalingFactorSupport(vacantLeftPopupMenu, scalingFactor);
      buildMenuWithLayoutIcon(
        "Move to leftmost tile",
        vacantLeftPopupMenu,
        [vacantTiles[0]],
        tiles,
        gaps
      );
      vacantLeftPopupMenu.connect("activate", () => {
        OverriddenWindowMenu.get().emit(
          "tile-clicked",
          vacantTiles[0],
          window
        );
      });
      const tilesFromRightToLeft = vacantTiles.slice(0).sort((a, b) => b.x === a.x ? a.y - b.y : b.x - a.x);
      const vacantRightPopupMenu = new PopupMenu4.PopupBaseMenuItem();
      this.addMenuItem(vacantRightPopupMenu);
      if (enableScaling)
        enableScalingFactorSupport(vacantRightPopupMenu, scalingFactor);
      buildMenuWithLayoutIcon(
        "Move to rightmost tile",
        vacantRightPopupMenu,
        [tilesFromRightToLeft[0]],
        tiles,
        gaps
      );
      vacantRightPopupMenu.connect("activate", () => {
        OverriddenWindowMenu.get().emit(
          "tile-clicked",
          tilesFromRightToLeft[0],
          window
        );
      });
    }
    this.addMenuItem(new PopupMenu4.PopupSeparatorMenuItem());
    const layoutsPopupMenu = new PopupMenu4.PopupBaseMenuItem();
    this.addMenuItem(layoutsPopupMenu);
    const container = new St19.BoxLayout({
      xAlign: Clutter21.ActorAlign.START,
      yAlign: Clutter21.ActorAlign.CENTER,
      xExpand: true,
      yExpand: true,
      vertical: true,
      style: "spacing: 16px !important"
    });
    layoutsPopupMenu.add_child(container);
    const layoutsPerRow = 4;
    const rows = [];
    for (let index = 0; index < layouts.length; index += layoutsPerRow) {
      const box = new St19.BoxLayout({
        xAlign: Clutter21.ActorAlign.CENTER,
        yAlign: Clutter21.ActorAlign.CENTER,
        xExpand: true,
        yExpand: true,
        style: "spacing: 6px;"
      });
      rows.push(box);
      container.add_child(box);
    }
    if (enableScaling)
      enableScalingFactorSupport(layoutsPopupMenu, scalingFactor);
    const layoutHeight = 30;
    const layoutWidth = 52;
    layouts.forEach((lay, ind) => {
      const row = rows[Math.floor(ind / layoutsPerRow)];
      const layoutWidget = new LayoutTileButtons(
        row,
        lay,
        gaps,
        layoutHeight,
        layoutWidth
      );
      layoutWidget.set_x_align(Clutter21.ActorAlign.END);
      layoutWidget.buttons.forEach((btn) => {
        btn.connect("clicked", () => {
          OverriddenWindowMenu.get().emit(
            "tile-clicked",
            btn.tile,
            window
          );
          layoutsPopupMenu.activate(Clutter21.get_current_event());
        });
      });
    });
  }
  static connect(key, func) {
    return this.get().connect(key, func) || -1;
  }
  static disconnect(id) {
    this.get().disconnect(id);
  }
};
__publicField(OverriddenWindowMenu, "metaInfo", {
  GTypeName: "OverriddenWindowMenu",
  Signals: {
    "tile-clicked": {
      param_types: [Tile2.$gtype, Meta11.Window.$gtype]
    }
  }
});
__publicField(OverriddenWindowMenu, "_instance", null);
__publicField(OverriddenWindowMenu, "_old_buildMenu");
__publicField(OverriddenWindowMenu, "_enabled", false);
OverriddenWindowMenu = __decorateClass([
  registerGObjectClass
], OverriddenWindowMenu);

// src/extension.ts
import * as Main10 from "resource:///org/gnome/shell/ui/main.js";
import Gio11 from "gi://Gio";
import GLib5 from "gi://GLib";
import Meta12 from "gi://Meta";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
var debug4 = logger("extension");
var TilingShellExtension = class extends Extension {
  _indicator;
  _tilingManagers;
  _fractionalScalingEnabled;
  _dbus;
  _signals;
  _keybindings;
  _resizingManager;
  constructor(metadata) {
    super(metadata);
    this._signals = null;
    this._fractionalScalingEnabled = false;
    this._tilingManagers = [];
    this._indicator = null;
    this._dbus = null;
    this._keybindings = null;
    this._resizingManager = null;
  }
  createIndicator() {
    this._indicator = new Indicator3(this.path, this.uuid);
    this._indicator.enableScaling = !this._fractionalScalingEnabled;
    this._indicator.enable();
  }
  _validateSettings() {
    if (this.metadata["version-name"]) {
      Settings.set_last_version_installed(
        this.metadata["version-name"] || "0"
      );
    }
    const selectedLayouts = Settings.get_selected_layouts();
    const monitors = getMonitors();
    const layouts = GlobalState.get().layouts;
    if (selectedLayouts.length === 0)
      selectedLayouts.push(layouts[0].id);
    while (monitors.length < selectedLayouts.length)
      selectedLayouts.pop();
    while (monitors.length > selectedLayouts.length)
      selectedLayouts.push(selectedLayouts[0]);
    for (let i = 0; i < selectedLayouts.length; i++) {
      if (layouts.findIndex((lay) => lay.id === selectedLayouts[i]) === -1)
        selectedLayouts[i] = selectedLayouts[0];
    }
    Settings.save_selected_layouts_json(selectedLayouts);
  }
  enable() {
    if (this._signals)
      this._signals.disconnect();
    this._signals = new SignalHandling();
    Settings.initialize(this.getSettings());
    this._validateSettings();
    this._fractionalScalingEnabled = this._isFractionalScalingEnabled(
      new Gio11.Settings({ schema: "org.gnome.mutter" })
    );
    if (this._keybindings)
      this._keybindings.destroy();
    this._keybindings = new KeyBindings(this.getSettings());
    if (Settings.get_active_screen_edges()) {
      SettingsOverride.get().override(
        new Gio11.Settings({ schema_id: "org.gnome.mutter" }),
        "edge-tiling",
        new GLib5.Variant("b", false)
      );
    }
    if (Main10.layoutManager._startingUp) {
      this._signals.connect(
        Main10.layoutManager,
        "startup-complete",
        () => {
          this._createTilingManagers();
          this._setupSignals();
        }
      );
    } else {
      this._createTilingManagers();
      this._setupSignals();
    }
    this._resizingManager = new ResizingManager();
    this._resizingManager.enable();
    this.createIndicator();
    if (this._dbus)
      this._dbus.disable();
    this._dbus = new DBus();
    this._dbus.enable(this);
    if (Settings.get_override_window_menu())
      OverriddenWindowMenu.enable();
    debug4("extension is enabled");
  }
  openLayoutEditor() {
    this._indicator?.openLayoutEditor();
  }
  _createTilingManagers() {
    debug4("building a tiling manager for each monitor");
    this._tilingManagers.forEach((tm) => tm.destroy());
    this._tilingManagers = getMonitors().map(
      (monitor) => new TilingManager(monitor, !this._fractionalScalingEnabled)
    );
    this._tilingManagers.forEach((tm) => tm.enable());
  }
  _setupSignals() {
    if (!this._signals)
      return;
    this._signals.connect(global.display, "workareas-changed", () => {
      const allMonitors = getMonitors();
      if (this._tilingManagers.length !== allMonitors.length) {
        const oldIndexes = Settings.get_selected_layouts();
        const indexes = allMonitors.map((monitor) => {
          if (monitor.index >= oldIndexes.length)
            return GlobalState.get().layouts[0].id;
          return oldIndexes[monitor.index];
        });
        Settings.save_selected_layouts_json(indexes);
      }
      this._createTilingManagers();
    });
    this._signals.connect(
      new Gio11.Settings({ schema: "org.gnome.mutter" }),
      "changed::experimental-features",
      (_mutterSettings) => {
        if (!_mutterSettings)
          return;
        const fractionalScalingEnabled = this._isFractionalScalingEnabled(_mutterSettings);
        if (this._fractionalScalingEnabled === fractionalScalingEnabled)
          return;
        this._fractionalScalingEnabled = fractionalScalingEnabled;
        this._createTilingManagers();
        if (this._indicator) {
          this._indicator.enableScaling = !this._fractionalScalingEnabled;
        }
      }
    );
    if (this._keybindings) {
      this._signals.connect(
        this._keybindings,
        "move-window",
        this._onKeyboardMoveWin.bind(this)
      );
    }
    this._signals.connect(
      Settings,
      Settings.SETTING_ACTIVE_SCREEN_EDGES,
      () => {
        const nativeIsActive = !Settings.get_active_screen_edges();
        SettingsOverride.get().override(
          new Gio11.Settings({ schema_id: "org.gnome.mutter" }),
          "edge-tiling",
          new GLib5.Variant("b", nativeIsActive)
        );
      }
    );
    this._signals.connect(
      Settings,
      Settings.SETTING_OVERRIDE_WINDOW_MENU,
      () => {
        if (Settings.get_override_window_menu())
          OverriddenWindowMenu.enable();
        else
          OverriddenWindowMenu.disable();
      }
    );
    this._signals.connect(
      OverriddenWindowMenu,
      "tile-clicked",
      (_, tile, window) => {
        const monitorIndex = window.get_monitor();
        const manager = this._tilingManagers[monitorIndex];
        if (manager)
          manager.onTileFromWindowMenu(tile, window);
      }
    );
  }
  _onKeyboardMoveWin(kb, display, direction) {
    const focus_window = display.get_focus_window();
    if (!focus_window || !focus_window.has_focus() || focus_window.get_wm_class() && focus_window.get_wm_class() === "gjs")
      return;
    if (focus_window.get_maximized() && direction === Meta12.DisplayDirection.DOWN) {
      focus_window.unmaximize(Meta12.MaximizeFlags.BOTH);
      return;
    }
    const monitorTilingManager = this._tilingManagers[focus_window.get_monitor()];
    if (!monitorTilingManager)
      return;
    const success = monitorTilingManager.onKeyboardMoveWindow(
      focus_window,
      direction
    );
    if (success)
      return;
    const neighborMonitorIndex = display.get_monitor_neighbor_index(
      focus_window.get_monitor(),
      direction
    );
    if (focus_window.get_maximized() && direction === Meta12.DisplayDirection.UP) {
      Main10.wm.skipNextEffect(focus_window.get_compositor_private());
      focus_window.unmaximize(Meta12.MaximizeFlags.BOTH);
    }
    const neighborTilingManager = this._tilingManagers[neighborMonitorIndex];
    if (!neighborTilingManager)
      return;
    neighborTilingManager.onKeyboardMoveWindow(
      focus_window,
      direction,
      true
    );
  }
  _isFractionalScalingEnabled(_mutterSettings) {
    return _mutterSettings.get_strv("experimental-features").find(
      (feat) => feat === "scale-monitor-framebuffer" || feat === "x11-randr-fractional-scaling"
    ) !== void 0;
  }
  disable() {
    this._keybindings?.destroy();
    this._keybindings = null;
    this._indicator?.destroy();
    this._indicator = null;
    this._tilingManagers.forEach((tm) => tm.destroy());
    this._tilingManagers = [];
    this._signals?.disconnect();
    this._signals = null;
    this._resizingManager?.destroy();
    this._resizingManager = null;
    this._dbus?.disable();
    this._dbus = null;
    GlobalState.destroy();
    Settings.destroy();
    SettingsOverride.get().restoreKey(
      new Gio11.Settings({ schema_id: "org.gnome.mutter" }),
      "edge-tiling"
    );
    this._fractionalScalingEnabled = false;
    OverriddenWindowMenu.destroy();
    debug4("extension is disabled");
  }
};
export {
  TilingShellExtension as default
};
