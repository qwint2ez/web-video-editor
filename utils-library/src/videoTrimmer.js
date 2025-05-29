import { VideoProcessor } from './videoProcessor.js';

export class VideoTrimmer extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        // isTrimmedState, startTimeValue, etc. might be needed if you had specific trimmer UI state
    }

    async trimVideoSegment(videoFile, start, end) {
        // This is the older, simpler trim method (likely without audio)
        return new Promise((resolve, reject) => {
            if (start >= end) {
                const emptyBlob = new Blob([], { type: 'video/webm' });
                emptyBlob._knownDuration = 0;
                resolve(emptyBlob);
                return;
            }

            const video = document.createElement('video');
            video.muted = true; // Usually muted for this type of canvas recording trim
            let srcUrl = '';
            try {
                srcUrl = URL.createObjectURL(videoFile);
                video.src = srcUrl;
            } catch (error) {
                if(srcUrl) URL.revokeObjectURL(srcUrl);
                video.remove();
                reject(error);
                return;
            }
            let recorder;
            let canvas;
            let isRecording = false;

            const cleanup = () => {
                if (srcUrl) URL.revokeObjectURL(srcUrl);
                if (recorder && recorder.state !== 'inactive') recorder.stop();
                video.remove();
                if (canvas) canvas.remove();
            };

            video.onloadedmetadata = () => {
                if (video.videoWidth === 0 || video.videoHeight === 0) {
                    cleanup();
                    reject(new Error("Invalid video dimensions for trimVideoSegment"));
                    return;
                }
                
                canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                const stream = canvas.captureStream(30);
                
                try {
                    recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 1000000 });
                } catch (e) {
                    cleanup();
                    reject(new Error(`MediaRecorder initialization failed: ${e.message}`));
                    return;
                }

                const chunks = [];
                recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
                recorder.onstop = () => {
                    cleanup();
                    if (chunks.length > 0) {
                        const blob = new Blob(chunks, { type: 'video/webm' });
                        blob._knownDuration = end - start; // Estimate duration
                        resolve(blob);
                    } else {
                        // If no data, resolve with an empty blob and 0 duration
                        const emptyBlob = new Blob([], { type: 'video/webm' });
                        emptyBlob._knownDuration = 0;
                        resolve(emptyBlob);
                        console.warn("No data recorded during trimVideoSegment, resolved with empty blob.");
                    }
                };
                recorder.onerror = (event) => {
                    cleanup();
                    reject(event.error || new Error("Recording failed in trimVideoSegment"));
                };

                video.currentTime = start;
                video.onseeked = () => {
                    if (!isRecording && recorder.state === 'inactive') {
                        isRecording = true;
                        recorder.start(100); // Start with a timeslice
                        
                        const targetDurationMs = (end - start) * 1000;
                        let accumulatedTimeMs = 0;
                        const frameDurationMs = 1000/30; // Approx 30 FPS

                        const renderTrimFrame = async () => {
                            if (!isRecording || accumulatedTimeMs >= targetDurationMs || video.currentTime >= end) {
                                if (recorder.state === "recording") recorder.stop();
                                return;
                            }
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            video.currentTime = Math.min(video.currentTime + frameDurationMs/1000, end);
                            accumulatedTimeMs += frameDurationMs;
                            await new Promise(r => setTimeout(r, frameDurationMs));
                            renderTrimFrame();
                        };
                        renderTrimFrame();
                    }
                };
                 video.onerror = (e) => { // Add error handling for video element itself
                    cleanup();
                    reject(new Error(`Video element error during trim: ${e.message || 'Unknown error'}`));
                };
            };
            video.onerror = (e) => { // Top-level video error
                cleanup();
                reject(new Error(`Video loading failed for trim: ${e.message || 'Unknown error'}`));
            };
        });
    }

    async trimVideoSegmentLowLatency(videoFile, start, end) {
        // This is the more complex trim method, attempting to preserve audio
        return new Promise((resolve, reject) => {
            if (start >= end) {
                const emptyBlob = new Blob([], { type: 'video/mp4' }); // Default to mp4 for broader compatibility
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
                if(srcUrl) URL.revokeObjectURL(srcUrl);
                video.remove();
                reject(error);
                return;
            }
            
            video.muted = false; 
            video.preload = 'auto';
            video.crossOrigin = 'anonymous';
            
            let recorder; 
            let canvas, ctx, audioContext; 
            let isRecording = false;
            let audioSourceNode = null;
            
            const cleanup = () => {
                if (srcUrl) URL.revokeObjectURL(srcUrl); 
                if (recorder && recorder.state !== 'inactive') recorder.stop();
                if (audioSourceNode) audioSourceNode.disconnect();
                if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(e => console.warn("Error closing audio context:", e));
                video.remove(); 
                if(canvas) canvas.remove();
            };

            video.onloadedmetadata = async () => {
                if (video.videoWidth === 0 || video.videoHeight === 0) {
                    cleanup();
                    reject(new Error("Invalid video dimensions for trimVideoSegmentLowLatency"));
                    return;
                }
                
                try {
                    canvas = document.createElement('canvas');
                    ctx = canvas.getContext('2d', { willReadFrequently: true });
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const mediaElementSource = audioContext.createMediaElementSource(video);
                    audioSourceNode = mediaElementSource;
                    const audioDestination = audioContext.createMediaStreamDestination();
                    mediaElementSource.connect(audioDestination);
                    
                    const videoStream = canvas.captureStream(30);
                    const combinedStream = new MediaStream([
                        videoStream.getVideoTracks()[0],
                        ...audioDestination.stream.getAudioTracks()
                    ]);
                    
                    const mimeTypes = ['video/mp4;codecs=h264,aac', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
                    let selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
                    
                    recorder = new MediaRecorder(combinedStream, {
                        mimeType: selectedMimeType,
                        videoBitsPerSecond: 2000000,
                        audioBitsPerSecond: 128000
                    });

                } catch (e) {
                    cleanup();
                    reject(new Error(`MediaRecorder setup failed in trimLowLatency: ${e.message}`));
                    return;
                }

                const chunks = [];
                recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
                recorder.onstop = () => {
                    cleanup();
                    if (chunks.length > 0) {
                        const mimeType = recorder.mimeType;
                        const fileType = mimeType.includes('mp4') ? 'video/mp4' : 'video/webm';
                        const blob = new Blob(chunks, { type: fileType });
                        blob._knownDuration = end - start;
                        resolve(blob);
                    } else {
                         const emptyBlob = new Blob([], { type: 'video/mp4' });
                         emptyBlob._knownDuration = 0;
                         resolve(emptyBlob);
                         console.warn("No data recorded during trimVideoSegmentLowLatency, resolved with empty blob.");
                    }
                };
                recorder.onerror = (event) => {
                    cleanup();
                    reject(event.error || new Error("Recording failed in trimLowLatency"));
                };

                video.currentTime = start;
                video.onseeked = async () => {
                    try {
                        if (video.paused) { await video.play(); video.pause(); }
                    } catch (e) { console.warn("Error priming video for audio capture:", e); }

                    if (!isRecording && recorder.state === 'inactive') {
                        isRecording = true;
                        recorder.start(100); 
                        
                        const targetDurationMs = (end - start) * 1000;
                        const frameIntervalMs = 1000 / 30;
                        let accumulatedTimeMsInSegment = 0;
                        let lastFrameTime = performance.now();

                        const renderAndCaptureFrame = async () => {
                            if (!isRecording || accumulatedTimeMsInSegment >= targetDurationMs || video.currentTime >= end) {
                                if (recorder.state === "recording") recorder.stop();
                                return;
                            }

                            const now = performance.now();
                            const deltaTime = now - lastFrameTime;
                            lastFrameTime = now;
                            
                            const currentVideoTimeToSeek = Math.min(start + (accumulatedTimeMsInSegment / 1000), end - 0.01); // Seek slightly before end
                            
                            if (Math.abs(video.currentTime - currentVideoTimeToSeek) > 0.05) {
                                video.currentTime = currentVideoTimeToSeek;
                                await new Promise(resolveSeek => {
                                    const onSeekedFrame = () => { video.removeEventListener('seeked', onSeekedFrame); resolveSeek(); };
                                    video.addEventListener('seeked', onSeekedFrame);
                                });
                            }
                            
                            if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            }
                            
                            accumulatedTimeMsInSegment += deltaTime;
                            setTimeout(renderAndCaptureFrame, Math.max(0, frameIntervalMs - (performance.now() - now)));
                        };
                        renderAndCaptureFrame();
                    }
                };
                 video.onerror = (e) => { // Add error handling for video element itself
                    cleanup();
                    reject(new Error(`Video element error during low latency trim: ${e.message || 'Unknown error'}`));
                };
            };
             video.onerror = (e) => { // Top-level video error
                cleanup();
                reject(new Error(`Video loading failed for low latency trim: ${e.message || 'Unknown error'}`));
            };
        });
    }
}