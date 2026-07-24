import { mkdir, stat, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EdgeTTS, Constants } from "./.tts-work/node_modules/@andresaya/edge-tts/dist/index.js";

const root = dirname(fileURLToPath(import.meta.url));
const outputDirectory = process.argv[2] || "narration";
const voice = process.argv[3] || "mr-IN-AarohiNeural";
const audioDir = join(root, outputDirectory);

// These are connected spoken transitions, not a literal reading of each slide.
const narration = [
  "हॉटेल चालवणे म्हणजे फक्त रूम बुक करणे नाही. पाहुण्यांचा अनुभव, टीमचा समन्वय आणि रोजचे व्यवस्थापन—सगळे सहज व्हावे, यासाठी आहे चेकइन.",
  "एका सोप्या प्लॅटफॉर्ममध्ये, चेक-इनपासून बुकिंग आणि सूचना व्यवस्थापनापर्यंतची महत्त्वाची कामे एकत्र येतात. आता पाहूया, ते प्रत्यक्षात कसे काम करते.",
  "सुरुवात होते QR self check-in ने. पाहुणे स्वतःच्या मोबाईलवर माहिती भरतात, आणि तुमच्या रिसेप्शनचा वेळ खऱ्या आदरातिथ्यासाठी मोकळा राहतो.",
  "पुढे, reservation calendar तुम्हाला सर्व बुकिंग्स एका नजरेत दाखवतो. नियोजन स्पष्ट होते, आणि प्रत्येक रूमची उपलब्धता नियंत्रणात राहते.",
  "तरीही एखादी अनपेक्षित overbooking झाली, तर एका क्लिकमध्ये इतर सहभागी हॉटेलना अलर्ट पाठवा. पाहुण्याला योग्य पर्याय मिळतो, आणि विश्वास टिकून राहतो.",
  "प्रत्येक हॉटेलला स्वतःचे सुंदर, mobile-friendly web pageही मिळते. तुमची ओळख, सुविधा आणि संपर्क माहिती पाहुण्यांपर्यंत थेट पोहोचते.",
  "चेकइनमध्ये dashboard, guest आणि staff management, police register, alerts आणि सुरक्षित backup—दैनंदिन कामासाठी आवश्यक सर्व गोष्टी एका ठिकाणी आहेत.",
  "म्हणून तुम्ही व्यवस्थापनाच्या गुंतागुंतीत अडकत नाही. तुम्ही पाहुण्यांची काळजी घ्या; व्यवस्थापनाची काळजी चेकइन घेईल.",
  "हा अनुभव गरजेतून तयार झाला आहे. तीन दशकांच्या operational discipline आणि विश्वासार्ह प्रक्रियांच्या अनुभवातून, हॉटेल व्यवसायासाठी चेकइन घडवला आहे.",
  "आणि सुरुवात करणे अगदी सोपे आहे. एकतीस ऑक्टोबर दोन हजार सव्वीसपर्यंत चेकइन पूर्णपणे मोफत वापरून पहा—कोणतेही बंधन नाही.",
  "त्यानंतरचे शुल्कही सरळ आणि परवडणारे आहे: फक्त दहा रुपये प्रति रूम प्रति महिना, किंवा शंभर रुपये प्रति रूम प्रति वर्ष.",
  "आजच चेकइनसोबत सुरुवात करा. अधिक माहितीसाठी WhatsApp किंवा फोनवर संपर्क करा, आणि तुमच्या हॉटेलसाठी स्मार्ट व्यवस्थापनाचा पुढचा टप्पा सुरू करा."
];

await mkdir(audioDir, { recursive: true });
const clips = [];
for (const [index, text] of narration.entries()) {
  const tts = new EdgeTTS();
  await tts.synthesize(text, voice, {
    rate: "-7%",
    volume: "92%",
    pitch: voice === "mr-IN-ManoharNeural" ? "-22Hz" : "+0Hz",
    outputFormat: Constants.OUTPUT_FORMAT.AUDIO_48KHZ_96KBITRATE_MONO_MP3,
  });
  const filename = join(audioDir, `slide-${String(index + 1).padStart(2, "0")}`);
  const savedPath = await tts.toFile(filename);
  // MP3 output is CBR 96 kbps; the package's duration estimate is not reliable for Marathi voices.
  const bytes = (await stat(savedPath)).size;
  clips.push({ slide: index + 1, file: savedPath, seconds: Number((bytes * 8 / 96000).toFixed(2)), text });
}
await writeFile(join(audioDir, "timings.json"), JSON.stringify(clips, null, 2), "utf8");
console.log(JSON.stringify(clips.map(({ slide, seconds }) => ({ slide, seconds }))));
