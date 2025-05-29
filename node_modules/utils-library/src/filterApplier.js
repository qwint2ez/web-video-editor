import { VideoProcessor } from './videoProcessor.js';

export class FilterApplier extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.currentFilter = ''; // Keep track of the current filter string
        // CSS filter values mapping
        this.cssFilters = {
            grayscale: 'grayscale(100%)',
            sepia: 'sepia(100%)',
            invert: 'invert(100%)',
            brightness: 'brightness(150%)',
            contrast: 'contrast(150%)',
            blur: 'blur(2px)'
        };
    }

    process(params) {
        const { filter } = params; // filter is the name like 'grayscale'
        this.currentFilter = filter; // Store the name of the filter
        
        if (this.videoElement) {
            if (filter && this.cssFilters[filter]) {
                this.videoElement.style.filter = this.cssFilters[filter];
                this.debugElement.textContent = `Status: ${filter} filter applied`;
                console.log(`Filter applied to video element: ${filter}`);
            } else {
                this.videoElement.style.filter = '';
                this.currentFilter = ''; // Clear current filter if none or invalid
                this.debugElement.textContent = 'Status: Filter removed';
                console.log('Filter removed from video element');
            }
        } else {
            this.logError('Video element not found for applying filter style.');
        }
    }

    getFilterCSS(filterName) {
        return this.cssFilters[filterName] || '';
    }

    // Method to apply filters to a canvas context (for export)
    applyFilterToCanvas(ctx, canvas) {
        if (!this.currentFilter || !this.cssFilters[this.currentFilter] || !ctx || !canvas) {
            // If no current filter or filter is not in our list, or no context/canvas, do nothing
            return;
        }
        
        // Consistently use manual filter application for predictable results post-drawImage in exporter.
        // This modifies the pixels of the image already drawn onto the canvas.
        this.applyManualFilter(ctx, canvas, this.currentFilter);
    }

    applyManualFilter(ctx, canvas, filterName) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        switch (filterName) {
            case 'grayscale':
                for (let i = 0; i < data.length; i += 4) {
                    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    data[i] = data[i + 1] = data[i + 2] = gray; // r, g, b
                }
                break;
            case 'sepia':
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2];
                    data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
                    data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
                    data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
                }
                break;
            case 'invert':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = 255 - data[i];         // r
                    data[i + 1] = 255 - data[i + 1]; // g
                    data[i + 2] = 255 - data[i + 2]; // b
                }
                break;
            // Add more manual filters if needed (brightness, contrast, blur are more complex)
            default:
                console.warn(`Manual filter for ${filterName} is not implemented.`);
                return; // No change if filter not implemented manually
        }
        ctx.putImageData(imageData, 0, 0);
    }


    registerFilter(name, filterFunction) {
        // This method seems to be for a different pattern (functional filters)
        // For now, we use the cssFilters map.
        // this.filters[name] = filterFunction;
        console.warn("registerFilter is not fully utilized in current FilterApplier setup.");
    }
}