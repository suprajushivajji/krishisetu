/**
 * Test Gnani STT with detailed error logging
 * Run with: npx tsx tests/test-gnani-stt.ts
 */

import { connectDB } from "../src/server/db";
import { GnaniService } from "../src/server/services/gnani";

async function testGnaniSTT() {
  console.log("🎤 Testing Gnani STT with detailed logging...\n");

  await connectDB();

  // Create a simple test audio buffer (1 second of silence in WAV format)
  const sampleRate = 16000;
  const duration = 1; // 1 second
  const numSamples = sampleRate * duration;
  const pcmData = Buffer.alloc(numSamples * 2); // 16-bit samples, 2 bytes each
  
  // Wrap in WAV
  const wavBuffer = Buffer.alloc(44 + pcmData.length);
  wavBuffer.write("RIFF", 0);
  wavBuffer.writeUInt32LE(36 + pcmData.length, 4);
  wavBuffer.write("WAVE", 8);
  wavBuffer.write("fmt ", 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20); // Mono
  wavBuffer.writeUInt16LE(1, 22); // Channels
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  wavBuffer.writeUInt16LE(2, 32); // Block align
  wavBuffer.writeUInt16LE(16, 34); // Bits per sample
  wavBuffer.write("data", 36);
  wavBuffer.writeUInt32LE(pcmData.length, 40);
  pcmData.copy(wavBuffer, 44);

  console.log("📝 Test audio created:");
  console.log(`   Size: ${wavBuffer.length} bytes`);
  console.log(`   Duration: ${duration}s`);
  console.log(`   Sample rate: ${sampleRate}Hz`);
  console.log(`   Format: WAV (16-bit mono PCM)`);

  try {
    console.log("\n🔄 Calling Gnani STT API...");
    const result = await GnaniService.transcribe({
      audioBuffer: wavBuffer,
      languageCode: "kn-IN",
    });

    console.log("✅ Success!");
    console.log(`   Transcript: "${result.transcript}"`);
    console.log(`   Detected Language: ${result.detectedLanguage}`);
    console.log(`   Provider: ${result.provider}`);
  } catch (error: any) {
    console.error("❌ STT Test Failed:");
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    }
  }

  process.exit(0);
}

testGnaniSTT().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
