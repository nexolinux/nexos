/** Bounds of rounded corners  */
export class Bounds {
    x1 = 0;
    y1 = 0;
    x2 = 0;
    y2 = 0;
}
export class Padding {
    left = 0;
    right = 0;
    top = 0;
    bottom = 0;
}
export const box_shadow_css = (box_shadow, scale = 1) => {
    return `box-shadow: ${box_shadow.horizontal_offset * scale}px
          ${box_shadow.vertical_offset * scale}px
          ${box_shadow.blur_offset * scale}px
          ${box_shadow.spread_radius * scale}px
          rgba(0,0,0, ${box_shadow.opacity / 100})`;
};
