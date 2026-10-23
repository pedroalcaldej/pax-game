/**
 * client/src/ui/components/TaxSlider.js
 * Componente UI para ajustar la Tasa Impositiva (Tau) durante la Fase 2.
 */

import { ECONOMIC_POLICY } from '../../../../shared/Constants.js';

export class TaxSlider {
  /**
   * @param {HTMLElement} containerElement - Contenedor del DOM donde se insertará el slider.
   * @param {Function} onChangeCallback - Función ejecutada al mover el slider.
   */
  constructor(containerElement, onChangeCallback) {
    this.container = containerElement;
    this.onChange = onChangeCallback;
    this.currentValue = ECONOMIC_POLICY.DEFAULT_TAX_RATE;

    this.render();
  }

  /**
   * Construye el HTML del control deslizante de impuestos.
   */
  render() {
    this.container.innerHTML = `
      <div class="tax-slider-container" style="background: #1e272e; padding: 15px; border-radius: 8px; color: #fff; font-family: sans-serif;">
        <label for="taxInput" style="display: block; margin-bottom: 8px; font-weight: bold;">
          Tasa Impositiva (τ): <span id="taxValue">${Math.round(this.currentValue * 100)}%</span>
        </label>
        <input 
          type="range" 
          id="taxInput" 
          min="${ECONOMIC_POLICY.MIN_TAX_RATE}" 
          max="${ECONOMIC_POLICY.MAX_TAX_RATE}" 
          step="0.01" 
          value="${this.currentValue}"
          style="width: 100%; cursor: pointer;"
        />
        <p style="font-size: 11px; color: #bdc3c7; margin-top: 6px;">
          * Impuestos altos aumentan el ingreso inmediato, pero reducen el crecimiento demográfico (G = 1 / 100τ).
        </p>
      </div>
    `;

    this.attachEvents();
  }

  /**
   * Asigna los escuchadores de eventos al input range.
   */
  attachEvents() {
    const input = this.container.querySelector('#taxInput');
    const label = this.container.querySelector('#taxValue');

    input.addEventListener('input', (event) => {
      this.currentValue = parseFloat(event.target.value);
      label.textContent = `${Math.round(this.currentValue * 100)}%`;

      if (typeof this.onChange === 'function') {
        this.onChange(this.currentValue);
      }
    });
  }

  /**
   * Habilita o deshabilita el slider según la fase actual.
   * @param {boolean} enabled - True si es la Fase 2 de decisiones.
   */
  setEnabled(enabled) {
    const input = this.container.querySelector('#taxInput');
    if (input) {
      input.disabled = !enabled;
      this.container.style.opacity = enabled ? '1' : '0.5';
    }
  }
}