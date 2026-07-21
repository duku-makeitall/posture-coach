/* 
  My Friend Turtle - StatusCard Component
  실시간 목 기울기 각도 계산, 기준 각도 표기 및 게이지 바를 시각화하는 Web Component입니다.
*/

export class StatusCard extends HTMLElement {
  static get observedAttributes() {
    return ['current-angle', 'base-angle'];
  }

  constructor() {
    super();
    this.currentAngleEl = null;
    this.baseAngleEl = null;
    this.deltaAngleEl = null;
    this.gaugeBarEl = null;
    this.gaugeContainerEl = null;
  }

  connectedCallback() {
    this.innerHTML = `
      <style>
        .status-card-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
        }
        .angle-displays {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          text-align: center;
        }
        .angle-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 12px;
        }
        .angle-label {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }
        .angle-val {
          font-family: 'Outfit', sans-serif;
          font-size: 32px;
          font-weight: 800;
          color: var(--text-primary);
        }
        .main-status-box {
          text-align: center;
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed var(--border-glass);
          border-radius: 18px;
          padding: 16px;
        }
        .main-status-title {
          font-size: 14px;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }
        .main-status-val {
          font-family: 'Outfit', sans-serif;
          font-size: 48px;
          font-weight: 800;
          color: var(--color-mint);
          transition: color 0.3s ease;
        }
        .gauge-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .gauge-track {
          width: 100%;
          height: 10px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 5px;
          overflow: hidden;
          position: relative;
        }
        .gauge-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #34D399, #10B981); /* 기본 민트 그린 */
          border-radius: 5px;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease;
        }
        .gauge-labels {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--text-muted);
        }
      </style>
      <div class="status-card-wrapper glass-card">
        <h2>내 상태 기록 📊</h2>
        
        <div class="angle-displays">
          <div class="angle-box">
            <div class="angle-label">현재 고개 각도</div>
            <div class="angle-val" id="val-current">-°</div>
          </div>
          <div class="angle-box">
            <div class="angle-label">보정된 기준 각도</div>
            <div class="angle-val" id="val-base">-°</div>
          </div>
        </div>

        <div class="main-status-box">
          <div class="main-status-title">자세 변화량 (Δθ)</div>
          <div class="main-status-val" id="val-delta">0°</div>
        </div>

        <div class="gauge-section">
          <div class="gauge-track">
            <div class="gauge-fill" id="gauge-bar"></div>
          </div>
          <div class="gauge-labels">
            <span>바른 자세 (0°)</span>
            <span>주의 (15°)</span>
            <span>위험 (30°+)</span>
          </div>
        </div>
      </div>
    `;

    this.currentAngleEl = this.querySelector('#val-current');
    this.baseAngleEl = this.querySelector('#val-base');
    this.deltaAngleEl = this.querySelector('#val-delta');
    this.gaugeBarEl = this.querySelector('#gauge-bar');

    this.updateDisplay();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this.currentAngleEl) {
      this.updateDisplay();
    }
  }

  updateDisplay() {
    const currentAttr = this.getAttribute('current-angle');
    const baseAttr = this.getAttribute('base-angle');

    // 1. 초기 상태 예외 처리
    if (currentAttr === null || baseAttr === null) {
      this.currentAngleEl.textContent = '-°';
      this.baseAngleEl.textContent = '-°';
      this.deltaAngleEl.textContent = '0°';
      this.gaugeBarEl.style.width = '0%';
      return;
    }

    const current = parseFloat(currentAttr);
    const base = parseFloat(baseAttr);
    
    // 각도 차이(변화량) 계산 (수식 기준: delta_theta = current_theta - base_theta)
    // 거북목은 각도가 커지는 방향이므로 양수 차이를 관찰
    let delta = current - base;
    if (delta < 0) delta = 0; // 음수 변화량은 바른 자세로 수렴 처리

    // 2. 수치 렌더링
    this.currentAngleEl.textContent = `${Math.round(current)}°`;
    this.baseAngleEl.textContent = `${Math.round(base)}°`;
    this.deltaAngleEl.textContent = `${Math.round(delta)}°`;

    // 3. 게이지바 렌더링 (최대 범위를 30도로 환산하여 백분율 계산)
    const maxDegree = 30;
    const percentage = Math.min(100, (delta / maxDegree) * 100);
    this.gaugeBarEl.style.width = `${percentage}%`;

    // 4. 상태 임계값 판정에 따른 색체 피드백 제어
    if (delta >= 15) {
      // 거북목 경보 상태 (피치 레드 계열)
      this.deltaAngleEl.style.color = 'var(--color-peach)';
      this.gaugeBarEl.style.background = 'linear-gradient(90deg, #F87171, #EF4444)';
    } else {
      // 바른 자세 상태 (민트 그린 계열)
      this.deltaAngleEl.style.color = 'var(--color-mint)';
      this.gaugeBarEl.style.background = 'linear-gradient(90deg, #34D399, #10B981)';
    }
  }
}

customElements.define('status-card', StatusCard);
