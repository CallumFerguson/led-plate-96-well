#include "Adafruit_TLC5947.h"

#define PIN_DATA 3
#define PIN_CLOCK 5
#define PIN_LATCH 9
#define PIN_BLANK 6

#define NUM_TLC5947 4
constexpr uint16_t NUM_CHANNELS = NUM_TLC5947 * 24;

Adafruit_TLC5947 tlc(NUM_TLC5947, PIN_CLOCK, PIN_DATA, PIN_LATCH);

struct SequenceStep
{
    uint32_t on_ms;            // ON window length
    uint32_t off_ms;           // OFF window length
    uint16_t intensity;        // value to return while ON
    uint32_t loop_duration_ms; // duration to run this step (0 = forever)
};

// Returns current intensity for the sequence.
// - 0 if we're in an OFF window or sequence has ended
// - step.intensity if we're in an ON window
// Safe across millis() rollover.
uint16_t sequenceIntensity(const SequenceStep *steps, size_t count)
{
    uint32_t elapsed = millis(); // rollover-safe elapsed time

    // Walk through steps, subtracting their durations until we find the active one.
    for (size_t i = 0; i < count; ++i)
    {
        const SequenceStep &s = steps[i];
        uint32_t dur = s.loop_duration_ms;

        // If this step is infinite or the remaining time falls within this step, evaluate it.
        if (dur == 0 || elapsed < dur)
        {
            // Edge cases
            if (s.intensity == 0)
                return 0; // explicitly off
            if (s.on_ms == 0)
                return 0; // never turns on
            if (s.off_ms == 0)
                return s.intensity; // always on within this step

            // Regular blinking within the step
            uint64_t period = (uint64_t)s.on_ms + (uint64_t)s.off_ms; // avoid overflow
            if (period == 0)
                return 0; // both zero -> off

            uint64_t phase = (uint64_t)elapsed % period;
            return (phase < s.on_ms) ? s.intensity : 0;
        }

        // Otherwise, move to the next step
        elapsed -= dur;
    }

    // Past the end of all steps -> off
    return 0;
}

// ===== START GENERATED CODE =====

int8_t wellGroup[] = {
    0, 1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1};

static const SequenceStep group0SequenceSteps[] = {
    {700, 300, 125, 10000},
    {2000, 1000, 5, 5000}};
static const SequenceStep group1SequenceSteps[] = {
    {250, 250, 50, 0}};

static const uint8_t groupSequenceStepCount[] = {
    (uint8_t)(sizeof(group0SequenceSteps) / sizeof(group0SequenceSteps[0])),
    (uint8_t)(sizeof(group1SequenceSteps) / sizeof(group1SequenceSteps[0]))};

static const SequenceStep *const groupSequences[] = {
    group0SequenceSteps,
    group1SequenceSteps};

// ===== END GENERATED CODE =====

constexpr int numGroups = sizeof(groupSequences) / sizeof(groupSequences[0]);

void setup()
{
    Serial.begin(115200);

    /*
        The TLC5947 BLANK pin keeps all the LEDs off when it is high. The board has
        a pull up resistor on the BLANK pin so the LEDs will be off by default. It is
        important to set all the LEDs to 0 intensity before setting the BLANK pin to
        low so the LEDs do not flash on during start up.
    */

    // turn all LEDs off
    tlc.begin();
    for (uint8_t i = 0; i < NUM_CHANNELS; i++)
    {
        tlc.setPWM(i, 0);
    }
    tlc.write();

    // set blank pin to low
    pinMode(PIN_BLANK, OUTPUT);
    digitalWrite(PIN_BLANK, LOW);
}

unsigned long lastReportMs = 0;
unsigned long loopCount = 0;

void loop()
{
    loopCount++;

    unsigned long now = millis();
    if (now - lastReportMs >= 1000)
    {
        // ~1 second passed
        // Compute Hz based on actual elapsed time to avoid drift
        float hz = (loopCount * 1000.0f) / (now - lastReportMs);

        Serial.print(F("loop() ≈ "));
        Serial.print(hz, 1);
        Serial.println(F(" Hz"));

        loopCount = 0;
        lastReportMs = now;
    }

    for (int group = 0; group < numGroups; group++)
    {
        uint16_t intensity = sequenceIntensity(groupSequences[group], groupSequenceStepCount[group]);
        for (uint8_t well = 0; well < NUM_CHANNELS; well++)
        {
            if (wellGroup[well] == group)
            {
                tlc.setPWM(well, intensity);
            }
        }
    }

    tlc.write();
}
