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
        this.currentFilter = filter;
        
        if (filter) {
            this.videoElement.style.filter = this.getFilterCSS(filter);
            this.debugElement.textContent = `Status: ${filter} filter applied`;
            console.log(`Filter applied: ${filter}`);
        } else {
            this.videoElement.style.filter = '';
            this.debugElement.textContent = 'Status: Filter removed';
            console.log('Filter removed');
        }
    }

    getFilterCSS(filterName) {
        const filters = {
            'grayscale': 'grayscale(100%)',
            'sepia': 'sepia(100%)',
            'invert': 'invert(100%)',
            'brightness': 'brightness(150%)',
            'contrast': 'contrast(150%)',
            'blur': 'blur(2px)'
        };
        return filters[filterName] || '';
    }

    registerFilter(name, filterFunction) {
        this.filters[name] = filterFunction;
    }
}