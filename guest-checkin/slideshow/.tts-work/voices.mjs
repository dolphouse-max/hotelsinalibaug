import { EdgeTTS } from "@andresaya/edge-tts";
const tts = new EdgeTTS();
const voices = await tts.getVoices();
console.log(voices.filter((voice) => voice.Locale === "mr-IN").map((voice) => `${voice.ShortName || voice.Name} | ${voice.Gender || ""}`).join("\n"));
