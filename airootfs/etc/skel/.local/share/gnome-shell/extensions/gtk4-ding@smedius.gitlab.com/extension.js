import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {DingManager} from './dingManager.js';

export default class DingExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this.dingManager = new DingManager(this.path, metadata['version-name'], metadata['uuid']);
        this.DesktopIconsUsableArea = null;
    }

    enable() {
        this.dingManager.enable();
        this.DesktopIconsUsableArea = this.dingManager.DesktopIconsUsableArea;
    }

    disable() {
        this.dingManager?.disable();
        this.DesktopIconsUsableArea = null;
    }
}
