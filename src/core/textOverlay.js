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
            this.textElement.dataset.position = position; // Сохраняем позицию для экспорта
            this.applyPosition(position);
            this.debugElement.textContent = `Status: Text "${text}" added at ${position}`;
        } catch (error) {
            this.logError('Failed to apply text overlay');
        }
    }

    // Метод для рисования текста на canvas (для экспорта)
    drawTextOnCanvas(ctx, canvas) {
        if (!this.textElement || !this.textElement.textContent) return;
        
        const text = this.textElement.textContent;
        const fontSize = parseInt(this.textElement.style.fontSize) || 24;
        const color = this.textElement.style.color || '#ffffff';
        const position = this.textElement.dataset.position || 'top-left';
        
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        
        let x, y;
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;
        
        switch (position) {
            case 'top-left':
                x = canvas.width * 0.05;
                y = textHeight + canvas.height * 0.05;
                break;
            case 'top-right':
                x = canvas.width * 0.95 - textWidth;
                y = textHeight + canvas.height * 0.05;
                break;
            case 'bottom-left':
                x = canvas.width * 0.05;
                y = canvas.height * 0.95;
                break;
            case 'bottom-right':
                x = canvas.width * 0.95 - textWidth;
                y = canvas.height * 0.95;
                break;
            default:
                x = canvas.width * 0.05;
                y = textHeight + canvas.height * 0.05;
        }
        
        ctx.strokeText(text, x, y);
        ctx.fillText(text, x, y);
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