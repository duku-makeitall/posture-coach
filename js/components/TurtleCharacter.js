/* 
  My Friend Turtle - TurtleCharacter Component
  상태에 따라 표정 및 장식, 그리고 다정하고 직관적인 말풍선 대사가 변화하는 아기 거북이 Web Component입니다.
*/

export class TurtleCharacter extends HTMLElement {
  static get observedAttributes() {
    return ['status'];
  }

  constructor() {
    super();
    this.characterContainer = null;
    this.speechBubble = null;
  }

  connectedCallback() {
    this.innerHTML = `
      <style>
        .character-card-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 24px;
          width: 100%;
          min-height: 380px;
        }
        
        /* 거북이의 방 프레임 */
        .turtle-room {
          position: relative;
          width: 180px;
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* SVG 거북이 본체 감싸기 및 둥둥 뜨는 모션 */
        .turtle-svg-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* 말풍선 말풍선 (CSS Bubble) */
        .dialog-bubble-container {
          position: relative;
          background: rgba(255, 255, 255, 0.05);
          border: 1.5px solid var(--border-glass);
          border-radius: 20px;
          padding: 16px 20px;
          max-width: 90%;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
          text-align: center;
        }

        /* 말풍선 아래의 세련된 삼각형 꼭지점 */
        .dialog-bubble-container::after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          border-width: 8px 8px 0;
          border-style: solid;
          border-color: rgba(20, 26, 43, 0.9) transparent;
          display: none; /* 플랫 구조상 하단 배치 생략 또는 구현 */
        }

        .bubble-text {
          font-family: 'Jua', sans-serif;
          font-size: 17px;
          line-height: 1.5;
          color: var(--text-primary);
        }

        /* 상태 데코 장식 */
        .decor-item {
          transition: opacity 0.3s ease, transform 0.3s ease;
          opacity: 0;
          transform: scale(0.5);
          transform-origin: center;
        }
        .decor-active {
          opacity: 1;
          transform: scale(1);
        }
      </style>
      
      <div class="character-card-wrapper glass-card text-transition">
        <h2>거북이의 방 🐢</h2>
        
        <!-- 거북이 캐릭터가 위치하는 곳 -->
        <div class="turtle-room">
          <div class="turtle-svg-wrapper float-animation" id="turtle-visual">
            <svg width="150" height="150" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- 그림자 -->
              <ellipse cx="75" cy="130" rx="40" ry="10" fill="rgba(0, 0, 0, 0.25)" />
              
              <!-- 아기 거북이 다리 -->
              <rect x="42" y="105" width="16" height="20" rx="8" fill="#4ade80" />
              <rect x="92" y="105" width="16" height="20" rx="8" fill="#4ade80" />
              
              <!-- 등껍질 (Shell) -->
              <path d="M35 105C35 75 115 75 115 105H35Z" fill="#15803d" stroke="#166534" stroke-width="3" />
              <path d="M50 85C60 75 90 75 100 85" stroke="#166534" stroke-width="2" stroke-linecap="round"/>
              <path d="M40 98C55 90 95 90 110 98" stroke="#166534" stroke-width="2" stroke-linecap="round"/>
              
              <!-- 거북이 머리 & 목 -->
              <rect id="turtle-neck" x="63" y="45" width="24" height="45" rx="12" fill="#4ade80" style="transition: transform 0.5s ease; transform-origin: bottom center;" />
              <circle id="turtle-head" cx="75" cy="45" r="22" fill="#4ade80" style="transition: transform 0.5s ease; transform-origin: 75px 75px;" />
              
              <!-- 눈 (Eyes) - 상태에 따라 JS에서 내부 SVG 형태 조작 -->
              <g id="eyes-group">
                <!-- 기본 눈 (기본값) -->
                <circle cx="67" cy="42" r="3" fill="#0f172a" />
                <circle cx="83" cy="42" r="3" fill="#0f172a" />
              </g>

              <!-- 입 (Mouth) -->
              <path id="mouth-path" d="M70 52Q75 55 80 52" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" fill="none" />
              
              <!-- [데코 1] 머리 위 왕관 (correct 상태용) -->
              <g id="crown" class="decor-item">
                <path d="M63 20L67 27L75 22L83 27L87 20L81 29H69L63 20Z" fill="#fbbf24" stroke="#d97706" stroke-width="1.5" />
                <circle cx="75" cy="20" r="1.5" fill="#f59e0b" />
              </g>

              <!-- [데코 2] 땀방울 (warning 상태용) -->
              <g id="sweats" class="decor-item">
                <path d="M96 40C96 43 93 45 93 45C93 45 91 43 91 40C91 38 93 36 94 36C95 36 96 38 96 40Z" fill="#60a5fa" />
                <path d="M102 52C102 54 100 56 100 56C100 56 98 54 98 52C98 50 100 48 101 48C102 48 102 50 102 52Z" fill="#60a5fa" />
              </g>

              <!-- [데코 3] 탐정 돋보기 (pending / analyzing 상태용) -->
              <g id="magnifier" class="decor-item">
                <circle cx="86" cy="42" r="7" stroke="#94a3b8" stroke-width="2" fill="rgba(148, 163, 184, 0.2)" />
                <line x1="91" y1="47" x2="98" y2="54" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
              </g>

              <!-- [데코 4] 물음표 (failed 상태용) -->
              <g id="question" class="decor-item">
                <text x="105" y="38" font-family="'Jua', sans-serif" font-size="24" fill="#64748b" font-weight="bold">?</text>
              </g>
            </svg>
          </div>
        </div>

        <!-- 실시간 피드백 대사창 -->
        <div class="dialog-bubble-container pop-animation" id="speech-bubble">
          <p class="bubble-text" id="bubble-msg">친구를 기다리는 중...</p>
        </div>
      </div>
    `;

    this.speechBubble = this.querySelector('#speech-bubble');
    this.bubbleMsg = this.querySelector('#bubble-msg');
    this.neck = this.querySelector('#turtle-neck');
    this.head = this.querySelector('#turtle-head');
    this.eyesGroup = this.querySelector('#eyes-group');
    this.mouthPath = this.querySelector('#mouth-path');
    
    // 장식 그룹 매핑
    this.decors = {
      crown: this.querySelector('#crown'),
      sweats: this.querySelector('#sweats'),
      magnifier: this.querySelector('#magnifier'),
      question: this.querySelector('#question')
    };

    const initialStatus = this.getAttribute('status') || 'pending';
    this.updateState(initialStatus);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'status' && this.bubbleMsg) {
      this.updateState(newValue);
    }
  }

  updateState(status) {
    if (!this.bubbleMsg) return;

    // 1. 말풍선 팝 애니메이션 리셋
    this.speechBubble.classList.remove('pop-animation');
    void this.speechBubble.offsetWidth; // Reflow 트리거
    this.speechBubble.classList.add('pop-animation');

    // 2. 장식 아이템 일괄 초기화
    Object.values(this.decors).forEach(el => el.classList.remove('decor-active'));

    // 3. 거북이 목 및 머리 위치 원복
    this.neck.style.transform = 'translateY(0) scaleY(1)';
    this.head.style.transform = 'translateY(0)';

    // 4. 상태별 대사, 눈 모양, 장식 적용
    switch (status) {
      case 'correct':
        this.bubbleMsg.textContent = '지금 자세가 아주 좋아요! 이 상태를 계속 유지해 볼까요?';
        this.decors.crown.classList.add('decor-active');
        this.setEyes('smile');
        this.setMouth('smile');
        break;

      case 'warning':
        this.bubbleMsg.textContent = '목이 조금 기울어졌어요. 어깨를 펴고 고개를 살짝 들어주세요!';
        this.decors.sweats.classList.add('decor-active');
        this.setEyes('worried');
        this.setMouth('sad');
        // 거북목 상태 비주얼 구현 (목이 앞으로 늘어나며 머리가 떨어짐)
        this.neck.style.transform = 'translate(6px, -4px) rotate(15deg) scaleY(1.1)';
        this.head.style.transform = 'translate(10px, 3px)';
        break;

      case 'analyzing':
        this.bubbleMsg.textContent = '측면 모습이 카메라에 잘 보이도록 서 주세요. 분석 중입니다...';
        this.decors.magnifier.classList.add('decor-active');
        this.setEyes('normal');
        this.setMouth('straight');
        break;

      case 'failed':
        this.bubbleMsg.textContent = '카메라 화면에서 보이지 않아요. 카메라 정면 안쪽으로 들어와 주세요.';
        this.decors.question.classList.add('decor-active');
        this.setEyes('dot');
        this.setMouth('sad');
        break;

      case 'pending':
      default:
        this.bubbleMsg.textContent = "바른 자세를 취한 뒤, 아래 '기준 자세 등록' 버튼을 눌러주세요.";
        this.decors.magnifier.classList.add('decor-active');
        this.setEyes('normal');
        this.setMouth('straight');
        break;
    }
  }

  // 눈 모양 드로잉 변경 유틸
  setEyes(type) {
    if (!this.eyesGroup) return;

    if (type === 'smile') {
      this.eyesGroup.innerHTML = `
        <path d="M64 43Q67 39 70 43" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" fill="none" />
        <path d="M80 43Q83 39 86 43" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" fill="none" />
      `;
    } else if (type === 'worried') {
      this.eyesGroup.innerHTML = `
        <path d="M64 41L70 44" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" />
        <path d="M86 41L80 44" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" />
      `;
    } else if (type === 'dot') {
      this.eyesGroup.innerHTML = `
        <circle cx="67" cy="42" r="1.5" fill="#0f172a" />
        <circle cx="83" cy="42" r="1.5" fill="#0f172a" />
      `;
    } else {
      // normal
      this.eyesGroup.innerHTML = `
        <circle cx="67" cy="42" r="3" fill="#0f172a" />
        <circle cx="83" cy="42" r="3" fill="#0f172a" />
      `;
    }
  }

  // 입 모양 드로잉 변경 유틸
  setMouth(type) {
    if (!this.mouthPath) return;

    if (type === 'smile') {
      this.mouthPath.setAttribute('d', 'M69 50Q75 56 81 50');
    } else if (type === 'sad') {
      this.mouthPath.setAttribute('d', 'M69 54Q75 49 81 54');
    } else {
      // straight
      this.mouthPath.setAttribute('d', 'M69 52L81 52');
    }
  }
}

customElements.define('turtle-character', TurtleCharacter);
