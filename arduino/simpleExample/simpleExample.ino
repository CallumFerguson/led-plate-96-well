#include "Adafruit_TLC5947.h"

#define PIN_DATA 3
#define PIN_CLOCK 5
#define PIN_LATCH 9
#define PIN_BLANK 6

#define NUM_TLC5947 4

Adafruit_TLC5947 tlc(NUM_TLC5947, PIN_CLOCK, PIN_DATA, PIN_LATCH);

void setup() {
    /*
        The TLC5947 BLANK pin keeps all the LEDs off when it is high. The board has
        a pull up resistor on the BLANK pin so the LEDs will be off by default. It is
        important to set all the LEDs to 0 intensity before setting the BLANK pin to
        low so the LEDs do not flash on during start up.
    */

    // turn all LEDs off
    tlc.begin();
    for (uint8_t i = 0; i < 96; i++) {
        tlc.setPWM(i, 0);
    }
    tlc.write();

    // set blank pin to low
    pinMode(PIN_BLANK, OUTPUT);
    digitalWrite(PIN_BLANK, LOW);
}

void loop() {
    // set all LEDs to a low intensity
    tlc.begin();
    for (uint8_t i = 0; i < 96; i++) {
        tlc.setPWM(i, 1);
    }
    tlc.write();
}
