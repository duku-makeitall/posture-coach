/* 
  My Friend Turtle - CameraViewer Component
  카메라 뷰어 및 MediaPipe 포즈 스켈레톤 가이드라인 드로잉을 담당하는 Web Component입니다.
*/

export class CameraViewer extends HTMLElement {
  static get observedAttributes() {
    return ['status'];
  }

  constructor() {
    super();
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.statusClass = '';
  }

  connectedCallback() {
    this.innerHTML = `
      <style>
        .camera-box-wrapper {
          position: relative;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .video-container {
          position: relative;
          width: 100%;
          aspect-ratio: 4/3;
          border-radius: 20px;
          overflow: hidden;
          background: #000;
        }
        #webcam-video {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: rotateY(180deg); /* 거울 모드 적용 */
        }
        #skeleton-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 10;
          pointer-events: none;
          transform: rotateY(180deg); /* 거울 모드 적용 */
        }
      </style>
      <div class="camera-box-wrapper glass-card state-transition" id="card-container">
        <h2>카메라 화면 📷</h2>
        <div class="video-container">
          <video id="webcam-video" autoplay playsinline muted></video>
          <canvas id="skeleton-canvas"></canvas>
        </div>
      </div>
    `;

    this.video = this.querySelector('#webcam-video');
    this.canvas = this.querySelector('#skeleton-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.card = this.querySelector('#card-container');

    // 리사이즈 대응
    window.addEventListener('resize', () => this.resizeCanvas());
    setTimeout(() => this.resizeCanvas(), 100);

    const initialStatus = this.getAttribute('status') || 'pending';
    this.updateStatus(initialStatus);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'status' && this.card) {
      this.updateStatus(newValue);
    }
  }

  resizeCanvas() {
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.width = this.canvas.parentElement.clientWidth;
      this.canvas.height = this.canvas.parentElement.clientHeight;
    }
  }

  updateStatus(status) {
    if (!this.card) return;

    // 기존 상태 클래스 제거
    this.card.classList.remove(
      'status-card-correct',
      'status-card-warning',
      'status-card-analyzing',
      'status-card-pending'
    );

    // 새로운 상태 클래스 바인딩
    switch (status) {
      case 'correct':
        this.card.classList.add('status-card-correct');
        this.statusClass = 'correct';
        break;
      case 'warning':
        this.card.classList.add('status-card-warning');
        this.statusClass = 'warning';
        break;
      case 'analyzing':
        this.card.classList.add('status-card-analyzing');
        this.statusClass = 'analyzing';
        break;
      case 'pending':
      default:
        this.card.classList.add('status-card-pending');
        this.statusClass = 'pending';
        break;
    }
  }

  /**
   * MediaPipe 랜드마크를 받아 캔버스에 그리는 유틸리티
   * @param {Array} landmarks - MediaPipe Pose 랜드마크 배열
   * @param {Object} activeEar - {x, y, index} 형태의 활성 귀 랜드마크
   * @param {Object} activeShoulder - {x, y, index} 형태의 활성 어깨 랜드마크
   */
  drawSkeleton(landmarks, activeEar = null, activeShoulder = null) {
    if (!this.ctx || !this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    if (!landmarks || landmarks.length === 0) return;

    // 1. 기본 관절 연결선 (Skeleton Lines)
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = 'rgba(230, 230, 250, 0.45)'; // 부드러운 라벤더 화이트
    this.ctx.lineCap = 'round';

    const connections = [
      [11, 12], // 어깨 사이
      [11, 23], [12, 24], // 몸통
      [23, 24], // 골반 사이
      [11, 13], [13, 15], // 왼팔
      [12, 14], [14, 16], // 오른팔
    ];

    connections.forEach(([i1, i2]) => {
      const pt1 = landmarks[i1];
      const pt2 = landmarks[i2];
      if (pt1 && pt2 && pt1.visibility > 0.5 && pt2.visibility > 0.5) {
        this.ctx.beginPath();
        this.ctx.moveTo(pt1.x * w, pt1.y * h);
        this.ctx.lineTo(pt2.x * w, pt2.y * h);
        this.ctx.stroke();
      }
    });

    // 2. 귀-어깨 측정 보조선 그리기 (핵심)
    if (activeEar && activeShoulder) {
      this.ctx.beginPath();
      this.ctx.lineWidth = 4;
      // 상태에 따라 보조선 색상 변경
      this.ctx.strokeStyle = this.statusClass === 'correct' ? '#34D399' : '#F87171';
      this.ctx.setLineDash([5, 5]); // 점선 효과
      this.ctx.moveTo(activeEar.x * w, activeEar.y * h);
      this.ctx.lineTo(activeShoulder.x * w, activeShoulder.y * h);
      this.ctx.stroke();
      this.ctx.setLineDash([]); // 점선 해제
    }

    // 3. 주요 조인트 포인트 드로잉
    landmarks.forEach((pt, index) => {
      if (pt.visibility < 0.5) return;

      // 분석 및 주요 타깃이 아닌 일반 뼈마디는 작게 그림
      const isTarget = activeEar && activeShoulder && (index === activeEar.index || index === activeShoulder.index);
      if (isTarget) {
        // 타깃(귀, 어깨) 포인트: 이중 도넛 모양
        const activeColor = this.statusClass === 'correct' ? '#34D399' : '#F87171';
        this.ctx.beginPath();
        this.ctx.arc(pt.x * w, pt.y * h, 8, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(pt.x * w, pt.y * h, 5, 0, 2 * Math.PI);
        this.ctx.fillStyle = activeColor;
        this.ctx.fill();
      } else if ([11, 12, 13, 14, 23, 24].includes(index)) {
        // 일반 주요 조인트
        this.ctx.beginPath();
        this.ctx.arc(pt.x * w, pt.y * h, 4, 0, 2 * Math.PI);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.fill();
      }
    });
  }
}

customElements.define('camera-viewer', CameraViewer);
