# monotron DELAY VST/AU Handoff

This document describes how to port the ddxx7 global monotron-style delay into
a standalone VST3/AU effect plugin or into the global FX stage of a synth
plugin. The source of truth is the current Web Audio implementation in:

- `public/dx7-processor.js`
- `types.ts`
- `services/engine.ts`
- `components/GlobalFxPanel.tsx`

## Scope

Build a global delay effect with two parameters:

| Parameter ID | Label | Range | Default | Meaning |
| --- | --- | ---: | ---: | --- |
| `delayTime` | `Dly Time` | `0..99` integer/stepped | `45` | PT2399-style delay time control |
| `delayFeedback` | `Dly FB` | `0..99` integer/stepped | `0` | Wet return and feedback amount |

Important behavior:

- The delay is global effect state, not part of a synth patch.
- Changing synth presets/patches must not reset delay settings or delay tail.
- Setting `delayFeedback` to `0` effectively bypasses the delay and clears the
  delay line, so there is no lingering tail.
- `delayFeedback` controls both wet level and feedback gain, like the compact
  monotron DELAY circuit behavior.
- High feedback can approach/self-oscillate, but the loop is stabilized by
  filtering, quantization, and `tanh` saturation.

## Signal Placement

For a synth plugin:

1. Sum/render all voices to stereo.
2. Process stereo through the monotron delay.
3. Apply the existing output limiter.
4. Continue to any existing dry/reverb/output routing.

For a pure VST/AU effect plugin:

1. Read stereo input.
2. Convert input to mono only for the delay write path:
   `mono = (left + right) * 0.5`.
3. Add mono wet return equally to left/right:
   `outL = inL + wet`, `outR = inR + wet`.
4. Do not collapse the dry stereo image.

## Delay Time Mapping

The UI parameter is `0..99`. Map it nonlinearly to an approximate PT2399 delay
range of about `31.3 ms` to `950 ms`.

```cpp
double delayMsForKnob(double value)
{
    const double x = std::clamp(value / 99.0, 0.0, 1.0);
    const double resistanceK = 0.5 + std::pow(x, 2.1) * 100.5;

    static constexpr std::array<std::pair<double, double>, 25> table {{
        {0.5, 31.3}, {0.723, 36.6}, {1.08, 40.6}, {1.28, 43.0},
        {1.47, 45.8}, {1.67, 48.1}, {2.0, 52.3}, {2.4, 56.6},
        {2.8, 61.6}, {3.4, 68.1}, {4.0, 75.9}, {4.5, 81.0},
        {4.9, 86.3}, {5.4, 92.2}, {5.8, 97.1}, {6.4, 104.3},
        {7.2, 113.7}, {8.2, 124.1}, {9.2, 136.6}, {10.5, 151.0},
        {12.1, 171.0}, {14.3, 196.0}, {17.2, 228.0}, {21.3, 273.0},
        {27.6, 342.0}
    }};

    if (resistanceK <= table.front().first)
        return table.front().second;

    for (size_t i = 1; i < table.size(); ++i)
    {
        const auto [r0, t0] = table[i - 1];
        const auto [r1, t1] = table[i];
        if (resistanceK <= r1)
        {
            const double mix = (resistanceK - r0) / (r1 - r0);
            return t0 + (t1 - t0) * mix;
        }
    }

    const double extended = (resistanceK - 27.6) / (101.0 - 27.6);
    return 342.0 + std::pow(std::clamp(extended, 0.0, 1.0), 0.78) * 608.0;
}
```

The delay read position is smoothed inside the DSP, not hard-switched:

```cpp
currentDelaySamples += (targetDelaySamples - currentDelaySamples) * 0.0009;
```

This is intentional. It creates the PT2399-style pitch warp when the time knob
moves. Do not replace it with clickless crossfading if the goal is to preserve
the current sound.

## Filters And Utility DSP

One-pole low-pass:

```cpp
struct OnePoleLowPass
{
    double sampleRate = 48000.0;
    double a = 0.0;
    float z = 0.0f;

    void setSampleRate(double sr) { sampleRate = sr; }

    void setCutoff(double hz)
    {
        const double nyquist = sampleRate * 0.5;
        hz = std::clamp(hz, 20.0, nyquist * 0.45);
        a = 1.0 - std::exp((-2.0 * juce::MathConstants<double>::pi * hz) / sampleRate);
    }

    float process(float x)
    {
        z += static_cast<float>(a) * (x - z);
        return z;
    }

    void reset() { z = 0.0f; }
};
```

DC blocker:

```cpp
struct DcBlocker
{
    float r = 0.995f;
    float x1 = 0.0f;
    float y1 = 0.0f;

    explicit DcBlocker(float coefficient = 0.995f) : r(coefficient) {}

    float process(float x)
    {
        const float y = x - x1 + r * y1;
        x1 = x;
        y1 = y;
        return y;
    }

    void reset()
    {
        x1 = 0.0f;
        y1 = 0.0f;
    }
};
```

Saturation:

```cpp
static float softClip(float x, float drive)
{
    return std::tanh(x * drive) / drive;
}
```

Noise generator:

```cpp
uint32_t noiseSeed = 0x12345678;

float nextNoise()
{
    noiseSeed = 1664525u * noiseSeed + 1013904223u;
    return static_cast<float>(static_cast<double>(noiseSeed) / 0x80000000u - 1.0);
}
```

## Derived Parameters

Recompute when `delayTime` or `delayFeedback` changes. The current JS code also
refreshes this every 32 samples while active.

```cpp
const double delayMs = targetDelaySamples * 1000.0 / sampleRate;
const double normTime = std::clamp((delayMs - 31.3) / (950.0 - 31.3), 0.0, 1.0);
const double amount = std::clamp(delayFeedback / 99.0, 0.0, 1.0);

this->amount = amount;
feedbackGain = amount * (0.54 + 0.64 * amount);
wetMix = amount * (0.12 + 0.5 * amount);
inputDrive = 1.15 + amount * 0.95;
noiseGain = amount * (0.000015 + normTime * normTime * 0.0012);
jitterDepth = amount * (0.15 + normTime * 5.5);
quantScale = std::pow(2.0, 14.0 - normTime * 4.5);

preLp.setCutoff(6200.0 - normTime * 3500.0);
postLpA.setCutoff(5200.0 - normTime * 4000.0);
postLpB.setCutoff(3600.0 - normTime * 2450.0);
feedbackLp.setCutoff(3100.0 - normTime * 2150.0);
```

## Per-Sample Algorithm

This is the exact processing shape to port.

```cpp
std::pair<float, float> processSample(float left, float right)
{
    const float mono = (left + right) * 0.5f;

    if (amount <= 0.0001)
    {
        feedbackSample = 0.0f;
        buffer[writeIndex] = 0.0f;
        writeIndex = (writeIndex + 1) % maxDelaySamples;
        return { left, right };
    }

    ++controlCounter;
    if ((controlCounter & 31) == 0)
        updateDerivedParams();

    if ((controlCounter & 511) == 0)
        jitterTarget = nextNoise() * jitterDepth;

    currentDelaySamples += (targetDelaySamples - currentDelaySamples) * 0.0009;
    jitter += (jitterTarget - jitter) * 0.00012;

    const double readDelaySamples = std::clamp(
        currentDelaySamples + jitter,
        1.0,
        static_cast<double>(maxDelaySamples - 4));

    const float delayedRaw = readDelay(readDelaySamples);
    const float noise = nextNoise() * noiseGain;

    float delayReturn = postLpA.process(delayedRaw + noise);
    delayReturn = postLpB.process(delayReturn);
    delayReturn = outputHp.process(delayReturn);
    delayReturn = softClip(delayReturn, 1.65f);

    const float feedback = feedbackLp.process(feedbackSample) * feedbackGain;

    float writeSample = inputHp.process(mono) + feedback;
    writeSample = preLp.process(softClip(writeSample, inputDrive));
    writeSample = std::round(writeSample * quantScale) / quantScale;

    buffer[writeIndex] = softClip(writeSample, 1.35f);
    writeIndex = (writeIndex + 1) % maxDelaySamples;

    feedbackSample = delayReturn;

    const float wet = softClip(delayReturn * wetMix, 1.4f);
    return { left + wet, right + wet };
}
```

Fractional delay read uses linear interpolation:

```cpp
float readDelay(double delaySamples)
{
    double readPos = static_cast<double>(writeIndex) - delaySamples;
    while (readPos < 0.0)
        readPos += maxDelaySamples;

    const auto i0 = static_cast<size_t>(std::floor(readPos)) % maxDelaySamples;
    const auto i1 = (i0 + 1) % maxDelaySamples;
    const float frac = static_cast<float>(readPos - std::floor(readPos));

    return buffer[i0] + (buffer[i1] - buffer[i0]) * frac;
}
```

## State And Lifecycle

Minimal class state:

```cpp
class MonotronDelay
{
public:
    void prepare(double newSampleRate);
    void reset();
    void setParams(float newDelayTime, float newDelayFeedback);
    std::pair<float, float> processSample(float left, float right);

private:
    double sampleRate = 48000.0;
    float delayTime = 45.0f;
    float delayFeedback = 0.0f;

    double currentDelaySamples = 0.0;
    double targetDelaySamples = 0.0;
    size_t maxDelaySamples = 0;
    size_t writeIndex = 0;
    std::vector<float> buffer;

    float feedbackSample = 0.0f;
    uint32_t noiseSeed = 0x12345678u;
    float jitter = 0.0f;
    float jitterTarget = 0.0f;
    uint32_t controlCounter = 0;

    double amount = 0.0;
    float feedbackGain = 0.0f;
    float wetMix = 0.0f;
    float inputDrive = 1.15f;
    float noiseGain = 0.0f;
    float jitterDepth = 0.0f;
    float quantScale = 16384.0f;

    DcBlocker inputHp { 0.995f };
    DcBlocker outputHp { 0.998f };
    OnePoleLowPass preLp;
    OnePoleLowPass postLpA;
    OnePoleLowPass postLpB;
    OnePoleLowPass feedbackLp;
};
```

Allocate the delay buffer in `prepareToPlay`:

```cpp
maxDelaySamples = static_cast<size_t>(std::ceil(sampleRate * 1.25)) + 8;
buffer.assign(maxDelaySamples, 0.0f);
```

Initialize filter defaults:

```cpp
inputHp = DcBlocker(0.995f);
outputHp = DcBlocker(0.998f);
preLp.setCutoff(5200.0);
postLpA.setCutoff(4200.0);
postLpB.setCutoff(3200.0);
feedbackLp.setCutoff(2600.0);
```

Parameter update behavior:

```cpp
void MonotronDelay::setParams(float newDelayTime, float newDelayFeedback)
{
    const float previousFeedback = delayFeedback;

    delayTime = std::clamp(newDelayTime, 0.0f, 99.0f);
    delayFeedback = std::clamp(newDelayFeedback, 0.0f, 99.0f);
    targetDelaySamples = delayMsForKnob(delayTime) * sampleRate / 1000.0;

    if (previousFeedback > 0.0f && delayFeedback <= 0.0f)
        reset();

    updateDerivedParams();
}
```

On sample-rate change:

- Reallocate the buffer.
- Recompute `currentDelaySamples` and `targetDelaySamples` from `delayTime`.
- Update all filters with the new sample rate.
- Call `updateDerivedParams()`.

When `delayFeedback` transitions from `> 0` to `<= 0`, call `reset()`. This is
part of the current behavior and prevents tail at zero feedback.

Do not reset the delay when a synth patch/preset changes. Only reset on:

- plugin `reset()`,
- transport/offline render reset if desired,
- sample-rate reinitialization,
- explicit panic/all-notes/all-FX reset,
- feedback moving to zero.

## JUCE Plugin Integration Notes

Recommended files:

- `Source/MonotronDelay.h`
- `Source/MonotronDelay.cpp`
- `Source/PluginProcessor.cpp`
- `Source/PluginEditor.cpp`

Suggested processor flow:

```cpp
void PluginProcessor::prepareToPlay(double sr, int samplesPerBlock)
{
    monotronDelay.prepare(sr);
}

void PluginProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;

    const float time = *delayTimeParam;
    const float feedback = *delayFeedbackParam;
    monotronDelay.setParams(time, feedback);

    const int numSamples = buffer.getNumSamples();
    auto* left = buffer.getWritePointer(0);
    auto* right = buffer.getNumChannels() > 1 ? buffer.getWritePointer(1) : nullptr;

    for (int i = 0; i < numSamples; ++i)
    {
        const float inL = left[i];
        const float inR = right ? right[i] : inL;
        const auto [outL, outR] = monotronDelay.processSample(inL, inR);

        left[i] = outL;
        if (right)
            right[i] = outR;
    }
}
```

Parameter hints:

- Use `AudioProcessorValueTreeState`.
- Use stepped `NormalisableRange<float>(0.0f, 99.0f, 1.0f)`.
- Keep host state persistence enabled for these two parameters.
- If this is inside a synth plugin with separate patch storage, do not serialize
  these values into the synth patch payload. Let the plugin/host state own them.

Automation hints:

- It is OK for hosts to automate `delayTime`; the delay line's internal
  smoothing creates the audible pitch glide.
- Avoid adding a second long smoothing stage to `delayTime`, or the PT2399 warp
  becomes sluggish.
- If zippering is heard on `delayFeedback`, smooth only `delayFeedback` lightly
  or update derived params at control rate. Do not smooth `currentDelaySamples`
  outside the class.

Threading:

- No allocation in `processBlock`.
- Keep parameter reads lock-free.
- Call `setParams` from the audio thread using atomically read parameter values.
- Avoid calling `reset()` from the UI thread directly; request it and execute it
  on the audio thread.

## Validation Checklist

Use these tests to confirm the port matches ddxx7:

1. With `delayFeedback = 0`, audio passes dry and no tail remains.
2. With an impulse input, increasing `delayTime` moves the first repeat later.
3. While audio is sounding, moving `delayTime` creates pitch-warp/glide.
4. Longer delay times sound darker and less clean than short delay times.
5. High feedback approaches runaway behavior but stays finite: no NaN/Infinity.
6. Changing a synth patch does not reset delay parameters or delay tail.
7. Reopening the plugin restores host parameter state, but a new instance starts
   at `delayTime = 45`, `delayFeedback = 0`.

## Known Sound Intent

The effect is not a clean tempo delay. It should behave like a small analog-ish
PT2399 feedback circuit:

- mono delay memory,
- stereo dry passthrough,
- wet return centered,
- darker repeats as time increases,
- mild clock/noise artifacts,
- quantized/lo-fi long delay behavior,
- saturated feedback path,
- audible pitch movement when delay time changes.
