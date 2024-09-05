import { BlackList } from '../preferences/pages/blacklist.js';
import { Custom } from '../preferences/pages/custom.js';
import { General } from '../preferences/pages/general.js';
export const pages = () => [
    new General(),
    new BlackList(),
    new Custom(),
];
