export class TimelineManager {
    constructor() {
        this.videos = [];
        this.totalDuration = 0;
        this.currentVideoIndex = 0;
    }

    addVideo(video) {
        this.videos.push({
            file: video,
            duration: 0,
            startTime: this.totalDuration
        });
    }

    async loadDurations() {
        for (const video of this.videos) {
            video.duration = await this.getVideoDuration(video.file);
            this.totalDuration += video.duration;
        }
    }

    getVideoAtTime(time) {
        let accumulatedTime = 0;
        for (let i = 0; i < this.videos.length; i++) {
            accumulatedTime += this.videos[i].duration;
            if (time < accumulatedTime) {
                return {
                    index: i,
                    localTime: time - (accumulatedTime - this.videos[i].duration)
                };
            }
        }
        return null;
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        seconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    async getVideoDuration(file) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => resolve(video.duration);
            video.src = URL.createObjectURL(file);
        });
    }

    createTimelineSegment(video, duration) {
        const segment = document.createElement('div');
        segment.className = 'timeline-segment';
        segment.style.width = `${(duration / this.totalDuration) * 100}%`;
        const url = URL.createObjectURL(video);
        segment.style.backgroundImage = `url(${url})`;
        return segment;
    }
    
    updateTimeCursor(currentTime) {
        const cursor = document.querySelector('.timeline-cursor');
        if (cursor) {
            const position = (currentTime / this.totalDuration) * 100;
            cursor.style.left = `${position}%`;
        }
    }
}