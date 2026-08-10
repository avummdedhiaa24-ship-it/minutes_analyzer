import { useState, useEffect } from "react";

export type LanguageCode = "en" | "hi" | "mr" | "te";

export const UI_TRANSLATIONS: Record<string, Record<LanguageCode, string>> = {
  // Navigation & Header
  "Digital India": { en: "Corporate Enterprise", hi: "कॉरपोरेट एंटरप्राइज", mr: "कॉर्पोरेट एंटरप्राइझ", te: "కార్పొరేట్ ఎంటర్‌ప్రైజ్" },
  "e-Panchayat Initiative": { en: "AI Meeting Minutes Platform", hi: "AI बैठक कार्यवृत्त मंच", mr: "AI बैठकीचे इतिवृत्त व्यासपीठ", te: "AI సమావేశ నిమిషాల ప్లాట్‌ఫారమ్" },
  "Gram Sabha AI Minutes": { en: "AI Meeting Minutes Platform", hi: "AI बैठक कार्यवृत्त मंच", mr: "AI बैठकीचे इतिवृत्त व्यासपीठ", te: "AI సమావేశ నిమిషాల ప్లాట్‌ఫారమ్" },
  "AI General Meeting Minutes & Transcripts": { en: "AI General Meeting Minutes & Transcripts", hi: "AI सामान्य बैठक कार्यवृत्त और प्रतिलेख", mr: "AI सर्वसाधारण बैठकीचे इतिवृत्त आणि उतारे", te: "AI జనరల్ సమావేశ నిమిషాలు & ట్రాన్స్‌క్రిప్ట్‌లు" },
  "Transcript & Meeting Minutes Studio": { en: "Transcript & Meeting Minutes Studio", hi: "प्रतिलेख और बैठक कार्यवृत्त स्टूडियो", mr: "उतारा आणि बैठक इतिवृत्त स्टुडिओ", te: "ట్రాన్స్‌క్రిప్ట్ & సమావేశ నిమిషాల స్టూడియో" },
  "Re-generate Minutes from Transcript": { en: "Re-generate Minutes from Transcript", hi: "प्रतिलेख से कार्यवृत्त पुनः उत्पन्न करें", mr: "उताऱ्यावरून इतिवृत्त पुन्हा तयार करा", te: "ట్రాన్స్‌క్రిప్ట్ నుండి నిమిషాలను మళ్లీ రూపొందించండి" },
  "Save Transcript Changes": { en: "Save Transcript Changes", hi: "प्रतिलेख परिवर्तन सहेजें", mr: "उतारा बदल जतन करा", te: "ట్రాన్స్‌క్రిప్ట్ మార్పులను సేవ్ చేయండి" },
  "Action Items": { en: "Action Items", hi: "कार्य सूची", mr: "कृती बाबी", te: "చర్యల జాబితా" },
  "Decisions & Resolutions": { en: "Decisions & Resolutions", hi: "निर्णय और संकल्प", mr: "निर्णय आणि ठराव", te: "నిర్ణయాలు & తీర్మానాలు" },
  "Log Out": { en: "Log Out", hi: "लॉग आउट", mr: "लॉग आउट", te: "లాగ్ అవుట్" },
  "Switch User": { en: "Switch User", hi: "उपयोगकर्ता बदलें", mr: "वापरकर्ता बदला", te: "వినియోగదారుని మార్చండి" },
  "Modules": { en: "Modules", hi: "मॉड्यूल", mr: "मॉड्यूल", te: "మాడ్యూల్స్" },
  "Dashboard": { en: "Dashboard", hi: "डैशबोर्ड", mr: "डॅशबोर्ड", te: "డాష్‌బోర్డ్" },
  "Meetings & Check-in": { en: "Meetings & Check-in", hi: "बैठक और चेक-इन", mr: "बैठकी आणि चेक-इन", te: "సమావేశాలు & చెక్-ఇన్" },
  "Record / ASR Uploader": { en: "Record / ASR Uploader", hi: "रिकॉर्ड / एएसआर अपलोडर", mr: "रेकॉर्ड / एएसआर अपलोडर", te: "రికార్డ్ / ASR అప్‌లోడర్" },
  "Review & Sign": { en: "Review & Sign", hi: "समीक्षा और हस्ताक्षर", mr: "आढावा आणि स्वाक्षरी", te: "సమీక్ష & సంతకం" },
  "RAG Assistant": { en: "RAG Assistant", hi: "आरएजी सहायक", mr: "आरएजी सहाय्यक", te: "RAG సహాయకుడు" },
  "Citizen Portal": { en: "Participant Directory", hi: "भागीदार निर्देशिका", mr: "सहभागी निर्देशिका", te: "భాగస్వామ్య డైరెక్టరీ" },
  "Audit Ledger": { en: "Audit Ledger", hi: "ऑडिट बही", mr: "ऑडिट लेजर", te: "ఆడిట్ రిజిస్టర్" },

  // Dashboard Cards
  "Namaste! Gram Panchayat Digital Dashboard": {
    en: "AI Meeting Intelligence Dashboard",
    hi: "AI बैठक इंटेलिजेंस डैशबोर्ड",
    mr: "AI बैठक बुद्धिमत्ता डॅशबोर्ड",
    te: "AI సమావేశ ఇంటెలిజెన్స్ డాష్‌బోర్డ్"
  },
  "Real-time indicators, digital meeting ledger tracking, and Indic Whisper translation portal.": {
    en: "Real-time meeting analytics, speaker-diarized transcripts, and multilingual translation portal.",
    hi: "वास्तविक समय बैठक विश्लेषण, वक्ता-आधारित प्रतिलेख और बहुभाषी अनुवाद पोर्टल।",
    mr: "थेट बैठक विश्लेषण, वक्त्यानुसार उतारे आणि बहुभाषिक भाषांतर पोर्टल.",
    te: "రియల్ టైమ్ సమావేశ విశ్లేషణలు, మాట్లాడేవారి ఆధారిత ట్రాన్స్‌క్రిప్ట్‌లు మరియు బహుభాషా అనువాద పోర్టల్."
  },
  "Record Live Sabha": {
    en: "Record Live Meeting",
    hi: "लाइव बैठक रिकॉर्ड करें",
    mr: "थेट बैठक रेकॉर्ड करा",
    te: "లైవ్ సమావేశాన్ని రికార్డ్ చేయండి"
  },
  "Retrieving official e-Panchayat indicators...": {
    en: "Retrieving official meeting indicators...",
    hi: "आधिकारिक बैठक संकेतक प्राप्त किए जा रहे हैं...",
    mr: "अधिकृत बैठक निर्देशक मिळवत आहे...",
    te: "అధికారిక సమావేశ సూచికలను పొందుతోంది..."
  },
  "Meetings Conducted": { en: "Meetings Conducted", hi: "आयोजित बैठकें", mr: "आयोजित बैठका", te: "నిర్వహించిన సమావేశాలు" },
  "Women Participation": { en: "Participant Engagement", hi: "भागीदारी दर", mr: "सहभाग प्रमाण", te: "భాగస్వామ్య నిష్పత్తి" },
  "Action Items Done": { en: "Action Items Done", hi: "पूर्ण किए गए कार्य", mr: "पूर्ण केलेल्या कृती बाबी", te: "పూర్తయిన చర్యలు" },
  "Funds Sanctioned": { en: "Budget & Funds Sanctioned", hi: "स्वीकृत बजट व निधि", mr: "मंजूर अर्थसंकल्प व निधी", te: "మంజూరైన నిధులు" },
  "All scheduled/historic": { en: "All scheduled/historic", hi: "सभी अनुसूचित/ऐतिहासिक", mr: "सर्व नियोजित/ऐतिहासिक", te: "అన్ని షెడ్యూల్డ్/చారిత్రక" },
  "Women empowerment ratio": { en: "Participant engagement ratio", hi: "भागीदारी अनुपात", mr: "सहभाग प्रमाण", te: "భాగస్వామ్య నిష్పత్తి" },
  "signed minutes logs": { en: "signed minutes logs", hi: "हस्ताक्षरित बैठक विवरण लॉग", mr: "स्वाक्षरी केलेले इतिवृत्त लॉग", te: "సంతకం చేసిన సమావేశ లాగ్‌లు" },
  "100% auditable via ledger": { en: "100% auditable via ledger", hi: "बही द्वारा शत-प्रतिशत ऑडिट योग्य", mr: "वहीद्वारे १००% तपासणीयोग्य", te: "లెడ్జర్ ద్వారా 100% ఆడిట్ చేయదగినది" },
  "MEETING TITLE": { en: "MEETING TITLE", hi: "बैठक का शीर्षक", mr: "बैठकीचे शीर्षक", te: "సమావేశ శీర్షిక" },
  "CONDUCTED ON": { en: "CONDUCTED ON", hi: "आयोजन की तिथि", mr: "आयोजित तारीख", te: "నిర్వహించిన తేదీ" },
  "STATUS": { en: "STATUS", hi: "स्थिति", mr: "स्थिती", te: "స్థితి" },
  "LOCATION": { en: "LOCATION", hi: "स्थान", mr: "ठिकाण", te: "స్థలం" },
  "MEETINGS CONDUCTED": { en: "MEETINGS CONDUCTED", hi: "आयोजित बैठकें", mr: "आयोजित बैठका", te: "निर्वहించిన సమావేశాలు" },
  "WOMEN PARTICIPATION": { en: "PARTICIPANT ENGAGEMENT", hi: "भागीदारी दर", mr: "सहभाग प्रमाण", te: "భాగస్వామ్య నిష్పత్తి" },
  "ACTION ITEMS DONE": { en: "ACTION ITEMS DONE", hi: "पूर्ण किए गए कार्य", mr: "पूर्ण केलेल्या कृती बाबी", te: "పూర్తయిన చర్యలు" },
  "FUNDS SANCTIONED": { en: "FUNDS SANCTIONED", hi: "स्वीकृत निधि", mr: "मंजूर निधी", te: "మంజూరైన నిధులు" },
  "Budgetary Allocations (INR)": { en: "Budgetary Allocations", hi: "बजटीय आवंटन", mr: "अर्थसंकल्पीय वाटप", te: "బడ్జెట్ కేటాయింపులు" },
  "Marginalized & Social Category Split": { en: "Participant Category & Role Breakdown", hi: "भागीदार श्रेणी व भूमिका विभाजन", mr: "सहभागी वर्ग व भूमिका विभाजन", te: "భాగస్వామ్య వర్గం & పాత్ర విభజన" },
  "Speaking Time Distribution": { en: "Speaking Time Distribution", hi: "बोलने के समय का वितरण", mr: "बोलण्याच्या वेळेचे वाटप", te: "మాట్లాడే సమయం పంపిణీ" },
  "Recent Gram Sabha Logs": { en: "Recent Meeting Minutes Logs", hi: "हालिया बैठक विवरण लॉग", mr: "अलीकडील बैठक इतिवृत्त लॉग", te: "ఇటీవలి సమావేశ నిమిషాల లాగ్‌లు" },
  "View All Logs": { en: "View All Logs", hi: "सभी लॉग देखें", mr: "सर्व लॉग पहा", te: "అన్ని లాగ్‌లను వీక్షించండి" },
  "Panchayat Secretary Quick Login": { en: "Meeting Host / Moderator Login", hi: "बैठक मेजबान / मॉडरेटर लॉगिन", mr: "बैठक आयोजक लॉगिन", te: "సమావేశ హోస్ట్ లాగిన్" },

  // Meetings page
  "Meetings & Check-in QR Codes": { en: "Meetings & Check-in QR Codes", hi: "बैठक और चेक-इन क्यूआर कोड", mr: "बैठकी आणि चेक-इन क्यूआर कोड", te: "సమావేశాలు & చెక్-ఇన్ QR కోడ్‌లు" },
  "Schedule Sabha assemblies, print Check-in passes, and trace attendance registers.": {
    en: "Schedule meetings, print Check-in passes, and trace participant attendance registers.",
    hi: "बैठकों को शेड्यूल करें, चेक-इन पास प्रिंट करें और उपस्थिति पंजिकाओं को ट्रैक करें।",
    mr: "बैठकांचे वेळापत्रक तयार करा, चेक-इन पास मुद्रित करा आणि उपस्थिती नोंदणीचा मागोवा घ्या.",
    te: "సమావేశాలను షెడ్యూల్ చేయండి, చెక్-ఇన్ పాస్‌లను ప్రింట్ చేయండి మరియు హాజరు రిజిస్టర్‌లను ట్రాక్ చేయండి."
  },
  "Schedule New Gram Sabha": { en: "Schedule New Meeting", hi: "नई बैठक शेड्यूल करें", mr: "नवीन बैठक आयोजित करा", te: "కొత్త సమావేశాన్ని షెడ్యూల్ చేయండి" },
  "Sabha Title": { en: "Meeting Title", hi: "बैठक का शीर्षक", mr: "बैठकीचे शीर्षक", te: "సమావేశ శీర్షిక" },
  "Proposed Date & Time": { en: "Proposed Date & Time", hi: "प्रस्तावित तिथि और समय", mr: "प्रस्तावित तारीख आणि वेळ", te: "ప్రతిపాదిత తేదీ & సమయం" },
  "Assembly Location": { en: "Meeting Location", hi: "बैठक का स्थान", mr: "बैठकीचे ठिकाण", te: "సమావేశ స్థలం" },
  "Detailed Agenda": { en: "Detailed Agenda", hi: "विस्तृत एजेंडा", mr: "सविस्तर अजेंडा", te: "వివరణాత్మక ఎజెండా" },
  "Schedule Gram Sabha": { en: "Schedule Meeting", hi: "बैठक शेड्यूल करें", mr: "बैठक आयोजित करा", te: "సమావేశాన్ని షెడ్యూల్ చేయండి" },
  "QR Check-in Pass": { en: "QR Check-in Pass", hi: "क्यूआर चेक-इन पास", mr: "क्यूआर चेक-इन पास", te: "QR చెక్-ఇన్ పాస్" },
  "Official Sabha Schedules & Agenda Registry": { en: "Official Meeting Schedules & Agenda Registry", hi: "आधिकारिक बैठक अनुसूची और एजेंडा रजिस्ट्री", mr: "अधिकृत बैठक वेळापत्रक आणि अजेंडा नोंदणी", te: "అధికారిక సమావేశ షెడ్యూల్‌లు & ఎజెండా రిజిస్టర్" },

  // Record / ASR
  "Indic Speech-to-Text Pipeline (ASR)": { en: "AI Speech-to-Text Pipeline (ASR)", hi: "AI भाषण-से-पाठ पाइपलाइन (ASR)", mr: "AI भाषण-ते-मजकूर पाइपलाइन (ASR)", te: "AI స్పీచ్-టు-టెక్స్ట్ పైప్‌లైన్ (ASR)" },
  "Capture live Gram Sabha audio with noise filter buffers, or upload pre-recorded meetings.": {
    en: "Capture live meeting audio with noise filter buffers, or upload pre-recorded meetings.",
    hi: "शोर फिल्टर बफर के साथ लाइव बैठक ऑडियो कैप्चर करें, या पूर्व-रिकॉर्ड की गई बैठकें अपलोड करें।",
    mr: "आवाज फिल्टर बफरसह थेट बैठक ऑडिओ कॅप्चर करा किंवा आधी रेकॉर्ड केलेल्या बैठका अपलोड करा.",
    te: "నాయిస్ ఫిల్టర్ బఫర్‌లతో ప్రత్యక్ష సమావేశ ఆడియోను క్యాప్చర్ చేయండి లేదా ముందే రికార్డ్ చేసిన సమావేశాలను అప్‌లోడ్ చేయండి."
  },
  "Assembly Live Mic Streamer": { en: "Assembly Live Mic Streamer", hi: "सभा लाइव माइक स्ट्रीमर", mr: "थेट माईक प्रवाहक", te: "సభ లైవ్ మైక్ స్ట్రీమర్" },
  "Directly records and streams audio segments to the ASR indic pipeline.": {
    en: "Directly records and streams audio segments to the ASR indic pipeline.",
    hi: "ऑडियो सेगमेंट को सीधे रिकॉर्ड करता है और एएसआर पाइपलाइन में स्ट्रीम करता है।",
    mr: "थेट ऑडिओ रेकॉर्ड करतो आणि एएसआर पाइपलाइनवर प्रवाहित करतो.",
    te: "ఆడియో భాగాలను నేరుగా రికార్డ్ చేస్తుంది మరియు ASR పైప్‌లైన్‌కు ప్రసారం చేస్తుంది."
  },
  "Start Live Recording": { en: "Start Live Recording", hi: "लाइव रिकॉर्डिंग शुरू करें", mr: "लाइव रेकॉर्डिंग सुरू करा", te: "లైవ్ రికార్డింగ్ ప్రారంభించండి" },
  "Stop & Process Audio": { en: "Stop & Process Audio", hi: "ऑडियो रोकें और संसाधित करें", mr: "रेकॉर्डिंग थांबवा आणि ऑडिओ प्रक्रिया करा", te: "ఆపండి & ఆడియోను ప్రాసెస్ చేయండి" },
  "Upload Pre-recorded Audio or Video": { en: "Upload Pre-recorded Audio or Video", hi: "पूर्व-रिकॉर्ड किया गया ऑडियो या वीडियो अपलोड करें", mr: "आधी रेकॉर्ड केलेला ऑडिओ किंवा व्हिडिओ अपलोड करा", te: "ముందే రికార్డ్ చేసిన ఆడియో లేదా వీడియోను అప్‌లోడ్ చేయండి" },
  "Drag and drop file here, or click to browse": { en: "Drag and drop file here, or click to browse", hi: "फ़ाइल को यहाँ खींचें और छोड़ें, या ब्राउज़ करने के लिए क्लिक करें", mr: "येथे फाईल ड्रॅग आणि ड्रॉप करा किंवा ब्राउझ करण्यासाठी क्लिक करा", te: "ఫైల్‌ను ఇక్కడ లాగి వదలండి లేదా బ్రౌజ్ చేయడానికి క్లిక్ చేయండి" },
  "Select Audio File": { en: "Select Audio File", hi: "ऑडियो फ़ाइल चुनें", mr: "ऑडिओ फाईल निवडा", te: "ఆడియో ఫైల్‌ను ఎంచుకోండి" },

  // Review & Sign
  "Review & Sign Resolutions": { en: "Review & Sign Resolutions", hi: "संकल्पों की समीक्षा और हस्ताक्षर", mr: "ठरावांचा आढावा आणि स्वाक्षरी", te: "तीर्మానాల సమీక్ష & సంతకం" },
  "Audit draft resolutions, edit budget items, and seal with SHA256 cryptographic logs.": {
    en: "Audit draft resolutions, edit budget items, and seal with SHA256 cryptographic logs.",
    hi: "मसौदा प्रस्तावों का ऑडिट करें, बजट मदों को संपादित करें, और SHA256 क्रिप्टोग्राफिक लॉग के साथ सील करें।",
    mr: "मसुदा ठरावांचे परीक्षण करा, अर्थसंकल्प सुधारित करा आणि SHA256 क्रिप्टोग्राफिक लॉगने सील करा.",
    te: "డ్రాఫ్ట్ తీర్మానాలను ఆడిట్ చేయండి, బడ్జెట్ అంశాలను సవరించండి మరియు SHA256 క్రిప్టోగ్రాఫిక్ లాగ్‌లతో సీల్ చేయండి."
  },
  "ASR Transcript Logs": { en: "ASR Transcript Logs", hi: "एएसआर प्रतिलेख लॉग", mr: "एएसआर उतारे लॉग", te: "ASR ట్రాన్స్క్రిప్ట్ లాగ్‌లు" },
  "Citizen Attendance": { en: "Citizen Attendance", hi: "नागरिक उपस्थिति", mr: "नागरिक उपस्थिती", te: "సిటిజన్ హాజరు" },
  "Official Resolution Form": { en: "Official Resolution Form", hi: "आधिकारिक संकल्प पत्र", mr: "अधिकृत ठराव फॉर्म", te: "అధికారిక తీర్మాన ఫారమ్" },
  "EXECUTIVE SUMMARY": { en: "EXECUTIVE SUMMARY", hi: "कार्यकारी सारांश", mr: "कार्यकारी सारांश", te: "కార్యనిర్వాహక సారాంశం" },
  "TOPICS DISCUSSED (JSON ARRAY)": { en: "TOPICS DISCUSSED (JSON ARRAY)", hi: "चर्चा किए गए विषय (JSON ARRAY)", mr: "चर्चा केलेले विषय (JSON ARRAY)", te: "చర్చించిన అంశాలు (JSON ARRAY)" },
  "SUPPORTING SCHEMES (JSON ARRAY)": { en: "SUPPORTING SCHEMES (JSON ARRAY)", hi: "सहायक योजनाएं (JSON ARRAY)", mr: "सहाय्यक योजना (JSON ARRAY)", te: "మద్దతు ఇచ్చే పథకాలు (JSON ARRAY)" },
  "BUDGET BREAKDOWN (JSON KEY-VALUE)": { en: "BUDGET BREAKDOWN (JSON KEY-VALUE)", hi: "बजट विवरण (JSON KEY-VALUE)", mr: "अर्थसंकल्पीय तपशील (JSON KEY-VALUE)", te: "బడ్జెట్ విశ్లేషణ (JSON KEY-VALUE)" },
  "Save Draft Changes": { en: "Save Draft Changes", hi: "ड्राफ्ट में बदलाव सहेजें", mr: "मसुदा बदल जतन करा", te: "డ్రాफ्ट మార్పులను సేవ్ చేయండి" },
  "Approve & Sign Ledger": { en: "Approve & Sign Ledger", hi: "लेज़र स्वीकृत और हस्ताक्षरित करें", mr: "लेजर मंजूर आणि स्वाक्षरी करा", te: "రిజిస్టర్‌ను ఆమోదించండి & సంతకం చేయండి" },

  // Chat
  "e-Panchayat RAG assistant": { en: "Corporate RAG Assistant", hi: "कॉरपोरेट आरएजी सहायक", mr: "कॉर्पोरेट आरएजी सहाय्यक", te: "కార్పొరేట్ RAG సహాయకుడు" },
  "Greetings! I am the e-Panchayat RAG assistant. Ask me anything about local Gram Sabha resolutions, budgetary allocations, or scheme updates.": {
    en: "Greetings! I am the Corporate RAG assistant. Ask me anything about corporate meeting resolutions, budgetary allocations, or action items.",
    hi: "नमस्कार! मैं कॉरपोरेट आरएजी सहायक हूं। मुझसे कॉर्पोरेट बैठक प्रस्तावों, बजटीय आवंटन या कार्रवाई मदों के बारे में कुछ भी पूछें।",
    mr: "नमस्कार! मी कॉर्पोरेट आरएजी सहाय्यक आहे. मला कॉर्पोरेट बैठक ठराव, अर्थसंकल्पीय वाटप किंवा कृती बाबींबद्दल काहीही विचारा.",
    te: "నమస్కారం! నేను కార్పొరేట్ RAG సహాయకుడిని. కార్పొరేట్ సమావేశ తీర్మానాలు, బడ్జెట్ కేటాయింపులు లేదా చర్యల అంశాల గురించి నన్ను ఏదైనా అడగండి."
  },
  "Ask the AI Assistant...": { en: "Ask the AI Assistant...", hi: "एआई सहायक से पूछें...", mr: "एआय सहाय्यकाला विचारा...", te: "AI సహాయకుడిని అడగండి..." },

  // Audit
  "Panchayat Cryptographic Ledger Audit": { en: "Panchayat Cryptographic Ledger Audit", hi: "पंचायत क्रिप्टोग्राफिक लेजर ऑडिट", mr: "पंचायत क्रिप्टोग्राफिक लेजर ऑडिट", te: "పంచాయతీ క్రిప్టోగ్రాఫిక్ లెడ్జర్ ఆడిట్" },
  "Verify immutable transactions logs, previous states, and SHA256 digital seals.": {
    en: "Verify immutable transactions logs, previous states, and SHA256 digital seals.",
    hi: "अपरिवर्तनीय लेनदेन लॉग, पिछली स्थिति और SHA256 डिजिटल सील को सत्यापित करें।",
    mr: "अपरिवर्तनीय व्यवहार लॉग, मागील स्थिती आणि SHA256 डिजिटल सील सत्यापित करा.",
    te: "మార్చలేని లావాదేవీల లాగ్‌లు, మునుపటి స్థితులు మరియు SHA256 డిజిటల్ సీల్‌లను ధృవీకరించండి."
  },
  "Audit Trail Activity Log": { en: "Audit Trail Activity Log", hi: "ऑडिट ट्रेल गतिविधि लॉग", mr: "ऑडिट ट्रेल क्रियाकलाप लॉग", te: "ఆడిట్ ట్రైల్ కార్యాచరణ లాగ్" },

  // Statuses
  "approved": { en: "Approved", hi: "स्वीकृत", mr: "मंजूर", te: "ఆమోదించబడింది" },
  "draft": { en: "Draft", hi: "मसौदा", mr: "मसुदा", te: "డ్రాఫ్ట్" },
  "processing": { en: "Processing", hi: "संसाधित हो रहा है", mr: "प्रक्रिया सुरू आहे", te: "ప్రాసెస్ అవుతోంది" },
  "scheduled": { en: "Scheduled", hi: "निर्धारित", mr: "नियोजित", te: "షెడ్యూల్ చేయబడింది" },

  // Chat/RAG additions
  "Consulting vector indexing databases...": {
    en: "Consulting vector indexing databases...",
    hi: "वेक्टर इंडेक्सिंग डेटाबेस से परामर्श किया जा रहा है...",
    mr: "वेक्टर इंडेक्सिंग डेटाबेसचा सल्ला घेत आहे...",
    te: "వెక్టర్ ఇండెక్సింగ్ డేటాబేస్‌లను సంప్రదిస్తోంది..."
  },
  "Ask a question about Rampur budget updates, drinking water projects, or scheduled meetings...": {
    en: "Ask a question about Rampur budget updates, drinking water projects, or scheduled meetings...",
    hi: "रामपुर बजट अपडेट, पेयजल परियोजनाओं, या निर्धारित बैठकों के बारे में एक प्रश्न पूछें...",
    mr: "रामपूर बजेट अद्यतने, पिण्याच्या पाण्याच्या योजना किंवा नियोजित बैठकांबद्दल प्रश्न विचारा...",
    te: "రాంపూర్ బడ్జెట్ అప్‌డేట్‌లు, త్రాగునీటి ప్రాజెక్టులు లేదా షెడ్యూల్ చేసిన సమావేశాల గురించి ఒక ప్రశ్న అడగండి..."
  },
  "Send Query": {
    en: "Send Query",
    hi: "प्रश्न भेजें",
    mr: "प्रश्न पाठवा",
    te: "ప్రశ్న పంపండి"
  },
  "Contextual semantic search over archived Gram Sabha transcripts.": {
    en: "Contextual semantic search over archived corporate meeting transcripts.",
    hi: "संग्रहीत कॉर्पोरेट बैठक प्रतिलेखों पर प्रासंगिक शब्दार्थ खोज।",
    mr: "संग्रहित कॉर्पोरेट बैठक उताऱ्यांवर संदर्भानुसार अर्थपूर्ण शोध.",
    te: "ఆర్కైవ్ చేసిన కార్పొరేట్ సమావేశ ట్రాన్స్క్రిప్ట్‌లపై సందర్భోచిత సెమాంటిక్ శోధన."
  },
  "Official Citations & Sources": {
    en: "Official Citations & Sources",
    hi: "आधिकारिक उद्धरण और स्रोत",
    mr: "अधिकृत संदर्भ आणि स्रोत",
    te: "అధికారిక ఆధారాలు & వనరులు"
  },
  "Filter Meeting:": {
    en: "Filter Meeting:",
    hi: "बैठक फ़िल्टर करें:",
    mr: "बैठक फिल्टर करा:",
    te: "సమావేశాన్ని ఫిల్టర్ చేయండి:"
  },
  "All Sabha Archives": {
    en: "All Meeting Archives",
    hi: "सभी बैठक संग्रह",
    mr: "सर्व बैठक संग्रह",
    te: "అన్ని సమావేశ ఆర్కైవ్‌లు"
  },
  "Target Sabha Ledger:": {
    en: "Target Meeting Ledger:",
    hi: "लक्षित बैठक बही:",
    mr: "लक्षित बैठक नोंदवही:",
    te: "లక్ష్య సమావేశ రిజిస్టర్:"
  },
  "No meetings found": {
    en: "No meetings found",
    hi: "कोई बैठक नहीं मिली",
    mr: "कोणतीही बैठक आढळली नाही",
    te: "సమావేశాలు కనుగొనబడలేదు"
  },
  "Verification Ledger Chronology": {
    en: "Verification Ledger Chronology",
    hi: "सत्यापन बही कालक्रम",
    mr: "पडताळणी नोंदवही कालानुक्रम",
    te: "ధృవీకరణ రిజిస్టర్ క్రమం"
  },
  "Previous state summary": {
    en: "Previous state summary",
    hi: "पिछली स्थिति का सारांश",
    mr: "मागील स्थितीचा सारांश",
    te: "మునుపటి స్థితి సారాంశం"
  },
  "Current state summary": {
    en: "Current state summary",
    hi: "वर्तमान स्थिति का सारांश",
    mr: "सध्याच्या स्थितीचा सारांश",
    te: "ప్రస్తుत స్థితి సారాంశం"
  }
};

export function useTranslation() {
  const [lang, setLangState] = useState<LanguageCode>("en");

  useEffect(() => {
    const saved = localStorage.getItem("ui_lang") as LanguageCode;
    if (saved && ["en", "hi", "mr", "te"].includes(saved)) {
      setLangState(saved);
    }

    const handleStorageChange = () => {
      const current = localStorage.getItem("ui_lang") as LanguageCode;
      if (current && ["en", "hi", "mr", "te"].includes(current)) {
        setLangState(current);
      }
    };

    window.addEventListener("ui_lang_change", handleStorageChange);
    return () => window.removeEventListener("ui_lang_change", handleStorageChange);
  }, []);

  const setLang = (newLang: LanguageCode) => {
    localStorage.setItem("ui_lang", newLang);
    setLangState(newLang);
    window.dispatchEvent(new Event("ui_lang_change"));
  };

  const t = (key: string): string => {
    const cleanKey = key.trim();
    if (UI_TRANSLATIONS[cleanKey]) {
      return UI_TRANSLATIONS[cleanKey][lang] || cleanKey;
    }
    return cleanKey;
  };

  return { t, currentLanguage: lang, setLanguage: setLang };
}
