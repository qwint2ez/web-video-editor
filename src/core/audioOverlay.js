import { VideoProcessor } from './videoProcessor.js';

export class AudioOverlay extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.audioInput = dependencies.audioInput;
        this.audio = null;
    }

    process(params) {
        const audioFile = this.audioInput.files[0];
        if (!audioFile) {
            this.logError('Select an audio file');
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