import { VideoProcessor } from './videoProcessor.js';
import { MediaInfo } from './mediaInfo.js';
// TimelineUIManager, VideoTrimmer, VideoExporter will be instantiated by VideoEditor and passed if needed,
// or VideoMerger will receive them in its constructor or methods.
// For now, VideoMerger will focus on playback and sequence management.
// UI and export will be handled by VideoEditor orchestrating other classes.

export class VideoMerger extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.videos = [];
        this.durations = [];
        this.totalDuration = 0;
        this.currentIndex = 0;
        this.currentTimeOffset = 0;
        this.isPlaying = false;
        this.audioFile = null;
        this.audioDuration = 0;

        this.mediaInfo = new MediaInfo();
        this.timelineUIManager = dependencies.timelineUIManager; // Injected

        // Bind event handlers that are called by videoElement
        this.handleVideoTimeUpdate = this.handleVideoTimeUpdate.bind(this);
        this.handleVideoEnded = this.handleVideoEnded.bind(this);
        this.bindEvents(); // Bind to the main videoElement
    }

    formatTime(seconds) {
        let numericSeconds = parseFloat(seconds);
        if (!Number.isFinite(numericSeconds) || numericSeconds < 0) numericSeconds = 0;
        const minutes = Math.floor(numericSeconds / 60);
        const secs = Math.floor(numericSeconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    bindEvents() {
        if (this.videoElement) {
            this.videoElement.removeEventListener('timeupdate', this.handleVideoTimeUpdate);
            this.videoElement.removeEventListener('ended', this.handleVideoEnded);
            this.videoElement.addEventListener('timeupdate', this.handleVideoTimeUpdate);
            this.videoElement.addEventListener('ended', this.handleVideoEnded);
        }
    }

    async process(params) {
        const { videoFiles, audioFile } = params;

        if (this.videoElement) this.videoElement.pause();
        this.isPlaying = false;
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) playPauseBtn.textContent = 'Play';

        this.videos = [];
        if (videoFiles && videoFiles.length > 0) {
            this.videos = Array.from(videoFiles).filter(file => file instanceof Blob || file instanceof File);
        }

        this.audioFile = audioFile === null ? null : (audioFile !== undefined ? audioFile : this.audioFile);
        
        this.currentIndex = 0;
        this.currentTimeOffset = 0;

        await this.loadMediaDurations();

        if (this.videos.length > 0) {
            await this.loadVideo(0);
            if (this.processors?.audio) { // processors might be passed via dependencies
                if (this.audioFile) await this.processors.audio.process({ file: this.audioFile });
                else await this.processors.audio.clearAudio();
            }
        } else {
            if (this.videoElement) this.videoElement.src = '';
            if (this.processors?.audio) await this.processors.audio.clearAudio();
        }
        
        if(this.timelineUIManager) {
            this.timelineUIManager.updateTimelineSegments();
            this.timelineUIManager.updateTimeDisplay();
        }
        this.debugElement.textContent = this.videos.length > 0 ? 'Статус: Media loaded successfully' : 'Статус: Timeline cleared';
    }

    async loadMediaDurations() {
        let videoTotalDurationNum = 0;
        const newDurations = [];

        if (this.videos && this.videos.length > 0) {
            for (let i = 0; i < this.videos.length; i++) {
                const videoFile = this.videos[i];
                let duration = 0;
                if (videoFile instanceof Blob || videoFile instanceof File) {
                    if (videoFile._knownDuration !== undefined && Number.isFinite(videoFile._knownDuration) && videoFile._knownDuration >= 0) {
                        duration = videoFile._knownDuration;
                    } else {
                        duration = await this.mediaInfo.getVideoDuration(videoFile);
                    }
                }
                newDurations.push(duration);
                videoTotalDurationNum += duration;
            }
        }
        this.durations = newDurations;

        this.audioDuration = this.audioFile ? await this.mediaInfo.getAudioFileDuration(this.audioFile) : 0;
        
        this.totalDuration = Math.max(videoTotalDurationNum, this.audioDuration);
        if (this.videos.length > 0 && this.totalDuration === 0) this.totalDuration = 0.1;
        if (!Number.isFinite(this.totalDuration) || this.totalDuration < 0) this.totalDuration = 0;
    }

    getCurrentTime() {
        if (this.videoElement && Number.isFinite(this.videoElement.currentTime) && Number.isFinite(this.currentTimeOffset)) {
            return this.currentTimeOffset + this.videoElement.currentTime;
        }
        return this.currentTimeOffset;
    }

    async loadVideo(index) {
        if (!this.videoElement || !this.videos || index < 0 || index >= this.videos.length) {
            if (this.videoElement && (!this.videos || this.videos.length === 0)) {
                this.videoElement.src = '';
                if(this.timelineUIManager) this.timelineUIManager.updateTimeDisplay();
            }
            return Promise.resolve();
        }
        
        this.videoElement.pause();
        this.currentTimeOffset = 0;
        for (let i = 0; i < index; i++) {
            if (this.durations[i] && Number.isFinite(this.durations[i])) {
                this.currentTimeOffset += this.durations[i];
            }
        }

        const videoBlob = this.videos[index];
        if (!videoBlob || !(videoBlob instanceof Blob || videoBlob instanceof File)) {
            this.debugElement.textContent = 'Ошибка: Неверный формат видео';
            return Promise.reject(new Error("Invalid video blob"));
        }
        if (videoBlob.size === 0) {
            this.debugElement.textContent = 'Предупреждение: Видео имеет нулевой размер';
            if(this.timelineUIManager) this.timelineUIManager.updateTimeDisplay();
            return Promise.resolve();
        }

        const videoUrl = URL.createObjectURL(videoBlob);
        this.videoElement.src = videoUrl; // This will revoke previous object URL automatically
        this.currentIndex = index;
        this.videoElement.preload = 'metadata';
        
        return new Promise((resolve) => {
            const onLoadedMeta = () => {
                // No need to revoke here, src change handles it.
                // URL.revokeObjectURL(videoUrl) should be done when the video is no longer needed at all.
                if (this.isPlaying) this.videoElement.play().catch(e => console.warn("Play interrupted on load:", e.name));
                resolve();
            };
            const onError = (e) => {
                // URL.revokeObjectURL(videoUrl);
                this.debugElement.textContent = `Ошибка загрузки видео ${index + 1}`;
                resolve(); // Resolve to not break chain, error is logged
            };
            this.videoElement.onloadedmetadata = onLoadedMeta;
            this.videoElement.onerror = onError;

            // Timeout for loading metadata
            setTimeout(() => {
                if (this.videoElement.readyState < HTMLMediaElement.HAVE_METADATA && this.videoElement.src === videoUrl) {
                     console.warn("Video loading timeout at index", index);
                     onError(); // Simulate error to cleanup and resolve
                }
            }, 5000); // 5 seconds timeout
        });
    }

    handleVideoTimeUpdate() {
        if(this.timelineUIManager) this.timelineUIManager.updateTimeDisplay();
    }

    handleVideoEnded() {
        this.playNext();
    }

    async playNext() {
        if (!this.videos || this.videos.length === 0) return;

        if (this.currentIndex >= this.videos.length - 1) {
            this.currentIndex = 0;
            this.currentTimeOffset = 0;
            await this.loadVideo(0);
            if (this.isPlaying) {
                this.videoElement.pause();
                this.isPlaying = false;
                const playPauseBtn = document.getElementById('playPauseBtn');
                if (playPauseBtn) playPauseBtn.textContent = 'Play';
            }
            return;
        }

        this.currentTimeOffset += Number.isFinite(this.durations[this.currentIndex]) ? this.durations[this.currentIndex] : 0;
        this.currentIndex++;
        await this.loadVideo(this.currentIndex);
    }

    async togglePlay() {
        if (!this.videoElement || ((!this.videoElement.src || this.videoElement.src === window.location.href) && (!this.videos || this.videos.length === 0))) {
            this.isPlaying = false;
            const playPauseBtn = document.getElementById('playPauseBtn');
            if (playPauseBtn) playPauseBtn.textContent = 'Play';
            return;
        }

        const playPauseBtn = document.getElementById('playPauseBtn');
        if (this.videoElement.paused) {
            if (this.videos.length > 0 && this.currentIndex >= this.videos.length) {
                this.currentIndex = 0;
                this.currentTimeOffset = 0;
                await this.loadVideo(0);
            }
            this.isPlaying = true;
            if(playPauseBtn) playPauseBtn.textContent = 'Pause';
            if (this.videoElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
                await this.videoElement.play().catch(e => console.warn("Play interrupted on toggle:", e.name));
            } else {
                this.videoElement.oncanplay = async () => {
                    await this.videoElement.play().catch(e => console.warn("Play interrupted on canplay:", e.name));
                    this.videoElement.oncanplay = null;
                };
            }
        } else {
            this.isPlaying = false;
            if(playPauseBtn) playPauseBtn.textContent = 'Play';
            this.videoElement.pause();
        }
    }

    async seekTo(time) {
        if (!Number.isFinite(time) || time < 0 || (this.totalDuration > 0 && time > this.totalDuration) || this.videos.length === 0) {
            return;
        }

        let accumulatedTime = 0;
        for (let i = 0; i < this.videos.length; i++) {
            const segmentDuration = (this.durations[i] && Number.isFinite(this.durations[i])) ? this.durations[i] : 0;
            const nextTimeBoundary = accumulatedTime + segmentDuration;

            if (time <= nextTimeBoundary || i === this.videos.length - 1) {
                this.currentIndex = i;
                // currentTimeOffset is set by loadVideo
                await this.loadVideo(i); 
                
                const seekInCurrentVideo = Math.max(0, time - this.currentTimeOffset); // Use updated currentTimeOffset
                if (this.videoElement && Number.isFinite(seekInCurrentVideo)) {
                    this.videoElement.currentTime = seekInCurrentVideo;
                }
                
                if (this.isPlaying && this.videoElement && this.videoElement.paused) {
                    this.videoElement.play().catch(e => console.warn("SeekTo: Play interrupted", e));
                }
                if(this.timelineUIManager) this.timelineUIManager.updateTimeDisplay();
                break;
            }
            accumulatedTime = nextTimeBoundary;
        }
    }
    
    async removeVideo(index) {
        if (index >= 0 && index < this.videos.length) {
            this.videoElement.pause();
            this.isPlaying = false;
            const playPauseBtn = document.getElementById('playPauseBtn');
            if (playPauseBtn) playPauseBtn.textContent = 'Play';

            this.videos.splice(index, 1);
            this.durations.splice(index, 1); // Remove corresponding duration

            await this.loadMediaDurations(); // Recalculate total duration and potentially audioDuration if it was dominant

            if (this.currentIndex >= this.videos.length && this.videos.length > 0) {
                this.currentIndex = this.videos.length - 1;
            } else if (this.videos.length === 0) {
                this.currentIndex = 0;
                this.currentTimeOffset = 0;
            }
            // Recalculate currentTimeOffset based on new currentIndex
            this.currentTimeOffset = 0;
            for(let i = 0; i < this.currentIndex; i++) {
                if (this.durations[i] && Number.isFinite(this.durations[i])) {
                    this.currentTimeOffset += this.durations[i];
                }
            }

            if (this.videos.length > 0) {
                await this.loadVideo(this.currentIndex);
            } else {
                if (this.videoElement) this.videoElement.src = '';
            }
            
            if(this.timelineUIManager) {
                this.timelineUIManager.updateTimelineSegments();
                this.timelineUIManager.updateTimeDisplay();
            }
            this.debugElement.textContent = 'Статус: Видео удалено';
        }
    }

    async removeAudio() {
        if (this.processors?.audio) {
            await this.processors.audio.clearAudio(); // Let AudioOverlay handle its audio element
        }
        this.audioFile = null;
        this.audioDuration = 0;
        
        // Recalculate totalDuration based only on videos
        let videoTotalDurationNum = 0;
        if (this.videos && this.videos.length > 0) {
            for (let i = 0; i < this.durations.length; i++) {
                videoTotalDurationNum += (Number.isFinite(this.durations[i]) ? this.durations[i] : 0);
            }
        }
        this.totalDuration = videoTotalDurationNum;
        if (this.videos.length > 0 && this.totalDuration === 0) this.totalDuration = 0.1;
        if (!Number.isFinite(this.totalDuration) || this.totalDuration < 0) this.totalDuration = 0;

        if(this.timelineUIManager) {
            this.timelineUIManager.updateTimelineSegments();
            this.timelineUIManager.updateTimeDisplay();
        }
        this.debugElement.textContent = 'Status: Audio removed';
    }
}