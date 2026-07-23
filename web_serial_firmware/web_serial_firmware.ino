#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <Adafruit_NeoPixel.h>
#include <Servo.h>
#include <SoftwareSerial.h>
#include <DFRobotDFPlayerMini.h>

// 핀 정의 (요구사항 반영)
#define DHT_PIN       4
#define DC_MOTOR_PIN  5  // 5번 핀 (DC모터 / 단색 LED 겸용)
#define LED_PIN       5
#define PIEZO_PIN     6
#define NEOPIXEL_PIN  7
#define SERVO_PIN     8
#define MP3_RX_PIN    10
#define MP3_TX_PIN    11
#define ECHO_PIN      12
#define TRIG_PIN      13

#define LIGHT_PIN     A0
#define SOIL_PIN      A1
#define BUTTON_PIN    A3

// 설정 상수
#define DHT_TYPE      DHT11
#define NUM_PIXELS    4

// 객체 생성
LiquidCrystal_I2C lcd(0x27, 16, 2); // LCD 주소 (안될 경우 0x3F 확인)
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_NeoPixel pixels(NUM_PIXELS, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);
Servo myServo;
SoftwareSerial mp3Serial(MP3_RX_PIN, MP3_TX_PIN);
DFRobotDFPlayerMini myDFPlayer;

bool mp3Available = false;

void setup() {
  // 시리얼 통신 시작 (Web Serial 표준 속도)
  Serial.begin(9600);
  
  // 핀 모드 설정
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(DC_MOTOR_PIN, OUTPUT);
  pinMode(PIEZO_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // 센서 및 모듈 초기화
  dht.begin();
  pixels.begin();
  pixels.show(); // 네오픽셀 초기화 (끄기)
  
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.print("WebSerial Ready");

  // MP3 모듈 초기화
  mp3Serial.begin(9600);
  if (myDFPlayer.begin(mp3Serial)) {
    mp3Available = true;
    myDFPlayer.volume(20); // 초기 볼륨 0~30
  }
}

void loop() {
  // 웹(Web Serial)에서 전송된 시리얼 명령 수신 및 처리
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    if (input.length() > 0) {
      processCommand(input);
    }
  }
}

// --------------------------------------------------
// 범용 명령 구문 분석 및 부품 제어
// --------------------------------------------------
void processCommand(String cmd) {
  // 명령어 분리 (형식 -> COMMAND:PARAM1:PARAM2...)
  int firstColon = cmd.indexOf(':');
  String command = (firstColon == -1) ? cmd : cmd.substring(0, firstColon);
  String params = (firstColon == -1) ? "" : cmd.substring(firstColon + 1);

  command.toUpperCase();

  // 1. LCD 제어 (형식: LCD:행(0or1):텍스트 또는 LCD:CLEAR)
  if (command == "LCD") {
    int colon = params.indexOf(':');
    if (colon != -1) {
      int line = params.substring(0, colon).toInt();
      String text = params.substring(colon + 1);
      
      line = constrain(line, 0, 1);
      lcd.setCursor(0, line);
      lcd.print("                "); // 기존 라인 지우기
      lcd.setCursor(0, line);
      lcd.print(text.substring(0, 16));
      sendResponse("LCD", "OK");
    } else if (params == "CLEAR") {
      lcd.clear();
      sendResponse("LCD", "CLEARED");
    }
  }
  
  // 2. DC 모터 제어 (5번 핀 / 형식: MOTOR:속도 0~255)
  else if (command == "MOTOR") {
    int speed = params.toInt();
    speed = constrain(speed, 0, 255);
    analogWrite(DC_MOTOR_PIN, speed);
    sendResponse("MOTOR", String(speed));
  }

  // 3. 단색 LED 제어 (5번 핀 / 형식: LED:밝기 0~255)
  else if (command == "LED") {
    int brightness = params.toInt();
    brightness = constrain(brightness, 0, 255);
    analogWrite(LED_PIN, brightness);
    sendResponse("LED", String(brightness));
  }
  
  // 4. 피에조 부저 제어 (형식: BUZZER:주파수:시간ms 또는 BUZZER:OFF)
  else if (command == "BUZZER") {
    int colon = params.indexOf(':');
    if (colon != -1) {
      int freq = params.substring(0, colon).toInt();
      int duration = params.substring(colon + 1).toInt();
      if (freq > 0) tone(PIEZO_PIN, freq, duration);
      else noTone(PIEZO_PIN);
      sendResponse("BUZZER", "OK");
    } else {
      noTone(PIEZO_PIN);
      sendResponse("BUZZER", "OFF");
    }
  }
  
  // 5. 네오픽셀 RGB LED 제어 (형식: NEO:인덱스(0~3 또는 ALL):R:G:B)
  else if (command == "NEO") {
    int p1 = params.indexOf(':');
    int p2 = params.indexOf(':', p1 + 1);
    int p3 = params.indexOf(':', p2 + 1);

    if (p1 != -1 && p2 != -1 && p3 != -1) {
      String target = params.substring(0, p1);
      int r = params.substring(p1 + 1, p2).toInt();
      int g = params.substring(p2 + 1, p3).toInt();
      int b = params.substring(p3 + 1).toInt();

      if (target == "ALL") {
        for (int i = 0; i < NUM_PIXELS; i++) {
          pixels.setPixelColor(i, pixels.Color(r, g, b));
        }
      } else {
        int idx = target.toInt();
        if (idx >= 0 && idx < NUM_PIXELS) {
          pixels.setPixelColor(idx, pixels.Color(r, g, b));
        }
      }
      pixels.show();
      sendResponse("NEO", "OK");
    }
  }

  // 6. 서보모터 제어 (형식: SERVO:각도 0~180)
  else if (command == "SERVO") {
    int angle = params.toInt();
    angle = constrain(angle, 0, 180);
    if (!myServo.attached()) myServo.attach(SERVO_PIN);
    myServo.write(angle);
    sendResponse("SERVO", String(angle));
  }

  // 7. MP3 모듈 제어 (형식: MP3:PLAY:트랙번호, MP3:VOL:0~30, MP3:STOP)
  else if (command == "MP3" && mp3Available) {
    int colon = params.indexOf(':');
    if (colon != -1) {
      String subCmd = params.substring(0, colon);
      int val = params.substring(colon + 1).toInt();
      
      if (subCmd == "PLAY") {
        myDFPlayer.play(val);
        sendResponse("MP3", "PLAYING " + String(val));
      } else if (subCmd == "VOL") {
        myDFPlayer.volume(constrain(val, 0, 30));
        sendResponse("MP3", "VOL " + String(val));
      }
    } else if (params == "STOP") {
      myDFPlayer.stop();
      sendResponse("MP3", "STOPPED");
    }
  }

  // 8. 센서 데이터 일괄 조회 (형식: READ)
  else if (command == "READ") {
    readAllSensors();
  }

  // 예외 처리 (잘못된 명령어 수신 시 오류 없이 응답 전송)
  else {
    sendResponse("ERROR", "UNKNOWN_COMMAND");
  }
}

// 센서 일괄 읽기 및 JSON 전송
void readAllSensors() {
  // 초음파 센서
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  float distance = duration * 0.034 / 2;

  // 온습도 센서
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  // 아날로그 / 디지털 센서
  int light = analogRead(LIGHT_PIN);
  int soil = analogRead(SOIL_PIN);
  int btn = digitalRead(BUTTON_PIN) == LOW ? 1 : 0;

  // JSON 출력
  Serial.print("{\"temp\":");
  Serial.print(isnan(temp) ? -1 : temp);
  Serial.print(",\"hum\":");
  Serial.print(isnan(hum) ? -1 : hum);
  Serial.print(",\"dist\":");
  Serial.print(distance);
  Serial.print(",\"light\":");
  Serial.print(light);
  Serial.print(",\"soil\":");
  Serial.print(soil);
  Serial.print(",\"btn\":");
  Serial.print(btn);
  Serial.println("}");
}

// 상태 응답 함수
void sendResponse(String tag, String msg) {
  Serial.print("{\"status\":\"");
  Serial.print(tag);
  Serial.print("\",\"value\":\"");
  Serial.print(msg);
  Serial.println("\"}");
}