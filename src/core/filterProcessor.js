import { VideoProcessor } from './videoProcessor.js';

export class FilterProcessor extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.currentFilter = '';
    }

    process(params) {
        const { filter } = params;
        this.currentFilter = filter;
        
        if (!this.videoElement) {
            this.logError('Video element not found');
            return;
        }

        this.applyFilter(filter);
    }

    applyFilter(filter) {
        let filterValue = '';
        
        switch (filter) {
            case 'grayscale':
                filterValue = 'grayscale(100%)';
                break;
            case 'sepia':
                filterValue = 'sepia(100%)';
                break;
            case 'invert':
                filterValue = 'invert(100%)';
                break;
            default:
                filterValue = '';
                this.currentFilter = '';
                break;
        }
        
        this.videoElement.style.filter = filterValue;
        
        if (filter) {
            this.debugElement.textContent = `Status: ${filter} filter applied`;
        } else {
            this.debugElement.textContent = 'Status: Filter removed';
        }
    }

    clearFilter() {
        this.currentFilter = '';
        this.videoElement.style.filter = '';
        this.debugElement.textContent = 'Status: All filters cleared';
    }
}
