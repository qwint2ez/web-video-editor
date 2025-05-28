import { VideoProcessor } from './videoProcessor.js';

export class VideoMerger extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.videos = [];
        this.durations = [];
        this.totalDuration = 0;
        this.currentIndex = 0;
        this.currentTimeOffset = 0;
        this.isPlaying = false;
        
        this.timelineContainer = dependencies.timelineContainer;
        this.setupTimelineElements();
        this.bindEvents();
    }

    setupTimelineElements() {
        this.timelineBar = document.getElementById('timelineBar');
        if (!this.timelineBar) return;

        this.cursor = document.createElement('div');
        this.cursor.className = 'timeline-cursor';
        this.timelineBar.appendChild(this.cursor);

        this.progress = document.createElement('div');
        this.progress.className = 'timeline-progress';
        this.timelineBar.appendChild(this.progress);

        this.timelineBar.addEventListener('click', async (e) => {
            const rect = this.timelineBar.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            const time = this.totalDuration * pos;
            await this.seekTo(time);
        });
    }

    bindEvents() {
        if (this.videoElement) {
            this.videoElement.addEventListener('timeupdate', () => this.updateTimeDisplay());
            this.videoElement.addEventListener('ended', () => this.playNext());
        }
    }

    async process(params) {
        const { videoFiles } = params;
        if (!videoFiles?.length) {
            this.logError('Нет видео для обработки');
            return;
        }

        try {
            this.videos = Array.from(videoFiles);
            this.currentIndex = 0;
            this.durations = [];
            this.totalDuration = 0;
            this.currentTimeOffset = 0;

            await this.loadDurations();
            this.updateTimelineSegments();
            await this.loadVideo(0);
            
            this.debugElement.textContent = 'Статус: Видео успешно загружены';
        } catch (error) {
            this.logError('Ошибка при обработке видео: ' + error.message);
        }
    }

    async loadDurations() {
        for (const video of this.videos) {
            const duration = await this.getVideoDuration(video);
            this.durations.push(duration);
            this.totalDuration += duration;
        }
    }

    updateTimelineSegments() {
        if (!this.timelineBar) return;

        this.timelineBar.innerHTML = '';
        let offset = 0;

        this.videos.forEach((video, index) => {
            const segment = document.createElement('div');
            segment.className = 'timeline-segment';
            const width = (this.durations[index] / this.totalDuration) * 100;
            segment.style.width = `${width}%`;
            segment.style.left = `${(offset / this.totalDuration) * 100}%`;
            
            const label = document.createElement('div');
            label.className = 'video-info';
            label.textContent = `Видео ${index + 1} (${this.durations[index].toFixed(1)}с)`;
            
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
            
            offset += this.durations[index];
        });

        this.setupTimelineElements();
    }

    async loadVideo(index) {
        if (index >= 0 && index < this.videos.length) {
            const videoUrl = URL.createObjectURL(this.videos[index]);
            this.videoElement.src = videoUrl;
            this.currentIndex = index;
            
            return new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    if (this.isPlaying) {
                        this.videoElement.play();
                    }
                    resolve();
                };
            });
        }
    }

    async playNext() {
        if (this.currentIndex >= this.videos.length - 1) {
            this.currentIndex = 0;
            this.currentTimeOffset = 0;
            await this.loadVideo(0);
            this.isPlaying = false;
            this.videoElement.pause();
            document.getElementById('playPauseBtn').textContent = 'Play';
            return;
        }

        this.currentTimeOffset += this.durations[this.currentIndex];
        this.currentIndex++;
        await this.loadVideo(this.currentIndex);
        if (this.isPlaying) {
            await this.videoElement.play();
        }
    }

    async togglePlay() {
        try {
            if (this.videoElement.paused) {
                if (this.currentIndex >= this.videos.length) {
                    this.currentIndex = 0;
                    this.currentTimeOffset = 0;
                    await this.loadVideo(0);
                }
                this.isPlaying = true;
                document.getElementById('playPauseBtn').textContent = 'Pause';
                await new Promise((resolve) => {
                    if (this.videoElement.readyState >= 2) {
                        resolve();
                    } else {
                        this.videoElement.oncanplay = resolve;
                    }
                });
                await this.videoElement.play();
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
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const stream = canvas.captureStream();
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp8'
            });
            
            const chunks = [];
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                resolve(new Blob(chunks, { type: 'video/webm' }));
            };

            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                video.currentTime = start;
            };

            video.ontimeupdate = () => {
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0);
                
                if (video.currentTime >= end) {
                    mediaRecorder.stop();
                    video.pause();
                }
            };

            video.onplay = () => mediaRecorder.start();
            video.src = URL.createObjectURL(videoFile);
            video.play();
        });
    }

    async trim(startTime, endTime) {
        if (startTime < 0 || endTime > this.totalDuration || startTime >= endTime) {
            throw new Error(`Некорректный интервал времени. Должен быть между 0 и ${this.totalDuration.toFixed(1)} секунд`);
        }

        try {
            this.videoElement.pause();
            this.isPlaying = false;
            
            await this.ensureVideosLoaded();
            
            let newVideos = [];
            let newDurations = [];
            let currentTime = 0;

            for (let i = 0; i < this.videos.length; i++) {
                const videoEnd = currentTime + this.durations[i];
                
                if (startTime < videoEnd && endTime > currentTime) {
                    const trimStart = Math.max(0, startTime - currentTime);
                    const trimEnd = Math.min(this.durations[i], endTime - currentTime);
                    
                    if (trimEnd > trimStart) {
                        const trimmedVideo = await this.trimVideoSegment(this.videos[i], trimStart, trimEnd);
                        newVideos.push(trimmedVideo);
                        newDurations.push(trimEnd - trimStart);
                    }
                }
                currentTime = videoEnd;
            }

            if (newVideos.length > 0) {
                this.videos = newVideos;
                this.durations = newDurations;
                this.totalDuration = newDurations.reduce((a, b) => a + b, 0);
                this.currentIndex = 0;
                this.currentTimeOffset = 0;
                
                await this.loadVideo(0);
                this.updateTimelineSegments();
                this.updateTimeDisplay();
            }

        } catch (error) {
            console.error('Error trimming video:', error);
            throw new Error('Ошибка при обрезке видео');
        }
    }

    async ensureVideosLoaded() {
        const loadPromises = this.videos.map(video => {
            return new Promise((resolve) => {
                const tempVideo = document.createElement('video');
                tempVideo.preload = 'metadata';
                tempVideo.onloadedmetadata = () => resolve();
                tempVideo.src = URL.createObjectURL(video);
            });
        });
        await Promise.all(loadPromises);
    }

    async exportVideo() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const stream = canvas.captureStream();
            const chunks = [];

            const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp8'
            });

            recorder.ondataavailable = e => chunks.push(e.data);

            // Запускаем запись
            recorder.start();

            // Последовательно обрабатываем каждое видео
            for (let i = 0; i < this.videos.length; i++) {
                const video = document.createElement('video');
                video.src = URL.createObjectURL(this.videos[i]);
                
                await new Promise(resolve => {
                    video.onloadedmetadata = () => {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        resolve();
                    };
                });

                await video.play();

                while (video.currentTime < video.duration) {
                    ctx.drawImage(video, 0, 0);
                    await new Promise(r => setTimeout(r, 1000 / 30)); // 30 FPS
                }

                video.remove();
            }

            recorder.stop();

            return new Promise(resolve => {
                recorder.onstop = () => {
                    const finalBlob = new Blob(chunks, { type: 'video/webm' });
                    resolve(finalBlob);
                };
            });
        } catch (error) {
            console.error('Error exporting:', error);
            throw new Error('Ошибка при экспорте видео');
        }
    }

    // Добавляем метод для обрезки конкретного видео
    async trimSingleVideo(index, startTime, endTime) {
        if (index < 0 || index >= this.videos.length) {
            throw new Error('Неверный индекс видео');
        }

        const video = this.videos[index];
        const duration = this.durations[index];

        if (startTime < 0 || endTime > duration || startTime >= endTime) {
            throw new Error(`Время должно быть между 0 и ${duration.toFixed(1)} секунд`);
        }

        const trimmedVideo = await this.trimVideoSegment(video, startTime, endTime);
        this.videos[index] = trimmedVideo;
        this.durations[index] = endTime - startTime;
        this.totalDuration = this.durations.reduce((a, b) => a + b, 0);
        
        await this.loadVideo(this.currentIndex);
        this.updateTimelineSegments();
        this.updateTimeDisplay();
    }

    async getVideoDuration(file) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => resolve(video.duration);
            video.src = URL.createObjectURL(file);
        });
    }

    async seekTo(time) {
        if (time < 0 || time > this.totalDuration) return;

        let accumulatedTime = 0;
        for (let i = 0; i < this.videos.length; i++) {
            const nextTime = accumulatedTime + this.durations[i];
            if (time < nextTime) {
                this.currentIndex = i;
                this.currentTimeOffset = accumulatedTime;
                await this.loadVideo(i);
                this.videoElement.currentTime = time - accumulatedTime;
                if (this.isPlaying) {
                    await this.videoElement.play();
                }
                break;
            }
            accumulatedTime = nextTime;
        }
    }

    getCurrentTime() {
        return this.currentTimeOffset + (this.videoElement?.currentTime || 0);
    }

    updateTimeDisplay() {
        const currentTime = this.getCurrentTime();
        const percentage = (currentTime / this.totalDuration) * 100;
        
        if (this.cursor) {
            this.cursor.style.left = `${percentage}%`;
        }
        if (this.progress) {
            this.progress.style.width = `${percentage}%`;
        }

        const timeDisplay = document.getElementById('currentTime');
        if (timeDisplay) {
            timeDisplay.textContent = this.formatTime(currentTime);
        }
    }

    removeVideo(index) {
        if (index >= 0 && index < this.videos.length) {
            this.videos.splice(index, 1);
            this.durations.splice(index, 1);
            this.totalDuration = this.durations.reduce((a, b) => a + b, 0);
            this.updateTimelineSegments();
            if (this.currentIndex >= this.videos.length) {
                this.currentIndex = Math.max(0, this.videos.length - 1);
            }
            if (this.videos.length > 0) {
                this.loadVideo(this.currentIndex);
            } else {
                this.videoElement.src = '';
                this.isPlaying = false;
                document.getElementById('playPauseBtn').textContent = 'Play';
            }
        }
    }
}