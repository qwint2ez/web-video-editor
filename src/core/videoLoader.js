import { VideoProcessor } from './videoProcessor.js';

export class VideoLoader extends VideoProcessor {
    constructor(inputElement, videoElement, debugElement) {
        super(videoElement, debugElement);
        this.inputElement = inputElement;
        this.bindEvents();
    }

    process() {
        // Метод не используется напрямую, вся логика в bindEvents
    }

    bindEvents() {
        this.inputElement.addEventListener('change', (e) => {
            this.debugElement.textContent = 'Status: Loading video...';
            const file = e.target.files[0];
            if (file) {
                const videoURL = URL.createObjectURL(file);
                this.videoElement.src = videoURL;
                this.videoElement.onloadedmetadata = () => {
                    this.debugElement.textContent = `Status: Video loaded, duration ${this.videoElement.duration} sec`;
                    const endInput = document.getElementById('end');
                    endInput.max = this.videoElement.duration;
                    endInput.value = this.videoElement.duration;
                    document.getElementById('start').value = 0;
                };
                this.videoElement.onerror = () => {
                    this.debugElement.textContent = 'Status: Error loading video!';
                };
            } else {
                this.debugElement.textContent = 'Status: File is not selected!';
            }
        });
    }
}