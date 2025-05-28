import { VideoProcessor } from './videoProcessor.js';

export class VideoMerger extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies); // Ensure VideoProcessor constructor is called
        this.videos = [];
        this.durations = []; 
        this.totalDuration = 0; 
        this.currentIndex = 0;
        this.currentTimeOffset = 0; 
        this.isPlaying = false;
        this.audioFile = null;
        this.audioDuration = 0; 
        this.processors = dependencies.processors; 
        
        this.timelineContainer = dependencies.timelineContainer;
        this.timelineBar = document.getElementById('timelineBar');
        
        // Bind event handler methods to this instance
        this.handleTimelineBarClick = this.handleTimelineBarClick.bind(this);
        this.handleVideoTimeUpdate = this.handleVideoTimeUpdate.bind(this);
        this.handleVideoEnded = this.handleVideoEnded.bind(this);

        this.bindEvents();
        // Call setupTimelineElements initially if timelineBar exists, 
        // it will be called again after segments update.
        if (this.timelineBar) {
            this.setupTimelineElements();
        }
    }

    // Ensure formatTime is available, defaulting if not provided by VideoProcessor
    formatTime(seconds) {
        if (super.formatTime && typeof super.formatTime === 'function') {
            return super.formatTime(seconds);
        }
        // Fallback default formatTime if not on superclass
        if (!Number.isFinite(seconds) || seconds < 0) {
            seconds = 0;
        }
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }


    async getVideoDuration(file) {
        return new Promise((resolve) => {
            if (!file || !(file instanceof Blob || file instanceof File)) {
                console.error("Invalid file provided to getVideoDuration:", file);
                resolve(0); 
                return;
            }
            const video = document.createElement('video');
            video.preload = 'metadata';
            let srcUrl = '';
            try {
                srcUrl = URL.createObjectURL(file);
                video.src = srcUrl;
            } catch (error) {
                console.error(`Error creating object URL for file ${file.name} in getVideoDuration:`, error);
                if (srcUrl) URL.revokeObjectURL(srcUrl);
                resolve(0);
                return;
            }
            video.onloadedmetadata = () => {
                const duration = video.duration;
                URL.revokeObjectURL(srcUrl);
                resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
            };
            video.onerror = (e) => {
                URL.revokeObjectURL(srcUrl);
                console.error(`Error loading video metadata for duration: ${file.name}`, e);
                resolve(0); 
            };
        });
    }

    setupTimelineElements() {
        if (!this.timelineBar) return;

        this.timelineBar.removeEventListener('click', this.handleTimelineBarClick);
        this.timelineBar.addEventListener('click', this.handleTimelineBarClick);

        this.cursor = this.timelineBar.querySelector('.timeline-cursor');
        if (!this.cursor) {
            this.cursor = document.createElement('div');
            this.cursor.className = 'timeline-cursor';
            this.timelineBar.appendChild(this.cursor);
        }

        this.progress = this.timelineBar.querySelector('.timeline-progress');
        if (!this.progress) {
            this.progress = document.createElement('div');
            this.progress.className = 'timeline-progress';
            this.timelineBar.appendChild(this.progress);
        }
        this.updateTimeDisplay(); 
    }

    async handleTimelineBarClick(e) {
        if (e.target.classList.contains('delete-btn') || !Number.isFinite(this.totalDuration) || this.totalDuration <= 0) return;
        const rect = this.timelineBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const time = this.totalDuration * pos;
        await this.seekTo(time); 
    }

    handleVideoTimeUpdate() {
        this.updateTimeDisplay(); 
    }

    handleVideoEnded() {
        this.playNext(); 
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
        
        if (this.videoElement) {
            this.videoElement.pause();
        }
        this.isPlaying = false;
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) playPauseBtn.textContent = 'Play';

        this.videos = videoFiles && videoFiles.length > 0 ? Array.from(videoFiles) : [];
        if (audioFile === null) { // Explicitly clearing audio
            this.audioFile = null;
            this.audioDuration = 0;
        } else if (audioFile !== undefined) { // New audio file provided
            this.audioFile = audioFile;
        }
        // If audioFile is undefined, this.audioFile and this.audioDuration retain their values.
        
        this.currentIndex = 0;
        this.currentTimeOffset = 0;

        await this.loadMediaDurations();

        if (this.videos.length > 0) {
            await this.loadVideo(0);
        } else {
            if (this.videoElement) this.videoElement.src = ''; 
        }
        
        if (this.audioFile && this.processors?.audio) {
            await this.processors.audio.process({ file: this.audioFile });
        } else if (!this.audioFile && this.processors?.audio) { 
            await this.processors.audio.clearAudio();
        }

        this.updateTimelineSegments(); 
        this.updateTimeDisplay();      
        
        if (this.videos.length > 0 || this.audioFile) {
            this.debugElement.textContent = 'Статус: Media loaded successfully';
        } else {
            this.debugElement.textContent = 'Статус: Timeline cleared';
        }
    }

    async loadMediaDurations() {
        let videoTotalDuration = 0;
        this.durations = []; 

        if (this.videos && this.videos.length > 0) {
            for (const videoFile of this.videos) {
                const duration = await this.getVideoDuration(videoFile);
                this.durations.push(duration); 
                videoTotalDuration += duration;
            }
        }

        this.audioDuration = 0;
        if (this.audioFile) {
            this.audioDuration = await this.getAudioFileDuration(this.audioFile);
        }
        
        this.totalDuration = Math.max(videoTotalDuration, this.audioDuration);
        if (this.videos.length === 0 && !this.audioFile) {
            this.totalDuration = 0; 
        }
        if (!Number.isFinite(this.totalDuration) || this.totalDuration < 0) {
            this.totalDuration = 0;
        }
    }
    
    async getAudioFileDuration(file) {
        return new Promise((resolve) => {
            if (!file || !(file instanceof Blob || file instanceof File)) {
                console.error("Invalid file provided to getAudioFileDuration:", file);
                resolve(0);
                return;
            }
            const audio = document.createElement('audio');
            audio.preload = 'metadata';
            let srcUrl = '';
            try {
                srcUrl = URL.createObjectURL(file);
                audio.src = srcUrl;
            } catch (error) {
                console.error(`Error creating object URL for audio file ${file.name}:`, error);
                if (srcUrl) URL.revokeObjectURL(srcUrl);
                resolve(0);
                return;
            }
            audio.onloadedmetadata = () => {
                const duration = audio.duration;
                URL.revokeObjectURL(srcUrl); 
                resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
            };
            audio.onerror = () => {
                console.error("Error loading audio duration for file:", file.name);
                URL.revokeObjectURL(srcUrl);
                resolve(0); 
            }
        });
    }

    updateTimelineSegments() {
        if (!this.timelineBar) {
            console.error("Timeline bar not found for segment update");
            return;
        }

        this.timelineBar.innerHTML = ''; 
        let videoOffset = 0; 
        let timelineBarHeight = 0;

        if (this.videos && this.videos.length > 0 && this.totalDuration > 0) {
            timelineBarHeight = 40; 
            this.videos.forEach((video, index) => {
                const segment = document.createElement('div');
                segment.className = 'timeline-segment video-segment';
                const durationOfSegment = Number.isFinite(this.durations[index]) ? this.durations[index] : 0;
                const widthPercentage = (durationOfSegment / this.totalDuration) * 100;
                segment.style.width = `${Math.max(0, Math.min(100,widthPercentage))}%`;
                const leftPercentage = (videoOffset / this.totalDuration) * 100;
                segment.style.left = `${Math.max(0, Math.min(100,leftPercentage))}%`;
                
                const label = document.createElement('div');
                label.className = 'video-info';
                const startLabel = Number.isFinite(videoOffset) ? videoOffset.toFixed(2) : "0.00";
                const endLabel = (Number.isFinite(videoOffset) && Number.isFinite(durationOfSegment)) ? (videoOffset + durationOfSegment).toFixed(2) : startLabel;
                label.textContent = `Video ${index + 1} (${startLabel}-${endLabel}s)`;
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.textContent = '×';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.removeVideo(index);
                };
                
                segment.appendChild(label);
                segment.appendChild(deleteBtn);
                this.timelineBar.appendChild(segment);
                
                videoOffset += durationOfSegment;
            });
        }

        if (this.audioFile && this.totalDuration > 0) {
            const audioTrackHeight = 20;
            const gap = (this.videos && this.videos.length > 0) ? 10 : 0;
            let audioTopPosition = (this.videos && this.videos.length > 0) ? timelineBarHeight + gap : 0;
            
            if (this.videos && this.videos.length > 0) {
                timelineBarHeight = audioTopPosition + audioTrackHeight;
            } else { // Only audio
                timelineBarHeight = Math.max(timelineBarHeight, audioTrackHeight); 
                audioTopPosition = 0; // Audio track at the top if no videos
            }
            
            const audioSegment = document.createElement('div');
            audioSegment.className = 'timeline-segment audio-segment';
            const audioWidthPercentage = (this.audioDuration / this.totalDuration) * 100;

            audioSegment.style.width = `${Math.max(0, Math.min(100,audioWidthPercentage))}%`; 
            audioSegment.style.left = '0%';
            audioSegment.style.top = `${audioTopPosition}px`; 
            audioSegment.style.height = `${audioTrackHeight}px`;

            const audioLabel = document.createElement('div');
            audioLabel.className = 'video-info'; 
            audioLabel.textContent = `Audio: ${this.audioFile.name.substring(0, 30)}${this.audioFile.name.length > 30 ? '...' : ''}`;
            audioLabel.style.bottom = '2px';

            const deleteAudioBtn = document.createElement('button');
            deleteAudioBtn.className = 'delete-btn';
            deleteAudioBtn.textContent = '×';
            deleteAudioBtn.style.top = '2px'; 
            deleteAudioBtn.style.right = '2px';
            deleteAudioBtn.onclick = (e) => {
                e.stopPropagation();
                this.removeAudio();
            };

            audioSegment.appendChild(audioLabel);
            audioSegment.appendChild(deleteAudioBtn);
            this.timelineBar.appendChild(audioSegment);
        }
        
        this.timelineBar.style.height = `${Math.max(40, timelineBarHeight)}px`; 
        this.setupTimelineElements(); // Re-setup cursor and progress after segments are drawn
    }

    async loadVideo(index) {
        if (this.videoElement && this.videos && index >= 0 && index < this.videos.length) {
            this.videoElement.pause(); 
            const videoUrl = URL.createObjectURL(this.videos[index]);
            this.videoElement.src = videoUrl;
            this.currentIndex = index;
            
            return new Promise((resolve, reject) => {
                this.videoElement.onloadedmetadata = () => {
                    if (this.isPlaying) {
                        this.videoElement.play().catch(e => console.warn("Play interrupted on load:", e.name, e.message));
                    }
                    resolve();
                };
                this.videoElement.onerror = (e) => {
                    console.error("Error loading video:", e);
                    URL.revokeObjectURL(videoUrl); // Clean up if error
                    reject(e);
                }
            });
        } else if (this.videoElement && (!this.videos || this.videos.length === 0)) {
            this.videoElement.src = ''; 
            this.updateTimeDisplay();
            return Promise.resolve();
        }
        return Promise.resolve(); 
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
        
        try {
            await this.loadVideo(this.currentIndex);
        } catch (error) {
            console.error('Error in playNext:', error);
        }
    }
    
    async togglePlay() {
        try {
            if (!this.videoElement || ((!this.videoElement.src || this.videoElement.src === window.location.href) && (!this.videos || this.videos.length === 0))) {
                this.isPlaying = false;
                const playPauseBtn = document.getElementById('playPauseBtn');
                if (playPauseBtn) playPauseBtn.textContent = 'Play';
                return;
            }

            if (this.videoElement.paused) {
                if (this.videos.length > 0 && this.currentIndex >= this.videos.length) { // Ensure current index is valid
                    this.currentIndex = 0;
                    this.currentTimeOffset = 0;
                    await this.loadVideo(0); 
                }
                this.isPlaying = true;
                document.getElementById('playPauseBtn').textContent = 'Pause';
                if (this.videoElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
                     await this.videoElement.play().catch(e => console.warn("Play interrupted on toggle:", e.name, e.message));
                } else {
                    this.videoElement.oncanplay = async () => {
                         await this.videoElement.play().catch(e => console.warn("Play interrupted on canplay:", e.name, e.message));
                         this.videoElement.oncanplay = null; 
                    };
                }
            } else {
                this.isPlaying = false;
                document.getElementById('playPauseBtn').textContent = 'Play';
                this.videoElement.pause();
            }
        } catch (error) {
            console.error('Toggle play error:', error);
            this.debugElement.textContent = 'Status: Error playing video';
        }
    }

    async trimVideoSegment(videoFile, start, end) {
        return new Promise((resolve, reject) => {
            if (start >= end) {
                resolve(new Blob([], { type: 'video/webm' })); 
                return;
            }

            const video = document.createElement('video');
            let srcUrl = '';
            try {
                srcUrl = URL.createObjectURL(videoFile);
                video.src = srcUrl;
            } catch (error) {
                console.error("Error creating object URL for trimVideoSegment:", error);
                if(srcUrl) URL.revokeObjectURL(srcUrl);
                reject(error);
                return;
            }
            video.muted = true;
            let recorder; 
            let canvas;
            let frameRequestCallbackId;

            const cleanup = () => {
                if (frameRequestCallbackId) cancelAnimationFrame(frameRequestCallbackId);
                if (srcUrl) URL.revokeObjectURL(srcUrl); 
                video.remove(); 
            };

            video.onloadedmetadata = () => {
                if (video.videoWidth === 0 || video.videoHeight === 0) {
                    video.onloadeddata = () => { 
                        if (video.videoWidth === 0 || video.videoHeight === 0) {
                            cleanup();
                            reject(new Error("Failed to get video dimensions for trimming after loadeddata."));
                            return;
                        }
                        video.currentTime = start;
                    };
                } else {
                    video.currentTime = start;
                }
            };
    
            video.onseeked = () => {
                if (video.videoWidth === 0 || video.videoHeight === 0) {
                    cleanup();
                    reject(new Error("Video dimensions are zero at onseeked. Cannot trim."));
                    return;
                }

                canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                
                const stream = canvas.captureStream(30); 
                
                try {
                    recorder = new MediaRecorder(stream, {
                        mimeType: 'video/webm;codecs=vp8', 
                        videoBitsPerSecond: 2500000 
                    });
                } catch (e) {
                    cleanup();
                    reject(new Error(`MediaRecorder initialization failed: ${e.message}`));
                    return;
                }
    
                const chunks = [];
                recorder.ondataavailable = e => {
                    if (e.data.size > 0) chunks.push(e.data);
                };
    
                recorder.onstop = () => {
                    cleanup();
                    resolve(new Blob(chunks, { type: 'video/webm' }));
                };
                recorder.onerror = (event) => {
                    cleanup();
                    reject(event.error || new Error("MediaRecorder failed during trim."));
                };
    
                const drawLoop = () => {
                    if (video.currentTime >= end || video.ended) {
                        if (recorder && recorder.state === "recording") recorder.stop();
                        return; 
                    }
                    
                    if (recorder && recorder.state === "recording" && !video.paused) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        frameRequestCallbackId = requestAnimationFrame(drawLoop);
                    } else if (recorder && recorder.state === "recording" && video.paused) {
                        recorder.stop(); 
                    }
                };
    
                video.play()
                    .then(() => {
                        if (recorder.state === "inactive") recorder.start(); 
                        frameRequestCallbackId = requestAnimationFrame(drawLoop);
                    })
                    .catch(err => {
                        cleanup();
                        if (recorder && recorder.state === "recording") recorder.stop();
                        reject(err);
                    });
            };
    
            video.onerror = (e) => {
                cleanup();
                const errorMsg = e.target?.error ? `Code: ${e.target.error.code}, Message: ${e.target.error.message}` : "Unknown video error";
                if (recorder && recorder.state === "recording") recorder.stop();
                reject(new Error(`Video element failed to load for trimming: ${errorMsg}`));
            };
        });
    }
    
    async trim(startTime, endTime) { 
        if (!this.videos || this.videos.length === 0) {
            this.logError("Нет видео для обрезки.");
            return;
        }
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < 0 || endTime <= startTime || endTime > this.totalDuration) {
            this.logError(`Некорректный общий интервал для обрезки: ${startTime}-${endTime}. Общая длительность: ${this.totalDuration}`);
            return;
        }

        try {
            this.videoElement.pause();
            this.isPlaying = false;
            document.getElementById('playPauseBtn').textContent = 'Play';
            
            let newVideos = [];
            let newDurations = []; 
            let accumulatedTimeBeforeSegment = 0; 

            for (let i = 0; i < this.videos.length; i++) {
                const videoFile = this.videos[i];
                const originalSegmentDuration = this.durations[i];
                const segmentEndBoundaryInTimeline = accumulatedTimeBeforeSegment + originalSegmentDuration;
                
                const effectiveTrimStart = Math.max(startTime, accumulatedTimeBeforeSegment);
                const effectiveTrimEnd = Math.min(endTime, segmentEndBoundaryInTimeline);
                
                if (effectiveTrimEnd > effectiveTrimStart) { // There is an overlap to trim
                    const trimStartInSegment = effectiveTrimStart - accumulatedTimeBeforeSegment;
                    const trimEndInSegment = effectiveTrimEnd - accumulatedTimeBeforeSegment;
                    
                    if (trimEndInSegment > trimStartInSegment) {
                        const trimmedSegmentBlob = await this.trimVideoSegment(videoFile, trimStartInSegment, trimEndInSegment);
                        if (trimmedSegmentBlob.size > 0) {
                            newVideos.push(trimmedSegmentBlob);
                            // Duration of this new blob will be calculated by getVideoDuration later
                        }
                    }
                }
                accumulatedTimeBeforeSegment = segmentEndBoundaryInTimeline;
            }

            this.videos = newVideos;
            // Durations will be recalculated by loadMediaDurations
            
            await this.loadMediaDurations(); 
            
            this.currentIndex = 0;
            this.currentTimeOffset = 0;
            
            if (this.videos.length > 0) {
                await this.loadVideo(0);
            } else {
                this.videoElement.src = ''; 
            }
            
            if (this.audioFile && this.processors?.audio) {
                await this.processors.audio.applyAudio(); 
            }

            this.updateTimelineSegments();
            this.updateTimeDisplay();
            this.debugElement.textContent = `Статус: Обрезка выполнена с ${startTime.toFixed(2)}с до ${endTime.toFixed(2)}с`;

        } catch (error) {
            console.error('Error trimming video:', error);
            this.logError('Ошибка при обрезке видео: ' + error.message);
        }
    }
    
    // ... ensureVideosLoaded can be removed if not strictly needed or causing issues ...

    async exportVideo() {
        if ((!this.videos || this.videos.length === 0) && !this.audioFile) {
            this.logError("No media to export.");
            return null;
        }

        try {
            this.debugElement.textContent = "Status: Exporting video...";
            const audioContext = new AudioContext();
            const destination = audioContext.createMediaStreamDestination();
            let canvas, ctx;
            let videoStreamTracks = [];
            let recorderMimeType = '';
            let exportAudioElement = null; 

            if (this.videos && this.videos.length > 0) {
                canvas = document.createElement('canvas');
                ctx = canvas.getContext('2d');
                const firstVideoTemp = document.createElement('video');
                let firstVideoSrc = '';
                try {
                    firstVideoSrc = URL.createObjectURL(this.videos[0]);
                    firstVideoTemp.src = firstVideoSrc;
                    await new Promise((resolve, reject) => {
                        firstVideoTemp.onloadedmetadata = resolve;
                        firstVideoTemp.onerror = () => reject(new Error("Failed to load first video for export dimensions."));
                    });
                    if (firstVideoTemp.videoWidth === 0 || firstVideoTemp.videoHeight === 0) {
                        throw new Error("First video has invalid dimensions for export.");
                    }
                    canvas.width = firstVideoTemp.videoWidth;
                    canvas.height = firstVideoTemp.videoHeight;
                } finally {
                    if (firstVideoSrc) URL.revokeObjectURL(firstVideoSrc);
                }
                
                const canvasStream = canvas.captureStream(30); // 30 FPS
                videoStreamTracks = canvasStream.getVideoTracks();
            }

            let combinedStreamTracks = [...videoStreamTracks];

            if (this.audioFile) {
                exportAudioElement = document.createElement('audio');
                let audioSrc = '';
                try {
                    audioSrc = URL.createObjectURL(this.audioFile);
                    exportAudioElement.src = audioSrc;
                    await new Promise((resolve, reject) => {
                        exportAudioElement.onloadedmetadata = resolve;
                        exportAudioElement.onerror = () => reject(new Error("Failed to load audio for export."));
                    });
                    const sourceNode = audioContext.createMediaElementSource(exportAudioElement);
                    sourceNode.connect(destination);
                    if (destination.stream.getAudioTracks().length > 0) {
                        combinedStreamTracks.push(...destination.stream.getAudioTracks());
                    } else {
                        console.warn("Audio destination stream has no audio tracks for export.");
                    }
                } finally {
                    // URL.revokeObjectURL for audioSrc will be handled after recorder.onstop
                }
                recorderMimeType = videoStreamTracks.length > 0 ? 'video/webm;codecs=vp8,opus' : 'audio/webm;codecs=opus';
                exportAudioElement.currentTime = 0;
            } else {
                recorderMimeType = videoStreamTracks.length > 0 ? 'video/webm;codecs=vp8' : ''; // No audio, no opus
            }
            
            if (combinedStreamTracks.length === 0) {
                audioContext.close();
                if (exportAudioElement && exportAudioElement.src) URL.revokeObjectURL(exportAudioElement.src);
                throw new Error("No tracks to record for export.");
            }

            const combinedStream = new MediaStream(combinedStreamTracks);
            
            if (!MediaRecorder.isTypeSupported(recorderMimeType) && videoStreamTracks.length > 0 && this.audioFile) {
                console.warn(`${recorderMimeType} not supported, trying video/webm;codecs=vp8 without Opus.`);
                recorderMimeType = 'video/webm;codecs=vp8'; // Fallback if vp8,opus not supported
            }
            if (!MediaRecorder.isTypeSupported(recorderMimeType) && videoStreamTracks.length === 0 && this.audioFile) {
                 console.warn(`${recorderMimeType} not supported, trying audio/webm.`);
                 recorderMimeType = 'audio/webm'; // Broader fallback for audio
            }
             if (!MediaRecorder.isTypeSupported(recorderMimeType) && recorderMimeType) {
                audioContext.close();
                if (exportAudioElement && exportAudioElement.src) URL.revokeObjectURL(exportAudioElement.src);
                throw new Error(`MediaRecorder MIME type ${recorderMimeType} not supported.`);
            }
            if (!recorderMimeType && combinedStreamTracks.length > 0) { // Should not happen if logic above is correct
                audioContext.close();
                if (exportAudioElement && exportAudioElement.src) URL.revokeObjectURL(exportAudioElement.src);
                throw new Error("Could not determine a valid MIME type for MediaRecorder.");
            }


            const recorder = new MediaRecorder(combinedStream, {
                mimeType: recorderMimeType,
                videoBitsPerSecond: (videoStreamTracks.length > 0) ? 3000000 : undefined, 
                audioBitsPerSecond: (this.audioFile && combinedStream.getAudioTracks().length > 0) ? 128000 : undefined,
            });
            
            const chunks = [];
            recorder.ondataavailable = e => {
                if (e.data.size > 0) chunks.push(e.data);
            };
            
            return new Promise(async (resolve, reject) => {
                recorder.onstop = () => {
                    if (exportAudioElement) {
                        exportAudioElement.pause();
                        if (exportAudioElement.src) URL.revokeObjectURL(exportAudioElement.src);
                    }
                    audioContext.close().catch(e => console.warn("Error closing audio context:", e));
                    if (chunks.length > 0) {
                        const blob = new Blob(chunks, { type: recorderMimeType });
                        this.debugElement.textContent = "Status: Export finished.";
                        resolve(blob);
                    } else {
                        this.debugElement.textContent = "Status: Export failed (no data).";
                        reject(new Error("Export resulted in an empty file."));
                    }
                };
                recorder.onerror = (e) => {
                     if (exportAudioElement) {
                        exportAudioElement.pause();
                        if (exportAudioElement.src) URL.revokeObjectURL(exportAudioElement.src);
                    }
                    audioContext.close().catch(err => console.warn("Error closing audio context on recorder error:", err));
                    console.error('MediaRecorder error during export:', e);
                    this.logError('Ошибка при экспорте: ' + (e.name || 'Unknown recorder error'));
                    reject(e);
                };

                recorder.start();
                if (exportAudioElement) {
                    exportAudioElement.play().catch(e => console.warn("Export audio play failed during start", e));
                }

                if (videoStreamTracks.length > 0 && ctx) {
                    for (let i = 0; i < this.videos.length; i++) {
                        const videoFile = this.videos[i];
                        const segmentVideo = document.createElement('video');
                        let segmentSrc = '';
                        try {
                            segmentSrc = URL.createObjectURL(videoFile);
                            segmentVideo.src = segmentSrc;
                            await new Promise((res, rej) => {
                                segmentVideo.onloadedmetadata = res;
                                segmentVideo.onerror = () => rej(new Error(`Failed to load segment ${i+1} for export.`));
                            });
                            await segmentVideo.play();
                            
                            while (!segmentVideo.ended && segmentVideo.currentTime < segmentVideo.duration) {
                                if (segmentVideo.videoWidth > 0 && segmentVideo.videoHeight > 0) {
                                    ctx.drawImage(segmentVideo, 0, 0, canvas.width, canvas.height);
                                }
                                await new Promise(r => requestAnimationFrame(r));
                            }
                        } catch (segmentError) {
                            console.error(`Error processing video segment ${i+1} for export:`, segmentError);
                        } finally {
                            segmentVideo.pause();
                            if (segmentSrc) URL.revokeObjectURL(segmentSrc);
                        }
                    }
                }
                
                // Determine when to stop the recorder
                let stopTimeoutDuration = 500; // Default small delay for video-only or if audio is short
                if (this.audioFile && exportAudioElement) {
                    // Wait for audio to play out, or max video timeline length
                    stopTimeoutDuration = (this.totalDuration * 1000) + 2000; // Total timeline duration + buffer
                } else if (videoStreamTracks.length > 0) {
                    stopTimeoutDuration = (this.totalDuration * 1000) + 1000; // Video timeline duration + buffer
                }

                setTimeout(() => {
                    if (recorder.state === 'recording') {
                        recorder.stop();
                    }
                }, stopTimeoutDuration);
            });
        } catch (error) {
            console.error('Export error:', error);
            this.logError('Ошибка при экспорте видео: ' + error.message);
            return null; 
        }
    }

    async trimSingleVideo(index, startTime, endTime) {
        if (!this.videos || index < 0 || index >= this.videos.length) {
            this.logError('Неверный индекс видео для обрезки.');
            return;
        }

        const videoFileToTrim = this.videos[index];
        const originalSegmentDuration = this.durations[index];

        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < 0 || endTime > originalSegmentDuration || startTime >= endTime) {
            this.logError(`Время для обрезки видео ${index + 1} должно быть между 0 и ${originalSegmentDuration.toFixed(1)}с. Start: ${startTime}, End: ${endTime}`);
            return;
        }

        try {
            this.videoElement.pause();
            this.isPlaying = false;
            document.getElementById('playPauseBtn').textContent = 'Play';

            const trimmedVideoBlob = await this.trimVideoSegment(videoFileToTrim, startTime, endTime);
            
            if (trimmedVideoBlob.size === 0) {
                this.logError("Обрезка не дала результата (пустой файл). Видео не изменено.");
                // Optionally, reload the current video to reset player state if needed
                if (this.videos.length > 0 && this.videos[this.currentIndex]) {
                    await this.loadVideo(this.currentIndex);
                }
                return;
            }
            this.videos[index] = trimmedVideoBlob;
            
            await this.loadMediaDurations(); 
            
            this.currentTimeOffset = 0;
            for(let i=0; i < this.currentIndex; i++) {
                if (this.durations[i] && Number.isFinite(this.durations[i])) this.currentTimeOffset += this.durations[i];
            }
            if (this.currentIndex >= this.videos.length) {
                this.currentIndex = Math.max(0, this.videos.length - 1);
                this.currentTimeOffset = 0; 
                 for(let i=0; i < this.currentIndex; i++) {
                    if (this.durations[i] && Number.isFinite(this.durations[i])) this.currentTimeOffset += this.durations[i];
                }
            }

            if (this.videos.length > 0 && this.videos[this.currentIndex]) { 
                 await this.loadVideo(this.currentIndex);
            } else if (this.videos.length === 0) { 
                this.videoElement.src = '';
            }
            
            if (this.audioFile && this.processors?.audio) { 
                await this.processors.audio.applyAudio(); 
            }

            this.updateTimelineSegments();
            this.updateTimeDisplay();
            this.debugElement.textContent = `Статус: Видео ${index + 1} успешно обрезано`;
        } catch (error) {
            console.error('Error trimming single video:', error);
            this.logError('Ошибка при обрезке видео: ' + error.message);
        }
    }

    async removeVideo(index) { 
        if (index >= 0 && index < this.videos.length) {
            this.videoElement.pause();
            this.isPlaying = false;
            document.getElementById('playPauseBtn').textContent = 'Play';

            this.videos.splice(index, 1);
            
            await this.loadMediaDurations(); 

            if (this.currentIndex >= this.videos.length && this.videos.length > 0) {
                this.currentIndex = this.videos.length - 1;
            } else if (this.videos.length === 0) {
                this.currentIndex = 0;
            }
            
            this.currentTimeOffset = 0;
            for(let i=0; i < this.currentIndex; i++) {
                if (this.durations[i] && Number.isFinite(this.durations[i])) this.currentTimeOffset += this.durations[i];
            }

            this.updateTimelineSegments(); 

            if (this.videos.length > 0) {
                await this.loadVideo(this.currentIndex);
            } else {
                this.videoElement.src = '';
            }
            this.updateTimeDisplay();
            this.debugElement.textContent = 'Статус: Видео удалено';
        }
    }

    async removeAudio() { 
        if (this.processors?.audio) {
            await this.processors.audio.clearAudio();
        }
        this.audioFile = null;
        this.audioDuration = 0;
        
        await this.loadMediaDurations(); 
        this.updateTimelineSegments();
        this.updateTimeDisplay();
        this.debugElement.textContent = 'Статус: Audio removed';
    }

    // Centralized method to update time display for both current and total duration
    updateTimeDisplay() {
        const currentTime = this.getCurrentTime();
        const validCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;
        const validTotalDuration = Number.isFinite(this.totalDuration) ? this.totalDuration : 0;

        const percentage = (validTotalDuration > 0) ? (validCurrentTime / validTotalDuration) * 100 : 0;
        const safePercentage = Math.max(0, Math.min(100, Number.isFinite(percentage) ? percentage : 0));

        if (this.cursor) {
            this.cursor.style.left = `${safePercentage}%`;
        }
        if (this.progress) {
            this.progress.style.width = `${safePercentage}%`;
        }

        const currentTimeDisplay = document.getElementById('currentTime');
        if (currentTimeDisplay) {
            currentTimeDisplay.textContent = this.formatTime(validCurrentTime);
        }
        const totalDurationDisplay = document.getElementById('duration');
        if (totalDurationDisplay) {
            totalDurationDisplay.textContent = this.formatTime(validTotalDuration);
        }
    }

    getCurrentTime() {
        const videoCurrentTime = this.videoElement?.currentTime;
        const validVideoCurrentTime = Number.isFinite(videoCurrentTime) ? videoCurrentTime : 0;
        const validOffset = Number.isFinite(this.currentTimeOffset) ? this.currentTimeOffset : 0;
        return validOffset + validVideoCurrentTime;
    }

    async seekTo(time) {
        if (!Number.isFinite(time) || time < 0 || !Number.isFinite(this.totalDuration) || time > this.totalDuration) {
            console.warn(`Invalid seek time: ${time}, totalDuration: ${this.totalDuration}`);
            return;
        }
        if (!this.videos || this.videos.length === 0) return; // No videos to seek in

        let accumulatedTime = 0;
        for (let i = 0; i < this.videos.length; i++) {
            const segmentDuration = Number.isFinite(this.durations[i]) ? this.durations[i] : 0;
            const nextTimeBoundary = accumulatedTime + segmentDuration;
            if (time <= nextTimeBoundary || i === this.videos.length - 1) { // Seek into this segment or it's the last one
                this.currentIndex = i;
                this.currentTimeOffset = accumulatedTime;
                await this.loadVideo(i);
                if (this.videoElement) {
                    this.videoElement.currentTime = Math.max(0, time - accumulatedTime);
                    if (this.isPlaying) {
                        await this.videoElement.play().catch(e => console.warn("Play interrupted on seek:", e));
                    }
                }
                break;
            }
            accumulatedTime = nextTimeBoundary;
        }
        this.updateTimeDisplay();
    }
}