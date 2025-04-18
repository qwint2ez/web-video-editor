import { VideoProcessor } from './videoProcessor.js';

export class FilterApplier extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.filters = {
            grayscale: () => 'grayscale(100%)',
            sepia: () => 'sepia(100%)',
            invert: () => 'invert(100%)',
        };
    }

    process(params) {
        const { filter } = params;
        if (!filter || !this.filters[filter]) {
            this.logError('Select a valid filter');
        }

        this.videoElement.style.filter = this.filters[filter]();
        this.debugElement.textContent = `Status: Applied filter ${filter}`;
    }

    registerFilter(name, filterFunction) {
        this.filters[name] = filterFunction;
    }
}