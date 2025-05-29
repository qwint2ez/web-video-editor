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
        
        this.timelineContainer = dependencies.timelineContainer;
        this.timelineBar = document.getElementById('timelineBar');
        
        // Define updateTimeDisplay as an instance property
        this.updateTimeDisplay = () => {
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
        };
        
        // Bind event handler methods to this instance
        this.handleTimelineBarClick = this.handleTimelineBarClick.bind(this);
        this.handleVideoTimeUpdate = this.handleVideoTimeUpdate.bind(this);
        this.handleVideoEnded = this.handleVideoEnded.bind(this);

        this.bindEvents();
    }

    formatTime(seconds) {
        let numericSeconds = parseFloat(seconds); // Ensure it's a number
        if (!Number.isFinite(numericSeconds) || numericSeconds < 0) {
            numericSeconds = 0;
        }
        const minutes = Math.floor(numericSeconds / 60);
        const secs = Math.floor(numericSeconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }


    async getVideoDuration(file) {
        return new Promise((resolve) => {
            if (!file || !(file instanceof Blob || file instanceof File)) {
                console.error("Invalid file provided to getVideoDuration:", file);
                resolve(0); 
                return;
            }
            
            // Если это blob размером 0, сразу возвращаем 0
            if (file.size === 0) {
                console.warn("File has 0 size, returning 0 duration");
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
                console.error(`Error creating object URL for file ${file.name || 'unknown file'} in getVideoDuration:`, error);
                if (srcUrl) URL.revokeObjectURL(srcUrl);
                resolve(0);
                return;
            }
            
            // Увеличим таймаут для обрезанных видео
            const timeout = setTimeout(() => {
                console.warn("Video duration loading timeout");
                URL.revokeObjectURL(srcUrl);
                resolve(0);
            }, 10000); // 10 секунд таймаут
            
            video.onloadedmetadata = () => {
                clearTimeout(timeout);
                const duration = video.duration;
                URL.revokeObjectURL(srcUrl);
                console.log(`Duration loaded: ${duration} for file size: ${file.size}`);
                resolve(Number.isFinite(duration) && duration > 0 ? duration : 0);
            };
            
            video.onerror = (e) => {
                clearTimeout(timeout);
                URL.revokeObjectURL(srcUrl);
                console.error(`Error loading video metadata for duration: ${file.name || 'unknown file'}`, e);
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
        // Now this.updateTimeDisplay will be defined
        if (typeof this.updateTimeDisplay === 'function') {
            this.updateTimeDisplay(); 
        } else {
            console.error("VideoMerger: updateTimeDisplay is not a function during setupTimelineElements");
        }
    }

    async handleTimelineBarClick(e) {
        if (e.target.classList.contains('delete-btn') || !Number.isFinite(this.totalDuration) || this.totalDuration <= 0) return;
        const rect = this.timelineBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const time = this.totalDuration * pos;
        await this.seekTo(time); 
    }

    getCurrentTime() {
        if (this.videoElement && Number.isFinite(this.videoElement.currentTime) && Number.isFinite(this.currentTimeOffset)) {
            return this.currentTimeOffset + this.videoElement.currentTime;
        }
        return this.currentTimeOffset; // Or just 0 if videoElement is not ready
    }

    async seekTo(time) {
        if (!Number.isFinite(time) || time < 0 || (this.totalDuration > 0 && time > this.totalDuration) || this.videos.length === 0) {
            console.warn(`SeekTo: Invalid time ${time} or no videos.`);
            return;
        }

        let accumulatedTime = 0;
        for (let i = 0; i < this.videos.length; i++) {
            const segmentDuration = (this.durations[i] && Number.isFinite(this.durations[i])) ? this.durations[i] : 0;
            const nextTimeBoundary = accumulatedTime + segmentDuration;
            
            if (time <= nextTimeBoundary || i === this.videos.length - 1) { // Also handle if it's the last segment
                this.currentIndex = i;
                this.currentTimeOffset = accumulatedTime;
                await this.loadVideo(i); // loadVideo should handle pausing/playing
                
                const seekInCurrentVideo = Math.max(0, time - accumulatedTime);
                if (this.videoElement && Number.isFinite(seekInCurrentVideo)) {
                    this.videoElement.currentTime = seekInCurrentVideo;
                }
                
                // If playing, ensure it continues. loadVideo might pause.
                if (this.isPlaying && this.videoElement && this.videoElement.paused) {
                    this.videoElement.play().catch(e => console.warn("SeekTo: Play interrupted", e));
                }
                this.updateTimeDisplay();
                break;
            }
            accumulatedTime = nextTimeBoundary;
        }
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

        // Always create a new array to avoid reference issues
        this.videos = [];
        if (videoFiles && videoFiles.length > 0) {
            // Convert FileList to Array and filter out any non-blob items
            this.videos = Array.from(videoFiles).filter(file => 
                file instanceof Blob || file instanceof File
            );
        }
        
        if (audioFile === null) {
            this.audioFile = null;
        } else if (audioFile !== undefined) {
            this.audioFile = audioFile;
        }
        
        this.currentIndex = 0;
        this.currentTimeOffset = 0;

        // Make sure this method exists and is properly defined
        await this.loadMediaDurations();

        // Try to load the first video if any videos are available
        if (this.videos.length > 0) {
            this.currentTimeOffset = 0; 
            await this.loadVideo(0);
            
            // Process audio if needed
            if (this.processors && this.processors.audio) {
                if (this.audioFile) {
                    await this.processors.audio.process({ file: this.audioFile });
                } else { 
                    await this.processors.audio.clearAudio();
                }
            }
            
            this.updateTimelineSegments();
            this.updateTimeDisplay();
            this.debugElement.textContent = 'Статус: Media loaded successfully';
        } else {
            if (this.videoElement) this.videoElement.src = '';
            this.currentTimeOffset = 0;
            
            if (this.processors?.audio) {
                await this.processors.audio.clearAudio();
            }
            
            this.updateTimelineSegments();
            this.updateTimeDisplay();
            this.debugElement.textContent = 'Статус: Timeline cleared';
        }
    }

    async loadMediaDurations() {
        let videoTotalDurationNum = 0;
        const newDurations = [];

        if (this.videos && this.videos.length > 0) {
            console.log('Loading durations for videos:', this.videos.length);
            for (let i = 0; i < this.videos.length; i++) {
                const videoFile = this.videos[i];
                let duration = 0;

                if (videoFile instanceof Blob || videoFile instanceof File) {
                    // Prioritize _knownDuration if it exists and is valid
                    if (videoFile._knownDuration !== undefined && Number.isFinite(videoFile._knownDuration) && videoFile._knownDuration >= 0) {
                        duration = videoFile._knownDuration;
                        console.log(`Video ${i+1} using known duration: ${duration}`);
                    } else {
                        duration = await this.getVideoDuration(videoFile);
                        console.log(`Video ${i+1} calculated duration: ${duration}`);
                    }
                } else {
                    console.warn("Invalid video item at index", i, videoFile);
                }
                newDurations.push(duration);
                videoTotalDurationNum += duration;
            }
        }
        this.durations = newDurations;

        let audioDurationNum = 0;
        if (this.audioFile) {
            audioDurationNum = await this.getAudioFileDuration(this.audioFile); 
        }
        this.audioDuration = audioDurationNum; 
        
        // Ensure totalDuration is never 0 if we have videos
        this.totalDuration = Math.max(videoTotalDurationNum, audioDurationNum);
        if (this.videos.length > 0 && this.totalDuration === 0) {
            // If we have videos but total duration is 0, set a minimum
            this.totalDuration = 0.1; // 0.1 second minimum for display purposes
        }
        if (!Number.isFinite(this.totalDuration) || this.totalDuration < 0) {
            this.totalDuration = 0; 
        }
        
        console.log('Total duration calculated:', this.totalDuration);
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
                console.error(`Error creating object URL for audio file ${file.name || 'unknown file'}:`, error);
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
                console.error("Error loading audio duration for file:", file.name || 'unknown file');
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

        console.log('Rendering timeline for videos:', this.videos.length, 'with durations:', this.durations, 'total duration:', this.totalDuration);

        this.timelineBar.innerHTML = ''; // Clear existing content
        let currentVideoOffset = 0;
        let timelineBarActualHeight = 40; // Default height for video track

        // Render video tracks
        if (this.videos && this.videos.length > 0) {
            this.videos.forEach((video, index) => {
                const segment = document.createElement('div');
                segment.className = 'timeline-segment video-segment';
                
                const segmentDuration = (Number.isFinite(this.durations[index]) && this.durations[index] >= 0) 
                    ? this.durations[index] 
                    : 0;
                
                let widthPercent = 0;
                let leftPercent = 0;
                
                if (this.totalDuration > 0) {
                    widthPercent = (segmentDuration / this.totalDuration) * 100;
                    leftPercent = (currentVideoOffset / this.totalDuration) * 100;
                } else if (this.videos.length > 0) { 
                    widthPercent = 100 / this.videos.length;
                    leftPercent = (index * 100) / this.videos.length;
                }
                
                if (widthPercent > 0 && widthPercent < 1) {
                    widthPercent = 1;
                }
                
                segment.style.width = `${Math.max(0, Math.min(100, widthPercent))}%`;
                segment.style.left = `${Math.max(0, Math.min(100 - widthPercent, leftPercent))}%`;
                segment.style.top = '0px';
                segment.style.height = '40px'; 
                
                segment.style.background = segmentDuration === 0 ? 
                    'repeating-linear-gradient(45deg, #e74c3c, #e74c3c 10px, #c0392b 10px, #c0392b 20px)' : 
                    '#3498db';
                if (segmentDuration === 0) segment.style.opacity = '0.7';
                
                const label = document.createElement('div');
                label.className = 'video-info';
                const startNum = Number.isFinite(currentVideoOffset) ? currentVideoOffset : 0;
                const endNum = startNum + segmentDuration;
                label.textContent = `Video ${index + 1} (${this.formatTime(startNum)}-${this.formatTime(endNum)})`;
                
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
                
                currentVideoOffset += segmentDuration;
            });
        }
        
        // Render audio track separately below video tracks
        if (this.audioFile) {
            const audioTrackHeight = 25;
            const gap = 5; 
            const audioTopPos = (this.videos && this.videos.length > 0 ? timelineBarActualHeight : 0) + gap;
            
            timelineBarActualHeight = audioTopPos + audioTrackHeight; // Update total height
            
            const audioSegment = document.createElement('div');
            audioSegment.className = 'timeline-segment audio-segment';
            
            const finiteAudioDuration = (Number.isFinite(this.audioDuration) && this.audioDuration >= 0) ? this.audioDuration : 0;
            
            // Audio track should always visually span the full width of the timeline bar
            audioSegment.style.width = '100%'; 
            audioSegment.style.left = '0%';
            audioSegment.style.top = `${audioTopPos}px`; 
            audioSegment.style.height = `${audioTrackHeight}px`;
            audioSegment.style.background = 'linear-gradient(90deg, #fd79a8, #fdcb6e)';
            audioSegment.style.border = '1px solid #e17055';
            
            const audioLabel = document.createElement('div');
            audioLabel.className = 'audio-info';
            audioLabel.style.color = 'white';
            audioLabel.style.fontSize = '12px';
            audioLabel.style.padding = '2px 8px';
            const audioName = this.audioFile.name || 'Audio File';
            // Display the actual duration of the audio file in the label
            audioLabel.textContent = `♪ ${audioName.substring(0, 20)}${audioName.length > 20 ? '...' : ''} (${this.formatTime(finiteAudioDuration)})`;


            const deleteAudioBtn = document.createElement('button');
            deleteAudioBtn.className = 'delete-btn audio-delete';
            deleteAudioBtn.textContent = '×';
            deleteAudioBtn.style.top = '2px'; 
            deleteAudioBtn.style.right = '2px';
            deleteAudioBtn.style.background = '#e17055';
            deleteAudioBtn.onclick = (e) => {
                e.stopPropagation();
                this.removeAudio(); // Assuming you have a removeAudio method
            };
            
            audioSegment.appendChild(audioLabel);
            audioSegment.appendChild(deleteAudioBtn);
            this.timelineBar.appendChild(audioSegment);
        }
        
        // Set the overall height of the timeline bar
        const minHeight = (this.videos && this.videos.length > 0) || this.audioFile ? 
            (this.audioFile && (!this.videos || this.videos.length === 0) ? 30 : timelineBarActualHeight) : 0; // Min height if only audio
        this.timelineBar.style.height = `${Math.max(minHeight, timelineBarActualHeight)}px`;
        
        // Add cursor and progress elements (handled by setupTimelineElements)
        this.setupTimelineElements(); 
        this.updateTimeDisplay(); 
    }

    async loadVideo(index) {
        if (this.videoElement && this.videos && index >= 0 && index < this.videos.length) {
            this.videoElement.pause(); 
            
            // Calculate currentTimeOffset
            this.currentTimeOffset = 0;
            for (let i = 0; i < index; i++) {
                if (this.durations[i] && Number.isFinite(this.durations[i])) {
                    this.currentTimeOffset += this.durations[i];
                }
            }

            const videoBlob = this.videos[index];
            if (!videoBlob || !(videoBlob instanceof Blob || videoBlob instanceof File)) {
                console.error("Invalid video blob at index", index);
                this.debugElement.textContent = 'Ошибка: Неверный формат видео';
                return Promise.reject(new Error("Invalid video blob"));
            }

            if (videoBlob.size === 0) {
                console.warn("Video blob has 0 size at index", index);
                this.debugElement.textContent = 'Предупреждение: Видео имеет нулевой размер';
                this.updateTimeDisplay();
                return Promise.resolve();
            }

            const videoUrl = URL.createObjectURL(videoBlob);
            this.videoElement.src = videoUrl;
            this.currentIndex = index;
            
            // Оптимизация: устанавливаем preload для лучшей производительности
            this.videoElement.preload = 'metadata';
            
            return new Promise((resolve, reject) => {
                const cleanup = () => {
                    URL.revokeObjectURL(videoUrl);
                };
                
                this.videoElement.onloadedmetadata = () => {
                    console.log("Video loaded successfully at index", index);
                    if (this.isPlaying) {
                        this.videoElement.play().catch(e => console.warn("Play interrupted on load:", e.name, e.message));
                    }
                    resolve();
                };
                
                this.videoElement.onerror = (e) => {
                    console.error("Error loading video at index", index, ":", e);
                    cleanup();
                    this.debugElement.textContent = `Ошибка загрузки видео ${index + 1}`;
                    resolve();
                };
                
                // Уменьшенный таймаут
                setTimeout(() => {
                    if (this.videoElement.readyState < 2) {
                        console.warn("Video loading timeout at index", index);
                        cleanup();
                        resolve();
                    }
                }, 3000); // Уменьшен с 5000 до 3000
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
            video.muted = true;
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
            let recorder; 
            let canvas;
            let isRecording = false;
            
            const cleanup = () => {
                if (srcUrl) URL.revokeObjectURL(srcUrl); 
                if (recorder && recorder.state !== 'inactive') {
                    recorder.stop();
                }
                video.remove(); 
            };

            video.onloadedmetadata = () => {
                if (video.videoWidth === 0 || video.videoHeight === 0) {
                    cleanup();
                    reject(new Error("Invalid video dimensions"));
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
                        videoBitsPerSecond: 1000000
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
                    isRecording = false;
                    if (chunks.length > 0) {
                        resolve(new Blob(chunks, { type: 'video/webm' }));
                    } else {
                        reject(new Error("No data recorded"));
                    }
                };
                
                recorder.onerror = (event) => {
                    cleanup();
                    isRecording = false;
                    reject(event.error || new Error("Recording failed"));
                };

                // Сначала позиционируемся, потом запускаем запись
                video.currentTime = start;
                
                video.onseeked = () => {
                    if (!isRecording && recorder.state === 'inactive') {
                        isRecording = true;
                        recorder.start(100);
                        
                        const targetDuration = (end - start) * 1000; // в миллисекундах
                        const startTime = Date.now();
                        
                        const renderFrame = () => {
                            const elapsed = Date.now() - startTime;
                            const currentPos = video.currentTime;
                            
                            if (elapsed >= targetDuration || currentPos >= end || video.ended || !isRecording) {
                                if (isRecording && recorder.state === "recording") {
                                    recorder.stop();
                                }
                                return;
                            }
                            
                            // Рисуем текущий кадр
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            
                            // Переходим к следующему кадру
                            const progress = elapsed / targetDuration;
                            const nextTime = start + (end - start) * progress;
                            video.currentTime = Math.min(nextTime, end);
                            
                            // Продолжаем рендеринг
                            setTimeout(renderFrame, 33); // ~30 FPS
                        };
                        
                        renderFrame();
                    }
                };
            };

            video.onerror = (e) => {
                cleanup();
                reject(new Error(`Video loading failed: ${e.message || 'Unknown error'}`));
            };
        });
    }
    
    async trim(startTime, endTime) { 
        if (!this.videos || this.videos.length === 0) {
            this.logError("Нет видео для обрезки.");
            return;
        }
        
        // Validate trim times
        const currentTotalDuration = (Number.isFinite(this.totalDuration) && this.totalDuration > 0) ? this.totalDuration : 0;
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < 0 || endTime < startTime || 
            (currentTotalDuration > 0 && endTime > currentTotalDuration)) {
            this.logError(`Некорректный общий интервал для обрезки: ${startTime}-${endTime}. Общая длительность: ${currentTotalDuration}`);
            return;
        }

        try {
            this.videoElement.pause();
            this.isPlaying = false;
            document.getElementById('playPauseBtn').textContent = 'Play';
            
            let newVideos = [];
            let accumulatedTimeBeforeSegment = 0; 

            for (let i = 0; i < this.videos.length; i++) {
                const videoFile = this.videos[i];
                const originalSegmentDuration = (this.durations[i] && Number.isFinite(this.durations[i])) ? this.durations[i] : 0;
                const segmentEndBoundaryInTimeline = accumulatedTimeBeforeSegment + originalSegmentDuration;
                
                const effectiveTrimStart = Math.max(startTime, accumulatedTimeBeforeSegment);
                const effectiveTrimEnd = Math.min(endTime, segmentEndBoundaryInTimeline);
                
                if (effectiveTrimEnd > effectiveTrimStart) { 
                    const trimStartInSegment = effectiveTrimStart - accumulatedTimeBeforeSegment;
                    const trimEndInSegment = effectiveTrimEnd - accumulatedTimeBeforeSegment;
                    
                    if (trimEndInSegment > trimStartInSegment) {
                        const trimmedSegmentBlob = await this.trimVideoSegment(videoFile, trimStartInSegment, trimEndInSegment);
                        if (trimmedSegmentBlob.size > 0) {
                            newVideos.push(trimmedSegmentBlob);
                        }
                    }
                }
                accumulatedTimeBeforeSegment += originalSegmentDuration; // Use original duration for offset calculation
            }

            this.videos = newVideos;
            
            await this.loadMediaDurations(); // Recalculate all durations based on new video blobs
            
            this.currentIndex = 0;
            this.currentTimeOffset = 0;
            
            if (this.videos.length > 0) {
                await this.loadVideo(0);
            } else {
                if (this.videoElement) this.videoElement.src = ''; 
            }
            
            if (this.audioFile && this.processors?.audio) {
                await this.processors.audio.applyAudio(); 
            }

            this.updateTimelineSegments(); // Render timeline with new durations
            this.updateTimeDisplay();
            this.debugElement.textContent = `Статус: Обрезка выполнена с ${startTime.toFixed(2)}с до ${endTime.toFixed(2)}с`;
        } catch (error) {
            console.error('Error trimming video:', error);
            this.logError('Ошибка при обрезке видео: ' + error.message);
        }
    }
    
    async trimSingleVideo(index, startTime, endTime) {
        if (!this.videos || this.videos.length === 0) {
            this.logError('Нет видео для обрезки.');
            return;
        }
        
        if (index < 0 || index >= this.videos.length) {
            this.logError('Неверный индекс видео для обрезки.');
            return;
        }

        const videoFileToTrim = this.videos[index];
        const originalSegmentDuration = (Number.isFinite(this.durations[index]) && this.durations[index] >= 0) 
            ? this.durations[index] 
            : 0;

        const safeStartTime = (Number.isFinite(startTime) && startTime >= 0) ? startTime : 0;
        const safeEndTime = (Number.isFinite(endTime) && endTime >= safeStartTime) ? endTime : originalSegmentDuration;

        if (safeStartTime < 0 || safeEndTime > originalSegmentDuration || safeStartTime === safeEndTime) {
            this.logError(`Время для обрезки видео ${index + 1} некорректно или нулевая длительность. Start: ${safeStartTime.toFixed(2)}, End: ${safeEndTime.toFixed(2)}, Original Duration: ${originalSegmentDuration.toFixed(2)}`);
            if (safeStartTime === safeEndTime && safeStartTime !== 0) { // Allow 0 to 0 if original is 0
                 // If trim results in zero duration, consider removing or handling as error
                this.logError('Обрезка приведет к нулевой длительности.');
            }
            return;
        }

        const expectedTrimmedDuration = safeEndTime - safeStartTime;
        console.log(`Trimming video ${index} from ${safeStartTime}s to ${safeEndTime}s, expected duration: ${expectedTrimmedDuration}s`);

        try {
            this.debugElement.textContent = `Status: Video trimming in progress... (${(expectedTrimmedDuration).toFixed(1)}s segment)`;
            
            this.videoElement.pause();
            this.isPlaying = false;
            const playPauseBtn = document.getElementById('playPauseBtn');
            if (playPauseBtn) playPauseBtn.textContent = 'Play';

            const trimmedVideoBlob = await this.trimVideoSegmentLowLatency(videoFileToTrim, safeStartTime, safeEndTime);
            console.log('Trimmed video blob size:', trimmedVideoBlob.size);
            
            if (trimmedVideoBlob.size === 0 && expectedTrimmedDuration > 0) {
                console.warn('Trimmed video has 0 size but expected duration > 0');
                this.logError('Обрезанное видео имеет нулевой размер, хотя ожидалась ненулевая длительность.');
                // Optionally, restore original duration or handle as error
                // this.durations[index] = originalSegmentDuration; 
                return;
            }
            
            // Store the known duration on the blob itself
            trimmedVideoBlob._knownDuration = expectedTrimmedDuration;

            this.videos[index] = trimmedVideoBlob;
            this.durations[index] = expectedTrimmedDuration;
            console.log(`Manually set duration for video ${index} to ${expectedTrimmedDuration}s`);
            
            // Пересчитываем общую длительность
            let videoTotalDuration = 0;
            for (let i = 0; i < this.durations.length; i++) {
                if (Number.isFinite(this.durations[i])) {
                    videoTotalDuration += this.durations[i];
                }
            }
            
            this.totalDuration = Math.max(videoTotalDuration, this.audioDuration || 0);
            console.log('Updated total duration:', this.totalDuration);
            
            // Пересчитываем смещение по времени
            this.currentTimeOffset = 0;
            for (let i = 0; i < this.currentIndex; i++) {
                this.currentTimeOffset += (Number.isFinite(this.durations[i]) ? this.durations[i] : 0);
            }
            
            // Загружаем видео без перезагрузки всех сегментов
            if (this.videos.length > 0) {
                await this.loadVideo(this.currentIndex);
            }
            
            // Обновляем аудио если есть
            if (this.audioFile && this.processors?.audio) {
                await this.processors.audio.applyAudio();
            }
            
            this.updateTimelineSegments();
            this.updateTimeDisplay();
            this.debugElement.textContent = `Status: Video ${index + 1} trimmed successfully (${expectedTrimmedDuration.toFixed(2)}s)`;
            
        } catch (error) {
            console.error('Error trimming single video:', error);
            this.logError('Ошибка при обрезке видео: ' + error.message);
        }
    }

    // Исправленная версия обрезки с сохранением аудио
    async trimVideoSegmentLowLatency(videoFile, start, end) {
        return new Promise((resolve, reject) => {
            if (start >= end) {
                // Resolve with an empty blob that has a known duration of 0
                const emptyBlob = new Blob([], { type: 'video/mp4' });
                emptyBlob._knownDuration = 0;
                resolve(emptyBlob); 
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
            
            // ВАЖНО: НЕ отключаем звук для записи оригинального аудио
            video.muted = false; // Crucial for audio capture
            video.preload = 'auto';
            video.crossOrigin = 'anonymous';
            
            let recorder; 
            let canvas, ctx, audioContext; 
            let isRecording = false;
            let audioSourceNode = null;
            
            const cleanup = () => {
                if (srcUrl) URL.revokeObjectURL(srcUrl); 
                if (recorder && recorder.state !== 'inactive') {
                    recorder.stop();
                }
                if (audioSourceNode) {
                    audioSourceNode.disconnect();
                    audioSourceNode = null;
                }
                if (audioContext && audioContext.state !== 'closed') {
                    audioContext.close().catch(e => console.warn("Error closing audio context:", e));
                }
                video.remove(); 
            };

            video.onloadedmetadata = async () => {
                if (video.videoWidth === 0 || video.videoHeight === 0) {
                    cleanup();
                    reject(new Error("Invalid video dimensions"));
                    return;
                }
                
                try {
                    // Создаем canvas для видео
                    canvas = document.createElement('canvas');
                    ctx = canvas.getContext('2d', { willReadFrequently: true }); // Инициализируем ctx
                    
                    // Сохраняем оригинальное разрешение для лучшего качества
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    
                    // Создаем аудио контекст для захвата звука
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    
                    // Создаем источник аудио из видео элемента
                    const mediaElementSource = audioContext.createMediaElementSource(video);
                    audioSourceNode = mediaElementSource;
                    const audioDestination = audioContext.createMediaStreamDestination();
                    
                    mediaElementSource.connect(audioDestination);
                    // Do NOT connect to audioContext.destination for silent trimming
                    
                    // Получаем видео поток с canvas
                    const videoStream = canvas.captureStream(30);
                    
                    // Комбинируем видео и аудио потоки
                    const combinedStream = new MediaStream([
                        videoStream.getVideoTracks()[0],
                        ...audioDestination.stream.getAudioTracks()
                    ]);
                    
                    // Настраиваем recorder с поддержкой MP4 и WebM
                    const mimeTypes = [
                        'video/mp4;codecs=h264,aac',  // Приоритет MP4
                        'video/webm;codecs=vp9,opus',
                        'video/webm;codecs=vp8,opus',
                        'video/webm'
                    ];
                    
                    let selectedMimeType = '';
                    for (const mimeType of mimeTypes) {
                        if (MediaRecorder.isTypeSupported(mimeType)) {
                            selectedMimeType = mimeType;
                            break;
                        }
                    }
                    
                    if (!selectedMimeType) {
                        cleanup();
                        reject(new Error("No supported video format found"));
                        return;
                    }
                    
                    console.log(`Using MIME type: ${selectedMimeType}`);
                    
                    recorder = new MediaRecorder(combinedStream, {
                        mimeType: selectedMimeType,
                        videoBitsPerSecond: 2000000, // 2 Mbps для хорошего качества
                        audioBitsPerSecond: 128000   // 128 kbps для аудио
                    });

                } catch (e) {
                    cleanup();
                    reject(new Error(`MediaRecorder setup failed: ${e.message}`));
                    return;
                }

                const chunks = [];
                recorder.ondataavailable = e => {
                    if (e.data.size > 0) chunks.push(e.data);
                };

                recorder.onstop = () => {
                    cleanup();
                    isRecording = false;
                    if (chunks.length > 0) {
                        // Определяем тип файла на основе MIME типа
                        const mimeType = recorder.mimeType;
                        const fileType = mimeType.includes('mp4') ? 'video/mp4' : 'video/webm';
                        resolve(new Blob(chunks, { type: fileType }));
                    } else {
                        reject(new Error("No data recorded"));
                    }
                };
                
                recorder.onerror = (event) => {
                    cleanup();
                    isRecording = false;
                    reject(event.error || new Error("Recording failed"));
                };

                // Позиционируемся в начало обрезки
                video.currentTime = start;
                
                video.onseeked = async () => {
                    // Try to "prime" the video element for audio capture
                    try {
                        if (video.paused) { // Only play/pause if actually paused
                            await video.play();
                            video.pause();
                        }
                    } catch (e) {
                        console.warn("Error trying to prime video for audio capture:", e);
                    }

                    if (!isRecording && recorder.state === 'inactive') {
                        isRecording = true;
                        recorder.start(100); // Start recording with a short timeslice
                        
                        const targetDurationMs = (end - start) * 1000;
                        const frameIntervalMs = 1000 / 30; // Target ~30 FPS
                        let accumulatedTimeMsInSegment = 0;
                        let lastFrameTime = performance.now();

                        const renderAndCaptureFrame = async () => {
                            if (!isRecording || accumulatedTimeMsInSegment >= targetDurationMs) {
                                if (recorder.state === "recording") {
                                    recorder.stop();
                                }
                                return;
                            }

                            const now = performance.now();
                            const deltaTime = now - lastFrameTime;
                            lastFrameTime = now;
                            
                            // Ensure we don't seek beyond the 'end' or process too fast
                            const currentVideoTimeToSeek = Math.min(start + (accumulatedTimeMsInSegment / 1000), end);
                            
                            if (Math.abs(video.currentTime - currentVideoTimeToSeek) > 0.05) { // Only seek if significantly different
                                video.currentTime = currentVideoTimeToSeek;
                                await new Promise(resolveSeek => {
                                    const onSeekedFrame = () => {
                                        video.removeEventListener('seeked', onSeekedFrame);
                                        resolveSeek();
                                    };
                                    video.addEventListener('seeked', onSeekedFrame);
                                });
                            }
                            
                            if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            }
                            
                            accumulatedTimeMsInSegment += deltaTime; // Use actual elapsed time for stepping
                            
                            // Request next frame, aiming for frameIntervalMs but adapting
                            setTimeout(renderAndCaptureFrame, Math.max(0, frameIntervalMs - (performance.now() - now)));
                        };
                        
                        renderAndCaptureFrame();
                    }
                };
            };

            video.onerror = (e) => {
                cleanup();
                reject(new Error(`Video loading failed: ${e.message || 'Unknown error'}`));
            };
        });
    }

    async exportVideo(exportOptions = {}) {
        if ((!this.videos || this.videos.length === 0) && !this.audioFile) {
            this.logError("No media to export.");
            return null;
        }

        const { 
            includeOriginalAudio = true, 
            includeOverlayAudio = true,
            format = 'webm',
            quality = 'medium'
        } = exportOptions;

        this.debugElement.textContent = "Status: Preparing export...";
        
        try {
            // Простой случай - одно видео без дополнительной обработки
            if (this.videos.length === 1 && !this.audioFile && includeOriginalAudio && 
                !this.processors?.text?.textElement?.textContent && 
                !this.processors?.filter?.currentFilter) {
                this.debugElement.textContent = "Status: Export finished.";
                return this.videos[0];
            }
            
            // Сложный экспорт с обработкой
            return await this.exportWithProcessing(exportOptions);
            
        } catch (error) {
            console.error('Export error:', error);
            this.logError('Ошибка при экспорте видео: ' + error.message);
            this.debugElement.textContent = "Status: Export failed. " + error.message;
            return null; 
        }
    }

    async exportWithProcessing(exportOptions) {
        const { 
            includeOriginalAudio = true, 
            includeOverlayAudio = true,
            quality = 'medium',
            format = 'webm' // Default to webm, mp4 can be chosen
        } = exportOptions;
        
        this.debugElement.textContent = "Status: Export processing started...";
        let audioContext; // Define audioContext here to ensure it's closable

        try {
            if (!this.videos || this.videos.length === 0) {
                throw new Error("No videos to export");
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            const firstVideoForMeta = document.createElement('video');
            firstVideoForMeta.src = URL.createObjectURL(this.videos[0]);
            await new Promise((resolve, reject) => {
                firstVideoForMeta.onloadedmetadata = resolve;
                firstVideoForMeta.onerror = (e) => reject(new Error(`Failed to load metadata for first video: ${e.message || e.type}`));
            });
            canvas.width = firstVideoForMeta.videoWidth;
            canvas.height = firstVideoForMeta.videoHeight;
            URL.revokeObjectURL(firstVideoForMeta.src);

            const videoStreamFromCanvas = canvas.captureStream(30); 
            
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioDestinationNode = audioContext.createMediaStreamDestination();
            const tracksForCombinedStream = [...videoStreamFromCanvas.getVideoTracks()];

            let overlayAudioElement = null;
            let overlayAudioSourceNode = null;
            if (includeOverlayAudio && this.audioFile) {
                overlayAudioElement = new Audio(URL.createObjectURL(this.audioFile));
                await new Promise(r => overlayAudioElement.onloadedmetadata = r);
                overlayAudioSourceNode = audioContext.createMediaElementSource(overlayAudioElement);
                overlayAudioSourceNode.connect(audioDestinationNode);
                const totalVideoDuration = this.durations.reduce((acc, cur) => acc + (Number.isFinite(cur) ? cur : 0), 0);
                overlayAudioElement.loop = (overlayAudioElement.duration > 0 && totalVideoDuration > overlayAudioElement.duration);
                this.debugElement.textContent = "Status: Overlay audio prepared.";
            }
            
            // Add audio tracks from the destination node to the combined stream
            // This stream is dynamic and will reflect sources connected/disconnected from audioDestinationNode
            tracksForCombinedStream.push(...audioDestinationNode.stream.getAudioTracks());
            
            const mimeTypesToTry = format === 'mp4' ? 
                ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=h264,aac', 'video/mp4'] : 
                ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
            
            let selectedMimeType = mimeTypesToTry.find(type => MediaRecorder.isTypeSupported(type));
            if (!selectedMimeType) {
                console.warn("Preferred MIME type not supported, falling back to video/webm");
                selectedMimeType = 'video/webm'; 
                if (!MediaRecorder.isTypeSupported(selectedMimeType)) {
                     throw new Error("No supported MIME type found for MediaRecorder (webm/mp4).");
                }
            }
            console.log(`Export using: ${selectedMimeType}`);

            const recorder = new MediaRecorder(new MediaStream(tracksForCombinedStream), {
                mimeType: selectedMimeType,
                videoBitsPerSecond: quality === 'high' ? 5000000 : (quality === 'medium' ? 2500000 : 1000000),
                audioBitsPerSecond: 128000 
            });
            
            const chunks = [];
            recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
            
            recorder.start();
            if (overlayAudioElement) await overlayAudioElement.play().catch(e => console.warn("Overlay audio play failed:", e));

            for (let i = 0; i < this.videos.length; i++) {
                const videoFile = this.videos[i];
                const segmentDuration = this.durations[i];
                this.debugElement.textContent = `Status: Processing segment ${i + 1}/${this.videos.length}...`;

                const segmentPlayer = document.createElement('video');
                const segmentSrcUrl = URL.createObjectURL(videoFile);
                segmentPlayer.src = segmentSrcUrl;
                
                await new Promise((resolve, reject) => { 
                    segmentPlayer.onloadedmetadata = resolve; 
                    segmentPlayer.onerror = (e) => reject(new Error(`Failed to load metadata for segment ${i+1}: ${e.message || e.type}`));
                });

                let segmentAudioSourceNode = null;

                if (includeOriginalAudio) {
                    try {
                        // Attempt to create and connect audio source for this segment
                        segmentAudioSourceNode = audioContext.createMediaElementSource(segmentPlayer);
                        segmentAudioSourceNode.connect(audioDestinationNode);
                        segmentPlayer.muted = false; 
                        console.log(`Audio source connected for segment ${i + 1}: ${videoFile.name || 'Blob'}`);
                    } catch (e) {
                        // This catch block will handle cases where MediaElementSourceNode cannot be created (e.g., truly no audio track)
                        console.warn(`Could not create/connect audio source for segment ${i + 1} (${videoFile.name || 'Blob'}): ${e.message}. Video might have no audio or an issue with the audio track.`);
                        segmentPlayer.muted = true; // Mute if source creation fails or if it's confirmed no audio
                    }
                } else {
                    segmentPlayer.muted = true; 
                }
                
                await segmentPlayer.play().catch(e => console.warn(`Segment ${i+1} play error: ${e.name} - ${e.message}`));
                
                let RENDER_FRAMES_FOR_SEGMENT_DURATION = 0;
                const frameDuration = 1000 / 30; 

                while(RENDER_FRAMES_FOR_SEGMENT_DURATION < segmentDuration * 1000 && !segmentPlayer.ended) {
                    if (segmentPlayer.videoWidth > 0 && segmentPlayer.videoHeight > 0) {
                         ctx.drawImage(segmentPlayer, 0, 0, canvas.width, canvas.height);
                    }
                    if (this.processors?.filter?.applyFilterToCanvas) {
                        this.processors.filter.applyFilterToCanvas(ctx, canvas);
                    }
                    if (this.processors?.text?.drawTextOnCanvas) { // Assuming text processor has this method
                       this.processors.text.drawTextOnCanvas(ctx, canvas);
                    }
                    await new Promise(r => setTimeout(r, frameDuration));
                    RENDER_FRAMES_FOR_SEGMENT_DURATION += frameDuration;
                }
                
                segmentPlayer.pause();
                if (segmentAudioSourceNode) {
                    segmentAudioSourceNode.disconnect(); 
                }
                URL.revokeObjectURL(segmentSrcUrl);
            }

            if (overlayAudioElement) {
                overlayAudioElement.pause();
                if (overlayAudioElement.src && overlayAudioElement.src.startsWith('blob:')) {
                    URL.revokeObjectURL(overlayAudioElement.src);
                }
            }
            if (overlayAudioSourceNode) {
                overlayAudioSourceNode.disconnect();
            }
            
            recorder.stop();
            
            return new Promise((resolve, reject) => {
                recorder.onstop = () => {
                    audioContext.close().catch(e => console.warn("Error closing audio context:", e));
                    if (chunks.length === 0) {
                        this.debugElement.textContent = "Status: Export failed (no data recorded).";
                        reject(new Error('Generated video is empty. Check console for errors.'));
                        return;
                    }
                    const blob = new Blob(chunks, { type: selectedMimeType.split(';')[0] });
                    this.debugElement.textContent = "Status: Export finished successfully.";
                    resolve(blob);
                };
                recorder.onerror = (event) => {
                    audioContext.close().catch(e => console.warn("Error closing audio context on recorder error:", e));
                    this.debugElement.textContent = `Status: Export failed (${event.error?.name || 'Unknown error'}).`;
                    reject(event.error || new Error("MediaRecorder failed"));
                };
            });
            
        } catch (error) {
            console.error('Export processing error:', error);
            this.debugElement.textContent = `Status: Export error - ${error.message}`;
            if (audioContext && audioContext.state !== 'closed') { 
                audioContext.close().catch(e => console.warn("Error closing audio context on main catch:", e));
            }
            throw error; // Re-throw to be caught by calling function if necessary
        }
    }

    async removeVideo(index) { 
        if (index >= 0 && index < this.videos.length) {
            this.videoElement.pause();
            this.isPlaying = false;
            document.getElementById('playPauseBtn').textContent = 'Play';
            
            const removedVideo = this.videos.splice(index, 1)[0];
            
            await this.loadMediaDurations(); // Recalculate all durations
            
            // Adjust currentIndex and currentTimeOffset
            if (this.currentIndex >= this.videos.length && this.videos.length > 0) {
                this.currentIndex = this.videos.length - 1;
            } else if (this.videos.length === 0) {
                this.currentIndex = 0;
            }
            
            this.currentTimeOffset = 0;
            for(let i = 0; i < this.currentIndex; i++) {
                if (this.durations[i] && Number.isFinite(this.durations[i])) {
                    this.currentTimeOffset += this.durations[i];
                }
            }
            
            this.updateTimelineSegments(); // Render timeline with new durations
            
            if (this.videos.length > 0) {
                await this.loadVideo(this.currentIndex);
            } else {
                if (this.videoElement) this.videoElement.src = '';
                this.currentTimeOffset = 0; // Ensure offset is 0 if no videos
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
        
        // Recalculate total duration based only on videos
        let videoTotalDurationNum = 0;
        if (this.videos && this.videos.length > 0) {
            for (let i = 0; i < this.durations.length; i++) {
                videoTotalDurationNum += (Number.isFinite(this.durations[i]) ? this.durations[i] : 0);
            }
        }
        this.totalDuration = videoTotalDurationNum;
        if (this.videos.length > 0 && this.totalDuration === 0) {
            this.totalDuration = 0.1; 
        }
        if (!Number.isFinite(this.totalDuration) || this.totalDuration < 0) {
            this.totalDuration = 0; 
        }

        this.updateTimelineSegments();
        this.updateTimeDisplay();
        this.debugElement.textContent = 'Status: Audio removed';
    }
}