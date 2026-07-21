#include <DHT.h>
#include <Adafruit_NeoPixel.h>
#include <Servo.h>
#include <SoftwareSerial.h>
#include <DFRobotDFPlayerMini.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// --- 핀 번호 정의 (요구사항 기준) ---
#define DHTPIN 4
#define DHTTYPE DHT11 // DHT11 기준 (DHT22일 경우 DHT22로 변경)

#define MOTOR_PIN 5   // DC모터와 LED가 5번 핀을 공유하므로 통합 제어
#define LED_PIN 5

#define BUZZER_PIN 6
#define NEOPIXEL_PIN 7
#define NUMPIXELS 4

#define SERVO_PIN 8

#define MP3_RX 10
#define MP3_TX 11

#define TRIG_PIN 13
#define ECHO_PIN 12

#define LIGHT_PIN A0
#define SOIL_PIN A1
#define DUST_OUT_PIN A2
#define DUST_LED_PIN 2
#define TACT_SWITCH_PIN A3

// --- 객체 생성 ---
DHT dht(DHTPIN, DHTTYPE);
// [수정 완료] NEOGRB -> NEO_GRB 로 변경
Adafruit_NeoPixel pixels(NUMPIXELS, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);
Servo myServo;
SoftwareSerial mp3Serial(MP3_RX, MP3_TX);
DFRobotDFPlayerMini myDFPlayer;
LiquidCrystal_I2C lcd(0x27, 16, 2); // I2C 주소는 일반적으로 0x27 또는 0x3F

// --- 전역 변수 ---
unsigned long lastSensorReport = 0;
const unsigned long reportInterval = 2000; // 2초마다 웹으로 센서 데이터 자동 전송

void setup() {
  // 시리얼 통신 초기화 (Web Serial API 표준 속도)
  Serial.begin(115200);
  
  // 핀 모드 설정
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(DUST_LED_PIN, OUTPUT);
  pinMode(TACT_SWITCH_PIN, INPUT_PULLUP); // 내부 풀업 저항 사용

  // 각 부품 초기화
  dht.begin();
  pixels.begin();
  pixels.show(); // 네오픽셀 초기화 (모두 끔)
  myServo.attach(SERVO_PIN);
  myServo.write(90); // 서보 초기 각도 90도
  
  // MP3 모듈 초기화
  mp3Serial.begin(9600);
  myDFPlayer.begin(mp3Serial, false, false); // 메모리 절약을 위해 정밀 체크 해제
  myDFPlayer.volume(20); // 기본 볼륨 20 (0~30)

  // LCD 초기화
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("WebSerial Ready");
}

void loop() {
  // 1. 웹 브라우저로부터 명령 수신 처리
  if (Serial.available() > 0) {
    String inputString = Serial.readStringUntil('\n');
    inputString.trim(); // 공백 및 줄바꿈 제거
    if (inputString.length() > 0) {
      parseAndExecute(inputString);
    }
  }

  // 2. 주기적인 센서 데이터 웹으로 송신 (2초 주기)
  unsigned long currentMillis = millis();
  if (currentMillis - lastSensorReport >= reportInterval) {
    lastSensorReport = currentMillis;
    reportSensors();
  }
}

// --- 명령 해석 및 실행 함수 ---
void parseAndExecute(String command) {
  int colonIndex = command.indexOf(':');
  
  // 잘못된 형식 방어 코드
  if (colonIndex == -1) {
    Serial.println("ERR:Invalid format. Use 'CMD:VAL'");
    return;
  }

  String cmd = command.substring(0, colonIndex);
  String valStr = command.substring(colonIndex + 1);
  int val = valStr.toInt();

  cmd.toUpperCase(); // 대소문자 구분 없앰

  // --- 제어 로직 분기 ---
  if (cmd == "LED" || cmd == "MOTOR") {
    analogWrite(MOTOR_PIN, constrain(val, 0, 255));
    Serial.println("ACK:" + cmd + " SUCCESS");
  } 
  else if (cmd == "SERVO") {
    val = constrain(val, 0, 180);
    myServo.write(val);
    Serial.println("ACK:SERVO SUCCESS");
  } 
  else if (cmd == "BUZZER") {
    if (val == 0) {
      noTone(BUZZER_PIN);
    } else {
      tone(BUZZER_PIN, val);
    }
    Serial.println("ACK:BUZZER SUCCESS");
  } 
  else if (cmd == "NEO") {
    uint32_t color = pixels.Color(0, 0, 0);
    if (val == 1) color = pixels.Color(255, 0, 0);
    else if (val == 2) color = pixels.Color(0, 255, 0);
    else if (val == 3) color = pixels.Color(0, 0, 255);
    
    for(int i=0; i<NUMPIXELS; i++) {
      pixels.setPixelColor(i, color);
    }
    pixels.show();
    Serial.println("ACK:NEO SUCCESS");
  } 
  else if (cmd == "MP3") {
    if (val == 1) myDFPlayer.start();
    else if (val == 2) myDFPlayer.pause();
    else if (val == 3) myDFPlayer.next();
    else if (val > 10) myDFPlayer.play(val - 10); 
    Serial.println("ACK:MP3 SUCCESS");
  } 
  else if (cmd == "LCD") {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(valStr.substring(0, 16)); 
    if (valStr.length() > 16) {
      lcd.setCursor(0, 1);
      lcd.print(valStr.substring(16, 32)); 
    }
    Serial.println("ACK:LCD SUCCESS");
  } 
  else {
    Serial.println("ERR:Unknown Command -> " + cmd);
  }
}

// --- 센서 데이터 수집 및 웹 전송 함수 ---
void reportSensors() {
  // 1. 온습도
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  
  // 2. 초음파 거리 측정 [수정 완료: TIME_OUT 제거 및 HIGH 상태 추가]
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms 동안 HIGH 신호의 길이 측정
  float distance = (duration / 2.0) * 0.0343;

  // 3. 아날로그 센서들
  int light = analogRead(LIGHT_PIN);
  int soil = analogRead(SOIL_PIN);
  
  // 4. 미세먼지 측정
  digitalWrite(DUST_LED_PIN, LOW); 
  delayMicroseconds(280);
  int dustAnalog = analogRead(DUST_OUT_PIN);
  delayMicroseconds(40);
  digitalWrite(DUST_LED_PIN, HIGH); 
  
  // 5. 택트 스위치
  int swState = digitalRead(TACT_SWITCH_PIN) == LOW ? 1 : 0;

  // JSON 형태로 전송
  Serial.print("DATA:{\"temp\":"); Serial.print(isnan(t)?0:t);
  Serial.print(",\"humi\":"); Serial.print(isnan(h)?0:h);
  Serial.print(",\"dist\":"); Serial.print(distance);
  Serial.print(",\"light\":"); Serial.print(light);
  Serial.print(",\"soil\":"); Serial.print(soil);
  Serial.print(",\"dust\":"); Serial.print(dustAnalog);
  Serial.print(",\"switch\":"); Serial.print(swState);
  Serial.println("}");
}