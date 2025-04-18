import { AudioOverlay } from './audioOverlay.js';
import { FilterApplier } from './filterApplier.js';
import { TextOverlay } from './textOverlay.js';
import { VideoLoader } from './videoLoader.js';
import { VideoMerger } from './videoMerger.js';
import { VideoTrimmer } from './videoTrimmer.js';

export class VideoEditor {
    constructor(dependencies) {
        this.processors = {
            audio: new AudioOverlay(dependencies),
            filter: new FilterApplier(dependencies),
            text: new TextOverlay(dependencies),
            loader: new VideoLoader(dependencies),
            merger: new VideoMerger(dependencies),
            trimmer: new VideoTrimmer(dependencies),
        };
        this.currentVideoFiles = [];
    }

    loadVideos(files) {
        this.currentVideoFiles = Array.from(files);
        if (this.currentVideoFiles.length === 1) {
            this.processors.loader.process({ file: this.currentVideoFiles[0] });
        } else if (this.currentVideoFiles.length > 1) {
            this.processors.merger.process({ videoFiles: this.currentVideoFiles });
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
}