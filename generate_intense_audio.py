import wave
import struct
import math
import os

def generate_intense_audio(filename="frontend/src/assets/audio/intense_bgm.wav"):
    SAMPLE_RATE = 44100
    DURATION = 4.0 # 4 seconds loop
    num_samples = int(SAMPLE_RATE * DURATION)
    
    # Ensure dir exists
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        
        for i in range(num_samples):
            t = float(i) / SAMPLE_RATE
            
            # Base low frequency drone (around 45 Hz)
            base_freq = 45.0
            
            # Pulse LFO (Heartbeat effect) - peaks twice quickly, then pauses
            # We'll use a mathematical envelope to simulate a heartbeat
            beat_phase = (t * 1.5) % 1.0 # 1.5 beats per second (90 bpm)
            
            pulse = 0.0
            if beat_phase < 0.15:
                pulse = math.sin(beat_phase / 0.15 * math.pi)
            elif beat_phase > 0.25 and beat_phase < 0.4:
                pulse = math.sin((beat_phase - 0.25) / 0.15 * math.pi) * 0.8
                
            # Add some rumble noise
            rumble = (math.sin(t * 150) * 0.2 + math.sin(t * 230) * 0.1) * pulse
            
            # Combine wave
            val = math.sin(2.0 * math.pi * base_freq * t)
            
            # Distort slightly for that "scary" feel
            if val > 0: val = val ** 0.8
            else: val = -((-val) ** 0.8)
            
            # Apply volume envelope
            volume = 0.3 + (pulse * 0.7) # Base 0.3, pulses to 1.0
            sample_val = val * volume + rumble
            
            # Cap and convert to 16-bit
            sample_val = max(-1.0, min(1.0, sample_val))
            packed_value = struct.pack('h', int(sample_val * 32767.0))
            wav_file.writeframes(packed_value)
            
    print(f"Generated {filename}")

if __name__ == "__main__":
    generate_intense_audio()
