import { VideoProcessor } from './videoProcessor.js';

export class TextOverlay extends VideoProcessor {
    constructor(dependencies) {
        super(dependencies);
        this.textElement = dependencies.textElement;
        this.currentParams = null; // Store last applied parameters
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
        this.currentParams = { ...params }; // Store a copy of the parameters

        const { text, position, color, size } = params;
        if (!text) {
            this.logError('Text field cannot be empty');
            return;
        }

        // Улучшенное разбиение текста на строки
        const maxLength = this.calculateMaxLength(size);
        const lines = this.formatTextForDisplay(text, maxLength);

        try {
            // Создаем многострочный текст с ограничением по количеству строк
            const maxDisplayLines = 4; // Максимум 4 строки для отображения
            const displayLines = lines.slice(0, maxDisplayLines);
            
            this.textElement.innerHTML = displayLines.map(line => `<div>${this.escapeHtml(line)}</div>`).join('');
            this.textElement.style.display = 'block';
            this.textElement.style.color = color;
            this.textElement.style.fontSize = `${size}px`;
            this.textElement.style.lineHeight = '1.3';
            this.textElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
            this.textElement.style.wordWrap = 'break-word';
            this.textElement.style.overflowWrap = 'break-word';
            this.textElement.dataset.position = position;
            this.applyPosition(position);
            
            const statusText = lines.length > maxDisplayLines 
                ? `Text added at ${position} (${displayLines.length}/${lines.length} lines shown)`
                : `Text added at ${position} (${displayLines.length} lines)`;
            
            this.debugElement.textContent = `Status: ${statusText}`;
        } catch (error) {
            this.logError('Failed to apply text overlay');
        }
    }

    calculateMaxLength(fontSize) {
        // Адаптивная длина строки на основе размера шрифта
        const baseFontSize = 24;
        const baseMaxLength = 30;
        const ratio = parseInt(fontSize) / baseFontSize;
        return Math.max(15, Math.floor(baseMaxLength / ratio));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTextForDisplay(text, maxLength) {
        // Разбиваем текст на строки по символам новой строки
        const paragraphs = text.split(/\r?\n/);
        const lines = [];
        
        paragraphs.forEach(paragraph => {
            if (!paragraph.trim()) {
                lines.push(''); // Пустая строка
                return;
            }
            
            if (paragraph.length <= maxLength) {
                lines.push(paragraph);
            } else {
                // Разбиваем длинные строки по словам
                const words = paragraph.split(' ');
                let currentLine = '';
                
                words.forEach(word => {
                    const testLine = currentLine ? `${currentLine} ${word}` : word;
                    
                    if (testLine.length <= maxLength) {
                        currentLine = testLine;
                    } else {
                        if (currentLine) {
                            lines.push(currentLine);
                            currentLine = word;
                        } else {
                            // Если одно слово длиннее максимальной длины, разбиваем его
                            while (word.length > maxLength) {
                                lines.push(word.substring(0, maxLength));
                                word = word.substring(maxLength);
                            }
                            currentLine = word;
                        }
                    }
                });
                
                if (currentLine) {
                    lines.push(currentLine);
                }
            }
        });
        
        return lines;
    }

    // Улучшенный метод для рисования многострочного текста на canvas
    drawTextOnCanvas(ctx, canvas) {
        if (!this.textElement) return;
        
        // Получаем текст из всех div элементов
        const textDivs = this.textElement.querySelectorAll('div');
        if (textDivs.length === 0) return;
        
        const lines = Array.from(textDivs).map(div => div.textContent).filter(line => line !== null);
        if (lines.length === 0) return;
        
        const fontSize = parseInt(this.textElement.style.fontSize) || 24;
        const color = this.textElement.style.color || '#ffffff';
        const position = this.textElement.dataset.position || 'top-left';
        
        // Адаптивный размер шрифта для canvas
        const scaledFontSize = Math.max(12, Math.min(fontSize, canvas.width / 25));
        
        ctx.font = `bold ${scaledFontSize}px Arial, sans-serif`;
        ctx.fillStyle = color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(2, scaledFontSize / 12);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        const lineHeight = scaledFontSize * 1.3;
        const margin = Math.max(10, canvas.width * 0.02);
        const maxWidth = canvas.width - (margin * 2);
        
        // Разбиваем строки если они не помещаются
        const wrappedLines = [];
        lines.forEach(line => {
            if (!line.trim()) {
                wrappedLines.push(''); // Пустая строка
                return;
            }
            
            const words = line.split(' ');
            let currentLine = '';
            
            words.forEach(word => {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const metrics = ctx.measureText(testLine);
                
                if (metrics.width <= maxWidth) {
                    currentLine = testLine;
                } else {
                    if (currentLine) {
                        wrappedLines.push(currentLine);
                        currentLine = word;
                    } else {
                        // Обрезаем слишком длинное слово
                        let truncatedWord = word;
                        while (ctx.measureText(truncatedWord).width > maxWidth && truncatedWord.length > 1) {
                            truncatedWord = truncatedWord.slice(0, -1);
                        }
                        wrappedLines.push(truncatedWord);
                    }
                }
            });
            
            if (currentLine) {
                wrappedLines.push(currentLine);
            }
        });
        
        // Ограничиваем количество строк
        const maxLines = Math.floor((canvas.height - margin * 2) / lineHeight);
        const finalLines = wrappedLines.slice(0, maxLines);
        
        const totalHeight = finalLines.length * lineHeight;
        
        // Определяем начальную позицию
        let startX, startY;
        
        switch (position) {
            case 'top-left':
                startX = margin;
                startY = margin;
                break;
            case 'top-right':
                startX = canvas.width - margin;
                startY = margin;
                ctx.textAlign = 'right';
                break;
            case 'bottom-left':
                startX = margin;
                startY = Math.max(margin, canvas.height - totalHeight - margin);
                break;
            case 'bottom-right':
                startX = canvas.width - margin;
                startY = Math.max(margin, canvas.height - totalHeight - margin);
                ctx.textAlign = 'right';
                break;
            default:
                startX = margin;
                startY = margin;
        }
        
        // Рисуем каждую строку
        finalLines.forEach((line, index) => {
            const y = startY + (index * lineHeight);
            
            // Проверяем что текст помещается в видео
            if (y + scaledFontSize <= canvas.height - margin) {
                if (line.trim()) { // Рисуем только не пустые строки
                    ctx.strokeText(line, startX, y);
                    ctx.fillText(line, startX, y);
                }
            }
        });
    }

    applyPosition(position) {
        const positions = {
            'top-left': { top: '5%', left: '5%', right: 'auto', bottom: 'auto', transform: 'translate(0, 0)' },
            'top-right': { top: '5%', right: '5%', left: 'auto', bottom: 'auto', transform: 'translate(0, 0)' },
            'bottom-left': { bottom: '5%', left: '5%', right: 'auto', top: 'auto', transform: 'translate(0, 0)' },
            'bottom-right': { bottom: '5%', right: '5%', left: 'auto', top: 'auto', transform: 'translate(0, 0)' }
        };

        const pos = positions[position] || positions['top-left'];
        Object.assign(this.textElement.style, {
            position: 'absolute',
            maxWidth: '40%', // Ограничиваем ширину текста
            ...pos
        });
    }
}