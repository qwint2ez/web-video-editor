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

    // Метод для применения фильтров к canvas (для экспорта)
    applyFilterToCanvas(ctx, canvas) {
        if (!this.currentFilter) return;
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        switch (this.currentFilter) {
            case 'grayscale':
                for (let i = 0; i < data.length; i += 4) {
                    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    data[i] = gray;
                    data[i + 1] = gray;
                    data[i + 2] = gray;
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
                    data[i] = 255 - data[i];
                    data[i + 1] = 255 - data[i + 1];
                    data[i + 2] = 255 - data[i + 2];
                }
                break;
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
}
