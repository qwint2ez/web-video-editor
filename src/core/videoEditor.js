import { AudioOverlay } from './audioOverlay.js';
import { FilterApplier } from './filterApplier.js';
import { TextOverlay } from './textOverlay.js';
import { VideoLoader } from './videoLoader.js';
import { VideoMerger } from './videoMerger.js';
import { VideoTrimmer } from './videoTrimmer.js';
import { TimelineManager } from './timelineManager.js';

export class VideoEditor {
    constructor(dependencies) {
        if (!dependencies.videoElement || !dependencies.debugElement) {
            throw new Error('Required dependencies are missing');
        }
        
        this.dependencies = dependencies;
        this.initializeDependencies();
    }

    initializeDependencies() {
        try {
            this.processors = {
                loader: new VideoLoader(this.dependencies),
                audio: new AudioOverlay(this.dependencies),
                filter: new FilterApplier(this.dependencies),
                text: new TextOverlay({
                    ...this.dependencies,
                    textElement: this.dependencies.textElement || this.createTextOverlay()
                }),
                merger: new VideoMerger(this.dependencies),
                trimmer: new VideoTrimmer(this.dependencies)
            };
        } catch (error) {
            throw new Error(`Failed to initialize: ${error.message}`);
        }
    }

    createTextOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'textOverlay';
        overlay.style.position = 'absolute';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '1';
        this.dependencies.videoElement.parentElement?.appendChild(overlay);
        return overlay;
    }

    async loadVideos(files, audioFile = null) {
        this.currentVideoFiles = Array.from(files);
        this.timeline = new TimelineManager();
        
        for (const file of this.currentVideoFiles) {
            this.timeline.addVideo(file);
        }
        
        await this.timeline.loadDurations();
        
        if (this.currentVideoFiles.length === 1) {
            await this.processors.loader.process({ file: this.currentVideoFiles[0] });
        } else if (this.currentVideoFiles.length > 1) {
            await this.processors.merger.process({ videoFiles: this.currentVideoFiles });
        }

        if (audioFile) {
            await this.processors.audio.process({ file: audioFile });
        }
    }

    applyAudio() {
        this.processors.audio.process({});
    }

    applyFilter(filter) {
        this.processors.filter.process({ filter });
    }

    applyText(text, position, color, size) {
        this.processors.text.process({ text, position, color, size });
    }

    applyTrim(startTime, endTime) {
        this.processors.trimmer.process({ startTime, endTime });
    }

    getCurrentTime() {
        return this.processors.trimmer.isTrimmedState
            ? this.processors.trimmer.videoElement.currentTime - this.processors.trimmer.startTimeValue
            : this.processors.merger.getCurrentTime();
    }

    seekTo(time) {
        const newTime = this.processors.trimmer.isTrimmedState
            ? this.processors.trimmer.startTimeValue + time
            : this.processors.merger.seekTo(time);
        this.processors.trimmer.videoElement.currentTime = newTime;
    }

    formatTime(seconds) {
        return this.timeline.formatTime(seconds);
    }
}