import { VideoProcessor } from './videoProcessor.js';

export class AudioOverlay extends VideoProcessor {
    constructor(videoElement, audioInput, debugElement) {
        super(videoElement, debugElement);
        this.audioInput = audioInput;
        this.audio = null;
    }

    process() {
        const audioFile = this.audioInput.files[0];
        if (!audioFile) {
            this.debugElement.textContent = 'Status: Error! Select an audio file';
            throw new Error('Select an audio file');
        }

        if (this.audio) {
            this.audio.pause();
        }

        this.audio = new Audio(URL.createObjectURL(audioFile));
        this.audio.loop = true;

        this.videoElement.addEventListener('play', () => this.audio.play());
        this.videoElement.addEventListener('pause', () => this.audio.pause());
        this.videoElement.addEventListener('seeked', () => {
            if (this.audio) {
                this.audio.currentTime = this.videoElement.currentTime;
            }
        });

        this.debugElement.textContent = 'Status: Audio applied';
    }
}