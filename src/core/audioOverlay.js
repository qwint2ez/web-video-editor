import { VideoProcessor } from './videoProcessor.js';

export class AudioOverlay extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.audioInput = dependencies.audioInput;
        this.audio = null;
    }

    process(params) {
        if (!this.audioInput || !this.audioInput.files || !this.audioInput.files[0]) {
            this.logError('No audio file selected');
            return;
        }

        const audioFile = this.audioInput.files[0];
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }

        try {
            const audioUrl = URL.createObjectURL(audioFile);
            this.audio = new Audio(audioUrl);
            this.audio.loop = true;

            this.videoElement.addEventListener('play', () => {
                if (this.audio) {
                    this.audio.currentTime = this.videoElement.currentTime;
                    this.audio.play();
                }
            });
            
            this.videoElement.addEventListener('pause', () => {
                if (this.audio) this.audio.pause();
            });

            this.videoElement.addEventListener('seeking', () => {
                if (this.audio) {
                    this.audio.currentTime = this.videoElement.currentTime;
                }
            });

            this.debugElement.textContent = 'Status: Audio overlay applied';
        } catch (error) {
            this.logError('Failed to apply audio overlay');
            console.error(error);
        }
    }
}