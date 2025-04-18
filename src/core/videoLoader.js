import { VideoProcessor } from './videoProcessor.js';

export class VideoLoader extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.inputElement = dependencies.inputElement;
        this.endInput = dependencies.endInput;
        this.startInput = dependencies.startInput;
        this.bindEvents();
    }

    process(params) {
        const { file } = params;
        if (!file) {
            this.logError('File is not selected');
        }

        const videoURL = URL.createObjectURL(file);
        this.videoElement.src = videoURL;
        this.videoElement.onloadedmetadata = () => {
            this.debugElement.textContent = `Status: Video loaded, duration ${this.videoElement.duration} sec`;
            this.endInput.max = this.videoElement.duration;
            this.endInput.value = this.videoElement.duration;
            this.startInput.value = '0';
        };
        this.videoElement.onerror = () => {
            this.debugElement.textContent = 'Status: Error loading video!';
        };
    }

    bindEvents() {
        this.inputElement.addEventListener('change', (e) => {
            this.debugElement.textContent = 'Status: Loading video...';
            const file = e.target.files[0];
            this.process({ file });
        });
    }
}