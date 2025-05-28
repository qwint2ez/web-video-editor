import { VideoProcessor } from './videoProcessor.js';

export class VideoLoader extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.inputElement = dependencies.inputElement;
        this.endInput = dependencies.endInput;
        this.startInput = dependencies.startInput;
        
        if (this.inputElement) {
            this.bindEvents();
        }
    }

    process(params) {
        const { file } = params;
        if (!file) {
            this.logError('File is not selected');
            return;
        }

        const videoURL = URL.createObjectURL(file);
        if (this.videoElement) {
            this.videoElement.src = videoURL;
            this.videoElement.onloadedmetadata = () => {
                if (this.endInput && this.startInput) {
                    this.endInput.max = this.videoElement.duration;
                    this.endInput.value = this.videoElement.duration;
                    this.startInput.value = '0';
                }
                this.debugElement.textContent = `Status: Video loaded, duration ${this.videoElement.duration} sec`;
            };
            this.videoElement.onerror = () => {
                this.debugElement.textContent = 'Status: Error loading video!';
            };
        }
    }

    bindEvents() {
        this.inputElement.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) {
                this.debugElement.textContent = 'Status: Loading video...';
                this.process({ file });
            }
        });
    }
}