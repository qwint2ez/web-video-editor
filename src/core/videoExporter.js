export class VideoExporter {
    constructor(dependencies) {
        this.processors = dependencies.processors; // For filters, text
        this.debugElement = dependencies.debugElement;
    }

    logError(message) {
        if (this.debugElement) {
            this.debugElement.textContent = `Ошибка: ${message}`;
        }
        console.error(message);
    }

    async exportVideo(videos, durations, audioFile, audioDuration, exportOptions = {}) {
        if ((!videos || videos.length === 0) && !audioFile) {
            this.logError("No media to export.");
            return null;
        }

        const {
            includeOriginalAudio = true,
            includeOverlayAudio = true,
            format = 'webm',
            quality = 'medium'
        } = exportOptions;

        if (this.debugElement) this.debugElement.textContent = "Status: Preparing export...";

        try {
            // Simple case: one video, no audio overlay, no effects
            if (videos.length === 1 && !audioFile && includeOriginalAudio &&
                !this.processors?.text?.textElement?.textContent &&
                !this.processors?.filter?.currentFilter) {
                if (this.debugElement) this.debugElement.textContent = "Status: Export finished (direct file).";
                return videos[0];
            }

            return await this.exportWithProcessing(videos, durations, audioFile, audioDuration, exportOptions);

        } catch (error) {
            console.error('Export error in VideoExporter:', error);
            this.logError('Ошибка при экспорте видео: ' + error.message);
            if (this.debugElement) this.debugElement.textContent = "Status: Export failed. " + error.message;
            return null;
        }
    }

    async exportWithProcessing(videos, durations, audioFile, mainAudioDuration, exportOptions) {
        const {
            includeOriginalAudio = true,
            includeOverlayAudio = true,
            quality = 'medium',
            format = 'webm'
        } = exportOptions;

        if (this.debugElement) this.debugElement.textContent = "Status: Export processing started...";
        let audioContext;

        try {
            if (!videos || videos.length === 0) {
                throw new Error("No videos to export");
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            const firstVideoForMeta = document.createElement('video');
            firstVideoForMeta.src = URL.createObjectURL(videos[0]);
            await new Promise((resolve, reject) => {
                firstVideoForMeta.onloadedmetadata = resolve;
                firstVideoForMeta.onerror = (e) => reject(new Error(`Failed to load metadata for first video: ${e.message || e.type}`));
            });
            canvas.width = firstVideoForMeta.videoWidth;
            canvas.height = firstVideoForMeta.videoHeight;
            URL.revokeObjectURL(firstVideoForMeta.src);
            firstVideoForMeta.remove();

            const videoStreamFromCanvas = canvas.captureStream(30);
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioDestinationNode = audioContext.createMediaStreamDestination();
            const tracksForCombinedStream = [...videoStreamFromCanvas.getVideoTracks()];

            let overlayAudioElement = null;
            let overlayAudioSourceNode = null;
            if (includeOverlayAudio && audioFile) {
                overlayAudioElement = new Audio(URL.createObjectURL(audioFile));
                await new Promise(r => overlayAudioElement.onloadedmetadata = r);
                overlayAudioSourceNode = audioContext.createMediaElementSource(overlayAudioElement);
                overlayAudioSourceNode.connect(audioDestinationNode);
                const totalVideoDuration = durations.reduce((acc, cur) => acc + (Number.isFinite(cur) ? cur : 0), 0);
                if (overlayAudioElement.duration > 0 && totalVideoDuration > overlayAudioElement.duration) {
                    overlayAudioElement.loop = true;
                }
                if (this.debugElement) this.debugElement.textContent = "Status: Overlay audio prepared.";
            }

            tracksForCombinedStream.push(...audioDestinationNode.stream.getAudioTracks());

            const mimeTypesToTry = format === 'mp4' ?
                ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=h264,aac', 'video/mp4'] :
                ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

            let selectedMimeType = mimeTypesToTry.find(type => MediaRecorder.isTypeSupported(type));
            if (!selectedMimeType) {
                selectedMimeType = 'video/webm';
                if (!MediaRecorder.isTypeSupported(selectedMimeType)) {
                    throw new Error("No supported MIME type found for MediaRecorder (webm/mp4).");
                }
            }

            const recorder = new MediaRecorder(new MediaStream(tracksForCombinedStream), {
                mimeType: selectedMimeType,
                videoBitsPerSecond: quality === 'high' ? 5000000 : (quality === 'medium' ? 2500000 : 1000000),
                audioBitsPerSecond: 128000
            });

            const chunks = [];
            recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

            recorder.start();
            if (overlayAudioElement) await overlayAudioElement.play().catch(e => console.warn("Overlay audio play failed:", e));

            for (let i = 0; i < videos.length; i++) {
                const videoFile = videos[i];
                const segmentDuration = durations[i];
                if (this.debugElement) this.debugElement.textContent = `Status: Processing segment ${i + 1}/${videos.length}...`;

                const segmentPlayer = document.createElement('video');
                const segmentSrcUrl = URL.createObjectURL(videoFile);
                segmentPlayer.src = segmentSrcUrl;

                await new Promise((resolve, reject) => {
                    segmentPlayer.onloadedmetadata = resolve;
                    segmentPlayer.onerror = (e) => reject(new Error(`Failed to load metadata for segment ${i + 1}: ${e.message || e.type}`));
                });

                let segmentAudioSourceNode = null;
                if (includeOriginalAudio) {
                    try {
                        segmentAudioSourceNode = audioContext.createMediaElementSource(segmentPlayer);
                        segmentAudioSourceNode.connect(audioDestinationNode);
                        segmentPlayer.muted = false;
                    } catch (e) {
                        console.warn(`Could not create/connect audio source for segment ${i + 1}: ${e.message}.`);
                        segmentPlayer.muted = true;
                    }
                } else {
                    segmentPlayer.muted = true;
                }

                await segmentPlayer.play().catch(e => console.warn(`Segment ${i + 1} play error: ${e.name} - ${e.message}`));

                let RENDER_FRAMES_FOR_SEGMENT_DURATION = 0;
                const frameDurationMs = 1000 / 30;

                while (RENDER_FRAMES_FOR_SEGMENT_DURATION < segmentDuration * 1000 && !segmentPlayer.ended) {
                    if (segmentPlayer.videoWidth > 0 && segmentPlayer.videoHeight > 0) {
                        ctx.drawImage(segmentPlayer, 0, 0, canvas.width, canvas.height);
                    }
                    if (this.processors?.filter?.applyFilterToCanvas) {
                        this.processors.filter.applyFilterToCanvas(ctx, canvas);
                    }
                    if (this.processors?.text?.drawTextOnCanvas) {
                        this.processors.text.drawTextOnCanvas(ctx, canvas);
                    }
                    await new Promise(r => setTimeout(r, frameDurationMs));
                    RENDER_FRAMES_FOR_SEGMENT_DURATION += frameDurationMs;
                }

                segmentPlayer.pause();
                if (segmentAudioSourceNode) segmentAudioSourceNode.disconnect();
                URL.revokeObjectURL(segmentSrcUrl);
                segmentPlayer.remove();
            }

            if (overlayAudioElement) {
                overlayAudioElement.pause();
                if (overlayAudioElement.src && overlayAudioElement.src.startsWith('blob:')) {
                    URL.revokeObjectURL(overlayAudioElement.src);
                }
                overlayAudioElement.remove();
            }
            if (overlayAudioSourceNode) overlayAudioSourceNode.disconnect();

            recorder.stop();

            return new Promise((resolve, reject) => {
                recorder.onstop = () => {
                    if (audioContext) audioContext.close().catch(e => console.warn("Error closing audio context:", e));
                    if (chunks.length === 0) {
                        if (this.debugElement) this.debugElement.textContent = "Status: Export failed (no data recorded).";
                        reject(new Error('Generated video is empty. Check console for errors.'));
                        return;
                    }
                    const blob = new Blob(chunks, { type: selectedMimeType.split(';')[0] });
                    if (this.debugElement) this.debugElement.textContent = "Status: Export finished successfully.";
                    resolve(blob);
                };
                recorder.onerror = (event) => {
                    if (audioContext) audioContext.close().catch(e => console.warn("Error closing audio context on recorder error:", e));
                    if (this.debugElement) this.debugElement.textContent = `Status: Export failed (${event.error?.name || 'Unknown error'}).`;
                    reject(event.error || new Error("MediaRecorder failed"));
                };
            });

        } catch (error) {
            console.error('Export processing error:', error);
            if (this.debugElement) this.debugElement.textContent = `Status: Export error - ${error.message}`;
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.close().catch(e => console.warn("Error closing audio context on main catch:", e));
            }
            throw error;
        }
    }
}
