/* 
  My Friend Turtle - ControlPanel Component
  카메라 스위치, 보정(Calibration) 등록 및 아두이노 시리얼 통신을 제어하는 Web Component입니다.
*/

export class ControlPanel extends HTMLElement {
  static get observedAttributes() {
    return ['arduino-connected', 'camera-active'];
  }

  constructor() {
    super();
    this.arduinoBtn = null;
    this.cameraBtn = null;
    this.calibrateBtn = null;
    this.arduinoStatusText = null;
  }

  connectedCallback() {
    this.innerHTML = `
      <style>
        .control-panel-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
        }
        .btn-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }
        .arduino-status-box {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Jua', sans-serif;
          font-size: 16px;
          color: var(--text-secondary);
        }
        .status-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: var(--color-gray);
          transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }
        .status-indicator.active {
          background-color: var(--color-mint);
          box-shadow: 0 0 8px var(--color-mint);
        }
      </style>
      <div class="control-panel-wrapper glass-card">
        <h2>제어 센터 ⚙️</h2>
        
        <div class="arduino-status-box">
          <div class="status-indicator" id="arduino-indicator"></div>
          <span id="arduino-status-text">아두이노 연결 대기 중</span>
        </div>

        <div class="btn-group">
          <!-- 아두이노 연결 버튼 -->
          <button class="btn-friendly" id="btn-arduino">
            <span>🔌 아두이노 연결</span>
          </button>

          <!-- 카메라 ON/OFF 버튼 -->
          <button class="btn-friendly" id="btn-camera">
            <span>📷 카메라 켜기</span>
          </button>

          <!-- 기준 자세 등록 (보정) 버튼 -->
          <button class="btn-friendly" id="btn-calibrate" disabled>
            <span>📸 내 기준 자세 등록</span>
          </button>
        </div>
      </div>
    `;

    this.arduinoBtn = this.querySelector('#btn-arduino');
    this.cameraBtn = this.querySelector('#btn-camera');
    this.calibrateBtn = this.querySelector('#btn-calibrate');
    this.arduinoIndicator = this.querySelector('#arduino-indicator');
    this.arduinoStatusText = this.querySelector('#arduino-status-text');

    // 이벤트 리스너 바인딩
    this.arduinoBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('arduino-connect', { bubbles: true, composed: true }));
    });

    this.cameraBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('camera-toggle', { bubbles: true, composed: true }));
    });

    this.calibrateBtn.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('calibrate-trigger', { bubbles: true, composed: true }));
    });

    // 속성 초기값 반영
    this.updateArduinoState(this.getAttribute('arduino-connected') === 'true');
    this.updateCameraState(this.getAttribute('camera-active') === 'true');
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.arduinoBtn) return; // 렌더링 전 방지

    if (name === 'arduino-connected') {
      this.updateArduinoState(newValue === 'true');
    } else if (name === 'camera-active') {
      this.updateCameraState(newValue === 'true');
    }
  }

  updateArduinoState(isConnected) {
    if (isConnected) {
      this.arduinoBtn.querySelector('span').textContent = '🔌 연결 해제';
      this.arduinoBtn.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)'; // 해제 시 레드 톤
      this.arduinoIndicator.classList.add('active');
      this.arduinoStatusText.textContent = '아두이노 연결 완료';
    } else {
      this.arduinoBtn.querySelector('span').textContent = '🔌 아두이노 연결';
      this.arduinoBtn.style.background = ''; // theme.css 기본 파란 그라데이션 복구
      this.arduinoIndicator.classList.remove('active');
      this.arduinoStatusText.textContent = '아두이노 연결 대기 중';
    }
  }

  updateCameraState(isActive) {
    if (isActive) {
      this.cameraBtn.querySelector('span').textContent = '📷 카메라 끄기';
      this.cameraBtn.style.background = 'linear-gradient(135deg, #10B981, #059669)'; // 활성 시 그린 톤
      this.calibrateBtn.disabled = false; // 카메라가 켜지면 보정 버튼 활성화
    } else {
      this.cameraBtn.querySelector('span').textContent = '📷 카메라 켜기';
      this.cameraBtn.style.background = ''; // 복구
      this.calibrateBtn.disabled = true;  // 비활성화
    }
  }
}

customElements.define('control-panel', ControlPanel);
