import { FilterApplier } from '../core/filterApplier.js';

describe('FilterApplier', () => {
  let dependencies;

  beforeEach(() => {
    dependencies = {
      videoElement: document.createElement('video'),
      debugElement: document.createElement('p'),
    };
    document.body.appendChild(dependencies.videoElement);
    document.body.appendChild(dependencies.debugElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should throw error if no filter is selected', () => {
    const applier = new FilterApplier(dependencies);
    expect(() => applier.process({ filter: '' })).toThrow('Select a valid filter');
    expect(dependencies.debugElement.textContent).toBe('Status: Error! Select a valid filter');
  });

  test('should apply grayscale filter', () => {
    const applier = new FilterApplier(dependencies);
    applier.process({ filter: 'grayscale' });
    expect(dependencies.videoElement.style.filter).toBe('grayscale(100%)');
    expect(dependencies.debugElement.textContent).toBe('Status: Applied filter grayscale');
  });
});