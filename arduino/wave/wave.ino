#include "Adafruit_TLC5947.h"

#define NUM_TLC5947 4             // 96 channels (12 × 8)

#define PIN_DATA   3
#define PIN_CLOCK  5
#define PIN_LATCH  9
#define PIN_OE     6              // set to -1 if not used

Adafruit_TLC5947 tlc(NUM_TLC5947, PIN_CLOCK, PIN_DATA, PIN_LATCH);

// Grid size
const uint8_t ROWS = 8;
const uint8_t COLS = 12;

// ---------- Wave settings ----------
const float     MAX_LEVEL_PCT      = 0.01f;   // 1 % peak
const uint16_t  FRAME_DELAY_MS     = 20;      // ~50 fps
const float     WAVE_PERIOD_MS     = 3000.0f; // time for one full drift
const float     DIAG_WAVELENGTH    = ROWS + COLS; // 20 steps ≈ one sine
const bool      HALF_WAVE          = true;    // off between ridges?
// -----------------------------------

const uint16_t MAX_PWM = (uint16_t)(4095 * MAX_LEVEL_PCT + 0.5f);

// column-major mapping: channel = col*ROWS + row
inline uint8_t chan(uint8_t row, uint8_t col) { return col * ROWS + row; }

void setup() {
  tlc.begin();

  // blank everything before enabling OE
  for (uint8_t ch = 0; ch < 24 * NUM_TLC5947; ++ch) tlc.setPWM(ch, 0);
  tlc.write();

  if (PIN_OE >= 0) {
    pinMode(PIN_OE, OUTPUT);
    digitalWrite(PIN_OE, LOW);          // outputs on (all off right now)
  }
}

// brightness for a given (row,col) at time nowMs
uint16_t diagBrightness(uint8_t row, uint8_t col, uint32_t nowMs) {
  float spatialPhase = 2.0f * PI * (row + col) / DIAG_WAVELENGTH;  // 0‥2π
  float timePhase    = 2.0f * PI * nowMs / WAVE_PERIOD_MS;         // 0‥2π
  float s            = sinf(spatialPhase - timePhase);             // −1‥1

  float norm = HALF_WAVE ? (s > 0.0f ? s : 0.0f)       // bright ridge w/ gaps
                         : 0.5f * (s + 1.0f);          // always glowing

  return (uint16_t)(norm * MAX_PWM + 0.5f);
}

void loop() {
  uint32_t now = millis();

  for (uint8_t col = 0; col < COLS; ++col) {
    for (uint8_t row = 0; row < ROWS; ++row) {
      tlc.setPWM(chan(row, col), diagBrightness(row, col, now));
    }
  }
  tlc.write();
  delay(FRAME_DELAY_MS);
}
