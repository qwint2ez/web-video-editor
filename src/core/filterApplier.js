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
        
        // For CSS filters like 'grayscale(100%)', applying them directly to canvas
        // requires manual pixel manipulation for most filters.
        // HTML5 Canvas filter property is simpler if available and sufficient.
        if (ctx.filter !== undefined) {
            // Modern browsers support ctx.filter
            try {
                ctx.filter = this.cssFilters[this.currentFilter];
                // Draw the image again to apply the filter, or if image is already there, this might not be needed
                // depending on how canvas updates.
                // A common pattern is: save state, set filter, draw, restore state.
                // However, if we are just setting a persistent filter on the context for subsequent draws:
                // This is fine. The caller of applyFilterToCanvas will draw the video frame.
                // For this to work, applyFilterToCanvas should be called *before* ctx.drawImage in the export loop.
                // The current export loop draws, then calls this. This means we need to re-process.

                // To apply filter to already drawn content:
                // 1. Get image data
                // 2. Apply filter manually (complex) OR
                // 3. Draw to an offscreen canvas with filter, then draw back (simpler for CSS-like filters)

                // Simplest approach if ctx.filter is supported and we want to apply to current canvas content:
                // This is tricky because ctx.filter applies to *future* drawing operations.
                // To filter existing content, you'd typically draw the canvas to itself or an intermediate canvas.

                // Let's stick to manual pixel manipulation for broader compatibility and direct effect.
                // The following is a placeholder for actual pixel manipulation if ctx.filter is not used or not sufficient.
                // console.log(`Applying filter ${this.currentFilter} to canvas using ctx.filter if available.`);
            } catch (e) {
                console.warn(`ctx.filter property not fully supported or error applying: ${e.message}. Falling back to manual if implemented.`);
                // Fallback to manual pixel manipulation if ctx.filter fails or is not what we want.
                this.applyManualFilter(ctx, canvas, this.currentFilter);
            }
        } else {
            // Fallback for older browsers or if specific pixel manipulation is needed
            console.warn('ctx.filter is not supported. Falling back to manual filter application.');
            this.applyManualFilter(ctx, canvas, this.currentFilter);
        }
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