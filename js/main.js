/* 
  My Friend Turtle - Main Orchestrator
  웹캠 제어, MediaPipe Pose 분석 파이프라인 및 거북목 2초 연속 유지 판정(Calibration & Debounce) 상태 머신을 총괄합니다.
  (3단계 스펙: 삼각함수 각도 계산, 기준 자세 보정, 2초 디바운스 타이머 및 즉각 복귀 판정 구현)
*/

document.addEventListener('DOMContentLoaded', () => {
  const cameraViewer = document.getElementById('camera-viewer');
  const turtleCharacter = document.getElementById('turtle-character');
  const statusCard = document.getElementById('status-card');
  const controlPanel = document.getElementById('control-panel');

  let pose = null;
  let camera = null;
  let activeStream = null;

  // 상태 판정 변수
  let baseAngle = 0;
  let isCalibrated = false;
  let currentAngle = 0;
  let warningTimer = null;
  let lastState = 'pending'; // 'pending', 'analyzing', 'correct', 'warning', 'failed'

  // Web Serial 관련 변수
  let serialPort = null;
  let serialWriter = null;
  let serialReader = null;
  let readLoopActive = false;

  // 1. 두 점(귀, 어깨) 간의 수직축 대비 각도(θ) 계산 함수
  function calculateAngle(ear, shoulder) {
    const dx = Math.abs(ear.x - shoulder.x);
    const dy = Math.abs(ear.y - shoulder.y);
    if (dy === 0) return 90; // 0 나누기 방지
    // 삼각함수 역탄젠트를 이용해 수직 방향 사잇각 구하기
    const radians = Math.atan2(dx, dy);
    return radians * (180 / Math.PI);
  }

  // 2. MediaPipe Pose 인스턴스 초기화
  function initPose() {
    if (pose) return;

    pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults(onPoseResults);
  }

  // 3. MediaPipe Pose 결과 콜백 함수 (스켈레톤 드로잉 및 실시간 판정)
  function onPoseResults(results) {
    if (!results || !results.poseLandmarks) {
      handleDetectionFailure();
      return;
    }

    const landmarks = results.poseLandmarks;

    // 가시성(visibility)이 더 높은 쪽의 옆모습(귀, 어깨 쌍) 랜드마크 고르기
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    const leftVisibility = (leftEar.visibility || 0) + (leftShoulder.visibility || 0);
    const rightVisibility = (rightEar.visibility || 0) + (rightShoulder.visibility || 0);
    const useLeft = leftVisibility > rightVisibility;

    const activeEar = useLeft ? leftEar : rightEar;
    const activeShoulder = useLeft ? leftShoulder : rightShoulder;
    const activeEarIdx = useLeft ? 7 : 8;
    const activeShoulderIdx = useLeft ? 11 : 12;

    // 랜드마크 감지 신뢰도 검증 (임계값 0.5 미만이면 화면 이탈로 간주)
    if ((activeEar.visibility || 0) < 0.5 || (activeShoulder.visibility || 0) < 0.5) {
      handleDetectionFailure();
      return;
    }

    // A. 실시간 각도 계산 및 상태 카드 업데이트
    currentAngle = calculateAngle(activeEar, activeShoulder);
    statusCard.setAttribute('current-angle', Math.round(currentAngle).toString());

    // B. 스켈레톤 드로잉 위임
    cameraViewer.drawSkeleton(
      landmarks, 
      { ...activeEar, index: activeEarIdx }, 
      { ...activeShoulder, index: activeShoulderIdx }
    );

    // C. 자세 판정 로직 분기
    if (!isCalibrated) {
      // 1. 보정 등록 전: 분석 진행 중 (기본 상태)
      updateUIState('analyzing');
    } else {
      // 2. 보정 등록 후: 변화량(Δθ) 모니터링
      const delta = Math.max(0, currentAngle - baseAngle);
      turtleCharacter.setAttribute('delta-angle', Math.round(delta).toString());

      if (delta >= 15) {
        // [거북목 의심 상태] -> 2초 연속 유지 시에만 warning 경고 상태로 최종 전이
        if (!warningTimer && lastState !== 'warning') {
          console.log('거북목 자세 감지: 2초 디바운스 타이머 가동...');
          warningTimer = setTimeout(() => {
            updateUIState('warning');
            warningTimer = null;
          }, 2000);
        }
      } else {
        // [바른 자세 상태] -> 2초 지연 대기 없이 즉각 복귀
        if (warningTimer) {
          clearTimeout(warningTimer);
          warningTimer = null;
        }
        updateUIState('correct');
      }
    }
  }

  // 4. 감지 실패 처리
  function handleDetectionFailure() {
    clearDebounceTimer();
    updateUIState('failed');
    cameraViewer.drawSkeleton(null);
  }

  // 5. 디바운스 타이머 리셋
  function clearDebounceTimer() {
    if (warningTimer) {
      clearTimeout(warningTimer);
      warningTimer = null;
    }
  }

  // 6. UI 컴포넌트 상태 일괄 업데이트
  function updateUIState(state) {
    if (lastState === state) return;
    lastState = state;

    cameraViewer.setAttribute('status', state);
    turtleCharacter.setAttribute('status', state);

    // 아두이노로 상태 맞춤형 LED 명령어(NEO:값\n) 전송
    const cmd = getStateCommand(state);
    sendSerialCommand(cmd);
  }

  // 상태에 따른 아두이노 명령어 매핑 함수
  function getStateCommand(state) {
    switch (state) {
      case 'correct':
        return 'NEO:ALL:0:255:0\n';
      case 'warning':
        return 'NEO:ALL:255:0:0\n';
      case 'analyzing':
        return 'NEO:ALL:0:0:255\n';
      case 'failed':
      case 'pending':
      default:
        return 'NEO:ALL:0:0:0\n';
    }
  }

  // 아두이노 시리얼 연결 함수
  async function connectArduino() {
    try {
      // 1. 포트 선택 요청 및 열기
      serialPort = await navigator.serial.requestPort();
      await serialPort.open({ baudRate: 9600 });

      // 2. 라이터 생성
      serialWriter = serialPort.writable.getWriter();

      // 3. UI 연결됨🟢 상태 반영
      controlPanel.setAttribute('arduino-connected', 'true');
      console.log('아두이노 연결 완료');

      // 4. 데이터 수신 루프 구동
      startReading();

      // 5. 연결 직후 현재 상태 동기화 명령어 전송
      const initialCmd = getStateCommand(lastState);
      await sendSerialCommand(initialCmd);

    } catch (err) {
      console.error('아두이노 연결 오류:', err);
      // 사용자가 창을 닫은 경우(NotFoundError) 등 예외 처리
      if (err.name !== 'NotFoundError') {
        alert('아두이노 연결에 실패했습니다: ' + err.message);
      }
      controlPanel.setAttribute('arduino-connected', 'false');
      cleanupSerial();
    }
  }

  // 아두이노 연결 해제 함수
  async function disconnectArduino() {
    try {
      if (serialPort && serialWriter) {
        // 연결 종료 전 LED 소등
        await sendSerialCommand('NEO:ALL:0:0:0\n');
      }
    } catch (e) {
      console.warn('연결 해제 전 LED 소등 실패:', e);
    }
    await cleanupSerial();
    controlPanel.setAttribute('arduino-connected', 'false');
    console.log('아두이노 연결 해제 완료');
  }

  // 시리얼 리소스 해제 및 세션 정리 함수
  async function cleanupSerial() {
    readLoopActive = false;

    if (serialReader) {
      try {
        await serialReader.cancel();
      } catch (err) {
        console.warn('Reader cancel error:', err);
      }
      serialReader = null;
    }

    if (serialWriter) {
      try {
        serialWriter.releaseLock();
      } catch (err) {
        console.warn('Writer releaseLock error:', err);
      }
      serialWriter = null;
    }

    if (serialPort) {
      try {
        await serialPort.close();
      } catch (err) {
        console.warn('Port close error:', err);
      }
      serialPort = null;
    }
  }

  // 시리얼 명령어 송신 함수
  async function sendSerialCommand(commandText) {
    if (!serialWriter || !serialPort) {
      console.log(`[시리얼 미연결로 전송하지 않음]: ${commandText.trim()}`);
      return;
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(commandText);
      await serialWriter.write(data);
      console.log(`[시리얼 전송 성공]: ${commandText.trim()}`);
    } catch (err) {
      console.error('시리얼 전송 중 에러 발생 (물리적 끊김 가능성):', err);
      handleSerialError('데이터 송신에 실패했습니다.');
    }
  }

  // 백그라운드 데이터 수신 루프 함수
  async function startReading() {
    if (!serialPort || !serialPort.readable) return;
    readLoopActive = true;
    
    try {
      serialReader = serialPort.readable.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (readLoopActive) {
        const { value, done } = await serialReader.read();
        if (done) {
          console.log('Reader stream closed');
          break;
        }
        if (value) {
          buffer += decoder.decode(value);
          const lines = buffer.split('\n');
          // 불완전한 마지막 줄은 다음 수신 데이터와 합치기 위해 버퍼에 보관
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length > 0) {
              console.log('[Arduino Serial Raw]:', trimmed);
            }
          }
        }
      }
    } catch (err) {
      // 리더 스트림 읽기 오류가 발생하면 (주로 물리적 끊김)
      console.error('시리얼 리더 루프 예외 발생:', err);
      handleSerialError('통신 오류 또는 아두이노 장치가 연결 해제되었습니다.');
    } finally {
      if (serialReader) {
        serialReader.releaseLock();
        serialReader = null;
      }
    }
  }

  // 물리적 연결 끊김 혹은 통신 오류 대응 처리 함수
  function handleSerialError(message) {
    cleanupSerial();
    controlPanel.setAttribute('arduino-connected', 'false');

    // UI 인디케이터 초기화 및 모달 알림창 표시
    alert(`[아두이노 오류] ${message}`);

    // 거북이 캐릭터 대사창에 연결 해제 경고 메시지 노출
    const bubbleMsg = turtleCharacter.querySelector('#bubble-msg');
    if (bubbleMsg) {
      bubbleMsg.textContent = '🔌 아두이노 연결이 끊어졌어요! 케이블을 확인해 주세요.';
    }
  }

  // Web Serial API 물리적 연결 해제(disconnect) 이벤트 리스너 추가
  navigator.serial?.addEventListener('disconnect', (event) => {
    if (serialPort && event.target === serialPort) {
      console.warn('아두이노 시리얼 장치가 PC에서 완전히 분리되었습니다.');
      handleSerialError('아두이노 USB 케이블이 분리되었습니다! 연결 상태를 확인해 주세요.');
    }
  });

  // 7. 웹캠 및 스트림 구동
  async function startWebcam() {
    try {
      initPose();
      
      const videoElement = cameraViewer.video;

      // 웹캠 디바이스 획득
      activeStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false
      });
      videoElement.srcObject = activeStream;

      // 웹캠 강제 재생
      try {
        await videoElement.play();
      } catch (playErr) {
        console.warn('비디오 play() 호출 무시됨:', playErr);
      }

      // MediaPipe 카메라 헬퍼 가동
      camera = new Camera(videoElement, {
        onFrame: async () => {
          if (activeStream && videoElement.srcObject) {
            await pose.send({ image: videoElement });
          }
        },
        width: 640,
        height: 480
      });

      await camera.start();
      
      controlPanel.setAttribute('camera-active', 'true');
      updateUIState('analyzing');
      console.log('카메라 및 MediaPipe 자세 탐지 파이프라인 가동 완료.');
    } catch (err) {
      console.error('웹캠 권한 획득 또는 구동 에러:', err);
      
      updateUIState('failed');
      
      let errMsg = '카메라 구동 실패: 권한을 허용했는지 확인해 주세요.';
      if (err.name === 'NotReadableError' || err.message.includes('in use') || err.message.includes('Readable')) {
        errMsg = '카메라가 다른 탭이나 프로그램에서 이미 사용 중입니다. 다른 창을 닫고 다시 시도해 주세요! 📷';
      }
      
      const bubbleMsg = turtleCharacter.querySelector('#bubble-msg');
      if (bubbleMsg) {
        bubbleMsg.textContent = errMsg;
      }

      controlPanel.setAttribute('camera-active', 'false');
      stopWebcam();
    }
  }

  // 8. 웹캠 및 스트림 정지
  function stopWebcam() {
    clearDebounceTimer();

    if (camera) {
      camera.stop();
      camera = null;
    }
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      activeStream = null;
    }
    
    const videoElement = cameraViewer.video;
    if (videoElement) {
      videoElement.srcObject = null;
    }

    cameraViewer.drawSkeleton(null);

    // 보정 세션 초기화
    isCalibrated = false;
    baseAngle = 0;
    statusCard.setAttribute('current-angle', '0');
    statusCard.setAttribute('base-angle', '0');
    turtleCharacter.setAttribute('delta-angle', '0');

    controlPanel.setAttribute('camera-active', 'false');
    updateUIState('pending');
  }

  // --- 이벤트 리스너 바인딩 ---

  // 카메라 스위치 ON/OFF
  document.addEventListener('camera-toggle', () => {
    const isActive = controlPanel.getAttribute('camera-active') === 'true';
    if (isActive) {
      stopWebcam();
    } else {
      startWebcam();
    }
  });

  // 3단계 스펙: 기준 자세 등록(Calibration)
  document.addEventListener('calibrate-trigger', () => {
    // 카메라가 켜져 있고 유효한 각도가 계산되어 있는 경우에만 보정 가능
    if (lastState !== 'pending' && lastState !== 'failed' && currentAngle > 0) {
      baseAngle = currentAngle;
      isCalibrated = true;
      statusCard.setAttribute('base-angle', Math.round(baseAngle).toString());
      
      // 타이머 및 상태 즉시 복귀
      clearDebounceTimer();
      updateUIState('correct');
      
      console.log(`[기준 자세 등록 성공] 기준 각도(θ_base): ${Math.round(baseAngle)}°`);
    } else {
      alert('카메라가 꺼져 있거나 자세가 감지되지 않아 기준 자세를 등록할 수 없습니다.');
    }
  });

  // 4단계 스펙: 아두이노 연결 및 Web Serial 연동
  document.addEventListener('arduino-connect', async () => {
    const isConnected = controlPanel.getAttribute('arduino-connected') === 'true';
    if (isConnected) {
      await disconnectArduino();
    } else {
      await connectArduino();
    }
  });
});
