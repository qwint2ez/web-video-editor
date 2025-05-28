import { VideoProcessor } from './videoProcessor.js';

export class TextOverlay extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.textElement = dependencies.textElement;
        if (!this.textElement) {
            this.logError('Text overlay element not found');
            return;
        }
    }

    process(params) {
        if (!this.textElement) {
            this.logError('Text overlay not initialized');
            return;
        }

        const { text, position, color, size } = params;
        if (!text) {
            this.logError('Text field cannot be empty');
            return;
        }

        try {
            this.textElement.textContent = text;
            this.textElement.style.display = 'block';
            this.textElement.style.color = color;
            this.textElement.style.fontSize = `${size}px`;
            this.applyPosition(position);
            this.debugElement.textContent = `Status: Text "${text}" added at ${position}`;
        } catch (error) {
            this.logError('Failed to apply text overlay');
        }
    }

    applyPosition(position) {
        const positions = {
            'top-left': { top: '5%', left: '5%' },
            'top-right': { top: '5%', right: '5%' },
            'bottom-left': { bottom: '5%', left: '5%' },
            'bottom-right': { bottom: '5%', right: '5%' }
        };

        const pos = positions[position] || positions['top-left'];
        Object.assign(this.textElement.style, {
            position: 'absolute',
            ...pos
        });
    }
}