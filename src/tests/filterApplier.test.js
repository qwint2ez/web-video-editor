import { FilterApplier } from '../core/filterApplier.js';

describe('FilterApplier', () => {
  let videoElement, debugElement;

  beforeEach(() => {
    videoElement = document.createElement('video');
    debugElement = document.createElement('p');
    document.body.appendChild(videoElement);
    document.body.appendChild(debugElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should throw error if no filter is selected', () => {
    const applier = new FilterApplier(videoElement, debugElement);
    expect(() => applier.process('')).toThrow('Select a filter');
    expect(debugElement.textContent).toBe('Status: Error! Select a filter');
  });

  test('should apply grayscale filter', () => {
    const applier = new FilterApplier(videoElement, debugElement);
    applier.process('grayscale');
    expect(videoElement.style.filter).toBe('grayscale(100%)');
    expect(debugElement.textContent).toBe('Status: Applied filter grayscale');
  });
});